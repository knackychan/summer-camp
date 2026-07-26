# Slice 16 — Persistence goes generic

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the last two hardcoded game lists outside `index.html`, so a new game never edits `sync.js` again.

**Architecture:** `sync.js` stays a plain IIFE global script — it cannot `import` the registry (design.md §5). Instead it exposes `SyncStore.setBestStatCheck(fn)`, and `js/main.js` injects the registry's predicate at boot. Without injection, `sync.js` keeps its current six-name whitelist, so it stays correct standalone and its own tests keep passing.

**Tech Stack:** Plain JS, `scripts/sync.test.mjs` (bare-assert style, run directly with `node`).

**Design:** `docs/plans/2026-07-26-game-platform/design.md` §5

**Depends on:** slice 15 (needs `window.SQGames` and `js/main.js`).

**DONE WHEN:**
- A stat key belonging to any registered game round-trips through hydration and diffing.
- Kids' existing high scores (`balloon`, `race`, `orc`, `shop`, `city`, `dig`) still hydrate, still sync, still display.
- `sync.js` contains no game-name literal except inside the default fallback.
- `node scripts/sync.test.mjs` passes.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **No `?.`, `??`, `.flatMap`** in `js/sync.js` — `scripts/check.mjs:41-43`.
2. **`sync.js` must stay loadable by `new Function`** — `scripts/sync.test.mjs:50-55` evaluates the file source with stubbed `window`/`localStorage`. Adding an `import` statement would break every sync test. This is why injection is used instead.
3. **Never widen `isBestStat` to "anything not `missions`".** `game_stats` is a shared key/value table; a typo'd key would then be silently persisted forever.
4. **The order of Task 1 and Task 2 is load-bearing.** The test that pins existing high scores lands *before* the defaults are removed (design.md §9).

---

## File Structure

| File | Change | Responsibility after this slice |
|---|---|---|
| `js/sync.js` | Modify | `isBestStat` delegates to an injected predicate, defaulting to today's whitelist |
| `js/main.js` | Modify | Injects `SQGames.isBest` at boot |
| `index.html` | Modify | `newProg().best` becomes `{}` |
| `scripts/sync.test.mjs` | Modify | Pins legacy high scores; covers injection |

---

## Task 1: Pin the existing high-score behaviour BEFORE changing anything

This test must pass against the **current** code. It is the safety net for Tasks 2 and 3, and it is worthless if written afterwards.

**Files:**
- Modify: `scripts/sync.test.mjs`

- [ ] **Step 1: Write the characterisation test**

Append to `scripts/sync.test.mjs`, following the file's existing bare-block style:

```js
// --- Legacy high scores must survive the persistence refactor (slice 16) ---
{
  const localStorage = makeLocalStorage();
  const SyncStore = loadSyncStore(localStorage);
  const store = new SyncStore();
  const progress = {};

  store.applyStatRows(progress, [
    { kid_id: "lili", stat: "balloon", value: 12 },
    { kid_id: "lili", stat: "race", value: 40 },
    { kid_id: "lili", stat: "orc", value: 7 },
    { kid_id: "lili", stat: "shop", value: 22 },
    { kid_id: "lili", stat: "city", value: 3 },
    { kid_id: "lili", stat: "dig", value: 9 },
    { kid_id: "lili", stat: "missions", value: 5 },
    { kid_id: "lili", stat: "bogus_key", value: 99 },
  ]);

  assert.equal(progress.lili.best.balloon, 12, "balloon best lost");
  assert.equal(progress.lili.best.race, 40, "race best lost");
  assert.equal(progress.lili.best.orc, 7, "orc best lost");
  assert.equal(progress.lili.best.shop, 22, "shop best lost");
  assert.equal(progress.lili.best.city, 3, "city best lost");
  assert.equal(progress.lili.best.dig, 9, "dig best lost");
  assert.equal(progress.lili.missions, 5, "missions lost");
  assert.equal(progress.lili.best.bogus_key, undefined, "unknown stat must not be stored");
  console.log("ok - legacy high scores hydrate");
}
```

- [ ] **Step 2: Run it and watch it fail for the right reason**

Run: `node scripts/sync.test.mjs`
Expected: FAIL — `store.applyStatRows is not a function`. The hydration loop is currently inline at `js/sync.js:189-193` and cannot be called on its own. Extracting it is what makes this testable, and is the next step.

- [ ] **Step 3: Extract the stat-hydration loop in `js/sync.js`**

Find the block at `js/sync.js:189-193`:

