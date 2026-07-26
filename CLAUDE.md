# Summer Quest — project rules

## What this is
Family summer app: 3 kid profiles on tablets + Papa admin. Static site (GitHub Pages/Vercel) + Supabase free tier. Spec: docs/SPEC.md — follow it literally; it wins over improvisation.

## Non-negotiables
- **Never commit secrets.** js/config.js is gitignored; service_role key must never exist in this repo in any form.
- **Bilingual invariant:** every user-facing string ships EN + 繁體中文 (Taiwan usage: 公車, 起司, 腳踏車). A string without 中文 is a bug.
- **Coach, not cop:** late/locked states invite, never shame. No red-for-late, no punishments. No per-minute tracking. Screen-time is indicated, not enforced — **one exception (Papa's decision 2026-07-26):** games are blocked during unticked activity blocks per docs/plans/2026-07-26-homework-lock-drills-outing/; guides, Learn, My Day, and ask channel are never locked.
- **Offline-first:** games and My Day must work with wifi off. Sync is additive; the app never blocks on network. Missing config.js ⇒ clean local-only mode.
- **Don't touch working gameplay** (games, vocab data, mission pools, seeding) unless the task explicitly says so. Mission *assignment* stays client-side and date-seeded; only *state* syncs.
- **Stars are a ledger** (sum of stars_ledger deltas), never a stored counter.
- Tablet-first UI: coarse-pointer targets, no hover-dependent interactions.

## Workflow
- Read docs/SPEC.md priorities; work one tier at a time; a tier is done only when its DONE WHEN passes.
- **Plans & brainstorms:** every brainstorm/planning session writes to `docs/plans/YYYY-MM-DD-<topic>/` — a `design.md` (decisions + rationale, marked approved by Papa) plus sliced plan files `NN-<slice>.md`, each with its own dependencies and DONE WHEN. Slices ship independently. Where a design.md and SPEC.md disagree, the newer approved design wins for its features. Approved plans currently pending: `docs/plans/2026-07-26-homework-lock-drills-outing/`.
- After ANY edit to index.html or js/: run `node scripts/check.mjs` (or /check). Red check ⇒ do not commit.
- Conventional commits. Small commits per feature, not per tier.
- Timezone: all "day" computations via one shared helper pinned to Asia/Taipei.

## Verify
- `node scripts/check.mjs` — syntax + data integrity (bilingual completeness, pool alignment, no dup vocab keys, no secrets in tracked files).
