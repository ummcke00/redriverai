# Design: Automated Verification Suite for redriverai.ca

**Date:** 2026-07-05
**Author:** Jimi (self-audit follow-up, task 2 of 5)
**Backup tag:** backup-before-verification-suite-2026-07-05

## Problem

Every deploy to redriverai.ca currently gets verified by manually re-deriving checks from scratch:
open browser, screenshot, crop, inspect visually, repeat for mobile, repeat for each section.
This is slow, inconsistent (I might forget to check something I checked last time), and leaves
no persistent record of what "known good" looks like.

## Goal

A single script I can run after any deploy that checks the things that have actually broken
before, plus baseline site health, and gives a clear pass/fail with evidence (not just "looks
fine to me").

## Scope (v1 — keep it focused, not exhaustive)

Checks that map directly to real incidents we've had:
1. **Site is reachable** — redriverai.ca and www.redriverai.ca both return 200
2. **CSP header is valid** — no syntax errors (the stray-quote bug), required directives present
   (script-src, connect-src, worker-src with blob: for ElevenLabs)
3. **Logo renders** — nav logo and hero logo images actually load (not 404, not broken)
4. **Pricing section text is visible** — specifically re-check the "Growth Retainer"/featured
   card contrast, since this exact bug shipped once already
5. **Voice widget (River) loads without console errors** — the ElevenLabs widget script loads
   and doesn't throw on init
6. **Mobile + desktop screenshots captured** — saved with timestamp for visual diff/reference,
   not auto-compared (no baseline image diffing in v1 — too fragile, false positives from
   anti-aliasing/font rendering differences across runs)
7. **No dead/removed code paths resurrected** — confirm chat-widget.js/.css are NOT being loaded
   (we removed this deliberately; a bad merge/revert could bring it back silently)

## Explicitly out of scope for v1
- Visual pixel-diffing (too fragile, high false-positive rate, not worth the complexity yet)
- Full accessibility audit
- Performance/lighthouse scoring
- Cross-browser testing (Chrome headless only for now)

## Architecture

Single Python script: `scripts/verify-site.py` (lives in redriverai-website repo, not workspace,
since it's site-specific tooling that should travel with the site).

- Uses `requests` for HTTP-level checks (reachability, CSP header parsing)
- Uses headless Chrome via existing browser tooling pattern (screenshot + basic DOM checks)
  for rendering checks
- Outputs a clear PASS/FAIL summary per check, plus saves screenshots with timestamps to
  `verify-runs/<timestamp>/` for evidence
- Exit code 0 if all pass, 1 if any fail — so it can gate a deploy script later if desired
- No dependencies beyond what's already used elsewhere (requests, playwright/chrome control)

## Test plan
- Run against current live site (should be all green — it's the known-good post-retheme state)
- Deliberately break one thing locally (e.g. reintroduce the old CSP typo) and confirm the
  script catches it and fails clearly
- Confirm it runs in under ~30 seconds so it's actually usable after every deploy, not a chore

## Acceptance criteria
- Running `python3 scripts/verify-site.py` against https://redriverai.ca produces a clear
  pass/fail report covering all 7 checks above
- At least one deliberately-broken scenario is tested and correctly caught
- Screenshots are saved with evidence, not just a text claim
