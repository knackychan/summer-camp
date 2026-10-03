# Kitchen Quest v0.8 — the v0.6 counter feel, in pixel art

Requested by Papa, 2026-10-03: the integrated kitchen "is not working as intended as before" in the standalone `Kitchen-Quest-v0.6.0`; keep the same feel, keep it pixel art, run it full screen without the left rail. Supersedes the v0.7 tab layout of [03-tablet-layout.md](03-tablet-layout.md); the v0.7 domain ([02-v07.md](02-v07.md)) is kept as is.

## What was lost in the port

The v0.7 port turned the counter into a form: the dish was a list of buttons, the scene a small static picture redrawn ten times a second, and the grill/board/oven were tabs that hid the food. None of the v0.6 placement feel (snap → contact → squash/flap → settle, material sounds, captions) survived.

## Shipped

- **One live counter in the middle** (`js/games/kitchen/scene.js`, Canvas 2D, nearest-neighbour pixel sprites from `sprites.js` on the Pixel Planet palette). Food flies from the tapped tray and lands on a big plate with the v0.6 springs: patty thump, cheese corners flap, tomato/pickle slide, lettuce edges flutter, sauce squish, lower layers react, plate bounces. Captions THUP! FLOUP! PLIP! FRFF! POP! SPLOUIT! and pixel crumbs; bun lid drops on serve with YUM!, then the plate slides out.
- **Tap the real food** to remove that layer (alpha-mask hit test with a one-pixel finger grace). Ticket rows are the same removal targets. No Undo button, as in v0.6.
- **Customers** walk in, bounce, ring the bell, wait behind the counter with a meal bubble (A/B, ★ for a custom request), cheer when served and walk out. Tap a customer to cook for them.
- **Stations open in the middle**, as in v0.6: grill (two pans, flames, steam, flip hop, timers), chopping board (knife, slices, cut pips), oven + layered baking dish. The strip on top always shows the plate, both pans, board and oven with live status and meters; anything needing attention pulses.
- **Layout:** strip · ticket | counter | orders + shift goals · seven ingredient trays (stock badges; the tray the recipe needs next glows) · Start over / hint / SERVE IT!. Mode, Cookbook and Pause sit in the host's top row; Served/Best in its stat row. Prep planner is the fifth station view.
- **Sound:** v0.6 procedural foley ported to `audio.js` (+ chop, flip), bounded voice pool, honours the app's mute via a new additive `ctx.isMuted()`.
- Reduced motion keeps fast placement and tiny contact feedback only. Model, recipes, progression, prep and stock rules unchanged.

## DONE WHEN

- `node scripts/check.mjs` green apart from issues outside Kitchen.
- `python scripts/check-kitchen-counter-ui.py` — at 1280×800 and 1280×600 with touch: full screen, no page scroll, every control ≥ 44 px on screen and unobstructed; real raw-patty → flip → collect, cheese contact + FLOUP!, tap-the-food removal, serve + YUM!, next customer arrives, customer tap selects, board/oven/prep views, CHOP, cookbook and pause; zero page/console errors.
- Physical tablet and Chrome 138 checks remain a device step (this build uses only Canvas 2D, ResizeObserver and existing CSS).

The older UI harnesses (`check-kitchen-quest-ui.py`, `check-kitchen-v07-ui.py`, `check-kitchen-tablet-ui.py`) drive the retired tab layout; `check-kitchen-counter-ui.py` replaces them for the UI. `pixel-art.js` stays for its unit test.
