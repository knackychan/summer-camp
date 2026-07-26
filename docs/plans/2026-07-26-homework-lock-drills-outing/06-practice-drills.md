# Slice 06 — Practice Drills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guided, **kid-paced** practice sessions (ballet for Lili, piano for Lili + Luis, rhythm for Lucien) in the 16:30 block, alternating date-seeded with the existing "Free — invent your own game" block. Spoken bilingual steps, piano metronome, **zero timers** (Papa's explicit decision — timers stress the kids).

**Architecture:** All drill data + pure rotation logic + practice UI + metronome live in one module `js/drills.js` (`SQDrills`), following the `sync.js` IIFE/window-global pattern with `module.exports` for tests. index.html hooks it into the 16:30 row in `renderMyDay`, into `announceBlock`, and extracts the tick handler into a shared `tickBlockDone(i)` so the drill "finish" button and the My Day tick button use one code path.

**Tech Stack:** Vanilla JS, Web Speech (existing `say()`), Web Audio metronome (no deps), `node:test`, `node scripts/check.mjs`.

**Read first:** `design.md` §4 + §6. **No per-step timers anywhere. No countdowns.**

**Prerequisites:** slice 01 (schedule stable) merged; slice 02 (SQTime + test file) merged.

**⚠ Concurrency:** another agent may be committing. Start clean and up to date; anchor by snippets, not line numbers.

---

### Task 1: `js/drills.js` — data + pure rotation, TDD

**Files:**
- Create: `js/drills.js`
- Modify: `scripts/core.test.mjs`

- [ ] **Step 1: Write the failing tests** (append to `scripts/core.test.mjs`)

```js
const SQDrills = require("../js/drills.js");

test("practice-day alternation is deterministic and roughly half", () => {
  const days = ["2026-07-27","2026-07-28","2026-07-29","2026-07-30","2026-07-31","2026-08-01","2026-08-02","2026-08-03"];
  const flags = days.map(d => SQDrills.isPracticeDay(d));
  assert.equal(new Set(days.map(d => SQDrills.isPracticeDay(d))).size <= 2, true);
  days.forEach(d => assert.equal(SQDrills.isPracticeDay(d), flags[days.indexOf(d)])); // stable
  const yes = flags.filter(Boolean).length;
  assert.ok(yes >= 2 && yes <= 6, `expected roughly half practice days, got ${yes}/8`);
});

test("sessionFor is deterministic per kid+date and respects DRILL_PLAN", () => {
  for (const kid of ["lucien","lili","luis"]) {
    const a = SQDrills.sessionFor(kid, "2026-07-28");
    const b = SQDrills.sessionFor(kid, "2026-07-28");
    assert.deepEqual(a, b);
    assert.ok(SQDrills.DRILL_PLAN[kid].includes(a.discipline));
    assert.ok(Array.isArray(a.drill.steps) && a.drill.steps.length >= 3);
  }
});

test("rotation varies across dates", () => {
  const picks = new Set(["2026-07-28","2026-07-30","2026-08-01","2026-08-03","2026-08-05","2026-08-07"]
    .map(d => JSON.stringify(SQDrills.sessionFor("lili", d))));
  assert.ok(picks.size >= 2, "same drill every practice day — rotation broken");
});

test("all drill steps are bilingual pairs", () => {
  for (const [disc, drills] of Object.entries(SQDrills.DRILLS)) {
    for (const drill of drills) {
      assert.ok(drill.name[0] && drill.name[1], `${disc} drill missing bilingual name`);
      for (const s of drill.steps)
        assert.ok(Array.isArray(s) && s.length === 2 && s[0] && s[1], `${disc}/${drill.name[0]} step not [en,zh]`);
    }
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/core.test.mjs`
Expected: FAIL — `Cannot find module '../js/drills.js'`

- [ ] **Step 3: Implement the data + pure half of `js/drills.js`**

