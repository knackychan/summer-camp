# Slice 28 — Theme switch + contrast gate

**Depends on:** 19 (token split), 21 (light palette is the default theme), 27 (Settings route exists to host the control).
**Design:** `design.md` §4. Decision D22 — this is the slice that makes the palette-swap promise real and permanent.

## Why

A token split guaranteed only by convention rots on the third busy evening. Slice 19 made the split machine-checked. This slice proves it with a second real palette and adds the check that a swap cannot quietly hurt legibility.

## Files

- `css/admin-tokens.css` — `[data-admin-theme="graphite"]` block
- `js/admin-nav.js` — theme apply + persist
- `admin.html` — `#view-settings` control
- `scripts/check.mjs` — contrast gate
- `docs/plans/2026-07-27-admin-ops-redesign/` — this file documents the swap procedure

## Steps

1. **Second theme.** Add `[data-admin-theme="graphite"]` to `css/admin-tokens.css`: a cool near-black ops ground with its own light *and* dark scheme blocks. **L1 names only.** If a single L2 or component line needs touching to make it work, the split is wrong — fix the token, not the component, and record what was missing.
2. **Apply early, before paint.** A tiny inline script in `admin.html`'s `<head>` reads `localStorage["sq-admin-theme"]` and sets `data-admin-theme` on `<html>`. Doing this in `js/admin-nav.js` would flash the default theme first.
3. **Settings control** — a small select or chip group listing the shipped themes plus "Follow system" for the scheme. Absent attribute = default theme.
4. **Contrast gate in `scripts/check.mjs`** — rule `admin tokens: contrast`:
   - Parse `css/admin-tokens.css` and resolve L2 → L1 per theme × scheme.
   - For a fixed pair list — `--text-1` on page / sheet / inset, `--text-2` on sheet, `--text-3` on sheet, `--action-fg` on `--action-bg`, each `--status-*` and each `--kid-*` on sheet — compute the WCAG contrast ratio.
   - Fail below **4.5:1** for body text and **3:1** for large text and non-text indicators, naming the pair, the theme, the scheme and the measured ratio.
   - Pure functions, no dependency: hex → sRGB → relative luminance → ratio. ~60 lines.
5. **Document the swap procedure** at the top of `css/admin-tokens.css`: edit one L1 block, run `node scripts/check.mjs`, done. Three lines, not an essay.

## DONE WHEN

- Switching themes in Settings re-skins the whole admin with no reload and no flash on next load.
- The `graphite` theme required **zero** edits outside the L1 block. If it did not, the exception is written into this file with the reason.
- `node scripts/check.mjs` fails with a named pair and ratio when an L1 value is deliberately set to a low-contrast colour, and is green after reverting.
- Both themes pass the gate in both light and dark schemes.
- `css/admin-tokens.css` opens with the three-line swap procedure.

## Notes

- Deliberately **not** built (design §7): a live palette editor, theme sync via `family_settings`, per-component L3 tokens. `localStorage` and one block of primitives are enough, and every one of those additions would be speculative.
