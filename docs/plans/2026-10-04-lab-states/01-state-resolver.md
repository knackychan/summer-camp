# Slice 01 — State data + resolver

**Status:** Approved by Papa 2026-10-04 (`design.md`).
**Goal:** The pure resolver understands crushed, heated and frozen ingredients, and every new rule can be reached.
**Depends on:** Phase 1 (shipped).
**Files:** `js/games/codequest/lab/ingredients.js`, `js/games/codequest/lab/rules.js`, `js/games/codequest/lab/resolve.js`, `scripts/codequest-lab.test.mjs`.

## Change

- `ingredients.js`: `LAB_STATES = ['raw','crushed','heated','frozen']`; `STATE_TOOL = { grind:'crushed', heat:'heated', cool:'frozen' }`; `applyState(props, state)` returns new points per design D3 (pure, never negative).
- `rules.js`: the four D4 rules in their D4 positions, with labels and one-sentence lines in EN + 中文; `test(sums, mix, states)` where `states` counts `{ crushed, heated, frozen }`.
- `resolve.js`: entries are `{ id, state }` or a bare id (= raw); unknown states become raw; per-ingredient `applyState` before summing, then whole-cauldron steps as today; recipe multiset match counts fresh entries only; a recipe's ids with any changed entry plus its exact steps → reaction with `hint:'fresh'`; `mixHint` reflects states.

## DONE WHEN

- Phase 1's tests unchanged and green.
- New tests: each state's points per D3; Frozen Mushroom + Echo Crystal → snowflakeCopies while Mushroom + Echo Crystal stays duplication; Heated Mushroom → flamingVines; Crushed Moonflower → glitterStorm; Frozen Frost Dew + Heated Ember Seed → thermalShock; every one of the 18 rules still reached by a fixture; a recipe with a changed ingredient → reaction + `hint:'fresh'`; determinism; all new strings EN + 中文.
- `node scripts/check.mjs` green.

## Implementation notes (2026-10-04)

- Shipped as designed; the D3 starting numbers reach every rule, so no tuning. `labEntries(list)` (exported from `resolve.js`) normalises a mix to `{ id, state }`.
- The four new rules reuse existing families (Thermal Shock → elemental, Snowflake Copies → replication, Flaming Vines → biological, Glitter Storm → light), so the Phase 1 Journal and sounds handle them with no new family icons.
- Hint order: when a recipe's ingredients are in the cauldron with a changed one, `hint:'fresh'` wins over `'order'` (the changed ingredient is the first thing to fix).
- Kept main safe between slices: `journal.js` gets plain-property formulas for the four new rules (slice 05 replaces them with state icons), and `lab-fx.js`'s `FX_IDS` now lists only outcomes that have a drawer, so a new rule shows the room unchanged until slice 04 draws it.
- Tests: Phase 1's in-order fixture table grows to 18; 6 new tests (36 total), including an exhaustive single/pair sweep over every ingredient × state that, with Phase 1's fixtures, reaches all 18 rules.
- `sw.js` cache `summer-quest-v152-states-01`.
