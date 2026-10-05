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

**Shipped 2026-10-06:** `brick-walk-view.js` (joystick, look drag, Jump, 🔨 Build, behind camera, limb swing) and hooks in `brick-lab.js`: 🚶 in a standing minifig's bubble (hidden while `together.shared`), `enterWalk` / `leaveWalk` / `landWalk`, `back()` and mode changes leave walking, Undo while walking takes the walk back, `snapshot().walk`. As built:
- The walker is a **stand-in**: the figure drawn jointed plus its riders in one group, never raycast; the real pieces are hidden and untouched until the walk lands. No change to `addObject`.
- Leaving lands the figure through `landing()` against the world without its riders, then moves each rider by the same offset and turn. Solo: one history snapshot. Hosting (the app hosts every open world): the inverses are grouped with a new `createUndo().group(n)` and `undoLast()` undoes a group last-first (`brick-share.test.mjs` covers the group).
- `brick-camera.js` gains `refresh()`, so the kid camera rewrites the view after the walk drove it; on leaving it sits 24 studs behind the figure, looking the way the walk looked.
- Browser check (scratch, folded into `check-brick-lab-ui.py` in slice 07), 20/20 on Edge SwiftShader on the committed tree alone: select → 🚶 → hat rides; stick walks onto the plate, steps up a brick, a 4-brick wall stops it; Jump lifts it and it lands; a look drag turns right and isn't a tap; a still walker draws 0 frames; Back lands it on the studs at a quarter turn with the hat on its head, one Undo puts both back; no 🚶 on a plate; Undo while walking takes the walk back; no page errors. SwiftShader runs a few frames a second and a frame walks at most 50 ms, so the checks wait for positions, not times.
- The moving-parts slice 04 work (alive on tap) that was uncommitted in the same files was left out of this commit.
