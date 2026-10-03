# Kitchen Quest — 1280 × 600 tablet

User request: verify responsiveness and make the kitchen work reliably on a 1280 × 600 tablet, retaining the existing pixel art direction.

## Scope and acceptance

- Keep both customer selectors, all ingredients, station tabs, Pause, Cookbook and Serve visible at 1280 × 600 CSS pixels. Use the available landscape width; long recipes and workstation content scroll within their own panes.
- Keep touch controls at least 44 × 44 pixels, bilingual labels legible, and the shared Summer button clear of game controls.
- Touch swipes must scroll without adding/removing ingredients. A held tap must survive a countdown redraw and apply once on release. Mouse and keyboard controls keep working.
- Shared overlays freeze cooking and require an explicit resume after closing. Native pause, cookbook and mode confirmation keep their existing behavior.
- Check all five stations, long/custom orders, a full plate, cookbook, pause/confirmation, actual touch cooking, smaller effective viewports and Chrome 138. Browser simulation does not certify physical GPU, battery or touch hardware.
- Run focused Kitchen checks, the required full project gate and packaged-web validation. Preserve unrelated concurrent work.

## Baseline

At 1280 × 600 the game had a 544-pixel-high viewport but needed 658–829 pixels depending on the station. On the initial plate, Serve was at y607–661, entirely below the screen. Prep pushed it to y778–832. Buttons were already at least 44 pixels; the whole-game scrolling layout and touch-on-press behavior were the problems.

Status: implemented and browser-verified.

## Shipped behavior

- The landscape layout uses a right-hand ingredient shelf and a compact goal board. Shared navigation, both customers, all seven ingredients, workstation tabs and Serve fit at 1280 × 600 without scrolling the whole game.
- Tickets and workstations scroll independently; the oven's Bake/Clear controls stay visible. New customers and station changes start their respective pane at the top. Notifications sit over the game-list sidebar, clear of cooking controls.
- Touch and pen use native tap recognition, so a swipe cannot add or remove food. Timer redraws retain the pressed element until release. Mouse input still acts on press.
- The host supplies an overlay-presence predicate. Kitchen freezes behind shared overlays, blocks background shortcuts and asks the child to resume after closing. Native pause also works while Summer is open.

## Validation

- `node scripts/check.mjs`: full project gate passes after the final changes.
- Kitchen model and prep checks pass; the existing v0.7 browser suite passes all 60 checks, including 1280 × 800, 1024 × 500, 768 × 1024 and 390 × 844 layouts.
- `python scripts/check-kitchen-tablet-ui.py`: 122/122 checks pass with coarse-pointer emulation and real touch events in Edge 154 and Chrome 138. The same 122 pass against the verified packaged web copy. All runs report zero page or console errors.
- Cases include all five stations, visible and unobstructed primary controls, 44-pixel targets, notifications, a twelve-layer plate, held touch across timer redraw, actual concurrent cooking and six serves, custom orders, shared/native pause interactions, cookbook scrolling and a 1280 × 520 viewport.
- The seven-step worst case uses an isolated HTTP response override to choose a valid Chef Salad with extra tomato. Production diagnostics stay read-only; normal cooking cases use actual game controls.
- At 1280 × 600, both oven actions are fully visible at y426.66–477. Screenshots reviewed for the diner, oven, three-goal shift and long recipes.
- Android web build and verification pass: 478 files, SHA-256 `2ec7c90bb145baa9bab8062ab1172206d881a7bf70e7c62b35b4dd2f09782c3e`. An immutable copy under `.tmp/kitchen-tablet-payload-v126/` prevents unrelated rebuilds from interrupting browser tests.

Reports/screenshots: `.tmp/kitchen-tablet-edge/`, `.tmp/kitchen-tablet-chrome138/`, `.tmp/kitchen-tablet-web/`, and `.tmp/kitchen-tablet-v07-regression/`. These establish browser behavior at the specified CSS viewport; they do not certify physical tablet performance.

## Connected-device limit

A read-only check found a Samsung SM-X210 running Android 16, with a 1920 × 1200 physical / 1280 × 800 logical landscape display and font scale 1.15. Its installed APK is older and lacks the Kitchen entry module and v0.7 UI. A separate local browser smoke check was attempted with an isolated origin and empty service configuration; the screen was off and keyguard locked, so normal visible gameplay could not be verified. No APK update, device setting change or modification of the installed app's saved progress was performed. Physical acceptance remains pending on an unlocked device with the current build.

The temporary server and ADB port mappings were removed. Chrome exposed no target matching the isolated test origin, so existing tabs were left untouched; Android may defer the local test URL until unlock. Device evidence: `.tmp/kitchen-physical-smoke/report.json`.
