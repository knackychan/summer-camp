# Slice 03 — Hybrid Activity Lock Implementation Plan

> **Superseded 2026-08-03 (Papa):** the unticked-activity-block lock described below was removed. Games are now free all day by default; only a Papa redo send-back and the Brain Gym gate still lock them automatically, plus Papa's general Games category-lock toggle in admin.html. This slice's history (the PIN pad, the `family_settings` admin PIN, the redo mechanism) is otherwise still live — see `js/lock-core.js` for the current rule.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Games become unplayable while a scheduled activity block is current and unticked (with overrun linger), unlockable by tick, pass, or Papa's 4-digit PIN. Guides, Learn, My Day, ask channel never lock.

**Architecture:** Pure decision logic in `js/lock-core.js` (`SQLock`, node-tested). Reusable PIN pad in `js/pinpad.js` (`SQPin`). Admin PIN lives in a new `family_settings` table, hydrated by sync.js and cached in localStorage for offline. index.html enforces at two choke points: `startGame()` and the games tab render, plus the 5s timeline watcher.

**Tech Stack:** Vanilla JS, Supabase (anon client, RLS), `node:test`, `node scripts/check.mjs`.

**Read first:** `design.md` §2 + §6. Tone rules from `CLAUDE.md`: the lock **invites, never shames** — no red, no countdowns.

**Prerequisites:** slice 02 merged (SQTime, `dayOverrides`, core.test.mjs). P2 passes landed (`passFor` exists in index.html).

**⚠ Concurrency:** another agent may be committing. Start clean and up to date; anchor by snippets, not line numbers.

---

### Task 1: `family_settings` table + sync hydration of the admin PIN

**Files:**
- Modify: `supabase/schema.sql` (append)
- Modify: `js/sync.js`
- Modify: `admin.html`, `js/admin.js`

- [ ] **Step 1: Append to `supabase/schema.sql`**

```sql
-- ============================================================
-- v3 additions — lock / reschedule / outing (plans 2026-07-26)
-- ============================================================

-- Family-wide settings (admin PIN etc). Plaintext by design — toddler lock, not security.
create table if not exists family_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz default now()
);
alter table family_settings enable row level security;
create policy "read settings"  on family_settings for select using (true);
create policy "admin settings" on family_settings for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Apply it** via the Supabase MCP (or SQL editor). Verify: `select * from family_settings;` succeeds.

- [ ] **Step 3: Hydrate + cache in `js/sync.js`**

In `hydrate()`, add to the `Promise.all` array (after the `photos` fetch):

```js
        this.supabase.from("family_settings").select("key,value"),
```

and add the matching name `{data:famSettings}` at the END of the positional destructuring list (order must match). After the `this.photos=photos||[];` line add:

```js
      this.familySettings={};
      (famSettings||[]).forEach(r=>{this.familySettings[r.key]=r.value;});
      this.adminPin=this.familySettings.admin_pin||"";
      saveJson("sq:adminPin",this.adminPin);
```

In the constructor, add an offline fallback next to `this.kidPins=...`:

```js
      this.adminPin=loadJson("sq:adminPin","");
```

(`loadJson`/`saveJson` already exist.)

- [ ] **Step 4: Admin UI to set the PIN**

`admin.html`: inside the settings panel that `renderPins` fills (search for the kid PIN section), add below the kid PIN controls:

```html
<div class="field">
  <label class="label" for="adminPin">Papa PIN (lock override) 爸爸密碼</label>
  <input class="input" id="adminPin" inputmode="numeric" maxlength="4" pattern="\d{4}" placeholder="4 digits 四位數">
</div>
<button class="btn" id="saveAdminPinBtn">Save Papa PIN 儲存爸爸密碼</button>
<p class="message message--ok" id="adminPinStatus"></p>
```

`js/admin.js`: follow the `savePin` pattern — add:

```js
  async function saveAdminPin(){
    const v=$("adminPin").value.trim();
    if(!/^\d{4}$/.test(v)){$("adminPinStatus").textContent="4 digits please 請輸入四位數";return;}
    const {error}=await client.from("family_settings").upsert({key:"admin_pin",value:v,updated_at:new Date().toISOString()});
    $("adminPinStatus").textContent=error?error.message:"Saved 已儲存 ✓";
  }
```

and wire `$("saveAdminPinBtn").onclick=saveAdminPin;` where the other dashboard buttons are wired.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql js/sync.js js/admin.js admin.html
git commit -m "feat: family_settings table with Papa PIN, synced and cached"
```

---

