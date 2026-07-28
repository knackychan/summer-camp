# Books Design Reference — no-drift contract

**Date:** 2026-07-28
**Status:** implementation reference for slices `36` through `40`
**Use this before editing:** `index.html`, `books/*.html`, `js/books/*.js`, `sw.js`, `scripts/check.mjs`, or book assets.

This file pins the intended design, navigation, copy, data, and verification rules for the Books feature. It exists so future implementation agents do not invent a different bookshelf, reader, data format, or visual language.

---

## 1. Product job

Books are a calm reading lane inside Summer Quest. They are not games, drills, rewards, chores, or web-search launchers.

The kids arrive from the main hub on a tablet and should be able to:

1. Recognize the Books tab as an always-available reading area.
2. Pick an available book without encountering locks, errors, or missing pages.
3. Read visual fact cards in English and Traditional Chinese.
4. Move through cards by tapping, swiping, keyboard, or thumbnail navigation.
5. Zoom a photo, close it, and return to the exact card.

Primary audience:

| Kid | Age | UX implication |
|---|---:|---|
| Lucien | 4 | Needs large targets, obvious arrows, minimal text density, picture-first cues. |
| Lili | 7 | Can browse by topic and scan bilingual cards. |
| Luis | 9 | Can use grid/category navigation and keyboard shortcuts. |

Papa's role is only curation through shipped content. There is no admin editing UI in this feature.

---

## 2. Existing implementation to preserve

Do preserve:

- Standalone book files in `books/`.
- Pure data files in `js/books/`.
- `SPACE_CARDS` as a classic global loaded by `<script src="../js/books/space-data.js">`.
- Open-book reader metaphor: left page facts, center spine, right page photo.
- Grid view as secondary navigation.
- Swipe, arrow keys, Home/End, buttons.
- Photo zoom.
- Offline-first static delivery.
- No Supabase dependency.
- No import from `index.html` app state.

Do not preserve blindly:

- English-only UI labels.
- `ready` inferred from `.html` filename.
- Remote Google Fonts in standalone books.
- Missing service-worker precache entries.
- Missing `<!doctype html>`, `<html>`, `<head>`, `<body>` shell.
- Future books rendering as tappable before their files exist.
- The `.locked` visual language for coming-soon books.

---

## 3. Visual authority

The Books shelf belongs to the Summer Quest hub. It should reuse the app's existing tokens and card rhythm from `index.html`:

| Token / pattern | Use |
|---|---|
| `--bg`, `--bg2`, `--panel`, `--panel2`, `--ink`, `--muted`, `--line` | Base shell and contrast. |
| `--gold`, `--ok`, `--bad` | Status only. Do not make the whole surface gold/green/red. |
| `.chip`, `.kidtabs`, `.bigcard`, `.bankgrid` | Structural precedent for the hub. |
| `.gamecard` | Useful behavior precedent, but Books should get its own book-cover treatment. |
| Fredoka + Nunito | Use if already available from the main app. Standalone books must not require the network to fetch them. |

The book reader may have a slightly more editorial/storybook personality than the hub, but must stay in the Summer Quest world: dark purple base, high contrast text, cheerful icons, soft physical depth, no marketing hero layout.

Avoid:

- Large decorative gradients unrelated to content.
- Floating nested cards inside cards.
- A shelf that looks locked or punitive.
- Hover-only meaning.
- Tiny text buttons for primary navigation.
- New dependencies.
- SVG illustration pretending to be book content when real images exist.

---

## 4. Information architecture

Pinned hub tab order:

1. `My Day 我的一天`
2. `Games 遊戲`
3. `Activities 活動`
4. `Learn 學習`
5. `Books 書籍`
6. `Ask 求助`
7. `Captain 隊長` for Luis only

Rationale: Learn and Books are adjacent learning modes. Ask is support, so it follows content.

Pinned Books shelf structure:

1. Header: `Pick a Book 選一本書來讀`
2. Featured ready book: Space.
3. Coming-soon books: Animals, Science, Race Cars, Construction, Public Vehicles.
4. No locks. Coming-soon means unavailable, not forbidden.

Do not add reading streaks, stars, timers, search, recommendations, Papa approval, or web links in this batch.

---

## 5. Books shelf content model

Use one static `BOOK_SHELF` array in `index.html` until a later slice extracts it.

Each entry must contain:

```js
{
  id: "space",
  icon: "🪐",
  titleEN: "Space",
  titleZH: "太空",
  blurbEN: "Planets, moons, stars, and galaxies",
  blurbZH: "行星、衛星、恆星和銀河",
  file: "books/space.html",
  ready: true,
  accent: "space"
}
```

Rules:

- `ready` is the only source of truth for whether a card opens.
- `file` may exist on future books, but `ready:false` means do not open it.
- Future cards use `Coming soon · 即將推出`.
- Ready cards use `Read now · 開始閱讀`.
- Do not infer readiness from `file`, `id`, filename suffix, or assets on disk.
- Do not use `.locked` for coming-soon books.

Pinned shelf entries:

| id | Title | 中文 | Status |
|---|---|---|---|
| `space` | Space | 太空 | `ready:true` |
| `animals` | Animals | 動物 | `ready:false` |
| `science` | Science | 科學 | `ready:false` |
| `race-cars` | Race Cars | 賽車 | `ready:false` |
| `construction` | Construction | 工地 | `ready:false` |
| `public-vehicles` | Public Vehicles | 公共車輛 | `ready:false` |

---

## 6. Reader shell

Each standalone book must be a complete HTML document:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Space · 太空</title>
  <style>...</style>
