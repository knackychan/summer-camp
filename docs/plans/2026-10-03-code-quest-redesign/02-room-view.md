# Slice 02 — `room-view.js`: high 3/4 top-down renderer (D1, D2, D9)

**Goal:** The dungeon looks like the reference: square stone floor, walls with front faces, upright sprites, torchlight. Whole room on screen, crisp pixels.
**Depends on:** 01.
**Files:** new `js/games/codequest/room-view.js`; `js/games/codequest.js` switches its import; `sw.js` APP_SHELL + cache-name bump; `scripts/codequest-renderer.test.mjs`.
`dungeon-view.js` stays in the repo, unimported (D9).

## Change

- `drawRoom(canvas, snapshot, options)` — same options as `drawDungeonWorld` plus `preview`, `cssWidth`, `cssHeight`, `dpr`; returns `{ anchors, scale, origin }`.
- Projection: `T = 16`, wall front face `F = 8`. Floor tile at `(x*T, y*T)`; wall = top square + front face; back row shows its full face, front row is a low rim so nothing is hidden.
- Fit: buffer = room tiles × T + masonry margin; `scale = max(1, floor(min(cssW/bufW, cssH/bufH) * dpr)) / dpr`; room centred; masonry backdrop fills the rest (never flat black).
- Order: backdrop → floor (2 stone variants, cracks seeded by `x,y`) → markings (exit, traps, plates, platforms, path preview) → depth-sorted verticals (`y`, then `x`, then kind bias) → FX → light.
- Light: torch pools as stepped palette bands with 4×4 Bayer-dither edges, edge vignette, 2-frame flicker; hit shake 2 logical px. `prefers-reduced-motion` ⇒ no flicker, no shake.
- Hero picks facing frames from `hero.dir`; walk interpolation as today.
- Every entity kind today's renderer draws is drawn here (doors, gates, levers, plates, crates, push blocks, NPCs, tokens, rune cores, platforms, cycle traps, companion, status badges, HP pips).

## DONE WHEN

- Renderer test paints q01, q20 and an expedition encounter on the fake canvas without throwing; asserts `scale * dpr` is a whole number for dpr 1, 1.5, 2, 2.625, and that a 9×7 room on a 1240×500 CSS stage gets tiles ≥ 48 CSS px.
- Browser screenshot at 1280×800 shows the full room with square tiles (Papa reviews).
- `node scripts/check.mjs` green.
