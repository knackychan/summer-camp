# Slice 01 — Ingredient data + reaction resolver

**Status:** Approved by Papa 2026-10-04 (`design.md`).
**Goal:** A pure, deterministic resolver that turns any experiment (1–4 ingredients + ordered steps) into a potion or a reaction, with every rule reachable.
**Depends on:** nothing.
**Files:** new `js/games/codequest/lab/ingredients.js`, `js/games/codequest/lab/rules.js`, `js/games/codequest/lab/resolve.js`; new `scripts/codequest-lab.test.mjs`; `sw.js` APP_SHELL + cache bump.

## Change

- `ingredients.js`
  - `LAB_PROPERTIES` = `['life','growth','fire','cold','water','echo','space','time','light','chaos','calm']`.
  - `LAB_INGREDIENTS`: frozen map of the 12 ingredients in `design.md` (8 shelf, 4 bag), each `{ id, where: 'shelf'|'bag', label: [en, zh], props: {…} }`. Bag entries take their label from `ITEM_LABELS` in `strings.js` (no duplicate text).
  - `SHELF_IDS`, `BAG_IDS` (bag = `CODEQUEST_INGREDIENTS` order).
  - `LAB_FREE_INGREDIENTS = true` (D5), with a comment naming D5 and what flipping it does.
- `rules.js`: `LAB_RULES`, ordered, each `{ id, family, label: [en, zh], line: [en, zh], test(sums, mix), over(sums) }`. `test` gets the summed properties and the ingredient multiset; `over` returns how far past its threshold the deciding value is (drives intensity). Order and thresholds exactly as the `design.md` rules table. `line` is the one-sentence Journal rule, coach tone (vision §34).
- `resolve.js`
  - `sumExperiment(ingredients, steps)` → summed props after process modifiers (each heat +1 fire +1 chaos; each cool +1 cold +1 calm; each grind +1 chaos; stir ≥ 2 in total → +1 calm) plus `instability = chaos − calm`.
  - `resolveExperiment({ ingredients, steps, recipes })`:
    1. Filters unknown ids; caps 4 ingredients and 5 steps (`brewLab`'s step cap).
    2. Multiset equals a recipe's **and** steps equal its process → `{ kind:'potion', potionId, recipeId }`.
    3. Otherwise the first matching rule → `{ kind:'reaction', ruleId, family, intensity: 1..3 }`; if the multiset matched a recipe but the steps did not, add `hint:'order'`.
    4. Always returns a result (fallback `fizzle`). Never throws on bad input.
  - `mixHint(ingredients, steps)` → `{ tint: <largest property id or null>, shaky: instability ≥ 3 }` for the live cauldron hint.
- No DOM, no profile access, no randomness.

## DONE WHEN

- `node scripts/codequest-lab.test.mjs` green, covering:
  - each of the 4 recipes with its exact steps → `potion`; the same mix with steps reordered → a reaction with `hint:'order'`;
  - every rule in `LAB_RULES` reached by a fixture: moonflower+echo+void → pocketUniverse; void+mushroom+ember+star → explosion; void+star → temporalRupture; void+ember → singularity; echo+lifeSap+mushroom → monstrosity; echo+mushroom → duplication; lifeSap+mushroom+frostDew → overgrowth; ember+heat → fireball; frostDew+cool → iceBurst; moonflower+star → glow; ember+frostDew → steam; frostDew → bubbles; emberRoot → smoke; lifeSap → fizzle;
  - each single ingredient alone resolves; empty, junk and 9-item inputs return a result;
  - determinism: same input twice → deep-equal output;
  - every rule and ingredient label/line has non-empty EN and 中文.
- `node scripts/check.mjs` green.
