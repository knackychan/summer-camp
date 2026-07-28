# Slice 36 — Books hardening: readiness, offline, bilingual UI, facts

**Goal:** Make the already-shipped Space book and Books tab truthful, offline-first, and safe before adding visual polish or more books.

**Design reference:** `docs/plans/2026-07-28-books/design-reference.md`

**Depends on:** Slice 35.

**Do not implement:** new book topics, new reader layout, shared template extraction, rewards, admin UI, or search.

---

## Why this slice exists

Slice 35 created the first book. It works as a pilot, but several contract bugs must be fixed before the feature is multiplied:

- Future book cards are treated as ready because readiness is inferred from `.html` filenames.
- `books/space.html` and `js/books/space-data.js` are not precached.
- Standalone book HTML imports Google Fonts from the network.
- Some visible UI copy is English-only.
- A few facts need correction or safer wording.
- `space.html` is tolerated by browsers but is not a complete HTML document.

This slice is a foundation pass. It should leave the UI mostly looking the same.

---

## Files

| File | Change |
|---|---|
| `index.html` | Fix `BOOK_SHELF` readiness and bilingual shelf copy. |
| `books/space.html` | Complete HTML shell, remove remote font dependency, bilingual UI labels, safer zoom/escape close. |
| `js/books/space-data.js` | Correct facts and translations only. |
| `sw.js` | Precache ready book shell/data. Bump cache name. |
| `docs/plans/2026-07-28-books/36-books-hardening.md` | Mark tasks complete as work is done. |

Do not touch `assets/solar/*` unless a referenced image is actually missing.

---

## Required implementation details

### 1. Fix shelf readiness

In `BOOK_SHELF`, add explicit status fields:

```js
{ id:"space", ..., file:"books/space.html", ready:true }
{ id:"animals", ..., file:"books/animals.html", ready:false }
```

Render logic:

- `ready === true`: card is tappable and opens `file`.
- `ready !== true`: card is not tappable and shows coming soon.
- Do not infer readiness from `file`.
- Do not remove future `file` fields if they are useful as planned paths.

Expected copy:

| State | Copy |
|---|---|
| Ready | `Read now · 開始閱讀` |
| Coming soon | `Coming soon · 即將推出` |

Future cards must not call `window.open()`.

### 2. Make shelf blurbs bilingual

Replace English-only `blurb` with:

```js
blurbEN: "Planets, moons, stars, and galaxies",
blurbZH: "行星、衛星、恆星和銀河"
```

All shelf cards render both lines.

Do not invent different book titles.

### 3. Move Books tab before Ask

Pinned order:

```text
My Day, Games, Activities, Learn, Books, Ask, Captain
```

Keep Books always unlocked.

### 4. Complete standalone HTML

Wrap `books/space.html` in:

```html
<!doctype html>
<html lang="en">
<head>...</head>
<body>...</body>
</html>
```

Do not change the data loading model.

### 5. Remove remote Google Fonts dependency

Remove:

```css
@import url('https://fonts.googleapis.com/...');
```

Use local fallback stacks:

```css
font-family: Nunito, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Keep the visual hierarchy close to current. This is not the typography redesign slice.

### 6. Complete bilingual reader UI copy

Required replacements:

| Current | Replace with |
|---|---|
| `📋 Grid` | `All Pages 全部頁面` |
| `📖 Book` | `Book 書本` |
| `Tap to close` | `Tap to close · 點擊關閉` |
| `Could not load card data.` | `Could not load card data. 無法載入卡片資料。` |
| `pages · 頁` | `${n} pages · ${n} 頁` |

Keep `Tap photo to zoom · 點擊放大`.

### 7. Improve zoom close behavior

Add:

- Visible close button.
- Escape key closes zoom.
- Clicking overlay closes zoom.
- Clicking image itself should not accidentally advance page or reopen zoom.

Do not add pinch zoom or pan.

### 8. Correct Space facts

Required corrections:

| Card | Current issue | Required direction |
|---|---|---|
| Sun | Chinese says hot air balloon. | Translate as hot gas ball, not balloon. |
| Earth | Says only planet with life. | Use "only known planet with life." |
| Jupiter | Says at least 95 moons. | Use 101 recognized moons, or avoid exact count. |
| Saturn | 274 count is okay. | Prefer "274 confirmed moons" rather than "at least 274." |

Record source basis in a short code comment or plan note, not in kid-facing UI.

### 9. Precache ready book files

Add to `APP_SHELL`:

```js
"./books/space.html",
"./js/books/space-data.js",
```

Confirm all `SPACE_CARDS[*].photo` files are already in `APP_SHELL`. Add missing ones only.

Bump `CACHE_NAME`.

---

## Acceptance checks

- Space card opens from Books shelf.
- Animals, Science, Race Cars, Construction, and Public Vehicles do not open.
- Future cards visibly read `Coming soon · 即將推出`.
- Shelf blurbs are bilingual.
- `books/space.html` has a complete HTML document shell.
- No `https://fonts.googleapis.com` or other runtime network dependency remains in `books/space.html`.
- `books/space.html` and `js/books/space-data.js` are in `sw.js` precache.
- Zoom opens and closes by overlay tap, close button, and Escape.
- `node scripts/check.mjs` passes.

---

## Manual QA script

1. Run `python -m http.server 8000` from `summer-quest/`.
2. Open `http://localhost:8000/`.
3. Pick a kid.
4. Tap `Books 書籍`.
5. Confirm Space is the only tappable card.
6. Open Space.
7. Turn pages with buttons, swipe, ArrowLeft/ArrowRight, Home, End.
8. Toggle all-pages grid and jump to a card.
9. Zoom a photo and close it three ways.
10. Turn wifi off or use browser offline mode after service-worker install; reload the book.

---

## Out of scope

- Making the shelf beautiful.
- Adding category navigation.
- Extracting shared book template.
- Adding more book data.
- Changing the game or Learn tabs.

