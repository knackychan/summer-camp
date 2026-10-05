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
