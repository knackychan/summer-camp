# Points database rollout and recovery

## Current state

The SQL and app are implemented and tested against a disposable local PostgreSQL
17.6 database. This is **not a live Supabase deployment**. No live balances,
settings or requests were accessed or changed.

The parent account must be in `public.admins`. Authentication alone is insufficient
for money or award actions. Existing installations already use this allowlist for
season reset. Verify the intended parent's UUID in the Supabase dashboard; do not
add every authenticated account.

## Deploy in this order

1. Keep tablets offline while taking a Supabase project backup and export
   `stars_ledger`, `family_settings`, `asks`, `kids` and `admins`. Preserve their IDs.
   Also save each tablet's `sq:queue` and `keyquest:v2` browser storage before its
   first update. Do not clear browser storage or pending work.
2. Run [points-preview.sql](points-preview.sql) in the SQL editor. It is read-only.
   Compare each family's expected total earned, spent and available. Resolve a
   negative balance or malformed JSON first. Review warnings about old approvals
   whose recorded requested price differs from the actual charge, or a request
   that was charged but never answered. Save the preview results.
3. For an existing project, run
   [migrations/20261003_points_system.sql](migrations/20261003_points_system.sql)
   in the SQL editor **once as the database owner**. It is a single transaction;
   any failure rolls back the complete conversion. Re-running it is safe. A fresh
   project first needs `schema.sql` and its normal parent account configuration.
   Never reapply an older season-reset migration after this migration.
4. Check `points_migrations` contains version `1`, all existing ledger IDs remain,
   ledger rows have `unit_version=2`, reward/spending JSON has `points_version=1`,
   and `point_totals` agrees with the preview. `points_migration_backup` retains
   exact pre-conversion ledger, settings and reward-request records.
5. Deploy the updated `dist/android-web` build, refresh Admin, and update each
   tablet's cached app. New clients read `point_totals`; the compatibility
   `star_totals` view intentionally still reports legacy units. The new ledger
   `delta` is in points. Do not multiply either source twice.
6. Confirm a 5-point routine, a parent-reviewed task and one inexpensive test
   exchange. Approve from the actual parent account, verify both devices agree,
   then refund it with a reason. Test a tablet offline and reconnect it. Realtime
   publication includes `points_claims`, `points_assignments`, `points_requests`
   when the normal `supabase_realtime` publication exists.

7. **Brain Gym trio sync (2026-10-08) — run right after step 3, before any
   tablet sends Brain Gym points:**
   [migrations/20261008_brain_trio_sync.sql](migrations/20261008_brain_trio_sync.sql)
   (database owner, safe to re-run). The 2026-10-03 function still listed the
   retired Change Maker, so the server picked a different daily trio than the
   tablets and refused real Brain Gym claims. Check afterwards:
   `select points_brain_trio('lili', (now() at time zone 'Asia/Taipei')::date);`
   must list the three "today" exercises Lili's tablet shows.
8. **Games gate home-help kinds (2026-10-08):** after step 3 succeeded, run
   [migrations/20261008_games_gate_kinds.sql](migrations/20261008_games_gate_kinds.sql)
   once as the database owner (safe to re-run). It adds `shoe_tidy` (5,
   self-checked), `garden_tidy` (15), `living_tidy` (10) and `office_tidy` (10,
   parent-checked) to `points_policy` and `points_claim`. Tablets with the
   matching app offer those four jobs; before this step, the server rejects their claims
   with "Unknown award kind", so run it before deploying the app.
9. **Games gate settings (2026-10-08), any time:**
   [migrations/20261008_games_gate_settings.sql](migrations/20261008_games_gate_settings.sql)
   seeds `games_gate_v1` switched **off** and lets only a parent in `admins`
   change it (checked values). It does not depend on the points migration. Then
   switch the gate on in Admin → Quests → Points & assignments → Games gate.
10. **Home-help guide decisions (2026-10-08), any time:**
   [migrations/20261008_guide_decisions.sql](migrations/20261008_guide_decisions.sql)
   creates `guide_decisions` (safe to re-run; independent of the points
   migration). Tablets may only insert `local` rows and set `started_id`.
   Before this step the guide still works; tablets keep their decisions locally
   and the admin history stays empty.

The exact remaining deployment action is step 3 on the family's live Supabase,
followed by steps 7–8 (2026-10-08 migrations), then the build/tablet rollout and live smoke check in steps 4–6. The local
test does not prove the production project has run any of these steps.

## Preserved value and older tablets

- 80 legacy earned and 20 spent becomes 800 earned, 200 spent, 600 available.
  Earnings come only from the existing ledger. Coin spending is a separate
  subtraction; the same earnings are never counted twice.
- IDs, original ledger reasons, timestamps and request bodies remain. Saved
  catalogs and outstanding requested prices convert by 10. Old approved answers
  that contain the actual charge retain that charge for refunds; the originally
  requested price is also retained as `legacy_requested_points`.
- If the old spending record already lists an unanswered request ID, the request
  imports as approved and cannot charge again. Its exact paid amount must be
  reconciled before a refund if the old answer did not record one.
- Known old schedule/quest/Brain identities reserve their equivalent tasks with
  zero-value claim records. They cannot earn again through a new entrance.
  These records neither mint new points nor retroactively qualify for bonuses.
  The old full-day bonus also reserves the new daily bonus, preventing stacking.
