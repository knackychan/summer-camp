# 02 — Clean up sheet: Messages tab

**Depends on:** slice 01 (functions + sheet exist).

## Scope
- `js/admin-cleanup.js` — pure: `buildRows(category, data, filters)`, select-all / toggle helpers, `confirmText(count, skipped)`.
- `js/admin.js` — tab bar, kid filter, checkbox table, "Delete selected (n)", "Clear all shown", "Clear all archived" on Messages; confirm card with typed `DELETE`; calls `admin_delete_rows('asks', ids)` / `admin_clear('asks', kid, archived_only)`; removes returned voice-memo paths from Storage best-effort (design D4); reports "N deleted, M reward requests kept".
- Messages rows come from the same `rows.asks` the Inbox uses (kid text, Papa's reply, archived tag from `archivedAskIds()`).
- `scripts/admin-cleanup.test.mjs` (new) — pure helper cases.

Untouched: Inbox view (Archive / Restore stay as they are), the conversation dock, `SQChat`.

## DONE WHEN
- `node scripts/check.mjs` green; `node scripts/admin-cleanup.test.mjs` green.
- Database test: `admin_delete_rows('asks', …)` deletes plain asks, skips an ask with a `points_requests` row and counts it in `skipped`, removes deleted ids from `archived_asks`; `admin_clear('asks','luis',true)` deletes only Luis's archived asks.
- Browser check: select two messages, delete, they disappear from the sheet, the Inbox and the dock; "Clear all archived" empties the Archived view; a reward ask is kept with the explanatory line.

## Build notes
Built 2026-10-09 with slice 01. Database and helper tests green; browser check deletes two ticked messages (the reward ask is kept with the explanatory line, the voice file is removed, the message leaves the dock), then "Clear all archived" empties the archived ones and the `archived_asks` setting.
