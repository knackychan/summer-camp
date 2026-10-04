# Slice 03 — Pick it up, tap a tool

**Status:** Approved by Papa 2026-10-04 (`design.md`).
**Goal:** A kid lifts an ingredient, taps the mortar, burner or frost plate, sees it change, and drops it in.
**Depends on:** 01, 02.
**Files:** `js/games/codequest/lab/lab-screen.js`, `js/games/codequest/lab/lab-view.js`, `js/games/codequest/lab/lab-art.js`, `js/games/codequest/strings.js`, `css/codequest.css`, `scripts/codequest-lab.test.mjs`, `scripts/codequest-lab-view.test.mjs`, `sw.js` cache bump.

## Change

- State in the screen: `selection` keeps its hit id plus a `held` `{ id, state }`; `mix` holds `{ id, state }`.
- Lifted + tap tool (or drag onto tool) → `held.state = STATE_TOOL[step]`, tool animation, owl names the form ("Frozen Mushroom! 冰凍蘑菇！"). Spoon with something lifted: whole-cauldron stir, lift kept. Empty hands: Phase 1 behaviour.
- Brew records seen ids, found rule and forms (slice 02); `hint:'fresh'` → owl line.
- Art (D8): crushed heap, heated glow + wisp, frozen ice cube; the lifted ingredient and cauldron bits drawn in state; strip slot badge; tool use animations. Hits unchanged.
- Strings: state names, form names composed as `[state] [ingredient]` in both languages, the fresh hint.

## DONE WHEN

- Helper tests: process lifted, replace state, spoon keeps the lift, empty-hand step unchanged, fresh hint dispatch.
- Renderer tests: every ingredient × state draws palette-only with unchanged hits.
- Manual at 1280×800: lift Red Mushroom → frost plate → cauldron + Echo Crystal → Brew → Snowflake Copies (not Duplication); Healing with a crushed Sun Herb → reaction + fresh hint.
- `node scripts/check.mjs` green.

## Implementation notes (2026-10-04)

- **Keys, not objects.** The screen's `mix` and `held` use compact keys: the bare id when fresh, `"id:state"` when changed. `labEntries` (resolve.js) now also reads `"id:state"` strings, and `labKey(id, state)` builds them. Phase 1's helpers, tests and `snapshot().lab.mix` keep plain ids for fresh ingredients, so the Phase 1 harness reads the same.
- **Helpers:** `labSelect` sets `held` from the lifted hit; pressing the lifted item again keeps its form (a second, unmoved tap still puts it down, as in Phase 1). `labProcess(state, step)`: lifted + mortar / burner / frost plate → new form in hand and the owl names it ("Frozen Red Mushroom! 冰凍的紅蘑菇！"); the spoon, or empty hands → a cauldron step. `labAdd` takes an id or key. `labBrew` records seen ids, the found rule and the forms (`recordStates`), and says the fresh hint.
- **Input:** tap a tool with something lifted, or drag a jar / bag item onto the mortar, burner or frost plate (it stays in hand over the tool); then tap or drag to the cauldron. The first lift's owl line is now "Tap a tool to change it, or the cauldron to drop it in." (`LAB.pickToChange`; `LAB.picked` stays in strings.js, unused).
- **Art:** crushed = powder heap in the ingredient's colour, heated = orange glow + heat wisp, frozen = ice cube; drawn on the lifted jar / bag item, and as a white / orange / speckled rim on the cauldron bits. Tool use animates for 600 ms (pestle pounds with a powder puff, burner flames lick up, frost puffs rise, spoon wiggles). Strip slots and the drag ghost carry a 🔨 / 🔥 / 🧊 badge; slot labels read the form name. Thermal Shock plays the `hit` sound.
- **Tests:** 5 helper tests (44 total in `codequest-lab.test.mjs`), 2 renderer tests (12 in `codequest-lab-view.test.mjs`: every ingredient × state × tool × reduced draws palette-only with unchanged hits; forms and tool use visibly differ).
- **Manual** (scratch Playwright, Chrome 141, 1280×800 and 1280×600): lift Red Mushroom → frost plate → cauldron + Echo Crystal → Snowflake Copies; fresh → Duplication; drag Moonflower onto the mortar → crushed in hand → cauldron → Glitter Storm; crushed Sun Herb Healing → fresh hint, no potion; empty-hand tools still steps; 中文 form name; no page errors. Screenshots `test-results/codequest-lab/states-*.png`.
- `sw.js` cache `summer-quest-v154-states-03`.
