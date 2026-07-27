# js/ — two load models in one folder

Read this before adding a file here or moving code out of `index.html`.

## The boundary

| | Classic global scripts | ES modules |
|---|---|---|
| Which files | everything in `js/` **except** below | `main.js`, `games/**` |
| Loaded by | `<script src>` tags in `index.html` / `admin.html` | one `<script type="module" src="js/main.js">` |
| Talk to each other via | `window.SQ*` globals | `import` |
| Can `import`? | **No.** | yes |

`js/vendor/` is third-party (Three.js, OrbitControls), lazy-imported by 3D games. Never edit it, never lint it — `scripts/check.mjs` excludes it deliberately.

## The classic-script shape

Every non-module file here is one IIFE with a dual export:

```js
(function(){
  /* ... */
  if(typeof window!=="undefined") window.SQThing = api;
  if(typeof module!=="undefined" && module.exports) module.exports = api;  // keep this
})();
```

The `module.exports` half is **not** dead code: `scripts/*.test.mjs` and `check.mjs` pull these in with `createRequire`. Drop it and the tests stop seeing the file. When a file needs a dependency at load time it reaches for the global with a `require` fallback for the node side — see [lock-core.js:4](lock-core.js#L4) and [brain-core.js:4](brain-core.js#L4).

## Script order in index.html is load-bearing

Three files capture a dependency **at IIFE evaluation time**, so a reordered `<script>` tag is an instant `undefined`:

- `lock-core.js` needs `window.SQTime` → after `time-core.js`
- `brain-core.js` needs `window.SQBrainData` → after `brain-data.js`
- `brain-ui.js` needs both of the above → after `brain-core.js`

Everything else resolves globals lazily inside functions and is order-free.

## ESM always runs last

`type="module"` defers. `main.js` therefore executes **after every classic script**, never before — so a classic script cannot call `window.SQLoadGame` or `window.SQGames` at parse time, only from inside a handler that fires later.

This one-way timing is why crossing the boundary uses **injection, not import**. `sync.js` can't import the game registry, so `main.js` pushes the predicate down into it — [main.js:10](main.js#L10) → [sync.js:566](sync.js#L566), `SyncStore.setBestStatCheck(fn)`. `sync.js` keeps a working default so it stays correct with no registry present. Copy that pattern for any new classic↔module seam; don't convert a classic file to ESM to avoid it (design.md §4 keeps them classic on purpose).

Note the global is `window.SyncStore` — the game-platform design.md calls it `SQSync`; the code is right, the doc is stale.

## Adding a file here

1. `check.mjs` finds it automatically now (it globs `js/**/*.js`) — no list to update.
2. If anything loads it, add it to `APP_SHELL` in `sw.js` and bump `CACHE_NAME`. Offline-first is a non-negotiable and `check.mjs` fails the build if you forget.
3. Classic script? Add the `<script>` tag, and check the order rule above.
4. Run `node scripts/check.mjs`. Red ⇒ do not commit.
