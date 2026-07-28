# Slice 35 — Space book: data + book shell + tab integration

**Goal:** Ship the first book: 23 space cards delivered as a standalone, self-contained open-book reader with left-page facts and right-page photos. Integrate a Books tab into `index.html`.

**Architecture:** `js/books/space-data.js` (pure data) → `books/space.html` (standalone reader) → `index.html` (Books tab chip + shelf). Images reused from `assets/solar/`.

**Design:** `docs/plans/2026-07-28-books/design.md`

**Depends on:** nothing. Pure data + standalone HTML. No game platform dependency.

**DONE WHEN:**
- `books/space.html` opens standalone in a browser with the open-book layout (left page = facts, right page = photo)
- Swipe, arrow keys, and ◀/▶ buttons navigate through all 23 cards
- Grid view toggle works; tapping a grid thumbnail jumps to that card
- Photo zoom works (tap right-page photo → full-screen overlay)
- `📚 Books 書籍` tab appears in `index.html` between Ask and Captain
- Space book card shows "Tap to open · 點擊打開" — opens `books/space.html` in a new tab
- Remaining 5 books show "Coming soon · 即將推出"
- `node scripts/check.mjs` passes
- All book content is bilingual EN + 繁體中文
- Works offline (all images vendored, emoji fallback on broken images)

---

## Constraints you must not violate

1. **Bilingual invariant:** every kid-facing string ships EN + 繁體中文. No exceptions.
2. **Offline-first:** images are vendored paths, never hotlinked. Emoji fallback on `<img onerror>`.
3. **Tablet-first:** coarse pointer targets, no hover-dependent interactions.
4. **Coach, not cop:** books are never locked. The Books tab is always available.
5. **Standalone HTML:** each book has its own `.html` file, self-contained (inline CSS/JS), no dependency on `index.html`'s JS state.
6. **Never delete project files.** This slice supersedes nothing — it's brand new.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/books/space-data.js` | Create | 23 cards: 8 planets, Sun, Pluto, Moon, ISS, Milky Way, 6 major moons, 3 nearby stars. EN + 中文. |
| `books/space.html` | Create | Standalone open-book reader. Inline CSS + JS. Loads `../js/books/space-data.js`. |
| `assets/solar/iss.jpg` | Create | ISS photo scraped from Wikimedia Commons (reuses existing `assets/solar/` — other 24 images already vendored) |
| `assets/solar/README.md` | Modify | Add `iss.jpg` entry to the table |
| `index.html` | Modify | Add `📚 Books` chip in `#hubTabs`; add `#tab-books` content div; add `renderBooks()` + `BOOK_SHELF`; update `tabLocked()`, `renderHub()`, `restoreAppPlace()` tabs object |
| `docs/plans/2026-07-28-books/design.md` | Create | Design rationale and decisions |
| `docs/plans/2026-07-28-books/35-book-data.md` | This file | This slice |

No `check.mjs` changes yet — data validation for books data is a future slice.

---

## Task 1: Create directory structure

- [x] Create `books/` at `summer-quest/books/`
- [x] Create `js/books/` at `summer-quest/js/books/`
- [x] Create `assets/books/space/` at `summer-quest/assets/books/space/`
- [x] Create `docs/plans/2026-07-28-books/`

---

## Task 2: Create `js/books/space-data.js`

- [x] Pure data file, no DOM, no imports
- [x] `var SPACE_CARDS = […]` — 23 entries
- [x] Each entry: `id`, `emoji`, `nameEN`, `nameZH`, `photo`, `typeEN`, `typeZH`, `facts[{en,tz}]`
- [x] Photo paths are relative to `books/` directory: `../assets/solar/<id>.jpg`
- [x] 3 facts per card, all bilingual
- [x] Data sourced from `js/games/solar-data.js` (same facts, same format)

**Cards included:**
| Category | Cards |
|---|---|
| Sun | Sun |
| Planets (8) | Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune |
| Dwarf planet | Pluto |
| Earth's moon | Moon |
| Jupiter's moons (4) | Io, Europa, Ganymede, Callisto |
| Saturn's moon | Titan |
| Neptune's moon | Triton |
| Mars moon | Deimos |
| Space station | ISS |
| Galaxy | Milky Way |
| Nearby stars (3) | Alpha Centauri, Sirius, Barnard's Star |

---

## Task 3: Scrape missing image (ISS)

- [x] ISS photo missing from `assets/solar/` (README says "not needed yet")
- [x] Scraped from Wikimedia Commons via `scrapling extract get` → extracted image path from page HTML
- [x] Downloaded 330px thumbnail (20KB) to `assets/solar/iss.jpg`
- [x] Updated `assets/solar/README.md` with ISS entry
- **Note:** Wikimedia rate-limits aggressive. One-at-a-time scraping with delays between requests.

---

## Task 4: Build `books/space.html`