### Task 2: `js/lock-core.js` with tests

**Files:**
- Create: `js/lock-core.js`
- Modify: `scripts/core.test.mjs`

- [ ] **Step 1: Write the failing tests** (append to `scripts/core.test.mjs`)

```js
const SQLock = require("../js/lock-core.js");

const LDAY = [
  { t: "8:00",  title: "Wake",               tz: "起床" },
  { t: "10:00", title: "Homework",           tz: "暑假作業" },
  { t: "11:15", title: "Screen #1 — earned", tz: "螢幕#1" },
  { t: "12:00", title: "Lunch",              tz: "午餐" },
  { t: "✨",    title: "Bonus",              tz: "加碼" },
];
const noPass = () => false;
const lock = (now, done, passOk = noPass, overrides = {}) =>
  SQLock.computeLock({ day: LDAY, overrides, now, done, passOk });

test("locked during unticked activity block", () => {
  assert.deepEqual(lock(10 * 60 + 30, {}), { locked: true, blockIdx: 1 });
});

test("unlocked once current activity ticked", () => {
  assert.deepEqual(lock(10 * 60 + 30, { 1: true }), { locked: false, blockIdx: null });
});

test("pass on current block unlocks", () => {
  assert.deepEqual(lock(10 * 60 + 30, {}, i => i === 1), { locked: false, blockIdx: null });
});

test("overrun linger: screen block current, previous activity unticked", () => {
  assert.deepEqual(lock(11 * 60 + 30, { 0: true }), { locked: true, blockIdx: 1 });
  assert.deepEqual(lock(11 * 60 + 30, { 0: true, 1: true }), { locked: false, blockIdx: null });
});

test("current activity governs alone even if earlier one unticked", () => {
  // lunch current + ticked, homework never ticked → unlocked (current governs)
  assert.deepEqual(lock(12 * 60 + 10, { 3: true }), { locked: false, blockIdx: null });
  // lunch current + unticked → locked by lunch, not homework
  assert.deepEqual(lock(12 * 60 + 10, {}), { locked: true, blockIdx: 3 });
});

test("before first block: unlocked", () => {
  assert.deepEqual(lock(6 * 60, {}), { locked: false, blockIdx: null });
});

test("override moves the governing block", () => {
  // homework moved to 15:00 → at 10:30 current is Wake(0)
  assert.deepEqual(lock(10 * 60 + 30, {}, noPass, { 1: "15:00" }), { locked: true, blockIdx: 0 });
  assert.deepEqual(lock(10 * 60 + 30, { 0: true }, noPass, { 1: "15:00" }), { locked: false, blockIdx: null });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/core.test.mjs`
Expected: FAIL — `Cannot find module '../js/lock-core.js'`

- [ ] **Step 3: Implement `js/lock-core.js`**

```js
/* SQLock — pure games-lock decision. Rule (design.md §2):
   - current timed block is an activity (= not a Screen block) → it alone governs: done/passed → unlocked
   - current is a Screen block → linger: the most recent past activity block governs
   - before any block → unlocked
   Depends on SQTime (window or require). */
(function(){
  const SQT=typeof window!=="undefined"?window.SQTime:require("./time-core.js");
  function isScreenBlock(b){return String((b&&b.title)||"").includes("Screen");}
  function computeLock(ctx){
    const past=SQT.timedOrder(ctx.day,ctx.overrides||{}).filter(x=>x.t<=ctx.now);
    const free=i=>!!(ctx.done&&ctx.done[i])||!!(ctx.passOk&&ctx.passOk(i));
    const verdict=i=>free(i)?{locked:false,blockIdx:null}:{locked:true,blockIdx:i};
    if(!past.length)return {locked:false,blockIdx:null};
    const cur=past[past.length-1];
    if(!isScreenBlock(ctx.day[cur.i]))return verdict(cur.i);
    for(let n=past.length-2;n>=0;n--){
      if(!isScreenBlock(ctx.day[past[n].i]))return verdict(past[n].i);
    }
    return {locked:false,blockIdx:null};
  }
  const api={computeLock,isScreenBlock};
  if(typeof window!=="undefined")window.SQLock=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/core.test.mjs` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add js/lock-core.js scripts/core.test.mjs
git commit -m "feat: pure lock-core decision module with tests"
```

---

### Task 3: `js/pinpad.js` — the one Papa PIN pad

**Files:**
- Create: `js/pinpad.js`
- Modify: `index.html` (CSS only)

- [ ] **Step 1: Implement** (reuses the app's `.overlay`/`.card`/`.btn` classes; no lockout, gentle shake on wrong PIN):

```js
/* SQPin — the single Papa PIN pad. SQPin.show({title,subtitle,onOk}).
   Verifies against the synced admin PIN (localStorage 'sq:adminPin' via sync.js). */
