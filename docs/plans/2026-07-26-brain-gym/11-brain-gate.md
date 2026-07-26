# Slice 11 — Brain Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the daily three brain exercises the door to every other game — seeded, synced, offline-capable, bypassable by Papa, and worth ⭐1 when the set is done.

**Architecture:** One new table (`brain_done`) mirroring `day_ticks`. The gate decision is pure logic in `brain-core`, folded into the existing `lock-core` so a single lock card names whichever reason blocks first. Papa's bypass and the difficulty override both ride `family_settings`, which already syncs.

**Tech Stack:** Vanilla ES5-compatible JS, Supabase (Postgres + RLS + realtime), `node:test`, `scripts/check.mjs`.

**Depends on:** slice 09, slice 10, and slice 03 (`family_settings`, `js/pinpad.js`, `js/papa-tools.js`).

**Ships last, on purpose:** never lock kids out of the games before the games that open the lock exist.

**Read first:** `docs/plans/2026-07-26-brain-gym/design.md` §2, §6, §7.

---

## Hard constraints

- **No `?.`, no `??`, no `.flatMap`** in `js/` or `index.html` (`scripts/check.mjs:39-44`).
- Every user-facing string is `[en, zh]`, 繁體中文, Taiwan usage.
- **Tone is non-negotiable.** The gate card invites. No red, no countdown, no "you failed", no shame. It is Papa's rule, not the app scolding.
- **The gate holds back games only.** My Day, activity guides, the Learn tab, the ask channel, and the nine brain games themselves are never gated. A gate that hides the brain games would deadlock the kid.
- Stars stay a ledger. Never write a total.

---

## File structure

| File | Change |
|---|---|
| `supabase/schema.sql` | `brain_done` table + RLS + realtime; seeded `braingate_*` / `brain_tier_*` settings rows; anon-update policy for `braingate_%`. |
| `js/brain-core.js` | `gateState`. |
| `js/lock-core.js` | `computeLock` returns `reason`; brain gate is the last-checked reason. |
| `js/sync.js` | hydrate `brain_done`; `brainDone` op; `clearBrainGate` op. |
| `index.html` | gate card + lock overlay copy, trio strip in the games tab, star award, bypass wiring. |
| `js/papa-tools.js` | "Open games today" action behind the Papa PIN. |
| `admin.html` / `js/admin.js` | per-kid difficulty select + today's Brain Gym progress. |
| `scripts/core.test.mjs`, `scripts/check.mjs` | gate tests and schema assertions. |

---

## Task 1: the schema

**Files:**
- Modify: `supabase/schema.sql` (append a new `v5 additions` section at the end)

- [x] **Step 1: Append the section**

```sql
-- ============================================================
-- v5 additions — Brain Gym (plan 2026-07-26, slices 09-11)
-- ============================================================

-- One row per brain exercise a kid finished today. Mirrors day_ticks.
-- Rows expire naturally with the day (every query filters by day).
create table if not exists brain_done (
  kid_id     text not null references kids(id),
  day        date not null,
  game_id    text not null,             -- 'calc' | 'signs' | 'lowhigh' | …
  score      int  not null default 0,
  ms         int,                       -- null on unclocked (tot) tiers
  created_at timestamptz default now(),
  primary key (kid_id, day, game_id)
);
alter table brain_done enable row level security;

do $$
begin
  execute 'drop policy if exists "read brain" on public.brain_done';
  execute 'drop policy if exists "kid brain" on public.brain_done';
  execute 'drop policy if exists "admin brain" on public.brain_done';
  execute 'drop policy if exists "kid braingate" on public.family_settings';

  execute 'create policy "read brain" on public.brain_done for select using (true)';
  execute 'create policy "kid brain" on public.brain_done for insert with check (true)';
  execute 'create policy "admin brain" on public.brain_done for all to authenticated using (true) with check (true)';

  -- Kid-device (anon) may only write the brain-gate bypass flag, set by the
  -- Papa PIN pad on the tablet. It can never touch any other setting key.
  --
  -- NOTE ON DATES: Postgres current_date is UTC; the app's day is Asia/Taipei
  -- (UTC+8), so a strict same-day equality check would reject Taipei mornings.
  -- The window below is deliberately loose — this policy's job is to stop anon
  -- writing to OTHER keys, not to enforce the calendar. Day correctness lives
  -- client-side in SQ_DAY.iso().
  execute 'create policy "kid braingate" on public.family_settings for update
    using (key like ''braingate_%'')
    with check (key like ''braingate_%''
                and (value = '''' or value::date between current_date - 1 and current_date + 1))';
end $$;

-- Seed the settings rows so the tablet only ever needs UPDATE (never INSERT).
insert into family_settings (key, value) values
  ('braingate_lucien',''), ('braingate_lili',''), ('braingate_luis',''),
  ('brain_tier_lucien',''), ('brain_tier_lili',''), ('brain_tier_luis','')
on conflict (key) do nothing;

do $$
begin
  alter publication supabase_realtime add table brain_done;
exception when duplicate_object then null;
end $$;
```

