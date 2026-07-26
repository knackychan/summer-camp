# Slice 15 — Registry + ESM host

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `SQGames` (the registry), `js/main.js` (the ESM host) and the bridge that lets a game module reach the helpers still living in `index.html` — without moving a single game yet.

**Architecture:** Additive only. The inline script keeps running all nine games through its existing if/else chain; `startGame` gains one lazy check at the top that routes to the registry when a game is registered there. Nothing is registered yet, so behaviour is identical. This slice exists so slices 17–19 have somewhere to move games *to*.

**Tech Stack:** ES modules (no build step, no bundler), `node:test`, `scripts/check.mjs`.

**Design:** `docs/plans/2026-07-26-game-platform/design.md` §2, §3, §4

**Depends on:** nothing. Ships independently.

**DONE WHEN:**
- All nine games still play exactly as before, from the same games grid.
- `window.SQGames` exists after load, with zero games registered.
- `js/main.js` loads as a module on the actual tablet (Task 1 gate).
- `node scripts/check.mjs` passes.
- `node --test scripts/registry.test.mjs` passes.
- The app still works with wifi off.

---

## Constraints you must not violate

`scripts/check.mjs` enforces the first three and will fail the build:

1. **No `?.` optional chaining, no `??` nullish coalescing, no `.flatMap(`** in any file listed in `scripts/check.mjs:20` `runtimeFiles`. Every new file in `js/` gets added to that list, so this applies to all of them. Use `a && a.b` and `x != null ? x : fallback`.
2. **`index.html` must contain exactly one inline `<script>`** — `scripts/check.mjs:21-24` asserts `scriptMatches.length === 1`. The regex at `scripts/check.mjs:21` skips any tag carrying `src=`, so adding `<script type="module" src="js/main.js">` does **not** break it. Do not add a second *inline* script.
3. **The `/* finger map` marker at `index.html:913` must stay put.** `scripts/check.mjs:48-59` slices the inline script at that marker and evaluates everything above it to validate the content data. Nothing above line 913 moves in this slice.
4. **Bilingual invariant:** every user-facing string ships EN + 繁體中文.
5. **Offline-first:** every new file goes into `sw.js` `APP_SHELL` in the same commit that creates it, and `CACHE_NAME` is bumped.

---

## File Structure

| File | Change | Responsibility after this slice |
|---|---|---|
| `js/games/registry.js` | Create | `SQGames` — register, lookup, `isBest`, ordered list. Pure, no DOM. |
| `js/games/index.js` | Create | Static manifest: ordered `{id, meta, keyboard, bestKey, brain}` for all nine arcade games plus the nine brain games. Data only. |
| `js/main.js` | Create | ESM entry. Imports registry + manifest, publishes `window.SQGames`, verifies the manifest matches the inline `LEVELS`. |
| `index.html` | Modify | Adds the module script tag; adds the `SQHost` bridge; adds the lazy registry branch at the top of `startGame`. |
| `sw.js` | Modify | `APP_SHELL` gains the three new files; `CACHE_NAME` bumped to v9. |
| `scripts/check.mjs` | Modify | New files added to `runtimeFiles`; manifest integrity block. |
| `scripts/registry.test.mjs` | Create | Unit tests for the registry. |
| `README.md` | Modify | Dev-server note — `file://` no longer works. |

---

## Task 1: Prove ES modules run on the tablet — GATE

**This task blocks the whole plan. Do not write code before it passes.**

`scripts/check.mjs:41-43` bans optional chaining for Android 8 compatibility, which means the target browser is Chrome < 80. `<script type="module">` needs Chrome 61+ and dynamic `import()` needs Chrome 63+. Those are almost certainly available, but "almost certainly" is not good enough when the failure mode is a black screen on a kid's tablet.

**Files:**
- Create: `modtest.html` (temporary, deleted in Step 4)

- [ ] **Step 1: Write the probe page**

Create `modtest.html` in the repo root:

