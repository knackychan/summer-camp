# Slice 03 — The book and its step pages

Implements design.md B2, B5, B6, B8, B11.

**Depends on:** 01, 02.

## Changes
- `index.html`: a `BOOK_SHELF` entry "Build It! 來蓋吧!" with `layout: "steps"`. Opening it shows the models as cards (level, tags, piece count, ✓ if this kid built it) with the "Only basic bricks" filter. Opening a model uses the book reader: page 1 "What you need 你需要", then one page per step, then a last page with the finished model and "I built it! 我蓋好了!".
- New `js/books/build-it-view.js`: one 3D view per open model (Three via `three-runtime.js`, parts via `brick-meshes.js`): new pieces glow, earlier ones fade; one-finger turn; ⌂; the drop-in animation (off with reduced motion); the step's part callout with icons. It renders only when something changes.
- Per-kid step and the built tick are saved locally the way the other books keep their place.
- `sw.js` and the APK list get the new files; styles in the book CSS (targets ≥ 56 px, no hover).

**DONE WHEN:** a kid can open Little Rocket with the wifi off, go through every step, turn the model, and tick "I built it!"; the place and the tick are remembered after reopening the app, separately for each kid; every string shows EN + 中文; `check.mjs` is green.
