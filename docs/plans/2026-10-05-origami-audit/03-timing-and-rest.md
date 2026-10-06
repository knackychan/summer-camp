# Slice 03 — Timing, and rest after 4 loops

**Approved by Papa, 2026-10-06** (audit I2; the rest amends origami-lesson D2). Implements
design.md O5.

**Depends on:** slices 01–02.

## Changes
- `js/vendor/origami-atelier/origami-engine.js`
  - `LEAD_MS 600`, `HOLD_MS 2000`, `RESET_MS 400`. Fold length by `operation`: 1800 ms for
    valley, mountain, unfold, blintz, flip, rotate, shape; 3000 ms for squash, petal, inside- and
    outside-reverse, rabbit-ear, pleat, crimp, collapse, spread, tuck. `step.durationMs` still wins.
  - Precrease cycle: lead 600, fold 1500, hold 600, unfold 1200, hold 800, reset 400.
  - Timing `iterations: 3 + holdEnd / cycle`, `fill: "forwards"`: the 4th loop ends on the result
    hold, no timer. New `resting` getter (all animations finished).
  - `replay()` from rest plays 4 more loops. `snapshot()` returns the absolute time (not the time
    modulo the cycle); `show({ time })` uses it as is, so a language switch keeps the loop count.
  - The origami-lesson comment at the loop constants is updated to point at this plan.
- `js/vendor/origami-atelier/origami-atelier.js` — `syncPlayButton()`: when `engine.resting`, the
  big button reads "▶ Watch again / ▶ 再看一次" with `data-action="replay"`. Listen to the first
  animation's `finished` promise to re-sync (ignore its rejection on cancel).
- `docs/plans/2026-10-04-origami-lesson/design.md` — D2 gets an "Amended 2026-10-06" note pointing
  here (D2 text kept).
- `scripts/check-origami-ui.py` — "Fold loops forever" becomes: iterations ≈ 3.x; after jumping all
  animations to the end the button reads Watch again / 再看一次 and the result is showing; tapping it
  runs again; a language switch at loop 3 keeps loop 3; the hold lasts ≥ 2000 ms.
- `sw.js` — bump `CACHE_NAME`.

**DONE WHEN:** `node scripts/check.mjs` green; `python scripts/check-origami-ui.py` passes with the
new loop checks; reduced motion still waits for Play (D8).

**Shipped 2026-10-06.** Engine: `LEAD_MS 600`, `HOLD_MS 2000`, `RESET_MS 400`, fold 1800 / 3000 ms
by operation, `iterations: 3 + c` with `fill: "forwards"`, `resting`, `onRest()` (latest callback
wins), `snapshot()` keeps the absolute time and `show()` puts a resting fold straight back at rest.
The big button's resting action is `data-action="watch-again"` rather than `"replay"`, so the
secondary ↻ Replay button keeps its own unique selector. `check-origami-ui.py` 52/52 (new: 4 loops
ending on the hold, 2 s hold, loop 3 kept through EN and 中文 switches, rest with 再看一次 and the
folded flap showing, Watch again runs again; reduced motion still waits for Play). `check.mjs` green;
cache `v184-origami-rest`. origami-lesson D2 carries an "Amended 2026-10-06" note.
