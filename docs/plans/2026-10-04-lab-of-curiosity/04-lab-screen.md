# Slice 04 — Lab screen: view swap, input, brew flow, Camp trim

**Status:** Approved by Papa 2026-10-04 (`design.md` D1, D2, D5, D7, D8, D10, D12).
**Goal:** A kid opens the Lab from Code Quest, puts things in the cauldron by drag or tap, adds steps, Brews, and gets a potion or a reaction. The Camp dialog no longer holds the bench.
**Depends on:** 01, 02, 03.
**Files:** new `js/games/codequest/lab/lab-screen.js`, `js/games/codequest.js` (Lab button, view swap, Camp trim, snapshot), `js/games/codequest/strings.js` (`LAB` block), `css/codequest.css` (`.cq-lab-*`), `sw.js` APP_SHELL + cache bump.

## Change

- **Entry.** `setbarHTML()` gains a `lab` button ("Lab 實驗室", flask glyph) between Map and Camp. `actionId === 'lab'` → `openLab()`: pause the dungeon scheduler, hide stage + dock, mount `lab-screen` in the Code Quest root. The Lab's back button (‹ Dungeon 地下城) unmounts it and resumes. Host Back while the Lab is open also returns to the dungeon first — one press never leaves Code Quest from the Lab.
- **`lab-screen.js`** — `mountLab(root, api)`, `api = { profile(), save(profile), sfx, language, kidColor, canScript, onExit }`; returns `{ destroy(), snapshot() }`.
  - State: `mix` (≤ 4 ids, drop order), `steps` (≤ 5), `selection`, `effect`, `bubble`, `lastResult`.
  - Input (pointer events; `pointerdown` for buttons):
    - drag a jar/bag hit onto the cauldron → add;
    - tap a jar/bag → select (it lifts, the cauldron pulses), then tap the cauldron → add;
    - tap mortar / burner / spoon / frost plate → append that step;
    - tap a strip slot → take it out; ↶ undo last step; ✕ clear mix, steps and effect.
    - A 5th ingredient or 6th step: owl says "The cauldron is full — try Brew! 鍋子滿了——試試釀造！" (no error colour).
  - Live hint: liquid tint + shake from `mixHint` (slice 01).
  - Brew (needs ≥ 1 ingredient):
    1. `resolveExperiment` (slice 01).
    2. `potion` → `brewLab(profile, mix, steps, { free: LAB_FREE_INGREDIENTS })`; on ok: save, then bump the live dungeon consumable exactly as the Camp brew does today (move that code, don't copy it); owl names the potion. With D5 off and too little stock → play it as a reaction (practice brew) and the owl says so kindly.
    3. `reaction` → `recordSeen(mix)` + `recordFound(ruleId)`; save only if the profile changed; owl says the rule's short line; a new rule puts "New page! 新的一頁！" on the book.
    4. Mix and steps stay after Brew, so the kid can change one thing and brew again; ✕ clears.
  - Owl speech placed with `placeBubbleRect` (`bubble.js`), the owl as anchor, cauldron + strip as hard rects.
  - Bag counts hidden while `LAB_FREE_INGREDIENTS` is true; shown as today otherwise.
  - Scroll prop (only when `canScript`, i.e. q26 cleared) opens the existing potion-script editor in a sheet; its Brew passes `{ free: LAB_FREE_INGREDIENTS }`.
- **Camp trim.** `campHTML()` keeps relic choices, bag, potion stock, equipment; drops the bench, process, recipe list and potion-code sections; adds a "Brew in the Lab → 到實驗室釀造 →" button that opens the Lab. The `bench:*`, `lab:*`, `labcode:*` handlers move to `lab-screen.js` (code paths, not files — D14).
- **Strings.** All Lab text in `strings.js` `LAB`, EN + 繁體中文, one language shown at a time via `language()`.
- **Snapshot.** `snapshot().lab` = `{ open, mix, steps, effect, lastResult }` for harnesses.

## DONE WHEN

- `node scripts/codequest.test.mjs` and `node scripts/codequest-lab.test.mjs` green (lab-screen state helpers — add / remove / caps / brew dispatch — tested with a stub `api`).
- Manual run at 1280×800:
  - open Lab; drag Echo Crystal + Red Mushroom → Brew → duplication, Journal tag shows;
  - tap-tap Sun Herb ×2 + Water Crystal, mortar, spoon → Brew → Healing +1, bag counts unchanged;
  - same mix with spoon, mortar → reaction + order hint, no potion;
  - ‹ Dungeon → same room, program intact; Camp shows the Lab button and no bench.
- `node scripts/check.mjs` green (bilingual gate sees every new kid-facing string).

## Implementation notes (2026-10-04)

- **Pure helpers + thin controller.** `lab-screen.js` exports `createLabState`, `labSelect`, `labAdd`, `labRemove`, `labStep`, `labUndo`, `labClear` and `labBrew(state, profile, { free, now })` → `{ state, profile, changed, potionId }`; `mountLab(root, api)` is the DOM/pointer layer around them. 8 new tests in `scripts/codequest-lab.test.mjs` (25 total) cover add / remove / caps, select, brew dispatch (empty, duplication + Journal save once, Healing free with the bag untouched, wrong order → reaction + `order` hint, D5 off → practice brew and the paid path) and the `LAB` strings.
- **`api`** gained `onPotion(id)`: Code Quest's `bumpConsumable` — the Camp bench's "potion also lands on the hero's belt" line, moved (not copied) and shared by the Lab Brew and the potion script. `reduced` carries `prefers-reduced-motion`.
- **Host Back.** Nothing let a registry game take Back before, so `summerQuestBack` (index.html) now asks the running game's optional `back()` first; `true` means handled. Code Quest's `back()` closes the script sheet, then the Lab, and returns `false` otherwise — the dungeon still leaves on Back as before. Documented in `js/games/CLAUDE.md`. Escape does the same.
- **Host bar in the Lab** is `‹ Dungeon` + the language switch only. Pause is a no-op while the Lab is open (blur / hidden tab included): the Lab has no clock and the dungeon behind it is already paused.
- **Camp trim.** Kept: relic choice, bag counts (now display chips, no longer draggable), potion stock, loadout. Moved to the Lab: bench, process, recipe list (the script sheet's "Load a recipe you know" chips; the Journal page list is slice 06), potion script. `UI.inventory` / `UI.campTitle` now read "Camp 營地" / "Dungeon Camp 地下城營地". `UI.dragHint`, `potionBench`, `clearBench`, `process`, `recipes` and the bench `MESSAGES` stay in `strings.js`, unused.
- **Book tap** (until slice 06's sheet): the owl says how many reactions the Journal holds and the "New page!" tag clears. **Owl tap** repeats the last line. **Scroll tap** before q26: the owl says the scroll unlocks with more quests.
- **Lab state is per visit**: ‹ Dungeon and reopening starts an empty experiment (profile and Journal persist).
- **Keyboard path.** Dock buttons act on `pointerdown`; a `click` acts only when it carries no `pointerType` (keyboard / assistive tech). Playwright's touch tap emits `click` with `detail` 0, which double-fired Brew under the existing `detail === 0` rule.
- **Manual run** (scratch Playwright script, 1280×800 and 1280×600, coarse pointer, offline): all four DONE WHEN steps, 4-ingredient cap, locked scroll, host Back → dungeon (same room, program intact), Camp → Lab, 中文, script sheet after q26 (free Healing, recipe chip, Back closes sheet first), no page errors. Screenshots: `test-results/codequest-lab/lab-*.png`, `camp-*.png`. The permanent harness is slice 07.
- `sw.js`: `lab-art.js`, `lab-view.js`, `lab-screen.js` added; cache `summer-quest-v149-lab-04`.
