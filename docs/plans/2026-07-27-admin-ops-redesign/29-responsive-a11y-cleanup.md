# Slice 29 — Responsive, accessibility, cleanup

**Depends on:** 20–28. Last slice; nothing depends on it.
**Design:** `design.md` §6, §9. Decisions D25, D19. Fixes audit A3, A10, A11.

## Files

- `css/admin-shell.css`, `css/admin.css` — breakpoints and focus states
- `admin.html`, `js/admin.js` — ARIA and keyboard
- `admin-prototype.html` — **deleted**
- `sw.js` — precache list reconciled

## Steps

### Responsive

1. Walk the four breakpoints from design §6 at 1440, 1300, 1100, 900, 800, 600 and 390 wide. Fix what overflows using the real bilingual strings from the content route, not lorem.
2. **No horizontal page scroll at any width.** Wide content — the day board, the ledger table, the reports table — scrolls inside its own `.tbl-wrap`, never the body.
3. Below 820px: nav off-canvas, board stacks per kid, tables become ruled label/value rows via `td[data-l]`, and **every action is visible without hover** (D25).
4. Confirm the nav, main and dock are children of `.app` at every breakpoint — the prototype shipped this wrong once and the symptom (rail stacked above the page) looks like a CSS bug, not a nesting bug.

### Accessibility

5. **Colour never encodes alone** (A10): every kid mark pairs hue with an initial tile and the name in text; every status tag pairs its dot with a word; the ledger Δ carries its sign in the text.
6. `aria-pressed` on every filter chip; `aria-current="page"` on the active nav link; `aria-expanded` + `aria-controls` on both drawer triggers.
7. Keyboard: full tab order through nav → top bar → route → dock; Escape closes both drawers and returns focus to the trigger; the board reorder works on `↑` / `↓` (slice 22); no keyboard trap anywhere.
8. `:focus-visible` visible on every interactive element against every surface, in both themes and both schemes — never accent-on-accent (A5).
9. `@media (prefers-reduced-motion: reduce)` disables the skeleton sweep, the drawer slide and the toast rise.
10. `role="log"` + `aria-live="polite"` on the conversation stream; `role="status"` on the toast.

### Cleanup

11. Delete `admin-prototype.html`. Confirm nothing references it, including `sw.js`.
12. Delete every selector in `css/admin*.css` unreferenced by `admin.html` or `js/admin.js` — this catches whatever slices 21–27 orphaned on top of the nine dead blocks from A11.
13. Reconcile the `sw.js` precache list with the files that now exist: `css/admin-tokens.css`, `css/admin-shell.css`, `js/admin-nav.js` in; anything removed, out.
14. Re-read `design.md` §9 and tick every line, or open a follow-up slice for what does not tick.

## DONE WHEN

- Every line of `design.md` §9 passes.
- No horizontal page scroll at 1440, 1100, 800, 600 or 390.
- Keyboard-only run through the whole admin: navigate, accept a block, reorder a block, answer an ask, grant a star, switch theme, sign out. No trap, no invisible focus.
- No hover-only action anywhere below 820px.
- `admin-prototype.html` gone; `sw.js` list accurate.
- `node scripts/check.mjs` green, including all four token rules and the orphan-control rule.
