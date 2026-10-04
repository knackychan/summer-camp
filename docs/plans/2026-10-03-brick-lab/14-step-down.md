# Slice 14 — Step-down: a standard tablet that can't keep up loses detail quietly

**Requested by Papa, 2026-10-04** (picked from the follow-ups to slice 13). Amends design.md with D26.

**Depends on:** 13.

## Why
The reduced tier (slice 13) is chosen once, from Android version, memory and WebGL version. A mid-range tablet — say 6 GB on Android 11 with a weak GPU — lands in the standard tier: PBR light, a 2048 shadow map, 4,096 studs as geometry (~245k of its ~307k triangles), and pixel ratio 2, which is 4× the pixels to fill. Nothing caught it if that was too much.

## Decision

| # | Decision | Rationale |
|---|---|---|
| D26 | **Measure while drawing, step down one notch per slow stretch.** Only frames drawn back to back count (render on demand, D25, makes idle frames free); a gap over 250 ms — idle, a shader compile — starts the count over. After 2 s of continuous drawing, if the average frame took more than 28 ms (under ~36 fps), the lab takes the next step: **1** pixel ratio 1 (skipped if it already is), **2** the slice 13 painted studs on the plate instead of the instanced studs, **3** the sun stops casting shadows. One step per stretch, never back up during a visit, no message (no new strings). The canvas keeps its size: pixel ratio changes only the drawing buffer, and `resize()` draws right away so it doesn't flash (D14). The reduced tier has nothing left to step down. `snapshot().render` adds `level`, `pixelRatio` and `shadows`. | Cheapest knob first: fill rate, then most of the triangles, then the shadow pass. Measuring only while the view moves means a kid who is thinking never costs anything, and a one-off hitch can't trigger a step. |

## Changes
- `js/brick-lab/brick-lab.js` — `measureFrame()`, `stepDown()`, `paintStuds()` (shared with the reduced tier), `this.sun`, `this.baseStudMesh`; the painted plate uses `litMaterial` so it matches either tier's shading.
- `scripts/check-brick-lab-ui.py` — a standard-tier page whose animation frames are slowed to 45 ms reaches level 3 (painted studs, no shadows, pixel ratio 1) while orbiting, keeps its canvas size, and still places a piece.

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes; `check-android8-ui.py` with Chrome 138 passes.

**Verified 2026-10-04:** `check.mjs` green; `check-brick-lab-ui.py` 78/78 (Edge headless, SwiftShader), no page or console errors. Not yet run: `check-android8-ui.py` with Chrome 138.
