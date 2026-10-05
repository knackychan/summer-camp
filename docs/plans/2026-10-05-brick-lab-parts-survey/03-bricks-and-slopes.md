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
