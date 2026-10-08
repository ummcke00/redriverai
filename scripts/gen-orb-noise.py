#!/usr/bin/env python3
"""
Generate a Perlin/fBm noise texture for the River orb shader.

WHY: the ElevenLabs orb shader samples a perlin-noise PNG that they host on
their Google CDN. That image is NOT in the MIT npm package, so the licence does
not clearly cover copying it. The shader only reads the red channel at v=0.5,
so we can make our own equivalent noise.

Output: 1024x64 RGBA PNG, grayscale noise in RGB, opaque alpha.
"""
import numpy as np
from PIL import Image
import os

W, H = 1024, 64
SEED = 20261007

OUT_DIR = "/home/wmckenzie/redriverai-website/assets"
os.makedirs(OUT_DIR, exist_ok=True)


def value_noise_1d(n, freq, rng):
    """Smooth 1-D value noise sampled over n points at the given frequency."""
    knots = rng.random(freq + 1)
    xs = np.linspace(0, freq, n, endpoint=False)
    i = np.floor(xs).astype(int)
    f = xs - i
    # smoothstep interpolation
    u = f * f * (3 - 2 * f)
    return knots[i] * (1 - u) + knots[i + 1] * u


def fbm_2d(w, h, octaves=4, base_freq=8, rng=None):
    """Simple fBm from summed value-noise grids."""
    out = np.zeros((h, w), dtype=np.float64)
    amp = 1.0
    tot = 0.0
    for o in range(octaves):
        freq = base_freq * (2 ** o)
        # 2-D value noise: interpolate a coarse random grid
        gx = rng.random((freq + 1, freq + 1))
        ys = np.linspace(0, freq, h, endpoint=False)
        xs = np.linspace(0, freq, w, endpoint=False)
        yi = np.floor(ys).astype(int); yf = ys - yi
        xi = np.floor(xs).astype(int); xf = xs - xi
        uy = (yf * yf * (3 - 2 * yf))[:, None]
        ux = (xf * xf * (3 - 2 * xf))[None, :]
        a = gx[yi][:, xi]
        b = gx[yi][:, xi + 1]
        c = gx[yi + 1][:, xi]
        d = gx[yi + 1][:, xi + 1]
        top = a * (1 - ux) + b * ux
        bot = c * (1 - ux) + d * ux
        out += amp * (top * (1 - uy) + bot * uy)
        tot += amp
        amp *= 0.5
    return out / tot


rng = np.random.default_rng(SEED)
# Noise for the whole image, plus a strong horizontal component because the
# shader samples one row while animating x over time.
noise = fbm_2d(W, H, octaves=4, base_freq=8, rng=rng)
row = value_noise_1d(W, 16, rng)
# Bias toward the horizontal band so the animated sampling looks organic.
combined = 0.65 * noise + 0.35 * row[None, :]

# Normalise to full 0-255 range
lo, hi = combined.min(), combined.max()
norm = (combined - lo) / (hi - lo) if hi > lo else np.zeros_like(combined)
img = (norm * 255).astype(np.uint8)

rgba = np.dstack([img, img, img, np.full_like(img, 255)])
Image.fromarray(rgba, "RGBA").save(os.path.join(OUT_DIR, "orb-noise.png"))

print("wrote", os.path.join(OUT_DIR, "orb-noise.png"))
print("size:", rgba.shape, "| value range:", int(img.min()), "-", int(img.max()))
print("mean:", round(float(img.mean()), 1))
