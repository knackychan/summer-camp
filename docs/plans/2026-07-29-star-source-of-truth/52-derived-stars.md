# Slice 52 — Stars become derived, never stored

**Goal:** The tablet stops keeping its own star counter. Every star number it shows is computed from the server's total plus its own unflushed queue, so it cannot disagree with the admin panel.

**Fixes:** design.md D-4, and honours the `CLAUDE.md` non-negotiable *"Stars are a ledger, never a stored counter."*

**Design:** `docs/plans/2026-07-29-star-source-of-truth/design.md` §2, §3 (D4, D7, D8), §4.

**Depends on:** slice 51 (**hard**). Deriving the display from a queue that does not reliably receive ops makes the count worse, not better. Also depends on slice 49 having been *recorded* — after this ships, the pre-existing gap is unmeasurable.

**This slice is a net deletion.** If your diff adds more lines than it removes, you have built something the design does not ask for. Re-read §2 "What this deletes".

**DONE WHEN:**
- No file in the repo reads or writes `progress[…].stars`. The field is gone from the shape.
- Every star shown on a tablet comes from `store.starsFor(kid)`.
- Papa granting +2 in the admin raises the tablet within 15s; revoking it lowers the tablet within 15s.
- A star earned offline shows immediately, survives a reload, and the displayed number does **not** change when it later syncs.
- `scripts/sync.test.mjs` tests 1, 1b, 1c, 1d, 2 and 3 have been **rewritten** to assert the new model, not deleted or weakened.
- `node scripts/check.mjs` passes, with the replaced star gate actually guarding something.

---

## Constraints you must not violate

