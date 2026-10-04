# Slice 05 — Brick Lab UX polish: one-tap edit, no flash, Lego look

**Requested by Papa, 2026-10-04** (brief "Brick Lab UX Improvements": two-click flow hostile on tablets, a flash on selection, bricks too generic; "if modelling is too complex, pixel art or 3D pixel art"). Amends design.md with D8–D11 below; D1–D7 stand.

**Depends on:** 01–04.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D8 | **Tools sit on the piece, and the piece itself is the tool.** The right rail goes. Selecting a piece opens a small tool bubble anchored above it (Move · Turn · Copy · Remove, ≥ 56 px targets, `pointerdown`), which follows the piece as the camera orbits. Tapping the selected piece again turns it 90°; pressing and dragging the selected piece moves it in one gesture (orbit is suspended for that drag only). The Move button stays for kids who prefer tap-then-tap. | The finger never has to leave the piece: one tap selects, the next tap or drag acts, both on the same spot. A rail at the screen edge was 20+ cm away on a 10" tablet. |
| D9 | **Selection never touches layout.** The bubble is an overlay inside the stage (positioned with `transform`, no reflow), so the 3D view never resizes. The colour tray is built once; selection only moves the `is-active` class. Recolouring swaps a cached material, it does not rebuild DOM. | The flash was the right rail animating from 0 → 128 px: the stage shrank for 220 ms, every frame re-sized the WebGL canvas (clears the drawing buffer) and changed the camera aspect. |
| D10 | **Real brick proportions, built in code.** 1 stud pitch = 1 unit; brick 1.2, plate 0.4 (real 9.6 / 3.2 mm on an 8 mm pitch); studs Ø 0.6 × 0.2 with a chamfered top; bevelled bodies with a small seam so stacked bricks show the classic groove; slope 2×2 with its back row of studs; a studded baseplate (one instanced mesh, one draw call). Glossy ABS-like materials (roughness ≈ 0.24) in Lego-like colours, plus a cool fill light for highlights. Each part's body + studs are merged into one geometry, cached per part and shared by every copy; materials are cached per colour. 3D stays (no pixel art): the cache makes it cheaper than before. | Credible look without assets or extra libraries; one draw call per piece keeps WebGL1 tablets fine. |
| D11 | **Pieces snap to the stud grid.** Odd footprints centre on half-units, even ones on whole units, so every stud lines up with the baseplate. A save without `grid: 2` is re-settled on load (same x/z snapped, stacked again bottom-up with the new heights) and kept under the same `sq:brick-lab:v1:<kid>` key. | Saves from slice 01 (one day old) keep their builds instead of floating or overlapping. |

No new kid-facing strings beyond the one changed hint, which ships EN + 中文.

## Changes
- `js/brick-lab/brick-lab.js` — tool bubble, tap-again-to-turn, drag-to-move, single-pass selection, geometry/material cache, new piece geometry, studded baseplate, grid snap + re-settle.
- `js/brick-lab/brick-catalog.js` — heights 1.2 / 0.4, Lego-like colour values (ids unchanged).
- `js/brick-lab/brick-storage.js` — persists `grid`.
- `css/brick-lab.css` — right rail removed, bubble styles, tray previews take the active colour.
- `sw.js` — `CACHE_NAME` bumped.
- `scripts/check-brick-lab-ui.py` — checks for the bubble, no resize / no tray rebuild on select, tap-again turn, drag move, baseplate studs, legacy save re-settle.

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes (selection keeps the canvas size and the colour tray nodes, the bubble sits by the piece, tap-again turns, drag moves, an old save re-settles); `check-android8-ui.py` with Chrome 138 passes with Brick Lab on the WebGL1 (r162) path.

**Verified 2026-10-04:** `check.mjs` green (after rebuilding `dist/android-web`, whose stale payload had been failing the build-tools test); `check-brick-lab-ui.py` 37/37 on source; `check-android8-ui.py` with Chrome 138 headless shell — all four profiles `ok`, Brick Lab drew on `webgl2` and on `webgl` (r162), recovered from no-GL retry and context loss. Found on the way: a tap in the same frame as an Undo raycast against stale matrices and could select the wrong piece — `pointFromEvent` now updates world matrices first.
