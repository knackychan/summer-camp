# Slice 01 — Points and safe redemption

**Status:** Implemented and tested locally on 2026-10-03; not deployed to the live database.
**Depends on:** [design.md](design.md). Currency/rate and redemption budget remain configurable and cash redemption stays disabled until set by Papa.
**Scope:** Existing root child runtime, parent admin, SyncStore and Supabase. Preserve unrelated in-progress work and all family data.

**Preserved from earlier work (2026-10-03):** The existing reward title editor remains the single source for editable English/Traditional Chinese exchange labels. Controls keep their associated labels; catalog IDs remain stable when names change.

## Implementation record

### Implemented

- Shared `SQPoints` policy and stable activity identities, schedule component mapping,
  three meal slots, two assigned learning slots, per-exercise Brain awards, age-specific
  reading goals and parent-reviewed real-world tasks. Free play and assessment remain
  independent of currency.
- Child and Admin points balances, pending work and histories. Achievements retain their
  IDs and use ten-times legacy thresholds against confirmed earnings. Both child views
  share the same root runtime. Agreed bilingual tasks appear beside the relevant activities.
- Admin **Quests → Points & assignments**: future amounts, goals/work references, category
  excuses, currency/rate/monthly budget and explicit cash enablement. **Quests → Rewards →
  Edit**: existing bilingual labels, description, icon, price and availability plus exchange
  type and an optional gift-value calculator that rounds up to five points. **Points**:
  pending work, approvals/refunds, reasoned corrections and +5/+10/+20/custom awards.
- Durable attempt and completion queues, separate points cache with legacy recovery data,
  reconnect/reload deduplication, server receipts, assignment binding, preserved pending
  amounts, and learning-only season resets that retain earning evidence.
- Versioned SQL conversion, server validation, immutable request snapshots, parent
  allowlist, per-child database locking, atomic approval/spending, recorded refunds and
  balanced-day/week awards. See `supabase/migrations/20261003_points_system.sql`.
- Service worker precache/version update; the Android web builder includes the new classic
  module through its existing file discovery.

### Tested locally

- `node scripts/points.test.mjs`: cache/queue migration and repeat safety; 800/200/600
  example; duplicate entrances/devices; daily slots; 125-point example; balanced-day/week
  boundaries; persisted attempt amounts; offline replay; storage failures; season savings.
- `node --test scripts/points-admin.test.mjs scripts/sync.test.mjs scripts/notify.test.mjs
  scripts/quest-agent.test.mjs scripts/star-id.test.mjs`: focused Admin/config, existing
  sync, achievements, quest and legacy identity checks.
- `python scripts/check-points-ui.py`: actual child UI with synthetic local data, blocked
  external services, migrated wallet, overlapping reading/movement completions, reload,
  unspendable pending earnings, achievement thresholds and offline shop behavior.
- `node scripts/points-database.test.mjs` with the documented local PostgreSQL connection:
  **passed against native PostgreSQL 17**, including repeat migration, original IDs,
  legacy queues, server eligibility/amounts, 60 Brain assignment comparisons, caps,
  bonuses, project top-up, policy snapshots, permission checks, simultaneous approvals
  from separate connections, immutable requests, refunds and month/season preservation.
  The read-only preview was also checked before and after local migration.
- `npm run build:android-web`: **passed**, 478 files including the new points module.
  The verified payload hash is recorded in `test-results/points-isolated-verification.json`.
  The final rebuild in the shared workspace also passed (`test-results/points-build.log`).
- `node scripts/check.mjs`: **passed** in the final isolated snapshot of working files.
  The shared workspace had concurrent unrelated edits/builds, so earlier intermediate
  runs encountered changing Brain Gym files and missing/stale generated payloads.
  The snapshot includes all points changes; its source manifest and logs are retained
  under `test-results/points-isolated-*`. Subsequent unrelated kitchen CSS/cache edits
  are listed in the verification record rather than claimed as tested in that snapshot.
  A further shared-workspace full run failed its payload-verifier test while the build
  output was being replaced; the standalone verifier and all three build-tools tests
  passed immediately afterward. This remains a shared-workspace verification limit,
  not a claim that every concurrent build passed.
- The known `v0.5.6 late Check help cannot apply after the child answers` failure
  **did not reproduce** in the initial baseline or final full check. The help suite also
  passed alone (50 tests). No assertions were weakened to obtain these results.

Database integration is intentionally opt-in: without `POINTS_TEST_PSQL` and
`POINTS_TEST_URL`, that test reports static checks only. Follow the commands in
[POINTS-ROLLOUT.md](../../../supabase/POINTS-ROLLOUT.md) to repeat the actual database test.

### Deployment

