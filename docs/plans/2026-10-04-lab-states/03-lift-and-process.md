# Slice 03 — Pick it up, tap a tool

**Status:** Pending Papa's OK of `design.md`.
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
