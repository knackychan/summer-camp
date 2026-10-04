# 01 — Lesson screen rework

Design: [design.md](design.md) D1–D11.
Dependencies: none (Origami Atelier v0.2.0 already registered as game `origami`).

## Files

- `js/vendor/origami-atelier/origami-engine.js`: `OrigamiFoldEngine.show(step, {autoplay, time})`
  builds an infinite WAAPI cycle. New `pause()`, `resume()`, `replay()`, `snapshot()`, `hasMotion`,
  `parts`. New `oa-paper-after` polygon and `oa-arrow-glow` path.
- `js/vendor/origami-atelier/origami-atelier.js`: one-panel lesson markup, `setScreen()` toggles
  `.oa-lesson-mode` and stops the loop when leaving, `syncPlayButton()` swaps between
  `data-action="pause"` and `"resume"`, and a language switch keeps the loop's frame.
- `js/vendor/origami-atelier/origami-atelier.css`: the lesson block (v0.3), two-column media query,
  short-frame and narrow-frame rules.
- `js/games/origami.js`: header comment only.
- `sw.js`: `CACHE_NAME` bumped.
- `scripts/check-origami-ui.py`: new browser check.

## DONE WHEN

- `python scripts/check-origami-ui.py` passes. At 1280×600, 1024×768 and 1280×800 it checks:
  opens on the library (no home screen), library and prep never scroll the page, Continue works;
  no scroll, every control inside the frame and ≥ 48 px, Pause is the biggest control, the fold
  loops and autoplays, the cycle holds after the fold, Pause freezes, Resume continues from the
  frame, Replay restarts, a language switch keeps the paused frame, the step text is bilingual,
  Back autoplays the previous step, reduced motion waits for Play, and there are no page errors.
- `node scripts/check.mjs` is green.
