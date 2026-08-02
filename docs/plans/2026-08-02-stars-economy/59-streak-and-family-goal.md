# Slice 59 — Streaks 🔥 and the family goal 🏠

**Goal:** The two hooks that make a kid want the 9th star at 7pm — a flame they do not want to lose, and a bar the three of them fill together.

**Implements:** design.md D8, D10.

**Design:** `docs/plans/2026-08-02-stars-economy/design.md` §2 D8, D10.

**Depends on:** slice 54 (**hard** — `uniq_streak_bonus` and the widened `delta between 1 and 5`), 55 (**hard** — `streakFrom`, `streakBonus`, `streakReason`, `goalTarget`), 56 (**hard** — the hub header this renders into).

**DONE WHEN:**
- The hub header shows 🔥 and the current streak whenever it is ≥ 1.
- Completing a third consecutive day pays **+2 🪙** exactly once, and a seventh pays **+5 🪙**.
- Re-opening the app, reloading, or opening the same kid on a second tablet pays the bonus **no additional times**.
- Breaking a streak shows no red, no shame, and no count of what was lost — only `Start a new streak today 今天重新開始`.
- An unfinished morning does not show a broken streak.
- Every kid's hub shows one family bar summing all three ⭐ toward the target, with Papa's prize named.
- Buying anything leaves the family bar unmoved.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **The streak is derived, never stored.** No `progress[kid].streak`, no `family_settings` streak key, no localStorage counter. `SQShop.streakFrom` computes it from history every render. Storing it reintroduces exactly the bug class that plan `2026-07-29-star-source-of-truth` spent five slices deleting — and there is nowhere to put it anyway: kid RLS on `family_settings` only permits `applock_*` and `braingate_*` (`supabase/schema.sql:489`, `:540`).
2. **Do not add a client-side "already awarded" flag.** `uniq_streak_bonus` makes the second insert a `23505` and `applyOp` already swallows it (`js/sync.js:430`). That is the whole guard. A localStorage latch on top would be a second source of truth that can disagree with the database.
3. **Streak bonus reasons come from `SQShop.streakReason` only.** The `Streak` prefix is what the partial index matches; a hand-written reason silently disables deduplication.
4. **The family bar sums ⭐, never 🪙** (design D10). If a kid buying a Golden Pass moves the family bar, you have used the wrong number and turned every purchase into a betrayal of their siblings.
5. **Coach, not cop.** A broken streak is rendered as an invitation. No red, no `😢`, no "you lost your 6-day streak". This is a CLAUDE.md non-negotiable, not a style preference.
6. **No streak freezes, no leaderboard, no per-kid streak comparison** (design §3). Papa can already grant bonus stars by hand if a holiday costs someone a streak.
7. **Never write `.stars` in `index.html`** — `scripts/check.mjs:539`.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/sync.js` | Modify | 30-day tick/pass history in `hydrate`, `coveredHistory()` |
| `index.html` | Modify | streak pill, bonus award, family bar |
| `scripts/sync.test.mjs` | Modify | history-shape test |
| `sw.js` | Modify | `CACHE_NAME` bump |

---

## Task 1: Thirty days of history

**File:** `js/sync.js`.

- [ ] **Step 1: Write the failing test.** Append to `scripts/sync.test.mjs` in the file's bare-block style (**not** `node:test` — see slice 56 Task 1), using the `makeStore` helper slice 56 added:

```js
// --- Test 10: coveredHistory folds ticks and passes into blocks-per-day (slice 59) ---
{
  const store = makeStore();
  store.dayHistory = {
    ticks: [
      { kid_id: "lili", day: "2026-08-01", block_idx: 0 },
      { kid_id: "lili", day: "2026-08-01", block_idx: 1 },
      { kid_id: "lili", day: "2026-07-31", block_idx: 0 },
      { kid_id: "luis", day: "2026-08-01", block_idx: 5 },
    ],
    passes: [
      { kid_id: "lili", day: "2026-08-01", block_idx: 2, status: "granted" },
      { kid_id: "lili", day: "2026-08-01", block_idx: 0, status: "granted" }, // already ticked
      { kid_id: "lili", day: "2026-08-01", block_idx: 9, status: "denied" },  // must not count
    ],
  };
  const h = store.coveredHistory("lili");
  assert.equal(h["2026-08-01"], 3, "blocks 0,1 ticked + block 2 passed; the duplicate on 0 counts once");
  assert.equal(h["2026-07-31"], 1);
  assert.equal(h["2026-06-01"], undefined, "days with nothing are absent, not zero");
  assert.equal(store.coveredHistory("nobody")["2026-08-01"], undefined, "other kids' rows are not counted");
}
```

- [ ] **Step 2: Run it, confirm it fails.**

Run: `node --test scripts/sync.test.mjs`
Expected: FAIL — `store.coveredHistory is not a function`.

- [ ] **Step 3:** Add the fold to `js/sync.js`, next to `queuedStarDelta`:

```js
    /* Blocks covered per day, for the streak. A block counts once whether it was
       ticked or covered by a pass — the same union the admin's dayComplete uses
       (js/admin.js:176) — so a Golden Pass day is still a complete day. */
    coveredHistory(kid){
      const h=this.dayHistory||{ticks:[],passes:[]};
      const seen={};
      (h.ticks||[]).forEach(function(r){
        if(!r||r.kid_id!==kid||!r.day)return;
        (seen[r.day]=seen[r.day]||{})[r.block_idx]=1;
      });
      (h.passes||[]).forEach(function(r){
        if(!r||r.kid_id!==kid||!r.day)return;
        if(r.status!=="granted"&&r.status!=="spent")return;
        (seen[r.day]=seen[r.day]||{})[r.block_idx]=1;
      });
      const out={};
      Object.keys(seen).forEach(function(day){out[day]=Object.keys(seen[day]).length;});
      return out;
    }
