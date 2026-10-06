# Origami Atelier — honest folds (design)

Source: [audit.md](audit.md) (2026-10-05). **Approved by Papa 2026-10-06:** the scope in O1 and the
loop rest in O5. The other decisions restate the audit's fix descriptions that Papa approved; details
marked † were added while writing the slices and are open to Papa's review.

Slices: [01](01-hinge-fold.md) · [02](02-fold-and-reopen.md) · [03](03-timing-and-rest.md) ·
[04](04-bilingual.md) · [05](05-notation.md) · [06](06-paper-model.md) · [07](07-pilot-six.md).

## Problem

The lesson screen works (controls, layout, loop, reduced motion all pass `check-origami-ui.py`), but
the picture lies. The folded part slides and spins around its own middle instead of turning over on
the fold line; 35 non-finish steps don't move at all; pictures are templates picked from words in the
diagram name, so 118 steps start on a different shape than the last one ended on; valley and mountain
look the same; the colours don't match two-tone paper; the result shows for 0.5 s. A kid who watches
instead of reads folds the wrong thing.

## Decisions

**O1 — Scope (Papa, 2026-10-06).** Phase 1 then a pilot:
- Phase 1, data untouched except six operation tags (O7): hinge fold (C1, slice 01), fold-and-reopen
  (C2, slice 02), timing + rest (I2, slice 03), bilingual pass (N2, slice 04).
- Pilot: valley/mountain notation (I1, slice 05), a flat-fold paper model (C3, slice 06) and the six
  ★ models drawn from it (slice 07): Little Fox, Dog Face, Cat Face, Swimming Fish, Rabbit Face,
  Paper Cup — 42 steps.
- **Checkpoint:** Papa folds those six with real paper using only the animation. Only after that
  are slices written for the other 22 models, one model per slice.
- Not approved yet, so not planned: the 22-model rollout, C4 (crane both sides, frog wording),
  I3 technique cards, I4 finished pictures, N1 slow switch, N3 drag to scrub.

**O2 — A fold turns over on its fold line (C1).** The moving part is the paper on one side of the
crease, cut from the shape with a line clip, not a hand-drawn flap. It moves by
`translate(c)·rotate(θ)·scale(1,s)·rotate(−θ)·translate(−c)` with `s = cos(πt)`, going 1 → −1:
points on the crease never move and no frame puts paper where real paper can't be. It shows its
front colour until `s = 0` and its back colour after. It **stays** on the result. A mountain fold
passes behind the rest of the paper. Flip turns the whole sheet over (colours swap); rotate turns it
around (they no longer look alike). The arrow is drawn from the moving part's far point to where it
lands, so it always agrees with the motion. † Keyframes are sampled (16 per fold, linear between)
rather than interpolated between two matrices, because the browser would decompose `s = −1` into a
180° turn. † The flap is transformed in view-box units (`transform-box: view-box;
transform-origin: 0 0`).

**O3 — Operations without a simple hinge keep today's slide for now.** Squash, petal, inside- and
outside-reverse, rabbit-ear, pleat, crimp, collapse, spread and tuck on the 22 template models keep
the current motion until their model's rollout slice gives them keyframes (O8). On the pilot only
the cup's spread uses keyframes. Saying it plainly beats pretending a template hinge is right.

**O4 — Fold-and-reopen (C2).** A precrease step (operation `precrease`, or a diagram ending in
`-open`, `-mark` or `diag-cross`) folds, holds briefly, unfolds, and leaves the crease drawn. †
Without a template flap, the moving side is the side whose middle is further left, or the top side
for a level crease. `diag-cross` folds both diagonals one after the other in one cycle. The one
`shape` step (Lotus `petal-soften`) gets a small lift-and-settle. Every step except finish has Play.

