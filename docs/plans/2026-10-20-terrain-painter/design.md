# Terrain Painter: paint the Brick Lab ground

**Status:** approved by Papa, 2026-10-20 (chat: home = Brick Lab ground, per-stud tiles, size-only brush, all 8 terrains, "Approve").
**Inspiration:** `pixelart-painter.mp4`, a voxel garden demo. A round brush labelled Grass / Dirt swaps the ground under it, with Radius / Strength / Edge sliders and a terrain picker. We keep what works: clear cause and effect, a readable label on the brush, satisfying swaps. We fix what doesn't: the tool has no labels and the UI strip is tiny.

## Decisions
| # | Decision | Rationale |
|---|---|---|
| D1 | **Lives in Brick Lab** as a new rail tool 🖌️ "Ground 地面". It paints the 32×32 baseplate. No new registry game, and nothing on Pixel Planet. Brick Lab's creative-tool door is unchanged: no stars, no score. | Reuses the camera, saves, worlds and building together. The video *is* a 3D garden, so Brick Lab is the closest fit. |
| D2 | **One terrain per stud cell.** A cell's colour changes (plus a small code-drawn pattern where cheap); its studs stay. Builds on brick-lab slice 13's painted baseplate studs (per-instance colour). No image textures, no blending, nothing that needs WebGL2. | Crisp, matches the Lego look, cheap on Android 8 / Chrome 138 and the r162 WebGL1 fallback, and simple to save and sync. |
| D3 | **8 terrains + eraser:** grass 草地, dirt 泥土, sand 沙子, water 水, snow 雪, stone path 石板路, lava 岩漿, flowers 花地; eraser 橡皮擦 sets the cell back to the plain plate. Terrain is paint only: anything still stacks on any cell (water and lava too), and `landing()` is untouched. | Papa picked all four groups. Keeping it paint-only leaves building rules alone. |
| D4 | **Brush = 3 big size buttons.** S = 1 cell, M = radius 2, L = radius 4 (circle in cells). No Strength or Edge sliders. A ring follows the finger with a label showing the terrain in EN + 中文. Swatches are big coarse-pointer tiles, each with its bilingual name. | Fixes the video's tiny, unlabelled UI. Tablet-first, no hover. |
| D5 | **Input:** while Ground is on, one finger drag paints and two fingers move the camera as usual (kid-camera). A tap paints one brush stamp. Leaving the tool brings back the normal one-finger pan. | Brick Lab already uses two fingers for the camera, so painting can't clash with it. |
| D6 | **Data:** the world gets an additive `ground` field: a 1024-char string, row-major, one letter per cell (`.` = plain). A missing field means a plain plate, so old worlds load unchanged. Saved with the world, local per kid. | Small, diff-friendly; offline-first. |
| D7 | **Undo:** one finger stroke (down to up) is one Undo step that restores the previous letters of the changed cells. | Matches the assemblies one-step rule. |
| D8 | **Building together:** one `ground` op per stroke, `{cells:[[i,letter],…]}`. The host orders ops like every other change; the last one wins per cell. `PROTO` 7 → 8. Guests keep no copy, as before. | Same model as the other ops; a stroke is small. |
| D9 | **Pure logic in `js/brick-lab/brick-ground.js`:** the terrain table (id, letter, colour, EN, 中文), `brushCells(cx, cz, size)`, `applyCells(ground, cells)` returning the new string plus an undo list, and encode/decode. Node-testable, no Three. | Same pattern as `brick-rails.js` / `brick-assembly.js`. |

## Out of scope
Height sculpting, blending or soft edges, animated water, terrain that changes how bricks stack, stars, and Pixel Planet.
