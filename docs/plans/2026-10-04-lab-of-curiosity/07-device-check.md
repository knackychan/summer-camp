# Slice 07 — Browser harness + Android 8 check

**Status:** Approved by Papa 2026-10-04 (`design.md`; project CLAUDE.md Android 8 rule).
**Goal:** The Lab works by touch on the target tablets, offline, and stays readable.
**Depends on:** 04, 05, 06.
**Files:** new `scripts/check-codequest-lab-ui.py` (reuses the recovery harness the way `check-codequest-ui.py` does), `test-results/codequest-lab/`, fixes wherever the harness finds them.

## Change

Harness with coarse-pointer touch emulation, at 1280×800 and 1280×600:

1. Code Quest → Lab button → Lab mounted, dungeon paused.
2. Drag Echo Crystal + Red Mushroom onto the cauldron → Brew → `snapshot().lab.lastResult.ruleId === 'duplication'`; Journal tag visible.
3. Tap-tap Sun Herb, Sun Herb, Water Crystal; tap mortar, spoon → Brew → Healing +1, bag counts unchanged (D5).
4. Same mix, steps reversed → reaction with order hint, no potion.
5. Four ingredients in, try a fifth → owl line, mix still 4.
6. Journal opens, shows the found pages, closes.
7. ‹ Dungeon → same level, program unchanged; Camp has the Lab button and no bench.
8. Every hit rect ≥ 48 CSS px; no page scroll; the owl bubble never covers the strip or the cauldron.
9. Network blocked after load: checks 2–3 still pass.

Android 8: `scripts/check-android8-ui.py` with Chrome 138 extended to open the Lab (2D canvas only — no WebGL path); screenshot saved.

## DONE WHEN

- `python scripts/check-codequest-lab-ui.py` passes all 9 checks at both sizes.
- `scripts/check-android8-ui.py` on Chrome 138 green, with a Lab screenshot in `test-results/android8/`.
- `node scripts/check.mjs` green.
