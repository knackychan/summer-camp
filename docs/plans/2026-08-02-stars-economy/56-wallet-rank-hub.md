# Slice 56 — `coinsFor`, rank, and the hub header

**Goal:** The tablet knows its wallet as reliably as it knows its stars, and the kid sees ⭐ / 🪙 / rank at the top of every screen. Nothing is spendable yet — this slice only makes the numbers real.

**Implements:** design.md D1 (client half), D9, D11 (header only).

**Design:** `docs/plans/2026-08-02-stars-economy/design.md` §2 D1, D9, D11.

**Depends on:** slice 54 (**hard** — `star_totals.coins` must exist), slice 55 (**hard** — `SQShop.rank`).

**DONE WHEN:**
- `node --test scripts/sync.test.mjs` — green, including three new assertions.
- The hub header reads `⭐ 49 · 🪙 49 · 🥉 Bronze` for Luis (⭐ and 🪙 equal until slice 57 lets him spend).
- Both numbers survive a reload with wifi off, and neither shows `0` on an offline boot.
- Papa granting +2 raises **both** numbers on the tablet within 15s; revoking lowers both.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **Do not modify `starsFor`, `queuedStarDelta` or `applyStarTotals`'s star half.** `starsFor` is already exactly ⭐ and slice 57 queues spending under a *different* op type so it stays exactly ⭐. Changing it is the single most likely way to break this design.
2. **Never write `.stars` in `index.html`.** `scripts/check.mjs:539` fails the build on `/\.stars\b/` in the inline script. `starsOf(id)` and the new `coinsOf(id)` are the only accessors. (`.starsFor` does not match the pattern — the word boundary saves it.)
3. **Rank is derived at render time and never stored.** No `progress[kid].rank`, no cached rank, no unlock event. If you find yourself persisting a rank, re-read design.md D9.
4. **Do not touch `js/notify.js` or the achievements list.** Badges and ranks are different systems on purpose (design D9). A rank must not fire a badge.
5. **`js/sync.js` stays a classic global script.** No `import`.
6. **No shop UI in this slice.** The `🪙 Shop` segment is slice 57.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/sync.js` | Modify | `serverCoins` cache, `coinsFor()`, widened `star_totals` select |
| `index.html` | Modify | `coinsOf()` helper, hub header markup |
| `scripts/sync.test.mjs` | Modify | three new assertions |
| `sw.js` | Modify | `CACHE_NAME` bump |

---

## Task 1: `coinsFor` in the store

**File:** `js/sync.js`.

**`scripts/sync.test.mjs` does not use `node:test`.** It is a sequence of bare `{ … }` blocks with `// --- Test N: … ---` headers, using only `assert` — and it has no store-construction helper; every block repeats three lines. Match that style exactly; **do not** introduce `import { test } from "node:test"`.

- [ ] **Step 1: Add the helper the file has been missing.** Directly after `loadSyncStore` (line 50-55) and `const seedProgress = () => ({});`:

```js
// Three lines every block below repeated. Slices 56-59 add several more.
function makeStore(writes = []) {
  const ls = makeLocalStorage();
  const SyncStore = loadSyncStore(ls);
  return new SyncStore({ progress: seedProgress(), settings: {} }, fakeSupabase({}, writes));
}
```

Leave the existing blocks alone — they work, and rewriting them to use the helper is churn this slice did not ask for.

- [ ] **Step 2: Write the failing test.** Append at the end of `scripts/sync.test.mjs`, in the file's own style:

```js
// --- Test 8: coins are the wallet, stars are the achievement (slice 56) ---
{
  const store = makeStore();
  store.applyStarTotals([{ kid_id: "lili", stars: 40, coins: 25 }]);
  assert.equal(store.starsFor("lili"), 40, "stars is the achievement — spending never reduced it");
  assert.equal(store.coinsFor("lili"), 25, "coins is the wallet — 15 already spent");

  // An earned star raises both, because earning is in both formulas.
  store.addStars("lili", 1, "test earn");
  assert.equal(store.starsFor("lili"), 41);
  assert.equal(store.coinsFor("lili"), 26);

  // A kid with no rows at all is 0/0, never undefined or NaN.
  assert.equal(store.starsFor("nobody"), 0);
  assert.equal(store.coinsFor("nobody"), 0);
}
```

Number the block after the highest existing one — check the file rather than trusting the `8` above.

- [ ] **Step 3: Run it, confirm it fails.**

Run: `node --test scripts/sync.test.mjs`
Expected: FAIL — `store.coinsFor is not a function`.

- [ ] **Step 4:** In the constructor, beside `this.serverStars` (line 135), add:

```js
      /* The wallet half of star_totals. Cached for the same reason as
         serverStars: an offline boot must show the kid's real balance, not 0. */
      this.serverCoins=loadJson("sq:serverCoins",{});
```

- [ ] **Step 5:** Add the spend-side queue reader beside `queuedStarDelta` (line 168). It returns 0 until slice 57 starts queueing `spend` ops — that is intended, and having it here means slice 57 touches nothing in this file:

```js
    queuedSpendDelta(kid){
      return this.queue.reduce(function(sum,op){
        return sum+(op&&op.type==="spend"&&op.kid===kid?(op.delta||0):0);
      },0);
    }
```

- [ ] **Step 6:** Add `coinsFor` directly below `starsFor` (line 177), leaving `starsFor` untouched:

```js
    /* The wallet. Same server-plus-queue shape as starsFor, and both queue terms
       are included because both earning and spending move a balance. Spending
       queues type:"spend", which is why starsFor above stays exactly the
       achievement with no change at all. */
    coinsFor(kid){
      return (this.serverCoins[kid]||0)+this.queuedStarDelta(kid)+this.queuedSpendDelta(kid);
    }
```