```js
/* SQDrills — practice drills: data, seeded rotation, kid-paced session UI, metronome.
   NO per-step timers — Papa's decision (design.md §4): kids advance by tapping. */
(function(){
  const DRILL_PLAN={lucien:["rhythm"],lili:["ballet","piano"],luis:["piano"]};

  const DRILLS={
  ballet:[
   {name:["Barre basics 🩰","基礎把杆 🩰"],metronome:false,steps:[
     ["Stand tall, feet in first position","站直，腳擺第一位置"],
     ["8 slow pliés — knees over toes","慢慢蹲8次——膝蓋對準腳尖"],
     ["8 tendus each side — point that foot!","每邊擦地8次——腳尖繃直！"],
     ["4 relevés, hold 3 breaths on top","踮腳4次——上面停3個呼吸"],
     ["Finish with your favorite pose","用你最喜歡的姿勢結束"]]},
   {name:["Turns & balance 🌀","轉圈與平衡 🌀"],metronome:false,steps:[
     ["Warm up: 8 ankle circles each foot","熱身：每隻腳踝繞圈8次"],
     ["Passé balance — 3 breaths each leg","單腳passé平衡——每邊3個呼吸"],
     ["4 chaîné turns across the room","橫越房間做4個chaîné轉"],
     ["4 more back — spot the wall!","再轉4個回來——眼睛盯住牆上一點！"],
     ["Cool down: big slow port de bras","收操：大而慢的手臂動作"]]},
  ],
  piano:[
   {name:["Scales & steady hands 🎹","音階與穩定的手 🎹"],metronome:true,steps:[
     ["Sit tall, curved fingers, wrists relaxed","坐直，手指彎曲，手腕放鬆"],
     ["C scale, right hand — 5 times, slow and even","C大調音階右手——5次，慢而平均"],
     ["C scale, left hand — 5 times","C大調音階左手——5次"],
     ["Both hands together — 3 careful times","雙手一起——認真彈3次"],
     ["Play your current piece once, gently","把現在練的曲子輕輕彈一次"]]},
   {name:["My piece, my show 🎵","我的曲子我做主 🎵"],metronome:true,steps:[
     ["Warm up: 5 finger taps on each key, hand by hand","熱身：每隻手每個手指按鍵5下"],
     ["Play the TRICKY part of your piece 3 times, slowly","把曲子最難的地方慢慢彈3次"],
     ["Play the whole piece once","整首彈一次"],
     ["Once more — this time with feeling!","再一次——這次要有感情！"],
     ["Bow to your audience 🙇","向觀眾鞠躬 🙇"]]},
  ],
  rhythm:[
   {name:["Clap & march 🥁","拍手踏步 🥁"],metronome:true,steps:[
     ["March around the room like a drummer","像鼓手一樣繞房間踏步"],
     ["Clap this: slow-slow-fast-fast-slow","拍這個節奏：慢-慢-快-快-慢"],
     ["Stomp 8 times, tiptoe 8 times","跺腳8次，踮腳走8步"],
     ["Freeze dance: move, then FREEZE like a statue","木頭人：動一動，然後定住不動！"],
     ["Take a bow 🙇","鞠躬謝幕 🙇"]]},
   {name:["Animal dance 🦁","動物舞 🦁"],metronome:false,steps:[
     ["Stretch up tall like a giraffe","像長頸鹿一樣伸高高"],
     ["Stomp like an elephant, 8 steps","像大象一樣跺腳8步"],
     ["Tiptoe like a cat, quiet quiet","像貓咪一樣踮腳，安靜安靜"],
     ["Jump like a frog 5 times","像青蛙一樣跳5次"],
     ["Sleepy lion stretch to finish","最後像想睡的獅子伸懶腰"]]},
  ],
  };

  function dseed(str){let h=7;for(const c of str)h=(h*31+c.charCodeAt(0))>>>0;return h;}
  function isPracticeDay(dateStr){return dseed("practice"+dateStr)%2===0;}
  function sessionFor(kid,dateStr){
    const plan=DRILL_PLAN[kid];
    const discipline=plan[dseed(dateStr+kid+"disc")%plan.length];
    const list=DRILLS[discipline];
    return {discipline,drill:list[dseed(dateStr+kid+"drill")%list.length]};
  }

  const api={DRILL_PLAN,DRILLS,isPracticeDay,sessionFor};
  if(typeof window!=="undefined")window.SQDrills=Object.assign(window.SQDrills||{},api);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/core.test.mjs` → all PASS. (If the alternation test lands outside 2–6 for this 8-day window, adjust the seed salt string `"practice"` — the test window is fixed, the salt is free.)