- [x] Self-contained HTML following the `key_quest.html` pattern
- [x] **Top bar:** `← Books 書籍` back button, card count badge (`23 pages · 頁`), `📋 Grid` toggle
- [x] **Open-book layout:**
  - `.book` flex container with `.page-left` + `.spine` + `.page-right`
  - Left page: title (EN), Chinese subtitle, type badge (`GAS GIANT · 氣態巨行星`), 3 fact cards, page number
  - Right page: full-bleed `<img>`, gradient overlay with name + "tap to zoom" hint
  - Spine: 3px gradient line
- [x] **Navigation:** ◀ ▶ buttons with prev/next disabled logic, pager (`1 / 23`)
- [x] **Swipe:** `pointerdown`/`pointerup` detection on stage — horizontal swipe > 50px triggers page turn
- [x] **Keyboard:** ArrowLeft/ArrowRight, Home/End
- [x] **Page-turn animation:** `.turning` class applies `opacity:0.4; transform:scale(0.97)` for 180ms
- [x] **Grid view:** 4-column thumbnail grid (3-column on ≤ 560px), tap to jump to card
- [x] **Zoom:** tap right-page photo → full-screen overlay with larger image + caption
- [x] **Emoji fallback:** `<img onerror>` hides broken image, shows emoji placeholder
- [x] **Responsive:** ≤560px width → book stacks vertically (left page on top, right below)
- [x] **Dark theme** matching app: uses same `:root` CSS custom properties
- [x] **Fonts:** Fredoka + Nunito via Google Fonts `@import`
- [x] Data loaded via `<script src="../js/books/space-data.js">`

### CSS decisions
- Book pages have a slightly warmer dark tone (`--page:#2A2650`, `--page2:#312B5E`) to differentiate from the game background
- Spine gradient: `rgba(0,0,0,0.3)` → `--line` → `rgba(0,0,0,0.3)` for depth
- Photo overlay: bottom gradient from `rgba(0,0,0,0.82)` to transparent
- Fact cards: `rgba(255,255,255,0.04)` background, 14px border-radius
- All touch targets ≥ 48px

---

## Task 5: Integrate Books tab into `index.html`

- [x] **Tab chip:** Add `<button class="chip" data-t="books">📚 Books 書籍</button>` to `#hubTabs`
- [x] **Tab content:** Add `<div id="tab-books" class="hidden">` with a `.bigcard` containing a `.bankgrid#bookGrid`
- [x] **Tab locking:** Books are never locked (`tabLocked()` returns false for `"books"`)
- [x] **Toggle logic:** `renderHub()` toggles `#tab-books` visibility
- [x] **Render call:** `renderHub()` calls `renderBooks()` when `hubTab==="books"`
- [x] **State persistence:** `"books"` added to `tabs` object in `restoreAppPlace()`
- [x] **`renderBooks()` function:**
  - Builds `BOOK_SHELF` grid from static array
  - Space book: shows `🪐 Space 太空` with "Tap to open · 點擊打開" — opens `books/space.html` in `_blank`
  - 5 future books: show with "Coming soon · 即將推出" and `.locked` class styling
  - Uses existing `.gamecard` CSS class for visual consistency

### `BOOK_SHELF` array
```js
var BOOK_SHELF = [
  { id: "space", icon: "🪐", title: "Space", tz: "太空", blurb: "Planets, moons, stars & galaxies", file: "books/space.html" },
  { id: "animals", icon: "🐾", title: "Animals", tz: "動物", blurb: "Wildlife from around the world", file: "books/animals.html" },
  { id: "science", icon: "🔬", title: "Science", tz: "科學", blurb: "How things work", file: "books/science.html" },
  { id: "race-cars", icon: "🏎️", title: "Race Cars", tz: "賽車", blurb: "Fast cars & sports cars", file: "books/race-cars.html" },
  { id: "construction", icon: "🏗️", title: "Construction", tz: "工地", blurb: "Big machines & trucks", file: "books/construction.html" },
  { id: "public-vehicles", icon: "🚑", title: "Public Vehicles", tz: "公共車輛", blurb: "Police, ambulance, fire truck & more", file: "books/public-vehicles.html" },
];
```

---

## Task 6: Verify

- [x] `node scripts/check.mjs` passes (syntax + bilingual data + pool alignment + secret scan)
- [x] Open `books/space.html` directly in browser — all 23 cards navigable
- [x] Grid view toggle works
- [x] Photo zoom works
- [x] Emoji fallback renders when image fails (test: remove an image file, reload)
- [x] Back button returns to previous page
- [x] Books tab visible in `index.html` between Ask and Captain
- [~] Open from Books tab opens `space.html` in new tab (requires `python -m http.server`)

---

## DONE WHEN

- All 6 tasks checked above
- `node scripts/check.mjs` green
- `books/space.html` is a fully functional, standalone, bilingual, offline-first book reader
- Books tab appears in the main app with Space ready to read and 5 "Coming soon" placeholders
