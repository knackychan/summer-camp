# Slice 04 — Checks

**Requested by Papa, 2026-10-05.** Gates for design.md C1–C5.

**Depends on:** 01–03.

## Changes
- `scripts/check.mjs` (Brick Lab catalog gate) — every footprint is whole studs; `top` sits inside the part, `sink` is sane; every model primitive has exactly one known kind, number-only sizes, `at` / `rot` / `s` as three numbers, a known colour slot, and sits near its footprint; `fixed` is true exactly when no slot is `main`; palette finishes name real colours; palette hexes are distinct (recolour looks materials up by hex).
- `scripts/check-brick-lab-ui.py` — `catalog_checks()`: 18 categories in build order; every category's tray shows a rendered picture per part; all 217 parts arm and build in < 50 ms; an animal's info card says "own colours"; a sitting minifig lands on a horse's saddle and a knight helmet drops over its head; 21 colours in three rows sliding sideways; a selected piece paints gold. The category-switch, short-tablet and 1024×600 checks now walk 18 categories (the list scrolls on every tablet, C4); "2x4" search expects tiles too.
- Contact sheets per category are saved as `catalog-<category>.png` in the harness output.

**Verified 2026-10-05:** `check.mjs` green (after `npm run build:mobile` and `npm run build:android-web`, which a fresh container lacks); `check-brick-lab-ui.py` 95/95 on source (Chromium 141 headless, SwiftShader) with the slice-14 "slow standard tablet steps down" check skipped — it fails the same way on the untouched code in this container (SwiftShader frame timing); the reduced tier still draws 88 calls / 31,490 triangles, the same as before. Every category reviewed in rendered contact sheets and a seeded scene. Not yet run: `check-android8-ui.py` with Chrome 138 (no Chrome 138 binary in the container), and real touch on a tablet.
