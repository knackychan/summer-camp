# Slice 27 — Content, Reports and Settings routes

**Depends on:** 20 (routes), 21 (vocabulary), 25 (danger-zone actions move here).
**Design:** `design.md` §3, §5. Decisions D23, D7 non-goals. Fixes audit A7.

Three cold routes in one slice — each is small, none is on the hot path, and they share the same form and table components.

## Files

- `js/admin.js` — `renderNote()`, `renderDayTemplate()`, `renderReports()`, `renderAdminPin()`, `renderDanger()`
- `admin.html` — `#view-content`, `#view-reports`, `#view-settings`
- `CLAUDE.md` — one-line amendment recording D23

## Steps

### Content

1. **Papa's daily message** — two fields side by side, **English** and **繁體中文**. This string is echoed to every kid's My Day, so the bilingual invariant binds it (D23). Saves to `papa_notes` for `today`, unchanged.
2. **Day template**, read-only: `#` · Time · Block · 繁體中文 · Used. Sourced from `window.SQ_DAY_DATA`. Footer states the counts and that content is code, not a CMS, with a link to `js/day-data.js`. **No editing** — that is a non-goal (design §7).

### Reports

3. **14-day table**, one row per kid: Blocks (`done/total`) · Stars · Photos · Asks · Best day · Streak, over `rows.history` and `rows.ledger` which are already fetched.
4. Metric chips switch what the table emphasises. Footer: "Counts, not scores. Nothing here is shown to a kid." — that sentence is the coach-not-cop rule applied to reporting.

### Settings

5. **Access:** Papa PIN (4 digits, `family_settings.admin_pin`, existing save path) and the signed-in email with Sign out.
6. **Day behaviour:** the `removedCredited` toggle moved out of the old left rail, plus the desktop-notification toggle (`sq-admin-notify`). Each toggle carries a one-line explanation of what it changes — the old bare labels did not.
7. **Danger zone** — every irreversible action collected in one table, each row stating what it writes:
   - Reset today's day → un-accepts every block, refunds N stars
   - Reset a kid's stars to zero → one negative ledger row, history stays readable
   - Pause every app → all three tablets, My Day / guides / Learn / Ask stay open
   Each uses the in-page toast confirm with a 6s window, replacing `window.confirm()` (A7).
8. **Error banner** for blocked notification permission: names the problem and the recovery ("allow notifications for this site in the address bar, then reload"), dismissible.
9. **Amend `CLAUDE.md`** — scope the bilingual invariant to kid-facing strings and note that admin operator chrome is English-only (D23), so `scripts/check.mjs` and future sessions agree with the code.

## DONE WHEN

- The daily message saves both languages and appears on a tablet's My Day.
- The day template table matches `js/day-data.js` exactly and cannot be edited.
- Every destructive action lives in the danger zone, states its consequence in the row, and is confirmed in-page.
- `window.confirm` and `window.prompt` appear nowhere in `js/admin.js`.
- `CLAUDE.md` records D23.
- `node scripts/check.mjs` green.
