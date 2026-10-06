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

**Built 2026-10-06; waiting on the checkpoint.** The six models are on the paper model, written by
[pilot-folds.mjs](pilot-folds.mjs) (re-runnable; creases are worked out from named corners so they
meet exactly; the other 22 models come out byte-identical). Strip:
[fold-frames-07.png](fold-frames-07.png) (`python fold-frames.py out.png pilot`), reviewed. Checklist
for Papa: [foldalong.md](foldalong.md), with the five questions only real paper can answer.
`check.mjs` green with the slice 06 gate on all six; `check-origami-ui.py` 78/78 — new: each pilot
model is drawn from the paper model, every step starts where the last one ended (±1 px, measured on
the facets' real corners), all but the finish play, Cat Face 6 lands behind the paper. Cache
`v189-origami-pilot`.

As built:
- Every model starts as a diamond (`startRotate: 45`), white side up (`startFace: "back"`), and
  step 1's hint says "Start white side up".
- Words changed where the paper disagreed (EN + 中文 together); `foldalong.md` lists each model's
  changes. Step counts: Little Fox 7 → 6, Swimming Fish 8 → 7, the rest unchanged (42 → 40 steps).
- Paper Cup 05 stays a mountain ("down behind the cup"); question 1 of `foldalong.md` asks Papa.
  Paper Cup 06 is a keyframe: from the front the opening cup gets narrower and taller (x × 0.88,
  y ÷ 0.88, base fixed), which keeps the area at 1 for the gate.
- Cat Face: the forehead moved before the ears so the ears can stand above the flat head.
- The fixed view fits everything a model ever shows, not only the start sheet (amends slice 06):
  the rabbit's ears rise above the diamond after its turn.
- The live-lesson checks (loop, Pause, Replay, language switch, rest, hinge on step 1) now open
  Samurai Helmet, a template model whose first two steps are hinge folds as Little Fox's were;
  `NOTATION` reads the pilot models through the paper path (Swimming Fish's flip is step 5 now).
- Swimming Fish is the weakest of the six (the kite's narrow point makes a thin tail); flagged to
  Papa rather than redesigned.
