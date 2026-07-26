# Slice 10 — Brain Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the Brain Gym pool from one game to nine, adding the two remaining answer pads (grid, type) and the prompt renderers each game needs.

**Architecture:** Every new game is data in `js/brain-data.js`; the engine from slice 09 is extended twice — once so an item can be worth more than one point and grade itself, and once so a tier can build its whole item array when items depend on each other. No new modules.

**Tech Stack:** Vanilla ES5-compatible JS, `node:test`, `scripts/check.mjs`.

**Depends on:** slice 09 (brain core, Calculations, engine, check rules).

**Read first:** `docs/plans/2026-07-26-brain-gym/design.md` §4, §5, §8, and slice 09's item shape.

---

## Hard constraints

Unchanged from slice 09 and enforced by `scripts/check.mjs:39-44`:

- **No `?.`, no `??`, no `.flatMap`** in any file under `js/` or in `index.html` (Android 8 tablets).
- Every user-facing string is `[en, zh]` in 繁體中文, Taiwan usage.
- Tablet-first: every tappable target ≥ 56 px.
- **`tot` tiers are never clocked** and their prompts are always spoken — Lucien (4) cannot read.

---

## File structure

| File | Change |
|---|---|
| `js/brain-core.js` | `scoreRound` gains `worth`/`grade`; `buildRound` gains tier-level `build`. |
| `js/brain-data.js` | eight new game entries plus their shared helpers. |
| `js/brain-ui.js` | `grid` and `type` pads; `colorword`, `swatch`, `countfield`, `clockface`, `money`, `gridflash`, `wordlist` prompt renderers. |
| `index.html` | eight new `LEVELS` entries; styles for the new pads and prompts. |
| `scripts/core.test.mjs` | tests per game and for the two engine extensions. |

---

## Task 1: items that are worth more than one point

Word Memory scores "7 of 8 words remembered" from a single screen, and Math Recall's first item is a freebie worth nothing. Both need `scoreRound` to stop assuming one item = one point.

**Files:**
- Modify: `js/brain-core.js`
- Test: `scripts/core.test.mjs`

- [x] **Step 1: Write the failing tests**

```js
test("scoreRound still scores plain items one point each", () => {
  const out = SQBrainCore.scoreRound({
    items: [{ answer: "1" }, { answer: "2" }], answers: ["1", "9"], ms: 0, clock: false,
  });
  assert.equal(out.score, 1);
  assert.equal(out.total, 2);
});

test("scoreRound honours item.worth", () => {
  const out = SQBrainCore.scoreRound({
    items: [{ answer: "a", worth: 0 }, { answer: "b", worth: 5 }],
    answers: ["zzz", "b"], ms: 0, clock: false,
  });
  assert.equal(out.score, 5);
  assert.equal(out.total, 5);
});

test("scoreRound honours item.grade for partial credit", () => {
  const item = {
    worth: 4,
    answer: "cat dog fish bird",
    grade: (given) => String(given).split(/\s+/).filter((w) => ["cat", "dog", "fish", "bird"].indexOf(w) >= 0).length,
  };
  const out = SQBrainCore.scoreRound({ items: [item], answers: ["cat bird zebra"], ms: 0, clock: false });
  assert.equal(out.score, 2);
  assert.equal(out.total, 4);
  assert.deepEqual(out.correct, [false]);   // partial is not "correct"
});

test("scoreRound clamps grade into 0..worth", () => {
  const item = { worth: 2, answer: "x", grade: () => 99 };
  const out = SQBrainCore.scoreRound({ items: [item], answers: ["x"], ms: 0, clock: false });
  assert.equal(out.score, 2);
});

test("buildRound uses a tier-level build() when present", () => {
  const FAKE_BUILD = {
    TIERS: ["tot", "mid", "hard"], TIER_DEFAULT: { lili: "mid" },
    GAMES: {
      chain: {
        id: "chain", skill: "memory", icon: "x", title: ["a", "b"], blurb: ["a", "b"],
        tiers: { mid: { items: 3, clock: true, pad: "keypad",
          build: (rnd, cfg) => [{ answer: "0", worth: 0 }, { answer: "1" }, { answer: "2" }] } },
      },
    },
  };
  const round = SQBrainCore.buildRound("chain", "mid", SQBrainCore.mulberry32(1), FAKE_BUILD);
  assert.equal(round.items.length, 3);
  assert.equal(round.items[0].worth, 0);
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/core.test.mjs`
Expected: FAIL — `honours item.worth` reports `score 0`, and the `build()` test throws.

- [x] **Step 3: Implement in `js/brain-core.js`**

Replace `scoreRound` with:

```js
  /* An item is worth 1 point unless it says otherwise, and grades itself as
     all-or-nothing unless it supplies grade(given) -> 0..worth. */
  function scoreRound(ctx){
    const items=ctx.items||[], answers=ctx.answers||[];
    let score=0, total=0;
    const correct=items.map(function(item,i){
      const worth=item.worth==null?1:item.worth;
      const given=answers[i]==null?"":String(answers[i]).trim();
      let got;
      if(typeof item.grade==="function"){
        got=item.grade(given);
        if(!(got>0))got=0;
        if(got>worth)got=worth;
      }else{
        got=given===String(item.answer).trim()?worth:0;
      }
      score+=got; total+=worth;
      return worth>0&&got===worth;
    });
    return {score:score,total:total,ms:ctx.clock?(ctx.ms||0):0,correct:correct};
  }
```

In `buildRound`, replace the item loop with:

