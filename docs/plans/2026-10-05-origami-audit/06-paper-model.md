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

**Shipped 2026-10-06.** `origami-paper.js` + `scripts/origami-paper.test.mjs` (9 tests); the engine
draws a model whose steps all carry `fold` from `replay()` (`show(step, { model })`, the Atelier
passes the model); `check.mjs` paper gate (vacuous until slice 07); `check-origami-ui.py` 71/71 —
`EVERY_STEP` now passes the model, and 9 new checks run the paper path on a synthetic 7-step model
(valley, mountain, precrease, flip, rotate, keyframe, finish): facets not templates, each step starts
on the outline the last one held (±1 px), Play on every step but the finish, notation per op, the
moving part keeps its face until edge-on and lands face-swapped in reverse order (valley, mountain,
flip), the keyframe morphs `d`, the finish shows both faces. Cache `v188-origami-paper`; Android
payload rebuilt.

As built, differing from the text above:
- No `creases` list in the state: a precrease leaves the state unchanged and its thin crease mark
  shows on its own step only. Carrying creases through later folds means folding them with the
  layers; left for the rollout if a model's words lean on an earlier crease (crane).
- `replay(model)` returns every step's `{ before, after, motion }` (memoised) instead of
  `replay(model, upTo)`; the area is `stateArea(state)`; `bounds(state)` and `isPaperModel(model)`
  are exported for the engine.
- † `model.paper.startRotate` (degrees) turns the start sheet, e.g. 45 for a diamond, so Little Fox
  01 "top corner to bottom corner" can be drawn as the words say (slice 07).
- The engine draws three stacks: what folds behind (mountain), the paper that stays, what folds in
  front (valley, flip, precrease). A mountain with `layers: "top"` therefore lands behind the whole
  paper, not between layers — none of the six pilot models needs that.
- Keyframe steps have no arrow; on the reset their shapes blink back to the start instead of
  morphing backwards (which would look like an unfold).
- For slice 07: the live-lesson checks (`FLAP_T`, `HINGE`, `NOTATION`) read `.oa-paper-flap` on
  Little Fox 1 and Cat Face 6. Once those models are on the paper model the checks must read the
  paper groups (`.oa-paper-model > g`) or move to a template model.
