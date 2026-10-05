# 10 — The recipe rail on small tablets

Requested by Papa, 2026-10-05. The rail itself shipped 2026-10-04/05 in commits `8903df7` and `356fd4f` without a slice of its own; this file records it. An audit the same day found two gaps, and Papa asked for them to be fixed while the tablet check ran ("if you saw any gaps or fix to do in the meantime, you can do"). Pending: Papa's look on a real tablet.

**Depends on:** 05 (one language at a time), 09.

## What shipped already (8903df7, 356fd4f)

- **Landscape 721–1280 px wide:** the recipe ticket becomes a 104 px left rail. It shows Listen, a 64×48 dish picture (`.kq-dish-small`), the dish name, and one 44 px row per food (28 px icon + name). Step numbers and the status words ("On the grill", "Wrong food") are hidden; the row colour carries the state.
- **Landscape 721–1100 px wide:** the customer column widens to 176–200 px, faces shrink to 32 px and tray pictures to 44 px, so names and dishes break between words and tray names fit, in EN and 中文.
- **Wider than 1280:** the 3-column ticket | counter | orders layout is unchanged.
- A long recipe scrolls inside the rail, as slice 03 already allows ("long recipes scroll within their own panes"). At 600 px tall about 4 rows fit; recipes with 5–7 foods scroll.

## Decisions (this slice)

| # | Decision | Rationale |
|---|---|---|
| R1 | **A recipe row for food still to make opens its station.** Patty → grill, tomato / lettuce → cutting board (picking that vegetable when the board is free, the same thing an empty tray already does), lasagna → oven. Pantry food (cheese, pickles, sauce…) has no station, so its row stays plain. It opens the station only: it never adds food. A placed row still removes that layer, as before. The row reads "Patty: go to the grill" / "肉排：去煎鍋" to a screen reader. | The rail is where a kid reads what to make next. Tapping the row takes them to where it is made. It is the same mapping as the Prep table's "Make" button, now one shared `STATION_OF`. |
| R2 | **On the rail, ✓ and ✗ stay as a small corner badge.** Before this, the rail hid the mark, so a row's state was shown by colour alone. The badge sits on the row's top-right corner and takes no width from the name, so "Cheese" doesn't break mid-word. | State shouldn't depend on colour alone. A first try that gave the mark its own column broke "Chees / e" at 1280×800. |

Not done: an 80 px rail (an external checklist's number). At 104 px "Cheeseburger" and the food names already only just fit. Making it narrower would split them.

## Changes
- `js/games/kitchen.js` — `STATION_OF`, `STATION_NAME`, `goto:<food>` rows and action; the Prep table uses `STATION_OF`.
- `css/kitchen-quest.css` — `.kq-go` rows look like the other rows still to make; the rail's corner tick badge.
- `scripts/check-kitchen-counter-ui.py` — at each size the recipe is a ≤ 110 px rail with the dish picture; at 1366×768 the full ticket is back; pantry rows are not station buttons; the patty row opens the grill; done rows on the rail show their ✓.

**DONE WHEN:** `node scripts/check.mjs` green; `check-kitchen-counter-ui.py` passes; Papa has looked at the rail on a real tablet.

**Verified 2026-10-05:** `check.mjs` green; `check-kitchen-counter-ui.py` 109/109 (1280×800, 1280×600, 1024×600, 1024×800, plus 1366×768), no page or console errors; rail screenshot checked at 1280×800. Not yet: Papa's tablet look.
