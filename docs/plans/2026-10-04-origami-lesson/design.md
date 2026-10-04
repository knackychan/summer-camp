# Origami Atelier — lesson screen rework (no scroll, looping fold, clearer steps)

Status: the spec came from Papa on 2026-10-04 ("Origami Atelier UX/UI Rework"). D1–D4 restate it.
D5–D10 are implementation choices made while building it and **need Papa's review**.
Slice: [01-lesson-rework.md](01-lesson-rework.md).

## Problem

The v0.2.0 lesson screen (two columns: diagram + buttons left, step text right) scrolled on
tablet frames. The fold played once per Replay tap. The step text sat in a side panel that was
easy to miss, and the buttons were below the fold.

## Decisions

**D1 — The lesson fits the frame.** No scroll at 1280×600, 1024×768 or 1280×800: one panel holds
the step badge, legend, instruction, hint, diagram, controls and progress dots. The diagram takes
whatever height is left. Every other Atelier screen (home, library, prep, shelf) still scrolls
as before.

**D2 — The fold loops on its own.** Each step starts playing as soon as it renders and repeats
forever. A cycle is: 400 ms unfolded start (arrow and crease light up), the fold (the step's
`durationMs`, default 1850 ms), a 500 ms hold on the folded shape, then a 250 ms fade back to the
start. That makes a 3000 ms cycle for a default step.

**D3 — One big Pause / Resume button.** Green, 64 px, first in the row. Pause freezes the fold
mid-move. Resume carries on from that same frame. Replay restarts the cycle, and so do Back and Next.

**D4 — Clearer step.** The badge reads "Step X of Y" / 「步驟 X / Y」. The instruction is
20–26 px bold. The hint is smaller and clamped to two lines (pre-readers don't see it). A small
legend (dashed fold line / arrow) shows only the parts this step's diagram has. The arrow gets a
pulsing glow while it moves. The crease is now drawn in a stronger colour.

**D5 — Pure Web Animations, no timers.** The flap, the base, the folded shape, the arrow, its
glow and the crease each get one infinite `element.animate()` with the same duration. Pause and
resume are `animation.pause()` / `play()`. A `setTimeout` loop could not freeze mid-fold or
resume from the exact frame. The swap to the folded shape is done with a new `oa-paper-after`
polygon whose opacity animates, instead of rewriting `points` from a timer.

**D6 — Layout by frame shape.** Wide frames (≥ 900 px and aspect ≥ 3:2, e.g. 1280×600, 1280×800)
use two columns: the diagram on the left, the words and controls on the right, with the controls
at the bottom where thumbs reach. Narrower frames (1024×768) use one column with the controls in
a single row. At ≤ 560 px, Pause takes its own row. The cat companion becomes a small overlay in
the diagram's corner and hides on frames shorter than 620 px.

**D7 — Secondary buttons are 52 px, not 40.** The spec asked for 40 px secondaries but also for
"all ≥ 48 px". The 48 px floor wins, because this is a tablet-first app.

**D8 — Reduced motion waits for Play.** With `prefers-reduced-motion`, the fold doesn't
autoplay. It rests on the start frame (arrow showing) and the button reads "▶ Play / 播放". The
loop runs only once the kid taps it.

**D9 — Edits in `js/vendor/origami-atelier/`.** `js/CLAUDE.md` says not to edit `js/vendor/`.
That rule is about third-party code (Three.js). The Atelier is our own adapted package, and this
spec names its files. `js/games/origami.js` no longer calls it "kept unchanged". The home screen's
"Continue" button is renamed from `data-action="resume"` to `"continue"` so `resume` can mean
the fold.

**D10 — Every Atelier screen fits the frame (added 2026-10-04, after Papa saw the home screen
still scrolling).** `.oa-root` is pinned to the frame on every screen. The home scene shrinks
to the space left above a compact action bar. "Continue <model> · Step X / Y" moved from its own
panel into that bar. The "Back to Summer Quest" button is gone, because the host's
"← Games 遊戲" already does that, matching Brick Lab. The library grid, the category list and the
shelf scroll inside their own panels; the page never scrolls. The prep preview flexes. The topbar
kicker hides on frames ≤ 820 px tall. The kicker's 折り紙工房 was Japanese; it is now 摺紙工房.

**D11 — No home screen (Papa, 2026-10-04).** The Atelier opens straight on the model library,
now titled "Origami Atelier / 摺紙工房". The home screen's jobs moved there: "My Collection" is a
topbar button, and "▶ Continue <model> · Step X / Y" is a strip above the level filter. The
library has no in-app ← button; the host's "← Games 遊戲" leaves the game. Back from the shelf or
"You Did It!" returns to the library. The home markup, its scene CSS and `blossomMarkup()` were
removed from the vendored files, which supersedes the home-screen part of D10.

## Not done / known gaps

- The optional idea of fading the instruction text during the fold was skipped, because it
  costs readability.
- At 1024×768 the diagram box is about 50 % of the viewport height (about 55 % of the game
  frame). That is below the spec's 60–70 % target, which the topbar and a two-line instruction
  make hard to reach in one column. Changing the 2-column threshold to include 4:3 would reach
  it, but the spec asked for one column there.
- No stars and no score. Origami stays a creative tool.
