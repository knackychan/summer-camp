# Slice 26 — Kids route: locks, PINs, presence

**Depends on:** 20 (routes), 21 (table + chip vocabulary).
**Design:** `design.md` §3.

## Why

Today a kid's state is scattered across three places: `#applocks` in a rail, `#pinSettings` in a fold, and their progress inside `renderOverview()`. Answering "what is going on with Luis" means visiting three containers. One table plus one detail panel answers it in one place.

## Files

- `js/admin.js` — `renderAppLocks()` and `renderPins()` merged into `renderKids()` + `renderKidDetail()`
- `admin.html` — `#view-kids`

## Steps

1. **Kids table**, one row per kid: Kid · Stars · Day (`covered/total`) · App (Running / Paused) · Category locks · PIN (Set / Not set) · Manage.
2. **Detail panel** below, showing the selected kid:
   - **Pause app** — the whole-app pause. Reason is captured in an in-page field, replacing `window.prompt()` (A7). `applock_${id}` in `family_settings`, unchanged semantics.
   - **Category locks** — `games`, `acts`, `learn`, `ask`, `captain` (captain only for Luis, as today) as `aria-pressed` chips writing `catlock_${id}_${cat}`.
   - **Kid PIN** — 4 digits, `family_settings` / `kids.pin` path unchanged, with the existing pending/ok/error feedback states rendered as `.field__hint` rather than a bespoke `.pin-message`.
   - **Last seen** — derived from the most recent `day_ticks` row for that kid. Read-only, no schema change.
3. **Coach, not cop** (`CLAUDE.md`): the panel states plainly, next to the controls, that My Day, guides, Learn and the ask channel stay open in every state except a full pause. A locked category is never styled as punishment — `.tag--late` marks it as a *state*, with the time it started.
4. **Locks are live state, not archive.** A paused kid is visible from the `#today` band (slice 23) and from the nav count, so this route is where you *change* it, never where you *discover* it.

## DONE WHEN

- Every lock and PIN action available today works from this route, verified against a real tablet reacting to the change.
- No `window.prompt()` or `window.confirm()` remains in `js/admin.js`.
- Pausing a kid is visible on `#today` without navigating to `#kids`.
- The panel states the coach-not-cop guarantee in plain words next to the controls.
- `node scripts/check.mjs` green.