No live Supabase migration, family settings write, award, redemption or reset has been
performed by this implementation session. Live database administrative access was
not available. Follow [POINTS-ROLLOUT.md](../../../supabase/POINTS-ROLLOUT.md): back up the
database/tablet queues, run [the read-only preview](../../../supabase/points-preview.sql),
then execute [the migration](../../../supabase/migrations/20261003_points_system.sql)
as the live Supabase database owner. Compare converted balances with the preview,
publish the updated payload, refresh tablets and perform the documented live smoke check.
Cash remains disabled until Papa supplies conversion settings and explicitly enables it.

### Material limits

- Ambiguous legacy charges and partially overlapping old combined awards remain
  reviewable; they require evidence-based parent reconciliation described in the
  recovery guide. They are never resolved by resetting balances or guessing charges.
- The existing anonymous family-tablet model cannot prove physical completion.
  The server enforces assignments, prices, amounts and caps; non-routine and ambiguous
  offline work requires parent review. A live deployment and device smoke check remain
  necessary to verify the actual Supabase project and cached tablets.

**Historical label-editor validation (before this implementation):** The reward editor
passed visibility, populated values, label focus and overflow checks at 1100px and
390px. Two full checks then failed the late Check help assertion while it passed alone.
The final implementation verification above records the current result separately.

## Approved work — implemented in source

1. Trace every earning/read/revoke path before editing: schedule ticks, parent accept/undo, passes/outings, Brain Gym, quests, Captain help, shop, recap/achievement displays and season reset. Reuse the existing ledger, stable IDs and reward request flow.
2. Implement one award policy with the proposed amounts and completion limits. Map overlapping schedule/quest/activity entrances to the same real task identity. Keep game scores and free play separate. Snapshot the award amount for an attempt so configuration changes do not change already earned or pending awards.
3. Design a versioned, repeat-safe transition for legacy star units, queued operations, caches, saved custom catalogs, spending and pending requests. Preserve original history. Confirm how older tablets remain compatible before rollout; do not perform a blind multiply of stored rows. Preview conversions before applying them to live data.
4. Make the parent approval operation a database transaction: validate parent permission, lock the child's wallet, verify confirmed funds and budget, then record a uniquely keyed redemption and answer the request together. Refunds are uniquely keyed corrections. Reject client-authoritative balances, costs or budget claims.
5. Coordinate ledger policy changes with the award implementation. Validate known award kinds, eligibility and limits at the server boundary before allowing earnings to become spendable. The present anonymous 1–3-delta policy is not sufficient for money-equivalent points. Offline activity must remain usable and queue its evidence for confirmation.
6. Update both Classic and world-facing balances, celebration text, quest editor, admin ledger, reward shop and all child copy to Points / 點數. Retain admin-editable bilingual exchange labels from the shared reward catalog. Update achievement thresholds to preserve progress. Add the balanced-day/week bonuses without retaining the old full-day bonus.
7. Separate season learning resets from persistent earnings and redemption history. Store rate and budget in the existing family settings. Keep cash redemption disabled if either is unset.
8. Update the service worker/build payload and document the actual shipped contract in `docs/SPEC.md` after implementation. Do not label this proposal shipped beforehand.

## Verification

Use existing plain Node assertions and sync/reward test harnesses; no new framework.

- 80 legacy earned and 20 legacy spent becomes 800 earned / 200 spent / 600 available. Reloading or rerunning migration does not convert twice.
- An old offline operation arriving after migration uses its original unit exactly once. Pending requests retain their converted requested price.
- Completing reading through Quests and My Day pays once. Reopening and cross-device completion do not pay twice. Award caps survive reconnects and reloads.
- Daily Brain assignments pay 10 each, at most 30 total; extra practice pays 0. Wrong answers or supported retries do not reduce completed-task credit.
- The example day totals 125. Four qualifying days pay the weekly 50 once, including around Taipei day/week boundaries.
- Two simultaneous reward approvals cannot overdraw; retrying approval cannot charge twice; failed transactions cannot leave an answered request without its deduction.
- Unconfirmed earnings cannot be redeemed. Changing a catalog price cannot silently reprice an outstanding request. A denied request has no deduction; refunding twice returns funds once.
- The monthly budget includes both paid gifts and cash, and unused points carry forward. Season reset preserves available points.
- Run `node scripts/check.mjs` after application changes, plus focused existing ledger, quest and sync regressions. Build and verify the Android web payload when packaging changes.

## DONE WHEN

Child and admin show consistent points; proposed activity awards and limits work across every entrance; legacy balances retain value; offline earnings survive reload and synchronize once; only a parent can redeem confirmed points; concurrent approval is safe; season resets preserve savings; focused checks pass.
