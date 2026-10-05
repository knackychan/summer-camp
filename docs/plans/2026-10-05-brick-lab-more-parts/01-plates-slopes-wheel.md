# Slice 01 — Plates, small slopes, ridge cap, large wheel; anything stacks; catalog fingerprint

**Decisions:** D2 (8 parts), D3, D5, D6. **Depends on:** brick-lab slices 09–15 and brick-lab-multiplayer 01–08 (all shipped).

## Today
- `js/brick-lab/brick-catalog.js` has 26 parts. `landing()` (`js/brick-lab/brick-lab.js`, ~line 2135) skips `wheel` / `tree` / `flower` by shape name when finding what a piece rests on.
- `makeSlopePiece` always adds a back row of studs, whatever `part.studs` says.
- `hello` carries `proto` only (`brick-together.js` `hostHello`); a guest on an older app draws an unknown part id as `PARTS[0]` (`getPart` fallback).

## Changes
- `js/brick-lab/brick-catalog.js`
  - New parts (D2 table): `plate_1x1`, `plate_1x3`, `plate_4x4` via `rect(…, PLATE_HEIGHT, "plates")`; `plate_round_2x2` (`shape: "roundPlate"`); `slope_1x1` (0.8 tall, `studs: false`), `slope_1x2` (one back stud); `peak_1x2` (`shape: "peak"`, 1×2); `wheel_large` (`shape: "wheel"`, 1×2, `wheelScale` ≈ 1.7).
  - `export const CATALOG_ID` — a short stable hash (e.g. FNV-1a, hex) of every part id then every colour id, in catalog order.
- `js/brick-lab/brick-lab.js`
  - `landing()`: delete the `wheel` / `tree` / `flower` skip, so every part counts when finding what a piece rests on (D3, amended 2026-10-05). Trees and flowers keep their ground-only early return.
  - `makeSlopePiece`: add the back stud row only when `part.studs`.
  - `makeRoundPlatePiece`: a bevelled cylinder 2 studs across, plate tall, 4 studs; joins `makePieceMesh`.
  - Peak and wheel builders: check that a 1-wide peak and a 1×2 large wheel sit inside their footprint; adjust only through part data (`wheelScale`, sizes) if possible.
- `js/brick-lab/brick-share.js` — `PROTO = 3`; `hello` gains `cat: CATALOG_ID`.
- `js/brick-lab/brick-together.js` — `hostHello` refuses with `why: "proto"` when `message.cat !== CATALOG_ID` (same path, same wording as a protocol mismatch).
- `scripts/check.mjs` (Brick Lab catalog gate) — every part: `width` and `depth` whole numbers 1–6; `height` > 0 and ≤ 8; every id in `FIXED_COLOR_SHAPES` is a shape some part uses.
- `css/brick-lab.css` — CSS fallback icons for `roundPlate` (circle with studs); the rest fall back to the existing rect / slope / peak / wheel drawings.
- `sw.js` — bump `CACHE_NAME`.

## Tests
- `scripts/brick-share.test.mjs` / `brick-together.test.mjs` — a guest with another `cat` is refused with `proto`; the same `cat` joins.
- `scripts/check-brick-lab-ui.py` — `NEW_PARTS` gains the 8 ids: each arms and builds in < 50 ms and has a real-part icon; a brick dropped on a wheel lands on top of the wheel, and one dropped on a tree lands on top of the tree (D3, amended); a brick dropped on `plate_round_2x2` stacks on it; old build from before this slice loads with the same piece count and positions.

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes; the share/together tests pass; 34 parts in the rail, Plates shows 9, Slopes 7, Wheels 3.
