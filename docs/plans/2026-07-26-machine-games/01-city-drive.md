# Slice 01 — City Drive 🏙️ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Free-roam top-down car game in a play-carpet city with arcade physics and four knowledge-mission types, for all three kids, with a synced best score.

**Architecture:** One new game mode inside the single inline script of `index.html` following the `initX()` / input-router / `finishX()` overlay pattern. Rendering is one `<canvas>` redrawn per rAF frame; world is a 26×20 tile string map + a building list. Best score plumbs through the existing `stat` op in `js/sync.js`.

**Tech Stack:** Vanilla JS (ES2017-safe: **no `?.`, no `??`, no `flatMap`** — `scripts/check.mjs` enforces), Canvas 2D, existing `SyncStore`.

**Dependencies:** none. **DONE WHEN:** `node scripts/check.mjs` green + manual checklist in Task 7 passes with touch emulation.

Line numbers refer to `index.html` at plan time; anchor on quoted code, not numbers.

---

### Task 1: Level registry + game-shell wiring

**Files:**
- Modify: `index.html` (`LEVELS` ~line 505, `startGame` ~line 1083, `handleInput` ~line 1746, `keydown` listener ~line 1887)

- [x] **Step 1: Add the `city` entry to `LEVELS`** (after the `machines` line):

```js
  machines:{icon:"🚜", title:"Big Machines", tz:"大機器",   blurb:"Race, dig & fly"},
  city:   {icon:"🏙️", title:"City Drive", tz:"城市開車",    blurb:"Drive & deliver"},
```

- [x] **Step 2: Dispatch in `startGame`.** Change

```js
  else if(lvl==="machines") initMachines();
  else initOrc();
```

to

```js
  else if(lvl==="machines") initMachines();
  else if(lvl==="city") initCity();
  else initOrc();
```

- [x] **Step 3: Hide keyboard + legend.** In `startGame`, directly after `buildKeyboard();` add:

```js
  const noKb=(lvl==="city");
  document.getElementById("kb").classList.toggle("hidden",noKb);
  document.getElementById("legend").classList.toggle("hidden",noKb);
```

(Slice 02 widens the condition to `lvl==="city"||lvl==="dig"`.)

- [x] **Step 4: Guard `handleInput`.** After the `machines` line add:

```js
  if(level==="machines"){ machinesInput(ch); return; }
  if(level==="city") return;
```

- [x] **Step 5: Held arrow keys.** In the global `keydown` listener, after the Escape check, add:

```js
  if(level==="city"&&state.keys){
    if(e.key==="ArrowLeft"){e.preventDefault();state.keys.l=true;return;}
    if(e.key==="ArrowRight"){e.preventDefault();state.keys.r=true;return;}
    if(e.key==="ArrowUp"){e.preventDefault();state.keys.g=true;return;}
  }
```

and next to it register a new `keyup` listener (there is none today):

```js
addEventListener("keyup",e=>{
  if(level!=="city"||!state.keys) return;
  if(e.key==="ArrowLeft") state.keys.l=false;
  if(e.key==="ArrowRight") state.keys.r=false;
  if(e.key==="ArrowUp") state.keys.g=false;
});
```

- [x] **Step 6: Temporary stub** so the file stays runnable until Task 4 (replaced there). Place after `machinesInput` (~line 1515), before the WORD WIZARD section:

```js
/* ---- MODE: CITY DRIVE (free-roam knowledge missions) ---- */
function initCity(){}
```

- [x] **Step 7: Verify** — `node scripts/check.mjs` green. Open `index.html` → any kid → Games: 🏙️ City Drive chip appears; clicking it shows an empty stage, no console errors, keyboard hidden.

- [x] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat(city): level registry, dispatch and input wiring"
```

---

### Task 2: City Drive CSS

**Files:**
- Modify: `index.html` (style block — add after the `/* ---------- ORC ATTACK ---------- */` rules)

- [x] **Step 1: Add the styles:**

```css
/* ---------- CITY DRIVE ---------- */
.cd-wrap{position:relative;height:min(52vh,430px);border-radius:16px;overflow:hidden;
  border:2px solid var(--line);margin-top:6px;touch-action:none}
