# Slice 02 — Four new home-help award kinds

**Implements:** design.md D3 (award kinds).
**Depends on:** slice 01; Papa's answer to Q2 (amounts / check); **the live points rollout** (`supabase/POINTS-ROLLOUT.md`, `20261003_points_system.sql` applied), because this slice extends that migration's functions.

## Changes
- **`js/points.js`** `rules`: add `shoe_tidy`, `garden_tidy`, `living_tidy`, `office_tidy`. Category `help`, limit 1, `parent:true` except as Papa decides in Q2. Bilingual labels: 整理鞋子 / 整理花園 / 整理客廳 / 整理辦公室. No alias, slot or `activity()` map change.
- **`supabase/migrations/2026xxxx_games_gate_kinds.sql`** (new, idempotent, one transaction):
  - `create or replace function points_policy`: the same rules JSON plus the 4 kinds (`[amount, 1, "helping", "self"|"parent"]`).
  - `create or replace function points_claim`: extend the snapshot-default `case` with the 4 kinds. No other logic change (re-pasted function, diff reviewed line by line against `20261003_points_system.sql`).
  - Note at the top: run after `20261003_points_system.sql`; safe to re-run.
- **`js/quest-data.js`**: 4 quest entries (same shape as `room_rescue`) so the kinds also appear on the Quest board and in My Day's helping list. Bilingual `title`, `blurb` and per-kid goals.
- **Admin → Points & assignments**: the existing award editor lists the new kinds automatically from `SQPoints.rules`. Verify it, and fix only if it hard-codes a list.
- **`scripts/check.mjs`**: guard that every `SQPoints.rules` kind (except bonuses) also appears in the SQL rules JSON of the newest migration that defines `points_policy`, with the same amount, limit and verification. This keeps the browser and the database from drifting apart.
- `supabase/POINTS-ROLLOUT.md`: one added step for this migration.

**DONE WHEN:** `node scripts/check.mjs` green, including the client↔SQL kinds guard. The migration applied twice on a disposable local PostgreSQL 17 (as the points tests do) gives the same result. `points_claim` for `garden_tidy` creates a `pending` claim, a second claim the same day returns the first, and `shoe_tidy` self-confirms if Q2 keeps it self-checked. In the browser, the guide's fixed list from slice 01 starts all 8 activities. Papa confirms a Garden claim in admin and the kid's today total and gate update.
