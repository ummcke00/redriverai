#!/usr/bin/env python3
"""
Automated verification suite for redriverai.ca

Runs a fixed set of post-deploy checks (things that have actually broken before,
plus baseline health), prints a clear PASS/FAIL report, saves screenshots as
evidence, and exits 0 if all pass / 1 if any fail.

Checks (v1):
  1. Site reachable  — redriverai.ca and www.redriverai.ca both return 200
  2. CSP header valid — required directives present (script-src, connect-src,
                        worker-src with blob:), no obvious syntax errors
  3. Logo renders    — nav + hero logo images actually load (natural size > 0)
  4. Pricing visible — "Growth Retainer" featured card text has real contrast
                        (guards against the invisible-dark-text bug that shipped once)
  5. Voice widget    — River (ElevenLabs convai) loads with no console errors
  6. Screenshots     — mobile + desktop, saved with timestamp
  7. No chat-widget  — chat-widget.js / chat-widget.css must NOT load

Usage:
  python3 scripts/verify-site.py [--base-url https://redriverai.ca]
  python3 scripts/verify-site.py --headers-file /tmp/some/_headers   # test CSP locally
"""

import argparse
import datetime
import os
import re
import sys

import requests

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("FATAL: playwright not installed. Run: pip install playwright && playwright install chromium")
    sys.exit(2)


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_BASE_URL = "https://redriverai.ca"
HTTP_TIMEOUT = 15


class Report:
    def __init__(self):
        self.results = []  # (name, passed, detail)

    def add(self, name, passed, detail=""):
        self.results.append((name, bool(passed), detail))
        status = "PASS" if passed else "FAIL"
        line = f"[{status}] {name}"
        if detail:
            line += f" — {detail}"
        print(line)

    @property
    def all_passed(self):
        return all(p for _, p, _ in self.results)

    def summary(self):
        passed = sum(1 for _, p, _ in self.results if p)
        total = len(self.results)
        print("-" * 60)
        print(f"RESULT: {passed}/{total} checks passed")
        return self.all_passed


# ---------------------------------------------------------------------------
# HTTP-level checks (requests)
# ---------------------------------------------------------------------------

def check_reachable(report, base_url):
    """Check 1: both apex and www return 200."""
    host = re.sub(r"^https?://", "", base_url).rstrip("/")
    apex = host[4:] if host.startswith("www.") else host
    urls = [f"https://{apex}", f"https://www.{apex}"]
    ok = True
    details = []
    for u in urls:
        try:
            r = requests.get(u, timeout=HTTP_TIMEOUT, allow_redirects=True)
            code = r.status_code
            details.append(f"{u} -> {code}")
            if code != 200:
                ok = False
        except Exception as e:
            details.append(f"{u} -> ERROR {e}")
            ok = False
    report.add("1. Site reachable (apex + www return 200)", ok, "; ".join(details))


def _parse_csp(csp_value):
    """Parse a CSP string into {directive: [sources]}."""
    directives = {}
    for part in csp_value.split(";"):
        part = part.strip()
        if not part:
            continue
        tokens = part.split()
        directives[tokens[0].lower()] = tokens[1:]
    return directives


def _get_csp_string(base_url, headers_file):
    """Return (csp_string, source_description) from a local _headers file or live headers."""
    if headers_file:
        with open(headers_file, "r") as f:
            content = f.read()
        # _headers format: find the Content-Security-Policy: line
        m = re.search(r"Content-Security-Policy:\s*(.+)", content, re.IGNORECASE)
        if not m:
            return None, f"no CSP found in {headers_file}"
        return m.group(1).strip(), f"local file {headers_file}"
    # Live: read the response header
    r = requests.get(base_url, timeout=HTTP_TIMEOUT, allow_redirects=True)
    csp = r.headers.get("Content-Security-Policy")
    if not csp:
        return None, f"no CSP header returned by {base_url}"
    return csp, f"live header from {r.url}"


