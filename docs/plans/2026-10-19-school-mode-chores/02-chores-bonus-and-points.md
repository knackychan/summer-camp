# 02 — Home chores, bonus tasks and their points kinds

**Design:** D3, D4, D7. **Depends on:** points-system rollout; games-gate slice 02 migration. **Status:** built 2026-10-19; the SQL waits on Papa running it live.

- `js/points.js`: 11 chore kinds (`rice_wash`, `dishwasher_load`, `dishwasher_unload`, `desk_tidy`, `bed_prepare`, `floor_toys`, `garden_toys`, `garlic_peel`, `bowls_tidy`, `altar_water`, `vacuum_floor`) and 2 bonus kinds (`gym_exercise`, `music_bonus`, `extra: true`), all Papa-checked; `extraKinds()`.
- `supabase/migrations/20261019_school_chores_kinds.sql`: the same kinds in `points_policy` and the snapshot defaults of `points_claim`. Run after `20261008_games_gate_kinds.sql`.
- `index.html`: Help at home card + ⭐ Bonus points card on My Day in both modes; tap → "All done?" → claim with `evidence.label` [en, zh]; tile states todo / waiting / confirmed / try again.

**DONE WHEN:** a tapped chore shows ⏳ and adds its points to today's bar; a bonus task shows ⏳ and adds nothing to the bar (`check-school-mode-ui.py` steps 2–3); `scripts/school-mode.test.mjs` proves every kind is bilingual and matches the SQL.
