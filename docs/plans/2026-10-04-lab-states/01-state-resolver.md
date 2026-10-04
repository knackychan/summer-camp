# Slice 01 — State data + resolver

**Status:** Pending Papa's OK of `design.md`.
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
