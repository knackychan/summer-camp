# Admin clean-up — delete messages, chats, photos, passes; reset points

**Status:** requested by Papa 2026-10-09 ("i want more options in the admin panel to clear the messages / archive, delete messages by selecting them, then reset points — it's a bit complicated now"). Design answered by Papa the same day (see D2, D5). Go-ahead given 2026-10-09; slices 01–04 built the same day (build notes at the end and in each slice). Waiting on Papa running the migration on the live project and the "For Papa to check" list.

Admin operator chrome is English-only (decision D23); nothing here is kid-facing. No tablet code changes.

## Why

Today the only ways to clean up are the Season reset button (learning state only, points kept, blocked until the points migration is deployed) and hand-run SQL. The inbox can Archive but never delete. The ledger has a guard trigger (`points_guard_ledger`) that refuses every delete from the app, so points cannot be reset from the admin at all.

## Decisions

### D1 — Admin-only database functions, not browser deletes
A browser `delete` cannot remove ledger rows (guard trigger) and would need new RLS policies for every table. Instead one migration adds `SECURITY DEFINER` functions, the same boundary `reset_season` and the `points_*` RPCs already use. Each starts with `if not public.points_parent() then raise exception … end if;` so only a parent in `public.admins` can call them. Execute is revoked from `public`/`anon`; granted to `authenticated`.

- `admin_delete_rows(p_category text, p_ids text[]) returns jsonb` — categories `asks`, `kid_chats`, `photos`, `passes`. Returns `{deleted, skipped, paths[]}`. `paths` are the Storage paths of removed photo / voice rows so the browser can remove the files (D4).
- `admin_clear(p_category text, p_kid text default null, p_archived_only boolean default false) returns jsonb` — same return shape; `p_kid` null = every kid; `p_archived_only` applies to `asks` only.
- `admin_reset_points(p_kid text default null) returns jsonb` — see D2.

Category is checked against a fixed list; no dynamic table names from input.

### D2 — Points reset: per kid or all, no backup
Papa (2026-10-09): doesn't care about a backup copy. So `admin_reset_points` deletes without copying first; the **typed confirmation is the safeguard**. For the chosen kid (or all kids) it deletes, children before parents: `points_refunds`, `points_redemptions`, `points_requests`, `points_claims`, `points_assignments`, `points_excuses`, `points_legacy_spending`, `stars_ledger`. It runs inside the function (owner role) so the ledger guard passes. Kept: kids, asks, settings (policy, rewards, PINs, gate), points policy history, learning state. Every kid then reads 0 in `point_totals` and `star_totals`.

Claims are deleted too, so a kid can earn today's routines again. A reward `asks` row that lost its `points_requests` row simply stays as a plain message.

### D3 — Reward asks are protected from message deletion
`points_requests.id` references `asks.id`, and `points_redemptions` / `points_refunds` hang off that. `admin_delete_rows('asks', …)` and `admin_clear('asks', …)` **skip** an ask that still has a `points_requests` row and report it in `skipped`. The UI says "N reward requests kept — reset points first to remove them". After a points reset (D2) those asks have no request row, so they delete normally. Deleted ask ids are also removed from the `archived_asks` setting.

### D4 — Storage files are removed best-effort from the browser
Deleting photo / voice rows returns their Storage paths. The admin removes the files with `client.storage.from(bucket).remove(paths)`. If that fails the rows are still gone; a one-line note says "Files left in Storage — empty the bucket in the Supabase dashboard". The function never touches `storage.objects` itself.

### D5 — One "Clean up" sheet in Settings, Summer chats on its own tab
Papa (2026-10-09): Summer chat transcripts are a **separate tab**, not part of Messages. New sheet in the Settings page above "Danger zone" (`admin.html`):

