# Slice 12 — Finished pictures

**Approved by Papa, 2026-10-06** (audit I4, F2). Implements design.md O14.

**Depends on:** slice 06 (paper-model models draw their own last state).

## Changes
- `js/vendor/origami-atelier/origami-engine.js` — `FINISH_ART` replaces `FINISH_SHAPES`: per
  template finish, a list of `[face, points]` polygons plus optional fold lines; the finish step
  draws them two-tone. `finishPicture(model, front, back)` returns an SVG string of the finished
  model: the paper model's last state for the six pilot models, `FINISH_ART` for the rest.
- `js/vendor/origami-atelier/origami-atelier.js` — the prep preview, the "You did it!" screen and
  the shelf slots of made models show `finishPicture` in the kid's paper colours.
- `js/vendor/origami-atelier/origami-atelier.css` — picture sizing in those places.
- `scripts/check-origami-ui.py` — 28 different finished pictures (no two the same), each with both
  faces; prep, complete and shelf show the picture; no page errors.
- `sw.js` — bump `CACHE_NAME`.

**DONE WHEN:** `node scripts/check.mjs` green; `python scripts/check-origami-ui.py` passes; a sheet
of all 28 pictures reviewed.
