# Slice 01 — Favourites ⭐ as a category

**Requested by Papa, 2026-10-06.** Implements design.md A1.

**Depends on:** brick-lab slices 11, 12.

## Changes
- `js/brick-lab/brick-lab.js`
  - `RECENT_MAX` 5 → 12. `loadPrefs` already trims recents to `RECENT_MAX`, so existing saves load as they are.
  - A virtual category `favorites` ("Favourites ⭐ 最愛") first in the rail's category list, with an icon tile like the others. It is not a catalog category: no part has `category: "favorites"`.
  - `renderPartTray()`: for `activeCategory === "favorites"` show starred parts, then recents not already starred, as one grid with the existing small section headers ★ / 🕘; other categories show only their own parts (the pinned sections are removed); search results unchanged. Empty state line with EN + 中文 (icon-only for pre-readers).
  - `rememberRecent()` re-renders only when the Favourites category is the one on screen.
  - `snapshot().tray` gains `favoritesCount` / `recentsCount`; `updateCategoryUI()` and the title count handle the virtual category.
- `css/brick-lab.css` — nothing new if the existing section header rules cover it; the category tile uses the existing tile class.
- `scripts/check-brick-lab-ui.py` — Favourites tile first in the list; a placed part appears in Favourites, newest first, max 12; a starred part shows in the starred group once; other categories show no ★ / 🕘 sections; an empty Favourites shows the hint; the rail and canvas keep their size between views; recents survive a reload.

**DONE WHEN:** `node scripts/check.mjs` green; `scripts/check-brick-lab-ui.py` passes; `scripts/check-android8-ui.py` with Chrome 138 passes; Papa looks at the rail at 1024×600.
