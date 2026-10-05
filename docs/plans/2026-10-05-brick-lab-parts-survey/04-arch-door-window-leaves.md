# Slice 04 — Arch, door, big window, leaves

**Decisions:** D2 (4 parts), D5, D6, D7, D10. **Depends on:** 01. Independent of 02 and 03.

## Changes
- `js/brick-lab/brick-catalog.js`
  - Structure: `arch_1x4` (`shape: "arch"`, 1×4, 1.2 tall), `door_1x4x6` (`shape: "door"`, 1×4, 7.2 tall), `window_1x4x3` (`shape: "window"`, 1×4, 3.6 tall).
  - Nature: `leaves` (`shape: "leaves"`, 1×1, 0.8 tall).
  - `FIXED_COLOR_SHAPES` gains `leaves`.
- `js/brick-lab/brick-lab.js`
  - `makeArchPiece` — a 1×4 brick with a half-circle cut from underneath between the end cells (extruded profile), 4 studs on top. The opening stays in the footprint (D5).
  - `makeDoorPiece` — a frame (two jambs, a head with 4 studs, no sill) and a closed door panel in the picked colour, with a small fixed dark-grey knob (`kit.custom("door:knob")`). It doesn't open (D6).
  - `makeWindowPiece` (more-parts 02) at 1×4×3 with the same shared pane material; adjust only through part data if possible.
  - `makeLeavesPiece` — a 1×1 round plate with three flattened leaf shapes fanned out from it, fixed green.
- `css/brick-lab.css` — CSS fallback icons for `arch`, `door`, `leaves`.
- `sw.js` — bump `CACHE_NAME`.

## Tests
- `scripts/check-brick-lab-ui.py` — `NEW_PARTS` gains the 4 ids (arm and build < 50 ms, real-part icon); a brick dropped on the arch's middle stacks on the arch; recolouring the door changes frame and panel, not the knob; recolouring the big window leaves its pane untouched; the leaves icon doesn't change with the picked colour.
- Screenshot for Papa: a house with a door, big windows, an arch over a path and leaves on the roof (`.tmp/brick-lab-ui/survey-house.png`).

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes; 81 parts (Structure 7, Nature 5); Papa has seen the house screenshot.

## As built (2026-10-05)
- Shipped as planned: 81 parts, Structure 7, Nature 5.
- `makeArchPiece`: the brick profile with a half-ellipse cut from underneath, as wide as the two middle cells and 0.68 of the brick tall, extruded across the width; four studs.
- `makeDoorPiece`: two 0.3 jambs and a 0.4 studded head (no sill), a 0.16 door with two raised panels on each face — all one recolourable geometry — and a dark knob on each face in a fixed material (`#3d4246`, the barrel hoops' iron).
- `window_1x4x3` reuses `makeWindowPiece` at 1×4×3 (same shared see-through pane).
- `makeLeavesPiece`: a small green round base and three flattened leaves fanned out and up; fixed colours; `leaves` joins `FIXED_COLOR_SHAPES`. The leaves reach a little past the 1×1 cell, like the real part.
- Tests: the 4 parts arm fast with real icons; Structure 7 / Nature 5; a brick lands on top of the arch, door, big window and leaves; recolouring the door green gives `['#237841', '#3d4246']` (knob kept) and the big window `['#237841', '#9fd3ee']` (pane kept); the leaves icon keeps its colour with blue picked. 187/187; `--sheet` 81/81 icons in red and blue; 300 new parts orbit at 8.3 fps vs plain bricks 5.5. The door (7.2) is within the height cap through `check.mjs`.
- Screenshot for Papa: `.tmp/brick-lab-ui/survey-house.png` — a house with a red door and big windows, leaves on its roof, a tiled path through an arch on two pillars.
- `sw.js` `CACHE_NAME` → `summer-quest-v176-brick-doors`.
