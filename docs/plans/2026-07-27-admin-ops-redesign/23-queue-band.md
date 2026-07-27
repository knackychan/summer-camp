# Slice 23 — Waiting-on-you queue + status band

**Depends on:** 20 (routes), 21 (table + tag vocabulary).
**Design:** `design.md` §3, §5. Decisions D2, D3. Fixes audit A4.

## Why

The only urgency signal today is `#chatNeedsBadge`, a 12px pill inside a rail header. The things that block Papa — an unanswered ask, a captain claim, a pass request — are the first thing on the page in the new admin, not the last.

## Files

- `js/admin.js` — new `queueRows()` and `renderQueue()`, new `renderBand()`
- `admin.html` — `#band`, `#queue` in `#view-today`
- `css/admin.css` — `.band` (already built in 21)

## Steps

1. **`queueRows()`** — a pure function over already-fetched `rows`, no new query. Merges:
   - `rows.asks` where `answer == null` and not archived → type `ask`
   - `rows.helpClaims` where `status === "requested"` → type `claim`
   - `rows.passes` where `status === "requested"` → type `pass`
   Each row: `{ id, type, kidId, at, body, actions }`, sorted oldest-first — the thing that has waited longest is the thing to do next.
2. **`renderQueue()`** — a `.tbl` with columns Kid · Type · What · Waiting · Action. Inline actions call the existing `answerAsk`, `archiveAsk`, `setHelpClaim`, `setPass`. Voice playback reuses the existing `▶` path.
3. **Waiting column** is elapsed time from `at`, recomputed on each render, `tabular-nums`.
4. **Kid filter chips** above the table, single-select, client-side.
5. **`renderBand()`** — four cells, each a button that routes or filters:
   - **Needs you** = `queueRows().length`, with a `type` breakdown as the sub-line → routes to `#inbox`
   - **Blocks accepted** = covered blocks across all three kids over `3 × DAY.length`, per-kid sub-line
   - **Stars today** = sum of positive `stars_ledger` deltas dated today, with revoked as the sub-line → routes to `#stars`
   - **Locks active** = kids with a non-empty `applock_*` or any `catlock_*`, most recent as the sub-line → routes to `#kids`
6. **One source of truth for the count.** The nav badge, the top-bar dock trigger and the band cell all read `queueRows().length`. They cannot disagree.
7. **Empty state:** "Nothing waiting" — the queue sheet collapses to a single quiet line rather than an empty table.

## DONE WHEN

- Every item in the queue can be resolved without leaving `#today`, and disappears from the queue on resolve.
- Nav badge, top-bar trigger and band cell always show the same number.
- Oldest item is at the top; the Waiting column matches wall-clock elapsed time.
- Band cells navigate where their label implies.
- Empty queue renders the quiet state, not a headerless empty table.
- `node scripts/check.mjs` green.

## Notes

- `queueRows()` fetches nothing. It maps and sorts. Keep it pure so it can be unit-tested and so the count is cheap to recompute anywhere.
