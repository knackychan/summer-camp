# Slice 03 — Round bricks, cone, pillar, brick 1×6; low, eave and curved slopes

**Decisions:** D2 (5 bricks, 4 slopes), D10. **Depends on:** 01 (round-plate `studs` flag). Independent of 02.

## Changes
- `js/brick-lab/brick-catalog.js`
  - Bricks: `brick_1x6` and `pillar_1x1x3` (`rect`, heights 1.2 and 3.6); `brick_round_1x1` and `brick_round_2x2` (`shape: "roundPlate"` at `BRICK_HEIGHT`; the 2×2 has 4 studs); `cone_1x1` (`shape: "cone"`).
  - Slopes: `slope_30_1x2` (`shape: "slope"`, 1×2, 0.8 tall, one back stud); `slope_inv_1x2` (`shape: "slopeInv"`, 1×2); `slope_curved_2x2` and `slope_curved_1x2` (`shape: "slopeCurved"`, 0.8 tall, no studs).
- `js/brick-lab/brick-lab.js`
  - `makeRoundPlatePiece` takes its height from the part (round bricks are brick-tall); the 2×2 round brick's studs sit on the 2×2 grid.
  - `makeConePiece` — a lathe: round base 1 stud across, tapering to a small flat top with one short stud.
  - `makeSlopeCurvedPiece` — a flat back strip, then a quarter-curve down to the front edge (profile extruded across the width), no studs.
  - Check `makeSlopeInvPiece` (more-parts 02) at 1×2; adjust only through part data if possible.
- `css/brick-lab.css` — CSS fallback icons for `cone` and `slopeCurved`.
- `sw.js` — bump `CACHE_NAME`.

## Tests
- `scripts/check-brick-lab-ui.py` — `NEW_PARTS` gains the 9 ids (arm and build < 50 ms, real-part icon); a brick dropped on `cone_1x1` and on `slope_curved_2x2` stacks on each (D3); `pillar_1x1x3` on a 2×4 brick stands 3 bricks tall.
- Screenshot for Papa: a small car or tower using round bricks, cones, curved slopes and tiles (`.tmp/brick-lab-ui/survey-curves.png`).

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes; 77 parts (Bricks 14, Slopes 11); Papa has seen the screenshot.

## As built (2026-10-05)
- Shipped as planned: 77 parts, Bricks 14, Slopes 11.
- Round bricks reuse `makeRoundPlatePiece` at `BRICK_HEIGHT` (one stud on the 1×1, four on the 2×2); the pillar is a `rect` three bricks tall with the size caption "1×1".
- `makeConePiece`: a 24-sided lathe from the full round base (with a 0.14 upright foot) to a top just wider than a stud, one stud on top.
- `makeSlopeCurvedPiece`: a flat back strip 20 % of the depth, then a quadratic curve bowing up and over down to a 0.1 front lip, extruded across the width; no studs. The 1×2 and 2×2 share it. The low slope and small eave needed no builder change (`slope` with `depth / 2 − 1` for the back row, `slopeInv` with its one-stud foot).
- Tests: the 9 parts arm fast with real icons; Bricks 14 / Slopes 11; a brick lands on top of the cone, the curved 2×2 slope and the round 2×2 brick; a pillar dropped on a 2×4 brick stands three bricks tall on it. 177/177; `--sheet` 77/77 icons in red and blue; 300 new parts orbit at 8.2 fps vs plain bricks 5.5.
- Screenshot for Papa: `.tmp/brick-lab-ui/survey-curves.png` — a red car whose bonnet and boot are curved slopes with a tiled roof, a round-brick tower with cones on top, and a pillar, low slope, small eave, 1×6 brick, curved 1×2 and round 1×1 beside it.
- `sw.js` `CACHE_NAME` → `summer-quest-v175-brick-curves`.