</head>
<body>...</body>
</html>
```

Pinned reader regions:

1. Top bar.
2. Reading stage.
3. Bottom navigation.
4. Grid/all-pages view.
5. Zoom overlay.

Top bar content:

| Element | Copy |
|---|---|
| Back button | `← Shelf 書架` |
| Title | `Space 太空` |
| Count badge | `23 pages · 23 頁` |
| View toggle from book to grid | `All Pages 全部頁面` |
| View toggle from grid to book | `Book 書本` |

Bottom navigation:

| Element | Behavior |
|---|---|
| Previous button | disabled on first card |
| Pager | `1 / 23` |
| Next button | disabled on last card |
| Progress strip | visual progress; no text required |

Zoom overlay:

| Element | Requirement |
|---|---|
| Image | `object-fit:contain`, never cropped |
| Close control | visible `×` button, at least 44px |
| Caption | `Name EN · Name ZH` |
| Hint | `Tap to close · 點擊關閉` |
| Keyboard | `Escape` closes |

---

## 7. Reader navigation contract

Supported:

- Tap previous/next.
- Swipe left/right on the reading stage.
- ArrowLeft and ArrowRight.
- Home and End.
- Grid thumbnail jump.
- Category/filter chips if implemented in slice 38.

Do not add:

- Auto-play.
- Random card mode.
- Quiz mode.
- Rewards.
- Page curl physics.
- Persistent reading history.
- Sound effects.

Touch rules:

- All primary tap targets are at least 44px by 44px, preferably 48px.
- Interactions must work without hover.
- Swiping must not trigger while the user is vertically scrolling the fact page.
- Disabled arrows must remain visible but clearly unavailable.

Motion:

- Page transition stays short: 120ms to 220ms.
- Respect `prefers-reduced-motion: reduce`.
- No continuous ambient animation in books.

---

## 8. Card data contract

Each book data file is pure data:

```js
var TOPIC_CARDS = [
  {
    id: "saturn",
    emoji: "♄",
    nameEN: "Saturn",
    nameZH: "土星",
    photo: "../assets/solar/saturn.jpg",
    typeEN: "GAS GIANT",
    typeZH: "氣態巨行星",
    facts: [
      { en: "Saturn's rings are made of ice and rock.", tz: "土星環是由冰和岩石組成的。" },
      { en: "Saturn is so light it could float on water!", tz: "土星非常輕，輕到可以浮在水上！" },
      { en: "Saturn has 274 confirmed moons.", tz: "土星有 274 顆已確認的衛星。" }
    ]
  }
];
```

Rules:

- No DOM.
- No imports.
- No fetch.
- No functions.
- One global array per book.
- Exactly 3 facts per card unless a future plan explicitly changes all templates.
- Every kid-facing string has English and Traditional Chinese.
- `tz` remains the existing project key for Traditional Chinese facts.
- Card IDs are lowercase kebab-free or kebab-case slugs: `milkyway`, `race-car`, `fire-truck`.
- Photo paths are relative to the book HTML location.

Fact writing:

- Use short, concrete facts for kids.
- Avoid "only" unless the fact is explicitly "only known".
- Avoid live counts unless the source and date are recorded.
- For changing astronomy counts, prefer "confirmed as of Month YYYY" in source notes, not necessarily on the kid-facing card.

Current source checks:

- NASA Jupiter page: Jupiter has 101 IAU-recognized moons as of March 2026.
- NASA Saturn page: Saturn has 274 confirmed moons as of March 2025.

---

## 9. Asset and credit contract

Preferred future asset layout:

```text
assets/books/<topic>/<card-id>.jpg
assets/books/<topic>/README.md
```

Exception:

- Space may reuse `assets/solar/` for slice 36 because those files already exist and are already credited.

Every new image needs a README row:

| Field | Required |
|---|---|
| File | yes |
| Source URL or source name | yes |
| Credit | yes |
| License/public-domain note | yes |
| Download date | per README section |

Images:

- Local files only.
- No hotlinks.
- Target width: <= 640px unless a zoom-specific image is explicitly justified.
- Use JPG for photos.
- Keep file sizes tablet-friendly.

---

## 10. Offline/PWA contract

For a ready book, the service worker must precache:

- The standalone `books/<topic>.html`.
- The corresponding `js/books/<topic>-data.js`.
- Every local image referenced by the data file.
- Any local CSS/font files if introduced.

Remote fonts are not acceptable for offline-first standalone books. Use one of these:

1. System fallback stack only.
2. Already-cached app font if it becomes local.
3. Vendored local font files with explicit precache entries.

Do not add a build step or package dependency.

---

## 11. Verification contract

Every slice must finish with:

```sh
node scripts/check.mjs
```

When a slice edits UI, also verify manually or with browser screenshots:

- `books/space.html` at tablet landscape.
- `books/space.html` at tablet portrait.
- `index.html` hub Books tab.

Required behavior checks:

- Offline after first PWA install/cache.
- Direct file open still works where expected.
- Served over `python -m http.server 8000` works for PWA/service worker checks.
- No missing images.
- Emoji fallback still works.
- Future books do not open until marked ready.
- All visible kid-facing strings are bilingual.

---

## 12. Decisions future agents must not make

Do not change these without a new design decision recorded in `design.md`:

- Books remain standalone HTML files.
- Books are always available and never locked.
- The first ready book is Space.
- The reader uses open-book layout.
- Data stays separate from presentation.
- The main app launches books from the Books shelf.
- No Supabase dependency.
- No rewards/stars/timers in Books.
- No web content or external image loading at runtime.
- No new framework or build step.