```html
<!doctype html>
<meta charset="utf-8">
<title>Module support probe</title>
<body style="font:20px system-ui;padding:2em">
<div id="out">classic script did not run</div>
<script nomodule>
  document.getElementById("out").textContent = "FAIL: nomodule ran — this browser has no ES module support";
</script>
<script type="module">
  const out = document.getElementById("out");
  out.textContent = "static module OK — testing dynamic import…";
  import("./modprobe.js")
    .then(function(m){ out.textContent = "PASS: static + dynamic import both work (" + m.hello + ")"; })
    .catch(function(e){ out.textContent = "FAIL: dynamic import broke — " + e.message; });
</script>
</body>
```

Create `modprobe.js` in the repo root:

```js
export const hello = "dynamic import works";
```

- [ ] **Step 2: Serve and open on the real tablet**

Run from the repo root: `npx serve .` (or `python -m http.server 8000`)

Open `http://<your-machine-ip>:8000/modtest.html` **on one of the kids' tablets** — not on the desktop. The desktop browser is not the target.

Expected: `PASS: static + dynamic import both work (dynamic import works)`

- [ ] **Step 3: Decide**

- **PASS** → continue to Task 2.
- **`FAIL: nomodule ran`** → the tablet has no module support. **Stop.** Report back: the design's D2 must be revisited, and the fallback is the IIFE-globals option recorded in design.md §4. Slices 16–21 still work under that option; only the module mechanics change.
- **`FAIL: dynamic import broke`** → static modules work, dynamic ones do not. **Stop and report.** The fallback is static imports (all games imported eagerly in `js/games/index.js`), which costs the parse-time win but keeps every other benefit.

- [ ] **Step 4: Delete the probe**

```bash
rm modtest.html modprobe.js
```

Nothing to commit — these files never enter git.

---

## Task 2: The registry

**Files:**
- Create: `js/games/registry.js`
- Create: `scripts/registry.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `scripts/registry.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { SQGames } from "../js/games/registry.js";

function fresh() {
  SQGames.reset();
  return SQGames;
}

const DIG = {
  id: "dig",
  meta: { icon: "⛏️", title: "Dig Site", tz: "挖土工地", blurb: "Dig the right rocks" },
  keyboard: false,
  bestKey: "dig",
  init() {},
  stop() {},
};

test("register then get returns the same game", () => {
  const g = fresh();
  g.register(DIG);
  assert.equal(g.get("dig"), DIG);
  assert.equal(g.has("dig"), true);
  assert.equal(g.has("nope"), false);
});

test("get on an unknown id returns null, never throws", () => {
  const g = fresh();
  assert.equal(g.get("nope"), null);
});

test("registering the same id twice throws", () => {
  const g = fresh();
  g.register(DIG);
  assert.throws(() => g.register(DIG), /already registered/);
});

test("register rejects a game with no id or no init", () => {
  const g = fresh();
  assert.throws(() => g.register({ meta: DIG.meta, init() {} }), /id/);
  assert.throws(() => g.register({ id: "x", meta: DIG.meta }), /init/);
});

test("isBest matches a registered bestKey and nothing else", () => {
  const g = fresh();
  g.register(DIG);
  assert.equal(g.isBest("dig"), true);
  assert.equal(g.isBest("balloon"), false);
  assert.equal(g.isBest(""), false);
});

test("isBest ignores games that declare no bestKey", () => {
  const g = fresh();
  g.register({ id: "hunt", meta: DIG.meta, bestKey: null, init() {}, stop() {} });
  assert.equal(g.isBest("hunt"), false);
});

