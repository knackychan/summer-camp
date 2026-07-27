# js/games/ — the arcade registry

ES modules only. Read [../CLAUDE.md](../CLAUDE.md) for how this folder talks to the classic-script world.
Full rationale: `docs/plans/2026-07-26-game-platform/design.md` §2–§4. This file is the working summary.

## Three kinds of file

| File | Role |
|---|---|
| `index.js` | **static manifest** — the one place that knows every game exists. Data only: no `init`, no DOM. Imported eagerly so the grid renders all tiles without downloading every game. Array order = grid order. |
| `registry.js` | `SQGames` — runtime store. Pure: touches no DOM and no globals, so node can import it directly. |
| `<id>.js` | one game. Imported **only when that game starts**. |

Adding a game means an `index.js` entry *and* an `<id>.js` module. The manifest entry alone renders a tile that opens nothing.

## The game object

```js
export default {
  id: "dig",
  meta: { icon:"⛏️", title:"Dig Site", tz:"挖土工地", blurb:"Dig the right rocks" },
  keyboard: false,
  bestKey: "dig",         // null when the game has no high score; must be unique
  settings(bar, ctx) {},  // omit when the game has none
  init(ctx) {},
  stop() {}
};
```

`meta` must match the manifest entry — `check.mjs` enforces it so the two can't drift.

## Two rules that are easy to get wrong

**Read nothing ambient.** Everything a game may touch arrives in `ctx`: `kid`, `mount`, `stage`, `hud`, `say`, `sayPair`, `sfx`, `settings`, `finish`, `keys`, `best`. No reaching for `state`, `progress`, `KIDS`, `beep`, `flash`. That injection is the whole point — it's what lets one game file be read and tested without the other eight in scope.

**`stop()` releases everything you created.** The old `stopArena` assumed exactly one rAF plus one timer. A second loop leaks; a WebGL context leaks harder. Teardown belongs to whoever allocated the resource — the host calls `stop()` on the outgoing game before starting the next. 2D games draw on `ctx.stage`; 3D games ignore it, append their own canvas to `ctx.mount`, and release the GL context in `stop()`. The host never knows which it is.

**Scoring goes through `ctx.finish({score})`** — never write `progress[kid].best` or call `saveProgress()`. The host writes the ledger and syncs; that's what makes `bestKey` mean anything.

## Migrating a game out of index.html

The recipe, from `docs/plans/2026-07-26-game-platform/17-pilot-migration.md`:

1. **Copy, don't cut.** Leave `index.html` untouched until the module is proven. Delete last, so every step is revertible.
2. **`state` → module-local `S`.** Mechanical find-and-replace *inside the new file only*, then read the result. This is where migration bugs hide.
3. **Globals → `ctx`.** `hud(` → `ctx.hud(`, `sGood()` → `ctx.sfx.good()`, `KIDS[kid]` → `ctx.kids[ctx.kid]`, `flash(`/`burst(` → `ctx.fx.*`, `say(` → `ctx.say(`.
4. **`bestOf(kid,"x")` → `ctx.best`.** The game never reads `progress`.
5. **Flip `legacy: false`** in `index.js` — until then [../main.js:16](../main.js#L16) returns `null` and the host silently falls back to the inline copy. This is the switch that actually ships the migration.
6. **Same commit:** add `./js/games/<id>.js` to `APP_SHELL` in `sw.js` and bump `CACHE_NAME`. `check.mjs` fails a migrated game that isn't precached.

**Behaviour preservation is the acceptance bar (design.md D4).** Do not fix, tune or improve a game while moving it. Spot a bug — write it down, leave it. A slice that moves *and* changes is two changes wearing one hat.

## Constraints that still bite

- **Bilingual invariant:** every kid-facing string keeps its 中文, verbatim, through the move.
- **Tablet-first:** handlers stay `onpointerdown`. "Modernising" them to `onclick` adds tap latency on the tablets.
- The `?.` / `??` / `.flatMap` scan in `check.mjs` is a **stale guard**, not a device requirement — the Android 8 baseline was retired 2026-07-27. If it trips on new code, relax the scan; don't contort the code.
