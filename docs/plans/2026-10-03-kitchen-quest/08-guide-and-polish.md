# Kitchen Quest v0.8 — guide and polish pass

Papa picked suggestions 4–9 from the 2026-10-03 review ("go with 4 and beyond"). Builds on [07-lasagna.md](07-lasagna.md). Gameplay rules unchanged. Suggestion 10 (the three retired v0.7 UI harnesses) is left for Papa to decide; nothing was deleted.

## Decisions

- **D1 — The grill uses the big prompt too.** On the grill view the centred blinking prompt says **FLIP!** or **TAKE IT OUT!** for the pan that needs a hand soonest ("FLIP PAN 2!" only when both pans are cooking), and a calm "Try again" for a burnt patty. Over the pans the canvas now shows only the seconds left, so the words aren't said twice. The per-pan buttons stay.
- **D2 — Customers say thank you.** When served, the customer hops and a short bubble types their own thank-you in their voice ("Arr, delicious!", "YUM.EXE COMPLETE.", "好吃到外太空！"…). They wait about a second before walking out so it can be read. EN + 中文 for every line.
- **D3 — Idle stations shrink to icons.** In the top strip an empty grill, an untouched chopping board and an empty oven are small icon buttons; a station that is working shows in full with its status and timer (only the busy pan, not both). An idle station the current dish needs (e.g. no lasagna left) pulses. The plate chip takes the freed width.
- **D4 — A guided first order.** For a kid who has never served a dish, a bouncing pixel glove points at the one thing to tap next: the tray for the next food (Raw patty first), the grill when a patty is cooking elsewhere, the wrong layer on the recipe, CHOP or the oven when food has run out, and the big prompt (FLIP!, TAKE IT OUT!, SERVE IT!). It ends after the first serve and is remembered per kid in `settings.kitchen.tutorial[kid]`. **Show me how** in the cookbook turns it back on.
- **D5 — A bigger counter.** The recipe column is now `clamp(170px, 15.5vw, 210px)` and the customer column `clamp(180px, 17vw, 230px)`, giving the counter roughly 70 px more at 1280 px.
- **D6 — Say where missing food comes from.** When the next food has run out, the hint says how to get it: "Bake a lasagna first!", "The lasagna is baking…", "Take the lasagna out of the oven!", "Chop more tomato first!", "Tap Raw patty to grill one." The station it comes from pulses in the strip.

## DONE WHEN

- `node scripts/check.mjs` green.
- `python scripts/check-kitchen-counter-ui.py` passes, including: idle grill and oven are icons at the start; a busy pan shows in full; FLIP and TAKE IT OUT prompts appear on the grill; the served customer says thank you; Show me how turns the guide on and the glove is visible. Earlier checks still pass.
