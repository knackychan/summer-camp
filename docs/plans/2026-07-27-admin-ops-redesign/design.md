# Design — Admin ops redesign ("Operations")

**Date:** 2026-07-27
**Status:** approved by Papa (brainstorm session, Claude Code)
**Scope:** `admin.html`, `css/admin*.css`, `js/admin.js`, `js/admin-nav.js` (new), `scripts/check.mjs`, one line in `CLAUDE.md`. **No kid-facing change** — `index.html`, `js/*-data.js`, game code and `supabase/schema.sql` are untouched.
**Supersedes:** `docs/plans/2026-07-26-admin-layout/design.md` (slices 12–14) for admin *layout*. Its behavioural decisions D1–D5 and D8 survive and are restated below; D6, D7 and the three-column shell are replaced. Every non-negotiable in `CLAUDE.md` stands unchanged.
**Reference build:** `admin-prototype.html` at the repo root — a working standalone prototype of the target. It is the visual contract for slices 20–29 and is deleted in slice 29.
**Slices:** `19` … `29` (numbering continues the global sequence; 01–08 homework-lock, 09–11 brain-gym, 12–14 admin-layout, 15–18 game-platform).

---

## Context

Papa runs the admin live all day on a desktop second screen while three kids work on tablets. Today's `admin.html` is 197 lines of markup driving 1277 lines of CSS and 1353 lines of JS, arranged as one scrolling column between two sticky rails, with seven `<details>` folds. An audit on 2026-07-27 found:

| # | Problem | Evidence |
|---|---|---|
| A1 | **No navigation.** No routes, no addresses. Fold state in `localStorage["sq-admin-folds"]` means the page differs per machine and the same button lands in a different place each visit. | `ledgerAllBtn` must do `fold.open=true` + `scrollIntoView()` (`js/admin.js:1329`) — the UI fighting its own layout |
| A2 | **Rails are reversed** vs the approved slice-12 design. | `css/admin.css:42` `grid-template-areas: "right center left"` vs `design.md §2` `300px 1fr 380px` |
| A3 | **1400px breakpoint breaks decision D2.** Grant stars drops below the conversation; the left rail also unsticks at 1400 instead of 1080. | `css/admin.css:1122-1142` |
| A4 | **Flat hierarchy by rule.** Twelve identical `.panel` surfaces; `p { color: muted; font-weight: 700 }` makes every paragraph bold grey, so nothing can be emphasised. | `css/admin.css:31-34`, `:136-147` |
| A5 | **Same palette as the kids' app, dimmed.** Gold `#FFC93C` simultaneously means primary button, star, needs-you, focus ring and Papa's chat bubble. | `css/admin.css:1-11` vs `index.html:18-21` |
| A6 | **Monospace on `<body>`** as a costume. 中文 falls to a fallback CJK face with different metrics, breaking alignment exactly where the project promises bilingual. | `css/admin.css:21` |
| A7 | **Destructive actions read lighter than safe ones.** `.btn--danger` is a transparent ghost; primary is filled gold. Confirmation is `window.confirm()`; the pause reason is `window.prompt()`. | `css/admin.css:279-283`, `js/admin.js:1240` |
| A8 | **Grant stars is a trap.** Reason and custom amount are *shared* inputs below three kid rows, so a tap writes whatever text is in the field — including text typed for a different kid. | `js/admin.js:568-580` |
| A9 | **No loading / empty / error states, and re-render destroys work.** Every realtime event on ten tables calls `loadAll()` → `renderAll()`, wiping scroll, open folds and half-typed reason text. Only `chatStuckToBottom` is protected. | `js/admin.js:1290-1305`, `:287-301` |
| A10 | **Colour-only encoding and no keyboard reorder.** Kid identity is a `::before` bar; `.drag-handle` is a `<button>` bound only to `dragstart`. Filter chips carry no `aria-pressed`. | `css/admin.css:159-165`, `js/admin.js:341`, `:849-885` |
| A11 | **Dead CSS.** Nine class blocks (~110 lines) have zero references in markup or JS: `grant-big`, `grant-more`, `grant-reset`, `layout-two`, `comms-layout`, `notify-panel`, `inbox-panel`, `message-composer`, `subsection-title`. | verified 2026-07-27 |
| A12 | **Colour is scattered.** 25 hex literals + 28 `rgba()` calls in `css/admin.css`, 3 more hexes in `js/admin.js` (`KIDS[].color`), injected at 12 sites as `style="--kid-color:…"`. Changing the palette means editing two languages in ~65 places. | verified 2026-07-27 |

