# Slice 04 — Reschedule Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Papa moves any block to a different time, **today only, for all kids**, from admin.html or from any tablet via the Papa PIN pad (offline-queued). Overrides reset tomorrow; the base `DAY` plan is never edited.

**Architecture:** New `day_overrides` table `(day, block_idx, t)`. sync.js hydrates today's rows into `store.dayOverrides`, queues an `override` op offline-first, and exposes realtime. index.html feeds `dayOverrides` into the SQTime/SQLock plumbing built in slices 02–03 — timeline, announcements, screen prerequisites, lock, and row order all follow automatically. Tablet UI lives in a new `js/papa-tools.js` (`SQPapa`) behind the shared PIN pad; admin gets a Reschedule panel (admin.html loads `day-data.js` + `time-core.js` for block names/times — no duplicated schedule data).

**Tech Stack:** Vanilla JS, Supabase (RLS, realtime), `node:test`, `node scripts/check.mjs`.

**Read first:** `design.md` §5 + §6.

**Prerequisites:** slices 02 and 03 merged (SQTime, `dayOverrides` global, SQPin).

**⚠ Concurrency:** another agent may be committing. Start clean and up to date; anchor by snippets, not line numbers.

---

### Task 1: Schema

**Files:**
- Modify: `supabase/schema.sql` (append, after the v3 `family_settings` section)

- [ ] **Step 1: Append**

```sql
-- Per-day block time overrides (reschedule). Base DAY plan lives in the client;
-- a row here moves block_idx to time t ("HH:MM") for that day only, for all kids.
create table if not exists day_overrides (
  day        date not null,
  block_idx  int  not null,
  t          text not null,
  updated_at timestamptz default now(),
  primary key (day, block_idx)
);
alter table day_overrides enable row level security;
-- Same trust level as day_ticks: URL + PIN pad are the perimeter, RLS stays open for the family app.
create policy "read overrides"  on day_overrides for select using (true);
create policy "write overrides" on day_overrides for insert with check (true);
create policy "update overrides" on day_overrides for update using (true) with check (true);
create policy "delete overrides" on day_overrides for delete using (true);

do $$
begin
  alter publication supabase_realtime add table day_overrides;
exception when duplicate_object then null;
end $$;
```

- [ ] **Step 2: Apply** via Supabase MCP / SQL editor. Verify realtime replication lists `day_overrides`.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: day_overrides table for per-day reschedules"
```

---

### Task 2: sync.js — hydrate, queue op, realtime

**Files:**
- Modify: `js/sync.js`

- [ ] **Step 1: Hydrate** — in `hydrate()`, add to the `Promise.all` (after the `family_settings` fetch from slice 03):

```js
        this.supabase.from("day_overrides").select("block_idx,t").eq("day",day),
```

with matching destructure name `{data:overrides}` (keep positional order!). After the family-settings assignment block add:

```js
      this.dayOverrides={};
      (overrides||[]).forEach(r=>{this.dayOverrides[r.block_idx]=r.t;});
      saveJson("sq:dayOverrides",{d:day,map:this.dayOverrides});
```

In the constructor, offline fallback next to `this.adminPin=...`:

```js
      const ov=loadJson("sq:dayOverrides",null);
      this.dayOverrides=ov&&ov.d===todayISO()?ov.map:{};