(function(){
  function adminPin(){
    try{return JSON.parse(localStorage.getItem("sq:adminPin"))||"";}catch(e){return "";}
  }
  function show(opts){
    const pin=adminPin();
    if(!pin){alert("Papa PIN not set yet — set it in the admin dashboard.\n還沒有設定爸爸密碼——請在管理頁設定。");return;}
    let entered="";
    const o=document.createElement("div");
    o.className="overlay";
    o.innerHTML=`<div class="card pincard">
      <h3>${opts.title||"Papa only 只限爸爸"}</h3>
      ${opts.subtitle?`<p>${opts.subtitle}</p>`:""}
      <div class="pindots" id="pinDots">○ ○ ○ ○</div>
      <div class="pingrid">
        ${[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map(d=>d===""
          ?`<span></span>`
          :`<button class="btn pinkey" data-k="${d}">${d}</button>`).join("")}
      </div>
      <button class="btn small" id="pinCancel">Cancel 取消</button>
    </div>`;
    document.body.appendChild(o);
    const dots=()=>o.querySelector("#pinDots").textContent=
      [0,1,2,3].map(n=>n<entered.length?"●":"○").join(" ");
    o.querySelector("#pinCancel").onclick=()=>o.remove();
    o.querySelectorAll(".pinkey").forEach(b=>b.onclick=()=>{
      const k=b.dataset.k;
      if(k==="⌫"){entered=entered.slice(0,-1);dots();return;}
      if(entered.length>=4)return;
      entered+=k;dots();
      if(entered.length===4){
        if(entered===pin){o.remove();opts.onOk&&opts.onOk();}
        else{
          const card=o.querySelector(".pincard");
          card.classList.add("shake");
          setTimeout(()=>{card.classList.remove("shake");entered="";dots();},450);
        }
      }
    });
  }
  window.SQPin={show};
})();
```

- [ ] **Step 2: Add the CSS** next to the existing `.overlay`/`.card` rules in index.html:

```css
.pincard{text-align:center;max-width:280px}
.pindots{font-size:1.6em;letter-spacing:.3em;margin:10px 0}
.pingrid{display:grid;grid-template-columns:repeat(3,64px);gap:10px;justify-content:center;margin-bottom:12px}
.pinkey{font-size:1.3em;min-height:52px}
.shake{animation:pinshake .4s}
@keyframes pinshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
```

Tap targets ≥52px — tablet-first rule from CLAUDE.md.

- [ ] **Step 3: Commit**

```bash
git add js/pinpad.js index.html
git commit -m "feat: shared Papa PIN pad component"
```

---

### Task 4: Enforce the lock in index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Script tags** — extend the loader block to:

```html
<script src="js/config.js"></script>
<script src="js/sync.js"></script>
<script src="js/day-data.js"></script>
<script src="js/time-core.js"></script>
<script src="js/lock-core.js"></script>
<script src="js/pinpad.js"></script>
<script>
```

- [ ] **Step 2: Lock state helpers** — add after the `timelineInfo` wrapper:

```js
/* ---- games lock (design.md §2): coach, not cop — invite, never shame ---- */
let lockOverride=null; /* {day,blockIdx} — Papa PIN unlock, rest of that block only */
function activeKid(){return hubKid||((typeof kid!=="undefined")&&kid)||null;}
function passOkFor(id,i){return !!(id&&passFor(id,i,["granted","spent"]));}
function gameLockState(){
  const id=activeKid();
  const done=id?dayState(id).done:{};
  const st=SQLock.computeLock({day:DAY,overrides:dayOverrides,now:nowMins(),done,passOk:i=>passOkFor(id,i)});
  if(st.locked&&lockOverride&&lockOverride.day===todayStr()&&lockOverride.blockIdx===st.blockIdx)
    return {locked:false,blockIdx:null};
  if(!st.locked)lockOverride=null; /* override expires with its block */
  return st;
}
```

First verify the profile global's real name (`grep -n "sq:kid" index.html` and check what variable it feeds) and adjust `activeKid()` if it isn't `kid`. With no profile selected, `done={}` — games stay locked during activity time until a kid opens their hub and ticks; that's intended.

- [ ] **Step 3: Lock overlay** — add near `bigFloat`:

```js
function showLockOverlay(blockIdx){
  if(document.getElementById("lockOverlay"))return;
  const b=DAY[blockIdx];
  const o=document.createElement("div");
  o.className="overlay";o.id="lockOverlay";
  o.innerHTML=`<div class="card" style="text-align:center;max-width:340px">
    <div style="font-size:2.2em">${b.icon}</div>
    <h3>It's ${b.title.split("—")[0].trim()} time! ${(b.tz||"").split("——")[0].split("（")[0]}時間到了！</h3>
    <p>Games are resting 遊戲休息中 😌<br>Finish the activity, then tick it in My Day! 完成活動後在「我的一天」打勾！</p>
    <div class="vrow">
      <button class="btn" id="lockGoDay">📅 My Day 我的一天</button>
      <button class="btn small" id="lockPapa">🔧 Papa 爸爸</button>
    </div>
  </div>`;
  document.body.appendChild(o);
  o.querySelector("#lockGoDay").onclick=()=>{o.remove();if(hubKid){hubTab="day";renderHub();}};
  o.querySelector("#lockPapa").onclick=()=>{
    SQPin.show({title:"Unlock games 解鎖遊戲",subtitle:"Rest of this block only 只到這個時段結束",
      onOk:()=>{lockOverride={day:todayStr(),blockIdx};o.remove();refreshLockUI();}});
  };
}
```

- [ ] **Step 4: Choke point 1 — `startGame`**

At the very top of `function startGame(id,lvl){`, insert:

```js
  const ls=gameLockState();
  if(ls.locked){showLockOverlay(ls.blockIdx);return;}
```

- [ ] **Step 5: Choke point 2 — the games tab**

In `renderHub()`, after the `tab-*` visibility toggles, add `refreshLockUI();` and define (near `renderHub`):

```js
function refreshLockUI(){
  const tab=document.getElementById("tab-games");
  if(!tab)return;
  const ls=gameLockState();
  let card=document.getElementById("gamesLockCard");
  if(ls.locked&&hubTab==="games"){
    if(!card){
      card=document.createElement("div");
      card.id="gamesLockCard";card.className="dayhero";
      tab.prepend(card);
    }
    const b=DAY[ls.blockIdx];
    card.innerHTML=`${b.icon} It's ${b.title.split("—")[0].trim()} time — games are resting 遊戲休息中。
      Tick it in My Day to unlock! 在「我的一天」打勾就能解鎖！`;
    tab.classList.add("gameslocked");
  }else{
    if(card)card.remove();
    tab.classList.remove("gameslocked");
  }
}
```

CSS — inspect `tab-games`' inner markup first (`grep -n -A 5 'id="tab-games"' index.html`); if the game buttons have no single wrapper, wrap them in `<div class="gamegrid">…</div>`, then:

```css
.gameslocked .gamegrid{display:none}
```

- [ ] **Step 6: Watcher + mid-game transition**

In `startTimelineWatcher()`'s inner `tick`, after the block-change `if`, add (runs every 5s):

```js
    const ls=gameLockState();
    if(ls.locked&&!document.getElementById("game").classList.contains("hidden")){
      goHome();showLockOverlay(ls.blockIdx);
    }
    if(hubKid&&hubTab==="games")refreshLockUI();
```

- [ ] **Step 7: Unlock on tick, live** — in `renderMyDay()`'s `data-done` click handler, after `saveProgress(); renderMyDay(); renderHubHead();` add:

```js
    refreshLockUI();
    const lo=document.getElementById("lockOverlay");
    if(lo&&!gameLockState().locked)lo.remove();
```

- [ ] **Step 8: Check + smoke**

Run: `node scripts/check.mjs` → green.
Browser (use a `dayOverrides` DevTools move to bring a block "current" without waiting for the clock):
- During an activity block, nothing ticked: games tab shows the invite card; tapping a game shows the overlay; My Day / Activities / Learn / Ask all fully usable.
- Tick the block → games playable immediately, no reload.
- Wrong PIN shakes and clears; right PIN unlocks; override expires at the next block change.
- During Screen #1 with 10:00 homework unticked → locked (linger), overlay names Homework; tick homework → unlocked.
- Offline (wifi off): PIN still verifies from cache.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat: hybrid games lock with overrun linger and Papa PIN override"
```

## DONE WHEN

- All slice-02 + lock tests green in `/check`; games blocked exactly per design.md §2 (current activity governs; linger through screen blocks); guides/Learn/My Day/ask never blocked; tick/pass/PIN all unlock live without reload; PIN verifies offline; wrong PIN = gentle shake, no lockout; no red or shame copy anywhere.