- **Tabs:** Messages · Summer chats · Photos · Passes. A kid filter (All / Luis / Lili / Lucien) applies to the open tab.
- **Table:** checkbox per row, kid, date/time, preview (messages show kid text and Papa's reply; chats show kid text and first line of Summer's reply), an "Archived" tag on archived asks. Header checkbox = select all shown.
- **Actions:** "Delete selected (n)", and "Clear all shown for <kid or everyone>"; on Messages also "Clear all archived".
- **Confirm:** a card states the count and what is skipped; type `DELETE` to enable the button (same pattern as the season reset's `RESET`). Tablet-sized targets.
- **Points reset card** at the top of the sheet, separate from the tabs: kid picker (Luis / Lili / Lucien / All), shows the current balance, type `RESET`, button "Reset points to 0". Reminder text: "Sync every tablet first — unsent earnings in a tablet's offline queue would come back."
- The Inbox keeps Archive / Restore unchanged; real Delete lives only in this sheet.

### D6 — Rendering logic is pure
Row building, kid filtering, select-all and the confirm-count text live in a small pure file `js/admin-cleanup.js` (dual export, like the other `js/*-core` files) so `scripts/*.test.mjs` can cover them; `admin.js` only wires DOM and RPC calls.

### D7 — Out of scope
Season reset (learning state), per-row delete of day ticks / notes / help claims / search log, changing any kid app, deleting Storage objects by SQL, undo.

## Pending-plans note
Does not touch `docs/plans/2026-10-03-points-system/`: the ledger guard, `points_parent()` and the points tables stay as designed. It adds a sanctioned way to clear them.

## For Papa to check
Create a throwaway reward request and a test message, then: select and delete the message; "Clear all archived"; try deleting the reward ask (expect "kept"); reset one kid's points and confirm the other two keep theirs; reset all and confirm every kid reads 0 in Admin and on a tablet after sync.

## Build notes (2026-10-09)

All four slices shipped together; they share one migration, one pure file and one sheet.

- **Ledger guard finding.** `points_guard_ledger` returns `NEW` for the owner, and `NEW` is null on DELETE, so *every* delete from `stars_ledger` — owner included — was silently skipped. `admin_reset_points` therefore switches that trigger off for its own transaction (`alter table … disable trigger`, re-enabled before it returns; an error rolls both back). The guard itself is unchanged and still refuses tablet and admin deletes (tested). The same fix went into `supabase/reset-points.sql`, which before it would have cleared requests and redemptions but kept every earning — balances would have gone *up*.
- **D1 amended — parent check.** The functions use their own `admin_cleanup_parent()` (same `admins` lookup as `points_parent()`, like `kid_chat_parent()`), so messages, chats, photos and passes can be cleaned before the points migration is live. Points tables and `kid_chats` are looked up with `to_regclass` and skipped / reported when missing. The internal delete path `admin_cleanup_apply` is not callable by any client.
- **D4 amended — Storage policy.** The `voices` and `proofs` buckets only had read and insert policies, so a browser `remove()` would quietly remove nothing. The migration adds "parent deletes files" (delete, authenticated, `admin_cleanup_parent()`); tablets still cannot delete. The function still never touches `storage.objects`. The admin treats a short `remove()` answer as failure and shows "Files left in Storage".
- **Select all on narrow screens.** Stacked tables hide their head, so the header checkbox stays visible there as "Select all shown".
- **"Clear all"** calls `admin_clear`, which also removes rows older than what Admin has loaded (asks/photos/passes 80 most recent, chats 7 days); the button and confirm card say so.
- Tests: `scripts/points-database.test.mjs` (real PostgreSQL 17.6, disposable local DB) — all three functions refuse `anon` and a non-admin; messages keep reward asks and leave `archived_asks`; chats and photos/passes delete and clear per kid with matching `paths`; one-kid and all-kid resets zero `point_totals` and `star_totals`, empty every points table, keep asks / settings / kids / policy history, re-enable the guard, and re-running the migration changes nothing. `scripts/admin-cleanup.test.mjs` covers the pure helpers. `scripts/check-admin-cleanup-ui.py` drives the real `admin.html` against an in-memory fake Supabase (reset gate, delete selected, clear archived, chats, a failed Storage removal, passes, 44 px targets, portrait, chats not installed).
