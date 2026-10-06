# Slice 06 — A flat-fold paper model

**Approved by Papa, 2026-10-06** (audit C3, engine part). Implements design.md O8, O9 (gate).

**Depends on:** slice 01 (`origami-fold.js`); slice 05 for the notation the new drawing reuses.

## Changes
- `js/vendor/origami-atelier/origami-paper.js` (new). Pure: no DOM. Paper coordinates: the start
  sheet is the unit square, y down.
  - State: `{ facets: [{ id, poly, face: "front" | "back", layer }], creases: [[a, b], …] }`.
    `start(model)` → one facet, face from `model.paper.startFace` (default `"front"`).
  - `apply(state, fold)` → `{ state, motion }`, where `motion` names the moving facet ids, the line
    and the kind, for the engine to animate. Ops:
    - `valley` / `mountain` `{ line: [a, b], move: p, layers? }` — facets on `p`'s side are cut by
      the line; the moving pieces are reflected, faces swap, layer order reverses. Valley puts them
      above the current top, mountain below the current bottom. `layers: "top"` moves only the
      moving-side facets in the uppermost layer at `p`; `"bottom"` the lowermost; default all.
    - `precrease { line, move }` — state unchanged, crease added; `motion` folds and reopens.
    - `flip` — mirror across the vertical line through the middle, faces swap, layer order reverses.
    - `rotate { deg }` — around the middle.
    - `keyframe { to: { [facetId]: poly } }` — hand-drawn target; every target has the same vertex
      count as its facet now.
    - `finish` — state unchanged.
  - `replay(model, upTo)` → the state before step `upTo` (memoised per model).
  - `area(state)` → the sum of facet areas (stays 1).
- `js/vendor/origami-atelier/origami-engine.js` — when every step of the model has `fold`, the
  picture comes from `replay()`: one `<path>` per facet, sorted by layer, front/back fill, a thin
  darker edge. Moving facets use the slice 01 hinge (valley in front, mountain behind); `keyframe`
  facets animate CSS `d`. The arrow is derived as in slice 01. Fixed scale and place per model: the
  start sheet fills the box. The finish step shows the final state two-tone. Models without `fold`
  keep the template path.
- `scripts/origami-paper.test.mjs` (new): diagonal fold → 2 facets, outline half the square, area 1;
  two folds → layer order right for valley and mountain; `layers: "top"` moves one layer;
  `flip` swaps faces and reverses order; `rotate 180` twice = start; keyframe with a wrong vertex
  count throws.
- `scripts/check.mjs` — data gate for every model with any `fold`: every step has one; replay runs;
  area 1 ± 1e-6 after every step; every valley / mountain / precrease line cuts the current paper
  (both sides non-empty); keyframe targets exist for every facet they name.
- `sw.js` — precache `origami-paper.js`, bump `CACHE_NAME`; `npm run build:android-web` if needed.

**DONE WHEN:** `node scripts/check.mjs` green (runs `origami-paper.test.mjs`, gate vacuous until
slice 07 adds data); `python scripts/check-origami-ui.py` passes (template models unchanged).
