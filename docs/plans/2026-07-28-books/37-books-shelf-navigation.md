# Slice 37 — Books shelf navigation UI

**Goal:** Redesign the hub Books tab into a clear, tablet-first bookshelf that makes ready vs coming-soon status obvious without using lock language.

**Design reference:** `docs/plans/2026-07-28-books/design-reference.md`

**Depends on:** Slice 36.

**Do not implement:** reader redesign, new book files, data validation, or additional content.

---

## Product intent

The Books tab should feel like a quiet library shelf inside Summer Quest:

- Always available.
- Calm and browseable.
- One obvious ready book.
- Future books visible as promise, not punishment.

This is a navigation/UI slice. It should not change Space book content.

---

## Files

| File | Change |
|---|---|
| `index.html` | Books tab markup/CSS/rendering only. |
| `docs/plans/2026-07-28-books/37-books-shelf-navigation.md` | Track completion. |

Avoid editing `books/space.html` in this slice unless a class name contract requires a tiny matching change.

---

## Required visual design

### Shelf layout

Replace the generic `.bigcard` + `.gamecard` feel with a Books-specific layout.

Required hierarchy:

1. Section title: `Pick a Book 選一本書來讀`.
2. Featured Space book card spanning full width on narrow screens and visually larger on tablet/desktop.
3. Five smaller coming-soon book cards in a responsive grid.

Recommended structure names:

```text
.bookshelf
.book-feature
.book-grid
.book-cover
.book-cover.ready
.book-cover.soon
```

Do not put cards inside nested decorative cards. If `#tab-books` keeps `.bigcard`, the book covers inside it must not look like another full card system fighting the parent. Prefer one unframed shelf container if changing markup is simple.

### Ready Space card

Required content:

- Icon or image-led cover.
- `Space`
- `太空`
- `Planets, moons, stars, and galaxies`
- `行星、衛星、恆星和銀河`
- CTA: `Read now · 開始閱讀`

Visual treatment:

- Clearly tappable.
- Stronger contrast than coming-soon cards.
- May use `assets/solar/milkyway.jpg`, `assets/solar/saturn.jpg`, or another already-vendored Space image as a cover.
- If using an image, include readable overlay text and an emoji fallback.

### Coming-soon cards

Required content:

- Icon.
- English title.
- Chinese title.
- English blurb.
- Chinese blurb.
- `Coming soon · 即將推出`

Visual treatment:

- Muted but not disabled-looking in a punitive way.
- No lock icon.
- No `.locked` class.
- No click handler.
- `aria-disabled="true"` if implemented as button-like element.

Pinned blurbs:

| id | blurbEN | blurbZH |
|---|---|---|
| `animals` | Wildlife from around the world | 世界各地的動物 |
| `science` | How things work | 事物如何運作 |
| `race-cars` | Fast cars and racing machines | 快車和賽車機器 |
| `construction` | Big machines and building sites | 大機器和工地 |
| `public-vehicles` | Helpful vehicles in the city | 城市裡幫忙的車輛 |

---

## Navigation behavior

Only `ready:true` books open.

Opening behavior remains:

```js
window.open(book.file, "_blank")
```

Do not switch to iframe, modal, same-page route, or dynamic import.

Keyboard:

- Ready card must be reachable by Tab if rendered as a button.
- Enter/Space activates ready card.
- Coming-soon cards should not be in the tab order if they are not actionable.

Touch:

- Ready card hit area is the whole card.
- Minimum primary target size: 48px.

---

## Copy contract

All kid-facing text rendered by this tab must be bilingual.

Allowed English-only text:

- None inside the kid Books tab.

Do not add explanatory helper copy such as "Tap a book to start" unless bilingual and visually necessary. The CTA already carries the action.

---

## Responsive contract

Check these layouts:

| Viewport | Expected |
|---|---|
| 360px wide | One column, no clipped text, Space first. |
| 430px wide | One column or featured + compact list, no horizontal scroll. |
| 800px portrait tablet | Featured Space plus 2-column coming-soon grid. |
| 1024px landscape tablet | Featured Space plus 3-column or 5-card balanced grid. |

Do not use viewport-scaled font sizes. Use existing app scale and responsive grid constraints.

---

## Acceptance checks

- Books tab appears between Learn and Ask.
- Space card is visually dominant and opens `books/space.html`.
- Future books do not open.
- No lock styling appears in Books.
- All shelf copy is bilingual.
- Text fits on 360px, 430px, 800px, and 1024px widths.
- No hover-only affordance.
- `node scripts/check.mjs` passes.

---

## Out of scope

- Changing the Space reader.
- Adding real Animals/Science/etc. content.
- Service-worker changes unless Slice 36 missed one.
- New assets downloaded from the web.

