# Slice 38 — Space reader navigation and reading UX

**Goal:** Upgrade `books/space.html` from a functional pilot into a polished tablet reader with clear navigation, bilingual controls, category jumps, progress, accessible zoom, and robust responsive behavior.

**Design reference:** `docs/plans/2026-07-28-books/design-reference.md`

**Depends on:** Slices 36 and 37.

**Do not implement:** new book topics, template extraction, data validation expansion, quizzes, rewards, or app-state persistence.

---

## Design thesis

The reader should feel like an open field guide:

- Left page: readable facts.
- Right page: inspectable image.
- Controls: obvious enough for Lucien, efficient enough for Luis.
- Navigation: page arrows first, grid/category jump second.

Do not make it feel like a game screen, quiz, carousel ad, or image gallery.

---

## Files

| File | Change |
|---|---|
| `books/space.html` | Reader layout, controls, responsive polish, category navigation. |
| `js/books/space-data.js` | Add category metadata only if needed. |
| `docs/plans/2026-07-28-books/38-space-reader-navigation.md` | Track completion. |

Avoid `index.html` except if a link target or title contract changed in a previous slice.

---

## Required reader structure

Top bar:

```text
[← Shelf 書架] [Space 太空] [23 pages · 23 頁] [All Pages 全部頁面]
```

Main reading stage:

```text
left page: title, Chinese title, type badge, facts
spine
right page: image, title overlay, zoom hint
```

Bottom nav:

```text
[previous] [1 / 23 + progress strip] [next]
```

Optional category rail:

```text
All 全部 | Planets 行星 | Moons 衛星 | Stars 恆星 | Spacecraft 太空船
```

If category rail is implemented, it must be compact and must not push the book below the fold on tablet landscape.

---

## Card category model

If adding categories, add a `group` field to each card.

Allowed groups:

| group | Label |
|---|---|
| `all` | `All 全部` |
| `planets` | `Planets 行星` |
| `moons` | `Moons 衛星` |
| `stars` | `Stars 恆星` |
| `spacecraft` | `Spacecraft 太空船` |
| `galaxies` | `Galaxies 星系` |

Suggested mapping:

| Cards | group |
|---|---|
| Sun, Alpha Centauri, Sirius, Barnard's Star | `stars` |
| Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto | `planets` |
| Moon, Io, Europa, Ganymede, Callisto, Titan, Triton, Deimos | `moons` |
| ISS | `spacecraft` |
| Milky Way | `galaxies` |

Do not add more groups.

---

## Open-book view refinements

### Left page

Required:

- English name.
- Chinese name.
- Bilingual type badge.
- Three bilingual fact cards.
- Current page number.

Improve:

- Make facts comfortable to read in portrait and landscape.
- Keep Chinese text close to its English pair.
- If the left page scrolls, the page number must not hide content.

Do not:

- Add more than three facts.
- Add long paragraphs.
- Replace facts with quiz prompts.

### Right page

Required:

- Full-page image.
- Name overlay.
- Chinese name.
- `Tap photo to zoom · 點擊放大`.
- Emoji fallback.

Improve:

- Avoid cropping important object details too aggressively.
- For object-like images, prefer `object-fit:contain` or a dark image mat if `cover` chops the subject.
- For wide galaxy/backdrop images, `cover` can stay if it looks intentional.

Decision rule:

- Do not choose per-card image fit by taste inside render logic unless the data explicitly provides `fit:"cover"` or `fit:"contain"`.
- If fit varies, add `fit` to data and document allowed values.

---

## Grid/all-pages view

The grid is navigation, not a separate gallery.

Required:

- Toggle label from open-book view: `All Pages 全部頁面`.
- Toggle label from grid view: `Book 書本`.
- Grid cards show image/emoji, English name, Chinese name.
- Tapping a grid card returns to book view at that card.
- Current card is visually marked.

If categories are implemented:

- Category filter affects grid contents.
- Selecting a grid card still jumps to the global card index.
- `All 全部` restores all cards.

Do not:

- Let grid replace the book as primary mode.
- Add search.
- Add sorting.

---

## Navigation behavior

Buttons:

- Previous disabled at first card.
- Next disabled at last card.
- Disabled buttons stay visible.

Keyboard:

- ArrowLeft: previous.
- ArrowRight: next.
- Home: first card.
- End: last card.
- Escape: close zoom or return from grid to book view.

Swipe:

- Horizontal swipe over the stage turns pages.
- Vertical scrolling in left facts must not turn pages.
- Swipe threshold remains around 50px.

State:

- No localStorage persistence in this slice.
- Returning from grid preserves chosen card.
- Closing zoom preserves chosen card.

---

## Responsive contract

| Viewport | Expected layout |
|---|---|
| 360x800 | Book stacks vertically; controls do not overlap content. |
| 430x932 | Book stacks vertically; facts remain readable; image has useful height. |
| 800x1280 | Either stacked or two-page if it fits; no clipped nav. |
| 1024x768 | Two-page spread; bottom nav visible without scrolling. |
| 1280x800 | Two-page spread; image not tiny; controls do not feel lost. |

Do not lock `html, body` overflow in a way that traps content on short screens. If the reader needs internal scrolling, only the intended panel should scroll.

---

## Accessibility and robustness

Required:

- Buttons have accessible names.
- Image alt includes English and Chinese name.
- Zoom close button has accessible name.
- Escape closes zoom.
- `prefers-reduced-motion` disables page transition.
- Generated HTML strings escape user/data text or use DOM APIs.

Because book data is curated, XSS risk is low, but this template will be copied to future books. Build the habit now.

---

## Acceptance checks

- Page controls work through all 23 cards.
- Grid jump works and marks current card.
- Category rail works if included; if not included, no dead UI remains.
- Zoom opens and closes without changing page.
- Escape behaves correctly in zoom and grid.
- Portrait and landscape tablet layouts are readable.
- Reduced motion disables page-turn animation.
- No English-only kid-facing controls.
- `node scripts/check.mjs` passes.

---

## Out of scope

- Shared `book-shell.js`.
- New data validation.
- More books.
- Reading history.
- Stars/rewards.

