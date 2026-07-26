# Slice 05 — Outing Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Papa marks a block range as a family outing (🚶) for all kids — blocks stop nagging, the lock stays off, day-complete stays reachable, and Papa chooses per outing whether blocks are **credited** (⭐ each, default) or **excused** (no stars).

**Architecture:** An outing is a bulk pass: one `passes` row per kid per block with `kind='outing'`, `status='granted'`, plus a new `credited` boolean. Everything downstream is already built: `passFor` renders it, `passOkFor` (slice 03) silences the lock, P2's day-complete pass handling counts it. Credited stars go through the `stars_ledger` via the existing queue op. Toggled from admin and from `papa-tools` (slice 04) — offline-queued with client uuids for idempotency.

**Tech Stack:** Vanilla JS, Supabase (RLS), `node scripts/check.mjs`.

**Read first:** `design.md` §3 + §6. Tone: outing is a **neutral/positive** state — never amber, never "late".

**Prerequisites:** slices 03 + 04 merged (pinpad, papa-tools, family_settings). GPT's P2 pass lifecycle landed — **verify how day-complete counts passed blocks before Task 3 and reuse that exact mechanism.**

**⚠ Concurrency:** another agent may be committing. Start clean and up to date; anchor by snippets, not line numbers.

---

### Task 1: Schema — outing kind + credited flag + anon policies

**Files:**
- Modify: `supabase/schema.sql` (append to the v3 section)

- [ ] **Step 1: Append**

```sql
-- Outing mode: bulk 'outing' passes over a block range (design.md §3).
-- credited=true → each block earns its star (family time counts); false → excused, no stars.
alter table passes add column if not exists credited boolean not null default true;
-- Tablets create outing rows via the Papa PIN pad (anon role) — status is 'granted' directly.
create policy "outing toggle" on passes for insert
  with check (kind = 'outing' and status = 'granted');
create policy "outing undo" on passes for delete
  using (kind = 'outing');
```

(The existing `"kid request"` insert policy only allows `status='requested'`; policies are OR-ed, so this addition permits exactly the outing shape and nothing more.)

