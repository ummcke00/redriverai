# PROGRESS.md — redriverai.ca

Last updated: 2026-08-08

## Startup Checklist

```bash
# 1. Check you're in the right place
cd ~/redriverai-website
git status --short

# 2. Verify Cloudflare credentials
echo $CLOUDFLARE_API_TOKEN > /dev/null || echo "MISSING: CLOUDFLARE_API_TOKEN"
echo $CLOUDFLARE_ACCOUNT_ID > /dev/null || echo "MISSING: CLOUDFLARE_ACCOUNT_ID"

# 3. Run the verify suite (requires playwright: pip install playwright && playwright install chromium)
python3 scripts/verify-site.py

# 4. Deploy if clean
./deploy.sh
```

## Current State

- **Live at:** https://redriverai.ca | https://www.redriverai.ca | https://redriverai.pages.dev
- **Theme:** Light (warm off-white #fdfaf8, logo-red accents). Replaced dark theme Jul 2, 2026.
- **Deploy method:** Manual wrangler pages deploy (direct upload). No git auto-deploy.
- **Verification:** `scripts/verify-site.py` — 7 checks covering reachability, CSP, logos, pricing contrast, voice widget, screenshots, chat-widget removal.
- **Voice:** ElevenLabs River widget active. Origin-locked to redriverai.ca.
- **Chat widget:** Deliberately removed (chat-widget.js/.css). Guarded by verify check 7.
- **GA4:** Active (G-GRGXSPHVJF). Weekly report cron Mondays 9am CDT.
- **CSP:** Fragile history — stray quotes, worker-src blob: regression. Currently stable. Guarded by verify check 2.

## Architecture

Single-page static HTML/CSS/JS site deployed to Cloudflare Pages:
- `index.html` — entire site (hero, services, pricing, about, footer)
- `style.css` — all styles, light theme
- `script.js` — minimal JS (smooth scroll, basic interactivity)
- `_headers` — CSP and other HTTP headers
- `_redirects` — www → apex redirect
- `deploy.sh` — wrangler pages deploy wrapper

No build step. No framework. No package.json. Just static files.

## Recent Sessions

### 2026-08-08 — Harness Artifacts Created
- Created feature-list.json (24 features: 20 done, 4 planned)
- Created PROGRESS.md (this file)
- Created init.sh (bootstrap script)
- AGENTS.md updated with mandatory harness artifact rule

### 2026-07-25 — Secret Scrub
- Backup tag: `backup-before-secret-scrub-2026-07-25`
- Removed credentials from claude-code-brief.md
- Added .gitignore for sub-agent briefing files

### 2026-07-24 — Full Redesign (Cloverdale Forge Inspired)
- Backup tag: `backup-before-redesign-2026-07-24`
- Clean/minimal aesthetic via Claude Fable 5
- Large logo in hero, training offer section below
- deploy.sh added

### 2026-07-24 — River Removal
- Backup tag: `backup-before-river-removal-2026-07-24`
- Removed ElevenLabs voice widget and all references (subscription cancelled, then re-added)

### 2026-07-05 — Verification Suite
- Backup tag: `backup-before-verification-suite-2026-07-05`
- Created scripts/verify-site.py (7 automated checks)
- Full design→coder→reviewer→gate cycle

### 2026-07-02 — Light Theme Retheme
- Backup tag: `backup-before-light-theme-2026-07-02`
- Dark "Prairie Cyber Noir" → light theme
- Logo flood-fill transparency, nav bumped to 46px
- Qwen3-Coder-Plus shipped broken screenshots + invisible-text CSS bugs — lessons learned

## Known Traps / Footguns

1. **CSP is fragile.** Stray quotes in _headers break everything. Always run verify-site.py check 2 after touching CSP.
2. **Direct upload only.** No git push → deploy hook. Must run `./deploy.sh` manually.
3. **Chat widget must stay dead.** verify-site.py check 7 guards this. If someone re-adds it, the verify script catches it.
4. **wrangler env vars required.** CLOUDFLARE_API_TOKEN (Pages edit scope) and CLOUDFLARE_ACCOUNT_ID (afc1b6457a4a0060ae932c53e856b97b).
5. **playwright needed for verify.** `pip install playwright && playwright install chromium` required for screenshot checks.
6. **Video pipeline is disabled.** The old ai-news-video/generate.js was renamed .disabled. Not part of this repo but worth knowing.

## Backup Tags

```
backup-before-deploy-script-2026-08-08
backup-before-light-theme-2026-07-02
backup-before-redesign-2026-07-24
backup-before-river-removal-2026-07-24
backup-before-secret-scrub-2026-07-25
backup-before-verification-suite-2026-07-05
```

## Links

- Cloudflare Dashboard: https://dash.cloudflare.com/ (account afc1b6457a4a0060ae932c53e856b97b, zone f7ff0158277f0b02d59e590127b6437c)
- Pages Project: redriverai (redriverai.pages.dev → redriverai.ca)
- GA4 Property: G-GRGXSPHVJF
- Credentials: ~/.openclaw/workspace/TOOLS.md (Cloudflare section)