```js
      (stats||[]).forEach(r=>{
        ensureKid(p,r.kid_id);
        if(isBestStat(r.stat)) p[r.kid_id].best[r.stat]=r.value||0;
        if(r.stat==="missions") p[r.kid_id].missions=r.value||0;
      });
```

Replace it with a call to a new method:

```js
      this.applyStatRows(p,stats||[]);
```

Then add the method to the `SyncStore` prototype, beside the other methods:

```js
    /* One row of game_stats -> one field of progress. Pulled out of hydrate()
       so it can be tested on its own (slice 16). */
    applyStatRows(progress,rows){
      (rows||[]).forEach(r=>{
        if(!r||!r.kid_id)return;
        ensureKid(progress,r.kid_id);
        if(isBestStat(r.stat)) progress[r.kid_id].best[r.stat]=r.value||0;
        if(r.stat==="missions") progress[r.kid_id].missions=r.value||0;
      });
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node scripts/sync.test.mjs`
Expected: PASS — `ok - legacy high scores hydrate`, and every pre-existing test still green.

- [ ] **Step 5: Commit**

```bash
git add js/sync.js scripts/sync.test.mjs
git commit -m "test(sync): pin legacy high-score hydration before refactoring it"
```

---

## Task 2: Injectable best-stat predicate

**Files:**
- Modify: `js/sync.js:7-12`
- Modify: `scripts/sync.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/sync.test.mjs`:

```js
// --- Injected best-stat predicate (slice 16) ---
{
  const localStorage = makeLocalStorage();
  const SyncStore = loadSyncStore(localStorage);

  // Default: unchanged whitelist, so sync.js is correct with no registry present.
  const plain = new SyncStore();
  const p1 = {};
  plain.applyStatRows(p1, [
    { kid_id: "luis", stat: "orc", value: 30 },
    { kid_id: "luis", stat: "rocket", value: 11 },
  ]);
  assert.equal(p1.luis.best.orc, 30);
  assert.equal(p1.luis.best.rocket, undefined, "unregistered key must be ignored by default");

  // Injected: a new game's key is recognised without editing sync.js.
  SyncStore.setBestStatCheck((key) => key === "rocket" || key === "orc");
  const injected = new SyncStore();
  const p2 = {};
  injected.applyStatRows(p2, [
    { kid_id: "luis", stat: "rocket", value: 11 },
    { kid_id: "luis", stat: "balloon", value: 4 },
  ]);
  assert.equal(p2.luis.best.rocket, 11, "injected predicate not consulted");
  assert.equal(p2.luis.best.balloon, undefined, "injected predicate must fully replace the default");

  // brain_* keys survive whatever is injected — the gym does not go through the registry.
  SyncStore.setBestStatCheck((key) => key === "rocket");
  const brain = new SyncStore();
  const p3 = {};
  brain.applyStatRows(p3, [{ kid_id: "lili", stat: "brain_calc", value: 18 }]);
  assert.equal(p3.lili.best.brain_calc, 18, "brain_ prefix must be unconditional");

  SyncStore.setBestStatCheck(null); // restore for any later test in this file
  console.log("ok - best-stat predicate is injectable");
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node scripts/sync.test.mjs`
Expected: FAIL — `SyncStore.setBestStatCheck is not a function`

- [ ] **Step 3: Implement in `js/sync.js`**

Replace `js/sync.js:7-12`:

```js
  /* A "best score" stat: the six existing games, or any brain-gym key.
     Prefix rule on purpose — adding a brain game must not require editing sync.js. */
  function isBestStat(key){
    return key==="balloon"||key==="race"||key==="orc"||key==="shop"||
      key==="city"||key==="dig"||key.indexOf("brain_")===0;
  }
```

with:

```js
  /* Which game_stats keys are best scores.

     sync.js is a plain global script and cannot import the game registry
     (design.md §5), so main.js injects the registry's predicate at boot via
     setBestStatCheck. Until it does, the original six-name whitelist applies,
     which keeps this file correct on its own and keeps its tests honest.

     brain_* is checked unconditionally: the Brain Gym does not go through the
     arcade registry, and its keys must survive whatever is injected. */
  let bestStatCheck=null;
  function defaultBestStat(key){
    return key==="balloon"||key==="race"||key==="orc"||
      key==="shop"||key==="city"||key==="dig";
  }
  function isBestStat(key){
    if(!key)return false;
    if(key.indexOf("brain_")===0)return true;
    return bestStatCheck?!!bestStatCheck(key):defaultBestStat(key);
  }
```