- [ ] **Step 2: Run it against Supabase**

Paste the whole new section into the Supabase SQL editor and run it. Expected: `Success. No rows returned.` Re-running must also succeed — every statement above is idempotent.

- [ ] **Step 3: Verify by hand**

In the SQL editor:

```sql
select * from brain_done limit 1;
select key, value from family_settings where key like 'brain%' order by key;
```
Expected: an empty `brain_done`, and six seeded settings rows with empty values.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(brain): add brain_done table and brain-gate settings policy"
```

---

## Task 2: gateState

**Files:**
- Modify: `js/brain-core.js`
- Test: `scripts/core.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
test("gateState counts only today's trio", () => {
  const trio = ["a", "b", "c"];
  assert.deepEqual(
    SQBrainCore.gateState({ trio: trio, done: {}, bypass: false }),
    { open: false, doneCount: 0, remaining: ["a", "b", "c"] }
  );
  assert.deepEqual(
    SQBrainCore.gateState({ trio: trio, done: { a: true, zz: true }, bypass: false }),
    { open: false, doneCount: 1, remaining: ["b", "c"] }
  );
  const all = SQBrainCore.gateState({ trio: trio, done: { a: 1, b: 1, c: 1 }, bypass: false });
  assert.equal(all.open, true);
  assert.deepEqual(all.remaining, []);
});

test("gateState opens on a bypass without touching the counter", () => {
  const out = SQBrainCore.gateState({ trio: ["a", "b", "c"], done: { a: 1 }, bypass: true });
  assert.equal(out.open, true);
  assert.equal(out.doneCount, 1);
});

