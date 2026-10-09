# 01 — Database functions + points reset card

**Depends on:** `2026-10-03-points-system/` deployed (the points tables and `points_parent()` exist). Do this slice first — it is the one Papa needs now.

## Scope
- `supabase/migrations/20261009_admin_cleanup.sql` — `admin_delete_rows`, `admin_clear`, `admin_reset_points` (design D1–D4); safe to re-run (`create or replace`, revoke/grant). All three land here so later slices need no new migration.
- `supabase/POINTS-ROLLOUT.md` — add the step "Admin clean-up (2026-10-09), after step 3".
- `admin.html` — new "Clean up" sheet above "Danger zone" with only the points reset card for now.
- `js/admin-cleanup.js` (new, classic script) — card state: kid list, balance text, confirm gate. Add the `<script>` tag to `admin.html` and the file to `APP_SHELL` in `sw.js` if admin is cached.
- `js/admin.js` — `renderCleanup()`, `runPointsReset()` calling `client.rpc("admin_reset_points", { p_kid })`, then `loadAll()`; guard on `pointsReady` like the season reset.
- `scripts/points-database.test.mjs` — new cases (below).

Untouched: the three existing `points_*` migrations, `reset_season`, the kid app, `docs/plans/2026-10-03-points-system/`.

## DONE WHEN
- `node scripts/check.mjs` green.
- Database test (`POINTS_TEST_URL` disposable DB): non-admin and `anon` get an exception from all three functions; `admin_reset_points('lili')` zeroes Lili in `point_totals` and leaves Luis and Lucien unchanged; `admin_reset_points(null)` zeroes everyone; every points table is empty afterwards; `asks`, `family_settings` and `kids` keep their rows; re-running the migration is a no-op.
- Browser check on the admin: pick a kid, button disabled until `RESET` typed, balance shown before, reads 0 after, toast says how many kids were reset.
- Papa runs it once on the live project (migration in the SQL editor, then the button).

## Build notes
Built 2026-10-09. Migration, card and both tests done; database test green on PostgreSQL 17.6, browser check green (`scripts/check-admin-cleanup-ui.py`). The reset switches off `points_guard_ledger` for its own transaction — without that the ledger delete is silently skipped (see design.md build notes). `admin.js` → v70, `sw.js` cache `v204-admin-cleanup`. Waiting on: Papa runs the migration on the live project, then the button.