Then expose the setter on the constructor, next to wherever `SyncStore` is attached to `window`:

```js
  SyncStore.setBestStatCheck=function(fn){
    bestStatCheck=typeof fn==="function"?fn:null;
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node scripts/sync.test.mjs`
Expected: PASS — including the Task 1 legacy test, which proves the default path is intact.

- [ ] **Step 5: Inject the registry predicate from `js/main.js`**

In `js/main.js`, after `window.SQGames = SQGames;`, add:

```js
/* sync.js cannot import us, so hand it the predicate (design.md §5). */
if (window.SyncStore && window.SyncStore.setBestStatCheck) {
  window.SyncStore.setBestStatCheck(function (key) {
    return SQGames.isBest(key) || MANIFEST.some(function (e) { return e.bestKey === key; });
  });
}
```

The `MANIFEST` half matters: a game that has not been lazily loaded yet is not in the registry, but its best score still arrives from the server at hydrate time. Consulting the manifest means scores sync for games the kid has not opened this session.

- [ ] **Step 6: Verify in the browser**

Serve the site, sign a kid in, play Balloon Pop and beat the high score, then reload.

Expected: the new best survives the reload, and appears in Supabase `game_stats` once the queue drains. Check the console for errors — there should be none.

- [ ] **Step 7: Commit**

```bash
git add js/sync.js js/main.js scripts/sync.test.mjs
git commit -m "refactor(sync): take the best-stat predicate by injection instead of a fixed list"
```

---

## Task 3: Stop seeding hardcoded best keys

**Files:**
- Modify: `index.html:927`
- Modify: `js/sync.js:69-75`

- [ ] **Step 1: Empty `newProg().best` in `index.html`**

Find `index.html:927`:

```js
const newProg=()=>({stars:0,best:{balloon:0,race:0,orc:0,shop:0,city:0,dig:0},vocab:{},missions:0,day:{d:'',done:{},rr:{}}});
```

Replace with:

```js
/* best is filled lazily — bestOf() already treats a missing key as 0, and
   seeding names here was the fifth of the seven edit points a new game used
   to need (design.md Context). */
const newProg=()=>({stars:0,best:{},vocab:{},missions:0,day:{d:'',done:{},rr:{}}});
```

- [ ] **Step 2: Drop the six seeds in `js/sync.js`**

Find `js/sync.js:69-75`:

```js
    p.best=p.best&&typeof p.best==="object"?p.best:{};
    p.best.balloon=p.best.balloon||0;
    p.best.race=p.best.race||0;
    p.best.orc=p.best.orc||0;
    p.best.shop=p.best.shop||0;
    p.best.city=p.best.city||0;
    p.best.dig=p.best.dig||0;
```

Replace with:

```js
    p.best=p.best&&typeof p.best==="object"?p.best:{};
```

Leave everything else in `ensureKid` alone.

- [ ] **Step 3: Run the whole suite**

Run: `node scripts/sync.test.mjs && node --test scripts/registry.test.mjs && node scripts/check.mjs`
Expected: all PASS. The Task 1 characterisation test is the one that matters here — if a legacy best score stopped hydrating, it fails now.

- [ ] **Step 4: Verify a kid with existing scores**

On a tablet (or a browser profile) that already has high scores:

1. Load the app. Open a kid's hub → Games.
2. Expect every previous best score to still display.
3. Play one round of Word Racer without beating the best. Expect the old best to stay.
4. Beat it. Expect the new best to save, survive a reload, and reach `game_stats`.

If a best score reads `0` after this change, the diff in `enqueueDiff` (`js/sync.js:292-297`) is the place to look — it unions the key sets from both sides, so an empty local `best` still picks up server keys.

- [ ] **Step 5: Commit**

```bash
git add index.html js/sync.js
git commit -m "refactor(games): stop seeding hardcoded best-score keys"
```

---

## DONE WHEN

- `js/sync.js` names a game only inside `defaultBestStat`, and nowhere else.
- A key belonging to a registered or manifested game hydrates, diffs and uploads.
- An unknown key is still rejected — `bogus_key` does not reach `progress`.
- `brain_*` keys work regardless of what predicate is injected.
- Every kid's pre-existing high score still displays and still syncs.
- `node scripts/sync.test.mjs`, `node --test scripts/registry.test.mjs` and `node scripts/check.mjs` all pass.
- No `?.`, `??`, or `.flatMap` in `js/sync.js`.
