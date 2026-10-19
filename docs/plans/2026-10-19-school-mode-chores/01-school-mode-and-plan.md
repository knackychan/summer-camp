# 01 — School mode switch and the after-school plan

**Design:** D1, D2. **Depends on:** nothing. **Status:** built 2026-10-19.

- `js/school-data.js` (`SQSchool`): `parseMode`, `modeFor` (school only Mon–Fri), `SCHEDULE` (8 bilingual rows, per kid), `currentRow`.
- `index.html`: `dayMode()`; `renderMyDay` draws `renderSchoolDay` on a school day — rows with no ticks, live Brain Gym / chores / screen-time status, past rows dimmed, never red.
- `js/admin.js`: Admin → Points → "School or holiday" radio, saved as `day_mode_v1`.
- `sw.js`: `school-data.js` in `APP_SHELL`, cache bumped.

**DONE WHEN:** with school mode on, a Monday shows the 8-row plan with nothing to tick and a Saturday shows the holiday day (`scripts/check-school-mode-ui.py` steps 1 and 5); `node scripts/check.mjs` green.