---

## 1. Papa's decisions (verbatim intent)

| # | Decision |
|---|---|
| **D1** | *(carried from slice 12)* Usage model is **live all day, desktop second screen**. Design for glance-and-react, not batch review. |
| **D2** | *(carried)* **Grant stars** and the **live conversation** must be reachable without hunting. |
| **D3** | *(carried)* Ask inbox + Captain claims + Pass requests are **one stream**, not three panels. |
| **D4** | *(carried)* That stream is a **chat-style panel on the right** — kid rows left, Papa rows right, send box at the bottom. |
| **D5** | *(carried)* The stream **filters by kid and by kind of message**. |
| **D8** | *(carried)* Ledger is **split**: recent entries for confirmation, full ledger for audit. |
| **D19** | The admin gets **its own visual identity**, clearly not the kids' playground. Operational, structured, focused, efficient. No playful decoration, no oversized hero, no kid-themed visuals. |
| **D20** | **Navigation replaces folds.** Real routes with addresses. Persistent left rail. Fold state is deleted, not migrated. |
| **D21** | **The day board is one shared timeline** across all three kids, not three parallel kid cards. |
| **D22** | **The palette must be swappable later.** Two token layers: L1 primitives are the only block Papa edits; L2 semantic roles are what components use. Enforced by `scripts/check.mjs`, not by comment. One alternate theme ships to prove the split works. |
| **D23** | **Operator chrome is English-only.** 繁體中文 stays required wherever a string is echoed to a kid. `CLAUDE.md` is amended to scope the invariant to kid-facing strings. |
| **D24** | **Light ground by default, dark via `prefers-color-scheme`.** Chosen from the use scene: daylit second screen beside the kids; dark for the evening dinner-gallery run. |
| **D25** | Tablet-first coarse-pointer sizing is a **kid-facing** rule. Admin is Papa's desktop and may use 26px controls — but below 820px every action stays visible without hover. |

---

## 2. Visual direction

**Thesis.** A shift board, not a dashboard. Papa's question at 09:40 is *who is where, and who needs me*. So the surface is one ruled timeline across three kids, with the day's exceptions lifted above it. It refuses the three-identical-kid-cards column the current admin ships, and refuses the hero-metric tile row every admin template ships.

**World.** A printed duty roster / ops sheet. Cool paper ground, hairline rules, ruled bands instead of boxes, no card shadows, tabular figures, status written as a code word plus a 5px dot.

**Colour rule (this is a system constraint, not a mood).** Chrome is graphite by rule, so **the only saturated colour on the page is data**: the three kid hues, star amber, alert red, warn amber, good green. Any new saturated colour must be justified as data or it does not ship. This is what keeps a palette swap safe — swapping chrome hues cannot accidentally change what a colour *means*.

**Type.** Public Sans over a system stack, `font-variant-numeric: tabular-nums` on the body. Micro-labels (`.lbl`) are used only for column headers and rail section headers — they are the sheet's field-name grammar, never a decorative eyebrow.

**Kid hues re-tint for light ground.** The playground hues are tuned for dark purple and fail contrast on paper. Same hue, darker tint, identity preserved:

| Kid | Playground (dark) | Ops light | Ops dark |
|---|---|---|---|
| Lucien | `#3DDC97` | `#0F7C55` | `#3DDC97` |
| Lili | `#FF6FB5` | `#B3306E` | `#FF6FB5` |
| Luis | `#4EA8FF` | `#1857C4` | `#6BB6FF` |

Colour never carries meaning alone: every kid mark pairs the hue with an initial tile, and every table row states the name in text.

---

## 3. Shell and navigation

```
┌──────────┬────────────────────────────────────┬──────────────┐
│ nav 232  │ top bar 56 — route · Taipei clock  │ dock 372     │
│          │            · live · Refresh · Grant│              │
│  Run     ├────────────────────────────────────┤ Conversation │
│  Today   │  ruled status band (4 cells)       │ pinned note  │
│  Inbox 3 │  ────────────────────────────────  │ kid filter   │
│  Stars   │  Waiting on you  (table, inline)   │ kind filter  │
│          │  ────────────────────────────────  │ ─────────────│
│  Manage  │  Day board (time gutter × 3 kids)  │ stream       │
│  Kids    │  ────────────────────────────────  │              │
│  Content │  Recent stars (undo per row)       │ ─────────────│
│  Reports │                                    │ send box     │
│  System  │                                    │              │
│  Settings│                                    │              │
├──────────┴────────────────────────────────────┴──────────────┤
│ Papa · signed in                                             │
└──────────────────────────────────────────────────────────────┘
```

