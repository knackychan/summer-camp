# Slice 02 — Step in and walk (solo)

**Requested by Papa, 2026-10-06.** Implements design.md W1, W2, W3, W5, W7, W8 and the behind view of W4.

**Depends on:** 01.

## Changes
- `js/brick-lab/brick-walk-view.js` (new) — `createWalkView(lab, walkerId)`: the joystick, the one-finger look drag on the rest of the view, the ⤒ Jump and 🔨 Build buttons, the behind camera, the frame loop while moving (W8); `exit()` returns the snapped spot. Kid camera input (`brick-camera.js`) is off while walking and restored on exit with the view it had.
- `js/brick-lab/brick-lab.js` — small hooks only:
  - 🚶 Walk 走走看 in the tools bubble of a selected standing minifig (W1).
  - `back()` leaves walking first.
  - The walker and its riders follow the walk state each frame; the Walk pose loop plays while moving (W7).
  - Leaving sends the minifig's and riders' `move` ops through `landing()` as one Undo step (W2, W3); if the undo stack has no grouping yet, add it.
  - `snapshot()` adds `walk: { id, x, y, z, yaw, view }` or `null`.
- `css/brick-lab.css` — joystick and walk buttons (≥ 56 px, overlays; the view never resizes).
- Strings: `walk`, `build`, `jump`, `walkHint`, `joystick` (design.md).
- `sw.js` — `brick-walk-view.js` precached; cache bumped.

In a shared world the 🚶 button stays hidden until slice 05.

**DONE WHEN:** `check.mjs` green; in the browser a kid steps into a minifig, walks with the joystick, climbs a plate and a brick, jumps onto two bricks, is stopped by a taller wall and the island edge, and on Back the minifig stands snapped on the grid with its hat still on; one Undo puts both back.