- [ ] **Step 5: Commit**

```bash
git add js/drills.js scripts/core.test.mjs
git commit -m "feat: drill data and seeded rotation with tests"
```

---

### Task 2: Practice session UI + metronome (same file)

**Files:**
- Modify: `js/drills.js`
- Modify: `index.html` (CSS)

- [ ] **Step 1: Append the UI half inside the IIFE** (before the `const api=` line; browser-only, guarded):

```js
  /* ---------- session UI (browser only) ---------- */
  let met=null;
  function metronome(){ /* lazy singleton */
    if(met)return met;
    let ctx=null,intId=null,bpm=80;
    function click(){
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.frequency.value=1000;g.gain.value=0.12;
      o.connect(g);g.connect(ctx.destination);
      o.start();g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.06);
      o.stop(ctx.currentTime+0.07);
    }
    met={
      running:()=>!!intId,
      setBpm(v){bpm=v;if(intId){this.stop();this.start();}},
      start(){ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();
        if(ctx.state==="suspended")ctx.resume();
        this.stop();intId=setInterval(click,60000/bpm);click();},
      stop(){if(intId){clearInterval(intId);intId=null;}},
      bpm:()=>bpm,
    };
    return met;
  }

  function openSession(kid,dateStr,opts){ /* opts: {say, onFinish} injected by the page */
    const {discipline,drill}=sessionFor(kid,dateStr);
    let step=0;
    const o=document.createElement("div");
    o.className="overlay";o.id="drillOverlay";
    document.body.appendChild(o);
    function speak(){opts.say&&opts.say(drill.steps[step]);}
    function render(){
      const last=step===drill.steps.length-1;
      o.innerHTML=`<div class="card drillcard">
        <h3>${drill.name[0]}<span class="zht">${drill.name[1]}</span></h3>
        <div class="drilldots">${drill.steps.map((_,n)=>n<step?"●":n===step?"◉":"○").join(" ")}</div>
        <div class="drillstep">${drill.steps[step][0]}<span class="zhs">${drill.steps[step][1]}</span></div>
        ${drill.metronome?`<div class="metrow">
          ${[60,80,100].map(v=>`<button class="btn small metbpm ${metronome().bpm()===v?"on":""}" data-bpm="${v}">${v}</button>`).join("")}
          <button class="btn small" id="metToggle">${metronome().running()?"⏸ Metronome 節拍器":"▶ Metronome 節拍器"}</button>
        </div>`:""}
        <div class="vrow">
          ${step>0?`<button class="btn small" id="drillBack">← Back 上一步</button>`:""}
          <button class="btn" id="drillNext">${last?"Done! 完成！⭐":"Next 下一步 →"}</button>
        </div>
        <button class="btn small" id="drillQuit">Later 待會再練</button>
      </div>`;
      if(drill.metronome){
        o.querySelectorAll(".metbpm").forEach(b=>b.onclick=()=>{metronome().setBpm(+b.dataset.bpm);render();});
        o.querySelector("#metToggle").onclick=()=>{metronome().running()?metronome().stop():metronome().start();render();};
      }
      const back=o.querySelector("#drillBack");
      if(back)back.onclick=()=>{step--;render();speak();};
      o.querySelector("#drillNext").onclick=()=>{
        if(last){close();opts.onFinish&&opts.onFinish();return;}
        step++;render();speak();
      };
      o.querySelector("#drillQuit").onclick=close;
    }
    function close(){metronome().stop();o.remove();}
    render();speak();
  }
```