def check_csp(report, base_url, headers_file):
    """Check 2: CSP present, well-formed, required directives + values."""
    try:
        csp, src = _get_csp_string(base_url, headers_file)
    except Exception as e:
        report.add("2. CSP header valid", False, f"error reading CSP: {e}")
        return

    if not csp:
        report.add("2. CSP header valid", False, src)
        return

    problems = []

    # Syntax sanity: stray quotes. A well-formed CSP has balanced single quotes
    # (each keyword like 'self' is quoted). An odd count signals the stray-quote typo bug.
    quote_count = csp.count("'")
    if quote_count % 2 != 0:
        problems.append(f"unbalanced single quotes (count={quote_count}) — stray-quote typo")

    directives = _parse_csp(csp)

    # Required directives must exist and be non-empty
    for d in ("script-src", "connect-src", "worker-src"):
        if d not in directives:
            problems.append(f"missing directive: {d}")
        elif not directives[d]:
            problems.append(f"empty directive: {d}")

    # worker-src must include blob: (needed for ElevenLabs)
    if "worker-src" in directives and "blob:" not in directives["worker-src"]:
        problems.append("worker-src missing blob: (needed for ElevenLabs)")

    # ElevenLabs endpoints must be allowed in connect-src
    if "connect-src" in directives:
        cs = " ".join(directives["connect-src"])
        if "elevenlabs.io" not in cs:
            problems.append("connect-src missing elevenlabs.io endpoints")

    ok = not problems
    detail = src if ok else "; ".join(problems)
    report.add("2. CSP header valid (script/connect/worker-src, blob:)", ok, detail)


# ---------------------------------------------------------------------------
# Rendering checks (playwright / headless chromium)
# ---------------------------------------------------------------------------

