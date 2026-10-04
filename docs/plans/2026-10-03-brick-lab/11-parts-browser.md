# Slice 11 — Parts browser: search, size filter, favourites, recents, info card

**Requested by Papa, 2026-10-04** (same brief, issue 3). Amends design.md with D21–D22.

**Depends on:** 09.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D21 | **The tray header holds the count, a search box and a size filter, at one fixed height.** It reads "Bricks 積木: 9 parts 9 種". Search matches EN and 中文 names, category names and sizes (typing "2x4" finds 2×4) across *every* category. The size filter is a native select of every footprint. Tapping a category clears both. Pre-readers get no text box; they see "🧱 9". The header grew from 34 px to 44 px once, for touch-size controls; it stays the same height in every category (D14 holds). | Finding a part without knowing its category, without moving the 3D view. |
| D22 | **Favourites, recents, info card.** Each tile has a ☆ (a sibling button, never nested) that pins the part to a ★ section at the front of the tray. A 🕘 section holds the last 5 parts placed from the tray. Both are saved per kid in `sq:brick-lab:prefs:v1:<kid>` (local only, like builds, D6). Tapping a tile still arms it, and also opens a small card over the bottom-left of the view: name EN + 中文, footprint in studs, height in bricks/plates, available colours (or "Comes in its own colours"), rail-end count and a one-line snap guide, with a ★ toggle. Any tap elsewhere closes it. | One tap still places (D8). The card adds information without adding a step, and as an overlay it never resizes the canvas (D9). |

## Changes
- `js/brick-lab/brick-lab.js` — sectioned `renderPartTray()`, one delegated tray listener, `setFilters`, `toggleFavorite`, `rememberRecent`, `showInfo`/`hideInfo`, snapshot `tray` state.
- `js/brick-lab/brick-storage.js` — `loadPrefs` / `savePrefs`.
- `css/brick-lab.css` — header controls, tile slots and stars, section markers, info card.
- `scripts/check-brick-lab-ui.py` — search (中文 and "2x4"), size filter, favourites pin and persist, recents, info card open/close.

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes; `check-android8-ui.py` with Chrome 138 passes.

**Verified 2026-10-04:** `check.mjs` green (includes `brick-rails.test.mjs`, 8/8); `check-brick-lab-ui.py` 60/60 on source (Chromium 141 headless, SwiftShader), no page or console errors. Not yet run: `check-android8-ui.py` with Chrome 138, because no Chrome 138 binary was available in the build container.

Found on the way: a tray row longer than the screen (favourites + recents + Bricks) widened the whole app and pushed Save off-screen. `.sqbl-app` now has a `minmax(0,1fr)` column; the UI check asserts it.