and extend the api line:

```js
  const api={DRILL_PLAN,DRILLS,isPracticeDay,sessionFor,openSession:typeof document!=="undefined"?openSession:undefined};
```

Note what is NOT here: no `setTimeout` advancing steps, no visible clock. Kid taps; that's the whole pacing model.

- [ ] **Step 2: CSS in index.html** (next to the pinpad styles):

```css
.drillcard{max-width:380px;text-align:center}
.drilldots{letter-spacing:.25em;margin:8px 0;opacity:.85}
.drillstep{font-size:1.25em;margin:14px 0;line-height:1.4}
.metrow{display:flex;gap:8px;justify-content:center;margin-bottom:10px}
.metbpm.on{background:var(--ok);color:#1c1436}
```

- [ ] **Step 3: Commit**

```bash
git add js/drills.js index.html
git commit -m "feat: kid-paced drill session UI with piano metronome"
```

---

### Task 3: Hook into the 16:30 block

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Script tag** — add `<script src="js/drills.js"></script>` after `papa-tools.js`.

- [ ] **Step 2: Extract the shared tick path.** In `renderMyDay()`, the `data-done` click handler holds the tick logic inline. Extract its body (from `const i=...` onward, minus the event plumbing) into a top-level function so the drill finish uses the identical star/sync/day-complete path:

```js
function tickBlockDone(i){
  const d2=dayState(hubKid);
  if(d2.done[i]){delete d2.done[i]; saveProgress(); renderMyDay(); return;} /* un-tick allowed */
  d2.done[i]=true;
  if(DAY[i].kind==="mission"){
    progress[hubKid].stars=(progress[hubKid].stars||0)+1;
    if(DAY[i].pool==="photo") progress[hubKid].missions=(progress[hubKid].missions||0)+1;
    sWin(); burst(16); star();
  } else { sGood(); }
  if(Object.keys(d2.done).length>=DAY.length){
    progress[hubKid].stars+=2; sWin(); burst(60); bigFloat("🌟");
  }
  saveProgress(); renderMyDay(); renderHubHead();
}
```

and the handler becomes `btn.onclick=()=>tickBlockDone(+btn.dataset.done);`. ⚠ By slice 05 this body may use `coveredCount(...)` and end with `refreshLockUI()` extras — **move whatever is there verbatim**; the refactor is cut-paste, not rewrite.

- [ ] **Step 3: Practice row.** Find the 16:30 block's index dynamically (do NOT hardcode 10):

```js
const PRACTICE_IDX=DAY.findIndex(b=>b.pool==="boredom");
```

(place it near `dayOverrides`). In `renderMyDay()`'s row loop, override the mission line for practice days. Where the row computes `const isDone=..., mis=missionFor(hubKid,i);` add:

```js
      const isPractice=i===PRACTICE_IDX&&SQDrills.isPracticeDay(todayStr());
```

then in the template, replace the mission-text branch usage for this row: where `b.kind==="mission"` renders `🎯 ${mis[0]}...`, wrap:

```js
${isPractice
  ?(()=>{const s=SQDrills.sessionFor(hubKid,todayStr());
     return `🎶 Practice: ${s.drill.name[0]}<span class="zhs">練習：${s.drill.name[1]}</span>
       ${!isDone?`<button class="btn small" data-drill="1">▶ Start practice 開始練習</button>`:""}`;})()
  :b.kind==="mission"
    ?`🎯 ${mis[0]}<span class="zhs">${mis[1]}</span>`
    :`${b.txt?b.txt[hubKid]:""}<span class="zhs">${b.txtz?b.txtz[hubKid]:""}</span>`}
```

