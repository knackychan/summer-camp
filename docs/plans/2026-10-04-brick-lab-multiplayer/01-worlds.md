# Slice 01 — Several worlds per kid + Brick Lab menu

**Decisions:** D3, D7 (menu part), D8. **Depends on:** nothing. Solo only; works in the browser too.

## Changes
- `js/brick-lab/brick-worlds.js` (new) — per kid: index `sq:brick-lab:worlds:v1:<kid>` = `[{id, name, updatedAt, count, thumb}]`, one payload per world `sq:brick-lab:world:v1:<kid>:<id>` (same `summer-quest-brick-build` v1 payload as today). `list() / create(name) / open(id) / save(id, state, thumb) / rename(id, name) / remove(id)`. Every `localStorage` call in try/catch, like `brick-storage.js`.
- Migration: when the index is missing and `sq:brick-lab:v1:<kid>` holds a build, it becomes world 1 "My Brick World · 我的積木世界". The old key is left in place, untouched.
- `brick-storage.js` keeps prefs (favourites / recents) per kid, not per world.
- `js/brick-lab/brick-lab.js` — opens on the menu. Cards: picture, name, brick count. "+ New world 新世界" (default name "World N · 世界 N"). Rename (text field) and delete (in-app confirm, never `window.confirm`) from the card's ⋯ — not while a world is open. Back from a world returns to the menu; host Back from the menu leaves Brick Lab.
- World picture: on leaving a world, render one frame and store a ~160 px JPEG data URL in the index.
- A "Join 加入" area is drawn but empty for now (filled by slice 05).
- `css/brick-lab.css` — menu, tablet targets ≥ 48 px, pre-reader layout = pictures only.
- Bilingual: every new string EN + 中文.

## Tests
- `scripts/brick-worlds.test.mjs` — migration (old build → world 1, old key kept), create / rename / delete, index survives a bad JSON entry, per-kid isolation.
- `scripts/check-brick-lab-ui.py` — menu shows, new world opens empty, Back returns to the menu with the new card, migration from a seeded old build.

**DONE WHEN:** `node scripts/check.mjs` green; both tests pass; an existing build on a real tablet shows up as world 1 after updating.

## As built (2026-10-04)
- Worlds are listed most recently played first (a `played` counter in the index, so two saves in the same millisecond keep their order).
- The menu is an overlay over the plate, under the top bar; while it shows, the plate is empty and the mode toggle / undo / save are hidden. Pre-readers see pictures and brick counts only, and their card actions have no Rename (they delete with icons, after the same "are you sure" step).
- Host Back: closes an open card action first, then leaves the world for the menu (saving it with a 200 px JPEG of the current view), then leaves Brick Lab. `js/games/bricklab.js` gained `back()`.
- A world's picture is taken when the world is left (Back or closing Brick Lab); until then its card shows a brick.
- `brick-storage.js` now exports the build shape (`readBuild`, `buildPayload`) for `brick-worlds.js` and keeps the tray prefs; builds no longer go through `BrickLabStorage.save`.

**Verified 2026-10-04:** `check.mjs` green (includes `scripts/brick-worlds.test.mjs`, 8 tests); `check-brick-lab-ui.py` 104/104 (Edge headless, SwiftShader) — menu on open, new world empty and listed first, rename, delete with a confirm step, Back closes card actions / leaves the world with its picture / leaves Brick Lab, an old single save (Lucien) becomes world 1 and is re-settled, the old key left in place; every older check still passes after opening a world. `check-android8-ui.py` passes with Playwright Chromium 1228 (not Chrome 138). Screenshots: `.tmp/brick-lab-ui/menu.png`, `menu-pre-reader.png`. Not yet done: updating a real tablet and seeing its build as world 1.
