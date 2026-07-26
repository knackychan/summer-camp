# Slice 02 — Dig Site ⛏️ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Excavator puzzle level: move on a 5×4 rock grid with a d-pad, DIG the rocks the task card asks for (letters / spelling / sums by age), 90-second runs with a synced best score.

**Architecture:** Same single-inline-script pattern as slice 01. DOM grid (no canvas needed — turn-based movement). Best score through the existing `stat` op.

**Tech Stack:** Vanilla JS (no `?.`, no `??`, no `flatMap`), CSS grid, existing `SyncStore`.

**Dependencies:** slice 01 (`01-city-drive.md`) merged — this slice edits the keyboard-hide line and `rint` helper it introduced. **DONE WHEN:** `node scripts/check.mjs` green + manual checklist in Task 5.

---

### Task 1: Registry + wiring

**Files:**
- Modify: `index.html` (`LEVELS`, `startGame`, `handleInput`, `keydown` listener)

- [ ] **Step 1: `LEVELS` entry** (after the `city` line):

```js
  dig:    {icon:"⛏️", title:"Dig Site", tz:"挖土工地",      blurb:"Dig the right rocks"},
```

- [ ] **Step 2: Dispatch** in `startGame`:

```js
  else if(lvl==="city") initCity();
  else if(lvl==="dig") initDig();
  else initOrc();
```

- [ ] **Step 3: Widen the keyboard-hide condition** from slice 01:

```js
  const noKb=(lvl==="city"||lvl==="dig");
```

- [ ] **Step 4: Route input.** In `handleInput`, after the `city` guard:

```js
  if(level==="city") return;
  if(level==="dig"){ if(ch===" ") digAct(); return; }
```

(Space already reaches `handleInput`; letters are ignored.)

- [ ] **Step 5: Arrow keys.** In the `keydown` listener, after the `city` block:

```js
  if(level==="dig"){
    if(e.key==="ArrowLeft"){e.preventDefault();digMove(0,-1);return;}
    if(e.key==="ArrowRight"){e.preventDefault();digMove(0,1);return;}
    if(e.key==="ArrowUp"){e.preventDefault();digMove(-1,0);return;}
    if(e.key==="ArrowDown"){e.preventDefault();digMove(1,0);return;}
  }
```

- [ ] **Step 6: Stub** after the City Drive block (replaced in Task 3):

```js
/* ---- MODE: DIG SITE (excavator puzzle) ---- */
function initDig(){}
function digMove(dr,dc){}
function digAct(){}
```

- [ ] **Step 7: Verify** — `node scripts/check.mjs` green; ⛏️ chip appears; empty stage, no errors.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat(dig): level registry, dispatch and input wiring"
```

---

### Task 2: Dig Site CSS

**Files:**
- Modify: `index.html` (style block, after the City Drive rules)

- [ ] **Step 1: Add:**

```css
/* ---------- DIG SITE ---------- */
.dg-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;max-width:520px;margin:10px auto 0}
.dg-cell{position:relative;aspect-ratio:1;background:#3a3160;border:2px solid var(--line);
  border-radius:10px;display:flex;align-items:center;justify-content:center}
