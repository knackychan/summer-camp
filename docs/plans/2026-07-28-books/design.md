# Design — Books tab: standalone educational card readers

**Date:** 2026-07-28
**Status:** approved by Papa (OpenCode session)
**Slices:** `35-book-data.md` … `40-books-complete.md`
**Implementation reference:** read `design-reference.md` before any slice after `35`.

## Context

The kids need a way to browse educational content (science, animals, vehicles, space) on their tablets. The existing Learn tab covers question-building and guides, but not visual fact-card reading. Papa wants:

- **6 book topics:** Space, Animals, Science, Race Cars, Construction, Public Vehicles
- **Open-book layout:** left page for facts/explanation, right page for photos with text overlay
- **Standalone files:** each book is a self-contained `.html` (like `key_quest.html`), not woven into `index.html`
- **Integration:** a `Books` tab chip in the main app launches them
- **Images:** scraped from wiki sources (Wikimedia Commons, NASA) via `scrapling` CLI tool, vendored into `assets/books/`

## 1. Papa's decisions

| # | Decision |
|---|---|
| D1 | **Standalone HTML files.** Each book is its own `.html` in `books/`, following the `key_quest.html` pattern: self-contained, inline CSS/JS, shared `:root` theme vars, offline-first. They open via `window.open()` from the Books tab — no iframe, no coupling to `index.html`'s JS state. |
| D2 | **Open-book layout.** Left page = facts (title, type badge, 3 bilingual facts), right page = full-bleed photo with name overlay. A visible spine separates the two. On narrow screens (portrait tablet) the book stacks vertically. |
| D3 | **Data separate from presentation.** Each book's card data lives in `js/books/<topic>-data.js` — pure data, no DOM, node-importable. The `.html` file loads it via a `<script>` tag. This keeps data reviewable by `check.mjs` (future slice). |
| D4 | **Bilingual invariant.** Every kid-facing string ships EN + 繁體中文. A fact without 中文 is a bug. Card type labels carry both (`GAS GIANT · 氣態巨行星`). |
| D5 | **Offline-first.** All images are vendored into `assets/books/`. Books work with wifi off. The emoji fallback renders if an image fails to load. |
| D6 | **Images from wiki sources.** Scrape Wikimedia Commons / NASA public-domain images via `scrapling` CLI tool. Resize to ≤640px wide, quality ~80. Source and credit recorded in `assets/books/<topic>/README.md`. |
| D7 | **Pilot: Space first.** The space book ships with 23 cards (reusing `assets/solar/` images + facts from `js/games/solar-data.js`). Then Animals, then the rest — each ship independently. |
| D8 | **Grid view as secondary navigation.** A toggle switches between the open-book spread and a 4-column thumbnail grid — kids tap a thumbnail to jump to that card. |
| D9 | **Tab integration is lightweight.** A `📚 Books 書籍` chip in `#hubTabs`. The tab content is a shelf of book thumbnails (gamecard style). Books are never locked. Tapping a ready book opens it in a new tab; "Coming soon" books show a muted card. |
| D10 | **Tablet-first.** Coarse pointer targets, no hover-dependent interactions. Swipe left/right turns pages. Arrow keys and Home/End for keyboard navigation. Tap photo to zoom full-screen. |
| D11 | **Books are hosted inside the app shell** (Papa, 2026-07-28). Ready books open in the `index.html` book section, using the same explicit entry/exit pattern as games. No `window.open`, iframe, or separate browser page in the kid path. Standalone files may remain as superseded templates/review artifacts until Papa removes them. Supersedes the launch wording in D1 and D9. |

## 2. Architecture

```
summer-quest/
├── books/                          ← standalone book HTMLs
│   ├── space.html                  ← 23 cards (planets, moons, ISS, Milky Way, stars)
│   ├── animals.html                ← ~40 cards
│   ├── science.html                ← ~20 cards
│   ├── race-cars.html              ← ~15 cards
│   ├── construction.html           ← ~20 cards
│   └── public-vehicles.html        ← ~15 cards
├── js/books/                       ← data modules (pure data, no DOM)
│   ├── space-data.js               ← SPACE_CARDS array
│   ├── animals-data.js
│   └── ...
├── assets/books/                   ← vendored images
│   ├── space/                      ← (reuses assets/solar/ for now)
│   ├── animals/
│   └── ...
└── index.html                      ← 📚 Books tab integration
```

### Card data format

