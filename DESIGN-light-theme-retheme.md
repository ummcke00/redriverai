# Design: Light Theme Retheme to Match Original Logo — redriverai.ca

**Date:** 2026-07-02
**Requested by:** Willy McKenzie
**Trigger:** Willy wants the site to use his wife's original logo exactly as designed (icon + wordmark together, on its natural light background) with the site's color theme changed to match — rather than forcing the logo to fit into the existing dark "Prairie Cyber Noir" theme. Explicit instruction: "I want the original logo back along with original colors. If you have to change theme of site do it, but I want the logo back to original form."

**Backup taken before this work:**
- Git tag `backup-before-light-theme-2026-07-02` on the current dark-theme commit
- Full filesystem copy at `/home/wmckenzie/backups/redriverai-website-dark-theme-backup-2026-07-02`
- Live production is unaffected until this work is reviewed and explicitly deployed

## Context / Findings

- The original logo (`logo.png`) is fundamentally a **light-background mark**: white background, a red gradient icon (circuit-tree/rising-sun → Métis infinity symbol → river motif) with pure white line-art detail inside it, plus a "RED RIVER AI" wordmark in the same red, stacked below the icon.
- Sampled red gradient: dark stops around **#8b0000–#a90000**, bright/highlight stops trending toward a lighter red, average around **#cc0c0c**. This is a warm, slightly orange-leaning true red — no blue/pink component (very different from typical "brand red" hex codes that skew crimson).
- There is **no dark or black color anywhere in the original logo** — it is a light-mode mark by design.
- Current site theme ("Prairie Cyber Noir") is a near-black background (`--bg: #0a0a0f`) with light gray text and red accents — the opposite of the logo's native context. This is why the logo has looked out of place / needed cropping and background removal tricks in prior work.
- A transparent full-lockup version of the logo already exists at `logo-full-transparent.png` (icon + wordmark, background removed, edges cleaned, verified against both light and dark test backgrounds during prior work — renders correctly on both, so it remains usable regardless of final theme direction).
- Prior attempt to retrofit the full lockup into the existing dark nav bar failed on legibility grounds (icon-over-text stacked layout doesn't compress well into a ~60px-tall horizontal nav strip) — this is one of the concrete problems a full retheme can resolve, since a light theme doesn't require awkward icon-only cropping to begin with.

## Goals

1. Feature the logo in its original, undistorted form (icon + wordmark together) prominently across the site — nav, footer, and hero — without needing to crop, recolor, or otherwise alter what Willy's wife actually designed.
2. Shift the site's color theme to genuinely match and complement the logo's real palette (light background, red accent derived from the logo's actual sampled colors) rather than forcing light-mode art onto a dark-mode shell.
3. Preserve all existing content, copy, structure, sections, and functionality (pricing, case studies, audit form, River widget, etc.) — this is a visual/theme change, not a content or IA change.
4. Maintain or improve accessibility/contrast — moving to light mode changes every contrast pairing in the site (text on background, buttons, cards, borders) and each needs to be re-validated, not just inverted blindly.

## Proposed Color Palette (derived from logo)

```
--bg:              #fdfaf8   (soft warm off-white, not stark #ffffff, easier on the eyes and closer to the logo's actual near-white background tone)
--surface:         #ffffff   (card/panel backgrounds)
--surface-2:       #f5efec   (subtle warm gray-beige for secondary surfaces, hover states)
--border:          #e8ddd8   (soft warm border, not harsh black-ish gray)
--primary:         #a90000   (darker red gradient stop, used for primary actions/accents — good contrast on white)
--primary-2:       #cc0c0c   (brighter red gradient stop — matches logo's average, used for gradients/hover states)
--primary-glow:    rgba(169, 0, 0, 0.08)   (much lower alpha than dark theme, glows read differently on light bg)
--primary-glow-strong: rgba(169, 0, 0, 0.18)
--text:            #1a1210   (near-black warm dark, NOT pure #000 — softer on white)
--text-muted:      #6b5f5a
--text-dim:        #a89d97
--success:         #0a8a5c   (darkened from dark-theme's #00d68f for adequate contrast on white)
--warning:         #b8860b   (darkened from dark-theme's #ffb800 for adequate contrast on white)
```

Rationale: pulling both a dark (#a90000) and bright (#cc0c0c) stop from the actual logo gradient (rather than inventing a generic "brand red") keeps the primary/primary-2 pairing visually connected to the real logo, same pattern used successfully in the earlier color-matching pass on the dark theme.

## Scope of Changes

### 1. Core color variables (style.css `:root`)
Replace dark-theme values with the light palette above. This cascades automatically through everything using `var(--bg)`, `var(--text)`, etc. — but **every component needs a pass**, not just the root vars, because:

### 2. Glassmorphism (`.glass`) needs rework
Current `.glass` treatment (`linear-gradient(160deg, rgba(26,26,36,0.72), rgba(19,19,26,0.62))` + backdrop-blur) was tuned for a dark background — semi-transparent dark panels over a dark backdrop create a subtle depth effect. On a light background, the same technique needs inverted alpha values (semi-transparent white/light panels) or the cards will look muddy or invisible. Needs explicit redesign, not a find-replace.

### 3. Every section needs a contrast audit
Sections using `--bg`, `--surface`, `--text-muted` directly for readability (dashboard cards, pricing cards, case study cards, about/credentials cards, audit form, footer) must be individually checked after the palette swap — text that was "light gray on near-black" becomes "light gray on near-white" if not adjusted, which fails contrast badly. This is the highest-risk part of the change and needs real screenshot verification, not just "the variables changed so it should work."

### 4. Ambient background glow effect
`body::before` currently uses `radial-gradient(...rgba(200,16,46,0.10)...)` glows meant to be visible against near-black. On a light background these need much lower opacity or a different treatment entirely (a radial red glow at 10% opacity is basically invisible on white, but could look like a stain if miscalibrated) — needs visual testing, not a blind value swap.

### 5. Logo placement — now unconstrained
With a light theme, the original logo lockup (`logo-full-transparent.png` OR even potentially the plain `logo.png` on a light enough background where the white bg blends in) can be used freely:
- **Nav:** full lockup at a comfortable size (revisit sizing now that legibility isn't fighting a dark bg — may still want a horizontal-friendly crop/size, but no longer fighting a color mismatch)
- **Footer:** full lockup, larger, comfortable
- **Hero:** full lockup can be a real featured visual element now — no more watermark/badge workarounds needed to hide it "safely" on a clashing background. Consider making it a hero-anchor visual in its own right.

### 6. Button, form, and interactive element states
All `.btn`, `.pricing-card`, form inputs, radio buttons, etc. need their light/dark assumptions re-checked (e.g. `.btn-secondary` likely assumed a dark surface behind light text — needs inversion).

### 7. Things that should NOT change
- No copy changes, no section reordering, no removal of case studies/pricing/audit form/River widget.
- No change to the underlying grid/layout structure — this is a color and surface-treatment change, not a layout redesign.
- No change to fonts, spacing scale, or component structure beyond what's needed for light-mode legibility.

## Test Plan
- Full-page screenshots at 1440px and 390px, every major section, compared against a contrast checklist:
  - Body text on background: WCAG AA minimum (4.5:1) wherever text is meant to be read normally
  - Button text on button background
  - Card text on card surface
  - Nav links on navbar background
- Verify logo (in whichever form is used — full lockup vs original file) has zero white-halo or mismatched-background artifacts on the new light theme.
- Verify all interactive states (hover, focus, disabled) are visible and make sense in light mode.
- Cross-check the River widget's floating button/panel styling still reads clearly against the new page background (ElevenLabs widget has its own styling via `platform_settings.widget` colors already set to dark bg/red button — may need a matching update so it doesn't look like a mismatched dark box floating on a light page).
- Local static preview via `python3 -m http.server`, screenshots via headless Chrome (established working method from prior sessions).

## Acceptance Criteria
- [ ] Site background is light, derived from/complementary to the logo's actual palette (not just an arbitrary white).
- [ ] Original logo (icon + wordmark together, undistorted) is used prominently — no more cropping just to make it dark-theme-safe.
- [ ] All text passes basic contrast checks across every section (verified via screenshot review, not assumption).
- [ ] No regressions to content, functionality, or existing sections.
- [ ] River widget still looks visually coherent with the new page theme.
- [ ] Willy reviews before anything is deployed live — same as all prior site work.

## Risk / Effort Note
This is meaningfully bigger than the previous logo/color-matching passes — it touches every section's visual treatment, not just the logo and a couple of CSS variables. Recommend delegating to a coder with this full design doc, followed by a careful visual review pass (screenshots at multiple breakpoints, section by section) before anything goes near production, given how easy it is for a "just flip the palette" change to quietly break readability somewhere.
