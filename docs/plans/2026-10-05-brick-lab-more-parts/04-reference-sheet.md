# Slice 04 — Reference sheet of all 46 parts; Android 8 check

**Decisions:** none new; proves D2, D4, D5 and D7 on screen and on the target browser. **Depends on:** 01, 02, 03.

## Changes
- `scripts/check-brick-lab-ui.py` — a `--sheet` step that renders every part's real-part icon (multiplayer slice 08) in red into one grid, grouped by category with the EN + 中文 label under each, and saves `.tmp/brick-lab-ui/parts-sheet.png`; a second pass in blue shows which parts recolour. No new runtime code.

## Tests
- Run `check-brick-lab-ui.py` on WebGL2 and forced WebGL1 (r162 fallback, reduced tier): every part builds and has an icon on both.
- `scripts/check-android8-ui.py` with Chrome 138.
- Frame-time check: the 64×64 island with ~300 mixed new parts (windows, rocks, logs included) stays render-on-demand when idle (0 frames drawn) and doesn't trigger the slice 14 step-down while orbiting on the standard tier any sooner than a build of the same count of plain bricks.

**DONE WHEN:** `node scripts/check.mjs` green; both UI runs pass; `check-android8-ui.py` passes with Chrome 138 (or, if no Chrome 138 is on the machine, recorded as *not yet run* in *As built*, as in multiplayer slice 08); Papa has reviewed `parts-sheet.png`; Papa has built something with the new parts on a real tablet.

## As built (2026-10-05)
- `check-brick-lab-ui.py --sheet [--graphics webgl1]` runs only this step. It seeds two worlds of 300 pieces on a 20 × 15 grid (one all 2×4 bricks, one cycling through the 20 new parts), opens Brick Lab, and for red then blue scrolls every category's parts into view, reads each real-part icon and lays them out in a page (category headings, EN + 中文 under each) saved as `parts-sheet.png` / `parts-sheet-blue.png` (`webgl1-` prefix on the WebGL1 run). No app code changed. `--graphics webgl1` hides WebGL2, so three-runtime falls back to r162 on the reduced tier.
- Results, WebGL2 / standard tier (Edge 141 headless, SwiftShader): all 46 parts build and have an icon in red and in blue; an idle lab draws 0 frames with either world; orbiting in Explore, both worlds step down within the first 2 s window (SwiftShader is slow for everything: plain 2.54 s, new parts 2.46 s — inside the one-window slack), and the new parts draw *more* frames than plain bricks (9.2 vs 6.6 fps; 412 draw calls vs 307, 127k triangles vs 280k — the 2×4 brick's eight studs outweigh the extra meshes of windows, wheels, barrels and mushrooms).
- WebGL1 / reduced tier: all 46 parts build and have icons in both colours; idle 0 frames with either world. (The reduced tier never steps down, so there is no orbit comparison there.)
- `check-android8-ui.py` with Chrome 138 (`138.0.7204.183` headless shell, Android 8 identity, 2 GB): webgl2, webgl1, no-WebGL and offline-webgl1 cases all ok, Brick Lab included (context loss recovers, r162 downloaded only off WebGL2). Evidence refreshed in `test-results/android8/`.
- Full `check-brick-lab-ui.py`: 158/158.
- Found on the way, not changed: entering a world right after an orbit fling keeps the camera gliding while OrbitControls' damping runs out. At SwiftShader's ~10 fps that takes several seconds; on a tablet at 60 fps it is a fraction of a second. The cost check measures idle frames before any orbit for that reason.
- **Still open for DONE WHEN:** Papa reviews `parts-sheet.png` (and the blue sheet), and Papa builds something with the new parts on a real tablet.