- Old tablet inserts are retained as pending legacy claims worth their original
  delta ×10. They need parent review and cannot be spent while pending. A retry
  with an already migrated ledger ID returns the original confirmation. Old
  reward requests receive current server catalog snapshots; their supplied price
  is never authoritative. Old Admin financial writes are rejected: update Admin.
- Keep old tablets' queues until the updated app has imported them. An outdated
  app cannot provide an accurate current Points display, even though its data
  remains protected. Avoid operating it indefinitely alongside the new app.

## Configure Admin

In **Quests → Rewards**, keep bilingual labels, descriptions, icons, stable IDs,
point costs and availability. Choose an experience, gift or cash reward. In
**Quests → Points & assignments**, set currency, points per currency unit and
the per-child monthly redemption budget.
Cash remains disabled until those settings are valid and explicitly enabled.
Cash costs use 100-point steps. Gifts and cash share the monthly money budget;
experiences do not consume a money budget. A request snapshots its label, points,
currency and rate. Later edits apply to new requests.

In **Quests → Points & assignments**, change future award amounts in steps of five, assign a
bilingual goal and stable work ID for learning sessions, additional housework,
outings or weekly projects, and review pending work. Two entrances to the same
work share the same ID. A creative milestone and its weekly project use the same
work ID so 20 already earned leaves 30 at final approval. Category excuses are
parent actions. Use **Points** to review work, approve exchanges, record refunds
and make reasoned corrections. Learning/game scores remain separate.

The default policy is preserved in policy history. Assignments and started
attempts snapshot their amounts; an offline amount must match a known historical
policy. Work from an earlier day or an old policy waits for parent review. Unknown
policy revisions are left in the durable queue and reported, never silently
discarded or repriced. Reconnect to synchronize the policy; use the backup and
parent review if a locally authored policy was never uploaded.

Currency changes are blocked while an unrefunded money exchange exists in the
current Taipei month. This avoids adding unlike currencies to one budget. Points
and history survive month changes and season resets.

## Recovery without resetting balances

1. If migration fails, fix the reported invalid source row using the exported
   evidence and rerun the same transaction. There is no half-converted state.
2. If verification differs from the preview, pause new exchanges and export the
   current database too. Compare `point_totals` with `points_migration_backup`.
   Do not divide current totals by ten, clear a ledger, erase a queue, or restore
   an old snapshot over new activity.
3. Refund an undelivered approved reward using `points_refund_redemption` with the
   original request ID and a reason. Retries return the same refund. Correct an
   accidental duplicate earning with `points_correct_award(original_ledger_id,
   reason)`: this appends a linked correction and keeps the original row. A
   correction cannot consume points already exchanged; refund those first.
4. For `legacy_amount_verified=false`, inspect the exported old spending record,
   answer and delivery evidence. A parent/database owner must establish the
   **actual charge**, then update only that request's `points` and set
   `legacy_amount_verified=true`. Preserve `legacy_requested_points`, original
   asks and backup. The normal refund RPC then restores the reconciled amount.
   If the actual charge cannot be established, leave the refund held; no balance
   is reset or guessed.
5. A legacy combined block arriving after some of its new component tasks were
   confirmed remains reviewable but cannot be approved as a second full award.
   Compare its promised converted amount against the confirmed matching work;
   deny the duplicate claim and use one manual correction award for any proven
   unpaid difference, with the old claim ID in the reason and a durable UUID for
   retries. For example an old 10-point morning block with 5 points already paid
   may require a 5-point correction. Brain-trio pricing differs across versions:
   review the actual work before reconciling it. Never pay the complete old and
   new awards together.
6. If restoring the pre-migration project is necessary, restore the full backup
   into a separate project, compare it with the current export, and replay new
   operations by their preserved IDs. Keep the current project intact until the
   records reconcile. This is a recovery operation, not a season reset.

## Reproduce database verification

Use PostgreSQL 17 or another supported Supabase PostgreSQL version with `psql`.
Create a **disposable local** database named `sq_points_test`; the harness refuses
other names or remote hosts. It drops/rebuilds that test database's public schema.

```powershell
$env:POINTS_TEST_PSQL = 'C:/path/to/postgresql/bin/psql.exe'
$env:POINTS_TEST_URL = 'postgresql://postgres@127.0.0.1:55439/sq_points_test'
node scripts/points-database.test.mjs
```

The test applies the actual schema/migration and uses `anon`, an allowlisted
parent and an unrelated authenticated user. Separate native database sessions
race approvals for the same wallet and the shared gift/cash budget. It also
checks migration replay, legacy identities/queues, policy snapshots, 60 exact
Brain assignments against the JS implementation, the 125-point day, daily and
weekly limits/bonuses, project top-up, redo, request snapshots, repeated refunds
and season preservation. Without the environment variables it reports only
static checks and explicitly states database integration was not run.

The anonymous tablet architecture cannot prove physical task completion or stop
a determined child fabricating an in-browser result. Server rules enforce known
kinds, canonical assignments, amount snapshots, caps and the assigned Brain trio;
non-routine work and ambiguous offline work require parent review. A stronger
identity/proof system would require changing the agreed family auth model.
