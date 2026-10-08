#!/usr/bin/env python3
"""Remove the River widget script tag from every site page (idempotent)."""
import os
import re

BASE = "/home/wmckenzie/redriverai-website"
PAGES = [
    "index.html",
    "audit.html",
    "privacy.html",
    "ai-automation-winnipeg/index.html",
    "business-automation-manitoba/index.html",
    "winnipeg-small-business-automation/index.html",
]

# The block we inserted: an optional comment line + the script tag.
PATTERNS = [
    re.compile(r"[ \t]*<!--\s*River voice assistant[^>]*-->\s*\n[ \t]*<script[^>]*river-widget\.js[^>]*></script>\s*\n", re.I),
    re.compile(r"[ \t]*<script[^>]*river-widget\.js[^>]*></script>\s*\n", re.I),
]

for rel in PAGES:
    p = os.path.join(BASE, rel)
    if not os.path.exists(p):
        print(f"  {rel}: MISSING")
        continue
    s = open(p).read()
    if "river-widget.js" not in s:
        print(f"  {rel}: already clean")
        continue
    orig = s
    for pat in PATTERNS:
        s = pat.sub("", s)
    if s == orig:
        print(f"  {rel}: NO PATTERN MATCHED (manual check needed)")
    else:
        open(p, "w").write(s)
        print(f"  {rel}: removed")
