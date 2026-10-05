# Slice 01 — The camera module

**Requested by Papa, 2026-10-05.** Implements design.md K1, K2, K4, K5, K6, K7.

**Depends on:** brick-lab slices 07 (pan, island limit), 13 (render on demand), 15 (rail drag).

## Changes
- `js/brick-lab/brick-camera.js` (new)
  - Pure: `pitchFor(distance)` (K4), `cameraPosition(view)`, `groundAt(view, ndcX, ndcY, fov, aspect)` (the ground point under a screen point, or null above the horizon), `clampView(view, limits)` (K5).
  - `createKidCamera({ camera, element, limits, reducedMotion })`: pointer handling on the canvas — one pointer slides (after `DRAG_START`), two pointers pinch / twist / slide around their midpoint (K2), mouse right drag turns and the wheel zooms about the cursor (K6); a release glide; `animateTo(partial, ms)`, `turn(deg)`, `zoom(factor)`, `setLimits()`, `enabled`, `update(time)` (true when the camera moved), `view()`, `dispose()`.
- `js/brick-lab/brick-lab.js` — uses the module instead of OrbitControls: Home, focus on a piece (Explore tap), the camera tween, the island limit and the Explore / Build distance limits all go through it; the piece drag still turns camera input off while it lasts. `loadThree(…, false)`: no OrbitControls download. `snapshot()` keeps `camera` and `target` and adds `view: { x, z, yaw, distance, pitch }`.
- `scripts/brick-camera.test.mjs` (new) — node test: tilt at the ends and at Home, the ground under the screen centre is the target, a slide keeps the grabbed point under the finger, limits clamp.
- `sw.js` — `brick-camera.js` precached; cache bumped.

**DONE WHEN:** `node scripts/check.mjs` green (runs the new test); in the browser one finger slides the map, a tap still places, the selected piece still drags.