**O5 — Timing, and rest after 4 loops (amends origami-lesson D2, Papa 2026-10-06).** A cycle is:
lead 600 ms, fold 1800 ms (simple ops) or 3000 ms (complex ops, from `operation`; a step's
`durationMs` still wins), **hold 2000 ms**, reset 400 ms. A precrease cycle is lead 600, fold 1500,
hold 600, unfold 1200, hold 800 on the crease, reset 400. After the 4th loop the fold **rests on
the result** and the big button reads "▶ Watch again / ▶ 再看一次", which plays 4 more loops. Pause,
Resume, Replay, Back, Next and reduced motion (D8) keep their meaning. † Done in WAAPI as
`iterations: 3 + holdEnd/cycle, fill: "forwards"`, so it ends mid-cycle on the hold with no timer;
`snapshot()` keeps the absolute time so a language switch keeps the loop count too.

**O6 — Bilingual pass (N2).** "~N min" becomes "約 N 分鐘" in 中文; paper colour names, the diagram's
`aria-label` and the language switch's `aria-label` get 中文. 摺 is used for folding everywhere in
the 中文 step text (the UI already says 摺紙, 摺線). † A `check.mjs` gate keeps 折 out of
`origami-data.js` 中文 text.

**O7 — Notation (I1).** Valley: dashed line, full arrowhead, flap in front. Mountain: dash-dot line,
half arrowhead, flap behind. Flip: a turn-over (looped) arrow; rotate: a circular arrow. A reopened
crease stays as a thin solid line. The legend shows only what the step uses, with a one-line
EN + 中文 meaning. † Six steps whose text says "backward" are tagged `valley-fold` and become
`mountain-fold` in slice 05, because the new notation would otherwise contradict the words: Cat Face
06, Swimming Fish 07, Paper Heart 07, Tulip 04–06.

**O8 — Pictures that follow the paper (C3).** A small pure flat-fold model: the sheet is a list of
facets (polygon in paper coordinates, face front/back, layer). A step's new `fold` field says what
happens: `valley` / `mountain` (line + a point on the side that moves + optional `layers`),
`precrease`, `flip`, `rotate`, `keyframe` (hand-drawn target polygons for complex ops) or `finish`.
Each step's picture is the model's state after the steps before it, so it starts where the last one
ended by construction. A model is either fully on the paper model or fully on templates; the 22
template models keep slices 01–05 behaviour. † Paper is drawn at one fixed scale and place per
model (no re-zoom between steps). † `model.paper.startFace` says which side is up at step 1.
† Keyframe facets are `<path>`s animated through CSS `d`, so WAAPI pause/resume still works.

**O9 — Evidence before the checkpoint.** A `check.mjs` gate replays every paper-model step (area
kept at 1, every fold line cuts the paper, keyframe start = previous end). `fold-frames.py` is
extended to the six pilot models and the strip is reviewed. Then Papa folds.

## New strings (EN + 繁體中文)

| Key | EN | 中文 | Slice |
|---|---|---|---|
| minutes | ~{n} min | 約 {n} 分鐘 | 04 |
| diagram label | Origami folding diagram | 摺紙步驟圖 | 04 |
| language | Language | 語言 | 04 |
| colour names | Sakura, Sky, … | 櫻花粉、天空藍、…(slice 04 lists all) | 04 |
| watch-again | ▶ Watch again | ▶ 再看一次 | 03 |
| valley | Valley fold — fold toward you, the paper makes a V | 谷摺：往自己這邊摺，紙會變成 V 字 | 05 |
| mountain | Mountain fold — fold away from you, the paper makes a ^ | 山摺：往後面摺，紙會像一座山 | 05 |
| flip | Turn the paper over | 把紙翻到背面 | 05 |
| rotate | Turn the paper around | 把紙轉個方向 | 05 |
| precrease | Fold, press, then open again | 摺好、壓一壓，再打開 | 05 |

## Not doing (from the audit's "out of scope")