- [ ] **Step 2: Apply** via Supabase MCP / SQL editor. Verify: as anon, inserting `{kind:'outing',status:'granted',...}` succeeds and `{kind:'golden',status:'granted'}` still fails.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: outing pass kind with credited flag and anon toggle policies"
```

---

### Task 2: sync.js — idempotent outing op

**Files:**
- Modify: `js/sync.js`

- [ ] **Step 1: Queue op** — add a branch in `applyOp(op)`:

```js
      }else if(op.type==="outingBlock"){
        const {error}=await this.supabase.from("passes").insert({
          id:op.id,kid_id:op.kid,kind:"outing",status:"granted",
          day:op.day,block_idx:op.blockIdx,reason:op.reason||"Family outing 家庭出遊",
          credited:!!op.credited
        });
        if(error&&error.code!=="23505") throw error;
```

(`op.id` is the client uuid `enqueue` already stamps — retries dedupe on the primary key, same pattern as the `stars` op.)

- [ ] **Step 2: Method** — next to `requestPass(...)` add:

```js
    async setOuting(kids,dayISO,blockIdxs,credited,reason){
      kids.forEach(kid=>blockIdxs.forEach(blockIdx=>{
        this.enqueue({type:"outingBlock",kid,day:dayISO,blockIdx,credited,reason});
        /* optimistic local row so passFor/lock react before the flush */
        this.passes.unshift({kid_id:kid,kind:"outing",status:"granted",day:dayISO,block_idx:blockIdx,credited:!!credited,reason});
        if(credited)this.enqueue({type:"stars",kid,delta:1,reason:"Outing 出遊"});
      }));
      await this.flush();
    }
```

Stars stay a **ledger** (CLAUDE.md invariant) — one +1 delta per credited block per kid, never a counter write.

- [ ] **Step 3: Commit**

```bash
git add js/sync.js
git commit -m "feat: idempotent outing op with optional credited stars"
```

---

### Task 3: Kid tablet rendering + day-complete

**Files:**
- Modify: `index.html`

- [ ] **Step 1: `passText` outing case** — extend the function:

```js
function passText(p){
  if(!p)return "";
  if(p.kind==="outing")return `🚶 Family outing 家庭出遊${p.credited?" ⭐":""}`;
  const kind=p.kind==="golden"?"Golden pass 黃金券":"Excused pass 請假券";
  ...
```

(rest unchanged).

- [ ] **Step 2: Row state** — in `renderMyDay()`'s row loop, outing must never look late/amber. Where `rowState` is computed, put outing first:

```js
      const isDone=!!d.done[i], mis=missionFor(hubKid,i);
      const pass=passFor(hubKid,i), proof=proofFor(hubKid,i);
      const outing=pass&&pass.kind==="outing";
      const rowState=outing?"done":isDone?"done":i===info.current?"now":i===info.next?"next":SQTime.effMins(DAY,dayOverrides,i)!=null&&SQTime.effMins(DAY,dayOverrides,i)<info.now?"past":"";
```

and suppress `timeFlag` for outing rows: change `${screenStatus(i,d)}${timeFlag(i,isDone,info)}` to `${screenStatus(i,d)}${timeFlag(i,isDone||outing,info)}`. Also hide the tick/dice/pass buttons on outing rows — wrap the `dbtns` content: `${outing?"":`…existing buttons…`}`.

- [ ] **Step 3: Day-complete + progress.** Find how P2 made passed blocks count (grep `passFor` usages around the progress computation / `data-done` handler). Extend the same mechanism so `kind==="outing"` granted rows count exactly like a granted-spent pass: the `done/total` bar and the `>=DAY.length` day-complete bonus must treat outing blocks as covered. If P2 counts via a helper (e.g. `coveredCount`), add outing there; if it counts only `d.done`, introduce:

```js
function coveredCount(id,d){
  let n=Object.keys(d.done).length;
  DAY.forEach((b,i)=>{
    if(!d.done[i]&&passFor(id,i,["granted","spent"]))n++;
  });
  return n;
}
```

and use it for `done` in `renderMyDay` and for the day-complete check in the `data-done` handler (`if(coveredCount(hubKid,d2)>=DAY.length)`), replacing the raw `Object.keys(...).length` in both spots. Whichever path exists, **one** helper must own "is this block covered" — do not fork the logic.

- [ ] **Step 4: Screen prerequisites.** In `screenStatus`, a block covered by a pass/outing counts as done:

```js
  const earned=needed.every(idx=>d.done[idx]||passOkFor(hubKid,idx));
```

- [ ] **Step 5: Lock.** Nothing to do — `passOkFor` (slice 03) already treats granted outing rows as pass-covered. Confirm with the lock tests scenario manually.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: outing blocks render neutral, count toward day-complete"
```

---

### Task 4: Toggles — papa-tools + admin

**Files:**
- Modify: `js/papa-tools.js`, `index.html`, `admin.html`, `js/admin.js`

- [ ] **Step 1: papa-tools menu entry.** In `menu()` add a button after `#ptResched`:

```html
<button class="btn" id="ptOuting">🚶 Outing 出遊</button>
```

wired to `outing(o.querySelector("#ptBody"))`, and add:

```js
  function outing(el){
    const blocks=window.SQTime.timedOrder(window.SQ_DAY,window.sqDayOverrides());
    el.innerHTML=`<p>Which blocks are we out for? 我們出門的時段？</p>
      <div class="vrow" style="flex-wrap:wrap">${blocks.map(x=>{
        const b=window.SQ_DAY[x.i];
        return `<button class="btn small ptblk" data-oi="${x.i}">${b.icon} ${b.t}</button>`;
      }).join("")}</div>
      <label class="vrow"><input type="checkbox" id="ptCredited" checked>
        Blocks still earn stars ⭐ 出遊也算完成、得星星</label>
      <button class="btn" id="ptOutGo">Mark outing 標記出遊</button>
      <div class="tipline" id="ptMsg"></div>`;
    const sel=new Set();
    el.querySelectorAll(".ptblk").forEach(b=>b.onclick=()=>{
      const i=+b.dataset.oi;
      sel.has(i)?sel.delete(i):sel.add(i);
      b.classList.toggle("on",sel.has(i));
    });
    el.querySelector("#ptOutGo").onclick=async()=>{
      if(!sel.size){el.querySelector("#ptMsg").textContent="Pick blocks first 先選時段";return;}
      await window.sqSetOuting([...sel],el.querySelector("#ptCredited").checked);
      el.querySelector("#ptMsg").textContent="Marked — enjoy! 已標記，玩得開心！";
      window.sqAfterOverrideChange();
    };
  }
```

- [ ] **Step 2: The adapter in index.html** (next to the slice-04 adapters):

```js
window.sqSetOuting=async(blockIdxs,credited)=>{
  if(store&&store.setOuting)
    await store.setOuting(["lucien","lili","luis"],todayStr(),blockIdxs,credited,"Family outing 家庭出遊");
  if(hubKid&&hubTab==="day")renderMyDay();
};
```

Plus a `.ptblk.on` style near the pinpad CSS: `.ptblk.on{background:var(--ok);color:#1c1436}`.

- [ ] **Step 3: Admin panel.** In `admin.html`, add inside the Reschedule panel (or as its own panel below it):

```html
<section class="panel">
  <h2 class="section-title">Outing today 今天出遊</h2>
  <div id="outingBlocks" class="row" style="flex-wrap:wrap"></div>
  <label class="row"><input type="checkbox" id="outingCredited" checked>
    Blocks still earn stars ⭐</label>
  <div class="row">
    <button class="btn" id="outingGoBtn">Mark outing 標記出遊</button>
    <button class="btn btn--secondary" id="outingClearBtn">Undo today's outing 取消出遊</button>
  </div>
  <p class="message message--ok" id="outingStatus"></p>
</section>
```

In `js/admin.js` (admin is authenticated → direct inserts; ledger rows carry `source:'admin'` and `granted_by` like `grantStars` does — copy its insert shape):

```js
  const outingSel=new Set();
  function renderOutingBlocks(){
    const DAYP=window.SQ_DAY;
    $("outingBlocks").innerHTML=SQTime.timedOrder(DAYP,overridesToday).map(x=>{
      const b=DAYP[x.i];
      return `<button class="btn btn--secondary outblk ${outingSel.has(x.i)?"on":""}" data-oi="${x.i}">${b.icon} ${b.t} ${b.title}</button>`;
    }).join("");
    document.querySelectorAll(".outblk").forEach(btn=>btn.onclick=()=>{
      const i=+btn.dataset.oi;
      outingSel.has(i)?outingSel.delete(i):outingSel.add(i);
      renderOutingBlocks();
    });
  }
  async function markOuting(){
    if(!outingSel.size){$("outingStatus").textContent="Pick blocks first 先選時段";return;}
    const credited=$("outingCredited").checked, kids=["lucien","lili","luis"], rows=[], stars=[];
    kids.forEach(k=>outingSel.forEach(i=>{
      rows.push({kid_id:k,kind:"outing",status:"granted",day:dayISO(),block_idx:i,
        reason:"Family outing 家庭出遊",credited});
      if(credited)stars.push({kid_id:k,delta:1,reason:"Outing 出遊",source:"admin"});
    }));
    const r1=await client.from("passes").insert(rows);
    const r2=stars.length?await client.from("stars_ledger").insert(stars):{};
    $("outingStatus").textContent=(r1.error||r2.error)?(r1.error||r2.error).message:"Marked 已標記 ✓";
  }
  async function clearOuting(){
    const {error}=await client.from("passes").delete().eq("day",dayISO()).eq("kind","outing");
    $("outingStatus").textContent=error?error.message:"Cleared 已取消 ✓";
  }
```

Wire `renderOutingBlocks()` into `loadAll()` after `loadOverrides()`, and the two buttons with the others. Match `grantStars`' exact `stars_ledger` insert shape (it may include `granted_by: session.user.id` — copy it).

- [ ] **Step 4: Check + smoke**

Run: `node scripts/check.mjs` → green.
Smoke:
- Admin marks the whole morning credited: tablets show 🚶 rows (not amber), stars land via realtime fanfare, progress bar includes the blocks, games lock silent during those blocks.
- Excused variant: no stars, day-complete bonus still reachable by finishing the remaining blocks.
- Tablet offline: 🔧 → Outing → morning blocks → apply; queue flushes on reconnect without duplicate rows (uuid dedupe) or duplicate stars.
- Undo removes rows; tablets drop 🚶 on next hydrate/realtime.

- [ ] **Step 5: Commit**

```bash
git add js/papa-tools.js index.html admin.html js/admin.js
git commit -m "feat: outing toggles in admin and papa-tools"
```

## DONE WHEN

- Whole-morning outing marked from admin or tablet (PIN, offline-safe); 🚶 neutral rendering; credited default awards ledger stars, excused doesn't; day-complete reachable either way; lock never fires on outing blocks; no duplicate rows/stars after offline replay; `/check` green.
