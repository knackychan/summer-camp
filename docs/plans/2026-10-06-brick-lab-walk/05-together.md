# Slice 05 — Walking together

**Requested by Papa, 2026-10-06.** Implements design.md W12, W13.

**Depends on:** 02 (03 and 04 recommended first); brick-lab-multiplayer slices 01–06.

## Changes
- `js/brick-lab/brick-share.js` — `PROTO` 5 (comment: walking). Validation for the walk messages: `walk-claim { id }`, `walk-pos { id, x, y, z, yaw, view }` (finite numbers, y ≤ `Y_MAX`), `walk-release { id }`. They are messages, not ops: no `seq`, never applied to the saved world.
- Host (`brick-together.js`): claims in arrival order, first wins; a claimed figure and its riders refuse `move` / `pose` / `remove` / `recolor` from anyone but the walker; relays `walk-pos` at most ~6 per second per walker; releases the claim when the walker's tablet leaves.
- Guests: stepping in waits for the claim (🚶 shows a short spinner, then walks or shows `walkBusy`); others' walkers render at the relayed spot, smoothed, playing the Walk loop; tapping a busy figure shows `walkBusy` in its bubble.
- The 🚶 button shows in shared worlds.
- Strings: `walkBusy`.
- `scripts/brick-share.test.mjs` (or the existing share test) — walk message validation, claim refusal of others' ops.

**DONE WHEN:** `check.mjs` green; on a pretend wifi in the browser (two pages, as multiplayer slice 06) one page walks and the other sees it move live, can't move or delete it, sees `walkBusy`; when the walker leaves, the figure's final spot shows on both; closing the walker's page releases the figure.

**Shipped 2026-10-06:** `PROTO` 5. `brick-share.js` gains `cleanWalk()` (claims, positions over the island and under `Y_MAX`, releases; at most 16 ids) and `createClaims()` (first claim wins; a claim covers the figure and its riders; `busy(op, kid)`, `releaseKid`, `list` / `set`). `BrickTogether` keeps the claims (the host's are the truth, a guest mirrors `walkers {list}`, also sent in the welcome), answers `walk-claim` with `walk-grant`, relays `walk-pos` with the walker's kid to everyone else, refuses a busy op with `reject {why: "busy"}` — also the host kid's own change (in the lab's `commit`) and its Undo — and frees a tablet's walks when it drops off. As built:
- **The host walks too.** Opening a world hosts it, so even with nobody connected the host claims its walk; a sibling who joins mid-walk sees it.
- **A guest asks first:** 🚶 sends the claim; the walk starts on `walk-grant` (no spinner was needed on the home wifi). The landing goes out as requests in one Undo group, then `walk-release`, so the host frees the figure where it landed.
- **Others' walkers are stand-ins** (the lab's `walkStandIn`, legs swinging while `moving`), gliding to each position (`1 − e^(−10·dt)`); the real figure and riders hide and come back where the landing moves put them.
- **W13 as a hint, not in the bubble:** a busy figure can't be selected, so tapping it says "Someone is walking with it · 有人正在用它走路" in the stage hint and selects nothing; 🚶 never shows on it.
- A walk stops without landing when the host's world closes or the link drops (`endShared`, `connectionLost`); the figure stays at its saved spot.
- Tests: `brick-share.test.mjs` (walk messages, claims, `PROTO` 5) and `brick-together.test.mjs` (+7: first claim wins, busy refusals, positions relayed with the walker's kid and never back to the walker, letting go and dropping off free the figure, a late joiner sees the walkers, a guest's landing is one Undo step, the host can't undo into a walked figure). Browser check (scratch, pretend wifi), 18/18 on Edge SwiftShader: Lili walks our figure and her walk glides here while tapping it says it's busy; her landing is one Undo on her tablet; we walk it and she can't take its hat off; she gets our position about 6 times a second; we land it and it's free again; one Undo takes it back on both tablets; as a guest we ask for her figure, walk it, land it, and undo it in her world; her world closing mid-walk stops our walk.