Wrong-fold detection (the app can't see the paper; no camera, same reasoning as music-room D2),
camera pans, physics, 3D thickness. Flat 2D diagrams are what origami books teach with.

## Phase 2 — the audit's remaining fixes (Papa, 2026-10-06)

**Approved by Papa 2026-10-06** ("take care of that"): C4, I3, I4, N1, N3 — all five, without
waiting for the pilot checkpoint. Details marked † were added while writing the slices.
Slices: [08](08-crane-frog.md) · [09](09-slow.md) · [10](10-scrub.md) · [11](11-technique-cards.md) ·
[12](12-finished-pictures.md). Each ships on its own; none touches the paper model's maths.

**O10 — Content fixes (C4).** Classic Crane narrows **both** sides: its one "fold one lower edge" /
"the other lower edge" pair becomes left edge, right edge, turn over, left edge, right edge
(15 → 18 steps; template pictures as today, design O3). Jumping Frog steps 1–3 lose the index-card
wording ("top section"): it folds a square. The cat and heart operation tags were fixed in slice 05.
Both models still get their real-paper pass in their own rollout slices.

**O11 — 🐢 Slow (N1).** One toggle, not a slider: "🐢 Slow / 🐢 慢慢看", top-left of the picture,
`aria-pressed`. On, every animation of the step runs at ×1.6 time (`playbackRate` 0.625), so the hold
is longer too. † Remembered per kid (`slow` in the Atelier progress store), kept across steps,
models and the language switch; a re-render keeps the loop position.

**O12 — Drag to scrub (N3).** Sliding a finger sideways on the picture moves the fold: it pauses
first if it was playing, then a drag across the whole picture is one loop, left to right is
forward, from wherever it was (relative, not jump-to-finger). Letting go leaves it paused; Resume
carries on from there. Works on the rest frame too. † While paused, the companion line says
"Slide your finger on the picture to move the fold. / 在圖上左右滑動手指，就能前後移動摺紙。" The
picture takes `touch-action: none`; the lesson never scrolls anyway.

**O13 — Technique cards (I3).** The first time a kid reaches a step using inside-reverse, petal,
squash, rabbit-ear, pleat, crimp or blintz († and outside-reverse, 5 steps, equally undefined), a
card covers the picture: "New fold! / 新的摺法！", the name and its one-line meaning (EN + 中文), a
looping mini demo (code-drawn SVG, a few shapes morphing through CSS `d`, the kid's paper colours)
and "Got it ▶ / 我懂了 ▶", which starts the step. Remembered per kid (`techniquesSeen`). † On those
steps the legend chip shows the technique and reopens its card when tapped. A coach, never a gate:
the card never blocks Next or Back. Reduced motion: the demo rests on its end frame.

**O14 — Finished pictures (I4).** The prep screen, the finish step, the "You did it!" screen and the
shelf show a two-tone picture of the finished model in the kid's paper colours instead of the emoji:
for a paper-model model it is the model's own last state; for the 22 template models a code-drawn
picture (silhouette in one face, the folded-over parts in the other, a few fold lines) replaces
`FINISH_SHAPES`, so no two models share a shape. Library cards keep the emoji (small and many).
When a template model moves to the paper model in its rollout slice, its picture comes from the
paper model and the drawing is retired.

| Key | EN | 中文 | Slice |
|---|---|---|---|
| slow | 🐢 Slow | 🐢 慢慢看 | 09 |
| scrub hint | Slide your finger on the picture to move the fold. | 在圖上左右滑動手指，就能前後移動摺紙。 | 10 |
| new technique | New fold! | 新的摺法！ | 11 |
| got it | Got it ▶ | 我懂了 ▶ | 11 |
| inside-reverse | Inside reverse fold — push the point inside between the layers | 內反摺：把尖角往兩層紙的中間推進去 | 11 |
| outside-reverse | Outside reverse fold — wrap the point around the outside of the layers | 外反摺：把尖角翻到外面，包住兩層紙 | 11 |
| petal | Petal fold — lift one layer up like opening a flower | 花瓣摺：把一層紙往上掀開，像花打開一樣 | 11 |
| squash | Squash fold — open the flap and press it flat | 壓平摺：把紙層打開，再壓平 | 11 |
| rabbit-ear | Rabbit-ear fold — pinch two sides together into a point | 兔耳摺：把兩邊捏在一起，摺出尖角 | 11 |
| pleat | Pleat — fold forward, then back, like a step | 階梯摺：先往前摺，再往後摺，像樓梯 | 11 |
| crimp | Crimp — a pleat on both layers of a point, so it bends | 曲摺：在尖角的兩層紙上一起摺階梯，讓它彎過來 | 11 |
| blintz | Blintz fold — fold all four corners to the center | 四角摺：把四個角都摺到中心點 | 11 |
