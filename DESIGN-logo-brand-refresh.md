# Design: Logo & Brand Presence Refresh — redriverai.ca

**Date:** 2026-07-01
**Requested by:** Willy McKenzie
**Trigger:** Site design review — logo (hand-drawn by Willy's wife, an artist) is nearly invisible on the site; brand colors should be pulled from/matched to the logo; logo should be featured prominently.

## Context / Findings

- Logo (`logo.png`, 1536x1024, white bg) is a genuinely strong piece of brand art: a red circuit-tree/rising-sun motif flowing into a Métis-style infinity symbol, which flows into a river — ties together AI (circuits), Métis heritage (infinity symbol), and "Red River" (the river motif). This is a real differentiator and currently gets almost no visual weight.
- Logo red sampled at ~#aa0101–#e51b3e (gradient, darker at top ~#aa0101/#b00101, brighter toward #e51b3e-ish at bottom of the gradient circle).
- Site's existing CSS vars: `--primary: #c8102e`, `--primary-2: #e51b3e`. These are close to the logo's red but skew slightly more pink/crimson than the logo's true red-orange. Should nudge the palette to match the logo more precisely rather than the reverse.
- Currently the logo appears in exactly two places: nav bar (`.nav-logo-img`, height 38px) and footer (`.footer-logo`, height 44px). It is completely absent from the hero section — the first thing visitors see has no brand mark beyond a tiny 38px nav icon.
- The "reveal on scroll" animation (`.reveal` class + IntersectionObserver in script.js) is legitimate and works for real scrolling users, but has no JS-failure fallback — if JS errors or loads slowly, sections stay at `opacity:0` permanently. Not urgent-broken, but worth hardening while in the file.

## Goals (per Willy's ask)

1. Match site's color palette precisely to the logo's actual red gradient.
2. Feature the logo prominently — not just a nav icon.
3. Do NOT redesign wholesale — scoped, additive changes only. Willy's wife made this logo; the ask is to *honor and showcase* it, not overhaul the site.

## Scope of Changes

### 1. Color palette alignment
- Sample logo gradient stops precisely (top ring ~#a90101 → bottom/brighter areas trending toward ~#c81f1f — will re-sample with a proper color picker on the gradient circle specifically, not full-image histogram, since histogram was dominated by white bg + anti-aliasing pixels).
- Update `--primary` and `--primary-2` CSS vars to the sampled gradient stops if they differ meaningfully (>10% hue/sat drift) from current. If current vars are already within reasonable tolerance, leave as-is and note it — don't change color for the sake of change.

### 2. Feature the logo in the hero
- Add the logo mark (icon portion, or full lockup) as a visual anchor in the hero section — options ranked by preference:
  a. **Preferred:** Place a medium-large version of the logo icon (not full wordmark, to avoid redundancy with the "RED RIVER AI" nav wordmark) to the right of or behind the hero headline, matching the existing hero-visual slot (there's currently a code-editor mockup graphic there — check if it can coexist or should be swapped/supplemented).
  b. Add a subtle full-bleed watermark/glow of the logo's circular icon behind the hero content (low opacity, doesn't compete with text).
- Increase nav logo size modestly if it reads as too small at 38px (test at 44-48px, matching footer).
- Do not remove existing hero copy or restructure hero layout — additive only.

### 3. Logo treatment on dark background
- Logo asset is on a white background (1536x1024 raster, not transparent per the RGBA sample — need to verify alpha channel; histogram showed alpha>20 filter still returned near-white as top color, suggesting the background may NOT be transparent).
- **Must verify/produce a transparent-background version** before placing on the dark theme, or it will show an ugly white box. If no transparent PNG exists, need to either:
  - Extract just the icon (circle + infinity + river) with background removed, or
  - Request/generate a transparent variant.
- This is a blocking sub-task — confirm asset state before implementing hero placement.

## Non-goals
- No new sections, no copy rewrites, no pricing changes.
- No fix to the scroll-reveal architecture beyond an optional no-JS/failure fallback (nice-to-have, not required for this pass).
- No touching the "Prairie Tech Veteran" story placement (separate feedback item, not part of this request).

## Test Plan
- Visual diff screenshots (before/after) of: nav bar, hero section, footer, at both desktop (1440px) and mobile (390px) widths.
- Verify logo renders cleanly on dark background at all sizes used (no white box artifacts, no pixelation at largest size used).
- Verify no layout shift/overlap with existing hero copy or CTAs at common breakpoints (1440, 1024, 768, 390).
- Confirm color var changes (if any) don't break contrast ratios already relied upon elsewhere (buttons, links, accent text) — spot check 3-4 places `--primary`/`--primary-2` are used.
- Local static file preview (open index.html or serve via simple http.server) — no build step exists, this is plain HTML/CSS/JS.

## Acceptance Criteria
- [ ] Logo icon visibly present and legible in the hero section on both desktop and mobile, with no white-box background artifact.
- [ ] Color palette matches logo's actual red within reasonable tolerance (or confirmed already matching, documented).
- [ ] No regressions to existing layout, copy, or functioning sections.
- [ ] Nav/footer logo sizing reviewed and adjusted if too small.
- [ ] Willy reviews screenshots before anything is deployed/pushed live.
