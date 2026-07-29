# Slice 51 — Always queue, and stop racing the flush

**Goal:** Nothing a kid does is ever silently discarded, and a `star_totals` read can never overtake a flush and produce a wrong number.

**Fixes:** design.md D-1 (an offline session queues nothing) and the race described in D5.

**Design:** `docs/plans/2026-07-29-star-source-of-truth/design.md` §2, §3 (D2, D5).

**Depends on:** slice 50 — this slice relies on `this.supabase === null` meaning *"no config"* and nothing else, which is only true once supabase-js is vendored.

**DONE WHEN:**
- With the network disabled in devtools, ticking a block and finishing the Brain Gym both add ops to `localStorage["sq:queue"]`.
- Re-enabling the network drains the queue within 30s with no reload, and the rows appear in the admin panel with their reasons intact.
- With genuinely no `SQ_CONFIG` (local-only mode), nothing is queued — `scripts/sync.test.mjs` test 3 still passes **unmodified**.
- `node scripts/check.mjs` passes.

---

## The distinction this slice is built on

Two states look identical today and must never be confused again:

| State | `SQ_CONFIG` | Client | Queue ops? | Why |
|---|---|---|---|---|
| **Local-only** | absent | `null` | **No** | There is no server and never will be. `CLAUDE.md`: *"Missing config.js ⇒ clean local-only mode."* |
| **Configured, offline** | present | exists (slice 50) | **Yes** | There is a server; it is just unreachable this second. Losing the op loses the star. |

Before slice 50, both produced a `null` client, and the code branched on the client. That single conflation *is* defect D-1. This slice makes the branch read the thing it actually means.

---

## Constraints you must not violate

