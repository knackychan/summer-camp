# Slice 04 — Calm terrain, landmark bases (shipped 2026-10-05)

**Goal:** Sprites read against any biome.
**Depends on:** none. Touches `planet-map.js` / `planet-globe.js` colour and dither choices and `drawItem` shadows.
- Lower the value contrast and dither density of the biome ground: snow, arcade purple, forest.
- A 2–3 px dark oval base under landmarks, or a light 1 px outline around landmark sprites.
- Keep the `drawGlobe` frame budget (`scripts/world-performance.test.mjs`).

**DONE WHEN:** `node scripts/check.mjs` is green. Before/after screenshots at 1280×800 and 1024×640 show the snow dome, penguin and arcade sprites clearly separated from the ground. The perf test passes.

**Shipped 2026-10-05.**
- `planet-map.js`: snow, arcade and forest ground now come from the coarse noise (`n`) in two or three tones instead of the fine noise. Specks are cut: arcade 9% → 3%, snow steel 5% → 1.2%, forest 6% → 2%. Snow is now mostly `snowShade`, so the white snowman and dome stand on shade instead of white.
- `world-explorer.js` `drawItem`: a landmark stands on a 4-row dark oval base at 55% alpha, about 84% of the sprite's width. Toys keep their light 2-row shadow.
- Before/after pairs at 1280×800 and 1024×640 (snow, arcade, forest; zoom 1.8) are in `shots-04/`, made with `scripts/shoot-planet-views.py`.
- `node scripts/check.mjs` is green. The `drawGlobe` frame budget (`planet-globe.bench.mjs`), the planet, world and performance tests (48/48) and `check-world-explorer-ui.py` all pass.
