# Slice 09 — Brain Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared brain-game engine — data shape, pure logic, round UI, scoring and stats plumbing — and prove it end to end with one playable game (Calculations 計算).

**Architecture:** Three new modules following the `drills.js` pattern (classic script exposing a global plus `module.exports` for node tests). `brain-data.js` holds games as pure data with injected-RNG item generators. `brain-core.js` holds pure logic with no DOM. `brain-ui.js` owns the round overlay and answer pads. `index.html` only mounts them and owns the `LEVELS` entry.

**Tech Stack:** Vanilla ES5-compatible JS (no build step), `node:test` for unit tests, `scripts/check.mjs` for data integrity.

**Depends on:** slice 02 (day/time core) — already landed.

**Read first:** `docs/plans/2026-07-26-brain-gym/design.md` §3, §5, §8.

---

## Hard constraints (check.mjs will fail you)

`scripts/check.mjs:39-44` scans every runtime file for Android 8 incompatibilities. In **all** files under `js/` and in `index.html`:

- **No optional chaining** (`?.`)
- **No nullish coalescing** (`??`)
- **No `Array.prototype.flatMap`**

Use `a && a.b`, `x != null ? x : fallback`, and `reduce`/`concat` instead. Every code block below already obeys this — do not "modernise" it.

Every user-facing string ships `[en, zh]` (繁體中文, Taiwan usage). A string without 中文 is a bug and check.mjs will catch it.

---

## File structure

| File | Responsibility |
|---|---|
| `js/brain-data.js` (create) | `TIERS`, `TIER_DEFAULT`, `GAMES` map. One entry per game with per-tier config and item generators. Pure data + pure functions only. |
| `js/brain-core.js` (create) | `dseed`, `mulberry32`, `tierFor`, `eligibleGames`, `dailyThree`, `buildRound`, `scoreRound`, `gateState`. No DOM, no globals. |
| `js/brain-ui.js` (create) | `SQBrain.openRound(...)` — overlay, prompt renderers, keypad + choice pads, count-up clock, result card. |
| `index.html` (modify) | `LEVELS.calc` entry; `startGame` branch; script tags. |
| `js/sync.js` (modify) | best-stat key handling becomes prefix-based instead of a hardcoded list. |
| `scripts/core.test.mjs` (modify) | unit tests for brain-core. |
| `scripts/check.mjs` (modify) | brain-data integrity rules; new files added to the Android-8 scan list. |

---

## Task 1: brain-core seeding and tier resolution

**Files:**
- Create: `js/brain-core.js`
- Create: `js/brain-data.js` (minimal, expanded in Task 3)
- Test: `scripts/core.test.mjs`

- [x] **Step 1: Write the failing tests**

Append to `scripts/core.test.mjs`:

```js
const SQBrainCore = require("../js/brain-core.js");
const SQBrainData = require("../js/brain-data.js");

test("tierFor falls back to the per-kid default", () => {
  assert.equal(SQBrainCore.tierFor("lucien", {}), "tot");
  assert.equal(SQBrainCore.tierFor("lili", {}), "mid");
  assert.equal(SQBrainCore.tierFor("luis", {}), "hard");
  assert.equal(SQBrainCore.tierFor("nobody", {}), "mid");
});

test("tierFor honours a valid admin override", () => {
  assert.equal(SQBrainCore.tierFor("lucien", { brain_tier_lucien: "mid" }), "mid");
  assert.equal(SQBrainCore.tierFor("luis", { brain_tier_luis: "tot" }), "tot");
});

test("tierFor ignores an empty or unrecognised override", () => {
  assert.equal(SQBrainCore.tierFor("lucien", { brain_tier_lucien: "" }), "tot");
  assert.equal(SQBrainCore.tierFor("lucien", { brain_tier_lucien: "genius" }), "tot");
});

test("mulberry32 is deterministic and in range", () => {
  const a = SQBrainCore.mulberry32(42);
  const b = SQBrainCore.mulberry32(42);
  for (let i = 0; i < 20; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/core.test.mjs`
Expected: FAIL — `Cannot find module '../js/brain-core.js'`

- [x] **Step 3: Create the minimal `js/brain-data.js`**

```js
/* SQBrainData — Brain Gym game definitions (design.md §4).
   Pure data + pure generators. No DOM, no globals, no side effects. */
(function(){
  const TIERS=["tot","mid","hard"];
  const TIER_DEFAULT={lucien:"tot",lili:"mid",luis:"hard"};
  const GAMES={};

  const api={TIERS:TIERS,TIER_DEFAULT:TIER_DEFAULT,GAMES:GAMES};
  if(typeof window!=="undefined")window.SQBrainData=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
```

- [x] **Step 4: Create `js/brain-core.js` with seeding and tiers**

