# Slice 12 — Parts browser in the left rail, no bottom tray

**Requested by Papa, 2026-10-04** ("Left-rail category navigation, preserve game viewport"). Amends design.md with D23. Supersedes the bottom dock of slice 08 (D14 keeps its intent: the 3D view never resizes) and moves the slice 11 tray header into the rail.

**Depends on:** 11.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D23 | **The left rail is the whole parts browser; the bottom tray is gone.** The rail opens on the categories. Tapping a category shows that category's parts in a two-column grid that scrolls vertically, with a ← Back arrow ("Back to all pieces 回到全部積木") and the title "Bricks 積木: 9 parts 9 種". Search and the size filter sit at the top of the rail; typing a search or picking a size shows the results in the parts view; Back clears both and returns to the categories. Favourites and recents keep their sections, now as full-width headers that show EN + 中文. The colours sit at the foot of the rail in both views, so a selected piece can always be recoloured. The rail is one fixed width (184 px; 152 px ≤ 760 px wide; 112 px and one column ≤ 520 px) in both views and for every category. The fold button (‹) stays in the categories view; opening a category unfolds the rail. The "↕ bigger build area" button is removed: it only existed to win back the tray's height. Pre-readers get icon-only categories two to a row and no text box. Hint: "Choose a piece on the left 從左邊選一塊積木". | The tray took ~190 px of height on a landscape tablet; the 3D view now runs to the bottom of the screen. A fixed rail width means switching category or view never resizes the WebGL canvas, which is what clears it and flashes (D14). |

**Follow-up, same day (Papa: "yes" to the suggestion):** search and the size filter fold under a 🔍 button in the rail head, so a 600 px-tall tablet shows 3 rows of parts and 5 categories instead of 2 and 4. 🔍 opens both and focuses the box; while a filter is on they stay open; 🔍 again clears the filter and folds them; Back and picking a category fold them too. Pre-readers have no text box, so no 🔍. The head title is two short lines, "Bricks" / "積木 · 9", so it fits between the head buttons.

The pasted brief also described a right rail of tools; that rail no longer exists — tools are the bubble on the selected piece (slice 05, D8), and they are unchanged.

## Changes
- `js/brick-lab/brick-lab.js` — shell: rail head (fold / Back / title), search, size, categories, parts, colours; `<footer class="sqbl-bottom-tray">` removed. `setRailView()`, `railView` state (`snapshot().tray.view`), Back handler, `setFilters` opens the parts view on a search, vertical scroll kept across favourite/recent re-renders, hint text.
- `css/brick-lab.css` — fixed-width flex-column rail, view visibility by `data-view`, two-column parts grid, horizontal section headers, wrapped colour grid, bottom-tray and build-focus rules removed.
- `scripts/check-brick-lab-ui.py` — `pick()` opens a category from the rail; checks no bottom tray, the view reaches the app's bottom, 🔍 opens / focuses / clears and folds search without resizing the view, categories ↔ parts keep the canvas and rail size, two columns, Back clears filters, Explore hides the rail.

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes; `check-android8-ui.py` with Chrome 138 passes.
