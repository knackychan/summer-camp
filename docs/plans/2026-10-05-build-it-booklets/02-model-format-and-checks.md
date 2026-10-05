# Slice 02 — Model format, checker and the first model

Implements design.md B3, B4, B7, B10.

**Depends on:** nothing (the checker uses the catalog data, not the 3D shapes).

## Changes
- New `js/books/build-it-data.js`: `BUILD_IT_MODELS`, a list of models `{ id, name:[en,zh], level, tags, intro:[en,zh], steps:[{ add:[{partId,colorId,x,y,z,rotation}], tip?:[en,zh] }] }`. The first model: **Little Rocket 小火箭** (Easy).
- New `js/books/build-it-core.js` (pure, no DOM): `partsList(model)`, `piecesUpTo(model, step)`, and `checkModel(model, catalog)` returning a list of problems: unknown part or colour, overlap, a floating piece, too many pieces in a step, a level's piece limit, a missing EN or 中文.
- `scripts/build-it.test.mjs` (node test) and a gate in `scripts/check.mjs` that runs `checkModel` on every model.

**DONE WHEN:** `check.mjs` is green with Little Rocket, and turns red on a test model with a floating brick, an overlap, a 5-piece Easy step and a missing 中文 tip.
