#!/usr/bin/env python3
"""Insert the River widget module script before </body> on each site page (idempotent)."""
import os

BASE = "/home/wmckenzie/redriverai-website"
PAGES = [
    "index.html",
    "audit.html",
    "privacy.html",
    "ai-automation-winnipeg/index.html",
    "business-automation-manitoba/index.html",
    "winnipeg-small-business-automation/index.html",
]
# type="module" is required: the widget imports the vendored orb module.
TAG = ('    <!-- River voice assistant: Web Speech API in, OpenRouter ElevenLabs out. '
       'Orb vendored from @elevenlabs/convai-widget-core (MIT). -->\n'
       '    <script type="module" src="/river-widget.js"></script>\n')

for rel in PAGES:
    p = os.path.join(BASE, rel)
    if not os.path.exists(p):
        print(f"  {rel}: MISSING")
        continue
    s = open(p).read()
    if "river-widget.js" in s:
        print(f"  {rel}: already present")
        continue
    if "</body>" not in s:
        print(f"  {rel}: no </body>")
        continue
    i = s.rfind("</body>")
    s = s[:i] + TAG + s[i:]
    open(p, "w").write(s)
    print(f"  {rel}: inserted")
