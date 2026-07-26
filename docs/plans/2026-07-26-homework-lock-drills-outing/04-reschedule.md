# Slice 04 — Reschedule Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Papa moves any block to a different time, **today only** — for **all kids or one kid individually** — from admin.html or from any tablet via the Papa PIN pad (offline-queued). Overrides reset tomorrow; the base `DAY` plan is never edited.

**Architecture:** New `day_overrides` table `(day, block_idx, kid_id, t)` where `kid_id='all'` is a family-wide move and a kid-specific row **wins over** `'all'` for that kid. sync.js hydrates today's rows into `store.dayOverridesRaw` (grouped by kid), queues an `override` op offline-first, and exposes realtime. A tiny pure `SQTime.resolveOverrides(raw, kid)` merges `all` + kid rows into the flat `{blockIdx:"HH:MM"}` map that the slice-02/03 plumbing already consumes — each tablet resolves for its **active kid**, so timeline, announcements, screen prerequisites, lock, and row order follow that kid's effective schedule. Tablet UI lives in a new `js/papa-tools.js` (`SQPapa`) behind the shared PIN pad; admin gets a Reschedule panel with a kid selector (admin.html loads `day-data.js` + `time-core.js` — no duplicated schedule data).

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
-- a row here moves block_idx to time t ("HH:MM") for that day only.
-- kid_id 'all' = family-wide; a kid-specific row wins over 'all' for that kid.
create table if not exists day_overrides (
  day        date not null,
  block_idx  int  not null,
  kid_id     text not null default 'all',   -- 'all' | 'lucien' | 'lili' | 'luis' (no FK: 'all' is not a kid)
  t          text not null,
  updated_at timestamptz default now(),
  primary key (day, block_idx, kid_id)
);
alter table day_overrides enable row level security;
-- Same trust level as day_ticks: URL + PIN pad are the perimeter, RLS stays open for the family app.
create policy "read overrides"   on day_overrides for select using (true);
create policy "write overrides"  on day_overrides for insert with check (true);
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
git commit -m "feat: day_overrides table with per-kid reschedules"
```

---

### Task 2: `SQTime.resolveOverrides` — pure, tested

**Files:**
- Modify: `js/time-core.js`
- Modify: `scripts/core.test.mjs`

- [ ] **Step 1: Write the failing test** (append to `scripts/core.test.mjs`)

```js
test("resolveOverrides: kid row wins over all row", () => {
  const raw = {
    all:  { 1: "15:00", 3: "17:30" },
    lili: { 1: "16:00" },
  };
  assert.deepEqual(SQTime.resolveOverrides(raw, "lili"),   { 1: "16:00", 3: "17:30" });
  assert.deepEqual(SQTime.resolveOverrides(raw, "luis"),   { 1: "15:00", 3: "17:30" });
  assert.deepEqual(SQTime.resolveOverrides(raw, null),     { 1: "15:00", 3: "17:30" });
  assert.deepEqual(SQTime.resolveOverrides(null, "lili"),  {});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/core.test.mjs`
Expected: FAIL — `SQTime.resolveOverrides is not a function`

- [ ] **Step 3: Implement** — add inside the `time-core.js` IIFE and to its `api` object:

```js
  function resolveOverrides(raw,kid){
    if(!raw)return {};
    return Object.assign({},raw.all||{},(kid&&raw[kid])||{});
  }
```

```js
  const api={parseMins,effMins,timedOrder,timelineInfo,neededBefore,displayOrder,resolveOverrides};
```

- [ ] **Step 4: Run to verify it passes**, then commit:

```bash
git add js/time-core.js scripts/core.test.mjs
git commit -m "feat: resolveOverrides merges family and per-kid moves"
```

---

### Task 3: sync.js — hydrate, queue op, realtime

**Files:**
- Modify: `js/sync.js`

- [ ] **Step 1: Hydrate** — in `hydrate()`, add to the `Promise.all` (after the `family_settings` fetch from slice 03):

```js
        this.supabase.from("day_overrides").select("kid_id,block_idx,t").eq("day",day),
```

with matching destructure name `{data:overrides}` (keep positional order!). After the family-settings assignment block add:

```js
      this.dayOverridesRaw={};
      (overrides||[]).forEach(r=>{
        (this.dayOverridesRaw[r.kid_id]=this.dayOverridesRaw[r.kid_id]||{})[r.block_idx]=r.t;
      });
      saveJson("sq:dayOverrides",{d:day,map:this.dayOverridesRaw});
```

In the constructor, offline fallback next to `this.adminPin=...`:

```js
      const ov=loadJson("sq:dayOverrides",null);
      this.dayOverridesRaw=ov&&ov.d===todayISO()?ov.map:{};
```

- [ ] **Step 2: Queue op** — in `applyOp(op)`, add a branch:

```js
      }else if(op.type==="override"){
        if(op.t!=null){
          const {error}=await this.supabase.from("day_overrides").upsert({
            day:op.day,block_idx:op.blockIdx,kid_id:op.kidId||"all",t:op.t,
            updated_at:new Date().toISOString()
          });
          if(error) throw error;
        }else{
          const {error}=await this.supabase.from("day_overrides")
            .delete().eq("day",op.day).eq("block_idx",op.blockIdx).eq("kid_id",op.kidId||"all");
          if(error) throw error;
        }
```

- [ ] **Step 3: Method + realtime** — next to `roll(...)` add:

```js
    async setOverride(dayISO,blockIdx,t,kidId){ /* t null clears; kidId default 'all' */
      kidId=kidId||"all";
      const bucket=this.dayOverridesRaw[kidId]=this.dayOverridesRaw[kidId]||{};
      if(t!=null)bucket[blockIdx]=t; else delete bucket[blockIdx];
      saveJson("sq:dayOverrides",{d:dayISO,map:this.dayOverridesRaw});
      this.enqueue({type:"override",day:dayISO,blockIdx,t,kidId});
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
git commit -m "feat: sync per-kid day_overrides — hydrate, offline op, realtime"
```

---

### Task 4: index.html — resolve for the active kid

**Files:**
- Modify: `index.html`

- [ ] **Step 1: One resolver, called on every context change.** Near the `dayOverrides` global (slice 02), add:

```js
function refreshOverrides(){
  dayOverrides=SQTime.resolveOverrides(store&&store.dayOverridesRaw,activeKid());
}
```

Call `refreshOverrides()`:
- right after `SyncStore.init` resolves (replacing any plain `dayOverrides=...` assignment from an earlier draft),
- at the top of `openHub(id)` (after `hubKid=id;` — kid switch changes the effective schedule),
- wherever the kid profile is cleared/changed back to home (search `hubKid=null`).

- [ ] **Step 2: Realtime refresh.** Where `store.onStars(...)` is subscribed, add:

```js
  store.onOverrides(row=>{
    if(!row)return;
    if(row.kid_id!=null&&row.block_idx!=null){
      const bucket=store.dayOverridesRaw[row.kid_id]=store.dayOverridesRaw[row.kid_id]||{};
      if(row.t!=null)bucket[row.block_idx]=row.t; else delete bucket[row.block_idx];
    }else{
      store.hydrate(); /* delete payload without columns — cheap resync */
    }
    refreshOverrides();
    if(hubKid&&hubTab==="day")renderMyDay();
    refreshLockUI();
  });
```

(Supabase delete payloads carry only PK columns when replica identity is default — `day/block_idx/kid_id` are all PK here, so the branch above normally has what it needs; the `hydrate()` fallback covers surprises. Verify the actual payload while testing and note it in the commit body.)

- [ ] **Step 3: Lock watcher already consumes `dayOverrides`** (slice 03) — confirm `gameLockState` passes `overrides:dayOverrides`; nothing else to do.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: tablets resolve day overrides for their active kid"
```

---

### Task 5: Admin Reschedule panel with kid selector

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
  <p class="hint">Pick who it applies to — a kid's own move wins over "All". Tablets update live.
     選擇對象——個人調整會蓋過「全部」。平板即時更新。</p>
  <div class="row" id="reschedKids">
    <button class="btn btn--secondary reschedkid on" data-rk="all">👨‍👩‍👧‍👦 All 全部</button>
    <button class="btn btn--secondary reschedkid" data-rk="lucien">Lucien</button>
    <button class="btn btn--secondary reschedkid" data-rk="lili">Lili</button>
    <button class="btn btn--secondary reschedkid" data-rk="luis">Luis</button>
  </div>
  <div id="reschedList"></div>
  <div class="row">
    <button class="btn" id="reschedSaveBtn">Save moves 儲存調整</button>
    <button class="btn btn--secondary" id="reschedResetBtn">Reset selection to normal 恢復原時間</button>
  </div>
  <p class="message message--ok" id="reschedStatus"></p>
</section>
```

- [ ] **Step 3: admin.js logic** — add (module-level state next to the rest):

```js
  let overridesRaw={};      /* {kid_id:{block_idx:t}} incl. 'all' */
  let reschedKid="all";

  async function loadOverrides(){
    const {data}=await client.from("day_overrides").select("kid_id,block_idx,t").eq("day",dayISO());
    overridesRaw={};
    (data||[]).forEach(r=>{(overridesRaw[r.kid_id]=overridesRaw[r.kid_id]||{})[r.block_idx]=r.t;});
    renderResched();
  }

  function reschedEffective(){ /* what the selected scope currently sees */
    return reschedKid==="all"?(overridesRaw.all||{}):SQTime.resolveOverrides(overridesRaw,reschedKid);
  }

  function renderResched(){
    document.querySelectorAll("#reschedKids .reschedkid").forEach(b=>{
      b.classList.toggle("on",b.dataset.rk===reschedKid);
      b.onclick=()=>{reschedKid=b.dataset.rk;renderResched();};
    });
    const DAYP=window.SQ_DAY, eff=reschedEffective(), own=overridesRaw[reschedKid]||{};
    $("reschedList").innerHTML=SQTime.timedOrder(DAYP,eff).map(x=>{
      const b=DAYP[x.i];
      const tag=own[x.i]!=null?(reschedKid==="all"?"moved 已調整":"own move 個人調整")
               :(reschedKid!=="all"&&(overridesRaw.all||{})[x.i]!=null?"family move 全家調整":"");
      return `<div class="row resched-row">
        <span class="pill">${b.icon} ${b.title} ${b.tz}</span>
        <input class="input input--time" type="time" data-ri="${x.i}"
          value="${String(Math.floor(x.t/60)).padStart(2,"0")}:${String(x.t%60).padStart(2,"0")}">
        ${tag?`<span class="pill pill--ok">${tag}</span>`:""}
      </div>`;
    }).join("");
  }

  async function saveResched(){
    const DAYP=window.SQ_DAY, jobs=[], own=overridesRaw[reschedKid]||{};
    document.querySelectorAll("#reschedList [data-ri]").forEach(inp=>{
      const i=+inp.dataset.ri, v=inp.value; if(!v)return;
      const [h,m]=v.split(":").map(Number);
      const t=`${h}:${String(m).padStart(2,"0")}`;               // match DAY's "8:00" style
      const base=reschedKid==="all"?DAYP[i].t
                 :((overridesRaw.all||{})[i]!=null?overridesRaw.all[i]:DAYP[i].t); // kid falls back to family time
      const cur=own[i]!=null?own[i]:base;
      if(SQTime.parseMins(t)===SQTime.parseMins(cur))return;      // unchanged
      if(SQTime.parseMins(t)===SQTime.parseMins(base)){
        jobs.push(client.from("day_overrides").delete()
          .eq("day",dayISO()).eq("block_idx",i).eq("kid_id",reschedKid));
      }else{
        jobs.push(client.from("day_overrides").upsert({day:dayISO(),block_idx:i,kid_id:reschedKid,t}));
      }
    });
    const results=await Promise.all(jobs);
    const err=results.find(r=>r.error);
    $("reschedStatus").textContent=err?err.error.message:"Saved — tablets update live 已儲存 ✓";
    await loadOverrides();
  }

  async function resetResched(){
    const {error}=await client.from("day_overrides").delete()
      .eq("day",dayISO()).eq("kid_id",reschedKid);
    $("reschedStatus").textContent=error?error.message:"Back to normal 已恢復 ✓";
    await loadOverrides();
  }
```

Wire `$("reschedSaveBtn").onclick=saveResched; $("reschedResetBtn").onclick=resetResched;` with the other buttons, and call `loadOverrides()` from `loadAll()`. CSS if needed: `.input--time{width:auto}` and `.reschedkid.on{outline:2px solid var(--ok,#7bd88f)}`.

- [ ] **Step 4: Commit**

```bash
git add admin.html js/admin.js
git commit -m "feat: admin reschedule panel with per-kid scope"
```

---

### Task 6: Tablet path — `js/papa-tools.js`

**Files:**
- Create: `js/papa-tools.js`
- Modify: `index.html`

- [ ] **Step 1: Implement `js/papa-tools.js`**

```js
/* SQPapa — tablet-side Papa menu behind the PIN pad.
   Slice 04: reschedule (family or one kid) + unlock shortcut. Slice 05 adds outing. */
(function(){
  const KID_LABELS={all:"👨‍👩‍👧‍👦 All 全部",lucien:"Lucien",lili:"Lili",luis:"Luis"};
  function open(){
    window.SQPin.show({title:"Papa tools 爸爸工具",onOk:menu});
  }
  function menu(){
    const o=document.createElement("div");
    o.className="overlay";
    o.innerHTML=`<div class="card" style="max-width:380px">
      <h3>🔧 Papa tools 爸爸工具</h3>
      <div class="vrow">
        <button class="btn" id="ptResched">⏰ Reschedule today 調整今天時間</button>
        <button class="btn small" id="ptClose">Close 關閉</button>
      </div>
      <div id="ptBody"></div>
    </div>`;
    document.body.appendChild(o);
    o.querySelector("#ptClose").onclick=()=>o.remove();
    o.querySelector("#ptResched").onclick=()=>resched(o.querySelector("#ptBody"),"all");
  }
  function resched(el,scope){
    const raw=window.sqOverridesRaw();
    const eff=scope==="all"?(raw.all||{}):window.SQTime.resolveOverrides(raw,scope);
    const own=raw[scope]||{};
    const kidRow=Object.keys(KID_LABELS).map(k=>
      `<button class="btn small ptkid ${k===scope?"on":""}" data-ptk="${k}">${KID_LABELS[k]}</button>`).join("");
    const rows=window.SQTime.timedOrder(window.SQ_DAY,eff).map(x=>{
      const b=window.SQ_DAY[x.i];
      const hh=String(Math.floor(x.t/60)).padStart(2,"0"), mm=String(x.t%60).padStart(2,"0");
      return `<div class="vrow">
        <span style="flex:1">${b.icon} ${b.title.split("—")[0].trim()} ${(b.tz||"").split("——")[0]}${own[x.i]!=null?" ✎":""}</span>
        <input class="qinput" style="width:auto" type="time" data-pti="${x.i}" value="${hh}:${mm}">
      </div>`;
    }).join("");
    el.innerHTML=`<div class="vrow" style="flex-wrap:wrap">${kidRow}</div>`+rows+
      `<button class="btn" id="ptSave">Save 儲存</button><div class="tipline" id="ptMsg"></div>`;
    el.querySelectorAll(".ptkid").forEach(b=>b.onclick=()=>resched(el,b.dataset.ptk));
    el.querySelector("#ptSave").onclick=async()=>{
      for(const inp of el.querySelectorAll("[data-pti]")){
        const i=+inp.dataset.pti, v=inp.value; if(!v)continue;
        const [h,m]=v.split(":").map(Number);
        const t=`${h}:${String(m).padStart(2,"0")}`;
        const base=scope==="all"?window.SQ_DAY[i].t
                   :((raw.all||{})[i]!=null?raw.all[i]:window.SQ_DAY[i].t);
        const cur=own[i]!=null?own[i]:base;
        if(window.SQTime.parseMins(t)===window.SQTime.parseMins(cur))continue;
        const clear=window.SQTime.parseMins(t)===window.SQTime.parseMins(base);
        await window.sqSetOverride(i,clear?null:t,scope);
      }
      el.querySelector("#ptMsg").textContent="Saved — syncs when online 已儲存";
      window.sqAfterOverrideChange();
    };
  }
  window.SQPapa={open};
})();
```

- [ ] **Step 2: The adapters in index.html** (papa-tools stays decoupled from app globals — this is the interface, keep it explicit). Add near `gameLockState`:

```js
/* adapters for js/papa-tools.js */
window.sqOverridesRaw=()=>(store&&store.dayOverridesRaw)||{};
window.sqSetOverride=async(i,t,kidId)=>{
  if(store&&store.setOverride)await store.setOverride(todayStr(),i,t,kidId);
  refreshOverrides();
};
window.sqAfterOverrideChange=()=>{if(hubKid&&hubTab==="day")renderMyDay();refreshLockUI();};
```

Add `.ptkid.on{background:var(--ok);color:#1c1436}` next to the pinpad CSS.

- [ ] **Step 3: Entry point + script tag.** Add `<script src="js/papa-tools.js"></script>` after `pinpad.js`. In the hub header (next to `#mute`'s markup — copy its button classes), add:

```html
<button class="iconbtn" id="papaBtn" title="Papa 爸爸">🔧</button>
```

wired once at startup near the other `onclick` wiring:

```js
document.getElementById("papaBtn").onclick=()=>SQPapa.open();
```

- [ ] **Step 4: Check + smoke**

Run: `node scripts/check.mjs` → green (incl. `resolveOverrides` test).
Browser two-device test (or two browser profiles):
- Admin, scope **All**: Homework 10:00 → 15:00, Save. Every tablet re-sorts the row after 14:00, "moved 已調整" flag, Screen #1 🔓 recomputes.
- Admin, scope **Lili**: Homework → 16:00. Lili's tablet shows 16:00 ("own move" beats the family 15:00); Lucien/Luis tablets stay at 15:00. Switching kid profiles on one tablet swaps the effective schedule (openHub → `refreshOverrides`).
- Tablet offline: 🔧 → PIN → pick Luis → move Sport → Save; reload offline: persists; reconnect: appears in Supabase + other devices.
- Reset with scope Lili clears only Lili's rows; family moves survive.

- [ ] **Step 5: Commit**

```bash
git add js/papa-tools.js index.html
git commit -m "feat: papa-tools PIN-gated reschedule with per-kid scope"
```

## DONE WHEN

- Papa moves any block for everyone or for one kid, from admin or tablet (PIN, offline-queued); kid-specific move wins over the family move for that kid only; each tablet follows its active kid's effective schedule live (timeline, announcements, screen prereqs, lock, row order); overrides vanish next day; base DAY untouched; `/check` green.
