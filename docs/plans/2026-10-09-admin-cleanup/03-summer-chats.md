# 03 — Clean up sheet: Summer chats tab

**Depends on:** slice 02 (tab framework). Needs `supabase/migrations/20261009_kid_chats.sql` live.

## Scope
- `js/admin-cleanup.js` — `buildRows('kid_chats', …)`: one row per exchange (`kid_chats` row), kid text + first line of the reply, grouped visually by `session_id`.
- `js/admin.js` — "Summer chats" tab reusing the table, select-all, kid filter and `DELETE` confirm from slice 02; calls `admin_delete_rows('kid_chats', ids)` (ids are bigint, passed as text) and `admin_clear('kid_chats', kid)`. If the table is missing, the tab says "Summer chat transcripts are not installed" instead of failing.

Untouched: the `kid-chat` Edge Function, `kid_chat_v1` switch, the existing transcript view in admin.

## DONE WHEN
- `node scripts/check.mjs` green; helper tests extended and green.
- Database test: delete selected chat rows; `admin_clear('kid_chats','lili')` leaves other kids' rows.
- Browser check: the tab lists transcripts, deleting removes them from this sheet and from the existing transcript view after `loadAll()`.

## Build notes
Built 2026-10-09 with slice 01. Rows are grouped under a "Conversation · kid · time" line per `session_id`. Database test deletes selected rows and clears Lili only; browser check deletes one exchange and shows "Summer chat transcripts are not installed" when the table is missing.
