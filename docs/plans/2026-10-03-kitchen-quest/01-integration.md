# Native Kitchen Quest integration

Dependencies: root game host, manifest, Pixel Planet palette, existing scheduler.

1. Port and test the cooking domain from Kitchen-Quest-v0.6.0.
2. Build a native bilingual pixel diner with recipe guidance, two customer plates, grill, chopping board, oven, ingredient removal, mode confirmation and pause.
3. Register the game and planet destination; cache runtime dependencies.
4. Verify domain behavior, browser cooking and navigation, responsive layout, offline relaunch and Android web packaging.

DONE WHEN: a child can enter from Games or the planet, cook and serve exact orders, switch customers without losing dishes, replenish ingredients, pause safely, and leave through shared Back; all new files ship in the offline bundle and the required project gate passes.

Status: implemented. Physical tablet acceptance remains a separate device check.

## Validation

- `node scripts/kitchen-quest.test.mjs`: exact recipe order, independent dishes, direct cooking ownership, refunds, finite stock, chopping, baking, difficulty confirmation, stale/duplicate actions and palette-constrained integer pixel drawing.
- `node scripts/check.mjs`: required full project gate passes.
- `node --test scripts/planet-map.test.mjs scripts/world-explorer.test.mjs scripts/content-registry.test.mjs scripts/service-worker-offline.test.mjs`: 26 checks pass, including registry locks and offline caching.
- `python scripts/check-kitchen-quest-ui.py --target source`: 39 checks pass in isolated headless Edge with a synthetic local profile. Real pointer cooking/serving, best-score persistence, pause/confirmation, keyboard Back, stock preparation, four-step recipes, responsive layouts, teardown/reopen and offline relaunch. Snapshots are read-only; the game clock runs normally.
- `python scripts/check-kitchen-quest-ui.py --target web --out .tmp/kitchen-quest-web`: the same 39 checks pass against the final distributable payload, including offline reload. Both browser runs report zero page errors and zero console errors.
- `npm run build:android-web` and `npm run verify:android-web`: 460-file payload built and verified. This packages the web runtime; it does not install an APK on a physical tablet.

Browser screenshots/reports are written under `.tmp/kitchen-quest-ui/`; `--target web --out .tmp/kitchen-quest-web` exercises the distributable payload. Width/height coverage: 1280×800, 1024×500, 768×1024 and 390×844. Compact layouts scroll inside the game; controls remain at least 44 pixels high. Backgrounding and native pause freeze timers until the child resumes.
