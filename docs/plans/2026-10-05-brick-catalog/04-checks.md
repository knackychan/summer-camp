# Slice 04 — Checks

**Requested by Papa, 2026-10-05.** Gates for design.md C1–C5.

**Depends on:** 01–03.

## Changes
- `scripts/check.mjs` (Brick Lab catalog gate) — every footprint is whole studs; `top` sits inside the part, `sink` is sane; every model primitive has exactly one known kind, number-only sizes, `at` / `rot` / `s` as three numbers, a known colour slot, and sits near its footprint; `fixed` is true exactly when no slot is `main`; palette finishes name real colours; palette hexes are distinct (recolour looks materials up by hex).
- `scripts/check-brick-lab-ui.py` — `catalog_checks()`: 18 categories in build order; every category's tray shows a rendered picture per part; all 217 parts arm and build in < 50 ms; an animal's info card says "own colours"; a sitting minifig lands on a horse's saddle and a knight helmet drops over its head; 21 colours in three rows sliding sideways; a selected piece paints gold. The category-switch, short-tablet and 1024×600 checks now walk 18 categories (the list scrolls on every tablet, C4); "2x4" search expects tiles too.
- Contact sheets per category are saved as `catalog-<category>.png` in the harness output.

**Verified 2026-10-05:** `check.mjs` green (after `npm run build:mobile` and `npm run build:android-web`, which a fresh container lacks); `check-brick-lab-ui.py` 95/95 on source (Chromium 141 headless, SwiftShader) with the slice-14 "slow standard tablet steps down" check skipped — it fails the same way on the untouched code in this container (SwiftShader frame timing); the reduced tier still draws 88 calls / 31,490 triangles, the same as before. Every category reviewed in rendered contact sheets and a seeded scene. Not yet run: `check-android8-ui.py` with Chrome 138 (no Chrome 138 binary in the container), and real touch on a tablet.

**Carried onto main 2026-10-05 (design.md A1–A6):** `check.mjs` green (after `npm run build:mobile` and `npm run build:android-web`); `check-brick-lab-ui.py` 199/199 on source (Edge, Windows), including every one of the 238 parts arming in < 50 ms with its real-part icon in all 20 categories, the rider on the saddle, the helmet over its head, 21 colours in three rows and gold paint; `--sheet --graphics webgl1` 4/4 (238 parts build and have icons on the r162 fallback, reduced tier); `check-android8-ui.py` with Chrome 138 headless shell ok in webgl2, webgl1, none and offline webgl1. Not yet: real touch on a tablet and Papa's look at the parts sheet.
On main the gate also refuses `support: false` (A2), the harness walks 20 categories (A4), expects 238 parts, and reads icons from `brick-thumbs.js` (`tray.icons`, `iconsPending`) instead of `.has-thumb`; contact sheets are `catalog-<category>.png`. `scripts/brick-share.test.mjs` now names `hoverboard` / `plaid` as the part and colour the catalog doesn't have (`rocket` and `gold` became real).
