# Origami Atelier — fold animation & clarity audit

Date: 2026-10-05. Read-only audit: no code changed. Status: **reviewed by Papa 2026-10-06** —
C1, C2, I2, N2, then I1 + the C3 pilot on the six ★ models are approved, and the loop rests after
4 loops. See [design.md](design.md) and slices 01–07. The rest of the table below is not approved yet.

Evidence:
- `python scripts/check-origami-ui.py`: **all PASS** (controls, loop, pause/resume, layout, bilingual step text, reduced motion).
- [fold-frames.png](fold-frames.png): 13 steps from 5 models, 6 frames each (start, 30 %, 58 % and 90 % through the fold, the hold, the fade back). Rebuild it with `python fold-frames.py out.png`.
- A script walked all 275 steps of the 28 models through `diagramFor()` and checked whether each step starts on the shape the previous step ended on.

## Summary

| | Score | Why |
|---|---|---|
| Controls & layout | **8 / 10** | Pause/Resume, Replay, Back, Next, "Step X of Y", 52 px targets, no scroll, reduced motion. All verified by the browser check. |
| Animation quality | **3 / 10** | The flap **slides and spins around its own centre**. It never hinges on the fold line. 62 of 275 steps don't move at all. |
| Clarity (can a kid fold along?) | **3 / 10** | The diagrams are ~40 generic templates matched by **substring of the diagram name**. They don't follow the paper. 118 steps start on a different shape than the last step ended on. Arrows often contradict the text. |

The step text is the strongest part. It is bilingual, short and mostly accurate. The pictures work against it. A kid who watches instead of reads will fold the wrong thing. This is the opposite of the "watch first, then copy the fold" promise on the prep screen.

What the engine really is: a 2D SVG diagram. Each step has one base polygon, one "flap" polygon that moves with `translate + rotate` around its own bounding-box centre (`transform-origin:center`), a dashed crease line, an arrow, and an "after" silhouette that fades in. It has no paper model, no layers and no state carried between steps. So there is no camera, physics, collision or real 3D to audit. Those parts of the brief don't apply (see "Out of scope").

## Findings

### F1 — A fold is drawn as a slide, not a hinge (critical, every moving step)
`origami-engine.js` L289–306. The flap translates by `dx,dy` and rotates by `rotate` around its own centre. Real paper reflects across the crease line. In fold-frames.png:
- **Little Fox #1** ("Bring the top corner to the bottom corner"): the paper is a square, not a diamond. The lower-left triangle drifts up and to the right and sticks out past the paper at 58 %. The arrow points up-right. Then the result snaps to a downward triangle.
- **Paper Boat #1** (fold in half top to bottom): the top half slides down as a flat rectangle without flipping, overlaps the bottom half, then vanishes.
- **Crane #5** (square base): a triangle slides right, then the whole sheet jumps to a small square.

### F2 — Diagrams don't follow the paper (critical, 118 of 248 non-finish steps)
`diagramFor()` L73–191 picks a template by `name.includes("left")`, `"top"`, `"tip"`… Most steps fall through to the same diamond→kite template. Only 86 distinct pictures exist for 275 steps.
- **Little Fox #2** ("Fold the left corner upward"): step 1 ended on a triangle, but step 2 starts on a diamond. The arrow points **right**, not up.
- Templates for `…right` steps go **kite → diamond**, so the paper gets wider after a fold.
- **Crane #9 petal fold** and **#13 inside-reverse** look almost the same: a triangle slides along the axis. Neither shows a layer opening.
- **Lotus** steps 7–11: five identical `petal-invert` pictures.
- **Fox and Cat finish** use the identical polygon (`FINISH_SHAPES` L31–32).

### F3 — 62 steps have no motion (critical for precreases)
Every `…-open` precrease, `diag-mark`, `center-mark`, `diag-cross`, `petal-soften` and every finish step has no flap. `show()` then creates no animations, so `hasMotion` is false and **Pause/Play is greyed out**.
- **Crane steps 1–4** (fold and reopen ×4) show a still square with one dashed line. "Fold and reopen" is never shown.
- `extraCrease` is drawn but never animated.