```js
    let items;
    if(typeof cfg.build==="function"){
      items=cfg.build(rnd,cfg);
    }else{
      items=[];
      for(let i=0;i<cfg.items;i++)items.push(cfg.gen(rnd,{i:i,items:items}));
    }
    return {gameId:gameId,tier:tier,pad:cfg.pad,clock:!!cfg.clock,items:items};
```

Note the second argument now passed to `gen` — existing generators ignore it, and Math Recall uses it.

- [x] **Step 4: Update the check to accept `build`**

`scripts/check.mjs`, in the BRAIN block from slice 09, replace the `gen` assertion:

```js
      if (typeof cfg.gen !== "function" && typeof cfg.build !== "function") {
        fail("BRAIN", `${id}.${t}: needs gen() or build()`);
      }
```

And guard the generator smoke loop in `core.test.mjs` (slice 09, Task 3) so it skips `build`-only tiers:

```js
      if (typeof cfg.gen !== "function") continue;   // build()-driven tier, covered by its own test
```

- [x] **Step 5: Run tests to verify they pass**

Run: `node --test scripts/core.test.mjs && node scripts/check.mjs`
Expected: PASS both.

- [x] **Step 6: Commit**

```bash
git add js/brain-core.js scripts/core.test.mjs scripts/check.mjs
git commit -m "feat(brain): support weighted, self-grading items and tier-built rounds"
```

---

## Task 2: the grid and type pads, and the new prompt renderers

**Files:**
- Modify: `js/brain-ui.js`, `index.html` (styles)

- [x] **Step 1: Add the prompt renderers**

Replace `promptHtml` in `js/brain-ui.js` with:

```js
  const COLORS={red:["#e5484d","Red","紅色"],blue:["#3b82f6","Blue","藍色"],
    green:["#22c55e","Green","綠色"],yellow:["#eab308","Yellow","黃色"],
    purple:["#a855f7","Purple","紫色"],black:["#111827","Black","黑色"]};

  function clockSvg(h,m){
    const ha=(h%12)*30+m*0.5-90, ma=m*6-90, R=Math.PI/180;
    const hx=50+26*Math.cos(ha*R), hy=50+26*Math.sin(ha*R);
    const mx=50+38*Math.cos(ma*R), my=50+38*Math.sin(ma*R);
    let ticks="";
    for(let i=0;i<12;i++){
      const a=i*30-90;
      ticks+=`<circle cx="${50+42*Math.cos(a*R)}" cy="${50+42*Math.sin(a*R)}" r="2" fill="currentColor"/>`;
    }
    return `<svg viewBox="0 0 100 100" class="bclockface" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="3"/>
      ${ticks}
      <line x1="50" y1="50" x2="${hx}" y2="${hy}" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
      <line x1="50" y1="50" x2="${mx}" y2="${my}" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="3" fill="currentColor"/></svg>`;
  }

  function promptHtml(p){
    if(p.type==="emoji")     return `<div class="bprompt bemoji">${p.en}</div>`;
    if(p.type==="swatch")    return `<div class="bswatch" style="background:${COLORS[p.ink][0]}"></div>`;
    if(p.type==="colorword") return `<div class="bprompt bcolorword" style="color:${COLORS[p.ink][0]}">${p.word}</div>`;
    if(p.type==="countfield")return `<div class="bfield">${p.glyphs.join("")}</div>
      <div class="bsub">${p.en}<span class="zhs">${p.zh}</span></div>`;
    if(p.type==="clockface") return `${clockSvg(p.h,p.m)}
      <div class="bsub">${p.en}<span class="zhs">${p.zh}</span></div>`;
    if(p.type==="money")     return `<div class="bmoney">${p.art}</div>
      <div class="bsub">${p.en}<span class="zhs">${p.zh}</span></div>`;
    if(p.type==="gridflash") return `<div class="bgrid" id="bGrid"></div>
      <div class="bsub">${p.en}<span class="zhs">${p.zh}</span></div>`;
    if(p.type==="wordlist")  return `<div class="bwords" id="bWords"></div>
      <div class="bsub">${p.en}<span class="zhs">${p.zh}</span></div>`;
    return `<div class="bprompt">${p.en}</div>`;
  }
```

- [x] **Step 2: Add the two new pads**

In `padHtml`, before the keypad fallback:

```js
      if(round.pad==="grid"){
        return `<div class="bpad bgridpad" id="bGridPad"></div>
          <div class="bentry">${entry===""?"&nbsp;":entry.split(",").join(" · ")}</div>`;
      }
      if(round.pad==="type"){
        return `<textarea class="btype" id="bType" rows="3"
            placeholder="Type the words 打出單字"></textarea>
          <button class="btn bkey" data-v="✓">Done 完成</button>`;
      }
```

For the `choice` pad, honour an optional swatch style so Lucien's Stroop tier shows colours rather than words he cannot read:

```js
      if(round.pad==="choice"){
        return `<div class="bpad bchoice">${item.choices.map(function(c){
          if(item.choiceStyle==="swatch")
            return `<button class="btn bkey bswatchkey" data-v="${c}"
              style="background:${COLORS[c][0]}" aria-label="${COLORS[c][1]}"></button>`;
          return `<button class="btn bkey" data-v="${c}">${c}</button>`;}).join("")}</div>`;
      }
```

- [x] **Step 3: Wire the two interactive phases**

Grid games flash cells then accept taps in order; Word Memory shows a study list then hides it. Both are per-item lifecycles, so add a `mount` hook that runs after each render:

