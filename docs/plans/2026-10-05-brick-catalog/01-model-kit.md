# Slice 01 — Model kit: parts as data, colours, stacking, rendered previews

**Requested by Papa, 2026-10-05.** Implements design.md C1, C2, C3, C5, C7, C9.

**Depends on:** brick-lab slices 09 (parts library), 12 (rail parts browser), 13 (render on demand), 14 (step-down).

## Changes
- `js/brick-lab/brick-lab.js`
  - `primitiveGeometry()` + `makeModelPiece()`: a `shape: "model"` part's primitives become one merged geometry per colour slot, cached in the kit as `<part>:<slot>`; reduced-quality tablets get ~60 % of the curve segments. `makePieceMesh()` sends model parts there first; the 26 old builders are unchanged.
  - Kit: `kit.mat(hex)` gives palette gold / silver / trans colours their finish (looked up by hex, so recolouring still swaps one material); `kit.finish(name)` for fixed slots under its own key, so a recolour never touches it. See-through and glowing slots cast no shadow.
  - `landing()`: `ground`, `support: false`, `top`, `sink` + `head` (C5) replace the hard-coded `tree` / `flower` / `wheel` checks, with the same result for those parts.
  - Info card: `isFixedColor()`; heights over a brick read in bricks ("about 3 bricks tall"); snap guides for hats ("Put it on a minifigure's head. 放在小人偶的頭上。") and seats ("Put a minifigure on it to sit or ride. 把小人偶放上去，就能坐或騎。").
  - Tray pictures (C7): `paintPreviews()` / `drawThumbs()` / `renderThumb()`. Wanted pictures queue per part + colour; the loop draws a few per frame inside a 5 ms (reduced) / 9 ms budget into a 192×160 target, box-filters to 96×80, encodes sRGB on the CPU and caches up to 320 data URLs. A frame that drew pictures is not counted by the slice-14 step-down. On any failure pictures stop and the CSS sketches stay. `snapshot().tray` gains `thumbs`, `thumbsPending`, `thumbsFailed`.
  - Colours: the grid marks `has-more-x` and scrolls the active swatch into view.
- `js/brick-lab/brick-catalog.js` — 8 palette colours + `COLOR_FINISH`; `FINISHES` (fixed slots); `isFixedColor()`; `support` / `ground` on the old wheels, tree and flower; categories ordered by `CATEGORY_ORDER`; parts from `brick-parts.js` appended (no id changed).
- `css/brick-lab.css` — `.has-thumb` previews (52×42 in the tray, 58×48 on the card); tile rows 42 px; colours in three rows that slide sideways (5 visible, 4 for pre-readers, 3 on phones), see-through and metal swatches.
- `sw.js` — `brick-parts.js` precached; cache `summer-quest-v165-brick-catalog`.

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes the catalog checks (pictures drawn for every category, every part arms < 50 ms, rider on a horse, helmet on the rider, gold paint, 21 colours in three rows).

**Verified 2026-10-05:** `check.mjs` green (after `npm run build:mobile` and `npm run build:android-web`, which a fresh container lacks); `check-brick-lab-ui.py` 95/95 on source (Chromium 141 headless, SwiftShader) with the slice-14 "slow standard tablet steps down" check skipped — it fails the same way on the untouched code in this container (SwiftShader frame timing); the reduced tier still draws 88 calls / 31,490 triangles, the same as before. Every category reviewed in rendered contact sheets and a seeded scene. Not yet run: `check-android8-ui.py` with Chrome 138 (no Chrome 138 binary in the container), and real touch on a tablet.

**Carried onto main 2026-10-05 (design.md A1–A6):** `check.mjs` green (after `npm run build:mobile` and `npm run build:android-web`); `check-brick-lab-ui.py` 199/199 on source (Edge, Windows), including every one of the 238 parts arming in < 50 ms with its real-part icon in all 20 categories, the rider on the saddle, the helmet over its head, 21 colours in three rows and gold paint; `--sheet --graphics webgl1` 4/4 (238 parts build and have icons on the r162 fallback, reduced tier); `check-android8-ui.py` with Chrome 138 headless shell ok in webgl2, webgl1, none and offline webgl1. Not yet: real touch on a tablet and Papa's look at the parts sheet.
On main the branch's tray-picture code (`paintPreviews` / `drawThumbs` / `renderThumb`, `.has-thumb`) is not used: icons come from `brick-thumbs.js` (A5), whose cache now keeps 480 icons at most. `sw.js` cache is `summer-quest-v177-brick-catalog`.
