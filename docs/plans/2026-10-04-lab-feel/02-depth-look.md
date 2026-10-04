# Slice 02 — Depth: a room that feels 3D

**Status:** Approved by Papa 2026-10-04 (`design.md` D6, written from Papa's "feel 3D like the planet"). Papa approved D6 on review ("ok go").
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

## Implementation notes (2026-10-04)

- **Helpers** (`lab-art.js`): `BAYER4` + `bayer(x, y)`, `ramp(level, x, y, steps)` (any number of steps), `LAB_LIGHTS` (fire from below-front, moon from above, lantern upper left), `sphereLight`, `cylinderLight`, `shadeRow` (one fillRect per run of the same colour, so per-pixel shading stays cheap) and `ditherShadow`.
- **Wall:** fire and lantern warmth now fall off brick by brick through the dither; the rest of the wall takes a 3-step stone ramp that darkens away from the window, so the corners recede. **Side walls:** 10-px slivers at the canvas's left and right edges with brick courses slanting toward the vanishing point.
- **Bench:** a receding plane: plank seams 11 px apart at the back edge fan out toward the viewer from a vanishing point under the window, with the odd butt joint; the far edge is dithered into shadow.
- **Volume:** the cauldron is shaded per pixel as a sphere (moon + lantern on a 4-step stone ramp), with a red-hot rim only where the surface turns away at its lower edge; the rim flickers with the burner. Jar glass is a cylinder ramp per column with a dark right edge. The mortar is left for slice 03, which redraws the tools.
- **Shadows:** dithered contact shadows under the burner (on the cloth), the books and the cat's bed; the shelf casts a half-density shadow right and down onto the wall.
- **Atmosphere:** a pale moonlight shaft from the window to the bench left of the cauldron, 8 dust motes drifting in it (held still under reduced motion / pause). The fire's warm pool breathes with the flicker.
- **Parallax:** `parallaxOf(lean, now, still)` → whole logical px, ±4, plus a ±1 px sway on a 6 s cycle; 0 when paused or reduced. The back layer (wall, sides, beam, window, lantern, plants) moves; shelf, jars, bench and everything tappable do not. `lab-screen.js` leans it away from the dragged ingredient (`dragAt`) and eases back (×0.25 per draw) when the drag ends.
- **Cache:** `staticLayer` draws the wall + sides + beam and the bench once per (canvas size, scale, room) into offscreen canvases that reach 6 logical px past the canvas (parallax + shake), then blits them. Without a document (node tests) it draws straight onto the canvas, so the palette tests still see every fill.
- **Cost:** `drawLab` on a detached canvas at the 1280×800 stage, dpr 2 (2484 px wide): median 0.6 ms, p90 16 ms (the GPU flushes on some calls) in headless Chromium.
- **Tests:** 2 new (helpers; parallax moves fills but never hits, ignored when reduced or paused). 17 in `codequest-lab-view.test.mjs`, 62 with `codequest-lab.test.mjs`. Lab harness green at all 4 sizes.
- **Screenshots for Papa:** `test-results/codequest-lab/feel-depth-{open,lifted,drag}-1280x800.png` (EN) and `feel-depth-zh-{open,lifted,drag}-1024x600.png` (中文).
- `sw.js` cache `summer-quest-v160-lab-feel-02`.