.dg-cell.ex{border-color:var(--gold);box-shadow:0 0 10px rgba(255,201,60,.4)}
.dg-rock{position:relative;font-size:clamp(22px,5vw,34px)}
.dg-rock i{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-style:normal;font-family:'Fredoka';font-weight:700;font-size:clamp(13px,2.6vw,17px);
  color:#fff;text-shadow:0 1px 2px #000}
.dg-rock.clunk{animation:dgclunk .35s}
@keyframes dgclunk{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.dg-exv{position:absolute;font-size:clamp(26px,6vw,40px);z-index:2}
.dg-ctl{display:flex;justify-content:center;align-items:center;gap:18px;margin-top:10px}
.dg-pad{display:flex;align-items:center;gap:6px}
.dg-ud{display:flex;flex-direction:column;gap:6px}
.dbtn{width:52px;height:52px;font-size:22px;border-radius:12px;border:2px solid var(--line);
  background:var(--panel);color:var(--ink);touch-action:manipulation}
.dbtn:active{transform:translateY(2px)}
.dg-dig{height:64px;padding:0 22px;font-family:'Fredoka';font-weight:700;font-size:20px;
  border-radius:16px;border:2px solid var(--gold);background:var(--gold);color:#1c1436;
  touch-action:manipulation}
.dg-dig:active{transform:translateY(2px)}
```

- [ ] **Step 2: Verify** — `check.mjs` green.
- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(dig): grid, rock and d-pad styles"
```

---

### Task 3: Game code

**Files:**
- Modify: `index.html` — replace the Task 1 stub

- [ ] **Step 1: Full mode** (uses `rint` from slice 01):

```js
/* ---- MODE: DIG SITE (excavator puzzle) ---- */
const DG_COLS=5, DG_ROWS=4;
function initDig(){
  state={tasks:0,time:90,er:DG_ROWS-1,ec:0,rocks:[],task:null,need:0,sum:0,
    running:true,timer:null};
  document.getElementById("stage").innerHTML=
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
  document.querySelectorAll(".dbtn").forEach(b=>{
    b.onpointerdown=e=>{e.preventDefault();const d=b.dataset.d.split(",");digMove(+d[0],+d[1]);};
  });
  document.getElementById("dgDig").onpointerdown=e=>{e.preventDefault();digAct();};
  nextDigTask();
  digHud();
  state.timer=setInterval(digTick,1000);
}
function digHud(){
  hud([{k:"Time",v:state.time+"s",c:state.time<=10?"var(--bad)":KIDS[kid].raw},
       {k:"Tasks",v:state.tasks,c:KIDS[kid].raw},
       {k:"Best",v:bestOf(kid,"dig")}]);
}
function digPlace(items){
  const cells=[];
  for(let r=0;r<DG_ROWS;r++)for(let c=0;c<DG_COLS;c++)
    if(!(r===state.er&&c===state.ec)) cells.push([r,c]);
  const spots=shuffle(cells).slice(0,items.length);
  return items.map((it,i)=>Object.assign({r:spots[i][0],c:spots[i][1],dug:false},it));
}
function rockAt(r,c){
  for(let i=0;i<state.rocks.length;i++){const k=state.rocks[i];
    if(!k.dug&&k.r===r&&k.c===c) return k;}
  return null;
}
function drawDig(){
  const g=document.getElementById("dgGrid"); if(!g) return;
  let html="";
  for(let r=0;r<DG_ROWS;r++)for(let c=0;c<DG_COLS;c++){
    const k=rockAt(r,c), ex=(r===state.er&&c===state.ec);
    html+=`<div class="dg-cell${ex?' ex':''}">${ex?'<span class="dg-exv">🚜</span>':''}${
      k?`<span class="dg-rock" data-rc="${r}-${c}">🪨<i>${k.label}</i></span>`:''}</div>`;
  }
  g.innerHTML=html;
}
function nextDigTask(){
  const age=KIDS[kid].age;
  state.sum=0; state.need=0;
  if(age<=5){
    const letter=rand(Object.keys(LETTERS));
    const decoys=shuffle(Object.keys(LETTERS).filter(l=>l!==letter)).slice(0,5);
    state.task={kind:"letter",target:letter,left:3};
    state.rocks=digPlace([letter,letter,letter].concat(decoys).map(l=>({label:l,good:l===letter})));
    const em=LETTERS[letter].split(" ")[0];
    document.getElementById("dgCue").innerHTML=`⛏️ Dig all the <b>${letter}</b> rocks! 挖出所有 <b>${letter}</b>! ${em}`;
    say(letter);
  } else if(age<=8){
    const w=rand(WORDS_EASY.filter(x=>x[0].length<=4));
    const letters=w[0].toUpperCase().split("");
    const decoys=shuffle("BDFGKMPRSTW".split("").filter(l=>letters.indexOf(l)<0)).slice(0,4);
    state.task={kind:"spell",word:w[0],letters:letters};
    state.rocks=digPlace(letters.map((l,i)=>({label:l,ord:i})).concat(decoys.map(l=>({label:l}))));
    document.getElementById("dgCue").innerHTML=
      `⛏️ Dig <b>${letters.join("-")}</b> in order! 照順序挖出 <b>${w[0].toUpperCase()}</b>! ${w[1]}`;
    say(w[0]);
  } else {
    const parts=[2+rint(6),2+rint(6),2+rint(6)];
    const target=parts[0]+parts[1]+parts[2];
    const decoys=[1+rint(9),1+rint(9),1+rint(9)];
    state.task={kind:"sum",target:target};
    state.rocks=digPlace(parts.concat(decoys).map(n=>({label:String(n),val:n})));
    digSumCue();
  }
  drawDig();
}
function digSumCue(){
  document.getElementById("dgCue").innerHTML=
    `⛏️ Dig rocks that add up to <b>${state.task.target}</b>! 挖出加起來等於 <b>${state.task.target}</b> 的石頭! (${state.sum} so far 目前 ${state.sum})`;
}
function digMove(dr,dc){
  if(!state.running) return;
  const r=state.er+dr, c=state.ec+dc;
  if(r<0||c<0||r>=DG_ROWS||c>=DG_COLS){ sBad(); return; }
  state.er=r; state.ec=c; sGood(); drawDig();
}
function digClunk(){
  sBad(); flash("bad");
  const el=document.querySelector(`[data-rc="${state.er}-${state.ec}"]`);
  if(el){ el.classList.add("clunk"); setTimeout(drawDig,360); }
  hint("Clunk! Not that rock! 鏘! 不是這顆!");
}
function digGood(){ sGood(); flash("ok"); burst(6); }
function digTaskDone(){
  state.tasks++; sWin(); burst(16);
  if(state.task.kind==="spell") say(state.task.word);
  if(state.tasks>bestOf(kid,"dig")){ progress[kid].best.dig=state.tasks; }
  saveProgress(); digHud();
  hint("Task done! 完成任務!");
  setTimeout(()=>{ if(state.running) nextDigTask(); },1000);
}
function digAct(){
  if(!state.running) return;
  const k=rockAt(state.er,state.ec);
  if(!k){ sBad(); hint("No rock here! 這裡沒有石頭!"); return; }
  const t=state.task;
  if(t.kind==="letter"){
    if(k.good){ k.dug=true; t.left--; digGood(); say(k.label); if(t.left<=0){ drawDig(); digTaskDone(); return; } }
    else digClunk();
  } else if(t.kind==="spell"){
    if(k.ord===state.need){ k.dug=true; state.need++; digGood(); say(k.label);
      if(state.need>=t.letters.length){ drawDig(); digTaskDone(); return; } }
    else digClunk();
  } else {
    const next=state.sum+k.val;
    if(next===t.target){ k.dug=true; drawDig(); digGood(); digTaskDone(); return; }
    else if(next<t.target){ k.dug=true; state.sum=next; digGood(); digSumCue(); }
    else {
      state.sum=0; state.rocks.forEach(x=>{x.dug=false;});
      digClunk(); digSumCue();
      hint("Too much — rocks are back, start again! 太多了，石頭回來了，重新算!");
    }
  }
  drawDig();
}
function digTick(){
  if(!state.running) return;
  state.time--; digHud();
  if(state.time<=0) finishDig();
}
function finishDig(){
  state.running=false;
  if(state.timer) clearInterval(state.timer); state.timer=null;
  const prevBest=bestOf(kid,"dig");
  const isBest=state.tasks>=prevBest&&state.tasks>0;
  saveProgress(); burst(40);
  const ov=document.createElement("div"); ov.className="overlay";
  ov.innerHTML=`<div class="card">
    <h3 style="color:${KIDS[kid].color}">${isBest?"🏆 New best! 新紀錄!":"⛏️ Site closed! 收工了!"}</h3>
    <div class="big" style="color:${KIDS[kid].color}">${state.tasks}</div>
    <p>tasks done 完成的任務${isBest?"":` · best 最佳 ${prevBest}`}</p>
    <button class="btn" id="again" style="background:${KIDS[kid].raw};color:#1c1436">Dig again 再挖一次 ⛏️</button>
    <button class="btn small" id="ovhome" style="margin-left:8px">Heroes</button>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector("#again").onclick=()=>{ov.remove();initDig();};
  ov.querySelector("#ovhome").onclick=()=>{ov.remove();goHome();};
}
```

Note: like City Drive, the best updates on **every** completed task (`digTaskDone`), so an interrupted run keeps its best.

- [ ] **Step 2: Verify** — `check.mjs` green. Per kid: Lucien letter task (dig 3 targets, decoys clunk); Lili spell in order (out-of-order clunks); Luis sums (overshoot restores all rocks + resets running sum, cue shows running total). Arrows + Space work; d-pad + DIG work with touch; 90 s → overlay.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(dig): playable dig site with age-based tasks"
```

---

### Task 4: Best-score plumbing + sync — test first

**Files:**
- Modify: `index.html` (`newProg`, `normalizeProgressShape`)
- Test: `scripts/sync.test.mjs` (Test 1)
- Modify: `js/sync.js` (`ensureKid`, `hydrate`, `enqueueDiff`)

- [ ] **Step 1 (index.html):** extend both objects with `dig`:

```js
const newProg=()=>({stars:0,best:{balloon:0,race:0,orc:0,shop:0,city:0,dig:0},vocab:{},missions:0,day:{d:'',done:{},rr:{}}});
```

```js
    if(!P.best||typeof P.best!=="object")P.best={balloon:0,race:0,orc:0,shop:0,city:0,dig:0};
    if(P.best.shop==null)P.best.shop=0;
    if(P.best.city==null)P.best.city=0;
    if(P.best.dig==null)P.best.dig=0;
```

- [ ] **Step 2: Write the failing test.** In Test 1 of `scripts/sync.test.mjs`, after `after.lili.best.city = 7;` add:

```js
  after.lili.best.dig = 4;
```

and expect a third `stat`:

```js
  assert.deepEqual(types, ["actDone", "roll", "stars", "stars", "stat", "stat", "stat", "tick", "vocab"]);
```

- [ ] **Step 3: Run to verify it fails.** `node scripts/sync.test.mjs` → deepEqual mismatch (two `stat` ops).

- [ ] **Step 4: Implement in `js/sync.js`.**

`ensureKid`:

```js
    p.best.dig=p.best.dig||0;
```

`hydrate` + `enqueueDiff` whitelists both become:

```js
["balloon","race","orc","shop","city","dig"]
```

- [ ] **Step 5: Run tests.** `node scripts/sync.test.mjs` → both `ok -`; `node scripts/check.mjs` → green.

- [ ] **Step 6: Commit**

```bash
git add index.html js/sync.js scripts/sync.test.mjs
git commit -m "feat(dig): sync best_dig through game_stats"
```

---

### Task 5: Slice verification (DONE WHEN)

- [ ] `node scripts/check.mjs` green.
- [ ] Touch emulation: d-pad + DIG usable with thumbs (targets ≥52 px).
- [ ] All three task kinds behave per design; every string bilingual; wrong digs never punish (clunk + hint only).
- [ ] Online: new best syncs to `game_stats` (`dig` row), hydrates after reload.
- [ ] Wifi off: fully playable.
- [ ] Games-lock overlay appears during an unticked block (inherited).
- [ ] Escape mid-run exits clean (interval cleared by `stopArena`).