```

- [ ] **Step 4:** Seed the field in the constructor, beside `this.serverStars` (line 135), so an offline boot still has a streak:

```js
      /* 30 days of ticks + passes, only for the streak. Cached like the star
         totals: with wifi off the flame must still be right. */
      this.dayHistory=loadJson("sq:dayHistory",{ticks:[],passes:[]});
```

- [ ] **Step 5: Read this before touching `hydrate()`.** Its `Promise.all` is destructured **positionally** across fifteen bindings on one line (`js/sync.js:218`):

```js
      const [{data:kids},{data:ticks},{data:rolls},{data:acts},{data:totals},{data:vocab},{data:stats},{data:note},{data:passes},{data:photos},{data:helpClaims},{data:famSettings},{data:overrides},{data:redos},{data:brain}]=await Promise.all([
```

Inserting a query in the middle shifts every binding after it by one, silently — `passes` would receive `photos`, and nothing would throw. **Append both new queries to the very END of the array, and both new bindings to the very END of the destructure.** Nowhere else.

Add `since30` at the top of `hydrate()`, beside the existing `day`:

```js
      /* 32 days, not 30: a 30-day streak needs 30 full days of history behind
         today, plus slack for the Taipei/UTC boundary. `day` is already the
         shared Asia/Taipei today (CLAUDE.md: all day maths goes through it);
         this only walks backwards from it and never calls new Date() on now. */
      const since30=(function(){
        const d=new Date(day+"T00:00:00Z");
        d.setUTCDate(d.getUTCDate()-32);
        return d.toISOString().slice(0,10);
      })();
```

- [ ] **Step 6:** Append to the **end** of the `Promise.all` array:

```js
        this.supabase.from("day_ticks").select("kid_id,day,block_idx").gte("day",since30),
        this.supabase.from("passes").select("kid_id,day,block_idx,status").gte("day",since30),
```

and to the **end** of the destructure, after `{data:brain}`:

```js
,{data:histTicks},{data:histPasses}
```

- [ ] **Step 7:** Store them, next to the other post-hydrate assignments (`this.passes=passes||[];` at line 240 area):

```js
      this.dayHistory={ticks:histTicks||[],passes:histPasses||[]};
      saveJson("sq:dayHistory",this.dayHistory);
```

- [ ] **Step 8: Verify the destructure did not shift.** Before running anything else, in the kid app console:

```js
// each must be an array of the right shape, not each other's data
console.log(store.passes[0], store.dayHistory.ticks.length);
```

If `store.passes` now holds photo rows, you inserted in the middle. Fix it before continuing — this failure is invisible until a pass silently stops working.

- [ ] **Step 9:** Add `"sq:dayHistory"` to the season-reset key list (line 261), beside `"sq:serverStars"` and `"sq:serverCoins"`.

- [ ] **Step 10: Run the tests, confirm green.** Then commit.

```bash
git add js/sync.js scripts/sync.test.mjs
git commit -m "feat(streak): 30 days of covered-block history, derived not stored"
```

---

## Task 2: The flame

**File:** `index.html`.

- [ ] **Step 1:** Add the accessor beside `coinsOf` (slice 56):

```js
const streakOf=id=>store?SQShop.streakFrom(store.coveredHistory(id),DAY.length,todayStr()):0;
```

- [ ] **Step 2:** Extend the hub header from slice 56. Add the flame pill **only when the streak is ≥ 1** — a `🔥 0` pill would be a daily reminder of failure:

```js
  const st=streakOf(hubKid);
  // …after the rank pill…
  (st>0?`<span class="starpill firepill">🔥 ${st}</span>`:"")
```

- [ ] **Step 3:** Style, next to `.coinpill`:

```css
.firepill{background:#ff7a3d;color:#2a1000}
```

- [ ] **Step 4:** Award the bonus. Add this function next to `streakOf`:

```js
/* Called after any block completes. The database is the guard, not this code:
   uniq_streak_bonus makes a duplicate insert a 23505 that applyOp swallows, so
   a reload, a second tablet and a re-check all collapse to one row (design D8). */
async function checkStreakBonus(id){
  if(!store)return;
  const n=streakOf(id), bonus=SQShop.streakBonus(n);
  if(!bonus)return;
  store.addStars(id,bonus,SQShop.streakReason(n,todayStr()));
  sWin(); bigFloat("🔥");
  SQNotify.push(id,hubKid,{kind:"star",icon:"🔥",tone:"ok",
    en:n+" days in a row! +"+bonus+" 🪙",zh:"連續 "+n+" 天！+"+bonus+" 金幣",sub:""});
}
```

- [ ] **Step 5:** Call it where a day becomes complete. There are **exactly two** award sites, and they use **different variable names** — `d2` in `tickBlockDone` and `d` in `usePass`:

| Line | Function | Guard |
|---|---|---|
| 2119 | `tickBlockDone` | `if(coveredCount(hubKid,d2)>=DAY.length){` |
| 2253 | `usePass` | `if(coveredCount(hubKid,d)>=DAY.length){` |

Search with the name-agnostic pattern, or you will find only one of them:

```bash
grep -n "coveredCount(hubKid,[a-z0-9]*)>=DAY.length" index.html
```

Line 2128 (`const total=DAY.length, done=coveredCount(hubKid,d);`) also matches `coveredCount` but is a **display counter, not an award site** — do not add the call there, it renders on every paint and would fire the celebration constantly.

Inside **each** of the two win branches, immediately after the existing celebration:

```js
    await store.hydrate();          // the new tick must be in dayHistory before counting
    await checkStreakBonus(hubKid);
```

`usePass` already calls `store.hydrate()` at the end of its body — do not add a second one there; place `checkStreakBonus` after the existing hydrate instead. **A missed site is a kid whose streak silently never pays.**

- [ ] **Step 6:** The broken-streak invitation. In the Rewards → 🪙 Shop segment header, or beneath the wallet line in `shopHtml`, add:

```js
    ${streakOf(id)===0?`<div class="tipline">🔥 Start a new streak today 今天重新開始 — finish every block 完成所有格子</div>`:""}
```

No red, no count of what was lost, no reference to a previous streak. Re-read constraint 5 before writing anything else here.

- [ ] **Step 7:** `sw.js` — bump `CACHE_NAME` to `summer-quest-v74`. `node scripts/check.mjs` — green. Commit.

```bash
git add index.html sw.js
git commit -m "feat(streak): the flame, and the bonus the database deduplicates"
```

---

## Task 3: The family goal

**File:** `index.html`.

- [ ] **Step 1:** Add the bar next to `shopHtml`:

```js
/* Sums ⭐, never 🪙 — one kid's shopping must never set the family back, or
   every purchase becomes a betrayal of their siblings (design D10). */
function familyGoalHtml(){
  const cfg=shopCfg();
  const total=Object.keys(KIDS).reduce((sum,id)=>sum+starsOf(id),0);
  const pct=Math.min(100,Math.round(total/cfg.goalTarget*100));
  const named=cfg.goalRewardEn&&cfg.goalRewardZh;
  const prize=named
    ?`${escHtml(cfg.goalRewardEn)}<span class="zhs">${escHtml(cfg.goalRewardZh)}</span>`
    :`Papa is choosing the prize<span class="zhs">爸爸在想獎品</span>`;
  return `<div class="goalbar">
    <div class="goalhead">🏠 Together 一起 <b>${total}</b>/${cfg.goalTarget} ⭐</div>
    <div class="goaltrack"><div class="goalfill" style="width:${pct}%"></div></div>
    <div class="goalprize">${prize}</div>
  </div>`;
}
```

- [ ] **Step 2:** Render it in `renderHubHead`, beneath the header pills, so every kid sees it on every tab. Find where `#hubHead` is populated and append `familyGoalHtml()` to that markup.

- [ ] **Step 3:** Styles:

```css
.goalbar{margin-top:10px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.10)}
.goalhead{font-size:15px}
.goaltrack{height:10px;border-radius:6px;background:rgba(0,0,0,.25);margin:6px 0;overflow:hidden}
.goalfill{height:100%;background:linear-gradient(90deg,#ffd34d,#ff7a3d);transition:width .4s ease}
.goalprize{font-size:13px;opacity:.85}
```

- [ ] **Step 4:** `sw.js` — bump `CACHE_NAME` to `summer-quest-v75`. `node scripts/check.mjs` — green. Commit.

```bash
git add index.html sw.js
git commit -m "feat(goal): one family bar, summing stars not coins"
```

---

## Task 4: Verify

The streak is the hardest thing in this plan to test, because it needs consecutive days. Do it with real ledger data, not by waiting three days.

- [ ] **Step 1: family bar first, it is instant.** Open any kid. The bar reads `🏠 Together 126/600 ⭐` (49+39+38) and names the prize `A day out we choose together 我們一起選的一日遊`. Open the other two kids: same bar, same numbers.

- [ ] **Step 2:** Clear the goal prize in the admin Economy panel and save. Every tablet's bar now reads `Papa is choosing the prize 爸爸在想獎品` within seconds. Restore it.

- [ ] **Step 3:** Have a kid buy something. The family bar **does not move**. *If it moves, `familyGoalHtml` is summing `coinsOf` — fix it.*

- [ ] **Step 4: streak, with seeded history.** In the admin SQL editor, insert `day_ticks` covering every block for Lili for the three days before today:

```sql
insert into day_ticks (kid_id, day, block_idx)
select 'lili', d::date, g
from generate_series(current_date - 3, current_date - 1, interval '1 day') d,
     generate_series(0, 15) g
on conflict do nothing;
```

Adjust `15` to `DAY.length - 1` if the schedule is not 16 blocks.

- [ ] **Step 5:** Reload Lili's tablet. The header shows `🔥 3`. **It shows 3 even though today is unfinished** — that is `streakFrom` counting back from yesterday, and it is the intended behaviour.

- [ ] **Step 6:** Finish Lili's day. On the last block: the day-complete celebration fires, then `🔥 4`, and `+2 🪙` lands. *(The +2 is for reaching 3, which happened on the seeded run — if your seed makes today the 4th day, confirm against `streakBonus`: only 3 and multiples of 7 pay.)*

- [ ] **Step 7: the deduplication, which is the whole guard.** Reload the tablet and re-open the day. **No second bonus.** Check the ledger: exactly one `Streak 🔥 …` row. Open Lili on a second tablet: still one row.

- [ ] **Step 8:** Confirm the bonus counted as ⭐ **and** 🪙 — it is `source='app'`, so both rise. This is correct: a streak bonus is earned.

- [ ] **Step 9: the break.** Delete one seeded day's ticks:

```sql
delete from day_ticks where kid_id='lili' and day = current_date - 2;
```

Reload. The flame is gone — no red, no message about losing anything. The Shop segment offers `Start a new streak today 今天重新開始`.

- [ ] **Step 10: clean up the seed.**

```sql
delete from day_ticks where kid_id='lili' and day < current_date;
delete from stars_ledger where kid_id='lili' and reason like 'Streak%';
select kid_id, stars, coins from star_totals order by kid_id;
```

Confirm Lili is back to her real numbers. **Do not leave seeded ticks in a kid's history** — they would keep a phantom streak alive for a month.

---

## Notes for the implementer

Task 2 Step 5 is where this slice will actually go wrong. There is more than one path to a completed day — ticking the last block, using a pass on it, and possibly Papa accepting a block from the admin. Only the tablet paths can award the bonus (the admin has no `SQShop.streakFrom` wiring, and adding it is out of scope). A day completed entirely from the admin therefore pays its streak bonus on the kid's next app open, when `checkStreakBonus` runs again — which is fine, and is another reason the guard lives in the database rather than in a "did I already award this session" flag.

If the flame ever shows a number that disagrees with what a kid remembers, look at `dayHistory` freshness before you look at `streakFrom`. The fold is pure and unit-tested; the query window and the `hydrate()` ordering are not.