```js
    function mount(){
      const item=round.items[idx];
      if(item.prompt.type==="gridflash")mountGrid(item);
      if(item.prompt.type==="wordlist")mountWords(item);
      if(round.pad==="type"){
        const ta=o.querySelector("#bType");
        if(ta)ta.oninput=function(){entry=ta.value;};
      }
    }

    /* Low to High: show the numbers, hide them, then tap ascending. */
    function mountGrid(item){
      const host=o.querySelector("#bGrid"), pad=o.querySelector("#bGridPad");
      if(!host||!pad)return;
      const cells=item.prompt.cells;
      host.innerHTML=cells.map(function(c){return `<span class="bcell">${c.n}</span>`;}).join("");
      pad.innerHTML="";
      setTimeout(function(){
        host.innerHTML=cells.map(function(){return `<span class="bcell bhidden">?</span>`;}).join("");
        pad.innerHTML=C.seededShuffle(cells,Math.random).map(function(c){
          return `<button class="btn bkey" data-v="${c.n}">${c.n}</button>`;}).join("");
        pad.querySelectorAll(".bkey").forEach(function(b){
          b.onclick=function(){
            b.disabled=true; b.classList.add("bused");
            entry=entry===""?b.dataset.v:entry+","+b.dataset.v;
            const box=o.querySelector(".bentry");
            if(box)box.textContent=entry.split(",").join(" · ");
            if(entry.split(",").length===cells.length)advance(entry);
          };
        });
      },item.prompt.flashMs);
    }

    /* Word Memory: study the list, it disappears, then type what you remember. */
    function mountWords(item){
      const host=o.querySelector("#bWords");
      if(!host)return;
      host.innerHTML=item.prompt.words.map(function(w){return `<span class="bword">${w}</span>`;}).join("");
      const ta=o.querySelector("#bType");
      if(ta)ta.disabled=true;
      setTimeout(function(){
        host.innerHTML=`<span class="bsub">Now type what you remember 現在打出你記得的</span>`;
        if(ta){ta.disabled=false;ta.focus();}
      },item.prompt.studyMs);
    }
```

Call `mount()` at the end of `render()`, and make `step()`/the initial render reset `entry` to `""` before rendering (slice 09 already resets it in `step`; add the same reset before the first `render()` call).

- [x] **Step 4: Add the styles**

Append to the `<style>` block in `index.html`:

```css
.bswatch{width:120px;height:120px;border-radius:18px;margin:.6em auto}
.bswatchkey{min-height:64px;border:none}
.bcolorword{font-size:2.6em;letter-spacing:.04em}
.bfield{font-size:1.5em;line-height:1.5;word-break:break-all;max-height:9em;overflow:hidden}
.bsub{font-size:.95em;opacity:.85;margin-top:.4em}
.bclockface{width:150px;height:150px;margin:.4em auto;display:block}
.bmoney{font-size:1.6em;line-height:1.5}
.bgrid,.bwords{display:flex;flex-wrap:wrap;gap:.4em;justify-content:center;margin:.6em 0;min-height:3em}
.bcell,.bword{background:rgba(255,255,255,.09);border-radius:12px;padding:.35em .7em;font-size:1.3em}
.bhidden{opacity:.35}
.bgridpad{grid-template-columns:repeat(4,1fr)}
.bused{opacity:.35}
.btype{width:100%;font-size:1.2em;padding:.6em;border-radius:12px;margin:.4em 0}
```

- [x] **Step 5: Commit**

```bash
git add js/brain-ui.js index.html
git commit -m "feat(brain): add grid and type pads plus clock, colour, money and list prompts"
```

---

## Task 3: Sign Finder 找符號 and Color Words 顏色字

**Files:**
- Modify: `js/brain-data.js`
- Test: `scripts/core.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
test("Sign Finder answers are always a real operator that makes the equation true", () => {
  const rnd = SQBrainCore.mulberry32(3);
  for (const tier of ["tot", "mid", "hard"]) {
    const round = SQBrainCore.buildRound("signs", tier, rnd);
    for (const item of round.items) {
      assert.ok(["+", "−", "×", "÷"].indexOf(item.answer) >= 0);
      const [a, b, r] = [item.prompt.a, item.prompt.b, item.prompt.r];
      const applied = { "+": a + b, "−": a - b, "×": a * b, "÷": a / b }[item.answer];
      assert.equal(applied, r, `${a} ${item.answer} ${b} should be ${r}`);
      assert.ok(item.choices.indexOf(item.answer) >= 0);
    }
  }
});

test("Sign Finder tot only ever asks for plus or minus", () => {
  const round = SQBrainCore.buildRound("signs", "tot", SQBrainCore.mulberry32(11));
  for (const item of round.items) {
    assert.ok(["+", "−"].indexOf(item.answer) >= 0);
    assert.ok(item.prompt.r >= 0);
  }
});

test("Color Words asks for the ink, never the word", () => {
  const round = SQBrainCore.buildRound("stroop", "mid", SQBrainCore.mulberry32(5));
  for (const item of round.items) {
    assert.equal(item.answer, item.prompt.ink);
    assert.ok(item.choices.indexOf(item.answer) >= 0);
    assert.equal(item.choices.length, 4);
  }
});

test("Color Words tot uses swatches and never a written word", () => {
  const round = SQBrainCore.buildRound("stroop", "tot", SQBrainCore.mulberry32(5));
  for (const item of round.items) {
    assert.equal(item.prompt.type, "swatch");
    assert.equal(item.choiceStyle, "swatch");
    assert.ok(item.say && item.say[0] && item.say[1]);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/core.test.mjs`
Expected: FAIL — `unknown brain game: signs`

- [ ] **Step 3: Implement in `js/brain-data.js`**