```js
var TOPIC_CARDS = [
  { id: "saturn", emoji: "♄", nameEN: "Saturn", nameZH: "土星",
    photo: "../assets/solar/saturn.jpg",
    typeEN: "GAS GIANT", typeZH: "氣態巨行星",
    facts: [
      { en: "Saturn's rings are made of ice and rock.", tz: "土星環是由冰和岩石組成的。" },
      { en: "Saturn is so light it could float on water!", tz: "土星非常輕，輕到可以浮在水上！" },
      { en: "Saturn has the most moons — at least 274!", tz: "土星的衛星最多，至少有 274 顆！" },
    ]
  },
  // ...
];
```

### Book HTML shell

Each book HTML is self-contained:
- `<meta charset>` + `<meta viewport>`
- Inline `<style>` with shared `:root` theme vars (`--bg`, `--panel`, `--ink`, `--muted`, `--line`, etc.)
- Google Fonts: Fredoka + Nunito via `@import`
- Top bar: `← Books 書籍` back button, card count badge, grid toggle
- `.book` container with `.page-left` + `.spine` + `.page-right`
- Bottom nav: ◀ pager ▶
- Inline `<script>` loads `../js/books/topic-data.js` + manages state
- No external JS dependencies
- Emoji fallback for broken images

### Tab integration

The `index.html` Books tab shows a `BOOK_SHELF` array of book entries:

```js
var BOOK_SHELF = [
  { id: "space", icon: "🪐", title: "Space", tz: "太空",
    blurb: "Planets, moons, stars & galaxies", file: "books/space.html" },
  // ... 5 more
];
```

`renderBooks()` builds a `.bankgrid` of `.gamecard` entries. Ready books are tappable (`window.open(file, "_blank")`); future books show "Coming soon · 即將推出".

## 3. Interaction design

### Open-book view
- **Left page:** title (EN), Chinese subtitle, type badge, 3 bilingual fact cards stacked vertically, page number at bottom right. Scrollable if facts overflow.
- **Right page:** full-bleed photo fills the page. A gradient overlay at the bottom shows the name (EN + 中文) and "Tap photo to zoom · 點擊放大". Tap triggers full-screen zoom overlay.
- **Spine:** 3px gradient line dividing the pages.

### Navigation
- ◀ ▶ arrow buttons at the bottom
- Swipe left/right on the book stage
- Keyboard: ArrowLeft/ArrowRight, Home (first card), End (last card)
- Page-turn transition: brief scale-down + fade (180ms) before rendering next card

### Grid view
- 4-column thumbnail grid (3-column on narrow screens)
- Each cell: image + name (EN + ZH)
- Tap to jump to that card in open-book view
- Toggle button switches between book and grid

### Zoom
- Tap right-page photo → full-screen overlay with larger image + "Tap to close" caption

## 4. Dependencies

| This plan needs | Status |
|---|---|
| `scrapling` CLI tool | Installed on this machine (`scrapling.exe`). Used for wiki image scraping. |
| `assets/solar/` images | Already vendored (26 files, NASA/ESO public domain). Space book reuses these. |
| `index.html` tab system | Books chip added; `renderBooks()` function added; tab never locked. |

No build step. No npm install. No Supabase dependency.

## 5. Verification

- Visual: open `books/space.html` in a browser, swipe through cards, toggle grid, zoom photos
- Bilingual: every card has EN + 中文 on both pages
- Offline: all images are local; emoji fallback on missing images
- Tablet: coarse tap targets, swipe works
- `node scripts/check.mjs` — green (future: add books data to bilingual check)

## 5.1 No-drift implementation sequence

The initial Space pilot exists in slice `35`. Continue in this order:

| Slice | Purpose |
|---|---|
| `36-books-hardening.md` | Fix readiness, offline precache, bilingual UI labels, HTML shell, and factual corrections. |
| `37-books-shelf-navigation.md` | Redesign the Books tab as a real bookshelf/navigation surface. |
| `38-space-reader-navigation.md` | Polish Space reader navigation, grid/all-pages view, progress, zoom, and responsive behavior. |
| `39-books-validation-and-template.md` | Add mechanical checks to prevent future book drift. |
| `40-books-complete.md` | Add Animals, Science, Race Cars, Construction, and Public Vehicles one by one. |

Future agents must not skip directly from `35` to adding more books. The hardening and validation slices prevent copy-pasting pilot flaws into five more standalone files.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Wikimedia rate limiting during scrape | Use `scrapling` with delays; batch scraping per topic |
| Image license mismatch | Only NASA/ESO public domain or CC BY-SA from Wikimedia Commons; credit in README |
| Book HTML grows too large with inline data | Data already in separate `js/books/*-data.js`; HTML stays under 300 lines |
| Kids open too many tabs | `window.open` with `"_blank"`; browsers on tablets typically re-use existing tabs |