```js
/* SQBrainCore — pure Brain Gym logic (design.md §5, §6).
   No DOM, no globals. Every function takes what it needs as an argument. */
(function(){
  const D=typeof window!=="undefined"?window.SQBrainData:require("./brain-data.js");

  /* same hash as drills.js / mission seeding — keep them identical on purpose */
  function dseed(str){let h=7;for(const c of str)h=(h*31+c.charCodeAt(0))>>>0;return h;}

  /* small deterministic PRNG so tests and every tablet agree */
  function mulberry32(seed){
    let a=seed>>>0;
    return function(){
      a=(a+0x6D2B79F5)>>>0;
      let t=a;
      t=Math.imul(t^(t>>>15),t|1);
      t=(t^(t+Math.imul(t^(t>>>7),t|61)))^t;
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }

  function tierFor(kid,settings){
    const raw=settings&&settings["brain_tier_"+kid];
    if(raw&&D.TIERS.indexOf(raw)>=0)return raw;
    const def=D.TIER_DEFAULT[kid];
    return def?def:"mid";
  }

  const api={dseed:dseed,mulberry32:mulberry32,tierFor:tierFor};
  if(typeof window!=="undefined")window.SQBrainCore=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
```

- [x] **Step 5: Run tests to verify they pass**

Run: `node --test scripts/core.test.mjs`
Expected: PASS — all 4 new tests green, existing tests unchanged.

- [x] **Step 6: Commit**

```bash
git add js/brain-core.js js/brain-data.js scripts/core.test.mjs
git commit -m "feat(brain): add brain-core seeding and per-kid difficulty tiers"
```

---

## Task 2: eligibleGames and dailyThree

**Files:**
- Modify: `js/brain-core.js`
- Test: `scripts/core.test.mjs`

- [x] **Step 1: Write the failing tests**

Append to `scripts/core.test.mjs`:

```js
/* a fake catalogue so these tests never break when real game content changes */
const FAKE = {
  TIERS: ["tot", "mid", "hard"],
  TIER_DEFAULT: { lucien: "tot", lili: "mid", luis: "hard" },
  GAMES: {
    a: { id: "a", skill: "math",      tiers: { tot: {}, mid: {}, hard: {} } },
    b: { id: "b", skill: "memory",    tiers: { tot: {}, mid: {}, hard: {} } },
    c: { id: "c", skill: "attention", tiers: { tot: {}, mid: {}, hard: {} } },
    d: { id: "d", skill: "math",      tiers: { mid: {}, hard: {} } },
    e: { id: "e", skill: "logic",     tiers: { mid: {}, hard: {} } },
  },
};

test("eligibleGames drops games with no tier for that kid", () => {
  assert.deepEqual(SQBrainCore.eligibleGames("lucien", {}, FAKE), ["a", "b", "c"]);
  assert.deepEqual(SQBrainCore.eligibleGames("lili", {}, FAKE), ["a", "b", "c", "d", "e"]);
});

test("eligibleGames follows an admin tier override", () => {
  assert.deepEqual(
    SQBrainCore.eligibleGames("lili", { brain_tier_lili: "tot" }, FAKE),
    ["a", "b", "c"]
  );
});

test("dailyThree is deterministic for the same kid and date", () => {
  const one = SQBrainCore.dailyThree("lili", "2026-07-27", {}, FAKE);
  const two = SQBrainCore.dailyThree("lili", "2026-07-27", {}, FAKE);
  assert.deepEqual(one, two);
  assert.equal(one.length, 3);
  assert.equal(new Set(one).size, 3);
});

test("dailyThree differs by kid and by date", () => {
  const lili = SQBrainCore.dailyThree("lili", "2026-07-27", {}, FAKE);
  const luis = SQBrainCore.dailyThree("luis", "2026-07-27", {}, FAKE);
  const next = SQBrainCore.dailyThree("lili", "2026-07-28", {}, FAKE);
  assert.ok(lili.join() !== luis.join() || lili.join() !== next.join());
});

test("dailyThree prefers three different skills when it can", () => {
  for (const day of ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-08-01"]) {
    const trio = SQBrainCore.dailyThree("luis", day, {}, FAKE);
    const skills = trio.map((id) => FAKE.GAMES[id].skill);
    assert.equal(new Set(skills).size, 3, `${day} gave ${skills.join("/")}`);
  }
});

test("dailyThree returns the whole pool when fewer than three games are eligible", () => {
  const tiny = { TIERS: FAKE.TIERS, TIER_DEFAULT: FAKE.TIER_DEFAULT, GAMES: { a: FAKE.GAMES.a, b: FAKE.GAMES.b } };
  assert.deepEqual(SQBrainCore.dailyThree("lucien", "2026-07-27", {}, tiny).length, 2);
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/core.test.mjs`
Expected: FAIL — `SQBrainCore.eligibleGames is not a function`

- [x] **Step 3: Implement in `js/brain-core.js`**

Insert before the `const api=` line:

