# Slice 02 — Corner slope, eave, lattice frame, support bracket, window

**Decisions:** D2 (5 parts), D4 (window pane), D7. **Depends on:** 01 (stacking change, `CATALOG_ID`, slope `studs` honoured).

## Changes
- `js/brick-lab/brick-catalog.js` — `slope_corner_2x2` (`shape: "slopeCorner"`), `slope_inv_2x2` (`shape: "slopeInv"`), in Slopes; `frame_2x4` (`shape: "frame"`), `brace_1x2` (`shape: "brace"`), `window_1x2` (`shape: "window"`, 2.4 tall), in Structure. All recolourable.
- `js/brick-lab/brick-lab.js` — new builders, each cached through `kit.geo` and joined in `makePieceMesh`:
  - `makeSlopeCornerPiece` — the outside-corner roof slope: one stud at the back corner, two slanted faces meeting on a hip line.
  - `makeSlopeInvPiece` — the eave: a studded flat top, slanting in underneath to a narrow back foot (the slope profile flipped), so it overhangs a wall.
  - `makeFramePiece` — open lattice brick: four corner posts, top and bottom rails, two diagonal struts per long side, a studded top.
  - `makeBracePiece` — support bracket: a 1×2 studded top plate with a triangular web under it, from the back edge down to the foot.
  - `makeWindowPiece` — frame (sill, head with studs, two jambs) in the picked colour + one pane with a fixed shared material (`kit.custom("window:pane")`: light blue, `transparent`, opacity ≈ 0.45, `depthWrite: false`). Tapping the pane selects the window, like tapping its frame.
  - Reduced tier (brick-lab slice 13): the frame's struts and the window keep their shape; only stud segments drop, as for every part.
- `css/brick-lab.css` — CSS fallback icons for the five shapes (clip-path drawings like `peak`).
- `sw.js` — bump `CACHE_NAME`.

## Tests
- `scripts/check-brick-lab-ui.py` — `NEW_PARTS` gains the 5 ids (arm and build < 50 ms, real-part icon); a brick dropped on `frame_2x4`, `brace_1x2` and `window_1x2` stacks on top; recolouring a window to green changes the frame and leaves the pane's material untouched.
- Screenshot for Papa: a small house using eaves, corner slopes, ridge caps and windows (`.tmp/brick-lab-ui/roof-house.png`).

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes; 39 parts; Papa has seen the house screenshot.

## As built (2026-10-05)
- Shipped as planned: 39 parts, Slopes 7, Structure 4.
- New helpers in `brick-lab.js`: `extrudeProfile` (the slope's extrude-across-the-width, reused by the eave and the bracket's web), `facetGeometry` (flat-shaded solid from convex faces; the corner slope), `boxAt`, `paintedGroup`.
- Corner slope: a 1×1 flat top with one stud on the back corner cell, two planes falling to 0.16 lips on the front and right edges, meeting on the diagonal. Rotated 0 / 90 / 180 / 270 it makes the four corners of a hip roof.
- Eave: the slope profile turned over — full studded top, a 0.16 front lip, slanting in to a one-stud foot at the back.
- Lattice frame: 0.24 studded top, four corner posts, bottom rails all round, an X of two struts on each long side.
- Support bracket: studded 0.3 shelf on a 0.26 upright back plate, a 0.32-thick triangular web between them.
- Window: sill 0.22, studded head 0.3, two jambs 0.2 along the 2-stud length; pane 0.06 thick in `kit.custom("window:pane")` (`#9fd3ee`, opacity 0.45, `depthWrite: false`, no shadow). Recolour swaps only the frame (`sqblPaint`), so the pane stays.
- `snapshot()` gains `selectedColors` (the selected piece's material colours) for the recolour check.
- Search: "2x4" now also finds the lattice frame (its footprint is 2×4); the slice 11 check was updated to expect it.
- Tests: `check-brick-lab-ui.py` `lab_more_parts` (renamed from `lab_more_parts_01`; slices 01–02 together): 13 new parts arm in < 50 ms with real-part icons; Plates 9 / Slopes 7 / Wheels 3 / Structure 4; a brick lands on top of a tree, the large wheel, the round plate, the frame, the bracket and the window; recolouring a window to green gives `['#237841', '#9fd3ee']`. 146/146 browser checks.
- Screenshot for Papa: `.tmp/brick-lab-ui/roof-house.png` — a house of windows under a hip roof of corner slopes, two 2×2 slopes and four ridge caps, with an eave, a corner slope, the frame, a bracket and a window beside it. `roof-parts.png` is a close-up of the eave, frame and bracket.
- `sw.js` `CACHE_NAME` → `summer-quest-v171-brick-roof-parts`.
