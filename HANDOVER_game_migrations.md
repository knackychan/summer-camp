# Handover - Arcade Game Migrations

**Date:** 2026-07-27
**Status:** registry/ESM migration is active. Several games now live in `js/games/`; `index.html` still hosts legacy games and shared app shell code.

## What Was Fixed

After moving game code out of `index.html`, the app threw:

```text
Uncaught (in promise) ReferenceError: CT is not defined
    at startRegistered ((index):1233:18)
```

Root cause: `startRegistered(game)` built one context object for every registered game, and that object still included:

```js
cityData:{CT:CT, CITY_W:CITY_W, CITY_H:CITY_H, MAP:CITY_MAP, BUILDINGS:CITY_B, TREES:CITY_TREES, PLOTS:CITY_PLOT}
```

Those globals were deleted from `index.html` during the City migration, so any registered game could fail before `game.init()` was even called. This was a host bug, not a City-only bug.

Fix shipped:
- `index.html`: removed `cityData` from the generic registered-game context.
- `js/games/city.js`: made City self-contained by moving `CT`, `CITY_MAP`, buildings, trees, and plot colors into the module.
- `index.html` and `admin.html`: added `<meta name="mobile-web-app-capable" content="yes">` beside the Apple PWA meta tag.

Verified:
- `node scripts/check.mjs` passes.
- A focused smoke test imports `js/games/city.js`, calls `init(ctx)` with no `ctx.cityData`, then calls `stop()`.

## Important Console Noise

These messages are from an injected browser extension content script, not Summer Quest:

```text
contentscript.js MaxListenersExceededWarning
ObjectMultiplex - orphaned data for stream "app-init-liveness"
ObjectMultiplex - orphaned data for stream "background-liveness"
```

Do not chase them in this repo unless they also reproduce in a clean browser profile with extensions disabled.

## Migration Rule Going Forward

The host context in `startRegistered(game)` must stay generic. Do not add game-specific data like `cityData`, `digData`, or per-game globals to that context. A migrated game module should carry its own static constants, state, timers, event handlers, and teardown.

Good shape:

```js
// js/games/example.js
var S = null;
var STATIC_LEVEL_DATA = [...];

function init(ctx) {
  S = { running: true, timer: null };
  // Use ctx for shared services only: hud, say, sfx, fx, words, kids, finish.
}

function stop() {
  if (!S) return;
  S.running = false;
  if (S.timer) clearInterval(S.timer);
  S = null;
}

export default { id: "example", keyboard: false, bestKey: "example", init, stop };
```

Shared `ctx` services that are okay:
- `kid`, `kids`
- `mount`, `stage`
- `hud`, `say`, `sayPair`
- `sfx`, `keys`, `fx`
- `settings`, `rand`, `shuffle`
- `best`, `stars`
- `words`
- `finish(res)`

## Checklist For The Next Migration

1. Read `docs/plans/2026-07-26-game-platform/17-pilot-migration.md` and the relevant current `js/games/*.js` module before editing.
2. Move all game-owned constants out of `index.html` with the game.
3. Keep state module-local, usually `var S = null`.
4. Register the game in `js/games/index.js` with `legacy: false`.
5. Add the module to `sw.js` `APP_SHELL` and bump `CACHE_NAME` if a new runtime file or asset is added.
6. Ensure `stop()` removes listeners, cancels `requestAnimationFrame`, clears timers, and nulls state last.
7. Run:

```powershell
node --test scripts\registry.test.mjs
node scripts\check.mjs
```

8. Browser test the migrated game, then switch away and back to make sure loops/timers do not leak.
9. Offline test after loading once with wifi on.

## Watch For These Traps

- JavaScript evaluates every property in the `ctx` object before `game.init(ctx)`, so one missing global can crash unrelated migrated games.
- `index.html` still contains old shared helper functions. Only delete a helper when `rg` proves no legacy game still uses it.
- `keyboard: false` games should not rely on the host keyboard path.
- Best scores should go through `ctx.finish({ score })` and the module's `bestKey`; do not write progress directly from a migrated game.
- First-party runtime files still need to pass the legacy syntax scan: no `?.`, `??`, or `.flatMap`.

## Current Files Touched By The CT Fix

- `index.html`
- `admin.html`
- `js/games/city.js`

These changes are intentionally narrow and should be kept with the migration-fix commit.
