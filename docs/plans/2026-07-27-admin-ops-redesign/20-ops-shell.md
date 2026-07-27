# Slice 20 — Ops shell: nav rail, top bar, routes, dock

**Depends on:** 19 (tokens exist, colour lives in one file).
**Design:** `design.md` §3, decisions D20, D1, D2, D4. Fixes audit A1, A2, A3, A9.
**Visual change:** structural only. Panels keep their current look and move into routes; slice 21 restyles them.

## Why this shape

Folds are not navigation. `ledgerAllBtn` having to force `fold.open=true` then `scrollIntoView()` (`js/admin.js:1329`) is the UI fighting its own layout. Replacing folds with routes also deletes the reversed-rail bug (A2) and the 1400px breakpoint bug (A3) rather than patching them.

## Files

- `admin.html` — body replaced: nav rail, top bar, `.view` sections, dock
- `css/admin-shell.css` — **new**: grid shell, nav, top bar, dock, drawers
- `js/admin-nav.js` — **new**: hash routing, drawers, clock, focus preservation
- `js/admin.js` — fold machinery deleted; `renderAll()` becomes route-scoped
- `scripts/check.mjs` — coverage assertion (below)

## Steps

1. **Inventory before deleting.** List every interactive element in today's `admin.html` (buttons, inputs, toggles, `<details>`) and write the route each one lands in. Commit this table into this file before removing markup. Nothing ships until every row has a home.
2. **Rebuild `admin.html`** as `nav.nav` + `main.main` + `aside.dock` inside `div.app`, per `admin-prototype.html`. Seven `<section class="view" id="view-*">`, all but `#view-today` `hidden`. Login and config-needed states render in `main` with the nav and dock suppressed (`.app.is-locked`).
   - **The nav, main and dock must all be children of `.app`.** The prototype shipped this wrong once: `<nav>` as a sibling left grid column 1 empty and stacked the rail above the page.
3. **Write `js/admin-nav.js`:** hash routing (`#today` … `#settings`), `aria-current="page"` on the active nav link, route title into the top bar, `history.replaceState`, nav and dock drawers with a shared scrim, Escape closes both, live `Asia/Taipei` clock.
4. **Move panels into routes** with markup otherwise unchanged, per design §3. `#today` gets `overview` and `ledgerRecent`; `#inbox` gets the conversation and proofs; `#stars` gets grants and ledger; `#kids` gets applocks and pins; `#content` gets the note; `#reports` gets history; `#settings` gets the admin PIN and the day toggles.
5. **Delete the fold machinery:** `FOLD_KEY`, `openFolds()`, `bindFolds()`, `renderFoldCounts()`, every `<details class="fold">`, `.fold*` CSS, and the `sq-admin-folds` key. Also delete the raw notify feed and the "Activities ticked today" panel (design §3).
6. **Scope `renderAll()`.** It takes an optional route; realtime events re-render only the routes that read the changed table. Keep a `RENDER_BY_TABLE` map next to `subscribeRealtime()`.
7. **Preserve work across a re-render** (A9). Before re-render capture `document.activeElement`'s id, `value`, `selectionStart`, `selectionEnd`, and the nearest scroll container's `scrollTop`; restore after. Extract as `preserveFocus(fn)` in `js/admin-nav.js` and unit-test it.
8. **check.mjs coverage rule:** `admin routes: orphan control` — every `id` referenced by `js/admin.js` via `$("…")` must exist in `admin.html`. This is what stops step 5 from silently deleting a control.

## DONE WHEN

- All seven routes reachable from the nav, from a pasted `#hash`, and from browser back/forward.
- Every row of the step-1 inventory is reachable and works.
- Typing a grant reason, then triggering a realtime event from a tablet, leaves the text and the caret position intact.
- No `<details class="fold">`, no `sq-admin-folds`, no `#notifyFeed` anywhere in the repo.
- At 1440×900 the nav, top bar, `#today` and the dock render side by side with no horizontal scroll; at 1200 the dock is a drawer; at 800 the nav is off-canvas.
- `node scripts/check.mjs` green, including the new orphan-control rule.

## Notes

- Supersedes slices 12–14. `docs/plans/2026-07-26-admin-layout/design.md` §2 (three-column shell) and D6/D7 no longer apply; D1–D5 and D8 carry forward.
- Chat filter state (`sq-admin-chat-filters`) and the notify flag (`sq-admin-notify`) survive unchanged.