Seven routes, hash-addressed:

| Route | Job | Replaces |
|---|---|---|
| `#today` | ops board, live | `#overview` + rails + `acts` fold |
| `#inbox` | full conversation, history, photo proofs | conversation rail + `proofs` fold |
| `#stars` | grant + full ledger, filter, export | grant panel + `ledger` fold |
| `#kids` | 3-row table → detail: locks, PIN, presence | `applocks` panel + `settings` fold |
| `#content` | Papa's daily message (EN+中文), day template read-only | `note` fold |
| `#reports` | 14-day counts per kid | `history` fold |
| `#settings` | Papa PIN, session, day behaviour, danger zone | scattered |

The **conversation dock is present on every route** — that is how D2 and D4 survive the move to navigation. Below 1280px it becomes a drawer with a counted trigger in the top bar.

**Deleted outright:** the `<details class="fold">` machinery and its `sq-admin-folds` key, the raw notify feed (duplicate of the stream), the "Activities ticked today" panel (folds into the kid row and the ledger), per-fold count badges on archives, the `clamp(26px,4vw,44px)` page title, and the nine dead CSS blocks from A11.

---

## 4. Token architecture (D22)

Three files, one direction of dependency. **Nothing below may reach above.**

```
css/admin-tokens.css   L1 primitives  ← the ONLY block edited to reskin
                       L2 semantics   ← never edited to reskin
css/admin-shell.css    consumes L2 only
css/admin.css          consumes L2 only
js/admin.js            consumes no colour at all
```

```css
/* ---------- L1 · primitives · edit this block to reskin ---------- */
:root {
  --p-ground:#EBEEF1; --p-sheet:#FFFFFF; --p-sheet-2:#F6F8F9;
  --p-ink:#14181D;    --p-ink-2:#4C555F; --p-ink-3:#6E7880;
  --p-rule:#DCE1E6;   --p-rule-2:#C2CAD1;
  --p-signal:#14181D; --p-signal-ink:#FFFFFF; --p-focus:#1857C4;
  --p-alert:#B42318;  --p-warn:#92400E;   --p-good:#0F7C55; --p-star:#A16207;
  --p-kid-1:#0F7C55;  --p-kid-2:#B3306E;  --p-kid-3:#1857C4;
}
@media (prefers-color-scheme: dark) { :root { /* same names, dark values */ } }
[data-admin-theme="graphite"] { /* same names, alternate values */ }

/* ---------- L2 · semantics · components use ONLY these ---------- */
:root {
  --surface-page:  var(--p-ground);
  --surface-sheet: var(--p-sheet);
  --text-1: var(--p-ink);  --text-2: var(--p-ink-2);  --text-3: var(--p-ink-3);
  --border-hairline: var(--p-rule);  --border-strong: var(--p-rule-2);
  --action-bg: var(--p-signal);      --action-fg: var(--p-signal-ink);
  --status-late: var(--p-alert);     --status-now: var(--p-warn);
  --status-done: var(--p-good);      --star: var(--p-star);
  --kid-lucien: var(--p-kid-1); --kid-lili: var(--p-kid-2); --kid-luis: var(--p-kid-3);
}
```

**Enforcement in `scripts/check.mjs` — three rules, red on violation:**

1. No `--p-` reference outside `css/admin-tokens.css`.
2. No colour literal (`#hex`, `rgb(`, `rgba(`, `hsl(`) in any `css/admin*.css` except `css/admin-tokens.css`. `transparent`, `currentColor`, and `color-mix(in srgb, var(--…) …)` are allowed.
3. No colour literal in `js/admin.js`.

Rule 3 forces `KIDS[].color` to be deleted from JS (A12). The 12 `style="--kid-color:${k.color}"` sites become a `k-${id}` class, and the hue lives in L1 like every other colour. **After these three rules pass, changing the palette means editing exactly one block in one file** — the check proves it, so the guarantee cannot rot.

