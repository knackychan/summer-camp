# Slice 01: Sticker model

**Status:** Design approved by Papa 2026-10-05 (`design.md` D1, D2). Built 2026-10-06; unit tests green.
**Goal:** A pure module that reads a program node as "one card + stickers" and changes its stickers, without touching the AST shape the engine runs.
**Depends on:** —
**Files:** `js/games/codequest/stickers.js` (new), `sw.js`, `scripts/codequest.test.mjs`.

## Change

- **`stickers.js`** (ES module, no DOM, no `S`):
  - `cardView(node)` returns `{ card, times, test }` for these shapes, else `null` (legacy bracket):
    - `action`, `target` or `call` → `{ card: node, times: 1, test: null }`
    - `repeat(N, [x])` with numeric `N` and `x` a plain card → `{ card: x, times: N, test: null }`
    - `ifNode(T, [x], [])` with string `T` → `{ card: x, times: 1, test: T }`
    - `repeat(N, [ifNode(T, [x], [])])` → `{ card: x, times: N, test: T }`
  - `buildCard({ card, times, test }, uid)` builds the D2 shape: `times > 1` wraps in `repeat`, `test` wraps in `ifNode`, `repeat` outside `if`. `uid` is a function `prefix → string` passed in by the caller.
  - `withSticker(node, sticker, uid)`: `sticker` is `{ kind: 'repeat', times }` or `{ kind: 'if', test }`. Replaces the matching sticker, keeps the other. Returns `null` when `cardView(node)` is `null`.
  - `withoutStickers(node)` → the bare card.
  - `isPlainCard(node)` → `action` / `target` / `call`.
- **`sw.js`**: add `./js/games/codequest/stickers.js` to `APP_SHELL`, bump `CACHE_NAME`.

## DONE WHEN

- Unit tests in `scripts/codequest.test.mjs`:
  - round trip `cardView(buildCard(v)) ≈ v` for plain, ×N, if, ×N + if;
  - `withSticker` replaces a repeat count and keeps the if, and the reverse;
  - multi-card repeat, else, `forOf`, expression count and doubly nested nodes give `null`;
  - every card-room reference solution (`codingView !== 'code'`), rebuilt card by card through `cardView` → `buildCard`, has the same `combinedBlockCount` as the original, and every node except q12's Rune `R2[attack, attack]` and q45's expression-count repeat has a non-null `cardView`.
- `node scripts/check.mjs` green.
