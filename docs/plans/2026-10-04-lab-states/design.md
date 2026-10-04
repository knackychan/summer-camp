# Code Quest Lab — Phase 2: ingredient states

**Status:** Approved by Papa, 2026-10-04. In chat, after Phase 1 merged as knackychan/summer-camp#2, he chose **D1** "Pick it up, tap a tool" and **D4** "New powers + new reactions" (both the recommended options), then answered "ok" to the full summary of D1–D10.
**Game id:** `codequest` (inside the Lab view of `docs/plans/2026-10-04-lab-of-curiosity/`).
**Source:** `docs/plans/2026-10-04-lab-of-curiosity/vision.md` §8 (Stateful Ingredients), §30 (Second Prototype Step: crushed, heated, frozen; "Raw Mushroom + Crystal and Frozen Mushroom + Crystal produce meaningfully different outcomes"), roadmap Phase 2 in that folder's `design.md`.
**Builds on:** every Phase 1 decision stays in force (D3 code-drawn art, D5 free ingredients, D6 no stars, D8 coach not cop, D9 engine untouched, D12 one language at a time, D13 offline and calm).

## Why

In Phase 1 a tool step changes the whole cauldron. The kid can't yet tell that *what you do to one thing* matters: a frozen mushroom isn't the same as a fresh one. This is the vision's coding idea for Phase 2: **state**. The same object behaves differently depending on what has happened to it.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Pick it up, tap a tool** (Papa). With an ingredient lifted (tap a jar or bag item), tapping the mortar, burner or frost plate changes *that* ingredient. It stays lifted in its new state, and a tap on the cauldron drops it in. Dragging an ingredient onto a tool does the same and leaves it lifted over the tool. With empty hands a tool tap is still a whole-cauldron step, exactly as in Phase 1. The spoon has no state: with something lifted it still stirs the cauldron and the lift stays. | One gesture more than Phase 1, no new screen. The four potions and all Phase 1 habits keep working. |
| D2 | **Three states + fresh:** mortar → **crushed 碾碎**, burner → **heated 加熱過**, frost plate → **frozen 冰凍**. One state per ingredient; a new tool replaces the old state (frozen then heated is just heated). The owl names the change ("Frozen Mushroom!"). | The vision's §30 set, and one tool per state the kid already knows. Stacking states would make labels and the Journal unreadable for a 6-year-old. |
| D3 | **States change the ingredient's own points before the mix is summed** (systemic, no per-ingredient tables). Starting values: **crushed** +1 on its strongest property and +1 chaos ("stronger but wilder"); **heated** +2 fire, cold → 0, water −1 (not below 0), +1 chaos; **frozen** +2 cold, +1 calm, fire → 0, life and growth → 0 ("asleep"). Whole-cauldron steps still apply on top, as in Phase 1. | Same rules-over-summed-properties model as Phase 1 D4. Every ingredient gets three new forms from three lines of data. Numbers may be tuned in slice 01, but only together with its reachability test. |
| D4 | **New powers + new reactions** (Papa). Four state-only rules join `LAB_RULES` (14 → 18), each needing a changed ingredient in the mix. **Thermal Shock 冷熱大爆裂**: a frozen and a heated ingredient together → ice cracks and pops. **Snowflake Copies 雪花複製**: echo ≥ 2, cold ≥ 2 and a frozen ingredient → snowflakes that copy themselves (Frozen Mushroom + Echo Crystal). **Flaming Vines 火焰藤蔓**: fire ≥ 2, growth ≥ 2 and a heated ingredient → burning vines (Heated Mushroom). **Glitter Storm 閃粉風暴**: light ≥ 2 and a crushed ingredient → sparkling dust (Crushed Moonflower / Star Dust). Ordered after Explosion (Thermal Shock), before Monstrosity (Snowflake), before Fireball (Flaming Vines), before Glow (Glitter Storm). | Meets the vision's test: Frozen Mushroom + Echo Crystal ≠ Mushroom + Echo Crystal. New Journal pages make the states worth discovering. |
| D5 | **Potions need fresh ingredients.** A recipe matches only fresh (unchanged) ingredients. The right ingredients with one changed, plus the right steps, gives a reaction and the owl's hint "That recipe likes its ingredients fresh! 這個配方要用新鮮的材料！" (`hint:'fresh'`). `brewLab` and the potion script are unchanged. | The dungeon economy and `brewLab` stay untouched (Phase 1 D9). It also teaches that state matters. |
| D6 | **Experiment shape:** `mix` becomes a list of `{ id, state }` (`state` ∈ `raw`, `crushed`, `heated`, `frozen`). The resolver also accepts a bare id string as `raw`, so every Phase 1 test and caller still works. Caps unchanged (4 ingredients, 5 steps). | Additive; no Phase 1 behaviour changes. |
| D7 | **Journal learns states.** The profile's `lab` gains an additive `states: ['redMushroom:frozen', …]` list (made-and-brewed forms, known ids and states only, ≤ 128), still inside profile v12 (Phase 1 D11's reasoning: no version bump). The Ingredients page shows each ingredient's discovered forms with their points. The Reactions page grows to 18. Known risk: a tablet still on a Phase 1 build drops `states` and the four new rule ids when it re-saves that kid's profile. That loses Journal pages only, never Code Quest progress. | One save path, no new storage key; the loss window closes once the tablet updates. |
| D8 | **Visible state, icon-first.** A changed ingredient is drawn in its state wherever it appears (lifted, strip slot, cauldron bits, effects). **Crushed**: a small powder heap in its colour. **Heated**: a glowing orange outline and a heat wisp. **Frozen**: inside a pale ice cube. The tool animates when used (pestle bobs, burner flares, frost puffs). Strip slots get a small state badge. | Readable without words (Phase 1 D12). |
| D9 | **Effects for the four new rules** follow Phase 1 slice 05's lifecycle and rules: ≤ 3 s main beat, owl and cat react, reduced motion calmer. Flaming Vines and Snowflake Copies linger until ✕ or the next Brew, like their Phase 1 cousins (vines, copies). | Same reward language as Phase 1. |
| D10 | **Unchanged:** no stars; processing is free (D5 of Phase 1 still governs the bag); the potion script has no states (states in code are the Rune Board's job, Phase 7); `model.js`, `interpreter.js`, `parser.js`, `levels.js`, `run.js`, `loot.js`, `progression.js` and `alchemy-code.js` do not change. | Scope: Phase 2 is the Lab only. |

## Units

| File | Change |
|---|---|
| `lab/ingredients.js` | `LAB_STATES`, `STATE_TOOL` (grind → crushed, heat → heated, cool → frozen), `applyState(props, state)` |
| `lab/rules.js` | 4 new rules; `test(sums, mix, states)` gets a third argument (state counts), older rules ignore it |
| `lab/resolve.js` | `{ id, state }` entries; per-ingredient state applied before summing; recipe match fresh-only + `hint:'fresh'`; `mixHint` follows states |
| `lab/journal.js` | `states` in `normalizeLab`, `recordStates`, Ingredients pages with forms, 4 new formulas |
| `lab/lab-art.js`, `lab/lab-view.js` | state overlays, tool use animations, strip badges data |
| `lab/lab-fx.js` | 4 new effects |
| `lab/lab-screen.js` | lift + tool → change state; owl lines; Journal forms |
| `strings.js` | state names, owl lines, 4 rule labels/lines (in `rules.js`), Journal form labels |

## Slices

- `01-state-resolver.md` — D2, D3, D4, D5, D6: pure data + resolver + reachability tests
- `02-journal-states.md` — D7: save field and page builders
- `03-lift-and-process.md` — D1, D8: interaction, owl lines, state art, tool animations
- `04-state-effects.md` — D9: four new effects
- `05-journal-forms.md` — D7 UI: Ingredients forms, 18 reaction pages
- `06-device-check.md` — harness + Android 8 / Chrome 138

## Not in this plan

Stacked states, the cutting board, the scale and quantities (Phase 5), scene ingredients (Phase 3), lasting world changes (Phase 4), states in the potion script, new ingredients.