```js
  /* ---- 2. Sign Finder 找符號 ---- */
  function applyOp(op,a,b){
    if(op==="+")return a+b;
    if(op==="−")return a-b;
    if(op==="×")return a*b;
    return a/b;
  }
  function signItem(rnd,ops,lo,hi){
    const op=pick(rnd,ops);
    let a,b;
    if(op==="÷"){b=intBetween(rnd,2,9);a=b*intBetween(rnd,2,9);}
    else{
      a=intBetween(rnd,lo,hi); b=intBetween(rnd,lo,hi);
      if(op==="−"&&b>a){const t=a;a=b;b=t;}
    }
    const r=applyOp(op,a,b);
    return {
      prompt:{type:"text",a:a,b:b,r:r,en:a+" ? "+b+" = "+r,zh:a+" ? "+b+" = "+r},
      say:["What sign is missing?","缺哪個符號？"],
      answer:op, choices:ops.slice()
    };
  }

  /* ---- 4. Color Words 顏色字 (Stroop) ---- */
  const STROOP_KEYS=["red","blue","green","yellow"];
  const COLOR_EN={red:"Red",blue:"Blue",green:"Green",yellow:"Yellow",purple:"Purple",black:"Black"};
  const COLOR_ZH={red:"紅色",blue:"藍色",green:"綠色",yellow:"黃色",purple:"紫色",black:"黑色"};

  function stroopTot(rnd){
    const ink=pick(rnd,STROOP_KEYS);
    return {
      prompt:{type:"swatch",ink:ink,en:"Which colour? 哪個顏色？",zh:"哪個顏色？"},
      say:["Which colour is this?","這是什麼顏色？"],
      answer:ink, choices:shuffleWith(rnd,STROOP_KEYS.slice()), choiceStyle:"swatch"
    };
  }
  function stroopWord(rnd,zh){
    const ink=pick(rnd,STROOP_KEYS);
    let word=pick(rnd,STROOP_KEYS);
    if(word===ink)word=pick(rnd,STROOP_KEYS.filter(function(k){return k!==ink;}));
    return {
      prompt:{type:"colorword",ink:ink,word:zh?COLOR_ZH[word]:COLOR_EN[word],
        en:"Say the INK colour",zh:"說出「顏色」不是字"},
      answer:ink, choices:shuffleWith(rnd,STROOP_KEYS.slice())
    };
  }
```

Add to `GAMES`:

```js
    signs:{
      id:"signs", icon:"❓", skill:"math",
      title:["Sign Finder","找符號"], blurb:["Find the missing sign","找出缺的符號"],
      tiers:{
        tot :{items:10,clock:false,pad:"choice",gen:function(r){return signItem(r,["+","−"],1,5);}},
        mid :{items:15,clock:true, pad:"choice",gen:function(r){return signItem(r,["+","−","×"],2,9);}},
        hard:{items:15,clock:true, pad:"choice",gen:function(r){return signItem(r,["+","−","×","÷"],2,12);}}
      }
    },
    stroop:{
      id:"stroop", icon:"🎨", skill:"attention",
      title:["Color Words","顏色字"], blurb:["Say the ink, not the word","看顏色不看字"],
      tiers:{
        tot :{items:10,clock:false,pad:"choice",gen:stroopTot},
        mid :{items:20,clock:true, pad:"choice",gen:function(r){return stroopWord(r,false);}},
        hard:{items:20,clock:true, pad:"choice",gen:function(r){return stroopWord(r,r()<0.5);}}
      }
    },
```

The `choices` for Stroop must render as words at `mid`/`hard` — the UI shows the raw key, so map it. In `brain-ui.js`'s choice branch, when `item.choiceStyle` is absent and `COLORS[c]` exists, render `COLORS[c][1]+" "+COLORS[c][2]` instead of the bare key.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/core.test.mjs && node scripts/check.mjs`
Expected: PASS both.

- [ ] **Step 5: Commit**

```bash
git add js/brain-data.js js/brain-ui.js scripts/core.test.mjs
git commit -m "feat(brain): add Sign Finder and Color Words"
```

---

## Task 4: Number Cruncher 數一數, Time Lapse 時鐘, Change Maker 找零錢

**Files:**
- Modify: `js/brain-data.js`
- Test: `scripts/core.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
test("Number Cruncher's answer equals the real count in the field", () => {
  const rnd = SQBrainCore.mulberry32(7);
  for (const tier of ["tot", "mid", "hard"]) {
    const round = SQBrainCore.buildRound("crunch", tier, rnd);
    for (const item of round.items) {
      const actual = item.prompt.glyphs.filter((g) => g === item.prompt.target).length;
      assert.equal(Number(item.answer), actual);
      assert.ok(actual >= 1, "never ask for a count of zero");
    }
  }
});

test("Time Lapse answers are valid 12-hour clock strings", () => {
  const rnd = SQBrainCore.mulberry32(13);
  for (const tier of ["tot", "mid", "hard"]) {
    const round = SQBrainCore.buildRound("clock", tier, rnd);
    for (const item of round.items) {
      assert.match(item.answer, /^([1-9]|1[0-2]):[0-5][0-9]$/);
      assert.ok(item.prompt.h >= 1 && item.prompt.h <= 12);
      assert.ok(item.prompt.m >= 0 && item.prompt.m <= 59);
      assert.ok(item.choices.indexOf(item.answer) >= 0);
    }
  }
});

test("Time Lapse tot only shows whole hours", () => {
  const round = SQBrainCore.buildRound("clock", "tot", SQBrainCore.mulberry32(2));
  for (const item of round.items) assert.equal(item.prompt.m, 0);
});

test("Change Maker never asks for negative change", () => {
  const rnd = SQBrainCore.mulberry32(17);
  for (const tier of ["mid", "hard"]) {
    const round = SQBrainCore.buildRound("change", tier, rnd);
    for (const item of round.items) {
      assert.ok(item.prompt.paid > item.prompt.price);
      assert.equal(Number(item.answer), item.prompt.paid - item.prompt.price);
    }
  }
});

test("Change Maker tot compares two coins and names the bigger one", () => {
  const round = SQBrainCore.buildRound("change", "tot", SQBrainCore.mulberry32(4));
  for (const item of round.items) {
    assert.equal(item.choices.length, 2);
    assert.equal(item.answer, String(Math.max(Number(item.choices[0]), Number(item.choices[1]))));
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/core.test.mjs`
Expected: FAIL — `unknown brain game: crunch`