.cd-wrap canvas{position:absolute;inset:0;width:100%;height:100%}
.cd-prompt{position:absolute;top:6px;left:50%;transform:translateX(-50%);max-width:92%;
  background:rgba(20,14,40,.82);border:2px solid var(--gold);border-radius:12px;padding:6px 12px;
  font-family:'Fredoka';font-weight:600;font-size:clamp(15px,3vw,20px);text-align:center;z-index:5}
.cd-btn{position:absolute;bottom:10px;width:64px;height:64px;border-radius:50%;z-index:6;
  display:flex;align-items:center;justify-content:center;font-size:28px;
  background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.4);color:#fff;
  user-select:none;-webkit-tap-highlight-color:transparent;touch-action:none}
.cd-btn:active{background:rgba(255,255,255,.3)}
.cd-l{left:12px}.cd-r{left:86px}
.cd-gas{right:12px;width:76px;height:76px;font-size:32px;background:rgba(61,220,151,.25);
  border-color:var(--ok,#3DDC97)}
```

- [x] **Step 2: Verify** — `node scripts/check.mjs` green.

- [x] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(city): map viewport, prompt and control styles"
```

---

### Task 3: World data + renderer (static scene)

**Files:**
- Modify: `index.html` — extend the Task 1 stub area

- [x] **Step 1: Add world data + helpers above `initCity`:**

```js
/* ---- MODE: CITY DRIVE (free-roam knowledge missions) ---- */
const CT=48, CITY_W=26, CITY_H=20;
const CITY_MAP=[
"GGGRGGGGGGGGGRGGGGGGGGRGGG",
"GGGRGGGGGGGGGRGGGGGGGGRGGG",
"GGGRGGGGGGGGGRGGGGGGGGRGGG",
"RRRRRRRRRRRRRRRRRRRRRRRRRR",
"GGGRGGGGGGGGGRGGGGGGGGRGGG",
"GGGRGGGGGGGGGRGGGGGGGGRGGG",
"GGGRGGGGGGGGGRGGGGGGGGRGGG",
"GGGRGGGGGGGGGRGGGGGGGGRGGG",
"GGGRGGGGGGGGGRGGGGGGGGRGGG",
"GGGRGGGGGGGGGRGGGGGGGGRGGG",
"RRRRRRRRRRRRRRRRRRRRRRRRRR",
"GGGRGGGGGGGGGRGGGGGGGGRGGG",
"GGGRGGWWWGGGGRGGGGGGGGRGGG",
"GGGRGGWWWGGGGRGGGGGGGGRGGG",
"GGGRGGGGGGGGGRGGGGGGGGRGGG",
"GGGRGGGGGGGGGRGGGGGGGGRGGG",
"RRRRRRRRRRRRRRRRRRRRRRRRRR",
"GGGRGGGGGGGGGRGGGGGGGGRGGG",
"GGGRGGGGGGGGGRGGGGGGGGRGGG",
"GGGRGGGGGGGGGRGGGGGGGGRGGG"];
const CITY_TREES=[[8,0],[20,6],[24,7],[1,9],[17,11],[4,18],[11,19]];
/* 2×2-tile plots; ids match ALL_WORDS entries; door = adjacent road tile */
const CITY_B=[
 {id:"school",  em:"🏫", x:5, y:1,  door:[5,3]},
 {id:"zoo",     em:"🦁", x:15,y:1,  door:[15,3]},
 {id:"market",  em:"🛒", x:23,y:1,  door:[23,3]},
 {id:"hospital",em:"🏥", x:5, y:4,  door:[5,3]},
 {id:"farm",    em:"🚜", x:1, y:4,  door:[3,4]},
 {id:"park",    em:"🌳", x:11,y:5,  door:[13,5]},
 {id:"castle",  em:"🏰", x:15,y:8,  door:[15,10]},
 {id:"church",  em:"⛪", x:9, y:11, door:[9,10]},
 {id:"hotel",   em:"🏨", x:19,y:11, door:[19,10]},
 {id:"museum",  em:"🖼️", x:5, y:14, door:[5,16]},
 {id:"police",  em:"👮", x:23,y:13, door:[22,13]},
 {id:"h1", em:"🏠", x:9, y:17, door:[9,16],  house:true},
 {id:"h2", em:"🏠", x:15,y:17, door:[15,16], house:true},
 {id:"h3", em:"🏠", x:19,y:17, door:[19,16], house:true}];
const CITY_PLOT=["#e8b04b","#d96f6f","#7fb0e0","#b48ede","#8fcf7a","#e0995f","#c9c9d9"];
function cityWord(id){
  for(let i=0;i<ALL_WORDS.length;i++) if(ALL_WORDS[i][0]===id) return ALL_WORDS[i];
  return [id,"❓","",""];
}
function cityTile(px,py){
  const x=Math.floor(px/CT), y=Math.floor(py/CT);
  if(x<0||y<0||x>=CITY_W||y>=CITY_H) return "X";
  for(let i=0;i<CITY_B.length;i++){const b=CITY_B[i];
    if(x>=b.x&&x<b.x+2&&y>=b.y&&y<b.y+2) return "B";}
  return CITY_MAP[y].charAt(x);
}
function doorXY(b){ return {x:b.door[0]*CT+CT/2, y:b.door[1]*CT+CT/2}; }
function rr(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
```

- [x] **Step 2: Add the renderer:**

```js
function cityDraw(){
  const ctx=state.ctx, vw=state.vw, vh=state.vh, car=state.car;
  const camX=Math.max(0,Math.min(car.x-vw/2,CITY_W*CT-vw));
  const camY=Math.max(0,Math.min(car.y-vh/2,CITY_H*CT-vh));
  ctx.save(); ctx.clearRect(0,0,vw,vh); ctx.translate(-camX,-camY);
  const x0=Math.floor(camX/CT), x1=Math.min(CITY_W-1,Math.ceil((camX+vw)/CT));
  const y0=Math.floor(camY/CT), y1=Math.min(CITY_H-1,Math.ceil((camY+vh)/CT));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const c=CITY_MAP[y].charAt(x);
    ctx.fillStyle=c==="R"?"#4c4c58":c==="W"?"#4EA8FF":((x+y)%2?"#57a05a":"#5daa60");
    ctx.fillRect(x*CT,y*CT,CT,CT);
    if(c==="R"){
      ctx.fillStyle="rgba(255,255,255,.55)";
      if(x>0&&x<CITY_W-1&&CITY_MAP[y].charAt(x-1)==="R"&&CITY_MAP[y].charAt(x+1)==="R")
        ctx.fillRect(x*CT+8,y*CT+CT/2-1,CT-16,2);
      if(y>0&&y<CITY_H-1&&CITY_MAP[y-1].charAt(x)==="R"&&CITY_MAP[y+1].charAt(x)==="R")
        ctx.fillRect(x*CT+CT/2-1,y*CT+8,2,CT-16);
    }
  }
  ctx.font="28px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
  CITY_TREES.forEach(t=>ctx.fillText("🌳",t[0]*CT+CT/2,t[1]*CT+CT/2));
  CITY_B.forEach((b,i)=>{
    ctx.fillStyle=CITY_PLOT[i%CITY_PLOT.length];
    rr(ctx,b.x*CT+3,b.y*CT+3,CT*2-6,CT*2-6,10); ctx.fill();
    ctx.font="40px serif"; ctx.fillText(b.em,b.x*CT+CT,b.y*CT+CT);
    if(state.signs&&state.signs[b.id]!=null){
      ctx.fillStyle="#fff"; rr(ctx,b.x*CT+CT-22,b.y*CT-14,44,24,6); ctx.fill();
      ctx.fillStyle="#1c1436"; ctx.font="700 15px Fredoka,sans-serif";
      ctx.fillText(String(state.signs[b.id]),b.x*CT+CT,b.y*CT-2);
    }
  });
  const m=state.m;
  if(m&&!m.done){
    const goal=(m.kind==="taxi"&&!m.picked)?m.pickup:m.target;
    if(goal){
      const d=doorXY(goal), pulse=6+4*Math.sin(performance.now()/220);
      ctx.strokeStyle="#FFC93C"; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(d.x,d.y,20+pulse,0,Math.PI*2); ctx.stroke();
      ctx.font="26px serif"; ctx.fillText("📍",d.x,d.y-34-pulse);
    }
    if(m.kind==="taxi"&&!m.picked){const d=doorXY(m.pickup);ctx.font="26px serif";ctx.fillText("🙋",d.x+18,d.y-14);}
    if(m.kind==="letters") m.spots.forEach((s,i)=>{
      if(i<m.i) return;
      ctx.globalAlpha=i===m.i?1:.35;
      ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(s.x,s.y,16,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#1c1436"; ctx.font="700 18px Fredoka,sans-serif"; ctx.fillText(s.ch,s.x,s.y+1);
      ctx.globalAlpha=1;
    });
  }
  ctx.save(); ctx.translate(car.x,car.y); ctx.rotate(car.h);
  ctx.fillStyle=KIDS[kid].raw; rr(ctx,-17,-10,34,20,6); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.75)"; rr(ctx,-4,-7,12,14,3); ctx.fill();
  ctx.fillStyle="#222"; ctx.fillRect(-14,-13,10,4); ctx.fillRect(4,-13,10,4);
  ctx.fillRect(-14,9,10,4); ctx.fillRect(4,9,10,4);
  ctx.restore(); ctx.restore();
}
```

- [x] **Step 3: Minimal `initCity` to see the scene** (replaced fully in Task 4 — only `state` + stage + one draw for now):

```js
function initCity(){
  state={score:0,mn:0,m:null,signs:null,running:true,raf:null,timer:null,
    keys:{l:false,r:false,g:false},
    car:{x:13*CT+CT/2,y:10*CT+CT/2,h:0,v:0}};
  document.getElementById("stage").innerHTML=
    `<div class="cd-wrap" id="cdWrap">
       <canvas id="cityCv"></canvas>
       <div class="cd-prompt" id="cdPrompt"></div>
       <div class="cd-btn cd-l" id="cdL">◀</div>
       <div class="cd-btn cd-r" id="cdR">▶</div>
       <div class="cd-btn cd-gas" id="cdGas">⚡</div>
     </div>
     <div class="msg" id="msg"></div>`;
  const wrap=document.getElementById("cdWrap"), cv=document.getElementById("cityCv");
  const dpr=window.devicePixelRatio||1;
  state.vw=wrap.clientWidth; state.vh=wrap.clientHeight;
  cv.width=state.vw*dpr; cv.height=state.vh*dpr;
  state.ctx=cv.getContext("2d"); state.ctx.scale(dpr,dpr);
  cityDraw();
}
```

- [x] **Step 4: Verify** — `node scripts/check.mjs` green. Open City Drive: carpet city renders (roads with dashes, pond, colored plots with emoji, trees), car visible at the center crossing.

- [x] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(city): tile world, buildings and canvas renderer"
```

---

### Task 4: Physics + controls + game loop

**Files:**
- Modify: `index.html` — extend `initCity`, add loop functions

- [x] **Step 1: Extend `initCity`.** After the canvas setup lines and before `cityDraw();`, add control listeners, age params and the loop/timer start:

```js
  const hold=(id,key)=>{
    const el=document.getElementById(id); if(!el) return;
    el.onpointerdown=e=>{e.preventDefault();state.keys[key]=true;};
    el.onpointerup=el.onpointercancel=el.onpointerout=()=>{state.keys[key]=false;};
  };
  hold("cdL","l"); hold("cdR","r"); hold("cdGas","g");
  const age=KIDS[kid].age;
  state.auto=age<=5;                       /* Lucien: auto-cruise, steer only */
  state.vmax=age<=5?120:age<=8?190:220;
  if(state.auto) document.getElementById("cdGas").style.display="none";
  state.time=state.auto?-1:180;            /* -1 = untimed free play */
  cityMission();
  cityHud();
  if(!state.auto) state.timer=setInterval(cityTick,1000);
  state.last=performance.now();
  state.raf=requestAnimationFrame(cityLoop);
```

(and keep the final `cityDraw();` call — first frame before the loop.)

- [x] **Step 2: Add loop + physics:**

```js
function cityHud(){
  const items=[];
  if(state.time>=0) items.push({k:"Time",v:state.time+"s",c:state.time<=10?"var(--bad)":KIDS[kid].raw});
  items.push({k:"Missions",v:state.score,c:KIDS[kid].raw});
  items.push({k:"Best",v:bestOf(kid,"city")});
  hud(items);
}
function cityLoop(now){
  if(!state.running) return;
  const dt=Math.min((now-state.last)/1000,0.05); state.last=now;
  const car=state.car, k=state.keys;
  const onGrass=cityTile(car.x,car.y)==="G";
  const cap=onGrass?state.vmax*0.45:state.vmax;
  if(state.auto||k.g) car.v=Math.min(car.v+300*dt,cap);
  else car.v*=Math.pow(0.15,dt);
  if(car.v>cap) car.v=cap;
  if(car.v>5){
    const dir=(k.l?-1:0)+(k.r?1:0);
    car.h+=dir*2.6*dt*(0.45+0.55*Math.min(car.v/state.vmax,1));
  }
  const nx=car.x+Math.cos(car.h)*car.v*dt, ny=car.y+Math.sin(car.h)*car.v*dt;
  const ahead=cityTile(nx+Math.cos(car.h)*14,ny+Math.sin(car.h)*14);
  if(ahead==="B"||ahead==="W"||ahead==="X"){ car.v*=-0.3; }
  else { car.x=nx; car.y=ny; }
  cityArrive();
  cityDraw();
  state.raf=requestAnimationFrame(cityLoop);
}
function cityTick(){
  if(!state.running) return;
  state.time--; cityHud();
  if(state.time<=0) finishCity();
}
```

- [x] **Step 3: Temporary stubs** so the file runs until Task 5 (replaced there):

```js
function cityMission(){}
function cityArrive(){}
function finishCity(){}
function cityPrompt(html){const el=document.getElementById("cdPrompt");if(el)el.innerHTML=html;}
```

- [x] **Step 4: Verify** — `check.mjs` green. Drive around with arrows and with touch buttons (DevTools touch emulation): car accelerates, turns, slows on grass, bounces softly off buildings/pond/edges; camera follows; Lucien has no GAS button and cruises by himself; Escape exits cleanly.

- [x] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(city): arcade physics, held controls and camera loop"
```

---

### Task 5: Missions engine

**Files:**
- Modify: `index.html` — replace the Task 4 stubs (`cityMission`, `cityArrive`, `finishCity`)

- [x] **Step 1: Question maker + mission generator:**

```js
function cityMathQ(age){
  let a,b,op;
  if(age<=8){
    if(Math.random()<0.6){op="+";a=1+rint(10);b=1+rint(10);}
    else {op="−";a=5+rint(15);b=1+rint(Math.min(a-1,9));}
  } else {
    const r=Math.random();
    if(r<0.4){op="×";a=2+rint(8);b=2+rint(8);}
    else if(r<0.7){op="+";a=10+rint(60);b=1+rint(30);}
    else {op="−";a=20+rint(79);b=1+rint(19);}
  }
  const val=op==="+"?a+b:op==="−"?a-b:a*b;
  return {text:a+" "+op+" "+b, val:val};
}
const rint=n=>Math.floor(Math.random()*n);
function cityLetterSpots(word){
  const roads=[];
  for(let y=0;y<CITY_H;y++)for(let x=0;x<CITY_W;x++)
    if(CITY_MAP[y].charAt(x)==="R") roads.push([x,y]);
  const cx=Math.floor(state.car.x/CT), cy=Math.floor(state.car.y/CT);
  const far=(a,bx,by)=>Math.abs(a[0]-bx)+Math.abs(a[1]-by)>=4;
  const pool=shuffle(roads), spots=[];
  for(let i=0;i<pool.length&&spots.length<word.length;i++){
    const c=pool[i]; let ok=far(c,cx,cy);
    for(let j=0;j<spots.length;j++) if(!far(c,spots[j][0],spots[j][1])) ok=false;
    if(ok) spots.push(c);
  }
  return spots.map((c,i)=>({x:c[0]*CT+CT/2,y:c[1]*CT+CT/2,ch:word.charAt(i)}));
}
function cityMission(){
  const age=KIDS[kid].age;
  const kinds=age<=5?["place","letters"]:age<=8?["place","deliver"]:["deliver","taxi","place"];
  const kind=kinds[state.mn%kinds.length]; state.mn++;
  state.m={kind:kind,done:false}; state.signs=null;
  if(kind==="place"){
    const pool=CITY_B.filter(b=>!b.house&&(age>5||["school","zoo","park","farm"].indexOf(b.id)>=0));
    const b=rand(pool), w=cityWord(b.id);
    state.m.target=b;
    cityPrompt(`${b.em} Drive to the <b>${w[0]}</b>! 開到${w[3]}!`);
    sayPair(w[0],w[2]);
  } else if(kind==="deliver"){
    const q=cityMathQ(age);
    const houses=shuffle(CITY_B.filter(b=>b.house));
    state.m.target=houses[0];
    const vals=[q.val];
    while(vals.length<3){
      const d=q.val+(1+rint(4))*(Math.random()<0.5?-1:1);
      if(d>0&&vals.indexOf(d)<0) vals.push(d);
    }
    state.signs={}; houses.forEach((h,i)=>{state.signs[h.id]=vals[i];});
    cityPrompt(`🍎 Deliver to house <b>${q.text}</b>! 送到 <b>${q.text}</b> 的房子!`);
  } else if(kind==="taxi"){
    const stops=shuffle(CITY_B.filter(b=>!b.house));
    state.m.pickup=stops[0]; state.m.target=stops[1]; state.m.picked=false;
    const pw=cityWord(stops[0].id);
    cityPrompt(`🙋 Pick up your passenger at the <b>${pw[0]}</b>! 去${pw[3]}接乘客!`);
    say("passenger at the "+pw[0]);
  } else { /* letters */
    const pool=WORDS_EASY.filter(x=>x[0].length===3);
    const w=rand(pool);
    state.m.word=w[0].toUpperCase(); state.m.i=0; state.m.em=w[1]; state.m.say=w[0];
    state.m.spots=cityLetterSpots(state.m.word);
    cityPrompt(`🔤 Collect <b>${state.m.word}</b>! 收集字母 ${state.m.word}! ${w[1]}`);
    say(w[0]);
  }
  cityHud();
}
```

- [x] **Step 2: Arrival / progress checks + completion:**

```js
function cityArrive(){
  const m=state.m, car=state.car;
  if(!m||m.done) return;
  const now=performance.now();
  if(m.kind==="letters"){
    const s=m.spots[m.i];
    if(s&&Math.hypot(car.x-s.x,car.y-s.y)<26){
      m.i++; sGood(); burst(6); say(s.ch);
      if(m.i>=m.spots.length){ say(m.say); cityComplete(); }
    }
    return;
  }
  const goal=(m.kind==="taxi"&&!m.picked)?m.pickup:m.target;
  const parked=b=>{const d=doorXY(b);return Math.abs(car.v)<45&&Math.hypot(car.x-d.x,car.y-d.y)<44;};
  if(m.kind==="deliver"){
    const others=CITY_B.filter(b=>b.house&&b.id!==m.target.id);
    for(let i=0;i<others.length;i++){
      if(parked(others[i])&&(!state.hintAt||now-state.hintAt>2500)){
        state.hintAt=now; sBad();
        hint(`That house is ${state.signs[others[i].id]} — try another! 那間是 ${state.signs[others[i].id]}，再試一間!`);
      }
    }
  }
  if(!parked(goal)) return;
  if(m.kind==="taxi"&&!m.picked){
    m.picked=true; sGood(); burst(8);
    const w=cityWord(m.target.id);
    cityPrompt(`💬 "Take me to the <b>${w[0]}</b>, please!" 「請帶我去${w[3]}!」`);
    sayPair("take me to the "+w[0],w[2]);
    return;
  }
  const w=cityWord(m.target.id);
  if(m.kind==="place"||m.kind==="taxi") sayPair(w[0],w[2]);
  cityComplete();
}
function cityComplete(){
  state.m.done=true; state.score++; sWin(); burst(16); flash("ok");
  hint("Great driving! 開得真好!");
  if(state.score>bestOf(kid,"city")){ progress[kid].best.city=state.score; }
  saveProgress(); cityHud();
  setTimeout(()=>{ if(state.running) cityMission(); },1400);
}
function finishCity(){
  state.running=false;
  if(state.raf) cancelAnimationFrame(state.raf); state.raf=null;
  if(state.timer) clearInterval(state.timer); state.timer=null;
  const prevBest=bestOf(kid,"city");
  const isBest=state.score>=prevBest&&state.score>0;
  saveProgress(); burst(40);
  const ov=document.createElement("div"); ov.className="overlay";
  ov.innerHTML=`<div class="card">
    <h3 style="color:${KIDS[kid].color}">${isBest?"🏆 New best! 新紀錄!":"🏁 Day over! 收工了!"}</h3>
    <div class="big" style="color:${KIDS[kid].color}">${state.score}</div>
    <p>missions done 完成的任務${isBest?"":` · best 最佳 ${prevBest}`}</p>
    <button class="btn" id="again" style="background:${KIDS[kid].raw};color:#1c1436">Drive again 再開一次 🚗</button>
    <button class="btn small" id="ovhome" style="margin-left:8px">Heroes</button>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector("#again").onclick=()=>{ov.remove();initCity();};
  ov.querySelector("#ovhome").onclick=()=>{ov.remove();goHome();};
}
```

Note: best updates on **every** completion (`cityComplete`), so Lucien's untimed session never loses a best; `finishCity` only runs for the timed kids.

- [x] **Step 3: Verify** — `check.mjs` green, then per kid:
  - Luis: deliver → taxi → place rotation; wrong house parks give the bilingual hint; taxi needs pickup then drop-off.
  - Lili: place/deliver alternation, math within 20.
  - Lucien: place (easy buildings) / letter-hunt alternation; letters collect in order only; no timer shown.
  - Timed kids reach 0 s → overlay; "Drive again" restarts; best survives reload.

- [x] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(city): knowledge missions (place, deliver, taxi, letters)"
```

---

### Task 6: Best-score plumbing + sync — test first

**Files:**
- Modify: `index.html` (`newProg` ~line 861, `normalizeProgressShape` ~line 879)
- Test: `scripts/sync.test.mjs` (Test 1, ~lines 68–76)
- Modify: `js/sync.js` (`ensureKid` ~line 63, `hydrate` ~line 169, `enqueueDiff` ~line 247)

- [x] **Step 1 (index.html):**

```js
const newProg=()=>({stars:0,best:{balloon:0,race:0,orc:0,shop:0,city:0},vocab:{},missions:0,day:{d:'',done:{},rr:{}}});
```

and in `normalizeProgressShape`:

```js
    if(!P.best||typeof P.best!=="object")P.best={balloon:0,race:0,orc:0,shop:0,city:0};
    if(P.best.shop==null)P.best.shop=0;
    if(P.best.city==null)P.best.city=0;
```

- [x] **Step 2: Write the failing test.** In Test 1 of `scripts/sync.test.mjs`, after `after.lili.best.race = 42;` add:

```js
  after.lili.best.city = 7;
```

and change the expected types to include a second `stat`:

```js
  assert.deepEqual(types, ["actDone", "roll", "stars", "stars", "stat", "stat", "tick", "vocab"]);
```

- [x] **Step 3: Run it to make sure it fails.**

Run: `node scripts/sync.test.mjs`
Expected: FAIL (deepEqual mismatch — only one `stat` op) because `city` isn't in the whitelists yet.

- [x] **Step 4: Implement in `js/sync.js`.**

`ensureKid` — after `p.best.shop=p.best.shop||0;`:

```js
    p.best.city=p.best.city||0;
```

`hydrate` whitelist:

```js
        if(["balloon","race","orc","shop","city"].includes(r.stat)) p[r.kid_id].best[r.stat]=r.value||0;
```

`enqueueDiff` list:

```js
        ["balloon","race","orc","shop","city"].forEach(stat=>{
```

- [x] **Step 5: Run tests to verify they pass.**

Run: `node scripts/sync.test.mjs` → both `ok -` lines.
Run: `node scripts/check.mjs` → green (re-runs sync tests).

- [x] **Step 6: Commit**

```bash
git add index.html js/sync.js scripts/sync.test.mjs
git commit -m "feat(city): sync best_city through game_stats"
```

---

### Task 7: Slice verification (DONE WHEN)

- [x] `node scripts/check.mjs` green.
- [x] Touch emulation: two-thumb play works (steer left thumb + GAS right thumb simultaneously — distinct pointers).
- [x] All three kids: mission mix matches the design table; every prompt bilingual; audio speaks EN (+FR for vocab words).
- [x] Wrong choices never punish: wrong house = hint only, wrong letter = ignored, off-road = slow only.
- [ ] With `js/config.js` + online: set a new best, reload → Best hydrates; Supabase `game_stats` has a `city` row.
- [x] Wifi off: fully playable, best persists locally.
- [x] During an unticked activity block, opening City Drive shows the lock overlay (inherited).
- [x] Escape / ← mid-run: no console errors, rAF and interval cleared (`stopArena`).
