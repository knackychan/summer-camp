# Slice 04 — Calm terrain, landmark bases (pending)

**Goal:** Sprites read against any biome.
**Depends on:** none. Touches `planet-map.js` / `planet-globe.js` colour and dither choices and `drawItem` shadows.
- Lower the value contrast and dither density of the biome ground: snow, arcade purple, forest.
- A 2–3 px dark oval base under landmarks, or a light 1 px outline around landmark sprites.
- Keep the `drawGlobe` frame budget (`scripts/world-performance.test.mjs`).

**DONE WHEN:** `node scripts/check.mjs` is green. Before/after screenshots at 1280×800 and 1024×640 show the snow dome, penguin and arcade sprites clearly separated from the ground. The perf test passes.