test("gateState opens when there is no trio at all", () => {
  assert.equal(SQBrainCore.gateState({ trio: [], done: {}, bypass: false }).open, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/core.test.mjs`
Expected: FAIL — `SQBrainCore.gateState is not a function`

- [ ] **Step 3: Implement in `js/brain-core.js`**

```js
  /* The daily-3 door (design.md §6). Only today's trio counts — replaying a
     favourite game three times must never open the gate. */
  function gateState(ctx){
    const trio=ctx.trio||[], done=ctx.done||{};
    const remaining=trio.filter(function(id){return !done[id];});
    return {
      open:!!ctx.bypass||remaining.length===0,
      doneCount:trio.length-remaining.length,
      remaining:remaining
    };
  }
```

Add `gateState` to the exported api.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/core.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/brain-core.js scripts/core.test.mjs
git commit -m "feat(brain): add gateState"
```

---

## Task 3: fold the gate into lock-core

**Files:**
- Modify: `js/lock-core.js`
- Test: `scripts/core.test.mjs`

`computeLock` currently returns `{locked, blockIdx}`. It gains a `reason` so one card can name whichever condition blocks first, and the brain gate is checked **last** — an activity happening right now is more urgent than an exercise the kid can do any time.

- [ ] **Step 1: Write the failing tests**

```js
test("computeLock reports a reason for every existing lock", () => {
  const redo = SQLock.computeLock({ day: DAY, overrides: {}, now: 9 * 60, done: {}, redos: { 3: 1 }, brainOpen: true });
  assert.deepEqual(redo, { locked: true, blockIdx: 3, reason: "redo" });

  const act = SQLock.computeLock({ day: DAY, overrides: {}, now: 10 * 60 + 30, done: {}, redos: {}, brainOpen: true });
  assert.equal(act.locked, true);
  assert.equal(act.reason, "activity");
  assert.equal(act.blockIdx, 1);

  const clear = SQLock.computeLock({ day: DAY, overrides: {}, now: 10 * 60 + 30, done: { 1: 1 }, redos: {}, brainOpen: true });
  assert.deepEqual(clear, { locked: false, blockIdx: null, reason: null });
});

test("computeLock falls through to the brain gate once the day is clear", () => {
  const out = SQLock.computeLock({ day: DAY, overrides: {}, now: 10 * 60 + 30, done: { 1: 1 }, redos: {}, brainOpen: false });
  assert.deepEqual(out, { locked: true, blockIdx: null, reason: "brain" });
});

test("an activity lock outranks the brain gate", () => {
  const out = SQLock.computeLock({ day: DAY, overrides: {}, now: 10 * 60 + 30, done: {}, redos: {}, brainOpen: false });
  assert.equal(out.reason, "activity");
});

test("brainOpen defaults to open so existing callers are unaffected", () => {
  const out = SQLock.computeLock({ day: DAY, overrides: {}, now: 10 * 60 + 30, done: { 1: 1 }, redos: {} });
  assert.equal(out.locked, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/core.test.mjs`
Expected: FAIL — the returned objects have no `reason` key.

- [ ] **Step 3: Rewrite `js/lock-core.js`**

```js
/* SQLock — pure games-lock decision.
   Precedence (design.md §6): redo send-back > current activity > brain gate.
   Rationale: a redo and a live activity are time-sensitive; the daily brain
   set can be done at any hour, so it never masks a more urgent reason. */
(function(){
  const SQT=typeof window!=="undefined"?window.SQTime:require("./time-core.js");
  function isScreenBlock(b){return String((b&&b.title)||"").includes("Screen");}
  const OPEN={locked:false,blockIdx:null,reason:null};

  function computeLock(ctx){
    const free=i=>!!(ctx.done&&ctx.done[i])||!!(ctx.passOk&&ctx.passOk(i));
    const brainOpen=ctx.brainOpen===undefined?true:!!ctx.brainOpen;
    const gate=function(){return brainOpen?OPEN:{locked:true,blockIdx:null,reason:"brain"};};

    /* Papa send-back (design.md §8): an unticked redo block locks regardless of the clock */
    for(const k of Object.keys(ctx.redos||{})){
      if(!free(+k))return {locked:true,blockIdx:+k,reason:"redo"};
    }
    const past=SQT.timedOrder(ctx.day,ctx.overrides||{}).filter(x=>x.t<=ctx.now);
    if(!past.length)return gate();
    const cur=past[past.length-1];
    const verdict=i=>free(i)?gate():{locked:true,blockIdx:i,reason:"activity"};
    if(!isScreenBlock(ctx.day[cur.i]))return verdict(cur.i);
    for(let n=past.length-2;n>=0;n--){
      if(!isScreenBlock(ctx.day[past[n].i]))return verdict(past[n].i);
    }
    return gate();
  }

  const api={computeLock:computeLock,isScreenBlock:isScreenBlock};
  if(typeof window!=="undefined")window.SQLock=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/core.test.mjs`
Expected: PASS — including every pre-existing lock test. If an old test asserted `deepEqual(..., {locked:false, blockIdx:null})`, update it to include `reason:null`; that is the only intended breakage.

- [ ] **Step 5: Commit**

```bash
git add js/lock-core.js scripts/core.test.mjs
git commit -m "feat(brain): add the brain gate to lock-core with an explicit reason"
```

---

## Task 4: sync the daily completions

**Files:**
- Modify: `js/sync.js`

- [ ] **Step 1: Seed the local shape**

At `js/sync.js:60`, beside the existing `day` seed:

```js
      p.brain=p.brain&&typeof p.brain==="object"?p.brain:{d:"",done:{},starred:false};
      p.brain.done=p.brain.done&&typeof p.brain.done==="object"?p.brain.done:{};
```

- [ ] **Step 2: Hydrate from Supabase**

Add `brain_done` to the parallel fetch at `js/sync.js:130-137`:

```js
        this.supabase.from("brain_done").select("kid_id,day,game_id,score,ms").eq("day",seed.day),
```

Destructure it as `{data:brain}` and apply it beside the tick hydration:

```js
      (brain||[]).forEach(r=>{
        const p=progress[r.kid_id];
        if(!p)return;
        if(p.brain.d!==seed.day){p.brain={d:seed.day,done:{},starred:p.brain.starred&&p.brain.d===seed.day};}
        p.brain.done[r.game_id]={score:r.score||0,ms:r.ms||0};
      });
```

- [ ] **Step 3: Add the two ops**

In the op switch (`js/sync.js:197` local-apply and `:308` remote-flush), following the existing pattern:

```js
        }else if(op.type==="brainDone"){
          P.brain.done[op.gameId]={score:op.score||0,ms:op.ms||0};
```

```js
      }else if(op.type==="brainDone"){
        const {error}=await this.supabase.from("brain_done").upsert({
          kid_id:op.kid,day:op.day,game_id:op.gameId,score:op.score,ms:op.ms||null
        },{onConflict:"kid_id,day,game_id"});
        if(error)throw error;
      }else if(op.type==="setting"){
        const {error}=await this.supabase.from("family_settings")
          .update({key:op.key,value:op.value}).eq("key",op.key);
        if(error)throw error;
      }
```

Reuse the existing `setting` op if slice 03 already added one — check before duplicating it.

- [ ] **Step 4: Add the public methods**

Beside `setStat` at `js/sync.js:374`:

```js
    async markBrainDone(kid,day,gameId,score,ms){
      this.enqueue({type:"brainDone",kid:kid,day:day,gameId:gameId,score:score,ms:ms});
    },
    async clearBrainGate(kid,day){
      this.settings["braingate_"+kid]=day;
      this.enqueue({type:"setting",key:"braingate_"+kid,value:day});
    },
```

- [ ] **Step 5: Subscribe to realtime**

Beside the existing `day_ticks` subscription, add `brain_done` so a kid finishing an exercise on one tablet updates the other.

- [ ] **Step 6: Run the tests**

Run: `node scripts/sync.test.mjs && node scripts/check.mjs`
Expected: PASS both.

- [ ] **Step 7: Commit**

```bash
git add js/sync.js
git commit -m "feat(brain): sync brain_done completions and the gate bypass flag"
```

---

## Task 5: the gate in the kid app

**Files:**
- Modify: `index.html` — `gameLockState`, `startGame`, `showLockOverlay`, `refreshLockUI`, `renderHub`, `finishBrain`

- [ ] **Step 1: Feed the gate into `gameLockState`**

Replace the body of `gameLockState()` (`index.html:1946`):

```js
function brainToday(id){
  const p=progress[id];
  if(!p)return {};
  if(p.brain.d!==todayStr()){p.brain={d:todayStr(),done:{},starred:false};saveProgress();}
  return p.brain.done;
}
function brainTrio(id){
  const settings=(store&&store.settings)||{};
  return SQBrainCore.dailyThree(id,todayStr(),settings);
}
function brainBypass(id){
  const settings=(store&&store.settings)||{};
  if(settings["braingate_"+id]===todayStr())return true;
  /* a granted golden/excused pass dated today opens the gate too (design.md §6) */
  return !!(typeof passForDay==="function"&&passForDay(id,todayStr(),["granted","spent"]));
}
function brainGate(id){
  return SQBrainCore.gateState({trio:brainTrio(id),done:brainToday(id),bypass:brainBypass(id)});
}
function gameLockState(){
  const id=activeKid();
  const done=id?dayState(id).done:{};
  const st=SQLock.computeLock({
    day:DAY,overrides:dayOverrides,now:nowMins(),done:done,
    passOk:function(i){return passOkFor(id,i);},
    redos:(id&&store&&store.redos&&store.redos[id])||{},
    brainOpen:id?brainGate(id).open:true
  });
  if(st.locked&&st.reason!=="brain"&&lockOverride&&lockOverride.day===todayStr()&&lockOverride.blockIdx===st.blockIdx)
    return {locked:false,blockIdx:null,reason:null};
  if(!st.locked)lockOverride=null;
  return st;
}
```

If `passForDay` does not exist, write it next to the existing `passFor` helper — a pass with `day === today` and `block_idx == null`, status `granted` or `spent`.

- [ ] **Step 2: Let brain games through the lock**

In `startGame` (`index.html:1083`), the lock check must not apply to brain games — gating the door behind the door deadlocks the kid:

```js
function startGame(id,lvl){
  if(LEVELS[lvl].brain){ kid=id; hubKid=id; startBrain(lvl); return; }
  const ls=gameLockState();
  if(ls.locked){showLockOverlay(ls);return;}
  ...
```

Note `showLockOverlay` now takes the whole state, not a block index.

- [ ] **Step 3: Teach the overlay the brain reason**

Replace `showLockOverlay(blockIdx)` (`index.html:1841`) with:

```js
function showLockOverlay(st){
  if(document.getElementById("lockOverlay"))return;
  const o=document.createElement("div");
  o.className="overlay"; o.id="lockOverlay";
  o.innerHTML=st.reason==="brain"?brainLockHtml():activityLockHtml(st.blockIdx);
  document.body.appendChild(o);
  const go=o.querySelector("#lockGoDay");
  if(go)go.onclick=function(){o.remove();hubTab="day";renderHub();};
  const gym=o.querySelector("#lockGoGym");
  if(gym)gym.onclick=function(){o.remove();startGame(activeKid(),brainGate(activeKid()).remaining[0]);};
  const papa=o.querySelector("#lockPapa");
  if(papa)papa.onclick=function(){o.remove();SQPapa.open();};
}
function brainLockHtml(){
  const id=activeKid(), g=brainGate(id), trio=brainTrio(id);
  return `<div class="card" style="text-align:center;max-width:340px">
    <div style="font-size:2.2em">🧠</div>
    <h3>Brain Gym first!<span class="zht">先做頭腦體操！</span></h3>
    <p>${g.doneCount} / ${trio.length} today 今天 ${g.doneCount}/${trio.length} 😊<br>
       About 3 minutes 大約三分鐘</p>
    <div class="btrio">${trio.map(function(x){
      return `<span class="btchip${g.remaining.indexOf(x)<0?" done":""}">${LEVELS[x].icon} ${LEVELS[x].title}<span class="zhs">${LEVELS[x].tz}</span></span>`;
    }).join("")}</div>
    <div class="vrow">
      <button class="btn" id="lockGoGym">▶ Start 開始</button>
      <button class="btn small" id="lockPapa">🔧 Papa 爸爸</button>
    </div></div>`;
}
```

`activityLockHtml(blockIdx)` is the existing markup from `index.html:1846-1853`, moved into its own function unchanged.

- [ ] **Step 4: Same treatment for the inline card**

In `refreshLockUI()` (`index.html:1958`), branch on `ls.reason`:

```js
    card.innerHTML=ls.reason==="brain"
      ? `🧠 Brain Gym first! 先做頭腦體操！ ${brainGate(activeKid()).doneCount}/3 today 今天 — tap a 🧠 game below to start! 點下面的頭腦遊戲開始！`
      : (function(){const b=DAY[ls.blockIdx];return `${b.icon} It's ${b.title.split("—")[0].trim()} time — games are resting 遊戲休息中。 Tick it in My Day to unlock! 在「我的一天」打勾就能解鎖！`;})();
```

- [ ] **Step 5: Show today's trio in the games tab**

In `renderHub()` (`index.html:2218`), sort brain games in today's trio to the front and badge them:

```js
  const trio=brainTrio(hubKid), bdone=brainToday(hubKid);
  const order=trio.concat([k.level]).concat(Object.keys(LEVELS).filter(function(l){
    return trio.indexOf(l)<0&&l!==k.level;}));
```

and inside the card template, after the `MY GAME` tag:

```js
      ${trio.indexOf(l)>=0?`<span class="todaytag${bdone[l]?" done":""}">${bdone[l]?"✓ done 完成":"today 今天"}</span>`:""}
```

Styles to append to `index.html`:

```css
.btrio{display:flex;flex-wrap:wrap;gap:.4em;justify-content:center;margin:.6em 0}
.btchip{background:rgba(255,255,255,.09);border-radius:12px;padding:.35em .6em;font-size:.85em}
.btchip.done{opacity:.5;text-decoration:line-through}
.todaytag{display:block;font-size:.72em;margin-top:.3em;color:var(--accent)}
.todaytag.done{opacity:.6}
```

- [ ] **Step 6: Record the completion and award the star**

Extend `finishBrain` from slice 09, after the best-score block:

```js
  /* daily-3 progress (design.md §6-§7) */
  const day=todayStr(), trio=brainTrio(k), p2=progress[k];
  if(p2.brain.d!==day)p2.brain={d:day,done:{},starred:false};
  const first=!p2.brain.done[res.gameId];
  p2.brain.done[res.gameId]={score:res.score,ms:res.ms};
  if(first&&store)store.markBrainDone(k,day,res.gameId,res.score,res.ms);

  const gate=SQBrainCore.gateState({trio:trio,done:p2.brain.done,bypass:false});
  let earned=false;
  if(gate.open&&!p2.brain.starred){
    /* ⭐1 for the set, once (design.md §7). The ledger has no unique
       constraint, so this client-side guard is what prevents a double award. */
    p2.brain.starred=true;
    p2.stars+=1;
    if(store)store.addStar(k,1,"brain gym: "+day);
    earned=true;
  }
  saveProgress();
  refreshLockUI();
  showBrainResult(res,better,earned);
```

Use whatever the existing ledger helper is named — grep for `"day mission: "` in `index.html` and call the same function with `"brain gym: "+day`.

In `showBrainResult`, when `earned` is true, add the celebration and the unlock message:

```js
    ${earned?`<p>⭐ Brain Gym complete! 頭腦體操完成！<br>All games unlocked 🔓 遊戲全部解鎖</p>`:""}
```
and call `burst(60)` plus the existing `star()` float.

- [ ] **Step 7: Run the check**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed: ...`

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat(brain): gate the games behind the daily three exercises"
```

---

## Task 6: the Papa PIN bypass

**Files:**
- Modify: `js/papa-tools.js`

- [ ] **Step 1: Add the action to the Papa menu**

Beside the existing unlock / reschedule / outing entries:

```js
      `<button class="btn" id="ptBrain">🧠 Open games today 今天開放遊戲</button>`
```

and its handler:

```js
    const brainBtn=root.querySelector("#ptBrain");
    if(brainBtn)brainBtn.onclick=function(){
      const kid=opts.activeKid(), day=opts.today();
      if(opts.store)opts.store.clearBrainGate(kid,day);
      opts.onChange();
      opts.toast(["Games open for today","今天遊戲已開放"]);
    };
```

Follow the file's existing dependency-injection shape exactly — `papa-tools.js` must not reach for globals. If `opts.store` / `opts.toast` are not already injected, add them at the single call site in `index.html`.

- [ ] **Step 2: Verify it works offline**

The `setting` op goes through the same offline queue as everything else, and `store.settings` is updated locally first, so the gate opens instantly with wifi off and the write lands when the queue drains.

- [ ] **Step 3: Manual test**

1. With the gate closed, tap a locked game → the Brain Gym card appears.
2. Tap 🔧 Papa → enter the PIN → 🧠 Open games today.
3. Expect: the card disappears, every game opens, and the trio strip still shows 0/3 (a bypass is not a completion).
4. Reload the page. Expect: still open.
5. Change the device date to tomorrow (or wait). Expect: the gate is back.

- [ ] **Step 4: Commit**

```bash
git add js/papa-tools.js index.html
git commit -m "feat(brain): let the Papa PIN open today's games without the brain set"
```

---

## Task 7: admin — difficulty override and today's progress

**Files:**
- Modify: `admin.html`, `js/admin.js`

- [ ] **Step 1: Add the difficulty control**

In the admin settings panel, one select per kid:

```html
<div class="row" id="brainTiers"></div>
```

```js
function renderBrainTiers(){
  const TIERS=[["", "Auto 自動"],["tot","Easiest 最簡單"],["mid","Middle 中等"],["hard","Hardest 最難"]];
  document.getElementById("brainTiers").innerHTML=KID_IDS.map(function(k){
    const cur=settings["brain_tier_"+k]||"";
    return `<label class="fld">${KIDS[k].name}
      <select data-kid="${k}" class="btier">${TIERS.map(function(t){
        return `<option value="${t[0]}"${t[0]===cur?" selected":""}>${t[1]}</option>`;}).join("")}</select>
    </label>`;
  }).join("");
  document.querySelectorAll(".btier").forEach(function(s){
    s.onchange=function(){ setSetting("brain_tier_"+s.dataset.kid,s.value); };
  });
}
```

`setSetting` is the existing admin helper that upserts into `family_settings` — reuse it, do not write a second one. An empty value means "auto", which is exactly what `tierFor` falls back on.

- [ ] **Step 2: Show today's Brain Gym progress**

In the daily overview, one line per kid:

```js
function brainLine(kid){
  const trio=SQBrainCore.dailyThree(kid,todayISO(),settings);
  const done=brainDoneToday[kid]||{};
  return trio.map(function(id){
    const g=SQBrainData.GAMES[id], d=done[id];
    return `<span class="btchip${d?" done":""}">${g.icon} ${g.title[0]}${d?" "+d.score:""}</span>`;
  }).join("");
}
```

Load `brainDoneToday` from `brain_done` filtered on today, next to the existing ticks query. Add the three brain scripts to `admin.html` so `SQBrainCore` and `SQBrainData` exist there:

```html
<script src="js/brain-data.js"></script>
<script src="js/brain-core.js"></script>
```

`brain-ui.js` is **not** needed in admin — Papa never plays a round there.

- [ ] **Step 3: Run the check**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed: ...`

- [ ] **Step 4: Commit**

```bash
git add admin.html js/admin.js
git commit -m "feat(brain): admin difficulty override and daily Brain Gym progress"
```

---

## Task 8: guard the whole thing in check.mjs

**Files:**
- Modify: `scripts/check.mjs`

- [ ] **Step 1: Add the schema and wiring assertions**

Beside the existing `captain` assertions (`scripts/check.mjs:172-180`):

```js
if (!schemaSql.includes("create table if not exists brain_done")) {
  fail("brain gate", "schema missing brain_done table");
}
if (!schemaSql.includes("kid braingate")) {
  fail("brain gate", "schema missing the anon braingate policy");
}
if (!indexHtml.includes("brainGate") || !indexHtml.includes("brainTrio")) {
  fail("brain gate", "kid app missing gate wiring");
}
if (!indexHtml.includes('reason==="brain"')) {
  fail("brain gate", "lock overlay does not handle the brain reason");
}
if (!adminHtml.includes("brainTiers")) {
  fail("brain gate", "admin missing the difficulty override control");
}
```

- [ ] **Step 2: Assert the tone rules mechanically where possible**

```js
const brainCopy = (indexHtml.match(/Brain Gym[^`<]*/g) || []).join(" ");
if (!/先做頭腦體操|頭腦體操/.test(indexHtml)) {
  fail("brain gate", "gate copy is missing its 中文 half");
}
```

- [ ] **Step 3: Run the check**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed: ...`

