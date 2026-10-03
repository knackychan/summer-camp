# Kitchen Quest v0.8 — customers with a face, a name and a voice

Requested by Papa, 2026-10-03: customers should arrive one by one and line up, look like they walk into the shop, then say what they want in a speech bubble that types out with a typewriter / "blablabla" sound. The customer list becomes a toast-style queue with names, and each customer has their own identity so a child can recognise them. Builds on [05-readability.md](05-readability.md).

## Decisions

- **D1 — Presentation only.** The model still has exactly two seats (two live orders) with the same timers, recipes and scoring. The line, the names and the chatter are drawn around it: `js/games/kitchen/customers.js` decides who is wearing each order and who is waiting in line; `scene.js` animates them. No gameplay rule changed.
- **D2 — A cast of ten regulars.** Mia, Leo, Grandma Rose, Captain Tom, Robo, Astronaut Ava, Ben, Lily, Coach Kim and Max. Each has a fixed look (skin, hair style, shirt colour and one signature item: bow, cap, glasses, captain's hat and beard, robot head, space helmet, headphones, flower, headband, spiky purple hair), a voice pitch, and a greeting and order line of their own, in EN + 繁體中文. They come in a shuffled order that never repeats someone already on screen.
- **D3 — One at a time through the door.** People enter from the street (left edge), at least 1.1 s apart, with the door bell. At the start the two seats fill first, then two more people queue in the background between the seats, drawn smaller because they stand further back. When a seat frees up, the person at the front of the line steps forward to it and someone new walks in at the back.
- **D4 — They say their order.** On reaching the counter a customer's speech bubble shows their name (with a swatch of their shirt colour) and types out e.g. "Ahoy! Captain Tom here. Bring me a cheeseburger!", plus any special request, in the language the kitchen is showing. Each syllable plays a short "bla" blip in that customer's voice (Robo beeps in square waves). Only one customer types at a time; after 2.8 s the bubble shrinks back to the usual dish picture. Tapping a talking customer finishes the sentence at once. The blips go through the kitchen's audio pool and respect the app's mute.
- **D5 — The customer list is a queue of toasts.** Each card shows the portrait, name, dish and progress, edged in that customer's shirt colour; people in line follow as dashed cards ("Next in line", "In line"). Cards slide in when someone reaches the counter or joins the line and slide out when they leave, keyed by person so the 10 Hz redraw does not restart the animation. The plate chip and the recipe heading now use the customer's name and portrait instead of seat letters A/B.

## DONE WHEN

- `node scripts/check.mjs` green.
- `python scripts/check-kitchen-counter-ui.py` passes, including: customers come through the door at least 0.5 s apart; the two seated customers and two people in line are four different named regulars; both seated customers speak; the queue lists two counter cards then two line cards, all with different names. The earlier layout, serving, language and 44 px checks still pass.
- Hearing the chatter on a real tablet is a device step.
