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
