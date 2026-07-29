# The Evolution of Minecraft - Two Mini-Pages Per Turn
# Minecraft 的演化史 - 每次翻頁兩格

**Decision (Papa, 2026-07-29):** keep the magazine mini-page design from `43-minecraft-four-block-layout.md` exactly as designed — photo page, two text pages, one pull-quote page, per-topic accent tone, no scrolling anywhere. The only thing that changes is how many mini-pages show per turn: **2 instead of 4.** This is the third and final revision of the day; `46-minecraft-two-page-layout.md` (standard open-book left-page/right-page shell) was tried in between and rejected because its stacked text needed scrolling.

**Companion manuscript:** `42-minecraft-evolution-book.md` (unchanged — 25 topics, 4 bilingual blocks each)
**Data file:** `js/books/minecraft-data.js` (unchanged shape — `blocks[4]` per spread)

---

## Layout Contract

Nothing about the mini-page design changes: same `.mcraft-page`/`.page` classes, same photo/text/quote page kinds, same per-topic tone rotation (`gold`/`sky`/`grass`/`copper`/`nether`/`cherry`), same kicker/title/pull-quote typography. Only the grid changes from 4 columns to 2, and pagination changes to match:

- Each of the 25 topics still spans exactly 4 mini-pages (photo+title, text, text, quote) — none of the authored content moves or gets cut.
- A topic now spans **2 turns** instead of 1: turn A shows pages [1,2] (photo + first text block), turn B shows pages [3,4] (second text block + quote).
- Total turns = 25 topics × 2 = 50 (was 25 turns of 4 pages each).
- No scrolling anywhere — every mini-page is still a fixed, non-scrolling page like the original design, just wider now that it only shares the row with one sibling instead of three.

## Implementation

Both `books/minecraft.html` and the in-app reader (`index.html`'s `renderMinecraftSpread()` + `.mcraft-*` CSS) keep their existing markup/CSS from `43-minecraft-four-block-layout.md` untouched, with two changes:

1. **CSS:** `grid-template-columns` on the spread container goes from `repeat(4,...)` to `repeat(2,...)`. The old ≤860px breakpoint that dropped to 2 columns is now redundant (already the base) and was removed; the ≤520px breakpoint still stacks to 1 column for phones.
2. **JS:** the page index (`idx` / `bookState.idx`) is now a **page-pair index** (0..49), not a topic index. `spreadIndex = Math.floor(idx/2)`, `within = idx%2` picks which half of the topic's 4 blocks to render (`within===0` → photo+text, `within===1` → text+quote). The render function is otherwise identical to `43`'s — it just emits 2 of the 4 `<article>` mini-pages instead of all 4.
3. The "All Spreads" grid/thumbnail view still shows one thumbnail per **topic** (25 thumbnails, using the topic's photo), and jumps to `idx = topicIndex*2` (the topic's first turn) — thumbnails didn't need to double just because turns did.

## Why this, not `46`

`46`'s open-book shell (left page = all 4 blocks stacked as paragraphs, right page = photo) is what every other book in the shelf uses, but stacking 4 paragraphs on one page needed scrolling to read the last block — Papa's stated objection. The magazine design in `43` never had that problem because each block already got its own fixed page; the only issue was 4 of them sharing one screen. Halving the column count keeps every mini-page fixed-height and non-scrolling while fitting comfortably in the viewport.

## Follow-up

`44-minecraft-image-scraping-guide.md`'s "two-page book" wording (from the `46` revision) is now stale again — one photo per **topic** still applies (it's the photo mini-page), so no further change needed there beyond what already says "one image per spread."
