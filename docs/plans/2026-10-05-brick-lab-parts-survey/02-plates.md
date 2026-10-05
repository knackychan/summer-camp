# Slice 02 — Nine plates

**Decisions:** D2 (9 plates), D4, D5, D10. **Depends on:** 01 (size cap 8).

## Changes
- `js/brick-lab/brick-catalog.js`
  - `plate_1x6`, `plate_1x8`, `plate_2x3`, `plate_2x8`, `plate_4x6` via `rect(…, PLATE_HEIGHT, "plates")`.
  - `plate_round_1x1` (`shape: "roundPlate"`, 1×1, one stud).
  - `plate_rounded_1x2` (`shape: "roundedPlate"`), `plate_corner_2x2` (`shape: "cornerPlate"`), `plate_wedge_2x2` (`shape: "wedgePlate"`).
- `js/brick-lab/brick-lab.js` — new builders through `kit.geo`, joined in `makePieceMesh`:
  - `makeRoundedPlatePiece` — a 1×2 plate with both short ends fully rounded (extruded stadium outline), two studs.
  - `makeCornerPlatePiece` — an L of three 1×1 cells, three studs; the empty cell stays in the footprint (D5).
  - `makeWedgePlatePiece` — a 2×2 plate with one corner cut off at 45° (extruded pentagon), three studs.
- `css/brick-lab.css` — CSS fallback icons for the three new shapes.
- `sw.js` — bump `CACHE_NAME`.

## Tests
- `scripts/check-brick-lab-ui.py` — `NEW_PARTS` gains the 9 ids (arm and build < 50 ms, real-part icon); a 1×1 brick dropped over the corner plate's empty cell lands at the plate's height, not on the baseplate (D5, expected); `plate_2x8` placed at the baseplate's edge stays inside it in both turns.

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes; 68 parts, Plates shows 18.