- [ ] **Step 7:** Extend `applyStarTotals` (line 181) to write both caches:

```js
    applyStarTotals(rows,kid){
      (rows||[]).forEach(r=>{
        if(!r||!r.kid_id)return;
        if(kid&&r.kid_id!==kid)return;
        this.serverStars[r.kid_id]=r.stars||0;
        /* Pre-slice-54 servers have no `coins`; fall back to stars so an
           un-migrated project shows a plausible wallet instead of zero. */
        this.serverCoins[r.kid_id]=(r.coins===undefined||r.coins===null)?(r.stars||0):r.coins;
      });
      saveJson("sq:serverStars",this.serverStars);
      saveJson("sq:serverCoins",this.serverCoins);
    }
```

- [ ] **Step 8:** Widen the select in `_refreshStarTotals` (line 196):

```js
      const {data,error}=await this.supabase.from("star_totals").select("kid_id,stars,coins");
```

- [ ] **Step 9:** Find the `star_totals` select inside `hydrate()`'s `Promise.all` and widen it identically to `select("kid_id,stars,coins")`. Search: `grep -n "star_totals" js/sync.js` — there are exactly two. Both must be widened.

- [ ] **Step 10:** Add `"sq:serverCoins"` to the season-reset key list at line 261, beside `"sq:serverStars"`. A new season must clear the wallet cache too, or the first boot after a reset shows last season's coins.

- [ ] **Step 11: Run the tests, confirm green.**

Run: `node --test scripts/sync.test.mjs`
Expected: PASS, including the new block.

- [ ] **Step 12: Commit.**

```bash
git add js/sync.js scripts/sync.test.mjs
git commit -m "feat(stars): coinsFor — the wallet beside the achievement"
```

---

## Task 2: The hub header

**File:** `index.html`.

- [ ] **Step 1:** Add the accessor beside `starsOf` (line 1258):

```js
const coinsOf=id=>store?store.coinsFor(id):0;
```

- [ ] **Step 2:** Replace the hub star pill (line 2316). Current:

```js
  document.getElementById("hubStars").innerHTML=`<span class="starpill">⭐ ${starsOf(hubKid)}</span>`;
```

New:

```js
  /* One line, three facts: what you have earned, what you can spend, where you
     rank. Rank is recomputed here every render and stored nowhere (design D9). */
  const rk=SQShop.rank(starsOf(hubKid));
  document.getElementById("hubStars").innerHTML=
    `<span class="starpill">⭐ ${starsOf(hubKid)}</span>`+
    `<span class="starpill coinpill">🪙 ${coinsOf(hubKid)}</span>`+
    `<span class="starpill rankpill" title="${escHtml(rk.en)} ${escHtml(rk.zh)}">${rk.icon} ${escHtml(rk.zh)}</span>`;
```

- [ ] **Step 3:** Add the two new pill styles next to the existing `.starpill` rule in the `<style>` block. Find `.starpill` first and match its shape; these only add colour:

```css
.coinpill{background:#f6c445;color:#3a2c00}
.rankpill{background:rgba(255,255,255,.16)}
```

- [ ] **Step 4:** `sw.js` — bump `CACHE_NAME` to `summer-quest-v70`.

- [ ] **Step 5:** Run `node scripts/check.mjs`.
Expected: PASS. If it reports `stars are a ledger: index.html touches a .stars field`, you wrote `.stars` somewhere — use `starsOf()`.

- [ ] **Step 6: Commit.**

```bash
git add index.html sw.js
git commit -m "feat(hub): show stars, coins and rank in the header"
```

---

## Task 3: Verify on a real tablet

Every step must hold. This is the slice where a wrong number is invisible in tests and obvious to a child.

- [ ] **Step 1:** Open Luis's profile. Header reads `⭐ 49 · 🪙 49 · 🥉 銅星`. Both numbers **equal** — no spend rows exist yet. If they differ, `applyStarTotals` is writing the wrong field.

- [ ] **Step 2:** Cross-check against the admin: Stars → totals shows 49 for Luis. Tablet and admin agree.

- [ ] **Step 3:** Lucien (39) and Lili (38) both show `🥉 銅星`; check the boundary by granting Lili a temporary −(38) reset in a scratch project or simply trust the unit test for `rank(49) === sprout`. **Do not** grant/revoke real stars to test a threshold.

- [ ] **Step 4:** Wifi off, reload. Both numbers still show 49, not 0. This is the `sq:serverCoins` cache doing its job.

- [ ] **Step 5:** Wifi off, earn one star (finish Brain Gym). Both numbers go to 50 immediately.

- [ ] **Step 6:** Wifi on. Wait for the flush. Both numbers stay at 50 — **they must not dip and recover.** A visible dip means the server refresh landed before the queue drained; re-read `_flush`'s trailing `_refreshStarTotals` (line 406).

- [ ] **Step 7:** From the admin, grant Luis +2. Within 15s the tablet shows `⭐ 52 · 🪙 52`. Revoke it: both drop back to 50.

---

## Notes for the implementer

`starsFor` and `coinsFor` differ by exactly one term. If you find yourself wanting to unify them behind a flag or an options object, don't — two three-line functions are cheaper to read at 3am than one four-line function with a mode.

The `r.coins === undefined` fallback in Step 6 is not defensive padding: during rollout a tablet with a cached service worker can talk to a migrated database, or a fresh tablet to an un-migrated one. Falling back to `stars` makes the wrong case merely stale rather than showing every kid a zero balance.
