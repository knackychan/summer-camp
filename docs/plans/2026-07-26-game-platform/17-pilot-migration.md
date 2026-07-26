# Slice 17 — Pilot migration: Dig Site and City Drive

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the two newest, most self-contained games out of `index.html` into `js/games/dig.js` and `js/games/city.js`, and in doing so establish the migration recipe that slices 18 and 19 follow.

**Architecture:** Each game becomes an ES module exporting one object matching the design.md §2 contract. Its state moves from the shared global `state` into module scope. It reads nothing from the old world except what arrives in `ctx`. `index.html` keeps its copies until Task 4 deletes them, so every step is revertible.

**Tech Stack:** ES modules, `node:test` with a stub `ctx`, `scripts/check.mjs`.

**Design:** `docs/plans/2026-07-26-game-platform/design.md` §2, §3, §7

**Depends on:** slice 15 (registry, host, bridge), slice 16 (generic best-stat handling).

**Before you start — the D5 question.** Ask Papa: *is a gameplay rewrite already planned for Dig Site or City Drive?* If yes, that game is dropped from this slice and written directly in registry form as part of its own rewrite slice (design.md §8). The answer only removes work; it never blocks this slice.

**DONE WHEN:**
- Dig Site and City Drive play identically to before: same controls, same scoring, same timer, same best score.
- Both are gone from `index.html`.
- `window.SQGames.ids()` contains `dig` and `city` after each has been opened once.
- Leaving either game stops its timer and its animation frame — verified, not assumed.
- `node --test scripts/games.test.mjs` passes.
- `node scripts/check.mjs` passes.
- Both games work with wifi off.

---

## Constraints you must not violate

1. **No `?.`, `??`, `.flatMap`** — `scripts/check.mjs:41-43`. Both new files go into `runtimeFiles`.
2. **Behaviour preservation is the acceptance bar (design.md D4).** Do not fix, tune, or improve either game while moving it. If you spot a bug, write it down and leave it. A slice that moves *and* changes is two changes wearing one hat.
3. **Bilingual invariant:** every string in the moved markup keeps its 中文. The dig prompt `Drive to a rock, then DIG! 開到石頭旁邊，然後挖!` moves verbatim.
4. **Tablet-first:** the `onpointerdown` handlers stay `onpointerdown`. Do not "modernise" them to `onclick` — that would add tap latency on the tablets.
5. **`sw.js` gets both files and a `CACHE_NAME` bump in the same commit** that flips `legacy: false`.

---

## File Structure

| File | Change | Responsibility after this slice |
|---|---|---|
| `js/games/dig.js` | Create | Dig Site: grid, excavator, tasks, timer, scoring. Owns its state and teardown. |
| `js/games/city.js` | Create | City Drive: map, driving loop, missions, timer, scoring. Owns its state and teardown. |
| `js/games/index.js` | Modify | `legacy: false` on both entries |
| `index.html` | Modify | Deletes lines 1640-1955 (city) and 1956-2111 (dig); removes their `startLegacy` branches and their `handleInput` branch |
| `sw.js` | Modify | `APP_SHELL` gains both files; `CACHE_NAME` → v10 |
| `scripts/check.mjs` | Modify | Both files added to `runtimeFiles` |
| `scripts/games.test.mjs` | Create | The shared stub `ctx` plus smoke tests for both games |

---

## The migration recipe

Slices 18 and 19 repeat this. Read it once here.

1. **Copy, do not cut.** Copy the game's functions into the new module and leave `index.html` untouched until the module is proven. Task 4 does the deletion.
2. **`state` becomes module-local.** Replace the shared `state={...}` assignment with a module-scope `let S = {...}`. Every `state.x` in the copied code becomes `S.x`. This is a mechanical rename and it is where migration bugs hide — do it with find-and-replace inside the new file only, then read the result.
3. **Globals become `ctx`.** `hud(` → `ctx.hud(`, `sGood()` → `ctx.sfx.good()`, `KIDS[kid]` → `ctx.kids[ctx.kid]`, `shuffle(` → `ctx.shuffle(`, `flash(` → `ctx.fx.flash(`, `burst(` → `ctx.fx.burst(`, `say(` → `ctx.say(`.
4. **`bestOf(kid,"x")` becomes `ctx.best`.** The host passes the current best in; the game never reads `progress`.
5. **Scoring goes through `ctx.finish`.** The old `finishX()` wrote `progress[kid].best` and called `saveProgress()` directly. Now it calls `ctx.finish({score: S.tasks})` and the host does the rest — that is what makes `bestKey` in the manifest meaningful.
6. **`stop()` releases everything the game created.** Every `setInterval`, every `requestAnimationFrame`, every listener attached outside the game's own DOM subtree.
7. **Prove teardown with a test, not by eye.** The stub `ctx` in `scripts/games.test.mjs` counts live timers and frames.

