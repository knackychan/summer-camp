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

## Implementation notes (2026-10-04)

- `lab-fx.js`: **Thermal Shock** (cracks race round the rim, ice shards fly out and pop, a hiss of steam; cat startles; `hit` sound), **Snowflake Copies** (one flake rises, splits 2 / 4 / 8 by intensity in front of the window, drifts down to the bench and twinkles there — lingers), **Flaming Vines** (Overgrowth's vines in wood and ember colours with flickering flame crowns — lingers), **Glitter Storm** (sparkles swirl round the room, then drift down and wink out).
- `FX_IDS` covers all 19 outcomes again; `FX_LINGER` adds Snowflake Copies and Flaming Vines. Reduced motion follows Phase 1 slice 05: half the particles, slower swirl, lingering parts still.
- Renderer tests now run all 19 outcomes × intensity × reduced at start / mid / end / lingering (12 tests, unchanged count).
- Screenshot for Papa: `test-results/codequest-lab/fx-strip-states-mid.png` (the four mid-beat, plus the two lingering ones after the beat).
- `sw.js` cache `summer-quest-v155-states-04`.
