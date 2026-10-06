# Slice 01 — The fold turns over on its fold line

**Approved by Papa, 2026-10-06** (audit C1). Implements design.md O2, O3.

**Depends on:** origami-lesson slice 01 (the looping WAAPI engine).

## Changes
- `js/vendor/origami-atelier/origami-fold.js` (new). Pure: no DOM.
  - `sideOf(p, a, b)` — sign of point `p` against the line `a→b`.
  - `clipByLine(poly, a, b, side)` — the part of a polygon on one side of the infinite line through
    `a, b` (Sutherland–Hodgman against one half-plane).
  - `reflect(poly, a, b)` — mirror a polygon across the line.
  - `hingeMatrix(a, b, s)` — `[a, b, c, d, e, f]` for
    `translate(c)·rotate(θ)·scale(1,s)·rotate(−θ)·translate(−c)`, `c` = midpoint of `a, b`.
  - `hingeKeyframes(a, b, n = 16)` — `n + 1` matrices for `s = cos(πt)`, `t` from 0 to 1, plus the
    index where `s` crosses 0 (the colour swap).
- `js/vendor/origami-atelier/origami-engine.js`
  - Hinge ops: `valley-fold`, `mountain-fold`, `unfold`, `blintz`. The moving side is the side of
    the template flap's centre; moving part = `clipByLine(base, side)`, staying part = the other
    side. The template `after` and `dx/dy/rotate` are no longer used for these steps.
  - The flap polygon animates `transform: matrix(…)` through `hingeKeyframes`, `fill` = front
    until the swap index, back after (discrete). It stays at full opacity on the result through the
    hold, then fades with the reset. The ghost shows the result outline (staying ∪ reflected).
  - Mountain: a second flap polygon placed before the base takes over at the swap index, so the
    flap passes behind.
  - `unfold`: the hinge of the template `after` sheet played backwards.
  - `flip`: the whole sheet hinges across the vertical line through its middle, colours swap.
    `rotate`: the whole sheet turns around its middle by the template's `rotate`, no colour change.
  - The arrow for hinge steps is computed: a quadratic curve from the flap's farthest point from
    the crease to its reflection, bulging away from the crease. Template arrows stay for O3 ops.
  - Every other operation keeps today's slide (O3).
- `js/vendor/origami-atelier/origami-atelier.css` — flap `transform-box: view-box;
  transform-origin: 0 0`; the old `transform-origin: center` goes.
- `scripts/origami-fold.test.mjs` (new): clip a square by a diagonal → two triangles, areas sum to
  the square; reflect twice = identity; `hingeMatrix(s=1)` = identity, `s=−1` = reflection; at every
  keyframe every flap point lies inside the convex hull of flap ∪ reflected flap; points on the
  crease never move; the swap index is where `s` changes sign.
- `scripts/check-origami-ui.py` — Little Fox step 1: at 25 % of the fold the flap fill is the front
  colour, at 75 % the back colour; at 50 % the flap's screen box lies inside the box of
  paper ∪ reflection (+2 px); on the hold the flap is still visible (opacity > 0.9). Every step of
  all 28 models opens with no page error.
- `sw.js` — precache `origami-fold.js`, bump `CACHE_NAME`. Run `npm run build:android-web` if
  `check.mjs` reports the Android payload stale.

**DONE WHEN:** `node scripts/check.mjs` green (runs `origami-fold.test.mjs`);
`python scripts/check-origami-ui.py` passes; `fold-frames.py` re-run shows Little Fox #1, Paper
Boat #1 and Crane #5 turning over on the crease with the flap staying on the result — the strip is
saved next to the old one as `fold-frames-01.png`.