---

## Task 1: The test harness and stub ctx

**Files:**
- Create: `scripts/games.test.mjs`

- [ ] **Step 1: Write the harness**

This file is imported by slices 18 and 19 too, so it is written once, properly.

```js
/* Headless smoke tests for migrated game modules (design.md §7).
   The stub ctx counts what each game creates so stop() can be proven to
   release it — the classic migration bug is a game that still plays while
   its teardown silently stopped working. */
import test from "node:test";
import assert from "node:assert/strict";

export function makeCtx(overrides) {
  const live = { timers: 0, intervals: 0, frames: 0 };
  const spoken = [];

  const el = () => {
    const node = {
      innerHTML: "", textContent: "", className: "", style: {}, dataset: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      children: [],
      appendChild(c) { this.children.push(c); return c; },
      removeChild(c) { this.children = this.children.filter((x) => x !== c); },
      remove() {},
      querySelector() { return el(); },
      querySelectorAll() { return []; },
      addEventListener() {}, removeEventListener() {},
      getContext() { return stubCanvas2d(); },
      getBoundingClientRect() { return { width: 800, height: 600, left: 0, top: 0 }; },
      width: 800, height: 600,
    };
    return node;
  };

  const ctx = {
    kid: "lili",
    kids: { lucien: { name: "Lucien", age: 4, raw: "#3DDC97" },
            lili: { name: "Lili", age: 7, raw: "#FF6FB5" },
            luis: { name: "Luis", age: 9, raw: "#4EA8FF" } },
    best: 0,
    mount: el(),
    stage: el(),
    hud() {},
    say(t) { spoken.push(t); },
    sayPair(en) { spoken.push(en); },
    sfx: { good() {}, bad() {}, pop() {}, zap() {}, hit() {}, win() {} },
    keys: { build() {}, highlight() {}, highlightSet() {}, press() {} },
    fx: { flash() {}, burst() {}, bigFloat() {}, wobbleMsg() {}, hint() {} },
    settings: {},
    rand: (a) => a[0],
    shuffle: (a) => a.slice(),
    finish() {},
    _live: live,
    _spoken: spoken,
  };
  return Object.assign(ctx, overrides || {});
}

function stubCanvas2d() {
  const noop = () => {};
  return new Proxy({}, {
    get(_, prop) {
      if (prop === "measureText") return () => ({ width: 10 });
      if (prop === "createLinearGradient") return () => ({ addColorStop: noop });
      return noop;
    },
    set() { return true; },
  });
}

/* Installs counting fakes for the browser globals a game may reach for, and
   returns a probe telling you what is still alive. */
export function installGlobals() {
  const live = { intervals: new Set(), timeouts: new Set(), frames: new Set() };
  let id = 0;

  global.setInterval = (fn, ms) => { const i = ++id; live.intervals.add(i); return i; };
  global.clearInterval = (i) => { live.intervals.delete(i); };
  global.setTimeout = (fn, ms) => { const i = ++id; live.timeouts.add(i); return i; };
  global.clearTimeout = (i) => { live.timeouts.delete(i); };
  global.requestAnimationFrame = (fn) => { const i = ++id; live.frames.add(i); return i; };
  global.cancelAnimationFrame = (i) => { live.frames.delete(i); };
  global.performance = global.performance || { now: () => 0 };
  global.document = {
    getElementById: () => makeCtx().stage,
    querySelector: () => makeCtx().stage,
    querySelectorAll: () => [],
    createElement: () => makeCtx().stage,
    body: makeCtx().stage,
  };
  global.window = global.window || {};
  return live;
}

/* The contract every migrated game must satisfy. Slices 18 and 19 call this. */
export function runContractTests(name, load) {
  test(`${name}: module shape`, async () => {
    const game = (await load()).default;
    assert.equal(typeof game.id, "string");
    assert.ok(game.meta && game.meta.title && game.meta.tz, "bilingual meta required");
    assert.equal(typeof game.init, "function");
    assert.equal(typeof game.stop, "function");
    assert.equal(typeof game.keyboard, "boolean");
  });

  test(`${name}: init runs and stop releases every timer and frame`, async () => {
    const live = installGlobals();
    const game = (await load()).default;
    const ctx = makeCtx();
    game.init(ctx);
    game.stop();
    assert.equal(live.intervals.size, 0, `${name} leaked an interval`);
    assert.equal(live.frames.size, 0, `${name} leaked an animation frame`);
  });

  test(`${name}: stop is safe to call twice and before init`, async () => {
    installGlobals();
    const game = (await load()).default;
    game.stop();
    const ctx = makeCtx();
    game.init(ctx);
    game.stop();
    game.stop();
  });
}
```

