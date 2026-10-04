# Slice 06 — Harness + Android 8 check

**Status:** Approved by Papa 2026-10-04 (`design.md`).
**Goal:** The new Lab works by touch on the target tablets, offline, at all three tablet sizes.
**Depends on:** 01–05.
**Files:** `scripts/check-codequest-lab-ui.py`, `test-results/codequest-lab/`, fixes wherever the harness finds them.

## Change

- **Harness sizes:** 1024×600, 1280×800 and 1366×768, plus the existing 1280×600. At each size the harness checks:
  - no black bars: none of the sampled canvas edge pixels equals `Q.deep`
  - no page scroll
  - every hit is ≥ 48 CSS px
  - plates are visible and inside the scene
  - lifting an ingredient shows 4 arrows
  - a drag near-miss on the mortar gives a crushed ingredient
  - a fling makes a body that falls and returns home
  - all Phase 1 and Phase 2 checks still pass
- **Frame trace:** about 20 fps when idle. With 15 bodies at full rate, no frame over 33 ms on desktop Chrome 138.
- **Android 8:** run `scripts/check-android8-ui.py --target web` with Chrome for Testing 138. The Lab is painted in each case. Screenshots go to `test-results/android8/`.
- **Screenshots for Papa:** each size, in EN and 中文.

## DONE WHEN

- `python scripts/check-codequest-lab-ui.py` is green at all sizes.
- `scripts/check-android8-ui.py` is green on Chrome 138.
- `check-codequest-ui.py` is still green (the dungeon is unaffected).
- `node scripts/check.mjs` green.

## Implementation notes (2026-10-04)

- **Harness:** `check-codequest-lab-ui.py` runs 1280×800, 1280×600, 1024×600 and 1366×768 (sizes added in slice 01) and gains 7 checks per size (F):
  - the canvas fills the scene, and along each canvas edge fewer than half of 24 samples are near-black (brick mortar lines are dark on purpose, so an exact-colour test was wrong)
  - a plate under each of the 4 tools, inside the scene
  - lifting shows the cauldron's Drop in plate; putting down hides it
  - a Void Dust let go 6 CSS px left of the mortar comes back crushed (near miss)
  - a fling over the window makes exactly one body and nothing in the cauldron
  - it lands, slides and goes home within 5 s with no frame gap over 33 ms (rAF trace)
  - `harness-fling-*.png` is taken on a second fling, outside the trace
- **Chrome for Testing 138.0.7204.183** (installed with `npx @puppeteer/browsers install chrome@138.0.7204.183` into `~/.cache/puppeteer`): Lab harness 138/138 on source and 138/138 on `dist/android-web`. `check-android8-ui.py --target web`: all 4 cases ok (webgl2, webgl1, none, webgl1 offline), Code Quest Lab painted in each (986×572, 20 hits); evidence regenerated in `test-results/android8/`. `check-codequest-ui.py` (dungeon): no failures.
- No app fixes were needed. `sw.js` cache `summer-quest-v164-lab-feel-06`.
