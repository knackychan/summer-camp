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