def check_rendering(report, base_url, run_dir):
    """Checks 3-7 in a single browser session (efficient, one page load)."""
    console_errors = []
    requested_urls = []

    with sync_playwright() as p:
        browser = p.chromium.launch()

        # --- Desktop context ---
        desktop = browser.new_context(viewport={"width": 1440, "height": 900})
        page = desktop.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("request", lambda req: requested_urls.append(req.url))

        page.goto(base_url, wait_until="networkidle", timeout=25000)

        # -- Check 3: Logos render (natural size > 0 => actually loaded, not 404/broken) --
        logo_selectors = {
            "nav logo (.nav-logo-img)": "img.nav-logo-img",
            "hero logo (.logo-badge-icon)": "img.logo-badge-icon",
        }
        logo_problems = []
        for label, sel in logo_selectors.items():
            el = page.query_selector(sel)
            if not el:
                logo_problems.append(f"{label}: element not found")
                continue
            nat_w = page.evaluate("(e) => e.naturalWidth", el)
            nat_h = page.evaluate("(e) => e.naturalHeight", el)
            complete = page.evaluate("(e) => e.complete", el)
            if not complete or not nat_w or not nat_h:
                logo_problems.append(f"{label}: not loaded (complete={complete}, {nat_w}x{nat_h})")
        report.add("3. Logo images render (nav + hero)", not logo_problems,
                   "all loaded" if not logo_problems else "; ".join(logo_problems))

        # -- Check 4: Growth Retainer featured pricing card text is visible/contrasted --
        card = page.query_selector(".pricing-card.featured")
        if not card:
            report.add("4. Pricing 'Growth Retainer' text visible", False,
                       ".pricing-card.featured not found")
        else:
            info = page.evaluate(
                """(card) => {
                    const h3 = card.querySelector('h3');
                    const feat = card.querySelector('.pricing-features li');
                    function rgb(el){
                        const s = getComputedStyle(el);
                        return {color: s.color, opacity: s.opacity, display: s.display, visibility: s.visibility};
                    }
                    function bg(el){
                        // walk up until a non-transparent background is found
                        let n = el;
                        while(n){
                            const c = getComputedStyle(n).backgroundColor;
                            if(c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
                            n = n.parentElement;
                        }
                        return getComputedStyle(document.body).backgroundColor;
                    }
                    return {
                        h3text: h3 ? h3.textContent.trim() : null,
                        h3: h3 ? rgb(h3) : null,
                        h3bg: h3 ? bg(h3) : null,
                        featText: feat ? feat.textContent.trim() : null,
                        feat: feat ? rgb(feat) : null,
                        featbg: feat ? bg(feat) : null,
                    };
                }""", card)

            def parse_rgb(s):
                nums = re.findall(r"[\d.]+", s or "")
                if len(nums) >= 3:
                    return [float(nums[0]), float(nums[1]), float(nums[2])]
                return None

            def luminance(rgb):
                def lin(c):
                    c = c / 255.0
                    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
                r, g, b = rgb
                return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

            def contrast(fg, bg):
                l1, l2 = luminance(fg), luminance(bg)
                hi, lo = max(l1, l2), min(l1, l2)
                return (hi + 0.05) / (lo + 0.05)

            problems = []
            checks = [
                ("Growth Retainer heading", info.get("h3text"), info.get("h3"), info.get("h3bg")),
                ("pricing feature text", info.get("featText"), info.get("feat"), info.get("featbg")),
            ]
            for label, text, style, bgc in checks:
                if not text:
                    problems.append(f"{label}: no text")
                    continue
                if style:
                    if float(style.get("opacity", "1")) < 0.1:
                        problems.append(f"{label}: opacity {style['opacity']}")
                    if style.get("visibility") == "hidden" or style.get("display") == "none":
                        problems.append(f"{label}: hidden ({style.get('visibility')}/{style.get('display')})")
                fg = parse_rgb(style.get("color") if style else None)
                bgp = parse_rgb(bgc)
                if fg and bgp:
                    ratio = contrast(fg, bgp)
                    if ratio < 3.0:  # WCAG large-text floor; catches invisible/near-invisible text
                        problems.append(f"{label}: contrast {ratio:.2f}:1 (fg={style['color']} bg={bgc})")
            # Confirm the expected heading is literally present
            if info.get("h3text") and "Growth Retainer" not in info["h3text"]:
                problems.append(f"unexpected heading text: {info['h3text']!r}")
            report.add("4. Pricing 'Growth Retainer' text visible/contrasted",
                       not problems,
                       f"heading={info.get('h3text')!r}" if not problems else "; ".join(problems))

        # -- Check 5: Voice widget (River / ElevenLabs) loads without console errors --
        widget_el = page.query_selector("elevenlabs-convai")
        widget_script_loaded = any("convai-widget" in u for u in requested_urls)
        widget_problems = []
        if not widget_el:
            widget_problems.append("<elevenlabs-convai> element not found")
        if not widget_script_loaded:
            widget_problems.append("convai-widget script not requested")
        if console_errors:
            widget_problems.append(f"{len(console_errors)} console error(s): " +
                                   " | ".join(console_errors[:3]))
        report.add("5. Voice widget (River/ElevenLabs) loads, no console errors",
                   not widget_problems,
                   "widget present, 0 console errors" if not widget_problems else "; ".join(widget_problems))

        # -- Check 7: chat-widget.js / chat-widget.css must NOT be loaded --
        chat_hits = [u for u in requested_urls if "chat-widget" in u.lower()]
        report.add("7. chat-widget.js/.css NOT loaded (must stay removed)",
                   not chat_hits,
                   "not present" if not chat_hits else f"RESURRECTED: {chat_hits}")

        # -- Check 6a: desktop screenshot --
        desktop_shot = os.path.join(run_dir, "desktop.png")
        page.screenshot(path=desktop_shot, full_page=True)
        desktop_ok = os.path.exists(desktop_shot) and os.path.getsize(desktop_shot) > 0
        desktop.close()

        # -- Check 6b: mobile screenshot --
        mobile = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
        mpage = mobile.new_page()
        mpage.goto(base_url, wait_until="networkidle", timeout=25000)
        mobile_shot = os.path.join(run_dir, "mobile.png")
        mpage.screenshot(path=mobile_shot, full_page=True)
        mobile_ok = os.path.exists(mobile_shot) and os.path.getsize(mobile_shot) > 0
        mobile.close()

        browser.close()

    both = desktop_ok and mobile_ok
    report.add("6. Mobile + desktop screenshots captured",
               both,
               f"{desktop_shot} ({os.path.getsize(desktop_shot)}B), "
               f"{mobile_shot} ({os.path.getsize(mobile_shot)}B)" if both else "screenshot missing/empty")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Verify redriverai.ca post-deploy.")
    ap.add_argument("--base-url", default=DEFAULT_BASE_URL)
    ap.add_argument("--headers-file", default=None,
                    help="Parse CSP from a local _headers file instead of live headers (for testing).")
    args = ap.parse_args()

    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = os.path.join(REPO_ROOT, "verify-runs", ts)
    os.makedirs(run_dir, exist_ok=True)

    print(f"Verifying {args.base_url}")
    print(f"Run dir: {run_dir}")
    print("=" * 60)

    report = Report()
    check_reachable(report, args.base_url)
    check_csp(report, args.base_url, args.headers_file)
    check_rendering(report, args.base_url, run_dir)

    ok = report.summary()
    print(f"Evidence saved to: {run_dir}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
