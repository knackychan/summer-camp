# Slice 04 — Local guide: questions, schedule-aware picks, reroll, saved decisions

**Implements:** design.md D5, D6, D8 (local source), D12 (guide offline). After this slice the whole feature works **without AI**.
**Depends on:** slice 01 (card + data), slice 03 (admin history table to show rows). Slice 02 is recommended so all 8 activities can be started.

## Changes
- **`js/home-help-data.js`**: implement `SQHomeHelp.eligible(kid, ctx)` per design D6: drop rules, scoring, a stable `kid:day:slot:reroll` seed for ties, variety penalty from the last two decisions. Add `slotOf(minutes)` and `pick(kid, ctx, reroll)` → 3 ids plus local bilingual lines (the activity `pitch` + per-kid `goal`). Reroll cycles through the whole eligible list before repeating.
  - `ctx` is built by one helper in `index.html` from `SQ_DAY.nowMins()`, `SQ_DAY.iso()`, `DAY` with template and overrides (`SQTime.timelineInfo`), today's claims, and the answers. No other clock source.
- **Guide UI** (`index.html`, using the `SQSummerAgent` bubble/chips look):
  - Q1 done-today chips (pre-ticked from today's claims), Q2 time chips, then 3 cards + 🎲 *Other ideas 換一批* + Back. Tap-only: no text inputs anywhere.
  - Card tap → that kind's existing `beginPointAttempt` flow. On finish the card shows ✓, or "Papa will check 爸爸會確認", and the gate card's bar updates.
  - After 20:30 or with an empty eligible list: the kind rest line (design D6), no cards.
  - `SQSummerAgent` gains stages `help_done`, `help_time`, `help_pick`. Their local provider returns the above. `ENERGY_CHOICES` and `INTENT_CHOICES` are untouched.
- **Saved decisions**:
  - `localStorage` `sq:guide:v1` = `{[kid:day:slot:reroll]: decision}`; earlier days pruned on boot.
  - Reopen in the same slot → saved decision, minus picks done or started since. Refill from the local ranking.
  - New table **`guide_decisions`** (design D8 DDL) + RLS: read all; anon insert `with check (source = 'local')`; anon update only `started_id`; admin all. Migration `2026xxxx_guide_decisions.sql`, idempotent.
  - `js/sync.js`: `saveGuideDecision(row)` queues an upsert on the primary key, using the existing offline queue (a replay is a no-op). `markGuideStarted(key, id)` likewise. Hydrate today's and the last 7 days' rows for the active kid and admin.
- **Admin**: the slice 03 history table fills. Columns: day, slot, answers, 3 picks, source, rerolls, started.
- **`scripts/check.mjs`** + `scripts/home-help.test.mjs`:
  - Fixed clock cases: 10:05 on a normal day → Homework first; 12:10 → Table (lunch slot); 18:30 → no Homework and no Garden; 21:00 → empty, with the rest line.
  - Done or claimed activities never appear. A kind at its limit never appears. Same inputs → same 3 ids on two runs. Reroll 1 ≠ reroll 0 while ≥ 6 are eligible.
  - Cache: reopening the same slot calls `pick` 0 more times; a new slot calls it once.

**DONE WHEN:** `node scripts/check.mjs` green. In the browser with the gate on: Lili below threshold taps 🧭, answers both questions, gets 3 fitting cards, rerolls twice and sees new ones each time. Closing and reopening shows the saved set. Starting Garden shows it as started in admin's history on the second screen. Wifi off: the same flow works and the decision syncs after reconnect, with no duplicate row. `scripts/check-android8-ui.py` with Chrome 138 passes. Papa looks at the guide on a tablet.