```

- [ ] **Step 2: Queue op** — in `applyOp(op)`, add a branch:

```js
      }else if(op.type==="override"){
        if(op.t!=null){
          const {error}=await this.supabase.from("day_overrides").upsert({
            day:op.day,block_idx:op.blockIdx,t:op.t,updated_at:new Date().toISOString()
          });
          if(error) throw error;
        }else{
          const {error}=await this.supabase.from("day_overrides")
            .delete().eq("day",op.day).eq("block_idx",op.blockIdx);
          if(error) throw error;
        }
```

- [ ] **Step 3: Method + realtime** — next to `roll(...)` add:

```js
    async setOverride(dayISO,blockIdx,t){ /* t null clears */
      if(t!=null)this.dayOverrides[blockIdx]=t; else delete this.dayOverrides[blockIdx];
      saveJson("sq:dayOverrides",{d:dayISO,map:this.dayOverrides});
      this.enqueue({type:"override",day:dayISO,blockIdx,t});
      await this.flush();
    }
```

and next to `onPasses(...)`:

```js
    onOverrides(cb){
      if(!this.supabase) return ()=>{};
      const ch=this.supabase.channel(`overrides-${Date.now()}`)
        .on("postgres_changes",{event:"*",schema:"public",table:"day_overrides"},p=>cb(p.new||p.old))
        .subscribe();
      return ()=>this.supabase.removeChannel(ch);
    }
```

- [ ] **Step 4: Commit**

```bash
git add js/sync.js
git commit -m "feat: sync day_overrides — hydrate, offline op, realtime"
```

---

### Task 3: index.html — feed overrides into the plumbing

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Hydrate the global.** Where the app assigns from the store after `SyncStore.init` (search `store.papaNote` usage or the init call), add right after the store is ready:

```js
  dayOverrides=(store&&store.dayOverrides)||{};
```

- [ ] **Step 2: Realtime refresh.** Where `store.onStars(...)` is subscribed, add:

```js
  store.onOverrides(row=>{
    if(!row||row.day!==todayStr())return;
    if(row.t!=null)dayOverrides[row.block_idx]=row.t; else delete dayOverrides[row.block_idx];
    if(hubKid&&hubTab==="day")renderMyDay();
    refreshLockUI();
  });
```

(Delete events arrive with `p.old` — Supabase delete payloads may omit non-PK columns; `row.t` is then undefined, which correctly deletes. If `row.day` is also missing on deletes, drop the `row.day!==todayStr()` guard for delete-shaped rows — verify against the actual payload while testing and note what you saw in the commit body.)

- [ ] **Step 3: Lock watcher already consumes `dayOverrides`** (slice 03) — nothing to do; confirm `gameLockState` passes `overrides:dayOverrides`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: tablets hydrate and live-follow day overrides"
```

---

### Task 4: Admin Reschedule panel

**Files:**
- Modify: `admin.html`, `js/admin.js`

- [ ] **Step 1: Load the shared modules in admin.html** — change its script block to:

```html
<script src="js/config.js"></script>
<script src="js/day-data.js"></script>
<script src="js/time-core.js"></script>
<script src="js/admin.js"></script>
```

- [ ] **Step 2: Panel markup** — add a new panel inside `#dash` (after the Papa's-daily-message panel):

```html
<section class="panel">
  <h2 class="section-title">Reschedule today 調整今天時間</h2>
  <p class="hint">Moves apply to all kids, today only — tablets update live. 對所有孩子生效，只限今天。</p>
  <div id="reschedList"></div>
  <div class="row">
    <button class="btn" id="reschedSaveBtn">Save moves 儲存調整</button>
    <button class="btn btn--secondary" id="reschedResetBtn">Reset to normal 恢復原時間</button>
  </div>
  <p class="message message--ok" id="reschedStatus"></p>
</section>
```

- [ ] **Step 3: admin.js logic** — add (using the module-level `let overridesToday={}` next to the other state):

```js
  let overridesToday={};

  async function loadOverrides(){
    const {data}=await client.from("day_overrides").select("block_idx,t").eq("day",dayISO());
    overridesToday={};
    (data||[]).forEach(r=>{overridesToday[r.block_idx]=r.t;});
    renderResched();
  }

  function renderResched(){
    const DAYP=window.SQ_DAY;
    $("reschedList").innerHTML=SQTime.timedOrder(DAYP,overridesToday).map(x=>{
      const b=DAYP[x.i], moved=overridesToday[x.i]!=null;
      return `<div class="row resched-row">
        <span class="pill">${b.icon} ${b.title} ${b.tz}</span>
        <input class="input input--time" type="time" data-ri="${x.i}"
          value="${String(Math.floor(x.t/60)).padStart(2,"0")}:${String(x.t%60).padStart(2,"0")}">
        ${moved?`<span class="pill pill--ok">moved 已調整</span>`:""}
      </div>`;
    }).join("");
  }

  async function saveResched(){
    const DAYP=window.SQ_DAY;
    const jobs=[];
    document.querySelectorAll("#reschedList [data-ri]").forEach(inp=>{
      const i=+inp.dataset.ri, v=inp.value; if(!v)return;
      const [h,m]=v.split(":").map(Number);
      const t=`${h}:${String(m).padStart(2,"0")}`;               // match DAY's "8:00" style
      const base=DAYP[i].t;
      const cur=overridesToday[i]!=null?overridesToday[i]:base;
      if(SQTime.parseMins(t)===SQTime.parseMins(cur))return;      // unchanged
      if(SQTime.parseMins(t)===SQTime.parseMins(base)){
        jobs.push(client.from("day_overrides").delete().eq("day",dayISO()).eq("block_idx",i));
      }else{
        jobs.push(client.from("day_overrides").upsert({day:dayISO(),block_idx:i,t}));
      }
    });
    const results=await Promise.all(jobs);
    const err=results.find(r=>r.error);
    $("reschedStatus").textContent=err?err.error.message:"Saved — tablets update live 已儲存 ✓";
    await loadOverrides();
  }

  async function resetResched(){
    const {error}=await client.from("day_overrides").delete().eq("day",dayISO());
    $("reschedStatus").textContent=error?error.message:"Back to normal 已恢復 ✓";
    await loadOverrides();
  }
```

Wire in the same place other buttons are wired:

```js
    $("reschedSaveBtn").onclick=saveResched;
    $("reschedResetBtn").onclick=resetResched;
```

and call `loadOverrides()` from `loadAll()` (or `openDashboard`), following how the other loaders are invoked. Minimal CSS if needed: `.input--time{width:auto}`.

- [ ] **Step 4: Commit**

```bash
git add admin.html js/admin.js
git commit -m "feat: admin reschedule panel writing day_overrides"
```

---

### Task 5: Tablet path — `js/papa-tools.js`

**Files:**
- Create: `js/papa-tools.js`
- Modify: `index.html`

- [ ] **Step 1: Implement `js/papa-tools.js`**

```js
/* SQPapa — tablet-side Papa menu behind the PIN pad.
   Slice 04: reschedule + unlock shortcut. Slice 05 adds outing. */
(function(){
  function open(){
    window.SQPin.show({title:"Papa tools 爸爸工具",onOk:menu});
  }
  function menu(){
    const o=document.createElement("div");
    o.className="overlay";
    o.innerHTML=`<div class="card" style="max-width:360px">
      <h3>🔧 Papa tools 爸爸工具</h3>
      <div class="vrow">
        <button class="btn" id="ptResched">⏰ Reschedule today 調整今天時間</button>
        <button class="btn small" id="ptClose">Close 關閉</button>
      </div>
      <div id="ptBody"></div>
    </div>`;
    document.body.appendChild(o);
    o.querySelector("#ptClose").onclick=()=>o.remove();
    o.querySelector("#ptResched").onclick=()=>resched(o.querySelector("#ptBody"));
  }
  function resched(el){
    const rows=window.SQTime.timedOrder(window.SQ_DAY,window.sqDayOverrides()).map(x=>{
      const b=window.SQ_DAY[x.i];
      const hh=String(Math.floor(x.t/60)).padStart(2,"0"), mm=String(x.t%60).padStart(2,"0");
      return `<div class="vrow">
        <span style="flex:1">${b.icon} ${b.title.split("—")[0].trim()} ${(b.tz||"").split("——")[0]}</span>
        <input class="qinput" style="width:auto" type="time" data-pti="${x.i}" value="${hh}:${mm}">
      </div>`;
    }).join("");
    el.innerHTML=rows+`<button class="btn" id="ptSave">Save 儲存</button><div class="tipline" id="ptMsg"></div>`;
    el.querySelector("#ptSave").onclick=async()=>{
      const ov=window.sqDayOverrides();
      for(const inp of el.querySelectorAll("[data-pti]")){
        const i=+inp.dataset.pti, v=inp.value; if(!v)continue;
        const [h,m]=v.split(":").map(Number);
        const t=`${h}:${String(m).padStart(2,"0")}`;
        const base=window.SQ_DAY[i].t;
        const cur=ov[i]!=null?ov[i]:base;
        if(window.SQTime.parseMins(t)===window.SQTime.parseMins(cur))continue;
        const clear=window.SQTime.parseMins(t)===window.SQTime.parseMins(base);
        await window.sqSetOverride(i,clear?null:t);
      }
      el.querySelector("#ptMsg").textContent="Saved — syncs when online 已儲存";
      window.sqAfterOverrideChange();
    };
  }
  window.SQPapa={open};
})();
```

- [ ] **Step 2: The three tiny adapters in index.html** (papa-tools stays decoupled from app globals — this is the interface, keep it explicit). Add near `gameLockState`:

```js
/* adapters for js/papa-tools.js */
window.sqDayOverrides=()=>dayOverrides;
window.sqSetOverride=async(i,t)=>{
  if(t!=null)dayOverrides[i]=t; else delete dayOverrides[i];
  if(store&&store.setOverride)await store.setOverride(todayStr(),i,t);
};
window.sqAfterOverrideChange=()=>{if(hubKid&&hubTab==="day")renderMyDay();refreshLockUI();};
```

- [ ] **Step 3: Entry point + script tag.** Add `<script src="js/papa-tools.js"></script>` after `pinpad.js`. In the hub header (where `hubStars` renders, or the fixed top bar next to `#mute`), add a small wrench button:

```html
<button class="iconbtn" id="papaBtn" title="Papa 爸爸">🔧</button>
```

wired once at startup near the other `onclick` wiring:

```js
document.getElementById("papaBtn").onclick=()=>SQPapa.open();
```

Match the existing top-bar button classes (inspect `#mute`'s markup and copy its class).

- [ ] **Step 4: Check + smoke**

Run: `node scripts/check.mjs` → green.
Browser two-device test (or two browser profiles):
- Admin: move Homework 10:00 → 15:00, Save. Tablet updates within ~2s: row re-sorts after 14:00 Project, shows "moved 已調整", Screen #1 🔓 no longer needs it, 15:00 announcement fires if crossing the time.
- Tablet offline: 🔧 → PIN → reschedule Sport to 16:00 → Save; reload offline: override persists (localStorage); back online: row appears in Supabase and on the other device.
- Reset to normal clears everything everywhere.

- [ ] **Step 5: Commit**

```bash
git add js/papa-tools.js index.html
git commit -m "feat: papa-tools tablet menu with PIN-gated reschedule"
```

## DONE WHEN

- Papa moves any block from admin or tablet (PIN, offline-queued); all tablets follow live; timeline, announcements, screen prerequisites, lock, and row order all use effective times; overrides vanish next day; base DAY untouched; `/check` green.
