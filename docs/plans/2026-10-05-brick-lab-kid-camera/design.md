# Brick Lab — a camera kids can drive

**Status:** approved by Papa, 2026-10-05 (chat: "i feel the two finger to move/pan the camera is a bit hard to use as a kid, could we rework the exploration/camera navigation control to make it more fit for kids?" → one finger "Slide the map" → turning by "Buttons + twist, auto tilt" → "ok go" on the design). Amends `docs/plans/2026-10-03-brick-lab/` D13 (slice 07, two-finger pan): where they disagree, this file wins for the camera.

## What changes
One finger on empty ground slides the island like a map. Turning moves to big ↺ ↻ buttons (and a two-finger twist); zoom is a pinch or + − buttons; the tilt follows the zoom. Build and Explore drive the camera the same way.

## Decisions
| # | Decision | Rationale |
|---|---|---|
| K1 | **One finger on empty ground slides the map.** The ground point under the finger stays under the finger (grab the ground, not a screen-space shift). A tap still places or selects; one finger on the selected piece still drags it (brick-lab D8); a part slid out of the rail still places (slice 15). The slide starts after the same 10 px as a drag (`DRAG_START`), so a tap never pans. | The two-finger pan (D13) was hard for the kids; sliding a map with one finger is what they already do on the planet and in maps. |
| K2 | **Two fingers pinch to zoom and twist to turn**, and the pair also slides the map. Each part only starts past its own threshold (pinch 8 %, twist 12°), so a pinch never turns by accident. The ground point under the two fingers' midpoint stays under it. | Adults and older kids keep the natural gestures; small hands that only pinch don't spin the view. |
| K3 | **Buttons, floating over the bottom-right of the 3D view:** ↺ ↻ turn the view 45° in a 300 ms glide; + − zoom one step (× 0.7 / ÷ 0.7) in a 250 ms glide. ⌂ stays in the top bar. Targets ≥ 56 px, `pointerdown`, an overlay so the view never resizes (brick-lab D14). Labels are icons with an EN + 中文 `aria-label`; no text, so pre-readers see the same. | Turning and zooming become a tap a five-year-old can repeat; no gesture to learn. |
| K4 | **Tilt follows zoom; no tilt control.** The view looks down at 22° close up (distance 5) and 55° far out (distance 220), on a log scale; Home (distance 94) looks down at about 47°, close to today's 41°. | Far = see the whole island from above; close = see the sides of a build and a minifig's face, without a third thing to learn. |
| K5 | **Limits as today:** distance 4 – 128 in Build, 4 – 160 in Explore; the centre of the view stays within 4 studs of the plate's edge (D13); turning is unlimited. A one-finger slide glides to a stop after release (~0.4 s), none with `prefers-reduced-motion`. | Nothing a kid can lose; the glide feels like a real map. |
| K6 | **Mouse:** left drag slides the map, right drag turns, the wheel zooms about the cursor. | Same rules as a finger; the right button keeps a way to turn freely. |
| K7 | **One small camera module, `js/brick-lab/brick-camera.js`.** The view is four numbers — the ground point it looks at (x, z), the turn (yaw) and the distance; the tilt and the camera position are worked out from them. Its maths (view → camera, screen point → ground point, limits) are plain functions a node test checks; the same module wires touch, mouse and the buttons. Brick Lab stops using OrbitControls (and no longer loads it). | OrbitControls can't twist with two fingers or tie the tilt to the zoom, and its pan drifts off the finger; one place for every way the view moves; works the same on modern Three and the r162 fallback. |

## Kid-facing strings
- `turnLeft`: ["Turn left", "向左轉"] · `turnRight`: ["Turn right", "向右轉"] · `zoomIn`: ["Zoom in", "放大"] · `zoomOut`: ["Zoom out", "縮小"] (aria-labels)
- Explore hint becomes: ["Slide to look around. Tap something to edit it.", "滑動來看看四周。點任何東西就能修改。"]

## Not in this plan
Walking a minifigure around, double-tap to zoom, a tilt control, follow-cam, Code Quest / Pixel Planet cameras.

## Slices
- `01-camera-module.md` — K1, K2, K4, K5, K6, K7: `brick-camera.js` + node test, wired in place of OrbitControls
- `02-buttons.md` — K3: the ↺ ↻ + − cluster and the Explore hint
- `03-checks.md` — browser checks, Android 8 check, a build on the tablets
