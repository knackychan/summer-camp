# Kitchen Quest v0.8 — lasagna you can see, and one big prompt

Requested by Papa, 2026-10-03, with a Cook, Serve, Delicious! lasagna screenshot as the reference: make the lasagna layers as obvious as the burger's, make baking a clear SEND TO OVEN / BAKE step that shows the dish going into the oven, and show that button as a prompt kids can easily tap: centred, big and blinking, like SERVE. Builds on [06-customers.md](06-customers.md). Model rules (six layers pasta–sauce–cheese twice, 14 s bake, four portions) are unchanged.

## Decisions

- **D1 — A big glass baking dish.** The oven view draws a glass dish about 44 % of the counter's width. Each layer is a chunky slab: pasta (wavy, golden), sauce (red, with drips), cheese (yellow, with shreds). The newest layer drops in, squashes and says FLOP! / SPLOUIT! / FLOUP!. A faint copy of the layer that goes next pulses at the top of the dish, and a wrong layer blinks a red outline. Tapping any layer in the dish takes it off, as with the burger. "n / 6" sits above the dish.
- **D2 — The bar shows the recipe.** The three ingredient buttons have 44 px icons; the one the dish needs next glows like the burger trays. The six numbered slots show the order, with the next empty slot highlighted; a filled slot is green when right and red when wrong, and tapping it removes that layer. The old Bake button and the "Clear tray" wording are gone (now "Clear").
- **D3 — One centred prompt for the next big step.** A blinking button appears centred just below the counter edge whenever there is one obvious thing to do: **SERVE IT!** when the dish on the plate is right, **BAKE IT!** when the six layers are right and the oven is free, **TAKE IT OUT!** when the lasagna is ready, and a calm, non-blinking "Try again" after a burnt tray. The bottom SERVE IT! button stays where it was.
- **D4 — Into the oven.** On BAKE IT! the finished dish slides into the oven in an arc, shrinking as it goes in, with a thunk; the oven window then glows and bubbles while the timer bar runs. TAKE IT OUT! pops "+4" with a little burst. While it's ready the prompt replaces the canvas "READY!" label so the two never compete.

## DONE WHEN

- `node scripts/check.mjs` green.
- `python scripts/check-kitchen-counter-ui.py` passes, including: the SERVE IT! prompt appears when the burger is right; six taps fill the dish; the BAKE IT! prompt is centred over the counter (within 4 px) and at least 200 × 56 px; tapping it starts baking and empties the tray; when ready, TAKE IT OUT! appears and tapping it adds four lasagna portions. Earlier checks still pass.
