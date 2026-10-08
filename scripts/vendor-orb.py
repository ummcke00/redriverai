#!/usr/bin/env python3
"""
Extract the ElevenLabs orb from @elevenlabs/convai-widget-core into a standalone
ES module for redriverai.ca.

Source: @elevenlabs/convai-widget-core@0.19.0 (MIT, Copyright (c) 2025 ElevenLabs)
        https://github.com/elevenlabs/packages  -> packages/convai-widget-core
        dist/index.js, the `Orb` class + its two shader strings.

What this does:
  - reads the already-extracted working page (workspace/tmp/orb.html)
  - pulls out the shader strings and the Orb class
  - repoints the perlin-noise texture at our own /assets/orb-noise.png
    (the CDN image is NOT covered by the MIT licence, so we generate our own)
  - adds the required MIT attribution header
  - exports the class as an ES module
"""
import os
import re

SRC = "/home/wmckenzie/.openclaw/workspace/tmp/orb.html"
OUT = "/home/wmckenzie/redriverai-website/assets/orb.js"

html = open(SRC).read()
m = re.search(r"<script>([\s\S]*?)</script>", html)
if not m:
    raise SystemExit("no <script> block found in " + SRC)
js = m.group(1)

# Drop the demo bootstrap line.
js = re.sub(r"window\.o\s*=\s*new\s+Orb\([^)]*\);\s*$", "", js).strip()

# Repoint the noise texture at our own copy.
js = js.replace(
    'https://storage.googleapis.com/eleven-public-cdn/images/perlin-noise.png',
    '/assets/orb-noise.png',
)

HEADER = '''/**
 * ElevenLabs Conversational AI orb — vendored, unmodified apart from the
 * noise-texture URL and module export.
 *
 * Copyright (c) 2025 ElevenLabs
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Source: @elevenlabs/convai-widget-core@0.19.0
 *         https://github.com/elevenlabs/packages
 *         packages/convai-widget-core/dist/index.js (the `Orb` class)
 *
 * Local changes: noise texture URL -> /assets/orb-noise.png ; added `export`.
 * Licensed MIT. Not affiliated with or endorsed by ElevenLabs.
 */

'''

js = HEADER + js + "\n\nexport { Orb };\n"

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w").write(js)

print("wrote", OUT, len(js), "bytes")
print("has Orb class:", "class Orb" in js or "class e" in js)
print("noise url:", "/assets/orb-noise.png" in js)
print("attribution:", "Copyright (c) 2025 ElevenLabs" in js)
print("export:", js.rstrip().endswith("export { Orb };"))
