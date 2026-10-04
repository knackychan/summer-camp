# Slice 08 — Steady dock (no flash) and lo-fi lighting

**Requested by Papa, 2026-10-04** (with a reference render of a brick skate-park in soft tilt-shift light): "the viewport flashing is still happening, maybe because every time we select a new brick category it resizes the viewport … fix that size to a constant size … also improve the lighting to look more lofi style." Amends design.md with D14–D15.

**Depends on:** 07.

| # | Decision | Rationale |
|---|---|---|
| D14 | **The dock has one height for every category, and a resize can never show a blank frame.** Part buttons are a fixed 82 px (88 px pre-reader) with labels clamped to two lines; the part row and the tray title have fixed heights. `resize()` also renders straight after `setSize`, inside the ResizeObserver callback, before the browser paints. | Measured: the dock was 177 px for Bricks/Plates/Wheels, 183 px for Slopes/Rails and 195 px for Nature (two-line names), so the 3D view shrank and grew on every category tap. Resizing a WebGL canvas clears it: that was the flash slice 05 didn't catch. Rendering inside the resize callback also covers the rail fold and Explore toggle. |
| D15 | **Lo-fi miniature light.** ACES filmic tone mapping (exposure 1.05); satin plastic (default roughness 0.45, was 0.24); cool sky / warm ground hemisphere light; a low, warm late-afternoon sun with long soft shadows; a faint cool rim light; a muted sea. A CSS lens overlay adds a soft vignette everywhere and, on standard-quality devices only, a tilt-shift blur that fades in at the top and bottom of the view (`backdrop-filter`, pointer-events none). | Matches the reference's soft, warm toy-photo mood without post-processing passes. The blur costs nothing on reduced-quality tablets (Android ≤ 9, ≤ 4 GB), which skip it. |

No new kid-facing strings.

## Changes
- `css/brick-lab.css` — fixed dock heights; `.sqbl-lens` vignette + tilt-shift.
- `js/brick-lab/brick-lab.js` — render in `resize()`; tone mapping, lights, default roughness, sea colours; lens markup; `is-hq` class from the renderer's quality.
- `scripts/check-brick-lab-ui.py` — switching through every category keeps the canvas size; the Move drop now aims at a starter path plate (the old fixed screen point fell just off the plate's front edge with the new framing).

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes; `check-android8-ui.py` with Chrome 138 passes.

**Verified 2026-10-04:** dock 188 px in every category at 1280×800 and 1024×768; `check-brick-lab-ui.py` 40/40; `check-android8-ui.py` Chrome 138 — all four profiles `ok`, no GL errors; `check.mjs` green.
