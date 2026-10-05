# Slice 05 — Edges, clouds, rim (shipped 2026-10-05)

**Goal:** Less clutter at the planet's edge and a smooth atmosphere.
**Depends on:** none.
- Draw toys only at `z>0.25`; landmarks keep `z>0.08`.
- Solid, outlined clouds instead of dithered ones, or clouds that skip pixels over sprites.
- Replace the dotted teal rim with a CSS radial-gradient glow behind the canvas, sized from the planet radius.

**DONE WHEN:** `node scripts/check.mjs` is green; the world UI harness passes; the screenshots show no half-dark toys at the edge.

**Shipped 2026-10-05.**
- Toys draw, and can be tapped, only at `z>0.25`. Landmarks keep `z>0.08`. `snapshot()` reports a toy as visible only when it is drawn.
- Clouds: `buildCloudMap` marks a cloud's edge cells `2` (still truthy for taps). `drawGlobe` paints them `snowShade` and the inside `white`, and lights cloud pixels in solid bands with no Bayer dither. Ground keeps its dithered light.
- Rim: the dotted teal ring is gone; `drawGlobe` keeps only the 1-px dark outline. Space and a teal-to-blue atmosphere glow are now the planet canvas's CSS `radial-gradient` background. It is centred and sized from `cx`, `cy` and `radius()` × `scale`, and restyled only when those change, so it follows zoom. The canvas is cleared to transparent instead of filled with space, and the focus and mini-game dims still darken the glow.
- Before/after pairs (the whole planet at zoom 1, plus snow, arcade and forest at zoom 1.8, at 1280×800 and 1024×640) and a focus-mode shot are in `shots-05/`.
- `node scripts/check.mjs` is green. The planet and world tests (54) and the frame budget pass, `check-world-explorer-ui.py` passes, and `check-android8-ui.py` with Chrome 138 is ok on all four profiles.