1. **Branch on configuration, never on the client object.** Any new `if(this.supabase)` guarding a *write to the queue* re-creates D-1.
2. **Never drop an op to make the queue "clean".** The only existing drop — the poison `actDone` filter at `js/sync.js:118-121` — stays exactly as it is. Do not generalise it, do not add a max queue length, do not add an age-based purge.
3. **`flush()` must stay idempotent per op.** Ledger inserts carry `op.id` and tolerate `23505`; everything else is an upsert. Do not change `applyOp`.
4. **`flush()` must keep stopping at the first failure** (`js/sync.js:381-383`). Ops are ordered; skipping past a failure to "make progress" can apply a later op before an earlier one.
5. **Do not touch `js/admin.js`.**

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/sync.js` | Modify | `configured` flag; unconditional queue + flush loop; serialized flush/refresh |
| `scripts/sync.test.mjs` | Modify | Two new tests. Test 3 must keep passing untouched. |

---

## Task 1: Know whether we are configured

**File:** `js/sync.js`, `constructor` (currently line 109).

- [ ] **Step 1:** Add the flag, read from config and **not** from the client:

  ```js
  /* "Do we have a server at all?" — a different question from "can we reach it
     right now?". Branching on the client object conflated the two, and an
     offline boot silently discarded every star the kid earned. */
  const cfg=(typeof window!=="undefined"&&window.SQ_CONFIG)||null;
  this.configured=!!(cfg&&cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY);
  ```

- [ ] **Step 2:** Leave `this.mode` exactly as it is. It is derived from the client and is used for display only.

---

## Task 2: Queue unconditionally

**File:** `js/sync.js`.

- [ ] **Step 1:** In `save()` (line 294), change the guard:

  ```js
  if(this.configured) this.enqueueDiff(this.last,this.progress,starReasons);
  ```

  Nothing else in `save()` changes. `this.last=clone(this.progress)` stays on the following line — with the op now queued, re-baselining is correct.

- [ ] **Step 2:** In `startFlush()` (line 190), change the early return to `if(!this.configured) return;`, and make the reconnect handler flush **before** hydrating:

  ```js
  startFlush(){
    if(!this.configured) return;
    /* flush first: the queue is the only copy of anything earned offline, and
       hydrate() re-baselines `last` against the server. Hydrating first would
       re-baseline over ops that had not been sent yet. */
    addEventListener("online",()=>this.flush().then(()=>this.hydrate()).catch(()=>{}));
    this.flushTimer=setInterval(()=>this.flush(),30000);
    this.flush();
  }
  ```

- [ ] **Step 3:** Leave the first line of `flush()` alone — `if(!this.supabase||!navigator.onLine||!this.queue.length) return;` is correct. Draining needs a client; *queuing* does not. This is the one place the two questions legitimately differ.

---

## Task 3: Serialize flush against the totals refresh

The bug being prevented: `refreshStarTotals()` issues its `star_totals` read at T1; `flush()` inserts a star and drops the op from the queue at T2; the read returns at T3 with the pre-flush total. `serverStars` is then set from a total that excludes a star the queue no longer holds, and the count visibly drops by one until the next poll. This is precisely the divergence the plan exists to remove, so it does not get a "self-heals in 15s" pass.

**File:** `js/sync.js`.

- [ ] **Step 1:** Add a one-at-a-time runner to the class:

  ```js
  /* Server reads and server writes take turns, so a totals read can never
     return from before a flush that has already emptied the queue.
     ponytail: one chain for the whole store — fine for 3 kids and a 30s timer.
     Split per-kid only if this ever becomes chatty. */
  run(task){
    const next=(this.busy||Promise.resolve()).then(task,task);
    this.busy=next.then(null,function(){});   // a failure must not poison the chain
    return next;
  }
  ```

  Initialise `this.busy=null;` in the constructor next to `this.flushTimer=null;`.

- [ ] **Step 2:** Rename the existing bodies to private methods and wrap them:

  ```js
  async flush(){ return this.run(()=>this._flush()); }
  async _flush(){ /* the existing body of flush(), unchanged */ }

  async refreshStarTotals(kid){ return this.run(()=>this._refreshStarTotals(kid)); }
  async _refreshStarTotals(kid){ /* the existing body, unchanged */ }
  ```

- [ ] **Step 3: The deadlock rule — read this twice.**

  **Anything already running on the chain must call the `_` version.** A public `flush()` or `refreshStarTotals()` called from inside a chained task waits for the chain it is itself blocking, and the app hangs with no error.

  Concretely:
  - `_flush()` calling the totals refresh (Task 4) ⇒ `this._refreshStarTotals()`.
  - Everything outside — `tick()`, `roll()`, `addStars()`, `actDone()`, `setVocab()`, `setStat()`, `setOverride()`, `setFamilySetting()`, `markBrainDone()`, `setOuting()`, `hydrate()`, the timer, the `online` handler, and every caller in `index.html` — keeps using the public `flush()` / `refreshStarTotals()`. Do not change any of those call sites.

  `hydrate()` is **not** on the chain, so its trailing `await this.flush()` (line 291) stays as-is and is correct.

---

## Task 4: Refresh totals after a flush that sent stars

**File:** `js/sync.js`, at the end of `_flush()`.

- [ ] **Step 1:** Track whether any drained op was a star, and refresh once at the end:

  ```js
  /* The op has left the queue; the server total must catch up in the same turn,
     or the displayed count (server + queued) dips by exactly the stars we just
     successfully saved. */
  if(sentStars&&this.supabase) await this._refreshStarTotals();
  ```

  Set `sentStars` when an op of `type==="stars"` is applied successfully. One refresh for the whole drain, not one per op.

- [ ] **Step 2:** `_refreshStarTotals` — not `refreshStarTotals`. See Task 3 Step 3.

---

## Task 5: Tests

**File:** `scripts/sync.test.mjs`. Append two blocks in the existing style.

- [ ] **Step 1: Configured but offline still queues.**
  Construct a store with `window.SQ_CONFIG` set (pass it through the harness — `loadSyncStore` builds `windowObj`, so seed it there) and `navigator.onLine === false`. Call `save()` with a progress diff. Assert the queue is **non-empty** and that the op survives a `saveJson` round-trip into `localStorage["sq:queue"]`.

- [ ] **Step 2: Local-only still queues nothing.**
  Test 3 in the existing file already asserts this. **Run it and leave it untouched.** If it fails, your `configured` flag is reading the client instead of the config — fix the flag, not the test.

- [ ] **Step 3: A totals read cannot overtake a flush.**
  Build a fake client whose `star_totals` select resolves on a delay *longer* than the ledger insert, seed one queued star op and a `star_totals` row that excludes it, then fire `refreshStarTotals()` and `flush()` without awaiting the first. Assert the final displayed total counts that star exactly once — never zero, never twice. This is the D5 regression test and it is the reason Task 3 exists.

- [ ] **Step 4:** `node --test scripts/sync.test.mjs`, then `node scripts/check.mjs`. Both green.

---

## Task 6: Verify on a real device

- [ ] **Step 1:** Deploy. Open on a tablet with wifi on, then enable airplane mode **without reloading**.
- [ ] **Step 2:** Tick a day block and complete the Brain Gym daily three. Both should feel completely normal.
- [ ] **Step 3:** Inspect `localStorage["sq:queue"]` — a `tick` op and a `stars` op with its full bilingual reason.
- [ ] **Step 4:** Turn wifi back on. Wait up to 30s. **Do not reload.** The queue empties and both rows appear in the admin panel.
- [ ] **Step 5:** Watch the star pill during step 4. It must not flicker, dip or jump. If it dips by one, Task 4 is wired to `refreshStarTotals` instead of `_refreshStarTotals`, or the refresh is missing.

---

## Notes for the implementer

If the app hangs after this slice — no flushes, no errors, UI alive but sync frozen — you have the Task 3 deadlock. Find the `await this.flush()` or `await this.refreshStarTotals()` that runs inside a chained task and change it to the `_` form. Do not "fix" it by removing the chain.

Do not add queue-size logging, a sync status field, or a debug panel. If you need visibility while working, use devtools and take it out before committing.
