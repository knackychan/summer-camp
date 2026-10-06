# Slice 11 — Technique cards

**Approved by Papa, 2026-10-06** (audit I3, F7). Implements design.md O13.

**Depends on:** nothing (cards sit over the lesson stage).

## Changes
- `js/vendor/origami-atelier/origami-techniques.js` (new) — one entry per technique
  (inside-reverse, outside-reverse, petal-fold, squash-fold, rabbit-ear, pleat, crimp, blintz): name
  and meaning (EN + 中文) and a mini demo — a few shapes, each with a face and keyframe outlines of
  the same point count, animated through CSS `d` on a loop with a hold. `techniqueFor(step)`.
- `js/vendor/origami-atelier/origami-atelier.js` — on a technique step the kid hasn't seen, the
  card covers the stage and the fold waits; "Got it ▶ / 我懂了 ▶" marks it seen and starts the
  step. The legend chip on technique steps shows the name and meaning and reopens the card. Next,
  Back and the language switch always work (the card re-renders in the other language).
- `js/vendor/origami-atelier/origami-storage.js` — `techniquesSeen: {}` (additive).
- `js/vendor/origami-atelier/origami-atelier.css` — the card, the chip.
- `scripts/origami-techniques.test.mjs` (new): every technique has EN + 中文 name and meaning,
  every demo shape's keyframes have equal point counts, every operation in the data that needs a
  card has one.
- `scripts/check-origami-ui.py` — Penguin's first inside-reverse shows the card once with a running
  demo; Got it starts the fold and the card doesn't come back on the next visit; the chip reopens
  it; 中文 card text; the card fits at all three sizes; Next works with the card open.
- `sw.js` — precache `origami-techniques.js`, bump `CACHE_NAME`.

**DONE WHEN:** `node scripts/check.mjs` green; `python scripts/check-origami-ui.py` passes; a
strip of the eight demos reviewed.
