# Summer Quest — project rules

## What this is
Family summer app: 3 kid profiles on tablets + Papa admin. Static site (GitHub Pages/Vercel) + Supabase free tier. Spec: docs/SPEC.md — follow it literally; it wins over improvisation.

## Non-negotiables
- **Never commit secrets.** js/config.js is gitignored; service_role key must never exist in this repo in any form.
- **Bilingual invariant:** every user-facing string ships EN + 繁體中文 (Taiwan usage: 公車, 起司, 腳踏車). A string without 中文 is a bug.
- **Coach, not cop:** late/locked states invite, never shame. No red-for-late, no punishments, no screen-time enforcement (indicate only). No per-minute tracking.
- **Offline-first:** games and My Day must work with wifi off. Sync is additive; the app never blocks on network. Missing config.js ⇒ clean local-only mode.
- **Don't touch working gameplay** (games, vocab data, mission pools, seeding) unless the task explicitly says so. Mission *assignment* stays client-side and date-seeded; only *state* syncs.
- **Stars are a ledger** (sum of stars_ledger deltas), never a stored counter.
- Tablet-first UI: coarse-pointer targets, no hover-dependent interactions.

## Workflow
- Read docs/SPEC.md priorities; work one tier at a time; a tier is done only when its DONE WHEN passes.
- After ANY edit to index.html or js/: run `node scripts/check.mjs` (or /check). Red check ⇒ do not commit.
- Conventional commits. Small commits per feature, not per tier.
- Timezone: all "day" computations via one shared helper pinned to Asia/Taipei.

## Verify
- `node scripts/check.mjs` — syntax + data integrity (bilingual completeness, pool alignment, no dup vocab keys, no secrets in tracked files).
