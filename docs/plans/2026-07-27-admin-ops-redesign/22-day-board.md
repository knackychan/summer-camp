# Slice 22 — Day board: one shared timeline

**Depends on:** 20 (routes), 21 (sheet vocabulary).
**Design:** `design.md` §2 thesis, decision D21. Fixes audit A10.
**Visual change:** the signature of the redesign.

## Why

`renderOverview()` today emits three independent `.kid-card` columns, each with its own schedule list. Answering "at 09:40, who is where" means reading three lists and comparing by eye. One shared timeline answers it in one glance, and makes the current block a property of the *row*, not a badge inside three separate cards.

## Files

- `js/admin.js` — `renderOverview()` rewritten; `scheduleBlock()` becomes `boardCell()`
- `css/admin.css` — `.board` grid, `.board__h`, `.board__t`, `.cell`
- `admin.html` — `#overview` container

## Steps

1. **Grid:** `grid-template-columns: 78px repeat(3, minmax(180px, 1fr))`, `min-width: 720px` inside a `.tbl-wrap` so a narrow desktop scrolls the board, never the page.
2. **Header row:** sticky, one cell per kid carrying the `.who` mark, the name and the star total.
3. **Time gutter** per block: effective time from `SQTime.effMins`, block title beneath. `.is-now` highlights the whole row across all four columns.
4. **`boardCell(kid, i)`** keeps every state `scheduleBlock()` produces today — accepted, removed/outing, sent-back/redo, overdue, upcoming, current, moved — rendered as a `.tag` plus the block title, with actions in `.cell__acts`.
5. **Actions unchanged in behaviour:** `acceptBlock`, `unacceptBlock`, `sendBackBlock`, `removeBlock`, `addBackBlock` are re-bound, not rewritten. Star refunds keep going through `starRefunds()` — **stars stay a ledger** (`CLAUDE.md`).
6. **Time edit** stays an `<input type="time">` in the gutter cell, one per kid where the kid has an override.
7. **Keyboard reorder** (A10): the drag handle gains `↑` / `↓` key handling calling the same `saveDraggedOrder(kid, fromBlock, toBlock)` as the drag path, plus `aria-label` naming the block it moves. Drag behaviour is preserved as-is.
8. **Hover is not required** (D25): `.cell__acts` sits at reduced opacity on pointer devices and full opacity under `@media (hover: none)` and below 820px.
9. **Board filter chips:** `Open only` / `Show done`, client-side over already-rendered cells. No new query.

## DONE WHEN

- One board shows all three kids against a shared time gutter; the current block is identifiable without reading text.
- Accept / undo / send back / remove / add back / time edit / reorder all work exactly as before the slice, verified against a real tablet.
- Reordering with the keyboard produces the same `day_overrides` rows as reordering with the mouse.
- At ≤820px the board stacks per kid with no horizontal page scroll.
- `node scripts/check.mjs` green.

## Notes

- `SQTime.displayOrder`, `resolveOverrides`, `effMins` and `timelineInfo` are used unchanged. This slice moves containers and adds a keyboard path; it does not touch time maths.
