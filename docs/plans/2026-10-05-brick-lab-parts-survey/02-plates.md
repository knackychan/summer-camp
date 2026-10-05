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

## As built (2026-10-05)
- Shipped as planned: 68 parts, Plates 18.
- New `footprintSlab(outline, height)` in `brick-lab.js`: a bevelled plate-thick extrusion of a footprint outline (world x, z points, or a `THREE.Shape`); the rounded (stadium outline), corner (L of three cells, inner corner just off the empty cell) and cut-corner (pentagon, cut from the right edge's middle to the front edge's middle) plates use it. `plate_round_1x1` reuses the round-plate builder.
- Tests: the 9 plates arm fast with real icons; Plates 18; a brick lands on top of the rounded, corner and cut-corner plates (on the corner plate it rests at plate height wherever it lands — the empty cell counts as taken, D5); a 2×8 plate placed past the village's west end and turned stays on the baseplate (the snap clamps every footprint to the plate). 170/170; `--sheet` 68/68 icons in red and blue.
- The plan's edge test ("placed at the baseplate's edge") became "placed and turned stays on the baseplate": a tap that reliably lands at the very edge of the plate isn't available from the home view. The clamp in `snapAxis` is what keeps any footprint on the plate.
- Harness fix found here: `--sheet` ended the run with `raise StopIteration`, and a `next()` with no match inside a check raises the same exception, so a missing piece silently ended the main suite as "passed" (122/122). `--sheet` now raises its own `SheetDone`, and `selected()` asserts a piece is selected. Earlier slice runs reached their last check (158 / 163 checks), so they were complete.
- `sw.js` `CACHE_NAME` → `summer-quest-v174-brick-plates`.