- [ ] **Step 3: Implement in `js/brain-data.js`**

```js
  /* ---- 5. Number Cruncher 數一數 ---- */
  const CRUNCH_ANIMALS=["🐶","🐱","🐟","🐦","🐸","🐝"];
  function crunchItem(rnd,total,digits){
    const set=digits?["0","1","2","3","4","5","6","7","8","9"]:CRUNCH_ANIMALS;
    const target=pick(rnd,set);
    const count=intBetween(rnd,2,Math.max(3,Math.floor(total/4)));
    const others=set.filter(function(g){return g!==target;});
    const glyphs=[];
    for(let i=0;i<count;i++)glyphs.push(target);
    while(glyphs.length<total)glyphs.push(pick(rnd,others));
    return {
      prompt:{type:"countfield",glyphs:shuffleWith(rnd,glyphs),target:target,
        en:"How many "+target+" ?",zh:"有幾個 "+target+" ？"},
      say:["How many do you count?","數數看有幾個？"],
      answer:String(count),
      choices:numChoices(rnd,count,4,2)
    };
  }

  /* ---- 6. Time Lapse 時鐘 ---- */
  function hhmm(h,m){h=((h-1)%12+12)%12+1;return h+":"+(m<10?"0":"")+m;}
  function clockItem(rnd,step,addMin){
    const h=intBetween(rnd,1,12), m=step===0?0:intBetween(rnd,0,Math.floor(59/step))*step;
    const total=h*60+m+addMin;
    const ah=Math.floor(total/60), am=total%60;
    const answer=hhmm(ah,am);
    const wrong=[hhmm(ah+1,am),hhmm(ah,(am+15)%60),hhmm(ah-1,am),hhmm(ah,(am+30)%60)]
      .filter(function(v){return v!==answer;});
    return {
      prompt:{type:"clockface",h:h,m:m,
        en:addMin?"What time in "+addMin+" minutes?":"What time is it?",
        zh:addMin?addMin+"分鐘後是幾點？":"現在幾點？"},
      say:[addMin?"What time in "+addMin+" minutes?":"What time is it?",
        addMin?addMin+"分鐘後是幾點？":"現在幾點？"],
      answer:answer,
      choices:shuffleWith(rnd,[answer].concat(shuffleWith(rnd,wrong).slice(0,3)))
    };
  }

  /* ---- 7. Change Maker 找零錢 (NT$) ---- */
  const COINS=[1,5,10,50];
  const NOTES=[100,500];
  function moneyArt(n){
    /* a readable pile: notes then coins, biggest first */
    let left=n, out=[];
    NOTES.concat(COINS).sort(function(a,b){return b-a;}).forEach(function(v){
      while(left>=v){out.push(v>=100?"💵"+v:"🪙"+v);left-=v;}
    });
    return out.join(" ");
  }
  function changeTot(rnd){
    let a=pick(rnd,COINS), b=pick(rnd,COINS);
    while(b===a)b=pick(rnd,COINS);
    const big=Math.max(a,b);
    return {
      prompt:{type:"money",art:"🪙"+a+"   🪙"+b,
        en:"Which is worth more?",zh:"哪個比較多錢？"},
      say:["Which is worth more?","哪個比較多錢？"],
      answer:String(big), choices:shuffleWith(rnd,[String(a),String(b)])
    };
  }
  function changeItem(rnd,maxPrice,payOptions){
    const price=intBetween(rnd,3,maxPrice);
    const paid=pick(rnd,payOptions.filter(function(p){return p>price;}));
    return {
      prompt:{type:"money",price:price,paid:paid,art:moneyArt(paid),
        en:"It costs NT$"+price+". You pay NT$"+paid+". Change?",
        zh:"東西 NT$"+price+"，你付 NT$"+paid+"，找多少？"},
      answer:String(paid-price)
    };
  }
```

Add to `GAMES`:

```js
    crunch:{
      id:"crunch", icon:"🔍", skill:"attention",
      title:["Number Cruncher","數一數"], blurb:["Count them fast","快快數一數"],
      tiers:{
        tot :{items:8, clock:false,pad:"choice",gen:function(r){return crunchItem(r,8,false);}},
        mid :{items:10,clock:true, pad:"keypad",gen:function(r){return crunchItem(r,30,true);}},
        hard:{items:10,clock:true, pad:"keypad",gen:function(r){return crunchItem(r,60,true);}}
      }
    },
    clock:{
      id:"clock", icon:"🕐", skill:"logic",
      title:["Time Lapse","時鐘"], blurb:["Read the clock","看時鐘"],
      tiers:{
        tot :{items:8, clock:false,pad:"choice",gen:function(r){return clockItem(r,0,0);}},
        mid :{items:10,clock:true, pad:"choice",gen:function(r){return clockItem(r,5,0);}},
        hard:{items:10,clock:true, pad:"choice",gen:function(r){return clockItem(r,5,pick(r,[20,40,45,90]));}}
      }
    },
    change:{
      id:"change", icon:"💱", skill:"money",
      title:["Change Maker","找零錢"], blurb:["Count the change","算找零"],
      tiers:{
        tot :{items:8, clock:false,pad:"choice",gen:changeTot},
        mid :{items:10,clock:true, pad:"keypad",gen:function(r){return changeItem(r,45,[50,100]);}},
        hard:{items:10,clock:true, pad:"keypad",gen:function(r){return changeItem(r,480,[500,1000]);}}
      }
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/core.test.mjs && node scripts/check.mjs`
Expected: PASS both.

