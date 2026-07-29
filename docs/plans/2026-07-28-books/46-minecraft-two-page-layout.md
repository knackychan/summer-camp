# The Evolution of Minecraft - Two-Page Layout
# Minecraft 的演化史 - 雙頁版面

> **Superseded 2026-07-29 (Papa), same day:** tried and rejected — the left page's stacked bilingual text blocks needed scrolling to see all 4 blocks, and Papa didn't want that. See `47-minecraft-two-per-turn-layout.md` for what shipped instead: the magazine mini-page design kept as-is, just 2 mini-pages per turn instead of 4. Kept here, not deleted, as the record of the experiment.

**Decision (Papa, 2026-07-29):** revert the Minecraft book from the four-block magazine spread (`43-minecraft-four-block-layout.md`) back to the standard open-book layout every other book uses (`design.md` D2). The four-block experiment stays in the repo as a record, unused.

**Companion manuscript:** `42-minecraft-evolution-book.md` (unchanged — still the source of the 25 spreads, 4 bilingual blocks each)
**Data file:** `js/books/minecraft-data.js` (unchanged shape — `blocks[4]` per spread)
**Reader shape:** one spread = one open book, left page + right page, matching `books/giraffe.html`.

---

## Layout Contract

Each spread is the standard two-page book already used by `space.html`, `animals.html`, `giraffe.html`, etc.:

- **Left page:** kicker (spread number + year), title EN, title ZH, all 4 bilingual blocks stacked as paragraphs (scrollable if they overflow), page number bottom-right.
- **Right page:** full-bleed photo with a bottom gradient overlay repeating the title and a "tap to zoom" hint. Tap opens the full-screen zoom overlay.
- **Spine:** 3px gradient divider between the two pages, same as the other books.

No content is dropped — all 4 blocks per spread just move from 4 side-by-side mini-pages onto one scrollable left page.

---

## Why revert

The four-block spread was a one-off magazine layout that didn't match the rest of the Books feature (`design.md` D2: left page = text, right page = photo). Keeping every book on the same two-page shell means one CSS/JS pattern to maintain, and kids get a consistent page-turning mental model across the shelf.

---

## Implementation

`books/minecraft.html` and `js/books/minecraft-data.js` are updated in place to the two-page shell (same file, not a new one — the four-block version is not shipped elsewhere, so there's nothing else to keep in sync).

- Reuse `books/giraffe.html`'s `.book` / `.page-left` / `.spine` / `.page-right` / `.photo-overlay` structure and swipe/keyboard/grid/zoom JS.
- Keep Minecraft's own palette and per-spread accent tone rotation (`gold`/`sky`/`grass`/`copper`/`nether`/`cherry`) on the kicker, since that's cosmetic and doesn't add a second layout system.
- `spreadImage()`, `FALLBACK_IMAGES`, `spreadYear()`, `tone()`, `kicker()` helpers carry over unchanged.

## Follow-up

`44-minecraft-image-scraping-guide.md` referenced "the four-page evolution book" — updated to say two-page. Its one-image-per-spread guidance still applies unchanged (one photo = the right page).
