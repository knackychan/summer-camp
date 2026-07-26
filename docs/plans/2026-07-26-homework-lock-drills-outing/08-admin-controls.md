# Slice 08 — Admin Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Papa can adjust stars up or down, send a ticked block back for a redo (games re-lock until it's redone), and pause a kid's whole app — all from admin.html, with the pause clearable by Papa PIN on the tablet.

**Architecture:** Star adjustments are `stars_ledger` deltas (`source='admin'`), never total edits. Send-back = delete `day_ticks` row + ledger refund + row in a new `day_redos` table; `lock-core` treats any unticked redo block as locking regardless of the clock. App pause = `family_settings` key `applock_<kid>` (non-empty value = paused), hydrated/cached/realtime through sync.js, enforced by a calm overlay in index.html, cleared by admin toggle or Papa PIN (offline-queued op).

**Tech Stack:** Vanilla JS, Supabase (anon client, RLS), `node:test`, `node scripts/check.mjs`.

**Read first:** `design.md` §8 + §6. Tone rules from `CLAUDE.md`: invite, never shame — no red-for-late, no countdowns, no blame copy. Every user-facing string EN + 繁體中文.

**Prerequisites:** slice 03 merged (`family_settings`, `SQPin`, `SQLock`, `refreshLockUI`, `gameLockState`). Slice 02 merged (SQTime, core.test.mjs).

**⚠ Concurrency:** another agent may be committing. Start clean and up to date; anchor by snippets, not line numbers.

---

### Task 1: Schema v4 — `day_redos` table, app-pause policy, realtime

**Files:**
- Modify: `supabase/schema.sql` (append)

- [ ] **Step 1: Append to `supabase/schema.sql`**

```sql
-- ============================================================
-- v4 additions — admin controls (plan 2026-07-26, slice 08)
-- ============================================================

-- Blocks Papa sent back for a redo ("not finished yet") — invite, never shame.
-- Rows expire naturally with the day (all queries filter by day).
create table if not exists day_redos (
  kid_id     text not null references kids(id),
  day        date not null,
  block_idx  int  not null,
  note       text not null default '',
  created_at timestamptz default now(),
  primary key (kid_id, day, block_idx)
);
alter table day_redos enable row level security;
create policy "read redos"  on day_redos for select using (true);
create policy "admin redos" on day_redos for all to authenticated using (true) with check (true);

-- kid-device (anon) may only CLEAR an app-pause flag (Papa PIN pad on the tablet).
-- It can set value to '' — never set a pause, never touch other keys.
create policy "kid applock clear" on family_settings for update
  using (key like 'applock_%') with check (key like 'applock_%' and value = '');

do $$ begin alter publication supabase_realtime add table day_redos;        exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table family_settings;  exception when duplicate_object then null; end $$;
```

- [ ] **Step 2: Apply it** via the Supabase MCP (or SQL editor). Verify: `select * from day_redos;` succeeds and `select * from pg_publication_tables where pubname='supabase_realtime';` lists `day_redos` and `family_settings`.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: day_redos table, app-pause clear policy, realtime for admin controls"
```

---

### Task 2: `lock-core` learns redo blocks (TDD)

**Files:**
- Modify: `js/lock-core.js`
- Modify: `scripts/core.test.mjs`

- [ ] **Step 1: Write the failing tests** (append to `scripts/core.test.mjs`, next to the existing SQLock tests — reuses `LDAY`, `noPass`, and the `lock()` helper; extend the helper with a 5th arg first):

Replace the existing helper

```js
const lock = (now, done, passOk = noPass, overrides = {}) =>
  SQLock.computeLock({ day: LDAY, overrides, now, done, passOk });
```

with

```js
const lock = (now, done, passOk = noPass, overrides = {}, redos = {}) =>
  SQLock.computeLock({ day: LDAY, overrides, now, done, passOk, redos });
```

then append:

```js
test("redo block locks games regardless of clock", () => {
  // 6:00 — before any block, normally unlocked; redo flag on homework forces the lock
  assert.deepEqual(lock(6 * 60, {}, noPass, {}, { 1: true }), { locked: true, blockIdx: 1 });
});