- [ ] **Step 5: Commit**

```bash
git add js/brain-data.js scripts/core.test.mjs
git commit -m "feat(brain): add Number Cruncher, Time Lapse and Change Maker"
```

---

## Task 5: Low to High 由小到大

**Files:**
- Modify: `js/brain-data.js`
- Test: `scripts/core.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
test("Low to High answers are the cells sorted ascending", () => {
  const rnd = SQBrainCore.mulberry32(21);
  for (const tier of ["tot", "mid", "hard"]) {
    const round = SQBrainCore.buildRound("lowhigh", tier, rnd);
    assert.equal(round.pad, "grid");
    for (const item of round.items) {
      const ns = item.prompt.cells.map((c) => c.n);
      assert.equal(new Set(ns).size, ns.length, "no duplicate numbers in a grid");
      assert.equal(item.answer, ns.slice().sort((a, b) => a - b).join(","));
      assert.ok(item.prompt.flashMs >= 1000);
    }
  }
});

test("Low to High grows with the tier", () => {
  const tot = SQBrainCore.buildRound("lowhigh", "tot", SQBrainCore.mulberry32(1));
  const hard = SQBrainCore.buildRound("lowhigh", "hard", SQBrainCore.mulberry32(1));
  assert.equal(tot.items[0].prompt.cells.length, 3);
  assert.equal(hard.items[0].prompt.cells.length, 7);
  assert.ok(tot.items[0].prompt.flashMs > hard.items[0].prompt.flashMs, "tot gets a longer look");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/core.test.mjs`
Expected: FAIL — `unknown brain game: lowhigh`

- [ ] **Step 3: Implement in `js/brain-data.js`**

```js
  /* ---- 3. Low to High 由小到大 ---- */
  function lowHighItem(rnd,count,max,flashMs){
    const seen={}, cells=[];
    while(cells.length<count){
      const n=intBetween(rnd,1,max);
      if(seen[n])continue;
      seen[n]=true; cells.push({n:n});
    }
    const sorted=cells.map(function(c){return c.n;}).sort(function(a,b){return a-b;});
    return {
      prompt:{type:"gridflash",cells:cells,flashMs:flashMs,
        en:"Remember, then tap smallest first",zh:"記住，然後從最小開始點"},
      say:["Remember these numbers","記住這些數字"],
      answer:sorted.join(",")
    };
  }
```

Add to `GAMES`:

```js
    lowhigh:{
      id:"lowhigh", icon:"🔢", skill:"memory",
      title:["Low to High","由小到大"], blurb:["Remember and order","記住再排序"],
      tiers:{
        tot :{items:5,clock:false,pad:"grid",gen:function(r){return lowHighItem(r,3,5,4000);}},
        mid :{items:5,clock:true, pad:"grid",gen:function(r){return lowHighItem(r,5,20,3000);}},
        hard:{items:5,clock:true, pad:"grid",gen:function(r){return lowHighItem(r,7,50,2500);}}
      }
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/core.test.mjs && node scripts/check.mjs`
Expected: PASS both.

- [ ] **Step 5: Commit**

```bash
git add js/brain-data.js scripts/core.test.mjs
git commit -m "feat(brain): add Low to High"
```

---

## Task 6: Word Memory 記單字

Reuses the existing `VOCAB` data rather than adding word content. `brain-data.js` cannot import `index.html`, so the word list is injected: `index.html` calls `SQBrainData.setWordPool(list)` once at boot, and the generator falls back to a small built-in list when nothing was injected (which is what the node tests exercise).

**Files:**
- Modify: `js/brain-data.js`, `index.html`
- Test: `scripts/core.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
test("Word Memory is one weighted item that grades partial recall", () => {
  const round = SQBrainCore.buildRound("wordmem", "mid", SQBrainCore.mulberry32(31));
  assert.equal(round.items.length, 1);
  const item = round.items[0];
  assert.equal(item.prompt.type, "wordlist");
  assert.equal(item.prompt.words.length, 8);
  assert.equal(item.worth, 8);
  assert.equal(typeof item.grade, "function");
  const half = item.prompt.words.slice(0, 4).join(" ");
  assert.equal(item.grade(half), 4);
  assert.equal(item.grade(half + " zebra unicorn"), 4, "wrong words never add points");
  assert.equal(item.grade(""), 0);
});

test("Word Memory grading is case- and separator-insensitive and ignores repeats", () => {
  const round = SQBrainCore.buildRound("wordmem", "mid", SQBrainCore.mulberry32(31));
  const item = round.items[0];
  const first = item.prompt.words[0];
  assert.equal(item.grade(first.toUpperCase() + ", " + first), 1);
});

test("Word Memory tot taps the missing emoji instead of typing", () => {
  const round = SQBrainCore.buildRound("wordmem", "tot", SQBrainCore.mulberry32(31));
  assert.equal(round.pad, "choice");
  for (const item of round.items) {
    assert.ok(item.choices.indexOf(item.answer) >= 0);
    assert.ok(item.prompt.words.indexOf(item.answer) >= 0);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/core.test.mjs`
Expected: FAIL — `unknown brain game: wordmem`