test("ids returns registration order, not insertion-sorted order", () => {
  const g = fresh();
  g.register({ id: "zebra", meta: DIG.meta, init() {}, stop() {} });
  g.register({ id: "apple", meta: DIG.meta, init() {}, stop() {} });
  assert.deepEqual(g.ids(), ["zebra", "apple"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/registry.test.mjs`
Expected: FAIL — `Cannot find module '../js/games/registry.js'`

- [ ] **Step 3: Implement `js/games/registry.js`**

```js
/* SQGames — the arcade game registry (design.md §2).
   Pure: no DOM, no globals reached for. The host publishes it on window;
   this module never touches window itself, so node can import it directly. */

const games = {};
const order = [];

function register(game) {
  if (!game || !game.id) throw new Error("game must have an id");
  if (typeof game.init !== "function") throw new Error("game " + game.id + " has no init()");
  if (games[game.id]) throw new Error("game " + game.id + " is already registered");
  games[game.id] = game;
  order.push(game.id);
  return game;
}

function get(id) {
  const g = games[id];
  return g ? g : null;
}

function has(id) {
  return !!games[id];
}

function ids() {
  return order.slice();
}

function all() {
  return order.map(function (id) { return games[id]; });
}

/* A best-score stat key belongs to some registered game. sync.js asks this
   instead of carrying its own list (design.md §5). */
function isBest(key) {
  if (!key) return false;
  for (let i = 0; i < order.length; i++) {
    if (games[order[i]].bestKey === key) return true;
  }
  return false;
}

/* Tests only. The app registers once at boot and never unregisters. */
function reset() {
  Object.keys(games).forEach(function (k) { delete games[k]; });
  order.length = 0;
}

export const SQGames = { register, get, has, ids, all, isBest, reset };
export default SQGames;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/registry.test.mjs`
Expected: PASS — 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add js/games/registry.js scripts/registry.test.mjs
git commit -m "feat(games): add the SQGames registry"
```

---

## Task 3: The manifest

The manifest is what lets the games grid render every tile without importing any game's code (design.md §2). It must list **all eighteen** entries currently in `LEVELS` (`index.html:590-609`) — nine arcade, nine brain — in exactly that order, because `index.html:2938` uses `Object.keys(LEVELS)` order for the grid.

**Files:**
- Create: `js/games/index.js`
- Modify: `scripts/registry.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/registry.test.mjs`:

```js
import { MANIFEST } from "../js/games/index.js";

test("manifest lists every game with a bilingual title and blurb", () => {
  assert.ok(MANIFEST.length >= 18);
  const seen = new Set();
  for (const entry of MANIFEST) {
    assert.ok(entry.id, "entry missing id");
    assert.equal(seen.has(entry.id), false, `duplicate id ${entry.id}`);
    seen.add(entry.id);
    assert.ok(entry.meta.icon, `${entry.id}: missing icon`);
    assert.ok(entry.meta.title, `${entry.id}: missing English title`);
    assert.ok(entry.meta.tz, `${entry.id}: missing 中文 title`);
    assert.ok(entry.meta.blurb, `${entry.id}: missing blurb`);
    assert.equal(typeof entry.keyboard, "boolean", `${entry.id}: keyboard must be boolean`);
  }
});

test("manifest bestKeys are unique where present", () => {
  const keys = MANIFEST.map((e) => e.bestKey).filter(Boolean);
  assert.equal(new Set(keys).size, keys.length, "duplicate bestKey in manifest");
});

test("brain games are flagged and carry no arcade bestKey", () => {
  const brain = MANIFEST.filter((e) => e.brain);
  assert.equal(brain.length, 9);
  for (const entry of brain) assert.equal(entry.bestKey, null, `${entry.id}: brain games score via brain_*`);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/registry.test.mjs`
Expected: FAIL — `Cannot find module '../js/games/index.js'`

- [ ] **Step 3: Implement `js/games/index.js`**

Copy the order and strings from `index.html:590-609` exactly — do not retype them from memory, and do not "improve" any wording. `keyboard` is `false` for exactly `city` and `dig`, matching the `noKb` test at `index.html:1176`. Brain entries are keyboard-less because `SQBrain` draws its own pads.

```js
/* Static manifest — the one place that knows every game exists (design.md §2).
   Data only: no init, no stop, no DOM. Imported eagerly so the games grid can
   render all tiles without downloading nine game modules. Order is the grid
   order, matching the old Object.keys(LEVELS) order at index.html:2938. */

export const MANIFEST = [
  { id: "machines", brain: false, keyboard: true,  bestKey: null,      meta: { icon: "🚜", title: "Big Machines",  tz: "大機器",   blurb: "Race, dig & fly" } },
  { id: "city",     brain: false, keyboard: false, bestKey: "city",    meta: { icon: "🏙️", title: "City Drive",    tz: "城市開車", blurb: "Drive & deliver" } },
  { id: "dig",      brain: false, keyboard: false, bestKey: "dig",     meta: { icon: "⛏️", title: "Dig Site",      tz: "挖土工地", blurb: "Dig the right rocks" } },
  { id: "balloon",  brain: false, keyboard: true,  bestKey: "balloon", meta: { icon: "🎈", title: "Balloon Pop",   tz: "戳氣球",   blurb: "Pop balloons with keys" } },
  { id: "hunt",     brain: false, keyboard: true,  bestKey: null,      meta: { icon: "🔎", title: "Key Hunt",      tz: "找按鍵",   blurb: "Find the glowing key" } },
  { id: "home",     brain: false, keyboard: true,  bestKey: null,      meta: { icon: "🎯", title: "Home Row",      tz: "基準鍵",   blurb: "Learn your fingers" } },
  { id: "race",     brain: false, keyboard: true,  bestKey: "race",    meta: { icon: "🚀", title: "Word Racer",    tz: "文字競速", blurb: "Type fast for a score" } },
  { id: "orc",      brain: false, keyboard: true,  bestKey: "orc",     meta: { icon: "⚔️", title: "Orc Attack",    tz: "半獸人來襲", blurb: "Type to defend the hero" } },
  { id: "vocab",    brain: false, keyboard: true,  bestKey: "shop",    meta: { icon: "🧙", title: "Word Wizard",   tz: "文字巫師", blurb: "Learn English words" } },

  { id: "calc",     brain: true,  keyboard: false, bestKey: null, meta: { icon: "➕", title: "Calculations",    tz: "計算",     blurb: "Quick sums" } },
  { id: "signs",    brain: true,  keyboard: false, bestKey: null, meta: { icon: "❓", title: "Sign Finder",     tz: "找符號",   blurb: "Find the missing sign" } },
  { id: "lowhigh",  brain: true,  keyboard: false, bestKey: null, meta: { icon: "🔢", title: "Low to High",     tz: "由小到大", blurb: "Remember and order" } },
  { id: "stroop",   brain: true,  keyboard: false, bestKey: null, meta: { icon: "🎨", title: "Color Words",     tz: "顏色字",   blurb: "Say the ink, not the word" } },
  { id: "crunch",   brain: true,  keyboard: false, bestKey: null, meta: { icon: "🔍", title: "Number Cruncher", tz: "數一數",   blurb: "Count them fast" } },
  { id: "clock",    brain: true,  keyboard: false, bestKey: null, meta: { icon: "🕐", title: "Time Lapse",      tz: "時鐘",     blurb: "Read the clock" } },
  { id: "change",   brain: true,  keyboard: false, bestKey: null, meta: { icon: "💱", title: "Change Maker",    tz: "找零錢",   blurb: "Count the change" } },
  { id: "wordmem",  brain: true,  keyboard: false, bestKey: null, meta: { icon: "🧠", title: "Word Memory",     tz: "記單字",   blurb: "Remember the words" } },
  { id: "recall",   brain: true,  keyboard: false, bestKey: null, meta: { icon: "🔁", title: "Math Recall",     tz: "記憶計算", blurb: "Answer the one before" } },
];

export function findEntry(id) {
  for (let i = 0; i < MANIFEST.length; i++) {
    if (MANIFEST[i].id === id) return MANIFEST[i];
  }
  return null;
}

export default MANIFEST;
```

**Note on `vocab`'s `bestKey`:** it is `"shop"`, not `"vocab"`. That is not a typo — `index.html:927` seeds `best.shop` and the Potion Shop mode is what scores. Changing it would orphan every kid's existing high score in `game_stats`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/registry.test.mjs`
Expected: PASS — 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add js/games/index.js scripts/registry.test.mjs
git commit -m "feat(games): add the static game manifest"
```

---

## Task 4: The host and the bridge

The inline script's `function` declarations are globals; a module's are not. For a game module to call `say(...)` or read `KIDS`, the inline script must hand those out deliberately. That handoff is `window.SQHost`, and it is the only coupling between old and new worlds.

**Files:**
- Create: `js/main.js`
- Modify: `index.html:583` (the inline script's opening), `index.html:3380` (boot)

- [ ] **Step 1: Add the bridge at the end of the inline script**

In `index.html`, find the boot IIFE at the very end of the inline script (`index.html:3380`):

```js
(async()=>{ await loadProgress(); restoreAppPlace(); setupRealtime(); startTimelineWatcher(); })();
```

Insert **immediately above** it:

```js
/* ---- Bridge to the ESM host (design.md §3) ----
   Everything a migrated game is allowed to touch, handed over explicitly.
   A game module reads this and nothing else from the old world. As games move
   out in slices 17-19 this object shrinks; at slice 20 it disappears. */
window.SQHost={
  KIDS:KIDS, LEVELS:LEVELS,
  get kid(){return kid;},
  get progress(){return progress;},
  get settings(){return settings;},
  get store(){return store;},
  hud:hud, say:say, sayPair:sayPair,
  sfx:{good:sGood,bad:sBad,pop:sPop,zap:sZap,hit:sHit,win:sWin},
  keys:{build:buildKeyboard,highlight:highlightTarget,highlightSet:highlightSet,press:pressFx},
  fx:{flash:flash,burst:burst,bigFloat:bigFloat,wobbleMsg:wobbleMsg,hint:hint},
  rand:rand, shuffle:shuffle,
  saveProgress:saveProgress, noteStars:noteStars,
  stage:function(){return document.getElementById("stage");},
  mount:function(){return document.getElementById("stage").parentNode;}
};
```

The getters matter: `kid`, `progress`, `settings` and `store` are reassigned by the inline script at runtime, so copying their values once would hand a game a stale reference.

- [ ] **Step 2: Add the module script tag**

In `index.html`, immediately after the last existing `<script src=...>` tag (`index.html:582`, `js/brain-ui.js`) and **before** the inline `<script>` at `index.html:583`, add:

```html
<script type="module" src="js/main.js"></script>
```

Module scripts are deferred, so this runs *after* the inline script — which is exactly what the bridge needs.

- [ ] **Step 3: Create `js/main.js`**

```js
/* ESM host (design.md §4). Publishes the registry for the inline script to
   find, and guards the manifest against drifting from the inline LEVELS. */
import { SQGames } from "./games/registry.js";
import { MANIFEST, findEntry } from "./games/index.js";

window.SQGames = SQGames;
window.SQManifest = MANIFEST;

/* Lazily load and register one game module. Returns the game, or null when the
   id has no module yet — that is the normal case for a game still living in
   index.html, and the caller falls back to the legacy path. */
const loading = {};
window.SQLoadGame = function (id) {
  if (SQGames.has(id)) return Promise.resolve(SQGames.get(id));
  const entry = findEntry(id);
  if (!entry || entry.brain || entry.legacy !== false) return Promise.resolve(null);
  if (!loading[id]) {
    loading[id] = import("./games/" + id + ".js")
      .then(function (mod) { return SQGames.register(mod.default); })
      .catch(function (err) {
        delete loading[id];
        console.error("game module failed to load: " + id, err);
        return null;
      });
  }
  return loading[id];
};

/* Drift guard: the manifest and the inline LEVELS must agree while both exist.
   Slice 20 deletes LEVELS and this check with it. */
(function guard() {
  const L = window.SQHost && window.SQHost.LEVELS;
  if (!L) return;
  const missing = MANIFEST.filter(function (e) { return !L[e.id]; }).map(function (e) { return e.id; });
  const extra = Object.keys(L).filter(function (id) { return !findEntry(id); });
  if (missing.length || extra.length) {
    console.error("manifest/LEVELS drift — missing:", missing, "extra:", extra);
  }
})();
```

**On `entry.legacy !== false`:** every manifest entry is legacy until its migration slice flips it. Slice 17 adds `legacy: false` to `dig` and `city`; slice 18 to the keyboard games; slice 19 to the last two. Until then `SQLoadGame` returns `null` and the old if/else runs — which is what keeps this slice behaviour-identical.

- [ ] **Step 4: Route `startGame` through the registry when a module exists**

In `index.html:1189`, find the dispatch chain inside `startGame`:

```js
  if(LEVELS[lvl].brain){ startBrain(lvl); return; }
  if(lvl==="hunt") initHunt();
```

Replace those two lines with:

```js
  if(LEVELS[lvl].brain){ startBrain(lvl); return; }
  if(window.SQLoadGame){
    const pending=window.SQLoadGame(lvl);
    if(pending){
      pending.then(function(game){ if(game) startRegistered(game); else startLegacy(lvl); });
      return;
    }
  }
  startLegacy(lvl);
}

/* Hand off to a migrated game module (design.md §3). */
function startRegistered(game){
  currentGame=game;
  const H=window.SQHost;
  game.init({
    kid:kid, mount:H.mount(), stage:H.stage(),
    hud:hud, say:say, sayPair:sayPair, sfx:H.sfx, keys:H.keys, fx:H.fx,
    settings:settings, rand:rand, shuffle:shuffle,
    finish:function(res){ finishRegistered(game,res); }
  });
}

function finishRegistered(game,res){
  if(!game.bestKey||!res||typeof res.score!=="number")return;
  const p=progress[kid];
  if(res.score>(p.best[game.bestKey]||0)){
    p.best[game.bestKey]=res.score;
    saveProgress();
    if(store)store.setStat(kid,game.bestKey,res.score);
  }
}

function startLegacy(lvl){
  if(lvl==="hunt") initHunt();
```

- [ ] **Step 5: Track and stop the outgoing game**

In `index.html:926`, find the state declaration:

```js
let sound=true, kid=null, level=null, kb={}, state={};
```

Change it to:

```js
let sound=true, kid=null, level=null, kb={}, state={}, currentGame=null;
```

Then in `stopArena` (`index.html:1231`), add the registry teardown as the first thing it does:

```js
function stopArena(){
  if(currentGame&&currentGame.stop){ try{currentGame.stop();}catch(e){console.error(e);} }
  currentGame=null;
  if(state.raf) cancelAnimationFrame(state.raf);
```

The `try/catch` is deliberate: a game module that throws during teardown must not strand the kid on a dead screen.

- [ ] **Step 6: Verify nothing changed**

Run: `npx serve .` then open `http://localhost:3000/index.html`

Expected — all of these behave exactly as before this slice:
1. Open each kid's hub → Games. All 18 tiles render, in the same order, with the same icons and 中文.
2. Play Dig Site, City Drive, Orc Attack, Word Wizard. Each starts, scores, and returns to the hub.
3. Open the browser console. Expect **no** `manifest/LEVELS drift` error and no module load errors.
4. `window.SQGames.ids()` in the console returns `[]` — nothing registered yet, by design.

- [ ] **Step 7: Commit**

```bash
git add index.html js/main.js
git commit -m "feat(games): add the ESM host and the SQHost bridge"
```

---

## Task 5: Service worker, check.mjs and the README

**Files:**
- Modify: `sw.js:1`, `sw.js:2-25`
- Modify: `scripts/check.mjs:20`
- Modify: `README.md`

- [ ] **Step 1: Precache the new files and bump the cache**

In `sw.js:1`:

```js
const CACHE_NAME = "summer-quest-v9";
```

In `sw.js:2-25`, add the three new files to `APP_SHELL`, after `"./js/brain-ui.js"`:

```js
  "./js/main.js",
  "./js/games/registry.js",
  "./js/games/index.js",
```

Precaching is what keeps lazy loading offline-safe (design.md §4) — the file is on the tablet before any kid taps the game.

- [ ] **Step 2: Add the new files to the Android 8 scan**

`scripts/check.mjs:20` — extend `runtimeFiles` with the three new paths:

```js
const runtimeFiles = ["index.html", "admin.html", "js/day.js", "js/day-data.js", "js/act-data.js", "js/time-core.js", "js/lock-core.js", "js/pinpad.js", "js/papa-tools.js", "js/drills.js", "js/brain-data.js", "js/brain-core.js", "js/brain-ui.js", "js/sync.js", "js/admin.js", "js/main.js", "js/games/registry.js", "js/games/index.js", "sw.js"];
```

- [ ] **Step 3: Add the manifest integrity block to check.mjs**

Append near the end of `scripts/check.mjs`, before the final pass/fail report:

```js
try {
  const { MANIFEST } = await import(new URL("js/games/index.js", root));
  const seen = new Set();
  for (const entry of MANIFEST) {
    if (!entry.id) fail("manifest", "entry with no id");
    if (seen.has(entry.id)) fail("manifest", `duplicate id ${entry.id}`);
    seen.add(entry.id);
    if (!entry.meta || !entry.meta.icon) fail("manifest", `${entry.id}: missing icon`);
    assertPair([entry.meta.title, entry.meta.tz], `manifest.${entry.id}.title`);
    if (!entry.meta.blurb) fail("manifest", `${entry.id}: missing blurb`);
    if (typeof entry.keyboard !== "boolean") fail("manifest", `${entry.id}: keyboard must be boolean`);
    if (!new RegExp(`\\b${entry.id}\\s*:\\s*\\{`).test(indexHtml)) {
      fail("manifest", `${entry.id}: no matching LEVELS entry in index.html`);
    }
  }
  const bestKeys = MANIFEST.map((e) => e.bestKey).filter(Boolean);
  if (new Set(bestKeys).size !== bestKeys.length) fail("manifest", "duplicate bestKey");
  if (!indexHtml.includes('<script type="module" src="js/main.js">')) {
    fail("manifest", "index.html is not loading js/main.js as a module");
  }
  const swText = readFileSync(new URL("sw.js", root), "utf8");
  for (const entry of MANIFEST) {
    if (entry.brain || entry.legacy !== false) continue;
    if (!swText.includes(`./js/games/${entry.id}.js`)) {
      fail("manifest", `${entry.id}: migrated game missing from sw.js APP_SHELL`);
    }
  }
} catch (error) {
  fail("manifest load", error.message);
}
```

That last loop is the guard against the seventh edit point from design.md's Context table — a migrated game that is not precached would break offline, and now the check catches it instead of a kid on a tablet.

- [ ] **Step 4: Run the check**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed: syntax, bilingual data, pool alignment, and tracked-file secret scan are green.`

- [ ] **Step 5: Confirm the guard actually guards**

Temporarily change `id: "dig"` to `id: "digg"` in `js/games/index.js`, then run: `node scripts/check.mjs`
Expected: FAIL with `- manifest: digg: no matching LEVELS entry in index.html`
Undo the change and re-run — expected: pass.

- [ ] **Step 6: Document the dev server**

Add to `README.md`, under a `## Local development` heading:

```markdown
## Local development

`index.html` loads `js/main.js` as an ES module, so opening the file directly
(`file://`) no longer works — the browser blocks module requests from that
origin. Serve the folder over http instead:

    npx serve .          # or: python -m http.server 8000

Then open http://localhost:3000 (serve) or http://localhost:8000 (python).

Production on GitHub Pages / Vercel is unaffected.
```

- [ ] **Step 7: Verify offline still works**

1. Serve the site, load it once with wifi on, and let the service worker install.
2. Turn wifi off.
3. Hard-reload the page.

Expected: the app loads, the games grid renders, and Dig Site plays. If it does not, `APP_SHELL` is missing a file — check the Network tab for the failed request.

- [ ] **Step 8: Commit**

```bash
git add sw.js scripts/check.mjs README.md
git commit -m "chore(games): precache the ESM host and guard the manifest in check"
```

---

## DONE WHEN

- ES modules and dynamic `import()` are confirmed working **on a kid's tablet** (Task 1).
- All eighteen tiles render in the games grid in the original order, with unchanged icons, titles and 中文.
- Every one of the nine arcade games and nine brain games still plays exactly as before.
- `window.SQGames.ids()` returns `[]` — the registry exists and is empty.
- No `manifest/LEVELS drift` message in the console.
- `node --test scripts/registry.test.mjs` passes.
- `node scripts/check.mjs` passes, and fails when the manifest is deliberately broken.
- The app loads and plays with wifi off.
- No `?.`, `??`, or `.flatMap` in any new file.
