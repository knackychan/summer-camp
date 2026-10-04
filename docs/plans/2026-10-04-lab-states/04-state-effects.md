# Slice 04 — Effects for the four new reactions

**Status:** Approved by Papa 2026-10-04 (`design.md`).
**Goal:** Thermal Shock, Snowflake Copies, Flaming Vines and Glitter Storm each get their own small scene.
**Depends on:** 01, 03.
**Files:** `js/games/codequest/lab/lab-fx.js`, `scripts/codequest-lab-view.test.mjs`, `sw.js` cache bump.

## Change

- Thermal Shock: ice shards crack off the cauldron with pops and a steam puff; cat startles. Snowflake Copies: snowflakes split 2 → 4 → 8 across the window and settle on the bench (linger). Flaming Vines: vines climb with flickering flame tips (linger). Glitter Storm: a swirl of sparkles circles the room and drifts down.
- Same lifecycle, sound and reduced-motion rules as Phase 1 slice 05.

## DONE WHEN

- Renderer tests extended to 19 outcomes (potion + 18 rules); lingering set = Phase 1's four + Snowflake Copies + Flaming Vines.
- Screenshot strip of the four new effects in `test-results/codequest-lab/`, reviewed by Papa.
- `node scripts/check.mjs` green.
