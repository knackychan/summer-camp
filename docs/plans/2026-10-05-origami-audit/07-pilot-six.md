# Slice 07 — The six ★ models on the paper model

**Approved by Papa, 2026-10-06** (audit C3 pilot). Implements design.md O1 (pilot), O9.

**Depends on:** slices 05, 06.

## Changes
- `js/vendor/origami-atelier/origami-data.js` — a `fold` on every step of Little Fox (7 steps),
  Dog Face (6), Cat Face (7), Swimming Fish (8), Rabbit Face (6), Paper Cup (7), and
  `paper.startFace` on each. Lines are in the current state's coordinates.
  - Where the motion and the words disagree, fix the words (EN + 中文 together), e.g. Little Fox 01
    ("top corner to bottom corner" needs the sheet shown as a diamond, or the words change) and 02
    (ear "upward").
  - Fix operation tags the paper model shows to be wrong. Paper Cup 05 says "Turn over and fold…"
    but is tagged `mountain-fold`: either a `flip` step and a valley, or keep the mountain and drop
    "Turn over" — whichever Papa's paper agrees with.
  - Paper Cup 06 `spread-top` is a `keyframe` (the pocket opening).
  - Anything else wrong in these six found while drawing them is fixed here; other models stay as is.
- `docs/plans/2026-10-05-origami-audit/fold-frames.py` — takes the six pilot models; the strip is
  saved as `fold-frames-07.png`.
- `docs/plans/2026-10-05-origami-audit/foldalong.md` (new) — Papa's checklist: one row per model,
  "folded from the animation only / came out right / what confused" — filled in by Papa.
- `scripts/check-origami-ui.py` — each pilot model: every step's start outline equals the previous
  step's end outline (± 1 px); Cat Face 06 flap passes behind.
- `sw.js` — bump `CACHE_NAME`.

**DONE WHEN:** `node scripts/check.mjs` green with the slice 06 gate covering all six models;
`python scripts/check-origami-ui.py` passes; `fold-frames-07.png` reviewed; **Papa folds the six
with real paper using only the animation and they come out right** (`foldalong.md` filled in). That
is the checkpoint: only then are the other 22 models planned, one slice each.
