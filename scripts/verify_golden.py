#!/usr/bin/env python3
"""Golden Alignment verifier (task: golden-alignment-v1).

Stdlib-only. Exits 0 only when index.html contains:
  1. The free A/R audit card heading "Free A/R Aging Check"
  2. All three measurable pricing lines
  3. The mastery-story phrase "18 years" (hero subtitle)
  4. A JSON-LD <script type="application/ld+json"> block that parses as valid JSON
Prints a PASS/FAIL summary and exits non-zero listing what's missing.
"""
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
INDEX = REPO / "index.html"

CHECKS = [
    ("A/R audit card heading 'Free A/R Aging Check'", "Free A/R Aging Check"),
    ("Starter measurable line 'One recovered invoice typically pays for it.'",
     "One recovered invoice typically pays for it."),
    ("Growth measurable line 'Built to recover more than it costs — or we've failed.'",
     "Built to recover more than it costs — or we've failed."),
    ("Enterprise measurable line 'Scoped against the money it saves — never more.'",
     "Scoped against the money it saves — never more."),
    ("Mastery-story phrase '18 years'", "18 years"),
    ("Mastery-story hero subtitle phrase 'prairie businesses paid faster'",
     "prairie businesses paid faster"),
]

JSONLD_RE = re.compile(
    r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.DOTALL | re.IGNORECASE,
)


def main() -> int:
    failures = []

    if not INDEX.exists():
        print(f"FAIL: index.html not found at {INDEX}")
        return 1

    html = INDEX.read_text(encoding="utf-8")

    for label, needle in CHECKS:
        status = "PASS" if needle in html else "FAIL"
        print(f"[{status}] {label}")
        if needle not in html:
            failures.append(label)

    # JSON-LD validity: every ld+json block must parse as JSON
    blocks = JSONLD_RE.findall(html)
    if not blocks:
        print("[FAIL] JSON-LD: no <script type=\"application/ld+json\"> block found")
        failures.append("JSON-LD: no ld+json script block present")
    else:
        for i, block in enumerate(blocks, 1):
            try:
                data = json.loads(block)
                print(f"[PASS] JSON-LD block {i} parses as valid JSON "
                      f"({len(block)} chars, @graph entries: {len(data.get('@graph', []))})")
            except json.JSONDecodeError as exc:
                print(f"[FAIL] JSON-LD block {i} is not valid JSON: {exc}")
                failures.append(f"JSON-LD block {i} invalid: {exc}")

    print("-" * 60)
    if failures:
        print(f"FAIL: {len(failures)} check(s) missing:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("PASS: all golden-alignment checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
