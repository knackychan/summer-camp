# Slice 02 — Depth: a room that feels 3D

**Status:** Approved by Papa 2026-10-04 (`design.md` D6, written from Papa's "feel 3D like the planet"). Papa reviews D6 before this slice starts.
**Goal:** The Lab reads as a 3D room, with perspective, light, volume, shadows and a little parallax. It is still crisp pixel art on a 2D canvas.
**Depends on:** 01.
**Files:** `js/games/codequest/lab/lab-art.js`, `js/games/codequest/lab/lab-view.js`, `js/games/codequest/lab/lab-screen.js` (parallax target), `js/games/codequest/palette.js` (append only, if a ramp step is missing), `scripts/codequest-lab-view.test.mjs`, `sw.js` cache bump.

## Change

- **Shading helpers** in `lab-art.js` (pure):
  - `BAYER4` matrix.
  - `ramp(level, x, y, [shadow, base, lit])` returns a palette index via ordered dither.
  - `sphereLight(nx, ny, nz, lights)` and `cylinderLight(nx, lights)` return 0..1.
  - Lights are data: fire `{ dir, warm, flicker }`, moon, lantern.
- **Perspective:**
  - The bench top is a receding plane: plank seams converge toward a vanishing point under the window.
  - A bench front edge band.
  - Side-wall slivers (up to 12 px wide, darker ramp) at the room's left and right edges.
- **Volume:**
  - The cauldron is shaded per pixel as a sphere: fire from below-front, moon from above, rim light on the fire side.
  - Jars are cylinders with a vertical glint. The mortar is a bowl.
  - The burner stones get top-lit faces.
  - Ingredient sprites are unchanged.
- **Shadows:** dithered contact ellipses under the cauldron, tools, books, cat and bag. The shelf casts a soft offset shadow on the wall.
- **Atmosphere:** a dithered moonlight shaft from the window to the bench, with 6–10 dust motes drifting in it (still under reduced motion).
- **Fire light:** the warm pool pulses with the burner's flicker. Wall bricks near the fire take the warm ramp through the dither, not a hard circle.
- **Parallax:**
  - The back layer (wall, window, lantern, plants) is offset by `parallax = { x, y }` in logical px, with |x| and |y| ≤ 4.
  - `lab-screen.js` eases the offset toward the drag point while dragging and back to 0 after.
  - Idle sway is ±1 px on a 6 s cycle.
  - Reduced motion: parallax is 0.
  - Hits never use the parallax.
- **Cache:** the static part of the back layer is drawn once per (W, H) into an offscreen canvas and blitted with the parallax offset. Animated parts (stars, lantern, plants, motes) draw on top each frame.

## DONE WHEN

- Tests:
  - helpers return palette indices only
  - `ramp` is deterministic per (x, y)
  - sphere light is brightest on the lit side
  - parallax never changes `hits`
  - the scene still paints palette-only at every room size
  - with reduced motion, parallax is 0 and frames at two different times are identical apart from effects
- Frame cost at 480×240, 2×: median draw ≤ 8 ms in Chrome desktop (logged by the harness), so Android 8 keeps ≥ 20 fps idle.
- Screenshots at 1280×800 (EN) and 1024×600 (中文) are saved to `test-results/codequest-lab/feel-depth-*.png` and shown to Papa.
- `node scripts/check.mjs` green.