test("re-ticked redo block unlocks", () => {
  assert.deepEqual(lock(6 * 60, { 1: true }, noPass, {}, { 1: true }), { locked: false, blockIdx: null });
});

test("pass on redo block unlocks", () => {
  assert.deepEqual(lock(6 * 60, {}, i => i === 1, {}, { 1: true }), { locked: false, blockIdx: null });
});

test("redo lock outranks current-block verdict", () => {
  // 12:10 lunch current+ticked, homework redo-flagged and unticked → locked by homework
  assert.deepEqual(lock(12 * 60 + 10, { 3: true }, noPass, {}, { 1: true }), { locked: true, blockIdx: 1 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/core.test.mjs`
Expected: the 4 new tests FAIL (redo ignored → `locked:false` where `true` expected).

- [ ] **Step 3: Implement in `js/lock-core.js`**

Replace the body of `computeLock` so the free/verdict helpers are defined first and redo blocks are checked before the time-based rule:

```js
  function computeLock(ctx){
    const free=i=>!!(ctx.done&&ctx.done[i])||!!(ctx.passOk&&ctx.passOk(i));
    const verdict=i=>free(i)?{locked:false,blockIdx:null}:{locked:true,blockIdx:i};
    /* Papa send-back (design.md §8): an unticked redo block locks regardless of the clock */
    for(const k of Object.keys(ctx.redos||{})){
      if(!free(+k))return {locked:true,blockIdx:+k};
    }
    const past=SQT.timedOrder(ctx.day,ctx.overrides||{}).filter(x=>x.t<=ctx.now);
    if(!past.length)return {locked:false,blockIdx:null};
    const cur=past[past.length-1];
    if(!isScreenBlock(ctx.day[cur.i]))return verdict(cur.i);
    for(let n=past.length-2;n>=0;n--){
      if(!isScreenBlock(ctx.day[past[n].i]))return verdict(past[n].i);
    }
    return {locked:false,blockIdx:null};
  }
```

Also update the header comment: add a line `- a redo-flagged block (Papa send-back) that is unticked/unpassed locks first, regardless of time`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/core.test.mjs` → all PASS (old lock tests must stay green — they pass `redos` as `{}`).

- [ ] **Step 5: Commit**

```bash
git add js/lock-core.js scripts/core.test.mjs
git commit -m "feat: lock-core locks on Papa redo flags with tests"
```

---

### Task 3: sync.js — redos + family-settings cache, `famset` op, realtime hooks

**Files:**
- Modify: `js/sync.js`

- [ ] **Step 1: Constructor offline fallbacks** — next to the existing `this.adminPin=loadJson("sq:adminPin","");` add:

```js
      this.familySettings=loadJson("sq:famSettings",{});
      const cachedRedos=loadJson("sq:redos",{d:null,map:{}});
      this.redos=cachedRedos.d===todayISO()?cachedRedos.map:{};
```

- [ ] **Step 2: Hydrate** — in `hydrate()`'s `Promise.all`, append AFTER the `day_overrides` fetch (order must match the destructuring):

```js
        this.supabase.from("day_redos").select("kid_id,block_idx,note").eq("day",day),
```

and add `,{data:redos}` at the END of the positional destructuring list. Then, right after the existing `saveJson("sq:adminPin",this.adminPin);` line, add:

```js
      saveJson("sq:famSettings",this.familySettings);
      this.redos={};
      (redos||[]).forEach(r=>{(this.redos[r.kid_id]=this.redos[r.kid_id]||{})[r.block_idx]=r.note||"";});
      saveJson("sq:redos",{d:day,map:this.redos});
```

(`this.redos` shape: `{kidId:{blockIdx:note}}` — note may be `""`.)

- [ ] **Step 3: `famset` op** — in `applyOp`, after the `outingBlock` branch add:

```js
      }else if(op.type==="famset"){
        /* update, not upsert — anon RLS only allows clearing applock_* keys */
        const {error}=await this.supabase.from("family_settings")
          .update({value:op.value,updated_at:new Date().toISOString()}).eq("key",op.key);
        if(error) throw error;
      }
```

and add the public method next to `setOverride`:

```js
    async setFamilySetting(key,value){
      this.familySettings[key]=value;
      saveJson("sq:famSettings",this.familySettings);
      this.enqueue({type:"famset",key,value});
      await this.flush();
    }
```

- [ ] **Step 4: Realtime hooks** — next to `onOverrides` add, following the same pattern:

```js
    onRedos(cb){
      if(!this.supabase) return ()=>{};
      const ch=this.supabase.channel(`redos-${Date.now()}`)
        .on("postgres_changes",{event:"*",schema:"public",table:"day_redos"},p=>cb(p.new||p.old))
        .subscribe();
      return ()=>this.supabase.removeChannel(ch);
    }
    onFamilySettings(cb){
      if(!this.supabase) return ()=>{};
      const ch=this.supabase.channel(`famset-${Date.now()}`)
        .on("postgres_changes",{event:"*",schema:"public",table:"family_settings"},p=>cb(p.new||p.old))
        .subscribe();
      return ()=>this.supabase.removeChannel(ch);
    }
```

- [ ] **Step 5: Check + commit**

Run: `node scripts/check.mjs` → green.

```bash
git add js/sync.js
git commit -m "feat: sync redos and family settings with famset op and realtime"
```

---

### Task 4: admin.html / admin.js — minus stars, send-back, app-pause toggles

**Files:**
- Modify: `admin.html`
- Modify: `js/admin.js`

- [ ] **Step 1: Load redos** — in `loadAll()`'s `Promise.all`, append (after the `overrides` fetch, destructuring name at the matching END position — the list currently ends `...,familySettings,overrides]`, make it `...,familySettings,overrides,redos]`):

```js
      client.from("day_redos").select("*").eq("day",today),
```

and in the `rows` assignment add `redos:redos.data||[]` (also add `redos:[]` to the initial `rows={...}` literal).

- [ ] **Step 2: Minus stars** — in `renderGrants()`:
  - In the first `.row` of buttons add: `<button class="btn btn--danger" data-grant="${id}" data-delta="-1">−1</button>`
  - Change the custom input to `min="-10"` and its handler to reject zero: `const v=+$(`custom-${id}`).value||0; if(!v)return; grantStars(id,v);`
  - In `grantStars`, make the toast sign-aware: `` toast(`${delta>0?"+":""}${delta} ⭐ ${kidName(kid)} — saved 已儲存`,true); ``

(RLS already allows any admin delta; the ledger's Undo button covers mistakes.)

- [ ] **Step 3: Send-back in the overview** — in `renderOverview()`, per kid compute redo flags before the block loop:

```js
      const redo=new Set(rows.redos.filter(r=>r.kid_id===id).map(r=>r.block_idx));
```

change the block-row status cell to show redo state:

```js
          <span>${b.t}</span><b class="${done.has(i)?"ok":"muted"}">${done.has(i)?"✓":redo.has(i)?"↩︎":"-"}</b>
```

and inside each block row, after the title span, add the action:

```js
          ${done.has(i)?`<button class="btn btn--secondary" data-sendback="${id}:${i}">↩︎ Send back 退回</button>`
            :redo.has(i)?`<span class="muted">waiting redo 等待再做</span>`:""}
```

- [ ] **Step 4: Wire the send-back action** — after `renderOverview()`'s innerHTML assignment, add:

```js
    document.querySelectorAll("[data-sendback]").forEach(b=>b.onclick=async()=>{
      const [kid,iStr]=b.dataset.sendback.split(":"), i=+iStr;
      if(!confirm(`Send "${DAY[i].title}" back to ${kidName(kid)} for a redo? 退回請${kidName(kid)}再做一次？`))return;
      const note=prompt("Note for the kid (optional) 給孩子的留言（可留空）","")||"";
      const today=new Date().toISOString().slice(0,10);
      /* refund what the tick earned, through the ledger (never edit totals) */
      const refunds=[];
      if(DAY[i].kind==="mission")
        refunds.push({kid_id:kid,delta:-1,reason:`Sent back 退回: ${DAY[i].title}`,source:"admin",granted_by:session.user.id});
      const kidDone=rows.ticks.filter(t=>t.kid_id===kid).map(t=>t.block_idx);
      const passIdx=rows.passes.filter(p=>p.kid_id===kid&&["granted","spent"].includes(p.status)).map(p=>p.block_idx);
      if(new Set([...kidDone,...passIdx]).size>=DAY.length)
        refunds.push({kid_id:kid,delta:-2,reason:"Day-complete bonus undone 全天完成獎勵取消",source:"admin",granted_by:session.user.id});
      const r1=await client.from("day_ticks").delete().eq("kid_id",kid).eq("day",today).eq("block_idx",i);
      if(r1.error){writeFailed(r1.error);return;}
      const r2=await client.from("day_redos").upsert({kid_id:kid,day:today,block_idx:i,note});
      if(r2.error){writeFailed(r2.error);return;}
      if(refunds.length){
        const r3=await client.from("stars_ledger").insert(refunds);
        if(r3.error){writeFailed(r3.error);return;}
      }
      toast(`Sent back ↩︎ ${kidName(kid)} — ${DAY[i].title}`,true);
      await loadAll();
    });
```

(`day_ticks` delete works for the authenticated admin — the permissive `"kid untick"` delete policy has no role restriction.)

- [ ] **Step 5: App-pause panel** — `admin.html`: add a section next to the settings/PIN panel, mirroring the existing panel markup:

```html
<section class="panel">
  <h2>App pause 暫停使用</h2>
  <p class="muted">Pauses the whole app for that kid until you resume — or Papa PIN on the tablet. 暫停後孩子無法使用，直到恢復（平板上也可用爸爸密碼恢復）。</p>
  <div id="applocks" class="grid"></div>
</section>
```

`js/admin.js`: add and call `renderAppLocks()` from `loadAll()`'s render list (after `renderAdminPin();`):

```js
  function renderAppLocks(){
    const fs=Object.fromEntries(rows.familySettings.map(r=>[r.key,r.value]));
    $("applocks").innerHTML=Object.entries(KIDS).map(([id,k])=>{
      const paused=(fs["applock_"+id]||"")!=="";
      return `<article class="kid-card" style="--kid-color:${k.color}">
        <h3>${k.name} ${paused?"⏸ paused 已暫停":""}</h3>
        <button class="btn ${paused?"":"btn--danger"}" data-applock="${id}" data-paused="${paused?1:0}">
          ${paused?"Resume 恢復":"Pause 暫停"}</button>
      </article>`;
    }).join("");
    document.querySelectorAll("[data-applock]").forEach(b=>b.onclick=async()=>{
      const id=b.dataset.applock, paused=b.dataset.paused==="1";
      const value=paused?"":(prompt("Reason (optional) 原因（可留空）","")||"1");
      const {error}=await client.from("family_settings").upsert({key:"applock_"+id,value,updated_at:new Date().toISOString()});
      if(error){writeFailed(error);return;}
      toast(paused?"Resumed 已恢復 ▶":"Paused 已暫停 ⏸",true);
      await loadAll();
    });
  }
```

(`rows.familySettings` is already loaded by slice 03's `loadAll`.)

- [ ] **Step 6: Check + commit**

Run: `node scripts/check.mjs` → green.

```bash
git add admin.html js/admin.js
git commit -m "feat: admin minus stars, tick send-back, per-kid app pause"
```

---

### Task 5: index.html — redo badge, redo lock, app-pause overlay, realtime

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Feed redos into the games lock** — in `gameLockState()`, extend the `computeLock` call with:

```js
      redos:(id&&store&&store.redos&&store.redos[id])||{},
```

- [ ] **Step 2: Redo badge in My Day** — add a helper near `passFor`:

```js
function redoNote(i){
  const m=store&&store.redos&&store.redos[hubKid];
  return m&&(i in m)?m[i]:null;
}
```

In `renderMyDay()`'s row template, directly after the `${pass?...passline...}` line, add:

```js
            ${!isDone&&redoNote(i)!=null?`<div class="passline">💪 Papa asked: please finish this one 爸爸請你再完成${redoNote(i)?` — ${escHtml(redoNote(i))}`:""}</div>`:""}
```

Invite tone only — no red, block just returns to its normal unticked look plus this line.

- [ ] **Step 3: App-pause overlay** — add near `showLockOverlay`:

```js
/* ---- Papa app pause (design.md §8): calm, never blames ---- */
function appLockReason(id){
  const v=store&&store.familySettings&&store.familySettings["applock_"+id];
  return v?v:null;
}
function refreshAppLock(){
  let o=document.getElementById("appLockOverlay");
  if(!hubKid||!appLockReason(hubKid)){if(o)o.remove();return;}
  if(o)return;
  o=document.createElement("div");
  o.className="overlay";o.id="appLockOverlay";
  o.innerHTML=`<div class="card" style="text-align:center;max-width:340px">
    <div style="font-size:2.2em">😌</div>
    <h3>Time for a break 休息一下</h3>
    <p>Papa paused the app for now. Talk to him when you're ready! 爸爸暫停了app，準備好了就去找他吧！</p>
    <div class="vrow">
      <button class="btn" id="appLockHome">🏠 Home 回首頁</button>
      <button class="btn small" id="appLockPapa">🔧 Papa 爸爸</button>
    </div>
  </div>`;
  document.body.appendChild(o);
  o.querySelector("#appLockHome").onclick=()=>{o.remove();goHome();};
  o.querySelector("#appLockPapa").onclick=()=>{
    SQPin.show({title:"Resume app 恢復使用",onOk:async()=>{
      await store.setFamilySetting("applock_"+hubKid,"");
      const ov=document.getElementById("appLockOverlay");
      if(ov)ov.remove();
    }});
  };
}
```

Enforce at three points:
1. End of `renderHub()`: add `refreshAppLock();` (re-entering the hub re-shows it).
2. Top of `startGame(id,lvl)`, before the slice-03 lock check: `if(hubKid&&appLockReason(hubKid)){refreshAppLock();return;}`
3. `startTimelineWatcher()`'s inner `tick`, next to the slice-03 lock check: `refreshAppLock();`

- [ ] **Step 4: Realtime** — in `setupRealtime()` add:

```js
  store.onRedos(async row=>{
    if(!row)return;
    await store.hydrate();
    if(hubKid&&hubTab==="day")renderMyDay();
    if(hubKid)renderHubHead();
    refreshLockUI();
  });
  store.onFamilySettings(row=>{
    if(!row||!row.key)return;
    store.familySettings[row.key]=row.value;
    localStorage.setItem("sq:famSettings",JSON.stringify(store.familySettings));
    if(row.key==="admin_pin")localStorage.setItem("sq:adminPin",JSON.stringify(row.value||""));
    refreshAppLock();
  });
```

and fix the star celebration so refunds stay quiet — in the existing `store.onStars` handler change the celebration line to:

```js
    if(row.kid_id===(hubKid||kid)&&row.delta>0){bigFloat("🌟");sWin();}
```

(A mid-game send-back is covered for free: the 5s watcher's `gameLockState()` now sees the redo flag, exits the game gently, and the overlay names the block.)

- [ ] **Step 5: Check + smoke**

Run: `node scripts/check.mjs` → green.
Browser smoke (two windows: admin.html signed in + index.html kid):
- Admin −1 star: ledger row appears, kid total drops, **no** celebration on the tablet.
- Send back a ticked mission block: kid's row unticks live with the 💪 invite line; games lock immediately (overlay names the block) even outside its time slot; ledger shows −1 (and −2 if day was complete).
- Kid re-ticks → star re-awarded, lock clears, admin overview shows ✓ again.
- Pause a kid: overlay appears on their hub within seconds; siblings unaffected; games blocked from home screen for that kid; Papa PIN on the tablet resumes (flag clears in admin too).
- Wifi off: pause overlay still shows from cache; PIN resume queues and flushes when back online.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: redo badge and lock, app-pause overlay, quiet star refunds"
```

## DONE WHEN

- All core tests green (`node --test scripts/core.test.mjs`) and `/check` green.
- Admin can add AND subtract stars; every adjustment is a ledger row (Undo works); negative deltas silent on tablets.
- Send-back unticks live, refunds through the ledger, shows the 💪 invite (bilingual, no shame), and locks games until re-tick/pass — regardless of clock; re-tick rebalances the ledger.
- App pause blocks the paused kid's whole app with calm bilingual copy, siblings untouched; resume works from admin and from Papa PIN offline-queued; pause is only ever Papa-triggered.