- [ ] **Step 3: Implement in `js/brain-data.js`**

```js
  /* ---- 8. Word Memory 記單字 ----
     Words are injected from index.html's VOCAB at boot; the fallback keeps
     this module standalone for node tests and for a config-less local run. */
  let WORD_POOL=["cat","dog","fish","bird","apple","water","house","book",
    "green","jump","friend","music","river","cloud","spoon","tiger"];
  const EMOJI_POOL=["🐱","🐶","🐟","🐦","🍎","💧","🏠","📚","🌳","⭐","🚗","🎈"];
  function setWordPool(list){if(list&&list.length>=12)WORD_POOL=list.slice();}

  function wordMemItem(rnd,count,studyMs){
    const words=shuffleWith(rnd,WORD_POOL.slice()).slice(0,count);
    const want={};
    words.forEach(function(w){want[w.toLowerCase()]=true;});
    return {
      prompt:{type:"wordlist",words:words,studyMs:studyMs,
        en:"Remember these words",zh:"記住這些單字"},
      worth:count,
      answer:words.join(" "),
      grade:function(given){
        const hit={};
        String(given).toLowerCase().split(/[^a-z']+/).forEach(function(w){
          if(w&&want[w])hit[w]=true;
        });
        return Object.keys(hit).length;
      }
    };
  }

  function wordMemTot(rnd){
    const shown=shuffleWith(rnd,EMOJI_POOL.slice()).slice(0,4);
    const missing=pick(rnd,shown);
    return {
      prompt:{type:"wordlist",words:shown,studyMs:4000,
        en:"Which one disappeared?",zh:"哪一個不見了？"},
      say:["Remember these pictures","記住這些圖片"],
      answer:missing,
      choices:shuffleWith(rnd,shown.slice())
    };
  }
```

Add to `GAMES` and export `setWordPool` in the api object:

```js
    wordmem:{
      id:"wordmem", icon:"🧠", skill:"memory",
      title:["Word Memory","記單字"], blurb:["Remember the words","記住單字"],
      tiers:{
        tot :{items:5,clock:false,pad:"choice",gen:wordMemTot},
        mid :{items:1,clock:true, pad:"type",gen:function(r){return wordMemItem(r,8,45000);}},
        hard:{items:1,clock:true, pad:"type",gen:function(r){return wordMemItem(r,12,60000);}}
      }
    },
```

- [ ] **Step 4: Inject the real word pool from `index.html`**

After the `VOCAB` constant is defined (near `index.html:515`), add:

```js
/* Word Memory reuses the vocab pack words — no second word list to maintain */
SQBrainData.setWordPool(Object.keys(VOCAB).reduce(function(acc,k){
  return acc.concat(VOCAB[k].words.map(function(w){return w[0];}));
},[]).filter(function(w){return /^[a-z]+$/.test(w);}));
```

The `/^[a-z]+$/` filter drops multi-word entries like `"ice cream"`, which would break the whitespace-split grader.

- [ ] **Step 5: Handle the tot variant in the UI**

`wordMemTot` shows 4 emoji, hides one, then asks which disappeared. In `mountWords`, when the item has `choices`, re-render the list after `studyMs` with the answer removed rather than replacing it with the prompt line:

```js
      setTimeout(function(){
        if(item.choices){
          host.innerHTML=item.prompt.words
            .filter(function(w){return w!==item.answer;})
            .map(function(w){return `<span class="bword">${w}</span>`;}).join("")
            +`<span class="bword bhidden">？</span>`;
          return;
        }
        host.innerHTML=`<span class="bsub">Now type what you remember 現在打出你記得的</span>`;
        const ta=o.querySelector("#bType");
        if(ta){ta.disabled=false;ta.focus();}
      },item.prompt.studyMs);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test scripts/core.test.mjs && node scripts/check.mjs`
Expected: PASS both.

- [ ] **Step 7: Commit**

```bash
git add js/brain-data.js js/brain-ui.js index.html scripts/core.test.mjs
git commit -m "feat(brain): add Word Memory reusing the vocab word pool"
```

---

## Task 7: Math Recall 記憶計算

The one game whose items depend on each other, so it uses the tier-level `build` from Task 1. Item 0 is a freebie worth 0 — the kid has nothing to recall yet.

**Files:**
- Modify: `js/brain-data.js`
- Test: `scripts/core.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
test("Math Recall asks for the previous answer and gives item 0 away", () => {
  for (const tier of ["tot", "mid", "hard"]) {
    const round = SQBrainCore.buildRound("recall", tier, SQBrainCore.mulberry32(41));
    assert.equal(round.items[0].worth, 0, `${tier}: first item must be a freebie`);
    for (let i = 1; i < round.items.length; i++) {
      assert.equal(round.items[i].answer, round.items[i - 1].shown,
        `${tier}: item ${i} must ask for item ${i - 1}'s value`);
    }
  }
});

