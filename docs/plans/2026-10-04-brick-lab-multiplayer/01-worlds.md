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
