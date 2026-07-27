# Slice 19 — Admin token layer + palette-swap guarantee

**Depends on:** nothing. First slice, ships alone.
**Design:** `design.md` §4, decision D22. Fixes audit A12.
**Visual change:** **none.** This slice is a colour *refactor* — the admin looks byte-identical after it. That is the point: the risky sweep lands with nothing else moving.

## Why first

Changing the palette today means editing 25 hex literals + 28 `rgba()` calls in `css/admin.css`, 3 hexes in `js/admin.js`, and 12 inline `style="--kid-color:…"` injections. Every later slice would add more. Land the token layer before any redesign work so slices 20–29 are written against it from line one.

## Files

- `css/admin-tokens.css` — **new**, loaded before `css/admin.css`
- `css/admin.css` — colour literals replaced by L2 references
- `js/admin.js` — `KIDS[].color` deleted; `--kid-color` injection replaced by a class
- `admin.html` — one `<link>` added
- `scripts/check.mjs` — three new rules

## Steps

1. **Write `css/admin-tokens.css`** with the two layers from design §4.
   - L1 primitives carry **today's dark values** (`--p-ground:#17132A`, `--p-sheet:#241E3D`, `--p-rule:#3A3359`, `--p-ink:#F8F4FF`, `--p-ink-3:#B7B9D6`, `--p-signal:#FFC93C`, `--p-good:#3DDC97`, `--p-alert:#FF7A90`, `--p-kid-1:#3DDC97`, `--p-kid-2:#FF6FB5`, `--p-kid-3:#4EA8FF`, `--p-sheet-3:#151127`). Light ground arrives in slice 21, not here.
   - L2 semantic names exactly as design §4 lists them. Add `--surface-inset: var(--p-sheet-3)` for the 14 `#151127` sites.
   - Every `rgba(…)` tint becomes `color-mix(in srgb, var(--…) N%, transparent)`.
2. **Add `<link rel="stylesheet" href="css/admin-tokens.css">` to `admin.html` above the existing `admin.css` link.**
3. **Sweep `css/admin.css`.** Replace all 25 hex literals and 28 `rgba()` calls with L2 references. Delete the old `:root` block. `transparent` and `currentColor` stay.
4. **Sweep `js/admin.js`.**
   - `KIDS` becomes `{lucien:{name:"Lucien"}, lili:{name:"Lili"}, luis:{name:"Luis"}}` — the `color` field is deleted.
   - All 12 `style="--kid-color:${k.color}"` sites become `class="… k-${id}"`.
   - `css/admin-tokens.css` gains `.k-lucien{--kid-color:var(--kid-lucien)}` and siblings, so the existing `var(--kid-color, …)` fallbacks in `admin.css` keep working untouched.
5. **Add three rules to `scripts/check.mjs`**, each using the existing `fail(name, detail)` helper:
   - `admin tokens: L1 leak` — `/--p-[a-z0-9-]+/` found in any `css/admin*.css` other than `admin-tokens.css`.
   - `admin tokens: colour literal in CSS` — `/#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(/` found in any `css/admin*.css` other than `admin-tokens.css`. `color-mix(in srgb, var(--…))` must not match.
   - `admin tokens: colour literal in JS` — same literal pattern found in `js/admin.js`.
   Each failure names the file and the offending literal so the fix is one line.

## DONE WHEN

- `node scripts/check.mjs` is green **and** fails as expected when a `#hex` is deliberately reintroduced into `css/admin.css` or `js/admin.js` (verify both, then revert).
- The admin renders pixel-identically to before the slice: log in, open every fold, compare against a screenshot taken before step 1.
- `grep -c "kid-color" js/admin.js` returns 0.
- Editing only the L1 block in `css/admin-tokens.css` visibly re-skins the whole admin.

## Notes

- No `data-admin-theme` and no theme switcher yet — those are slice 28. This slice ships the split and the proof, nothing speculative.
- `sw.js` caches CSS by path; add `css/admin-tokens.css` to its precache list if `admin.css` is listed there.
