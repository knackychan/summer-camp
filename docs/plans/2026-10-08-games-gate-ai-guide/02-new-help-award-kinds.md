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

## Build notes (2026-10-08)

**Status:** built and tested against a disposable PostgreSQL 17. **Not applied to the live Supabase.** That needs the 2026-10-03 points rollout first, then `POINTS-ROLLOUT.md` step 7.

- **`js/points.js`:** adds `shoe_tidy` 5 (self-checked), `garden_tidy` 15, `living_tidy` 10 and `office_tidy` 10 (Papa-checked), all category `help` and once a day. Admin's award editor, assignment list and quest award picker pick them up automatically from `SQPoints.rules`.
- **`supabase/migrations/20261008_games_gate_kinds.sql`:** re-creates `points_policy` and `points_claim`, copied from `20261003_points_system.sql`. A diff confirmed the only changed lines are the rules JSON and the snapshot-default `case`.
- **`js/quest-data.js`:** four quests, each with three bilingual steps and windows matching `SQHomeHelp`: Shoe Line-up 鞋子排排站, Garden Tidy 整理花園, Living Room Tidy 整理客廳, Office Tidy 整理辦公室 (which says to ask Papa what may be moved). Each carries `since: "2026-10-08"`.
- **Deviation: `js/quest-config.js` `catalog()`.** When Papa has a saved `quest_catalog_v1`, it fully replaced the seed list, so the four quests would never have appeared. Seed quests marked `since` that are missing from the saved catalog are now appended. A saved copy wins and Papa's pause is kept. The editor has no delete, so a missing id only means the catalog was saved before the quest existed.
- **`index.html`:** House Help / Tidy patrol ("Which job did you agree?") now also offers the four tidy jobs, so every entrance pays the same award identity.
- **Deviation: the client↔SQL guard lives in `scripts/games-gate.test.mjs`, not inline in `check.mjs`.** `check.mjs` runs every `*.test.mjs`. The guard compares every `SQPoints.rules` kind with the newest migration's rules JSON (amount, limit, category, check) and its snapshot defaults.
- **`scripts/points-database.test.mjs`:** gains a section that applies the new migration twice and checks the kinds. Garden is pending at 15, a second claim the same day returns the first, and a forged slot is ignored. Shoes self-confirm at 5. Living room and office are pending at 10. Approving garden moves `total_earned` by +20 (shoes + garden), with 20 still pending.
- `content-registry.test.mjs`: the quest count goes from 15 to 19, and the four new ids are checked.

**Checks run:**
- `node scripts/check.mjs`: green.
- `scripts/check-games-gate-ui.py` on Chrome 138: all 8 chooser cards are startable. Shoes shows no "Papa will check" and garden does. Living Room and Office open their quests.
- Points PostgreSQL test in a disposable `postgres:17` Docker container (removed afterwards): **passed, including the new section.**

**Found while testing, not caused by this slice:** the checked-in points test fails at its Brain assignment check before reaching the new section. `points_brain_trio` in SQL no longer matches `SQBrainCore.dailyThree` (for example `['crunch','stroop','memorymatch']` vs `['lowhigh','stroop','balance']`), because the SQL function hard-codes the exercise list, and that list still includes `change` (Change Maker, retired by the 2026-10-03 games-practice split), so the shuffle picks differently. Live, the server would refuse some legitimate Brain Gym claims ("Complete an assigned Brain Gym exercise first"), so kids would lose part of the 30 Brain Gym points the games gate relies on. The test above ran on a copy that took the trio from the server, to reach the new section. **This needs its own fix before the points rollout:** regenerate the SQL exercise list from `js/brain-data.js` and add a guard.
