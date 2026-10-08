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

## Build notes (2026-10-08)

**Status:** built and checked, waiting on Papa trying the admin card with his real login. The admin page needs Supabase sign-in, so the card was tested through the admin test harness, not in a browser.

- **SQL:** `supabase/migrations/20261008_games_gate_settings.sql` seeds `games_gate_v1` switched off. A trigger function of its own, `games_gate_guard_settings` (not a branch inside `points_guard_settings`), lets only the owner or a parent in `admins` (checked through a small security-definer `games_gate_parent()`, because `admins` has RLS — the first test run caught that) write the key, and checks its values (thresholds 0–300 in steps of 5, rerolls 0–10, AI caps ≥ 0, `enabled` a boolean). Deleting the key is refused. It does not depend on the points migration, so the gate can be set up before points go live. `POINTS-ROLLOUT.md` step 9.
- **Admin, Quests → Points & assignments → "Games gate"** (English):
  - On/off switch, and per child a bar with "N / M points today", a state ("Gate off", "Open — Papa today", "Open", "Waiting · N to go"), a threshold box (step 5) and **Open Games today** / **Undo open today**.
  - Today's points come from a new query of today's `points_claims` (any status), counted with the tablets' own `SQGamesGate.todayPoints`. The card refreshes on the existing realtime routes (`family_settings`, `points_claims` → quests).
- **Open Games today** writes `braingate_<kid>` = today, the same key the tablet PIN writes, and now documented as opening both gates. The tablet already re-renders on `family_settings` realtime, so it opens live.
- **Local-only mode:** the tablet's 🔧 Papa tools get **🎮 Games gate 遊戲點數門檻** (switch and per-child thresholds), shown only when Supabase isn't configured (`store.configured`). With Supabase, a tablet can't write this key, so admin owns it.
- **Deviation:** the "Guide decisions (7 days)" table is left for slice 04, which creates `guide_decisions`. An empty placeholder now would show nothing.
- **Known limit (also in a code comment):** admin can't see a tablet's "already reached today" memory (D2). A child whose claim was declined after reaching the bar shows "Waiting" in admin while their tablet stays open.
- Cache: `admin.js?v=67`, `sw.js` `summer-quest-v199-games-gate-admin`. Admin styles use the admin colour tokens (the `check.mjs` admin-tokens rule).

**Checks run:**
- `node scripts/check.mjs`: green.
- `scripts/points-admin.test.mjs`: the card renders switched off by default; with the gate on: Lili 10 / 50 "Waiting · 40 to go" (pending counts, denied doesn't), Lucien 40 / 40, Luis "Open — Papa today" with Undo.
- `scripts/check-games-gate-ui.py` on Chrome 138: Papa tools → PIN → Games gate editor saves Lili 30. Then the local setting switches the gate on (card shows 0 / 50), and threshold 0 opens Games.
- Points PostgreSQL test (Docker `postgres:17`, removed afterwards): the settings section: seeded off, a non-parent refused, 42 refused, `"yes"` refused, a negative cap refused, the parent's valid save stored, a tablet (anon) cannot switch it off, delete refused.
