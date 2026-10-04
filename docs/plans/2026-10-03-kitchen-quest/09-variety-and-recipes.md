# 09 — A different shift every day, honest grill words, eight more dishes

Requested 2026-10-04 (an enhanced prompt in a cloud session); **approval by Papa still pending** — nothing here changes stars, locks or any rule in `design.md`. Depends on 01–08. Ships independently.

## What was wrong (found by reproducing it, not from the prompt's line numbers)

1. **Same shift on every start.** `kitchen.js` built `new KitchenModel(29813, …)` and `new Cast()` (default 29813), so every boot dealt the same customers. Worse, `RecipeDeck` plays the menu in *authored* order first, so every boot began cheeseburger → garden burger → double tomato burger → … for every kid, forever.
2. **The words about a cooking patty never followed the pan.** The ticket row, the customer card, the hint under the counter and the dashed tray on the plate all said "On the grill" / "Patty on the grill: flip, then collect." from the moment the patty was placed until it was collected, even while the pan screamed **TAKE IT OUT!** (reproduced with screenshots: ticket "On the grill" next to a big TAKE IT OUT prompt).
3. **The dashed "ON THE GRILL" tray overlapped the food above it.** It was drawn 12 art-pixels tall but the stack reserved 7 (a patty's thickness), so cheese added on top landed *inside* the tray and covered the label. Also the ticket's status text wrapped to 3–4 lines ("On / the / grill") because the empty ✓ column kept its width.
4. **Recipes:** 9 dishes, three families. The prompt's "lasagna is limited to 6 layers" is the *oven tray* (`LASAGNA_STEPS`, six layers, correct and tested), not a recipe limit; every lasagna dish is one baked portion plus ordinary toppings. No existing recipe was broken.

## Decisions

- **D1 — The deal is a pure function of a text key.** `shiftSeeds(kid, day, totalServed)` → key `luis:2026-10-04:16`, hashed (FNV-1a, `hashSeed` in `motion.js`) into one seed for orders and one for customers. Same key ⇒ identical shift; a new day, another kid, or *one more dish served since the last visit* ⇒ a different one. Mixing in `totalServed` is what stops a second boot the same day replaying the first, without storing anything new. The day comes from the shared Taipei helper (`SQ_DAY.iso()`), handed to the game as `ctx.today()` — no new date code, no ambient read.
- **D2 — Reproducing a shift.** The key is on `root.dataset.seed` and in `snapshot().seed`. Putting a key in `settings.kitchen.seed` replays it exactly (bug reports, UI harnesses). `check-kitchen-counter-ui.py` pins `counter-ui-26` so its flow does not depend on the date.
- **D3 — The guided tour is kept for new cooks only.** The starting menu still opens in authored order until a cook has served `GUIDED_SERVES` (= the number of starting dishes, 5). After that the first bag is shuffled too, and a dish unlocked mid-shift still arrives next. Tests that rely on the authored intro use profiles below 5.
- **D4 — Request rotation start is seeded** (`requestOffset`), still visiting all three requests. Customer *patience* is deliberately **not** randomised: Kitchen Quest has no patience timer and "coach, not cop" says it should not grow one.
- **D5 — One status vocabulary for a patty on a plate** (`PATTY`, `PATTY_HINT` in `strings.js`, keyed by the pan's phase): cooking → "On the grill", flip → "Flip it!", ready → "Ready!", burnt → "Try again" (gentle, not red). The ticket, the customer card, the hint and the canvas tray all read it, so they cannot drift from the pan. Rows with no ✓/✗ drop that column (`li.nomark`) so the words fit.
- **D6 — The tray reserves what it draws.** `PENDING_THICK = 12` art px while pending; on landing the extra 5 px eases away over 0.2 s (`layerThickness`) so food above settles instead of jumping.
- **D7 — Eight new dishes from foods the kitchen already has**, unlocking every four dishes after the existing ones: Veggie melt (20), Saucy burger (24), Cheese lover burger (28), Crunchy pickle salad (32), Cheesy lasagna (36), Everything burger (40), Lasagna duo (44), Triple decker burger (48). 2–7 steps, all three families, no new tray, stock, sprite or station — so no layout risk. Dishes named for an ingredient never take a "no <that ingredient>" request.
- **Not done, on purpose:** grilled cheese, pizza slice, wrap, stir-fry. Those need a new plate family (bread, crust, tortilla, wok) with new sprites and probably new stations; they would be a separate slice with art review.

## DONE WHEN

- `node scripts/kitchen-quest.test.mjs` passes, including: every recipe audited (ids unique, sequences unique, ingredients known, plate sprite + tray icon exist, EN + 中文 names, lasagna ≤ 4 per bake, request variants valid), unlock thresholds monotonic with no gap over four, a seventh lasagna layer refused, every regular can ask for every dish in both languages, the daily deal reproducible and varied, the guided tour intact, and every dish and request cooked end-to-end through the real stations.
- `node scripts/check.mjs` green (after `node scripts/build-mobile.mjs && node scripts/build-android-web.mjs` in a clean checkout, as for every slice).
- In a real browser: seed key shows on `.kq`; two boots with the same key deal the same dishes and faces, other days differ; ticket / customer card / hint say flip and ready when the pan does; cheese added over a pending patty sits on the tray, not in it; the cookbook lists all 17 dishes in 中文.
- `check-kitchen-counter-ui.py` covers the three patty-status moments. Its hub-level *Games / Practice* block was already stale before this slice (it hard-codes the games list and a hub button position); the kitchen-counter part was run with that block removed.

## Not verified here

A physical tablet (as for 03). Android 8 / Chrome 138 device evidence is unchanged: nothing graphics-related was added.