- [ ] **Step 2: Verify the harness runs with no games yet**

Run: `node --test scripts/games.test.mjs`
Expected: PASS with 0 tests — the file only exports helpers so far. If node reports a syntax error, fix it before continuing; every later task depends on this file.

- [ ] **Step 3: Commit**

```bash
git add scripts/games.test.mjs
git commit -m "test(games): add the headless game-module contract harness"
```

---

## Task 2: Migrate Dig Site

Source: `index.html:1956-2111`. Functions to move: `DG_COLS`, `DG_ROWS`, `initDig`, `digHud`, `digPlace`, `rockAt`, `drawDig`, `nextDigTask`, `digSumCue`, `digMove`, `digClunk`, `digGood`, `digTaskDone`, `digAct`, `digTick`, `finishDig`.

**Files:**
- Create: `js/games/dig.js`
- Modify: `scripts/games.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/games.test.mjs`:

```js
runContractTests("dig", () => import("../js/games/dig.js"));

test("dig: reports its score through ctx.finish, never by writing progress", async () => {
  installGlobals();
  const game = (await import("../js/games/dig.js")).default;
  let reported = null;
  const ctx = makeCtx({ finish: (res) => { reported = res; } });
  game.init(ctx);
  game.forceFinishForTest();
  assert.ok(reported, "dig never called ctx.finish");
  assert.equal(typeof reported.score, "number");
  game.stop();
});

test("dig declares the bestKey the manifest expects", async () => {
  const game = (await import("../js/games/dig.js")).default;
  const { findEntry } = await import("../js/games/index.js");
  assert.equal(game.bestKey, findEntry("dig").bestKey);
  assert.equal(game.keyboard, findEntry("dig").keyboard);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/games.test.mjs`
Expected: FAIL — `Cannot find module '../js/games/dig.js'`

- [ ] **Step 3: Create `js/games/dig.js`**

Copy `index.html:1956-2111` into the skeleton below, applying the recipe. The skeleton shows the parts that change; the bodies of `digPlace`, `rockAt`, `drawDig`, `nextDigTask`, `digSumCue`, `digMove`, `digClunk`, `digTaskDone` and `digAct` are copied across with only the `state`→`S`, globals→`C` renames from recipe steps 2 and 3.