1. **There are exactly four star paths** (design.md §4): `starsFor` reads, `applyStarTotals` writes the cache, `addStars` creates, `flush` sends. Do not add a fifth. If a change seems to need one, stop and report.
2. **`addStars` is called without `await` at the earn sites.** `enqueue()` runs synchronously before the first `await` inside it, so the count is already correct on the next line for the celebration and re-render. **Do not add `await`** — it would delay the confetti behind a network round-trip.
3. **Star reason strings are copied verbatim.** They are already written at all three sites and Papa reads them in the ledger. Do not rewrite, translate, shorten or "tidy" them — copy the existing template literals character for character, including the 中文.
4. **Do not touch `js/admin.js`.**
5. **Do not write a localStorage migration.** Old `progress[kid].stars` values sit inert once nothing reads them. Stripping them is code that runs once, on a value that no longer matters.
6. **Never weaken a test.** Each rewritten test must assert an equal or stronger guarantee than the one it replaces. `assert.equal(1,1)` in place of a real assertion is a failed slice.
7. **`js/sync.js` stays a classic global script.** No `import`.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/sync.js` | Modify | `serverStars` cache, `starsFor()`, `addStars()`; **delete** the star diff, `UNLABELLED`, `applyServerStars` |
| `index.html` | Modify | `starsOf()` helper; 3 earn sites; 6 render sites; **delete** `noteStars`/`pendingStarReasons` |
| `scripts/check.mjs` | Modify | Replace the star-provenance gate (lines 532-548) |
| `scripts/sync.test.mjs` | Modify | Rewrite tests 1, 1b, 1c, 1d, 2, 3 |
| `sw.js` | Modify | `CACHE_NAME` bump |

---

## Task 1: The cache and the formula

**File:** `js/sync.js`.

- [ ] **Step 1:** In the constructor, load the cached server totals next to the other cached reads (near line 123):

  ```js
  /* The last star_totals we successfully read. Cached so an offline boot shows
     the kid's real number instead of zero. Only applyStarTotals writes it. */
  this.serverStars=loadJson("sq:serverStars",{});
  ```

- [ ] **Step 2:** Add the one formula the whole design rests on:

  ```js
  /* The ONLY star number on a tablet. Server truth plus whatever this device
     has earned and not yet sent — a star is in exactly one of the two terms at
     any moment, so the count never moves when the queue drains. */
  starsFor(kid){
    return (this.serverStars[kid]||0)+this.queuedStarDelta(kid);
  }
  ```

  `queuedStarDelta` already exists at line 161. Do not modify it.

- [ ] **Step 3:** Rewrite `applyStarTotals(rows,kid)` (line 167) so it writes **only** the cache. It must no longer touch `this.progress` or `this.last`:

  ```js
  applyStarTotals(rows,kid){
    (rows||[]).forEach(r=>{
      if(!r||!r.kid_id)return;
      if(kid&&r.kid_id!==kid)return;
      this.serverStars[r.kid_id]=r.stars||0;
    });
    saveJson("sq:serverStars",this.serverStars);
  }
  ```

  Note the behaviour change in the `kid` filter: the old code skipped kids *missing from the response*; this filters on the requested kid instead. Same outcome, one fewer thing to reason about.

- [ ] **Step 4:** `addStars` — local-only mode has no server, so the cache **is** the ledger there:

  ```js
  async addStars(kid,delta,reason){
    if(!this.configured){
      /* No server exists and never will. The local cache is the ledger, so the
         kid still earns stars in a clean local-only deploy. */
      this.serverStars[kid]=(this.serverStars[kid]||0)+delta;
      saveJson("sq:serverStars",this.serverStars);
      return;
    }
    this.enqueue({type:"stars",kid,delta,reason});
    await this.flush();
  }
  ```

---

## Task 2: Delete the counter machinery

**File:** `js/sync.js`. All of this is removal. Nothing replaces it.

- [ ] **Step 1:** `ensureKid` (line 87) — remove `stars:0` from the seed object. Leave every other field.

- [ ] **Step 2:** `hydrate()` — delete the totals line (currently line 256):

  ```js
  (totals||[]).forEach(r=>{ensureKid(p,r.kid_id); p[r.kid_id].stars=r.stars||0;});
  ```

  and replace it with `this.applyStarTotals(totals||[]);`. Keep the `star_totals` select in the `Promise.all` — the read is still needed, its destination changed.

- [ ] **Step 3:** `hydrate()`'s queue replay — delete the `stars` branch (lines 273-275):

  ```js
  }else if(op.type==="stars"){
    P.stars=(P.stars||0)+(op.delta||0);
  ```

  The queue term is now applied by `starsFor()` at read time, every time. Replaying it into a stored field would double-count it.

- [ ] **Step 4:** `enqueueDiff` — delete the entire star block, lines 338-356 (`let delta=…` through the closing `}` of the `while`). Also delete the `starReasons` parameter and the `reasonsByKid` map built from it at lines 310-315. The signature becomes `enqueueDiff(before,after)`.

- [ ] **Step 5:** `save(progress,settings,starReasons)` — drop the third parameter and the argument passed to `enqueueDiff`.

- [ ] **Step 6:** Delete `applyServerStars` entirely (lines 497-504) **and its comment block**. Its whole job was keeping a stored counter in step with the server; there is no stored counter now.

- [ ] **Step 7:** Delete the `UNLABELLED` constant and the comment above it (lines 7-13). Confirm no reference survives: `grep -n "UNLABELLED\|applyServerStars\|starReasons" js/sync.js` must print nothing.

- [ ] **Step 8:** `setOuting` (line 531) already calls `this.enqueue({type:"stars",…})` with a reason and does not touch `progress`. **Leave it exactly as it is** — it was already correct.

---

## Task 3: The kid app

**File:** `index.html`. Nine edits, listed exhaustively. Line numbers are pre-change.

- [ ] **Step 1:** Delete `pendingStarReasons` and `noteStars()` (lines 1228-1231).

- [ ] **Step 2:** Simplify `saveProgress()` (lines 1251-1256) to:

  ```js
  async function saveProgress(){
    try{ if(store) await store.save(progress,settings); }catch(e){}
  }
  ```

- [ ] **Step 3:** Add the single read helper, next to `bestOf` (line 1212):

  ```js
  const starsOf=id=>store?store.starsFor(id):0;
  ```

- [ ] **Step 4: earn site — Brain Gym** (lines 1565-1566). Replace both lines with one:

  ```js
  store.addStars(k,1,"Brain Gym 頭腦體操 · daily set 每日三項 · "+day);
  ```

  Keep `p.brain.starred=true` on the line above it — that is the replay guard and it stays.

- [ ] **Step 5: earn site — activity bank** (lines 2429-2430). Replace both lines with one, copying the reason verbatim:

  ```js
  store.addStars(hubKid,1,`Activity 活動 · ${BANK[actIdx].cat} ${BANK[actIdx].catz||""} · ${BANK[actIdx][hubKid]} / ${(BANK[actIdx].z||{})[hubKid]||""}`);
  ```

- [ ] **Step 6: earn site — Learn guide** (lines 2530-2531). Replace both lines with one:

  ```js
  store.addStars(hubKid,1,`Learn 學習 · ${g.title} ${g.tz} · self-claimed 自己申報`);
  ```

- [ ] **Step 7: render sites.** Replace each with `starsOf(...)`:

  | Line | Was | Becomes |
  |---|---|---|
  | 1217 | `(progress[id].stars||0)+" ⭐"` | `starsOf(id)+" ⭐"` |
  | 1218 | `progress[id].stars||0` | `starsOf(id)` |
  | 1297 | `${p.stars||0}` | `${starsOf(id)}` — check the variable in scope; it is the kid id of the card being rendered |
  | 1458 | `stars:p.stars||0` | `stars:starsOf(kidId)` |
  | 2277 | `${P.stars||0}` | `${starsOf(hubKid)}` |
  | 2550 | `⭐ ${P.stars||0}` | `⭐ ${starsOf(id)}` — check the loop variable in scope |

  For 1297 and 2550, **read the surrounding function** to get the right identifier. Do not guess and do not introduce a new variable.

- [ ] **Step 8:** Leave `refreshStarsFromServer` (line 3067) and `setupRealtime` (line 3079) **unchanged**. They already call `store.refreshStarTotals(...)` and re-render; with `applyStarTotals` now writing the cache, they do the right thing with no edit. Resist tidying them.

- [ ] **Step 9:** `sw.js` — bump `CACHE_NAME` to `summer-quest-v65`.

---

## Task 4: Replace the check.mjs star gate

**File:** `scripts/check.mjs`, lines 532-548.

The existing gate requires a `noteStars()` call within two lines of any `progress[…].stars` bump. This slice deletes `noteStars`, so the gate would match nothing and pass forever while guarding nothing — the most dangerous possible state for a gate. **Replace it; do not delete it.**

- [ ] **Step 1:** Substitute this block for lines 532-548:

  ```js
  // Stars are the ledger, never a stored counter (CLAUDE.md non-negotiable;
  // plan 2026-07-29-star-source-of-truth D7/D8). The previous gate keyed on
  // noteStars(), which that plan deleted — replaced rather than dropped, since a
  // gate that matches nothing is green forever while guarding nothing.
  {
    const syncJs = readFileSync(new URL("js/sync.js", root), "utf8");
    if (/\.stars\b/.test(appScript)) {
      fail("stars are a ledger", "index.html touches a .stars field — read store.starsFor(kid), award with store.addStars(kid, n, reason)");
    }
    if (/noteStars/.test(appScript)) {
      fail("stars are a ledger", "noteStars() survived the migration to derived stars");
    }
    if (/UNLABELLED|App progress/.test(syncJs)) {
      fail("stars are a ledger", "sync.js still has an anonymous star bucket");
    }
    const grants = [...appScript.matchAll(/addStars\(([^)]*)\)/g)];
    if (grants.length < 3) {
      fail("stars are a ledger", `only ${grants.length} addStars call sites; the app has three ways to earn a star`);
    }
    grants.forEach(([, args]) => {
      if (args.split(",").length < 3) fail("stars are a ledger", `addStars(${args}) passes no reason — the ledger would be unauditable`);
    });
    if (!/starsFor\s*\(/.test(syncJs)) {
      fail("stars are a ledger", "sync.js has no starsFor() — nothing derives the displayed total");
    }
  }
  ```

- [ ] **Step 2:** Prove the gate works before trusting it. Temporarily reintroduce `progress[hubKid].stars=(progress[hubKid].stars||0)+1;` at one earn site, run `node scripts/check.mjs`, confirm it goes **red**, then revert. A gate you have not seen fail is a gate you have not tested.

---

## Task 5: Rewrite the tests

**File:** `scripts/sync.test.mjs`. Six existing blocks assert the old model. Each is rewritten, in place, keeping the file's plain-`assert` style.

- [ ] **Step 1 — Test 1 (line 59, "enqueueDiff produces correct ops"):** keep the tick/roll/actDone/vocab/stat assertions exactly. Replace the star assertions with the inverse guarantee:

  ```js
  after.lili.stars = 5;   // a stale field from an old localStorage payload
  store.enqueueDiff(before, after);
  assert.equal(store.queue.filter(o => o.type === "stars").length, 0,
    "enqueueDiff must never mint a star — addStars is the only path");
  ```

  Update the `deepEqual` of sorted types to drop `"stars"`.

- [ ] **Step 2 — Test 1b (line 87, star reasons):** replace with an `addStars` test. Assert that `addStars(kid, 1, reason)` puts exactly one op on the queue, carrying that exact reason and a uuid, and that `starsFor(kid)` reflects it **immediately and synchronously** — call `addStars` without `await` and assert on the very next line. That synchronous property is what the celebration UI depends on (Constraint 2).

- [ ] **Step 3 — Test 1c (line 108, `applyServerStars`):** the method is gone. Replace with the grant/revoke round trip:
  - `applyStarTotals([{kid_id:"lili",stars:3}])` ⇒ `starsFor("lili") === 3`;
  - a following `enqueueDiff` enqueues **no** star op (Papa's grant must never come back as a second star);
  - `applyStarTotals([{kid_id:"lili",stars:0}])` ⇒ `starsFor("lili") === 0` — **a revoke must actually lower the tablet**, which the old model could not do. Assert it explicitly.

- [ ] **Step 4 — Test 1d (line 131, totals + pending):** keep the scenario, retarget the assertions to `starsFor`. Server says 5, one unflushed op of +2 ⇒ `starsFor("lili") === 7`; another kid untouched ⇒ `starsFor("luis") === 0`. Add: after the op is removed from the queue **and** the server total refreshed to 7, `starsFor("lili")` is still 7 — the no-flicker guarantee, asserted directly.

- [ ] **Step 5 — Test 2 (line 168, hydrate):** change `store.progress.lili.stars` to `store.starsFor("lili")`. The expected value stays 7. Every other assertion in the block stays.

- [ ] **Step 6 — Test 3 (line 195, local-only):** rewrite around `addStars`:

  ```js
  store.addStars("luis", 3, "local-only test");
  assert.equal(store.starsFor("luis"), 3, "stars still work with no server configured");
  assert.equal(store.queue.length, 0, "local-only mode never queues network ops");
  ```

  Keep the `mode === "local-only"` and `keyquest:v2` persistence assertions. The "never queues" guarantee is unchanged — only how stars are recorded changes.

- [ ] **Step 7:** Add one new block: **the full offline round trip.** Earn a star with no network; assert `starsFor` went up; simulate a reload by constructing a fresh store over the *same* `localStorage`; assert `starsFor` is unchanged; flush against a fake client; refresh totals to include it; assert `starsFor` is *still* unchanged and the queue is empty. This is the end-to-end statement of the whole plan and it belongs in the test file, not only in a manual drill.

- [ ] **Step 8:** `node --test scripts/sync.test.mjs`, then `node scripts/check.mjs`. Both green.

---

## Task 6: Verify on a real device

Run every step of design.md §6 on a real tablet, in order. All seven must hold. In particular:

- [ ] **Step 5 of §6** — the count must not change when the queue drains. If it flickers, slice 51 Task 4 is wrong.
- [ ] **Step 7 of §6** — a revoke must lower the tablet. This never worked before; if it does not work now, `applyStarTotals` is still filtering out kids or writing somewhere other than `serverStars`.

---

## Notes for the implementer

The pre-existing gap from slice 49 becomes visible the moment this deploys: kids may see their count drop to the server's figure. That is the design working, not a new bug. Slice 53 hands the difference back.

If you find yourself wanting to keep `progress[kid].stars` "just for the offline case", re-read design.md §2. The queue *is* the offline case, and it is already persisted.

Do not add a `stars` field to any new object to make a render site easier. There is one number and one way to get it.
