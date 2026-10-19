# 04 — Papa's chore editor, family chores and the AI guide

**Design:** D8. **Depends on:** 02. **Status:** built 2026-10-19; `supabase/migrations/20261019b_family_chores.sql` waits on Papa running it live (after `20261019_school_chores_kinds.sql`).

- `js/school-data.js`: `choreList(settings)` reads `family_settings.chores_v1` over the built-ins; `choresFor`, `bonusIdentities`, `serialize`, `newId`.
- `js/points.js`: `family_chore` kind (slot = chore id `c_…`, amount from `chores_v1`, once a day per chore); `amount(kind, settings, slot)`.
- `js/games-gate-core.js`: `todayPoints` `exclude` accepts `kind:slot` (Papa's bonus chores).
- `js/admin.js` + `css/admin-quests.css`: Admin → Points → Chores: rename, icon, reorder, kids, on/off; added chores get points (0–100, steps of 5), check (Papa / counts straight away) and Bonus. A chore needs EN + 中文 to save. Review rows and alerts show the chore's own name.
- `index.html`: Help at home / Bonus cards read Papa's list; the home-help guide ranks his (non-bonus) chores next to its eight and opens My Day at the picked chore.
- `supabase/functions/games-guide`: `choreMap()` (built-in copy + `chores_v1`); chore candidates are accepted only when Papa's list has them on. `supabase/functions/kid-chat`: Summer is told the family's helping jobs.
- SQL: `points_claim` reads the chore from `chores_v1` (parent-only writes), refuses an unknown, switched-off or other kid's chore, never trusts the tablet's amount.

**DONE WHEN:** `scripts/check-chore-editor-ui.py` (Chrome 138) and the `family_chore` block of `scripts/points-database.test.mjs` (real PostgreSQL 16) pass; `node scripts/check.mjs` green.
