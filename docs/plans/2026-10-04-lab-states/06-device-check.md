# Slice 06 — Harness + Android 8 check

**Status:** Approved by Papa 2026-10-04 (`design.md`).
**Goal:** The state flow works by touch on the target tablets, offline.
**Depends on:** 03, 04, 05.
**Files:** `scripts/check-codequest-lab-ui.py`, `test-results/codequest-lab/`, fixes wherever the harness finds them.

## Change

- Extend the Lab harness: lift → tool → cauldron by taps and by drag onto a tool; Snowflake Copies vs Duplication; fresh hint; forms in the Journal; all existing Phase 1 checks still pass at 1280×800 and 1280×600.
- `scripts/check-android8-ui.py` with Chrome 138: unchanged scope (the Lab is 2D), re-run for evidence.

## DONE WHEN

- `python scripts/check-codequest-lab-ui.py` green at both sizes; `scripts/check-android8-ui.py` green on Chrome 138.
- `node scripts/check.mjs` green.

## Implementation notes (2026-10-04)

- `scripts/check-codequest-lab-ui.py` gains 7 state checks per size (S): lift + frost plate → frozen in hand with no cauldron step; Frozen Mushroom + Echo Crystal → Snowflake Copies, the fresh pair → Duplication; drag onto the mortar → crushed in hand, dragged into the cauldron → Glitter Storm; crushed Sun Herb Healing → fresh hint and no potion; the Journal shows exactly the brewed forms; bubble audit over the state brews. Check 6 now expects 18 Journal pages.
- **Chrome for Testing 138.0.7204.183:** 56/56 on source and on `dist/android-web`. `check-android8-ui.py --target web`: all 4 cases ok, Lab painted in each (evidence regenerated in `test-results/android8/`). `check-codequest-ui.py`: 48/48 (dungeon unaffected).
- No app fixes were needed.