test("Math Recall's freebie accepts anything", () => {
  const round = SQBrainCore.buildRound("recall", "mid", SQBrainCore.mulberry32(41));
  const out = SQBrainCore.scoreRound({
    items: round.items.slice(0, 1), answers: [""], ms: 0, clock: false,
  });
  assert.equal(out.total, 0);
  assert.equal(out.score, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/core.test.mjs`
Expected: FAIL — `unknown brain game: recall`

- [ ] **Step 3: Implement in `js/brain-data.js`**

```js
  /* ---- 9. Math Recall 記憶計算 ----
     Each screen shows a new sum but asks for the PREVIOUS one's value.
     Items depend on each other, so this tier builds the whole array. */
  function recallBuild(rnd,cfg){
    const out=[];
    for(let i=0;i<cfg.items;i++){
      let shown, en, zh;
      if(cfg.mode==="number"){
        shown=String(intBetween(rnd,1,9));
        en="Remember: "+shown; zh="記住："+shown;
      }else{
        const big=cfg.mode==="big";
        const a=intBetween(rnd,big?11:2,big?49:9), b=intBetween(rnd,big?11:2,big?49:9);
        shown=String(a+b); en=a+" + "+b+" = ?"; zh=a+" + "+b+" = ?";
      }
      const first=i===0;
      const item={
        shown:shown,
        prompt:{type:"text",
          en:first?en+"  (just remember it)":en+"  ← now answer the PREVIOUS one",
          zh:first?en+"（先記住）":en+"  ← 回答「上一題」"},
        say:first?["Just remember this one","先記住這一題"]:["Answer the one before","回答上一題"],
        answer:first?"":out[i-1].shown,
        worth:first?0:1
      };
      if(cfg.pad==="choice")item.choices=numChoices(rnd,Number(item.answer||shown),4,3);
      if(first)item.grade=function(){return 0;};
      out.push(item);
    }
    return out;
  }
```

Add to `GAMES`:

```js
    recall:{
      id:"recall", icon:"🔁", skill:"memory",
      title:["Math Recall","記憶計算"], blurb:["Answer the one before","回答上一題"],
      tiers:{
        tot :{items:6, clock:false,pad:"choice",mode:"number",build:recallBuild},
        mid :{items:10,clock:true, pad:"keypad",mode:"small", build:recallBuild},
        hard:{items:10,clock:true, pad:"keypad",mode:"big",   build:recallBuild}
      }
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/core.test.mjs && node scripts/check.mjs`
Expected: PASS both.

- [ ] **Step 5: Commit**

```bash
git add js/brain-data.js scripts/core.test.mjs
git commit -m "feat(brain): add Math Recall with dependent items"
```

---

## Task 8: mount all nine in the games grid

**Files:**
- Modify: `index.html:505` (`LEVELS`)

- [ ] **Step 1: Add the eight remaining `LEVELS` entries**

Beside the `calc` entry from slice 09:

```js
  signs:  {icon:"❓", title:"Sign Finder", tz:"找符號",   blurb:"Find the missing sign", brain:true},
  lowhigh:{icon:"🔢", title:"Low to High", tz:"由小到大", blurb:"Remember and order",    brain:true},
  stroop: {icon:"🎨", title:"Color Words", tz:"顏色字",   blurb:"Say the ink, not the word", brain:true},
  crunch: {icon:"🔍", title:"Number Cruncher", tz:"數一數", blurb:"Count them fast",     brain:true},
  clock:  {icon:"🕐", title:"Time Lapse", tz:"時鐘",      blurb:"Read the clock",        brain:true},
  change: {icon:"💱", title:"Change Maker", tz:"找零錢",  blurb:"Count the change",      brain:true},
  wordmem:{icon:"🧠", title:"Word Memory", tz:"記單字",   blurb:"Remember the words",    brain:true},
  recall: {icon:"🔁", title:"Math Recall", tz:"記憶計算", blurb:"Answer the one before", brain:true},
```

Every `LEVELS` key must equal its `SQBrainData.GAMES` id — slice 09's `startGame` branch dispatches on that.

- [ ] **Step 2: Confirm the LEVELS check still holds**

Slice 09 already added this rule to the BRAIN block of `scripts/check.mjs` — it now has to pass for all nine ids, which is the point:

```js
    if (!new RegExp(`\\b${id}\\s*:\\s*\\{[^}]*brain\\s*:\\s*true`).test(indexHtml)) {
      fail("BRAIN", `${id}: missing a LEVELS entry with brain:true in index.html`);
    }
```

No edit needed — if it fails, an id in `brain-data.js` has no `LEVELS` entry.

- [ ] **Step 3: Run the check**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed: ...`

- [ ] **Step 4: Manual smoke test, all nine, all three kids**

For each kid profile, open every brain tile and confirm:

| Check | Expected |
|---|---|
| Lucien, any game | no clock anywhere, prompt spoken aloud, targets big enough for a 4-year-old |
| Lili / Luis | count-up clock, harder content per the design table |
| Sign Finder | tapping the right operator advances; the equation is always true |
| Low to High | numbers flash, hide, buttons appear shuffled; tapping in order finishes the item |
| Color Words | at `mid`, the word and the ink disagree; the answer is the ink |
| Time Lapse | the clock hands match the stated time; `hard` asks "in 40 minutes" |
| Change Maker | NT$ amounts only, change is never negative |
| Word Memory | list shows for the study time, disappears, textarea unlocks; partial recall scores partially |
| Math Recall | first screen says "just remember it"; later screens ask for the previous value |
| Any game | a wrong answer shakes, shows the answer, continues — no red, no game over |

- [ ] **Step 5: Commit**

```bash
git add index.html scripts/check.mjs
git commit -m "feat(brain): add all nine brain games to the games grid"
```

---

## DONE WHEN

- `node scripts/check.mjs` is green.
- All nine games appear in every kid's games grid and are playable start to finish.
- Every `tot` tier is unclocked, spoken, and playable by a four-year-old who cannot read.
- Word Memory scores partial recall (7 of 8), and Math Recall's first item costs nothing.
- Removing any one tier from `brain-data.js` breaks nothing but that tier — no other file names a game id except `LEVELS`.
- Best scores land in `game_stats` as `brain_<id>` / `brain_<id>_ms`.
- No `?.`, `??`, or `.flatMap` anywhere in `js/` or `index.html`.
