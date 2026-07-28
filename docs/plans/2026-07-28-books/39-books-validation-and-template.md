# Slice 39 — Books validation and reusable template rules

**Goal:** Teach `scripts/check.mjs` to guard the Books feature and document the repeatable pattern for future standalone books.

**Design reference:** `docs/plans/2026-07-28-books/design-reference.md`

**Depends on:** Slices 36 through 38.

**Do not implement:** remaining book content, new UI design, or a build step.

---

## Why this slice exists

After Space is hardened and polished, the biggest risk is copy-paste drift:

- Missing Chinese strings.
- Missing images.
- Ready books omitted from the service worker.
- Data files containing DOM logic.
- Future books using different field names.
- Coming-soon books accidentally opening.

This slice turns those into mechanical checks.

---

## Files

| File | Change |
|---|---|
| `scripts/check.mjs` | Add Books validation. |
| `docs/plans/2026-07-28-books/design-reference.md` | Update only if the contract needs a narrow clarification. |
| `docs/plans/2026-07-28-books/39-books-validation-and-template.md` | Track completion. |

Avoid editing `index.html` or `books/space.html` unless validation reveals a real issue.

---

## Validation scope

Add checks for ready books only, plus static checks for all `js/books/*-data.js`.

### 1. Data file shape

For each `js/books/*-data.js`:

- Must define exactly one global array ending in `_CARDS`.
- Must not reference `document`, `window`, `fetch`, `localStorage`, or `import`.
- Must parse/evaluate in a safe VM context.
- Array must be non-empty.

Each card requires:

```text
id
emoji
nameEN
nameZH
photo
typeEN
typeZH
facts
```

Each `facts` array:

- Exactly 3 entries.
- Every fact has non-empty `en`.
- Every fact has non-empty `tz`.

Optional fields allowed:

```text
group
fit
source
```

Do not fail on optional fields being absent.

### 2. Bilingual shelf copy

Check `BOOK_SHELF` entries in `index.html` for:

- `titleEN`
- `titleZH`
- `blurbEN`
- `blurbZH`
- `ready`

Fail if kid-facing Books shelf copy uses English-only `blurb`.

Do not require a separate extracted data file yet.

### 3. Ready status integrity

Rules:

- Every `ready:true` shelf item must have an existing `books/<id>.html` file.
- Every `ready:true` shelf item must have a corresponding data file.
- Every `ready:false` shelf item must not be rendered with a ready CTA.

If parsing render output is too brittle, check the source for the explicit `ready === true` branch and no `.html` readiness inference.

### 4. Image existence

For every card in every ready book:

- Resolve `photo` relative to the book HTML file.
- Fail if the file does not exist.
- Fail if the path begins with `http://` or `https://`.

### 5. Service worker precache

For every ready book:

- `./books/<topic>.html` appears in `APP_SHELL`.
- `./js/books/<topic>-data.js` appears in `APP_SHELL`.
- Every local image path appears in `APP_SHELL`.

Paths must use the same `./` style as the rest of `sw.js`.

### 6. Standalone HTML shell

For every ready `books/*.html`:

- Contains `<!doctype html>`.
- Contains `<html`.
- Contains `<head>`.
- Contains `<body>`.
- Contains `<meta charset="utf-8">`.
- Contains viewport meta.
- Does not contain `https://fonts.googleapis.com`.
- Does not contain runtime `http://` or `https://` image/script/style references.

### 7. Accessibility smoke checks

For every ready `books/*.html`:

- Has a `<title>` containing English and Chinese.
- Has a visible back control.
- Has visible previous and next controls.
- Has visible grid/all-pages toggle.
- Has zoom close copy or button copy in English and Chinese.

Keep this check simple. It is a guardrail, not a browser engine.

---

## Template guidance

Do not extract a shared JS file in this slice unless it is clearly less code than duplication.

Preferred template approach for now:

- Keep each book standalone.
- Keep inline CSS/JS.
- Use the Space book as the canonical copy source after Slice 38.
- When making a new book, copy `books/space.html`, then replace only:
  - title,
  - data global name,
  - theme accent,
  - category labels if needed.

If a helper is extracted later, it must still preserve direct standalone opening and offline-first behavior.

---

## Acceptance checks

- `node scripts/check.mjs` fails if a book card lacks Chinese text.
- It fails if a ready book's data file is missing.
- It fails if a ready book image is missing.
- It fails if a ready book shell/data/image is absent from `sw.js`.
- It fails if `books/space.html` reintroduces Google Fonts.
- It passes on the current hardened Space book.

---

## Manual mutation tests

Temporarily make each change, run the check, then restore it:

1. Remove `nameZH` from one card.
2. Remove one `tz` fact.
3. Change one `photo` to `https://example.com/x.jpg`.
4. Remove `./books/space.html` from `sw.js`.
5. Set a future book to `ready:true` without creating its HTML.

Each mutation must fail the check with a useful message.

---

## Out of scope

- Playwright screenshot automation.
- New lint tool.
- npm dependencies.
- Dynamic imports.
- Shared book runtime.
- Additional books.

