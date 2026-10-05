# Slice 01 — Tiles category (13 tiles); size cap 8

**Decisions:** D2 (Tiles category, 13 parts), D3, D4, D9, D10. **Depends on:** `2026-10-05-brick-lab-more-parts` slices 01–04 (shipped).

## Changes
- `js/brick-lab/brick-catalog.js`
  - Category `{ id: "tiles", label: ["Tiles", "光面板"], icon: "▭" }`, right after `plates`.
  - `rect()` gains an optional `studs` argument (default `true`; every existing call unchanged).
  - `tile_1x1`, `tile_1x2`, `tile_1x3`, `tile_1x4`, `tile_1x6`, `tile_1x8`, `tile_2x2`, `tile_2x3`, `tile_2x4` via `rect(…, PLATE_HEIGHT, "tiles", false)`.
  - `tile_grille_1x2` (`shape: "grille"`), `tile_round_1x1` and `tile_round_2x2` (`shape: "roundPlate"`, `studs: false`), `tile_quarter_1x1` (`shape: "quarterTile"`).
- `js/brick-lab/brick-lab.js`
  - `makeRoundPlatePiece` honours `part.studs` (no change for `plate_round_2x2`).
  - `makeGrillePiece` — a 1×2 tile with four shallow lengthwise grooves in the top (five thin bars on a base plate, so no CSG).
  - `makeQuarterTilePiece` — a quarter disc of radius 1 stud, plate tall, its square corner at the footprint's corner.
- `scripts/check.mjs` (Brick Lab catalog gate) — `width` and `depth` whole numbers 1–8 (was 1–6; D4).
- `css/brick-lab.css` — CSS fallback icons for `grille` and `quarterTile`; plain and round tiles use the rect / round-plate drawings without studs.
- `sw.js` — bump `CACHE_NAME`.

## Tests
- `scripts/check-brick-lab-ui.py` — `NEW_PARTS` gains the 13 ids (arm and build < 50 ms, real-part icon); a brick dropped on `tile_2x4` stacks on the tile (D3); a `tile_1x8` turned 90° fits on the plate and snaps like `plate_2x6` does; switching through all 10 categories never resizes the view; an old build and a shared world from before this slice load unchanged.
- `scripts/brick-together.test.mjs` — a guest whose catalog lacks the tiles is refused with `proto` (fingerprint, more-parts D6).

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` and the together test pass; 59 parts in 10 categories, Tiles shows 13.

## As built (2026-10-05)
- Shipped as planned: 59 parts in 10 categories; Tiles ▭ 光面板 sits after Plates and shows 13.
- `rect()` takes an optional `studs` (default `true`); a `tile()` helper makes the nine plain tiles (`PLATE_HEIGHT`, category `tiles`, no studs). Round tiles reuse `makeRoundPlatePiece` with `studs: false`.
- `makeGrillePiece`: 0.24 base, five bars (four grooves) along the 2-stud length, no studs. `makeQuarterTilePiece`: a quarter disc of radius one stud, square corner on the back-left of its cell, small bevel.
- `check.mjs` gate: footprint 1–8 whole studs (D4).
- CSS fallback icons: any `tile_*` preview drops the stud dots; round and quarter shapes, a striped grille.
- Search: "2x4" also finds `tile_2x4`.
- Tests: `check-brick-lab-ui.py` `lab_more_parts` now covers the 13 tiles too (fast arm, real icons, counts with Tiles 13); a brick lands on top of `tile_2x4` and `tile_round_2x2` (D3); `tile_1x8` turned 90° sits at whole x / half z; all ten categories switch without resizing the view, are reachable on a short tablet, and fit above the colours at 1024×600 (272 / 272 px — ten tiles are still five rows of two). 163/163. `--sheet`: all 59 parts have icons in red and blue (`.tmp/brick-lab-ui/parts-sheet.png`). Catalog fingerprint test unchanged (any catalog change is refused).
- The `--sheet` cost check now compares frames per second while orbiting (300 new parts 9.0 fps vs 300 plain bricks 5.9) instead of the time of the first step-down, which turned out to be noise in software rendering: below ~4 fps frames arrive more than 250 ms apart and the step-down's counter restarts, so a slower world can even step down later.
- `sw.js` `CACHE_NAME` → `summer-quest-v173-brick-tiles`.
