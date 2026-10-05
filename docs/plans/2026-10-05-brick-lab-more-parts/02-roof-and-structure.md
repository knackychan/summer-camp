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