Slice 28 adds a fourth rule: a WCAG contrast gate over a fixed list of (foreground, background) L2 pairs, ≥4.5:1 for body text and ≥3:1 for large text, computed for every shipped theme. A palette swap that hurts legibility fails the check instead of shipping.

Theme selection: `data-admin-theme` on `<html>`, persisted in `localStorage["sq-admin-theme"]`, set from a Settings control. Absent attribute = default theme. **Theme is palette identity; light/dark is scheme** — each theme block defines both, so the two axes never fight.

---

## 5. Workflow fixes

| Fix | Was | Becomes |
|---|---|---|
| **Grant reason** (A8) | one shared field under three kid rows | a reason input **inside** each kid's row; no cross-kid mistake possible |
| **Destructive weight** (A7) | ghost button, lighter than primary | outlined at rest, fills red on hover; every irreversible action collected in Settings → Danger zone with what it writes stated in the row |
| **Confirmation** (A7) | `window.confirm` / `window.prompt` | in-page confirm on the toast, 6s window, with the consequence written out |
| **Re-render** (A9) | `loadAll()` wipes scroll, folds and typing | render is scoped to the changed table's route; the active element's value, selection and scroll are preserved across a re-render |
| **Attention** (A4) | a 12px pill in a rail header | "Waiting on you" is the first table on `#today`, and the count lives in the nav, the top bar and the band |
| **Reorder** (A10) | drag only | drag **or** focus the time cell and press ↑ / ↓ |

---

## 6. Responsive

| Width | Behaviour |
|---|---|
| ≥1401 | nav 232 · main · dock 372 |
| 1281–1400 | dock narrows to 336 |
| 1025–1280 | dock becomes an overlay drawer, counted trigger in the top bar |
| 821–1024 | nav collapses to a 60px icon rail; status band goes 2×2 |
| ≤820 | nav goes off-canvas behind a hamburger; the board stacks per kid; tables become ruled label/value rows (still a sheet, never a card); all actions visible without hover (D25) |

---

## 7. Non-goals

- No change to `index.html`, `js/*-data.js`, game code, or anything a kid sees.
- **No schema change.** Every route reads tables `js/admin.js` already fetches. Slice 12's `admin ask` policy is assumed present.
- No new dependency, no framework, no build step. Plain CSS custom properties, plain DOM, matching the existing file style.
- No kid CRUD — `KIDS` is a fixed 3-entry roster.
- No CMS — day blocks, activity bank and learn guides stay in `js/*-data.js`; `#content` reports what shipped and links to source.
- No live palette editor and no theme sync across machines (rejected as over-build; `localStorage` is enough).

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Slices 20–21 are destructive and land mid-summer, mid-use | Every slice leaves the admin fully working. Slice 20 moves existing panels into routes *before* slice 21 restyles them, so a broken visual never coincides with a broken function. |
| Deleting the fold shell loses an action that had no route | Slice 20 lists every interactive element in today's `admin.html` and asserts each has a route home before the old markup is removed. |
| Colour sweep (A12) misses a literal and a theme swap looks broken | The three check rules are what make the sweep provable. Slice 19 is not done until they are green. |
| Contrast gate blocks a palette Papa wants | The gate reports the failing pair and its ratio, so the fix is one value, not a hunt. Threshold is WCAG AA, not AAA. |
| Preserving typing across a realtime re-render (A9) is fiddly | Scoped to the active element only: id, value, `selectionStart/End`, and the nearest scroll container's `scrollTop`. Covered by a unit test in slice 20. |
| The prototype drifts from the build | `admin-prototype.html` is the visual contract for 20–29 and is deleted in slice 29. It is never loaded by the app and never referenced by `sw.js`. |

---

## 9. DONE WHEN (design level)

- `scripts/check.mjs` is green and enforces all four token rules.
- Changing the admin palette requires editing **one block in `css/admin-tokens.css`** and nothing else; the alternate `graphite` theme proves it.
- Every action reachable in today's `admin.html` is reachable in the new admin, from a named route.
- `#today` shows the shared day board, the waiting-on-you queue and the status band above the fold at 1440×900.
- The conversation is reachable on every route without navigating away.
- No `<details class="fold">`, no `sq-admin-folds` key, no dead CSS block from A11 remains.
- At 820px the page renders as one column with no horizontal scroll and no hover-only action.
- `CLAUDE.md` records D23 so the bilingual invariant and the code agree.
- `admin-prototype.html` is deleted.