```js
  function cat(override){return override?override:D;}

  function eligibleGames(kid,settings,override){
    const data=cat(override), tier=tierForIn(kid,settings,data);
    return Object.keys(data.GAMES).filter(function(id){
      const g=data.GAMES[id];
      return !!(g&&g.tiers&&g.tiers[tier]);
    });
  }

  /* shuffle a copy with the seeded PRNG — never mutates the input */
  function seededShuffle(list,rnd){
    const out=list.slice();
    for(let i=out.length-1;i>0;i--){
      const j=Math.floor(rnd()*(i+1));
      const tmp=out[i]; out[i]=out[j]; out[j]=tmp;
    }
    return out;
  }

  /* Three distinct games, same on every tablet, offline (design.md §6).
     Pass one: take a game only if its skill tag is new, so a day is never
     three arithmetic games. Pass two: fill any shortfall, tags may repeat. */
  function dailyThree(kid,dateStr,settings,override){
    const data=cat(override);
    const pool=eligibleGames(kid,settings,override);
    if(pool.length<=3)return pool;
    const order=seededShuffle(pool,mulberry32(dseed("brain"+dateStr+kid)));
    const picked=[], seen={};
    for(const id of order){
      if(picked.length===3)break;
      const skill=data.GAMES[id].skill;
      if(seen[skill])continue;
      seen[skill]=true; picked.push(id);
    }
    for(const id of order){
      if(picked.length===3)break;
      if(picked.indexOf(id)<0)picked.push(id);
    }
    return picked;
  }
```

Then refactor `tierFor` so it can take the same injected catalogue — replace the existing `tierFor` with:

```js
  function tierForIn(kid,settings,data){
    const raw=settings&&settings["brain_tier_"+kid];
    if(raw&&data.TIERS.indexOf(raw)>=0)return raw;
    const def=data.TIER_DEFAULT[kid];
    return def?def:"mid";
  }
  function tierFor(kid,settings,override){return tierForIn(kid,settings,cat(override));}
```

Extend the exported api:

```js
  const api={dseed:dseed,mulberry32:mulberry32,tierFor:tierFor,
    eligibleGames:eligibleGames,dailyThree:dailyThree,seededShuffle:seededShuffle};
```

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/core.test.mjs`
Expected: PASS — all tests green, including the Task 1 tier tests (they call `tierFor` with two arguments, which still works).

- [x] **Step 5: Commit**

```bash
git add js/brain-core.js scripts/core.test.mjs
git commit -m "feat(brain): add eligibleGames and seeded dailyThree rotation"
```

---

## Task 3: the Calculations game data

**Files:**
- Modify: `js/brain-data.js`
- Test: `scripts/core.test.mjs`

Item shape produced by every generator — memorise it, all nine games use it:

```js
{
  prompt: { type:"text", en:"8 + 5 = ?", zh:"8 + 5 = ?" },  // type drives the renderer
  say:    ["eight plus five", "八加五"],                     // optional, spoken on tot
  answer: "13",                                              // always a string
  choices: ["11","12","13","14"]                             // required for pad "choice"
}
```

- [x] **Step 1: Write the failing tests**

Append to `scripts/core.test.mjs`:

```js
test("every game declares bilingual title, skill and at least one tier", () => {
  const ids = Object.keys(SQBrainData.GAMES);
  assert.ok(ids.length >= 1);
  for (const id of ids) {
    const g = SQBrainData.GAMES[id];
    assert.equal(g.id, id, `${id}: id mismatch`);
    assert.ok(g.icon, `${id}: missing icon`);
    assert.ok(g.title && g.title[0] && g.title[1], `${id}: title must be [en, zh]`);
    assert.ok(g.blurb && g.blurb[0] && g.blurb[1], `${id}: blurb must be [en, zh]`);
    assert.ok(g.skill, `${id}: missing skill tag`);
    const tiers = Object.keys(g.tiers);
    assert.ok(tiers.length >= 1, `${id}: no tiers`);
    for (const t of tiers) assert.ok(SQBrainData.TIERS.indexOf(t) >= 0, `${id}: bad tier ${t}`);
  }
});

test("every tier generator produces a well-formed item", () => {
  const rnd = SQBrainCore.mulberry32(1);
  for (const id of Object.keys(SQBrainData.GAMES)) {
    const g = SQBrainData.GAMES[id];
    for (const t of Object.keys(g.tiers)) {
      const cfg = g.tiers[t];
      assert.ok(cfg.items > 0, `${id}.${t}: items must be > 0`);
      assert.equal(typeof cfg.clock, "boolean", `${id}.${t}: clock must be boolean`);
      assert.ok(["keypad", "choice", "grid", "type"].indexOf(cfg.pad) >= 0, `${id}.${t}: bad pad`);
      for (let n = 0; n < 25; n++) {
        const item = cfg.gen(rnd);
        assert.ok(item.prompt && item.prompt.type, `${id}.${t}: item missing prompt.type`);
        assert.equal(typeof item.answer, "string", `${id}.${t}: answer must be a string`);
        assert.ok(item.answer.length > 0, `${id}.${t}: empty answer`);
        if (cfg.pad === "choice") {
          assert.ok(Array.isArray(item.choices), `${id}.${t}: choice pad needs choices`);
          assert.ok(item.choices.indexOf(item.answer) >= 0, `${id}.${t}: answer not among choices`);
          assert.equal(new Set(item.choices).size, item.choices.length, `${id}.${t}: duplicate choices`);
        }
      }
    }
  }
});

