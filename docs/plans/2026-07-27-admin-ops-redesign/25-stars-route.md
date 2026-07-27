# Slice 25 — Stars route: grant fix + ledger

**Depends on:** 20 (routes), 21 (form + table vocabulary).
**Design:** `design.md` §5. Decision D8. Fixes audit A8.

## Why

`renderGrants()` puts one shared reason field and one shared custom-amount field *below* three kid rows (`js/admin.js:568-580`). Tapping `+1` on Lucien writes whatever text happens to be in that field — including text typed for Lili a minute earlier. The reason clears after a grant; the amount does not. This is a data-integrity bug wearing a layout bug's clothes, and the ledger is the one thing in this app that must be trustworthy.

## Files

- `js/admin.js` — `renderGrants()`, `grantStars()`, `renderLedger()`, `renderLedgerRecent()`
- `admin.html` — `#view-stars`

## Steps

1. **Reason moves inside the kid row.** Each of the three `.grant` rows carries its own `<input id="grantReason-${id}">`. `grantStars(kid, delta)` reads that kid's field and no other. Cross-kid contamination becomes structurally impossible, not merely unlikely.
2. **Buttons per row:** `−1`, `+1`, `+2`, `+3`. The shared custom-amount field is deleted; a custom value is a rare case and the ledger accepts repeated taps.
3. **`resetStars()` moves to Settings → Danger zone** (slice 27) and is removed from this route.
4. **Full ledger table:** When · Kid · Δ · Reason · Source · Undo. Δ is `.delta--up` / `.delta--down`, never colour alone — the sign is in the text.
5. **Filters:** kid chips (single-select) and a range select (Today / 7 days / 14 days / All). Client-side over `rows.ledger`, which already fetches 150 rows ordered descending. If the range exceeds what is loaded, the footer says so rather than lying.
6. **Undo per row** keeps today's behaviour (delete the ledger row). Confirmation moves from `window.confirm` to the in-page toast confirm (design §5).
7. **Export CSV** — client-side `Blob` over the currently filtered rows. No dependency, no endpoint.
8. **Footer** states `N of M rows` plus each kid's live total, so the sum-of-ledger invariant is visible on the page that edits it.

## DONE WHEN

- Typing a reason for one kid and granting to another writes the *other* kid's reason field, and there is no field that both can read.
- A grant, an undo and a filter round-trip all behave as before, verified against `stars_ledger`.
- Totals shown are the sum of ledger deltas, never a stored counter (`CLAUDE.md`).
- CSV export opens in a spreadsheet with the filtered rows and correct signs.
- `node scripts/check.mjs` green.
