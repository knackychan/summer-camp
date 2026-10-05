# Slice 13 — Low-end rendering: painted studs, Lambert light, render on demand

**Requested by Papa, 2026-10-04** ("Three.js minimal mode, low-end optimization": ≥ 45 FPS on Android 8 / WebGL1 / ≤ 4 GB tablets, same engine, D2 kept). Amends design.md with D24–D25.

**Depends on:** 08 (lo-fi light), 12.

## What was already there
`three-runtime.js` already sorts devices into two tiers. **Reduced** is Android ≤ 9, `navigator.deviceMemory` ≤ 4, no antialiased WebGL2, or WebGL1 (r162). It already gives pixel ratio 1, no antialiasing, no shadow map, 6-sided baseplate studs and no CSS tilt-shift blur. Brick Lab already shares one material per colour, caches one merged geometry per part (one draw call per piece), uses no textures and no post-processing, and Three already skips meshes outside the camera's view. The brief's detection, material pool, pixel ratio, shadow, atlas, frustum and post-processing items were therefore already done or don't apply here.

## Measured (starter village, 1280×800, Edge headless on SwiftShader — CPU GL, so frame rate follows render cost)
| | Before | After |
|---|---|---|
| Reduced: triangles / draw calls | 178,946 / 88 | 31,490 / 88 |
| Reduced: frames per second while orbiting | ~16 | ~45 |
| Standard: triangles / frames per second | 307,106 / ~7.4 | unchanged |
| Idle lab: frames drawn per second | every frame | 0 |

The 4,096 instanced baseplate studs were ~147k of the reduced tier's 179k triangles.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D24 | **Reduced tier only: studs painted on the baseplate, Lambert light, no fill light.** The plate's top face (the extrusion's lid, whose UVs are world units) carries a 64 px repeating stud texture drawn on a canvas: a top disc, the sunlit wall toward the home view and a contact line, so they read as raised bumps. Every material on the reduced tier is `MeshLambertMaterial` (same diffuse light, no roughness or metalness); the cool fill light is dropped and the sky light lifts from 1.2 to 1.4. The standard tier is unchanged. Bricks keep their real stud geometry on both tiers. | Studs as geometry were most of the triangles. PBR shading on a full-screen sea is the biggest per-pixel cost on a weak GPU. From far away the painted plate reads a little smoother than the real one, which is an acceptable trade. |
| D25 | **Render on demand, both tiers.** The loop still runs every animation frame (controls, damping, tweens), but it draws only when the camera moved, a camera tween or the circuit glow is running, or there was input (pointer, wheel, key, input/change, click) in the last 500 ms. Opening, resizing and a restored GL context also draw. `snapshot().render` reports `quality`, `calls`, `triangles`, `studs` and `frames`. | An idle lab drew 60 frames a second for nothing: heat, battery and thermal throttling on old tablets. Every scene change starts from input, so the 500 ms hold covers it. |

**Not done, and why:** a hand-written frustum pass (Three already does this per mesh, and a `Box3` per mesh per frame would cost more than it saves); a colour atlas (there are no textures to atlas); plain boxes instead of studded bricks (bricks are not the cost, and studs make them Lego); a "basic rendering mode" toast (Papa's brief also says the optimisation is invisible and adds no strings; a kid has nothing to do with that message).

## Changes
- `js/brick-lab/brick-lab.js` — `litMaterial()`, `makeKit(cheap)`, `paintedStuds()`, reduced-tier lights, `invalidate()` / `cameraMoved()` and the on-demand loop, input listeners added and removed with the lab, `snapshot().render`.
- `scripts/check-brick-lab-ui.py` — an idle lab draws no frames and input brings them back; a 4 GB (`deviceMemory` 4) profile gets the reduced tier with painted studs and under 60k triangles, and still places a piece.

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes; `check-android8-ui.py` with Chrome 138 passes; a frame-rate reading on a real Android 8 tablet.

**Verified 2026-10-04:** `check.mjs` green; `check-brick-lab-ui.py` 75/75 (Edge headless, SwiftShader), no page or console errors. Not yet: the real-tablet frame-rate reading.

**Android 8 check 2026-10-05:** `check-android8-ui.py` with Chrome for Testing 138.0.7204.183 passes in all four modes (WebGL2, WebGL1, no GL then retry, offline WebGL1); Brick Lab draws in each with no GL or page errors.
