# Slice 01 — Brick Lab as a registry game (D1, D2, D3, D6, D7)

**Depends on:** game-platform registry + `js/games/three-runtime.js`.

**Changes:**
- `js/brick-lab/brick-lab.js`, `brick-catalog.js`, `brick-storage.js`, `css/brick-lab.css` — from the kit, adapted: Three comes in through `three-runtime.js`, no own exit button, full disposal on destroy, `pointerdown` buttons, CSS link injected by the runtime.
- `js/games/bricklab.js` — game object, `init(ctx)` / `stop()`.
- `js/games/index.js` — manifest entry.
- `sw.js` — the five files in `APP_SHELL`, `CACHE_NAME` bumped.
- `scripts/check-brick-lab-ui.py` — browser check; the game exposes a read-only `snapshot()` for it.

Ships together with slice 02: a kid-facing string without 中文 is a bug, so the module never lands English-only.

**DONE WHEN:** `node scripts/check.mjs` green; in a browser the Games tab shows the tile, it opens, a piece can be placed / moved / rotated / deleted / undone, Explore → tap → Build focuses the piece, Back leaves cleanly, reopening restores the build.

**Verified 2026-10-03:** `check.mjs` green; `check-brick-lab-ui.py` 27/27 on source and on `dist/android-web`. The kit's Explore mode collapsed the 3D view to zero height (its absolute top bar left the grid row empty) — fixed in `css/brick-lab.css`.