test("tot tiers never run a clock", () => {
  for (const id of Object.keys(SQBrainData.GAMES)) {
    const tot = SQBrainData.GAMES[id].tiers.tot;
    if (tot) assert.equal(tot.clock, false, `${id}: tot tier must not be clocked`);
  }
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/core.test.mjs`
Expected: FAIL — `assert.ok(ids.length >= 1)` fails, `GAMES` is empty.

- [x] **Step 3: Implement Calculations in `js/brain-data.js`**

Replace the file body (keep the IIFE wrapper and the export block) with:

```js
  const TIERS=["tot","mid","hard"];
  const TIER_DEFAULT={lucien:"tot",lili:"mid",luis:"hard"};

  /* ---- shared generator helpers ---- */
  function pick(rnd,list){return list[Math.floor(rnd()*list.length)];}
  function intBetween(rnd,lo,hi){return lo+Math.floor(rnd()*(hi-lo+1));}

  /* Distractors around a numeric answer: near misses, never negative,
     never a duplicate, always exactly `count` of them. */
  function numChoices(rnd,answer,count,spread){
    const out=[String(answer)];
    let guard=0;
    while(out.length<count&&guard<200){
      guard++;
      const delta=intBetween(rnd,1,spread)*(rnd()<0.5?-1:1);
      const cand=answer+delta;
      if(cand<0)continue;
      if(out.indexOf(String(cand))>=0)continue;
      out.push(String(cand));
    }
    while(out.length<count)out.push(String(answer+out.length*7+1));
    return shuffleWith(rnd,out);
  }

  function shuffleWith(rnd,list){
    const out=list.slice();
    for(let i=out.length-1;i>0;i--){
      const j=Math.floor(rnd()*(i+1));
      const tmp=out[i]; out[i]=out[j]; out[j]=tmp;
    }
    return out;
  }

  const NUM_ZH=["零","一","二","三","四","五","六","七","八","九","十"];
  function zhNum(n){return n>=0&&n<=10?NUM_ZH[n]:String(n);}

  /* ---- 1. Calculations 計算 ---- */
  const COUNT_EMOJI=["🍎","🍌","⭐","🐟","🚗","🎈"];

  function genCalcTot(rnd){
    const em=pick(rnd,COUNT_EMOJI);
    const a=intBetween(rnd,1,3), b=intBetween(rnd,1,2), sum=a+b;
    return {
      prompt:{type:"emoji",em:em,a:a,b:b,
        en:em.repeat(a)+" + "+em.repeat(b)+" = ?",
        zh:em.repeat(a)+" + "+em.repeat(b)+" = ?"},
      say:[String(a)+" plus "+String(b),zhNum(a)+"加"+zhNum(b)],
      answer:String(sum),
      choices:numChoices(rnd,sum,4,3)
    };
  }

  function genCalcMid(rnd){
    const plus=rnd()<0.5;
    let a=intBetween(rnd,2,20), b=intBetween(rnd,2,9);
    if(!plus&&b>a){const t=a;a=b;b=t;}
    const sum=plus?a+b:a-b, sign=plus?"+":"−";
    return {
      prompt:{type:"text",en:a+" "+sign+" "+b+" = ?",zh:a+" "+sign+" "+b+" = ?"},
      say:[a+(plus?" plus ":" minus ")+b,String(a)+(plus?"加":"減")+String(b)],
      answer:String(sum)
    };
  }

  function genCalcHard(rnd){
    const mode=intBetween(rnd,0,2);
    if(mode===2){
      const a=intBetween(rnd,2,9), b=intBetween(rnd,2,9);
      return {prompt:{type:"text",en:a+" × "+b+" = ?",zh:a+" × "+b+" = ?"},answer:String(a*b)};
    }
    let a=intBetween(rnd,11,99), b=intBetween(rnd,11,49);
    if(mode===1&&b>a){const t=a;a=b;b=t;}
    const sum=mode===0?a+b:a-b, sign=mode===0?"+":"−";
    return {prompt:{type:"text",en:a+" "+sign+" "+b+" = ?",zh:a+" "+sign+" "+b+" = ?"},answer:String(sum)};
  }

  const GAMES={
    calc:{
      id:"calc", icon:"➕", skill:"math",
      title:["Calculations","計算"],
      blurb:["Quick sums","快速計算"],
      tiers:{
        tot :{items:10,clock:false,pad:"choice",gen:genCalcTot},
        mid :{items:20,clock:true, pad:"keypad",gen:genCalcMid},
        hard:{items:20,clock:true, pad:"keypad",gen:genCalcHard}
      }
    }
  };
```

Update the export line to also expose the helpers that slice 10 reuses:

```js
  const api={TIERS:TIERS,TIER_DEFAULT:TIER_DEFAULT,GAMES:GAMES,
    pick:pick,intBetween:intBetween,numChoices:numChoices,shuffleWith:shuffleWith,zhNum:zhNum};
```

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/core.test.mjs`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add js/brain-data.js scripts/core.test.mjs
git commit -m "feat(brain): add Calculations game data with three difficulty tiers"
```

---

## Task 4: buildRound and scoreRound

**Files:**
- Modify: `js/brain-core.js`
- Test: `scripts/core.test.mjs`

- [x] **Step 1: Write the failing tests**

```js
test("buildRound produces the tier's item count and config", () => {
  const round = SQBrainCore.buildRound("calc", "mid", SQBrainCore.mulberry32(9));
  assert.equal(round.gameId, "calc");
  assert.equal(round.tier, "mid");
  assert.equal(round.pad, "keypad");
  assert.equal(round.clock, true);
  assert.equal(round.items.length, 20);
  assert.equal(round.items.filter((i) => typeof i.answer === "string").length, 20);
});

test("buildRound on a tot tier is unclocked", () => {
  const round = SQBrainCore.buildRound("calc", "tot", SQBrainCore.mulberry32(9));
  assert.equal(round.clock, false);
  assert.equal(round.pad, "choice");
  assert.equal(round.items.length, 10);
});

test("buildRound throws on an unknown game or tier", () => {
  assert.throws(() => SQBrainCore.buildRound("nope", "mid", SQBrainCore.mulberry32(1)));
  assert.throws(() => SQBrainCore.buildRound("calc", "nope", SQBrainCore.mulberry32(1)));
});

test("scoreRound counts correct answers and keeps ms only when clocked", () => {
  const items = [{ answer: "3" }, { answer: "5" }, { answer: "7" }];
  const clocked = SQBrainCore.scoreRound({ items: items, answers: ["3", "4", "7"], ms: 12000, clock: true });
  assert.equal(clocked.score, 2);
  assert.equal(clocked.total, 3);
  assert.equal(clocked.ms, 12000);
  assert.deepEqual(clocked.correct, [true, false, true]);

  const unclocked = SQBrainCore.scoreRound({ items: items, answers: ["3", "5", "7"], ms: 12000, clock: false });
  assert.equal(unclocked.score, 3);
  assert.equal(unclocked.ms, 0);
});

test("scoreRound compares answers as trimmed strings", () => {
  const out = SQBrainCore.scoreRound({ items: [{ answer: "13" }], answers: [" 13 "], ms: 0, clock: false });
  assert.equal(out.score, 1);
});

test("scoreRound treats a missing answer as wrong, never as a crash", () => {
  const out = SQBrainCore.scoreRound({ items: [{ answer: "1" }, { answer: "2" }], answers: ["1"], ms: 0, clock: false });
  assert.equal(out.score, 1);
  assert.deepEqual(out.correct, [true, false]);
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/core.test.mjs`
Expected: FAIL — `SQBrainCore.buildRound is not a function`

- [x] **Step 3: Implement in `js/brain-core.js`**

```js
  function buildRound(gameId,tier,rnd,override){
    const data=cat(override);
    const g=data.GAMES[gameId];
    if(!g)throw new Error("unknown brain game: "+gameId);
    const cfg=g.tiers[tier];
    if(!cfg)throw new Error("game "+gameId+" has no tier "+tier);
    const items=[];
    for(let i=0;i<cfg.items;i++)items.push(cfg.gen(rnd));
    return {gameId:gameId,tier:tier,pad:cfg.pad,clock:!!cfg.clock,items:items};
  }

  function scoreRound(ctx){
    const items=ctx.items||[], answers=ctx.answers||[];
    const correct=items.map(function(item,i){
      const given=answers[i]==null?"":String(answers[i]).trim();
      return given===String(item.answer).trim();
    });
    const score=correct.filter(function(c){return c;}).length;
    return {score:score,total:items.length,ms:ctx.clock?(ctx.ms||0):0,correct:correct};
  }
```

Add both to the exported api.

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/core.test.mjs`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add js/brain-core.js scripts/core.test.mjs
git commit -m "feat(brain): add buildRound and scoreRound"
```

---

## Task 5: the round UI (`brain-ui.js`)

**Files:**
- Create: `js/brain-ui.js`

No unit test — this is DOM code, verified by the manual smoke test in Task 8. It follows `js/drills.js` exactly: an IIFE, an overlay element, injected dependencies, no globals reached for directly.

- [x] **Step 1: Create `js/brain-ui.js`**

```js
/* SQBrain — Brain Gym round UI (design.md §8).
   Injected deps: {say, onFinish, kidColor}. No fail state, no cutoff, no red. */
(function(){
  const C=window.SQBrainCore, D=window.SQBrainData;

  function fmtMs(ms){
    const s=Math.floor(ms/1000);
    const m=Math.floor(s/60), r=s%60;
    return m+":"+(r<10?"0":"")+r;
  }

  function promptHtml(p){
    if(p.type==="emoji")
      return `<div class="bprompt bemoji">${p.en}</div>`;
    return `<div class="bprompt">${p.en}</div>`;
  }

  function openRound(opts){
    /* opts: {gameId, tier, kid, say, onFinish} */
    const game=D.GAMES[opts.gameId];
    const round=C.buildRound(opts.gameId,opts.tier,C.mulberry32(Date.now()>>>0));
    const answers=[]; let idx=0, entry="", startTs=0, tickInt=null, shaking=false;

    const o=document.createElement("div");
    o.className="overlay"; o.id="brainOverlay";
    document.body.appendChild(o);

    function stopClock(){if(tickInt){clearInterval(tickInt);tickInt=null;}}
    function close(){stopClock();o.remove();}
    function elapsed(){return startTs?Date.now()-startTs:0;}

    function speak(){
      const item=round.items[idx];
      if(opts.say&&item.say)opts.say(item.say);
    }

    function padHtml(item){
      if(round.pad==="choice"){
        return `<div class="bpad bchoice">${item.choices.map(function(c){
          return `<button class="btn bkey" data-v="${c}">${c}</button>`;}).join("")}</div>`;
      }
      /* keypad */
      const keys=["1","2","3","4","5","6","7","8","9","⌫","0","✓"];
      return `<div class="bentry">${entry===""?"&nbsp;":entry}</div>
        <div class="bpad bkeypad">${keys.map(function(k){
          return `<button class="btn bkey" data-v="${k}">${k}</button>`;}).join("")}</div>`;
    }

    function render(){
      const item=round.items[idx];
      o.innerHTML=`<div class="card braincard${shaking?" bshake":""}">
        <h3>${game.icon} ${game.title[0]}<span class="zht">${game.title[1]}</span></h3>
        <div class="bhud">
          <span>${idx+1} / ${round.items.length}</span>
          ${round.clock?`<span id="bclock">⏱ ${fmtMs(elapsed())}</span>`:""}
        </div>
        ${promptHtml(item.prompt)}
        ${padHtml(item)}
        <button class="btn small" id="bQuit">Later 待會再玩</button>
      </div>`;
      o.querySelectorAll(".bkey").forEach(function(b){b.onclick=function(){press(b.dataset.v);};});
      o.querySelector("#bQuit").onclick=close;
    }

    function advance(given){
      answers[idx]=given;
      const item=round.items[idx];
      if(String(given).trim()!==String(item.answer).trim()){
        /* no fail state: shake, show the answer, then carry on */
        shaking=true; render();
        const box=o.querySelector(".bprompt");
        if(box)box.innerHTML=item.prompt.en+' <b class="bans">'+item.answer+"</b>";
        setTimeout(function(){shaking=false;step();},900);
        return;
      }
      step();
    }

    function step(){
      idx++; entry="";
      if(idx>=round.items.length){finish();return;}
      render(); speak();
    }

    function press(v){
      if(round.pad==="choice"){advance(v);return;}
      if(v==="⌫"){entry=entry.slice(0,-1);render();return;}
      if(v==="✓"){if(entry==="")return;advance(entry);return;}
      if(entry.length>=4)return;
      entry+=v; render();
    }

    function finish(){
      stopClock();
      const res=C.scoreRound({items:round.items,answers:answers,ms:elapsed(),clock:round.clock});
      close();
      if(opts.onFinish)opts.onFinish(Object.assign({gameId:opts.gameId,tier:opts.tier},res));
    }

    render(); speak();
    startTs=Date.now();
    if(round.clock){
      tickInt=setInterval(function(){
        const el=o.querySelector("#bclock");
        if(el)el.textContent="⏱ "+fmtMs(elapsed());
      },1000);
    }
  }

  const api={openRound:openRound,fmtMs:fmtMs};
  window.SQBrain=Object.assign(window.SQBrain||{},api);
})();
```

- [x] **Step 2: Add the styles**

Append to the `<style>` block in `index.html`, next to the existing `.drillcard` rules:

```css
.braincard{max-width:420px;text-align:center}
.bhud{display:flex;justify-content:space-between;opacity:.7;font-size:.9em;margin:.4em 0}
.bprompt{font-size:2.1em;font-weight:700;margin:.5em 0;line-height:1.3}
.bemoji{font-size:1.6em;letter-spacing:.06em}
.bans{color:var(--accent)}
.bentry{font-size:1.8em;min-height:1.4em;border-bottom:3px solid var(--accent);margin:.3em auto;width:4em}
.bpad{display:grid;gap:.5em;margin:.6em 0}
.bchoice{grid-template-columns:repeat(2,1fr)}
.bkeypad{grid-template-columns:repeat(3,1fr)}
.bkey{font-size:1.4em;padding:.6em 0;min-height:56px}
.bshake{animation:bshake .3s}
@keyframes bshake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
```

Rationale for `min-height:56px`: tablet-first coarse-pointer targets, per CLAUDE.md.

- [x] **Step 3: Commit**

```bash
git add js/brain-ui.js index.html
git commit -m "feat(brain): add the brain round overlay with keypad and choice pads"
```

---

## Task 6: sync — best scores without a hardcoded list

**Files:**
- Modify: `js/sync.js:60-66`, `js/sync.js:177`, `js/sync.js:255-256`

`sync.js` currently hardcodes `["balloon","race","orc","shop"]` in three places. Brain games add up to 18 keys, so the list becomes a **prefix rule** — no dependency on `brain-data.js`, nothing to keep in sync by hand.

- [x] **Step 1: Write the failing test**

Append to `scripts/sync.test.mjs`, following the file's existing harness style:

```js
test("brain best scores round-trip through hydration and diffing", () => {
  const store = makeStore();               // existing helper in this file
  store.applyStats([
    { kid_id: "lili", stat: "race", value: 40 },
    { kid_id: "lili", stat: "brain_calc", value: 18 },
    { kid_id: "lili", stat: "brain_calc_ms", value: 41000 },
    { kid_id: "lili", stat: "missions", value: 7 },
  ]);
  assert.equal(store.progress.lili.best.brain_calc, 18);
  assert.equal(store.progress.lili.best.brain_calc_ms, 41000);
  assert.equal(store.progress.lili.missions, 7);
});
```

If `makeStore`/`applyStats` are not already exposed by `sync.test.mjs`, extract the stat-hydration loop from `sync.js:175-179` into an exported pure function `applyStats(progress, rows)` first, and test that instead. Prefer the extraction — it is what makes this testable at all.

- [x] **Step 2: Run the test to verify it fails**

Run: `node scripts/sync.test.mjs`
Expected: FAIL — `brain_calc` is dropped by the hardcoded whitelist.

- [x] **Step 3: Add the prefix rule to `js/sync.js`**

Near the top of the module, beside the other constants:

```js
  /* A "best score" stat: the four original games, or any brain-gym key.
     Prefix rule on purpose — adding a brain game must not require editing sync.js. */
  function isBestStat(key){
    return key==="balloon"||key==="race"||key==="orc"||key==="shop"||key.indexOf("brain_")===0;
  }
```

Replace line 177:

```js
        if(isBestStat(r.stat)) p[r.kid_id].best[r.stat]=r.value||0;
```

Replace the diff block at lines 254-257:

```js
        const ab=a.best||{}, bb=b.best||{};
        const keys=Object.keys(ab).concat(Object.keys(bb)).filter(function(k,i,arr){return arr.indexOf(k)===i;});
        keys.forEach(function(stat){
          if(!isBestStat(stat))return;
          if((ab[stat]||0)!==(bb[stat]||0)) this.enqueue({type:"stat",kid:kid,stat:stat,value:ab[stat]||0});
        },this);
```

Leave lines 63-66 (the four `p.best.x=p.best.x||0` seeds) alone — brain keys default to `0` on read and do not need seeding.

- [x] **Step 4: Run tests to verify they pass**

Run: `node scripts/sync.test.mjs && node --test scripts/core.test.mjs`
Expected: PASS both.

- [x] **Step 5: Commit**

```bash
git add js/sync.js scripts/sync.test.mjs
git commit -m "refactor(sync): recognise best-score stats by prefix instead of a fixed list"
```

---

## Task 7: mount Calculations in the games grid

**Files:**
- Modify: `index.html` (script tags, `LEVELS` at :505, `startGame` at :1083)

- [x] **Step 1: Add the script tags**

Beside the existing `js/drills.js` tag, in the same order (data → core → ui):

```html
<script src="js/brain-data.js"></script>
<script src="js/brain-core.js"></script>
<script src="js/brain-ui.js"></script>
```

- [x] **Step 2: Add the `LEVELS` entry**

In `index.html:505`, after the `vocab` entry:

```js
  calc:   {icon:"➕", title:"Calculations", tz:"計算",      blurb:"Quick sums", brain:true},
```

The `brain:true` flag is what slice 11 keys the gate off — brain games never lock.

- [x] **Step 3: Branch in `startGame`**

In `index.html:1100-1107`, before the existing `if(lvl==="hunt")` chain:

```js
  if(LEVELS[lvl].brain){ startBrain(lvl); return; }
```

Then add the mount function next to `startGame`:

```js
/* Brain Gym round (design.md §8). Bests live in progress[kid].best.brain_<id>. */
function startBrain(gameId){
  const k=kid, settings=(store&&store.settings)||{};
  const tier=SQBrainCore.tierFor(k,settings);
  SQBrain.openRound({
    gameId:gameId, tier:tier, kid:k,
    say:function(pair){ announce(pair[0],pair[1]); },
    onFinish:function(res){ finishBrain(k,res); }
  });
}
function finishBrain(k,res){
  const p=progress[k];
  const bestKey="brain_"+res.gameId, msKey=bestKey+"_ms";
  const prev=p.best[bestKey]||0;
  const better=res.score>prev||(res.score===prev&&res.ms>0&&(p.best[msKey]||0)>0&&res.ms<p.best[msKey]);
  if(better){
    p.best[bestKey]=res.score;
    if(res.ms>0)p.best[msKey]=res.ms;
    saveProgress();
    if(store)store.setStat(k,bestKey,res.score);
    if(store&&res.ms>0)store.setStat(k,msKey,res.ms);
  }
  showBrainResult(res,better);
}
function showBrainResult(res,better){
  const o=document.createElement("div");
  o.className="overlay"; o.id="brainResult";
  o.innerHTML=`<div class="card braincard">
    <div style="font-size:2.4em">${better?"🌟":"👏"}</div>
    <h3>${res.score} / ${res.total}${res.ms?" · "+SQBrain.fmtMs(res.ms):""}</h3>
    <p>${better?"New best! 新紀錄！":"Nice work! 做得好！"}</p>
    <div class="vrow">
      <button class="btn" id="brAgain">Again 再一次</button>
      <button class="btn small" id="brDone">Done 完成</button>
    </div></div>`;
  document.body.appendChild(o);
  o.querySelector("#brAgain").onclick=function(){o.remove();startBrain(res.gameId);};
  o.querySelector("#brDone").onclick=function(){o.remove();goHome();};
  if(better)burst(24);
}
```

If the existing bilingual speech helper is not named `announce`, use whatever `drills.js` is passed as `say` from `index.html` — grep for `SQDrills.openSession` and copy that argument verbatim.

- [x] **Step 4: Run the check**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed: ...`

- [x] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(brain): add Calculations to the games grid"
```

---

## Task 8: check.mjs integrity rules

**Files:**
- Modify: `scripts/check.mjs:20` (runtime file list), and a new validation block

- [x] **Step 1: Add the new files to the Android-8 scan**

`scripts/check.mjs:20` — extend `runtimeFiles`:

```js
const runtimeFiles = ["index.html", "admin.html", "js/day.js", "js/day-data.js", "js/time-core.js", "js/lock-core.js", "js/pinpad.js", "js/papa-tools.js", "js/drills.js", "js/brain-data.js", "js/brain-core.js", "js/brain-ui.js", "js/sync.js", "js/admin.js", "sw.js"];
```

- [x] **Step 2: Add the brain-data validation block**

Insert after the existing `DRILLS load` block (`scripts/check.mjs:144-146`):

```js
try {
  const { createRequire } = await import("node:module");
  const requireCjs = createRequire(import.meta.url);
  const brainData = requireCjs("../js/brain-data.js");
  const brainCore = requireCjs("../js/brain-core.js");
  const ids = Object.keys(brainData.GAMES);
  if (!ids.length) fail("BRAIN", "no games defined");
  for (const id of ids) {
    const g = brainData.GAMES[id];
    if (g.id !== id) fail("BRAIN", `${id}: id field does not match its key`);
    assertPair(g.title, `BRAIN.${id}.title`);
    assertPair(g.blurb, `BRAIN.${id}.blurb`);
    if (!g.icon) fail("BRAIN", `${id}: missing icon`);
    if (!g.skill) fail("BRAIN", `${id}: missing skill tag`);
    const tiers = Object.keys(g.tiers || {});
    if (!tiers.length) fail("BRAIN", `${id}: defines no tiers`);
    for (const t of tiers) {
      if (!brainData.TIERS.includes(t)) fail("BRAIN", `${id}: unknown tier ${t}`);
      const cfg = g.tiers[t];
      if (!(cfg.items > 0)) fail("BRAIN", `${id}.${t}: items must be > 0`);
      if (typeof cfg.clock !== "boolean") fail("BRAIN", `${id}.${t}: clock must be boolean`);
      if (!["keypad", "choice", "grid", "type"].includes(cfg.pad)) fail("BRAIN", `${id}.${t}: unknown pad ${cfg.pad}`);
      if (typeof cfg.gen !== "function") fail("BRAIN", `${id}.${t}: missing gen()`);
    }
    if (g.tiers.tot && g.tiers.tot.clock !== false) fail("BRAIN", `${id}: tot tier must be unclocked`);
    if (!new RegExp(`\\b${id}\\s*:\\s*\\{[^}]*brain\\s*:\\s*true`).test(indexHtml)) {
      fail("BRAIN", `${id}: missing a LEVELS entry with brain:true in index.html`);
    }
  }
  for (const kid of ["lucien", "lili", "luis"]) {
    const trio = brainCore.dailyThree(kid, "2026-07-27", {});
    const again = brainCore.dailyThree(kid, "2026-07-27", {});
    if (trio.join() !== again.join()) fail("BRAIN", `dailyThree not deterministic for ${kid}`);
    if (new Set(trio).size !== trio.length) fail("BRAIN", `dailyThree repeated a game for ${kid}`);
  }
} catch (error) {
  fail("BRAIN load", error.message);
}
```

Note the `assertPair` helper is already defined at `scripts/check.mjs:11`.

- [x] **Step 3: Run the check**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed: ...`

- [x] **Step 4: Manual smoke test on a tablet-sized viewport**

1. Serve the site (`npx serve .` or the project's usual command) and open `index.html`.
2. Open Lili's hub → Games → ➕ Calculations. Expect: keypad, count-up clock, 20 items.
3. Answer one item wrong on purpose. Expect: shake, correct answer shown in accent colour, round continues, **no red, no game-over**.
4. Finish. Expect: result card with score and time, "New best!" on the first run.
5. Open Lucien's hub → ➕ Calculations. Expect: emoji counting prompt, four big choice buttons, **no clock anywhere**, prompts spoken aloud.
6. Turn wifi off, play a round, turn wifi on. Expect: the best score reaches Supabase `game_stats` as `brain_calc` once the queue drains.

- [x] **Step 5: Commit**

```bash
git add scripts/check.mjs
git commit -m "test(brain): validate brain-data integrity and dailyThree determinism in check"
```

---

## DONE WHEN

- `node scripts/check.mjs` is green.
- ➕ Calculations appears in every kid's games grid and is playable.
- Lucien gets emoji counting, four choices, **no clock**; Lili and Luis get the keypad and a count-up clock.
- Setting `family_settings.brain_tier_lucien = 'mid'` moves Lucien to the keypad tier *and* makes the clock appear, with no other change.
- A wrong answer never ends a round and never shows red.
- Best score and best time survive a reload and reach `game_stats` as `brain_calc` / `brain_calc_ms`.
- `dailyThree` returns the same trio for the same (kid, date) on two different devices.
- No `?.`, `??`, or `.flatMap` in any new file.
