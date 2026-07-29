# The Evolution of Minecraft — Magazine Furniture & Topic Merge
# Minecraft 的演化史 — 雜誌版面元件與主題合併

**Decision (Papa, 2026-07-29):** the two-per-turn magazine layout from
`47-minecraft-two-per-turn-layout.md` stays exactly as designed. What changes is what
goes *on* those mini-pages. Papa's two complaints were "the page looks a bit empty" and,
after a first pass, "a lot of pages are still missing images, and the text is very few."

This doc records the fixes. It supersedes nothing — `43`, `44` and `47` all still hold.

---

## 1. Topics merged: 25 → 18

The original manuscript had 25 topics × 4 blocks, and several blocks were a single short
sentence sitting alone on a page. Related topics were merged and their text rewritten as
longer paragraphs, so no mini-page is one thin line any more:

| New topic | Was |
|---|---|
| 01 Cave Game: How Minecraft Began | 01 origin + 02 inspirations + 03 Classic |
| 02 Survival Test And The Creeper | 04 survival + 05 creeper |
| 03 Indev, Infdev, And The Horizon | 06 Indev + 07 Infdev |
| 04 Alpha, Mojang, And The Nether | 08 Alpha + 09 Nether |
| 05 Beta, And Version 1.0 | 10 Beta + 11 version 1.0 |
| 14 The Game Drop Era And 2024 | 20 drop era + 21 Tricky Trials |

The other twelve carry over one-to-one. Total turns: 18 × 2 = **36** (was 50).

`scripts/check.mjs` still enforces exactly 4 bilingual blocks per topic — the merge kept
that shape, it just made each block carry three or four sentences instead of one.

## 2. Every mini-page has an image

`js/books/minecraft-data.js` gained `images: [hero, page2, page3, page4]`. The photo page
uses the hero as before; pages 2, 3 and 4 now render `.mcx-band` — the page's own image as
a band across the top, faded into the page colour so the copy underneath stays readable.
Bands are 54% of a text page and 50% of a quote page, and every band is tappable to zoom.

`image` (singular) is kept as the hero and is what the "All Spreads" thumbnail grid uses.

Images that are logos or text tiles (`build-worlds.jpg` = the Mojang Studios logo,
`marketplace.jpg`, `texture-packs.jpg`, `realms-tile.jpg`, `mc-experience.jpg`,
`add-ons.jpg`, `game-drops.jpg`) are downloaded and credited but deliberately **not** used
— rule 5 of `44-minecraft-image-scraping-guide.md` skips page chrome.

## 3. Magazine furniture

New shared file `js/books/minecraft-magazine.js` (classic global, `window.SQMcraftMag`).
Both readers — `books/minecraft.html` and `index.html`'s in-app reader — call the same
builders, so the markup exists once; only the CSS is duplicated, because there are two
stylesheets. Every piece is optional and every piece is bilingual (`.mcx-en` / `.mcx-zh`,
hidden by the reader's language attribute).

| Field | Where it prints |
|---|---|
| `era` | small tag under the SPREAD badge on the photo page |
| `stat` `{value,en,zh}` | big-number badge, top right of the photo page |
| `tip` `{en,zh}` | "PRO TIP" card on text page 2 |
| `fact` `{en,zh}` | "DID YOU KNOW" card on text page 3 |
| `keys` `[{en,zh}]` | 3–4 feature chips under the pull quote on page 4 |
| `items` `[name]` | which pixel items float on the spread |
| — | a running head (`NN · topic title`) across the top of pages 2–4 |

## 4. SVG pixel items, not abstract blobs

`MCRAFT_ITEM_SVG` in the magazine module holds 23 hand-drawn 16×16 pixel items —
pickaxe, grass block, torch, crafting table, iron/gold/copper, compass, chest, heart,
sword, TNT, bread, redstone, potion, book, emerald, diamond, amethyst, ender pearl,
nether star, bucket, sulfur cube. They are inline SVG: no files, no network, no licence
question, and sharp at any size. An earlier inline `MCDECOS` list of abstract rounded
shapes was replaced by these — they read as Minecraft, which the blobs did not.

Three transparent mob renders (`overlays/creeper.png`, `warden.png`, `sniffer.png`) still
float on the milestone spreads. Attempts to fetch more mob renders from minecraft.wiki
returned 403; do not retry without a licence check.

Decorations sit in the gutter and page edges (`SLOTS` in the module), never over body
copy, and are hidden entirely below 520px and under `prefers-reduced-motion`.

## 5. Verify

- `node scripts/check.mjs` — green.
- No mini-page scrolls in either language. The only overflow is the photo page's
  pre-existing `transform:scale(1.02)` on the hero image (7px, invisible, `overflow:hidden`).
- All 48 images referenced by the data file exist on disk and are in `sw.js` APP_SHELL
  (offline-first is non-negotiable).
