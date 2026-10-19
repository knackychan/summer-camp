# 03 — School-day thresholds and Papa's alert

**Design:** D5, D6. **Depends on:** 01, 02. **Status:** built 2026-10-19.

- `js/games-gate-core.js`: `schoolThreshold` per kid (defaults to the holiday value), `thresholdFor`, `state(..., {mode})`, `todayPoints(..., {exclude})`.
- `js/admin.js`: Holiday and School day threshold inputs per kid; the gate rows use today's mode; a `points_claims` row that becomes `pending` raises "<kid> finished a task — please check" once.

**DONE WHEN:** on a school day with Brain Gym done, Lili's 40-point school bar reached by pending chores opens screen time (`check-school-mode-ui.py` step 4); `scripts/check-games-gate-ui.py` still passes.
