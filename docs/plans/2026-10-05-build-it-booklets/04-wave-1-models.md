# Slice 04 — Wave 1 models and the picture sheet

Implements design.md "First models".

**Depends on:** 02 (checker), 03 (view, for the pictures).

## Changes
- `js/books/build-it-data.js`: Duck 小鴨, Snail 蝸牛, Flower Pot 盆栽, Little House 小房子, Robot 機器人, Race Car 賽車, Bus 公車, all original designs.
- New `scripts/render-build-it.py` (Playwright): renders every step of every model to `test-results/build-it/<model>.png`, a contact sheet per model, for Papa to look at.

**DONE WHEN:** all 8 models pass `checkModel`; the picture sheets are reviewed by Papa; at least one model is built for real from the tablet by one of the kids.