### F4 — Valley and mountain look the same (important)
`step.operation` (valley-fold ×114, mountain-fold ×7, inside-reverse ×15, petal ×11…) is **never read by the engine**. Every crease is the same dashed rose line and every arrow is the same arrow.
- Standard notation that kids meet in books (valley = dashes with a full arrowhead and the flap in front; mountain = dash-dot with a half arrowhead and the flap behind) is missing.
- The data contradicts itself too: Cat #6 "Fold the bottom point **backward**" is tagged `valley-fold`, and Heart #8 (finish) is tagged `valley-fold`.

### F5 — Paper colours lie (important)
- The moving flap is filled with the **back** colour from frame 0, before it has turned over.
- After the fold, the result is a single **front**-colour silhouette. The folded layer that shows white on real paper disappears.
- The kid's real paper is two-tone and the screen is one colour, so "compare with your paper" doesn't work.
- `flip` (Fish #6) is a 180° spin of a symmetric diamond, so start and end look the same. It can't be told apart from `rotate-180`.

### F6 — Timing (important)
- No step sets `durationMs`, so all 275 folds take 1850 ms: the first valley fold and the dragon's crimp alike.
- The finished shape holds for **500 ms**, then fades back over 250 ms. A kid looking down at their own paper misses the result.
- The loop runs forever (design D2). That is fine while watching. A kid folding for 3 minutes leaves an SVG transform animation running, which repaints on the main thread and costs some battery.

### F7 — Technique words without teaching (important)
- "Inside-reverse" appears in 20 steps, "petal" in 10, "squash" in 6, plus crimp, rabbit-ear, blintz and pleat. Nothing defines them.
- The library skill chips name the techniques but never explain them.
- The first models that use them (Penguin and Whale ★★ for inside-reverse; Crane ★★★★ for petal) give no first-time introduction.

### F8 — Content accuracy (needs a real-paper pass)
- **Crane 11–12** narrow one side only. A real crane narrows both sides (flip and repeat). The kid's crane will have one fat side.
- **Jumping Frog #1** says "Fold the **top section** diagonally". That is wording from the index-card frog, but `paper.shape` is square.
- **Boat** is ★★ but has a pocket-open squash at step 8. **Fish** is ★ and has a flip.
- These came from reading the text only. Each model needs one fold-along with real paper.

### F9 — Bilingual gaps (small, but the invariant says a bug)
- `~${model.minutes} min` on library cards is English in 中文 mode (`origami-atelier.js` L98).
- Paper colour names ("Sakura"…) are EN-only aria-labels. So are the SVG `aria-label` "Origami folding diagram" and the locale switch's `aria-label="Language"`.
- The 中文 step text mixes 折 (237×) and 摺 (104×), sometimes in one model ("對角摺" in the frog vs "折" in the fox). The UI says 摺紙, 摺線.

## Out of scope (brief items that don't fit this game)
- **"You folded the wrong layer" / alignment errors.** The kid folds real paper beside the tablet. The app can't see it, and the camera is off-limits by the same reasoning as music-room D2. The honest equivalent is a clear result frame to compare against (F5, F6).
- **Camera pans, zoom, gravity, collision, 3D thickness.** Origami books teach with flat 2D diagrams, and a correct 2D diagram is what kids can copy. Going 3D (Three) would cost far more and read worse on a tablet.
- **60 fps / memory / load.** Each step runs about 10 WAAPI animations on SVG. `destroy()` cancels them and no listeners leak. The data file is 150 KB. This was not measured on an Android 8 tablet, but it is not where the problems are.

## Fixes, prioritised

| # | Fix | Solves | Effort |
|---|---|---|---|
| **C1** | **Hinge fold in the engine.** Reflect the flap across the crease line: `translate(c)·rotate(θ)·scale(1,s)·rotate(−θ)·translate(−c)`, with `s` going 1 → −1. Front colour until `s = 0`, back colour after. The folded flap **stays** on the result. Mountain = the flap goes behind the base. | F1, F5 | 5 h |
| **C2** | **Fold-and-return for precreases.** A precrease step folds, holds, unfolds and leaves the crease drawn. Play is enabled. | F3 | 2 h (after C1) |
| **C3** | **Diagrams that follow the paper.** Replace substring templates with a small flat-fold model: the sheet as polygons with a face (front/back) and a layer index, each step a fold line + side + valley/mountain. Simple ops (valley, mountain, precrease, flip, rotate, blintz, unfold — 176 steps) are computed. Complex ops (squash, petal, reverse, rabbit-ear, pleat, crimp, collapse, spread, tuck — 72 steps) get hand-drawn keyframe states. A check asserts that every step starts where the last ended. | F2, F4, F5 | Engine 16–24 h; data ≈ 1 h per simple model, 3–4 h per complex model. **Pilot: the 6 ★ models (42 steps) ≈ 8 h.** |
| **C4** | **Fix the 9 data issues in F8 and F4** (crane both sides, frog wording, cat/heart operations), after a real-paper fold-along. | F8 | 2 h + Papa's paper time |
| **I1** | **Notation & legend.** Valley `- - -` with a full arrowhead; mountain `-·-·` with a half arrowhead; a turn-over symbol (looped arrow) for flip and a circular arrow for rotate. The legend shows only what the step uses. | F4, F5 | 3 h |
| **I2** | **Timing.** Lead 600 ms, fold 1800 ms for simple and 3000 ms for complex ops (taken from `operation`, overridable with `durationMs`), **hold 2000 ms**, reset 400 ms. After 4 loops it rests on the result with "▶ Watch again" (amends D2, Papa's call). | F6 | 1.5 h |
| **I3** | **Technique cards.** The first time a kid meets inside-reverse / petal / squash / rabbit-ear / pleat / crimp / blintz, a short card shows a looping mini demo before the step. It is remembered per kid. | F7 | 6 h (needs C1) |
| **I4** | **Real finished pictures.** One code-drawn SVG per model (fox ≠ cat), shown two-tone on the finish step and the shelf. | F2 | ≈ 30 min × 28 = 14 h |
| **N1** | **🐢 Slow switch** (×1.6). One button, not a slider: tablet-first, fewer choices. | — | 1.5 h |
| **N2** | **Bilingual pass.** "~N min", colour names, aria-labels; 摺 used everywhere for folding. | F9 | 1.5 h |
| **N3** | **Drag to scrub** through the fold while paused. | — | 3 h |

Suggested order: **C1 → C2 → I2 → N2** (≈ 10 h, every step gets clearer, data untouched). Then **C3 pilot on the 6 ★ models + I1** (≈ 11 h). Papa folds those 6 with real paper. If they work, the remaining 22 models go one slice each. C4, I3 and I4 follow.

## New strings needed (EN + 繁體中文)

| Key | EN | 中文 |
|---|---|---|
| valley | Valley fold — fold toward you, the paper makes a V | 谷摺：往自己這邊摺，紙會變成 V 字 |
| mountain | Mountain fold — fold away from you, the paper makes a ^ | 山摺：往後面摺，紙會像一座山 |
| flip | Turn the paper over | 把紙翻到背面 |
| rotate | Turn the paper around | 把紙轉個方向 |
| precrease | Fold, press, then open again | 摺好、壓一壓，再打開 |
| inside-reverse | Inside reverse fold — push the point inside between the layers | 內反摺：把尖角往兩層紙的中間推進去 |
| petal | Petal fold — lift one layer up like opening a flower | 花瓣摺：把一層紙往上掀開，像花打開一樣 |
| squash | Squash fold — open the flap and press it flat | 壓平摺：把紙層打開，再壓平 |
| rabbit-ear | Rabbit-ear fold — pinch two sides together into a point | 兔耳摺：把兩邊捏在一起，摺出尖角 |
| pleat | Pleat — fold forward, then back, like a step | 階梯摺：先往前摺，再往後摺，像樓梯 |
| watch-again | ▶ Watch again | ▶ 再看一次 |
| compare | Does your paper look like this? | 你的紙是這個樣子嗎？ |
| slow | 🐢 Slow | 🐢 慢慢看 |
| minutes | ~{n} min | 約 {n} 分鐘 |
| new-technique | New fold! | 新的摺法！ |

## Acceptance criteria (after fixes)
- Every moving step hinges on its crease line. No frame shows paper outside where real paper could be. This is checked by a frame test in the style of fold-frames.py.
- Every step starts on the shape the previous step ended on. This is a `check.mjs` data gate.
- Precreases visibly fold and reopen. No step except finish has Play greyed out.
- Valley and mountain differ in line, arrow and which side the flap passes. Flip shows the colour change.
- The result holds for at least 2 s and shows two-tone layers.
- Every kid-facing string exists in EN + 中文 (F9 closed). Technique words are defined the first time they are used.
- `scripts/check-origami-ui.py` still passes. All 28 models open and finish (no regression).
- Papa folds the 6 ★ models with real paper using only the animation, and they come out right.