```js
/* Dig Site ⛏️ 挖土工地 — migrated from index.html:1956-2111 (design.md §2).
   Behaviour is unchanged on purpose: this file is a move, not a rewrite. */

const DG_COLS = 5, DG_ROWS = 4;

let S = null;   /* game state — was the shared global `state` */
let C = null;   /* the ctx handed to init */

function digHud() {
  C.hud([
    { k: "Time", v: S.time + "s", c: S.time <= 10 ? "var(--bad)" : C.kids[C.kid].raw },
    { k: "Tasks", v: S.tasks, c: C.kids[C.kid].raw },
    { k: "Best", v: C.best },
  ]);
}

/* ---- copy digPlace, rockAt, drawDig, nextDigTask, digSumCue, digMove,
   digClunk, digTaskDone and digAct here verbatim from index.html:1986-2087,
   renaming `state.` -> `S.`, `shuffle(` -> `C.shuffle(`, `KIDS[kid]` ->
   `C.kids[C.kid]`, `sGood()` -> `C.sfx.good()`, `sBad()` -> `C.sfx.bad()`,
   `flash(` -> `C.fx.flash(`, `burst(` -> `C.fx.burst(`, `say(` -> `C.say(`.
   Change nothing else — no reordering, no renaming, no tidying. ---- */

function digGood() { C.sfx.good(); C.fx.flash("ok"); C.fx.burst(6); }

function digTick() {
  if (!S || !S.running) return;
  S.time--;
  digHud();
  if (S.time <= 0) finishDig();
}

function finishDig() {
  if (!S || !S.running) return;
  S.running = false;
  if (S.timer) { clearInterval(S.timer); S.timer = null; }
  C.sfx.win();
  /* The host owns the ledger and the sync (design.md §2, recipe step 5). */
  C.finish({ score: S.tasks });
}

function init(ctx) {
  C = ctx;
  S = { tasks: 0, time: 90, er: DG_ROWS - 1, ec: 0, rocks: [], task: null,
        need: 0, sum: 0, running: true, timer: null };

  C.stage.innerHTML =
    `<div class="cue" id="dgCue"></div>
     <div class="dg-grid" id="dgGrid"></div>
     <div class="dg-ctl">
       <div class="dg-pad">
         <button class="dbtn" data-d="0,-1">◀</button>
         <div class="dg-ud"><button class="dbtn" data-d="-1,0">▲</button><button class="dbtn" data-d="1,0">▼</button></div>
         <button class="dbtn" data-d="0,1">▶</button>
       </div>
       <button class="dg-dig" id="dgDig">⛏️ DIG 挖!</button>
     </div>
     <div class="msg" id="msg">Drive to a rock, then DIG! 開到石頭旁邊，然後挖!</div>`;

  C.stage.querySelectorAll(".dbtn").forEach(function (b) {
    b.onpointerdown = function (e) {
      e.preventDefault();
      const d = b.dataset.d.split(",");
      digMove(+d[0], +d[1]);
    };
  });
  const digBtn = C.stage.querySelector("#dgDig");
  if (digBtn) digBtn.onpointerdown = function (e) { e.preventDefault(); digAct(); };

  nextDigTask();
  digHud();
  S.timer = setInterval(digTick, 1000);
}

/* The space bar used to reach this game through handleInput (index.html:2348).
   Keyboard is false for this game, so the host routes nothing here — but the
   export keeps the capability available if a keyboard is ever attached. */
function key(ch) { if (ch === " ") digAct(); }

function stop() {
  if (S && S.timer) clearInterval(S.timer);
  S = null;
  /* C is kept: stop() may run before the next init and must not throw. */
}

export default {
  id: "dig",
  meta: { icon: "⛏️", title: "Dig Site", tz: "挖土工地", blurb: "Dig the right rocks" },
  keyboard: false,
  bestKey: "dig",
  init: init,
  stop: stop,
  key: key,
  /* test seam only — lets the smoke test reach the finish path without
     waiting 90 real seconds */
  forceFinishForTest: finishDig,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/games.test.mjs`
Expected: PASS — 5 tests green.

If `dig leaked an interval` fails, `stop()` is not clearing `S.timer`, or `finishDig` nulled `S` before `stop` ran.

- [ ] **Step 5: Flip the manifest and precache the file**

In `js/games/index.js`, change the `dig` entry to add `legacy: false`:

```js
  { id: "dig",      brain: false, keyboard: false, bestKey: "dig",     legacy: false, meta: { icon: "⛏️", title: "Dig Site",      tz: "挖土工地", blurb: "Dig the right rocks" } },
```

In `sw.js`, bump `CACHE_NAME` to `"summer-quest-v10"` and add to `APP_SHELL`:

```js
  "./js/games/dig.js",
```

In `scripts/check.mjs:20`, add `"js/games/dig.js"` to `runtimeFiles`.

- [ ] **Step 6: Play it**

Run: `npx serve .`, open the app, go to any kid's hub → Games → ⛏️ Dig Site.

Expected, all identical to before:
1. The excavator starts bottom-left; five columns, four rows.
2. The arrow pad drives it; DIG digs.
3. The task cue and the sum cue read the same as before, in both languages.
4. The timer counts down from 90 and the HUD shows Time / Tasks / Best.
5. Finishing writes a new best when you beat it, and the best survives a reload.
6. In the console, `window.SQGames.ids()` now includes `"dig"`.
7. Leaving the game mid-round and going back to the hub stops the timer — watch that the HUD is not still counting behind the hub.

- [ ] **Step 7: Commit**

```bash
git add js/games/dig.js js/games/index.js sw.js scripts/check.mjs scripts/games.test.mjs
git commit -m "refactor(games): move Dig Site into js/games/dig.js"
```

---

## Task 3: Migrate City Drive

Source: `index.html:1640-1955`. This one is larger (316 lines) and carries map data — `CT`, `CITY_W`, `CITY_H`, `CITY_MAP`, `CITY_TREES`, `CITY_B`, `CITY_PLOT` — plus a `requestAnimationFrame` loop, which makes it the first real test of frame teardown.

**Files:**
- Create: `js/games/city.js`
- Modify: `scripts/games.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/games.test.mjs`:

```js
runContractTests("city", () => import("../js/games/city.js"));

test("city: reports its score through ctx.finish", async () => {
  installGlobals();
  const game = (await import("../js/games/city.js")).default;
  let reported = null;
  const ctx = makeCtx({ finish: (res) => { reported = res; } });
  game.init(ctx);
  game.forceFinishForTest();
  assert.ok(reported, "city never called ctx.finish");
  assert.equal(typeof reported.score, "number");
  game.stop();
});

test("city: stop cancels the render loop", async () => {
  const live = installGlobals();
  const game = (await import("../js/games/city.js")).default;
  game.init(makeCtx());
  assert.ok(live.frames.size > 0, "city never started a render loop");
  game.stop();
  assert.equal(live.frames.size, 0, "city leaked its render loop");
});

test("city declares the bestKey the manifest expects", async () => {
  const game = (await import("../js/games/city.js")).default;
  const { findEntry } = await import("../js/games/index.js");
  assert.equal(game.bestKey, findEntry("city").bestKey);
  assert.equal(game.keyboard, findEntry("city").keyboard);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/games.test.mjs`
Expected: FAIL — `Cannot find module '../js/games/city.js'`

- [ ] **Step 3: Create `js/games/city.js`**

Same recipe. The structure differs from `dig` in three ways, and each one matters:

```js
/* City Drive 🏙️ 城市開車 — migrated from index.html:1640-1955 (design.md §2).
   Behaviour is unchanged on purpose: this file is a move, not a rewrite. */

/* ---- map data: copy CT, CITY_W, CITY_H, CITY_MAP, CITY_TREES, CITY_B and
   CITY_PLOT verbatim from index.html:1641-1680. They are pure constants —
   they need no renaming at all. ---- */

let S = null;
let C = null;

/* ---- copy cityWord, cityTile, rr, cityDraw, cityHud, cityLoop, cityTick,
   cityPrompt, cityMathQ, rint, cityLetterSpots, cityMission, cityArrive and
   cityComplete from index.html:1681-1935, applying recipe steps 2 and 3.
   `bestOf(kid,"city")` in cityHud becomes `C.best`. ---- */

function cityLoopStart() {
  S.raf = requestAnimationFrame(function frame(now) {
    if (!S || !S.running) return;
    cityLoop(now);
    S.raf = requestAnimationFrame(frame);
  });
}

function finishCity() {
  if (!S || !S.running) return;
  S.running = false;
  if (S.raf) { cancelAnimationFrame(S.raf); S.raf = null; }
  if (S.timer) { clearInterval(S.timer); S.timer = null; }
  C.sfx.win();
  C.finish({ score: S.done });   /* `done` is the delivered-mission count */
}

function init(ctx) {
  C = ctx;
  /* ---- copy the state initialiser from initCity (index.html:1754-1787),
     assigning to S instead of state, and adding raf:null if it is absent ---- */

  /* ---- copy the markup and the control wiring from initCity verbatim,
     replacing document.getElementById("stage") with C.stage and
     document.querySelectorAll(...) with C.stage.querySelectorAll(...) ---- */

  cityHud();
  cityLoopStart();
  S.timer = setInterval(cityTick, 1000);
}

function stop() {
  if (S) {
    S.running = false;
    if (S.raf) cancelAnimationFrame(S.raf);
    if (S.timer) clearInterval(S.timer);
  }
  S = null;
}

export default {
  id: "city",
  meta: { icon: "🏙️", title: "City Drive", tz: "城市開車", blurb: "Drive & deliver" },
  keyboard: false,
  bestKey: "city",
  init: init,
  stop: stop,
  forceFinishForTest: finishCity,
};
```

**The three differences from `dig`, and why:**

1. **The loop re-arms itself inside the module.** The old `cityLoop` stored its handle in the shared `state.raf` and relied on `stopArena` to cancel it. Now `S.raf` is module-local and `stop()` cancels it. The `if (!S || !S.running) return;` guard is what stops a frame that is already queued when the kid leaves.
2. **`stop()` sets `running = false` before cancelling.** A frame can fire between the tap and the cancel; the flag makes that frame a no-op instead of a crash on a null `S`.
3. **`S = null` last.** Nulling before cancelling would strand the handles.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/games.test.mjs`
Expected: PASS — 9 tests green.

- [ ] **Step 5: Flip the manifest and precache the file**

In `js/games/index.js`, add `legacy: false` to the `city` entry.

In `sw.js`, add `"./js/games/city.js"` to `APP_SHELL` (`CACHE_NAME` is already v10 from Task 2).

In `scripts/check.mjs:20`, add `"js/games/city.js"` to `runtimeFiles`.

- [ ] **Step 6: Play it**

Open the app → any kid's hub → Games → 🏙️ City Drive.

Expected, all identical to before:
1. The map draws with the same buildings, trees and plots.
2. The car drives with the same controls and the same speed.
3. A mission is issued; arriving at the right building completes it and issues the next.
4. Lucien gets his age-appropriate maths question; Luis gets his. Both languages present.
5. The timer counts down and the HUD shows the same fields, with Best reading the stored best.
6. Leaving mid-drive and returning to the hub: **the car stops**. Open the Performance tab or just watch the CPU — a leaked `requestAnimationFrame` keeps burning frames behind the hub and drains the tablet battery. This is the single most important check in this slice.

- [ ] **Step 7: Commit**

```bash
git add js/games/city.js js/games/index.js sw.js scripts/check.mjs scripts/games.test.mjs
git commit -m "refactor(games): move City Drive into js/games/city.js"
```

---

## Task 4: Delete the originals from index.html

Only now, with both modules proven in the browser.

**Files:**
- Modify: `index.html:1640-2111`, `index.html:1189-1198` (the `startLegacy` chain), `index.html:2348`

- [ ] **Step 1: Delete the two game bodies**

Delete `index.html:1640-2111` in full — from the `/* ---- MODE: CITY DRIVE (free-roam knowledge missions) ---- */` comment through the end of `finishDig`, immediately before the `/* ---- MODE: WORD WIZARD (vocab) ---- */` comment.

- [ ] **Step 2: Remove their legacy dispatch branches**

In `startLegacy` (added in slice 15), delete these two lines:

```js
  else if(lvl==="city") initCity();
  else if(lvl==="dig") initDig();
```

- [ ] **Step 3: Remove their input branches**

In `handleInput` (`index.html:2340-2374` before this slice's deletions), delete:

```js
  if(level==="city") return;
  if(level==="dig"){ if(ch===" ") digAct(); return; }
```

Both games declare `keyboard: false`, so the host never routes keys to them.

- [ ] **Step 4: Check for orphans**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed`

Then grep for anything still referring to the deleted functions:

```bash
grep -n "initCity\|initDig\|digAct\|cityDraw\|finishCity\|finishDig\|CITY_MAP\|DG_COLS" index.html
```

Expected: no output. Any hit is a reference the deletion missed — usually inside `renderSetbar` or a lock-state helper.

- [ ] **Step 5: Full regression pass**

Run: `node --test scripts/games.test.mjs && node --test scripts/registry.test.mjs && node scripts/sync.test.mjs && node scripts/check.mjs`
Expected: all PASS.

Then in the browser, play **all nine** arcade games and at least two brain games. The seven unmigrated games must be untouched by this slice — if any of them broke, a shared helper was deleted along with the game bodies.

- [ ] **Step 6: Verify offline**

Load once with wifi on, turn wifi off, hard-reload, play Dig Site and City Drive.

Expected: both play. If one fails to start, its module is missing from `APP_SHELL`.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "refactor(games): remove City Drive and Dig Site from index.html"
```

---

## DONE WHEN

- Dig Site and City Drive play identically: same controls, same timers, same scoring, same 中文.
- Neither game appears anywhere in `index.html` — the grep in Task 4 Step 4 is silent.
- Leaving City Drive cancels its render loop; leaving Dig Site clears its interval. Both proven by test *and* observed in the browser.
- Best scores for both still read, write, survive a reload and reach `game_stats`.
- The other seven arcade games and all nine brain games are unaffected.
- Both games play with wifi off.
- `node --test scripts/games.test.mjs`, `node --test scripts/registry.test.mjs`, `node scripts/sync.test.mjs` and `node scripts/check.mjs` all pass.
- No `?.`, `??`, or `.flatMap` in either new file.