Also swap the row's visible title on practice days — where `${b.icon} ${b.title}` renders:

```js
${isPractice?`🎶 Practice`:`${b.icon} ${b.title}`}<span class="zht">${isPractice?"練習時間":b.tz||""}</span>
```

And wire after the other button handlers:

```js
  document.querySelectorAll("#dayList [data-drill]").forEach(btn=>btn.onclick=()=>{
    SQDrills.openSession(hubKid,todayStr(),{
      say:pair=>{say(pair[0],"en-US");setTimeout(()=>say(pair[1],"zh-TW",true),1200);},
      onFinish:()=>{sWin();burst(30);tickBlockDone(PRACTICE_IDX);},
    });
  });
```

(`tickBlockDone` guards the double-tick case: if already done it would un-tick — so change the `onFinish` line to `onFinish:()=>{sWin();burst(30);if(!dayState(hubKid).done[PRACTICE_IDX])tickBlockDone(PRACTICE_IDX);}`.)

- [ ] **Step 4: Announcement.** In `announceBlock`, before computing `en`/`zh`, add:

```js
  if(i===PRACTICE_IDX&&SQDrills.isPracticeDay(todayStr())){
    sWin(); say("Practice time!","en-US"); setTimeout(()=>say("練習時間到了","zh-TW",true),900);
    return;
  }
```

- [ ] **Step 5: check.mjs validates drill data.** In `scripts/check.mjs`, after the existing data assertions add:

```js
try {
  const { createRequire } = await import("node:module");
  const requireCjs = createRequire(import.meta.url);
  const drills = requireCjs("../js/drills.js");
  for (const kid of ["lucien", "lili", "luis"]) {
    if (!Array.isArray(drills.DRILL_PLAN[kid]) || !drills.DRILL_PLAN[kid].length)
      fail("DRILLS", `DRILL_PLAN.${kid} missing`);
    drills.DRILL_PLAN[kid].forEach(d => { if (!drills.DRILLS[d]) fail("DRILLS", `discipline ${d} not in DRILLS`); });
  }
  for (const [disc, list] of Object.entries(drills.DRILLS))
    list.forEach((drill, di) => {
      if (!drill.name?.[0] || !drill.name?.[1]) fail("DRILLS", `${disc}[${di}] name must be bilingual`);
      drill.steps.forEach((s, si) => assertPair(s, `DRILLS.${disc}[${di}].steps[${si}]`));
    });
} catch (error) {
  fail("DRILLS load", error.message);
}
```

- [ ] **Step 6: Check + smoke**

Run: `node scripts/check.mjs` → green (drill assertions + full test suite).
Browser:
- On a practice day (check `SQDrills.isPracticeDay(todayStr())` in DevTools; if false, verify with tomorrow's date string instead): Lili's 16:30 row shows 🎶 Practice with her drill name and Start button; Lucien shows a rhythm drill; Luis piano.
- Start practice: steps advance ONLY on tap, each spoken EN then 中文; Back works; piano drill shows metronome, clicks at 60/80/100 offline; ballet/animal drills show no metronome.
- "Done! 完成！⭐" ticks the 16:30 block via the normal star path; reopening shows "Start practice" hidden (block done).
- On a non-practice day the 16:30 row is the normal "Free — invent your own game" mission, untouched.
- No timer or countdown visible anywhere in the flow.

- [ ] **Step 7: Commit**

```bash
git add index.html scripts/check.mjs
git commit -m "feat: practice drills alternate in the 16:30 block"
```

## DONE WHEN

- Practice alternates date-seeded with the free block, identical across devices; kid-paced spoken bilingual steps; piano metronome works offline; finish = tick + ledger star via the shared `tickBlockDone` path; drill data validated by `/check`; zero timers in the UI.
