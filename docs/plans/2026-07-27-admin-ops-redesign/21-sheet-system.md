# Slice 21 — Ops sheet visual system

**Depends on:** 19 (tokens), 20 (routes exist to restyle).
**Design:** `design.md` §2, decisions D19, D24. Fixes audit A4, A5, A6, A7, A11.
**Visual change:** total. This is where the admin stops looking like the kids' app.

## Scope

The component vocabulary every later slice builds from: sheet, ruled band, table, tag, button, chip, field, state. No route logic changes.

## Files

- `css/admin-tokens.css` — L1 flipped to the light ops palette + dark scheme block
- `css/admin.css` — rewritten as the component layer
- `admin.html` — class names swapped to the new vocabulary
- `js/admin.js` — emitted class names in `render*()` updated to match

## Steps

1. **Flip L1 to the ops palette** (design §2 tables) and add the `@media (prefers-color-scheme: dark)` block. Semantic L2 names do not change — this is the first real proof of the slice-19 split. If any component needs editing to survive the flip, the split is wrong; fix the token, not the component.
2. **Kid hue re-tint.** `--p-kid-1/2/3` get the light values; the dark block restores the playground hues. Every kid mark pairs the hue with an initial tile and the name in text — colour never encodes alone (A10).
3. **Body type.** Remove `font-family: ui-monospace` (A6). Public Sans over `system-ui, -apple-system, 'Segoe UI', 'Noto Sans TC', sans-serif`, `font-variant-numeric: tabular-nums` on `body`. `'Noto Sans TC'` in the stack is what keeps 中文 metrically sane in the content route.
4. **Delete `p { color: muted; font-weight: 700 }`** (A4). Weight and colour become deliberate per component.
5. **Build the components** from `admin-prototype.html`: `.sheet` / `.sheet__head` / `.sheet__tools` / `.sheet__foot`, `.band`, `.tbl` with sticky `thead`, `.tag--done|now|late|open|redo|off`, `.btn` + `--primary|--quiet|--danger|--sm|--icon`, `.chip[aria-pressed]`, `.inp` / `.field` / `.field__hint`, `.who` / `.who__m`.
6. **Fix destructive weight** (A7): `.btn--danger` is outlined at rest and fills red on hover, never lighter than `.btn--primary`.
7. **Ship the missing states** (A9): `.empty`, `.skel` loading rows with `prefers-reduced-motion` respected, `.note` / `.note--error`, and the toast with an Undo / Confirm action.
8. **Delete the nine dead blocks** (A11): `grant-big`, `grant-more`, `grant-reset`, `layout-two`, `comms-layout`, `notify-panel`, `inbox-panel`, `message-composer`, `subsection-title`. Also `.kid-card::before`, `.panel`, `.ask-card`, `.notify-*`, `.progress`, `.block-row` once nothing references them.
9. **Focus ring** moves to `--p-focus` so it never sits gold-on-gold (A5).

## DONE WHEN

- Side by side with `index.html`, the two surfaces share no ground colour, no type stack and no component geometry.
- Every state — hover, focus-visible, disabled, loading, empty, error — is reachable and screenshotted.
- `node scripts/check.mjs` green; the three token rules still pass after the palette flip, with **zero component-file edits** required by the flip itself.
- Body text ≥4.5:1 and large text ≥3:1 in both light and dark, spot-checked on ground, sheet and inset surfaces.
- No selector in `css/admin.css` is unreferenced by `admin.html` or `js/admin.js`.
