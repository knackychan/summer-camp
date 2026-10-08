# Slice 03 — Papa's controls and the admin view

**Implements:** design.md D7 (write side + admin view; the decision history shows rows once slice 04 writes them).
**Depends on:** slice 01. (Slice 02 is not required; the view simply shows whichever kinds exist.)

## Changes
- **SQL** (`supabase/migrations/2026xxxx_games_gate_settings.sql`, idempotent): seed `games_gate_v1` with `{"enabled":false,…}` (design D7 defaults) and add a branch to `points_guard_settings`: writes to `games_gate_v1` need `points_parent()`, and the JSON is validated (thresholds integers 0–300 in steps of 5 for the 3 kids, `rerollsPerSlot` 0–10, AI caps ≥ 0). If the points rollout isn't live yet, the seed runs and the guard branch is added to the same function when 2026-10-03 lands (the migration checks for the function and says which step to re-run).
- **`js/admin.js`** (English chrome, D23), in **Quests → Points & assignments**, a "Games gate" card:
  - Master switch *Games gate on/off*.
  - Per kid: today's points / threshold bar, state badge (`open`, `open — Papa`, `waiting N`), threshold stepper (−5 / +5, 0 = off), **Open Games today** / **Undo** (writes `braingate_<kid>` = today / empty, as the tablet PIN does).
  - Read-only "Guide decisions (7 days)" table, empty until slice 04.
  - Realtime: listens to `family_settings`, `points_claims` and (from 04) `guide_decisions`, using the existing channel helpers.
- **Shared meaning of `braingate_<kid>`:** comments in `index.html`, `js/sync.js` and `js/admin.js` say it now means "Papa opened Games today" for both gates. Tablet copy: "Papa opened Games for today 爸爸今天打開了遊戲".
- **Local-only mode** (no `config.js`): the tablet's 🔧 Papa menu gets "Games gate: on/off" and per-kid thresholds, saved in the local settings cache (D12).
- **`scripts/check.mjs`**: `admin.html` loads `games-gate-core.js`, and admin and tablet compute the same state for a fixture (one shared function, no copy).

**DONE WHEN:** `node scripts/check.mjs` green. From admin: switching the gate on with Lucien = 40 closes Games on Lucien's tablet within 2 s (realtime) when he has fewer points, and leaves the other two alone at threshold 0. Open Games today opens his tablet live. Undo closes it again unless he has since reached 40. A kid client can't write `games_gate_v1` (an RLS / guard error in a SQL test). Admin shows the right today / threshold for all three kids against a seeded fixture.