- [ ] **Step 4: Full manual acceptance pass**

| Scenario | Expected |
|---|---|
| Fresh morning, no exercises done | every non-brain game shows the 🧠 Brain Gym card; the three trio games are badged "today 今天" and sorted first |
| Tap a trio game and finish it | badge flips to "✓ done 完成", card says 1/3 |
| Finish all three | ⭐1 awarded once, confetti, "All games unlocked 🔓", every game opens |
| Replay a finished game | best score may improve; **no second star** |
| Play a non-trio brain game | counter does not move |
| Open the app on the second tablet | the same trio, the same progress, within a second (realtime) |
| Wifi off, finish the set | star and unlock happen immediately; both reach Supabase when wifi returns |
| Wifi off, reload mid-set | progress survives (localStorage) |
| An activity block is live and unticked | the card names the **activity**, not the brain gym |
| Tick that activity, gate still shut | the card switches to the brain gym |
| Papa PIN → Open games today | everything opens, counter stays where it was |
| Grant a golden pass dated today | everything opens |
| Outing mode on | gate still applies (Papa's decision) — verify it does **not** silently open |
| Next day | gate is back, a new trio, `starred` reset |
| Admin sets Lucien to "Middle" | his trio may change (different eligible pool), his games gain a clock |
| Papa pauses the app | the pause overlay wins; the brain card is not shown underneath |

- [ ] **Step 5: Commit**

```bash
git add scripts/check.mjs
git commit -m "test(brain): guard the brain gate wiring in check"
```

---

## DONE WHEN

- `node scripts/check.mjs` is green.
- A kid who has done nothing today cannot open Word Racer, Orc Attack, or any other non-brain game — and *can* open all nine brain games.
- Finishing today's three awards exactly ⭐1, once, and opens everything.
- The trio is identical on both tablets and works with wifi off.
- Only one lock card is ever visible, naming the most urgent reason.
- Papa's PIN and a granted pass both open the games; outing mode does not.
- The gate resets at Asia/Taipei midnight, with a fresh trio.
- Admin can set any kid's difficulty, and "Auto" restores the age default.
- No copy anywhere is red, counts down, or blames the kid.
