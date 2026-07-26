# Slice 02 — Day-Core Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the `DAY` array into a shared `js/day-data.js` and all schedule time math into a pure, node-tested `js/time-core.js` (`SQTime`) that supports per-day time overrides — zero behavior change (overrides stay empty until slice 04).

**Architecture:** `day-data.js` is a classic script declaring `const DAY` at top level (visible to the page's later inline script) with a `module.exports` guard for node. `time-core.js` is pure functions taking `(day, overrides, …)` — no globals, no DOM. index.html keeps thin wrappers so its ~15 call sites barely change. check.mjs concatenates `day-data.js` into its data eval and gains a `node --test` step.

**Tech Stack:** Vanilla JS, `node:test` + `node:assert` (zero deps), `node scripts/check.mjs` as the gate.

**Read first:** `design.md` §6 (module architecture) in this folder.

**⚠ Concurrency:** another agent may be committing to this repo. Start from a clean, up-to-date `main`. Anchor edits by the snippets shown, not line numbers. **Do this slice in one sitting** — it's a refactor; don't leave main broken.

---

### Task 1: Create `js/time-core.js` with tests (TDD — module first, page untouched)

**Files:**
- Create: `js/time-core.js`
- Create: `scripts/core.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `scripts/core.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const SQTime = require("../js/time-core.js");

const DAY = [
  { t: "8:00",  title: "Wake",     tz: "起床", kind: "routine", txtz: {} },
  { t: "10:00", title: "Homework", tz: "暑假作業", kind: "mission" },
  { t: "11:15", title: "Screen #1 — earned", tz: "螢幕#1", kind: "routine", txtz: {} },
  { t: "17:15", title: "Sport",    tz: "運動", kind: "mission" },
  { t: "✨",    title: "Bonus",    tz: "加碼", kind: "mission" },
];

test("parseMins", () => {
  assert.equal(SQTime.parseMins("8:00"), 480);
  assert.equal(SQTime.parseMins("17:15"), 1035);
  assert.equal(SQTime.parseMins("✨"), null);
  assert.equal(SQTime.parseMins(undefined), null);
});

test("effMins uses override when present", () => {
  assert.equal(SQTime.effMins(DAY, {}, 1), 600);
  assert.equal(SQTime.effMins(DAY, { 1: "15:00" }, 1), 900);
  assert.equal(SQTime.effMins(DAY, {}, 4), null); // untimed ✨
});

test("timedOrder sorts by effective time and skips untimed", () => {
  assert.deepEqual(SQTime.timedOrder(DAY, {}).map(x => x.i), [0, 1, 2, 3]);
  assert.deepEqual(SQTime.timedOrder(DAY, { 1: "15:00" }).map(x => x.i), [0, 2, 1, 3]);
});

test("timelineInfo current/next with and without overrides", () => {
  assert.deepEqual(SQTime.timelineInfo(DAY, {}, 7 * 60), { now: 420, current: 0, next: 0 });
  const mid = SQTime.timelineInfo(DAY, {}, 10 * 60 + 30);
  assert.equal(mid.current, 1); assert.equal(mid.next, 2);
  const late = SQTime.timelineInfo(DAY, {}, 23 * 60);
  assert.equal(late.current, 3); assert.equal(late.next, null);
  // homework moved to 15:00 → at 10:30 the current block is still Wake→? current=0? No: 8:00 passed → current 0? 10:00 gone → current stays 0 until 11:15.
  const moved = SQTime.timelineInfo(DAY, { 1: "15:00" }, 10 * 60 + 30);
  assert.equal(moved.current, 0); assert.equal(moved.next, 2);
  const aft = SQTime.timelineInfo(DAY, { 1: "15:00" }, 15 * 60 + 5);
  assert.equal(aft.current, 1); assert.equal(aft.next, 3);
});

test("timelineInfo before first block clamps to first timed", () => {
  const info = SQTime.timelineInfo(DAY, {}, 0);
  assert.equal(info.current, 0);
});

test("neededBefore respects effective order", () => {
  // prerequisites of Screen #1 (idx 2)
  assert.deepEqual(SQTime.neededBefore(DAY, {}, 2), [0, 1]);
  // homework moved after the screen block → no longer a prerequisite
  assert.deepEqual(SQTime.neededBefore(DAY, { 1: "15:00" }, 2), [0]);
});

test("displayOrder = timed ascending then untimed in DAY order", () => {
  assert.deepEqual(SQTime.displayOrder(DAY, {}), [0, 1, 2, 3, 4]);
  assert.deepEqual(SQTime.displayOrder(DAY, { 1: "15:00" }), [0, 2, 1, 3, 4]);
});
```

Note the `timelineInfo` special case the tests encode: `next` before the first block is the first block itself only when nothing has started — match the existing app behavior: current clamps to the first timed block, and next is the first block whose effective time is still ahead.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/core.test.mjs`
Expected: FAIL — `Cannot find module '../js/time-core.js'`

- [ ] **Step 3: Implement `js/time-core.js`**

```js
/* SQTime — pure schedule time math. No DOM, no globals: every fn takes (day, overrides, ...).
   overrides = { blockIdx: "HH:MM" } for TODAY only (slice 04 populates it). */
(function(){
  function parseMins(t){
    if(t==null||!String(t).includes(":"))return null;
    const [h,m]=String(t).split(":").map(Number);
    if(Number.isNaN(h)||Number.isNaN(m))return null;
    return h*60+m;
  }
  function effMins(day,overrides,i){
    const o=overrides&&overrides[i];
    return parseMins(o!=null?o:day[i]&&day[i].t);
  }
  function timedOrder(day,overrides){
    return day.map((b,i)=>({i,t:effMins(day,overrides,i)}))
      .filter(x=>x.t!=null)
      .sort((a,b)=>a.t-b.t||a.i-b.i);
  }
  function timelineInfo(day,overrides,now){
    const timed=timedOrder(day,overrides);
    let current=timed.length?timed[0].i:0, next=null;
    for(const x of timed){
      if(x.t<=now) current=x.i;
      else { next=x.i; break; }
    }
    return {now,current,next};
  }
  function neededBefore(day,overrides,i){
    const st=effMins(day,overrides,i);
    if(st==null)return [];
    return timedOrder(day,overrides).filter(x=>x.i!==i&&x.t<st).map(x=>x.i);
  }
  function displayOrder(day,overrides){
    const timed=timedOrder(day,overrides).map(x=>x.i);
    const untimed=day.map((b,i)=>i).filter(i=>effMins(day,overrides,i)==null);
    return timed.concat(untimed);
  }
  const api={parseMins,effMins,timedOrder,timelineInfo,neededBefore,displayOrder};
  if(typeof window!=="undefined")window.SQTime=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/core.test.mjs`
Expected: all PASS. If the two `timelineInfo` edge tests disagree with the implementation, the tests are the spec — fix the implementation.

- [ ] **Step 5: Commit**

```bash
git add js/time-core.js scripts/core.test.mjs
git commit -m "feat: pure time-core module with node tests"
```

---

### Task 2: Extract `DAY` into `js/day-data.js`

**Files:**
- Create: `js/day-data.js`
- Modify: `index.html` (script tags + inline data section)
- Modify: `scripts/check.mjs`

- [ ] **Step 1: Create `js/day-data.js`**

Cut the entire `const DAY=[ ... ];` literal from index.html's inline script (search for `/* the day plan`), including its comment, and paste it into a new file `js/day-data.js` with this wrapper:

```js
/* shared day plan — single source of truth for index.html, admin.html and check.mjs.
   Classic script: top-level const DAY is visible to later scripts on the page. */
const DAY=[
 /* ...the 16 blocks, moved verbatim from index.html... */
];
if(typeof window!=="undefined")window.SQ_DAY=DAY;
if(typeof module!=="undefined"&&module.exports)module.exports={DAY};
```

Move the blocks **verbatim** — do not edit titles, times, or translations in this slice.

- [ ] **Step 2: Load it in index.html**

The page currently loads:

```html
<script src="js/config.js"></script>
<script src="js/sync.js"></script>
<script>
```

Change to:

```html
<script src="js/config.js"></script>
<script src="js/sync.js"></script>
<script src="js/day-data.js"></script>
<script src="js/time-core.js"></script>
<script>
```

The inline script keeps using `DAY` unchanged — top-level `const` in a classic script is visible to later classic scripts. Leave no `const DAY` remnant in the inline script.

- [ ] **Step 3: Teach check.mjs about the move**

In `scripts/check.mjs`, the data eval currently reads:

```js
  const dataScript = appScript.slice(0, markerIndex);
  const data = new Function(`${dataScript}
return { ALL_WORDS, SENT, MISSIONS, BANK, ACT_GUIDE, BANK_POOL, DAY, PHOTO_POOL, PHOTO_TRICKS, LEARN_GUIDES };`)();
```

Replace with:

```js
  const dataScript = appScript.slice(0, markerIndex);
  const dayDataJs = readFileSync(new URL("js/day-data.js", root), "utf8");
  const data = new Function(`${dayDataJs}
${dataScript}
return { ALL_WORDS, SENT, MISSIONS, BANK, ACT_GUIDE, BANK_POOL, DAY, PHOTO_POOL, PHOTO_TRICKS, LEARN_GUIDES };`)();
```

(`readFileSync` is already imported. The `typeof window`/`typeof module` guards are false inside `new Function`, so the file evaluates as plain data.)

- [ ] **Step 4: Wire the node tests into check.mjs**

Append before the final `if (failures.length)` block:

```js
{
  const tests = spawnSync(process.execPath, ["--test", "scripts/core.test.mjs"], {
    cwd: root, encoding: "utf8",
  });
  if (tests.status !== 0) {
    fail("core tests", (tests.stderr || tests.stdout || "node --test failed").trim().split("\n").slice(-8).join("\n"));
  }
}
```

Note: `cwd: root` receives a `URL`; if `spawnSync` rejects it on this Node version, use `cwd: new URL(".", root).pathname` — verify by running it.

- [ ] **Step 5: Run the check**

Run: `node scripts/check.mjs`
Expected: green, including the DAY assertions (now loaded from day-data.js) and the test suite.

- [ ] **Step 6: Browser smoke**

Open index.html → My Day renders for each kid, timeline highlight + tick + announce all behave as before.

- [ ] **Step 7: Commit**

```bash
git add js/day-data.js index.html scripts/check.mjs
git commit -m "refactor: extract DAY into shared js/day-data.js"
```

---

### Task 3: Route index.html's time math through SQTime

**Files:**
- Modify: `index.html` (inline script — KID HUB section)

- [ ] **Step 1: Add the overrides global and wrappers**

Directly after the `nowMins` helper (search for `const nowMins=`), add:

```js
let dayOverrides={}; /* {blockIdx:"HH:MM"} — today only; hydrated + realtime in slice 04 */
const effT=i=>dayOverrides[i]!=null?dayOverrides[i]:DAY[i].t;
```

- [ ] **Step 2: Replace `timelineInfo` and delete `blockMins`**

Replace the whole existing `blockMins` + `timelineInfo` pair:

```js
function timelineInfo(){return SQTime.timelineInfo(DAY,dayOverrides,nowMins());}
```

Then fix every remaining `blockMins(...)` call site (search `blockMins`):

| Old | New |
|-----|-----|
| `blockMins(DAY[i])==null` (in `timeFlag`) | `SQTime.effMins(DAY,dayOverrides,i)==null` |
| `blockMins(DAY[i])<info.now` (in `timeFlag`) | `SQTime.effMins(DAY,dayOverrides,i)<info.now` |
| `blockMins(b)!=null&&blockMins(b)<info.now` (rowState in `renderMyDay`) | `SQTime.effMins(DAY,dayOverrides,i)!=null&&SQTime.effMins(DAY,dayOverrides,i)<info.now` |
| `idx=>idx<i&&blockMins(DAY[idx])!=null` (in `screenStatus`) | see Step 3 |
| `blockMins(b)==null` guard (in `announceBlock`) | `SQTime.effMins(DAY,dayOverrides,i)==null` |

After the sweep, `grep blockMins index.html` must return nothing.

- [ ] **Step 3: Make `screenStatus` use effective-time prerequisites**

Replace:

```js
function screenStatus(i,d){
  if(!String(DAY[i].title).includes("Screen"))return "";
  const needed=DAY.map((_,idx)=>idx).filter(idx=>idx<i&&blockMins(DAY[idx])!=null);
  const earned=needed.every(idx=>d.done[idx]);
```

with:

```js
function screenStatus(i,d){
  if(!String(DAY[i].title).includes("Screen"))return "";
  const needed=SQTime.neededBefore(DAY,dayOverrides,i);
  const earned=needed.every(idx=>d.done[idx]);
```

(keep the return strings unchanged).

- [ ] **Step 4: Render My Day rows in effective-time order with the moved flag**

In `renderMyDay()`, the row loop is `DAY.map((b,i)=>{...})`. Change to:

```js
SQTime.displayOrder(DAY,dayOverrides).map(i=>{
  const b=DAY[i];
  ...
```

(body unchanged — it already uses `i` everywhere). In the row template, change the time cell:

```js
<div class="dtime">${b.t}</div>
```

to:

```js
<div class="dtime">${effT(i)}${dayOverrides[i]!=null?`<span class="movedflag">moved 已調整</span>`:""}</div>
```

And add the flag style next to the existing `.timeflag` CSS rule:

```css
.movedflag{display:block;font-size:.6em;color:var(--ok,#7bd88f);opacity:.9}
```

- [ ] **Step 5: Check + parity smoke**

Run: `node scripts/check.mjs` → green.
Browser: with `dayOverrides` empty everything must look and behave **identical** to before (row order, Now/Next flags, amber past, screen 🔓/🔒, 10:00 announcement). Then in DevTools set `dayOverrides={4:"15:00"}; renderMyDay()` — the homework row jumps after 14:00, shows "moved 已調整", and Screen #1 🔓 no longer requires it. Reset with `dayOverrides={}`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "refactor: schedule math via SQTime with override support"
```

## DONE WHEN

- `node scripts/check.mjs` green (includes `node --test`); zero visible behavior change with empty overrides; the DevTools override experiment reorders rows, flags "moved", and recomputes screen prerequisites; `DAY` exists in exactly one file.
