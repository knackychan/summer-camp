# Kitchen Quest v0.8 — readability pass

Requested by Papa, 2026-10-03: the counter screen was "cluttered, too much text, hard to see what's going on". Show **only English or only 中文** with a button to switch, cut the text, and make the food icons bigger and easier to spot and tap. Builds on [04-counter-feel.md](04-counter-feel.md); model, recipes, timers, scoring and the counter scene's motion are unchanged.

## Decisions

- **D1 — One language on screen at a time.** Every kid-facing string still ships EN + 繁體中文 (the bilingual invariant is about *shipping* both). Kitchen Quest now *shows* one. A switch in the host setbar is labelled in the language it switches to ("中文" / "English"), so a child who reads only that one can find it. The choice is saved per kid in `settings.kitchen.lang[kid]` and defaults to English. It covers the DOM, dialogs, the host HUD labels, aria-labels, the canvas words (FLIP!, READY!, BURNT, TRAY, ON THE GRILL, Next customer soon — FLIP!/READY!/BURNT/TRAY were English-only before) and *Listen*, which now reads the recipe aloud in the chosen language only. Sound-effect captions (THUP!, YUM!…) stay as they are.
- **D2 — Say only what needs attention.** Removed: the "Start at 1 · add each row in order" line, the "Add next / Then / Tap to remove" note under each recipe row (the highlight already shows the next row), the ticket footer that repeated the bottom hint, the "Serve anyone, in any order" note, the "Cooking here" prefix, the explanatory notes under the grill, board and prep views, the "Pan 1/2" labels, the "Pantry / Ready" tray captions, the "∞" badge on pantry trays and the 1–7 key numbers on trays (the keyboard shortcuts still work). Notes kept: "On the grill" and "Wrong food" on recipe rows, "Grill it / Chop more / Bake more" on trays that need it.
- **D3 — Shift goals move into the cookbook.** The shift goals sat under the orders all the time. They now open with the cookbook, which already pauses cooking.
- **D4 — Event messages are brief.** The line under the hint (e.g. "Flipped!") clears after 4.5 s, so one line of guidance stays.
- **D5 — Big food icons.** The side-view layer sprites are 4–10 px tall and showed up as thin lines on trays. `sprites.js` adds chunky 20 × 20 top-down icons (`iconURL`) for patty, raw and burnt patty, cheese, tomato, lettuce, pickles, sauce, lasagna, pasta and the pan, each a distinct shape and colour. Trays put a 60 px icon (44 px on 600 px-tall screens) next to the name; recipe rows use 44 px. The counter scene still draws the side-view sprites.

## DONE WHEN

- `node scripts/check.mjs` green.
- `python scripts/check-kitchen-counter-ui.py` passes, including the new checks: English by default with no Chinese on the kitchen screen, the 中文 switch shows Chinese only on every tray and no English food words, the choice is saved for the kid, and switching back is English only. The 44 px / no-scroll / on-screen checks still pass at 1280 × 800 and 1280 × 600.
- Physical tablet check remains a device step.
