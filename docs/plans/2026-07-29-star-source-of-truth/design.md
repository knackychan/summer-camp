# Stars: server as source of truth, offline-durable

**Status:** approved by Papa, 2026-07-29.
**Slices:** 49–53. Order: 49 → 50 → 51 → 52 → 53.
**Supersedes:** nothing. Amends the star-sync behaviour described in `SPEC_summer_quest_supabase.md` and the star half of `2026-07-27-admin-ops-redesign`. The admin panel is **already correct** and is not changed by this plan.

---

## 1. The problem, exactly

Papa's report: *"the stars from the kids' point of view on their tablets is different from the admin panel."*

The admin panel reads the `star_totals` view (`supabase/schema.sql:76`), which is `coalesce(sum(stars_ledger.delta),0)`. That is the ledger, and it is right. The tablet does **not** read it as truth — it keeps its own counter in `progress[kid].stars` and only reconciles opportunistically. Four separate defects let that counter diverge, and all four are on the offline path.

### D-1 — an offline-booted session queues nothing at all

`js/sync.js:298`:

```js
if(this.supabase) this.enqueueDiff(this.last,this.progress,starReasons);
this.last=clone(this.progress);
```

With wifi off, `createSupabaseClient()` (`js/sync.js:76`) calls `loadScript(SUPABASE_CDN)`. `sw.js:254` returns early for every cross-origin request, so the CDN bundle is **never precached**; the load fails and the function returns `null`. `this.supabase` is null, so `enqueueDiff` is skipped — and `this.last` is re-baselined on the very next line.

The delta is not deferred. It is **consumed**. Nothing can re-derive it afterwards, not on reconnect, not on reload. Every star, tick, activity, vocab box and best score earned in that session is gone from the server for good.

### D-2 — a store that boots offline stays offline for the whole session

`startFlush()` (`js/sync.js:190`) returns immediately when there is no client, so no `online` listener and no 30s timer are ever installed. Wifi returning mid-session changes nothing until the app is reloaded.

### D-3 — a failed hydrate destroys the store outright

`SyncStore.init` does `if(client) await store.hydrate();` with no guard. If supabase-js comes back from the browser's HTTP cache while the network is down, the client **is** constructed, `hydrate()`'s `Promise.all` rejects, `init` throws, and `index.html:1249` catches it as:

```js
catch(e){normalizeProgressShape();}
```

`store` stays `null` and `progress` keeps the in-memory default. The kid sees **0 stars and an empty day**, and nothing that session is persisted anywhere. This is the loudest symptom and the most likely thing Papa actually saw.

### D-4 — the tablet's star count is a stored counter

Three sites write it:

| Site | What earns it |
|---|---|
| `index.html:1565` | Brain Gym daily set |
| `index.html:2429` | Activity bank "I learned something" |
| `index.html:2530` | Learn guide self-claim |

Five sites read it: `index.html:1217`, `1218`, `1297`, `1458`, `2277`, `2550`.

Server truth only arrives when `refreshStarTotals` succeeds. This directly violates the project non-negotiable in `CLAUDE.md`: *"Stars are a ledger (sum of stars_ledger deltas), never a stored counter."* The admin obeys it; the tablet never did.

**Everything in this plan is tablet-side. `js/admin.js` is not modified.**

---

## 2. The model

One formula, and it is the only way a star count is ever produced on a tablet:

```
displayed stars(kid) = serverStars[kid] + sum of unflushed queue ops of type "stars" for kid
```

- **`serverStars`** — the last successfully read `star_totals` row per kid, cached in `localStorage` under `sq:serverStars` so it survives an offline boot. Only `applyStarTotals()` writes it.
- **the queue term** — `queuedStarDelta(kid)`, which already exists at `js/sync.js:161`.

The formula is **self-balancing**, and that property is the whole design. A star lives in exactly one of the two terms at any moment:

| Moment | serverStars | queue | Displayed |
|---|---|---|---|
| Kid earns it offline | 14 | +1 | 15 |
| Still offline, app reloaded | 14 (from localStorage) | +1 (from localStorage) | 15 |
| Flushed to `stars_ledger` | 14 | +1 | 15 |
| `star_totals` re-read after flush | 15 | 0 | 15 |

The number never moves at a sync boundary, because the star was counted identically on both sides of it. Papa's grants and revokes land through the same single path — they raise or lower `serverStars` on the next read, and a revoke now actually lowers the tablet's number, which today it cannot do.

### What this deletes

Once stars are derived, an entire machine for reverse-engineering *why* a counter moved becomes dead weight:

- the star branch of `enqueueDiff` — `js/sync.js:338-356`
- the `UNLABELLED` constant and its comment — `js/sync.js:7-13`
- `applyServerStars()` — `js/sync.js:497-504`
- `noteStars()` / `pendingStarReasons` — `index.html:1228-1231`, and the `starReasons` parameter threaded through `saveProgress` → `store.save` → `enqueueDiff`

The reason a star was awarded is known at the call site. Passing it there (`store.addStars(kid, 1, reason)`) is both shorter and impossible to get wrong. **Net deletion.** Do not replace any of it with something new.

---

## 3. Decisions

| # | Decision | Rationale |
|---|---|---|
| **D1** | **Vendor supabase-js into `js/vendor/supabase.js`** and precache it. | Removes the CDN as a runtime dependency for the *whole app*. `createClient()` needs no network, so the client always constructs, even in airplane mode — which turns "no client" back into an honest signal meaning "no config". Follows the existing `js/vendor/three.*` precedent. |
| **D2** | **The queue always receives ops**, regardless of client or network state. | It is `localStorage`-backed and every op is idempotent — ledger inserts carry `op.id` and tolerate `23505`; ticks/acts/vocab/stats are upserts. There is no cost to queuing and total loss in not queuing. |
| **D3** | **`hydrate()` failure must never destroy the store.** | A tablet that cannot reach the server must still be a fully working local app that records everything for later. |
| **D4** | **Silent offline UX.** No badge, no spinner, no "not synced" marker anywhere kid-facing. | The kid earned it, the count went up. "Coach, not cop" — a child outside in the sun should not be made to think about sync state. Papa can see what has and hasn't landed in the admin panel. |
| **D5** | **`flush()` and `refreshStarTotals()` are serialized** on a single promise chain. | Otherwise a `star_totals` read issued *before* a flush can return *after* it, setting `serverStars` from a pre-flush total while the queue has already dropped the op — a visible dip of exactly the kind this plan exists to eliminate. Serializing is smaller than any dip-detection heuristic. |
| **D6** | **Stars earned in past offline sessions are unrecoverable.** | D-1 consumed them; no record exists on any device. Slice 49 measures the gap so Papa can re-grant by hand, and slice 53 does it. This is a one-time cost, paid once, deliberately. |
| **D7** | **`progress[kid].stars` stops existing.** Not "stops being written" — the field is removed from the shape. | A dead field that still holds a plausible-looking number is an invitation for the next agent to read it. Removing it makes a mistake a crash instead of a silent wrong number. |
| **D8** | **The `check.mjs` star-provenance gate is replaced, not deleted.** | It currently keys on `noteStars(`. Deleting `noteStars` leaves the gate matching nothing — green forever while guarding nothing. The new gate forbids `progress[…].stars` assignment outright and requires every `addStars` call to pass a non-empty reason. |

---

## 4. Architecture after the change

```
kid earns something
        │
        ▼
store.addStars(kid, 1, "<bilingual reason>")
        │
        ├─► queue.push({type:"stars", id:uuid, kid, delta, reason})  ──► localStorage "sq:queue"
        │
        └─► flush()  ──(online)──► stars_ledger INSERT (id = op.id, 23505 tolerated)
                          │
                          └─► on drain of any star op: refreshStarTotals()
                                          │
                                          ▼
                              star_totals view  ──► serverStars ──► localStorage "sq:serverStars"

anything rendering a star count
        │
        └─► store.starsFor(kid)  =  serverStars[kid] + queuedStarDelta(kid)
```

Realtime (`onStars`, `index.html:3081`), the 15s poll, `focus`, `online` and `visibilitychange` all converge on the same one call: `refreshStarTotals()`. They are cache-refresh triggers, nothing more.

### Ownership

| Unit | Owns | Depends on |
|---|---|---|
| `SyncStore.starsFor(kid)` | The only star number anyone may display | `serverStars`, `queue` |
| `SyncStore.applyStarTotals(rows, kid)` | The only writer of `serverStars` | `star_totals` rows |
| `SyncStore.addStars(kid, delta, reason)` | The only way a star is created | `queue` |
| `SyncStore.flush()` | Draining the queue, exactly once per op | `supabase` |

If a future change needs a fifth star path, it is wrong. There are exactly four.

---

## 5. Non-negotiables for this work

Violating any of these means the slice is not done, no matter what the tests say.

1. **Never delete a project file.** `CLAUDE.md` rule. Superseded docs stay.
2. **Do not touch `js/admin.js`.** The admin is the reference implementation of correct behaviour here. If a slice seems to need an admin change, stop and report instead.
3. **Do not touch gameplay** — games, vocab data, mission pools, seeding, `js/drills.js`.
4. **Bilingual invariant.** Every kid-facing string is EN + 繁體中文. Star *reason* strings are admin-facing ledger text but are currently written bilingually at all three sites — keep them exactly as they are, character for character. They are what Papa reads in the ledger.
5. **`node scripts/check.mjs` green before any commit.** Red check ⇒ do not commit. This gate runs every `scripts/*.test.mjs`.
6. **Never weaken a test to make it pass.** Tests 1, 1b, 1c, 1d in `scripts/sync.test.mjs` assert the *old* model and must be rewritten to assert the new one with equal or greater strictness. Deleting an assertion without replacing its guarantee is a failure of the slice.
7. **No new dependency.** The vendored supabase-js is the bundle already loaded from the CDN today, moved on-disk. Nothing else is added.
8. **`js/sync.js` stays a classic global script.** It cannot `import`. See `js/CLAUDE.md`.

---

## 6. What "fixed" looks like

On the real tablets, in airplane mode:

1. Kid opens the app with wifi off, from a cold start. App works. Star count matches what it was.
2. Kid completes the Brain Gym daily three. Count goes up by 1, immediately, with the normal celebration.
3. Kid force-quits and reopens, still offline. Count still shows the new value.
4. Wifi comes back. Within 30s and with no reload, the star appears in the admin panel's ledger with its full bilingual reason.
5. The tablet's count **does not change** at any point during step 4.
6. Papa grants +2 from the admin. The tablet shows it within 15s.
7. Papa revokes it. The tablet drops back within 15s.

---

## 7. Slices

| # | File | What it does | Depends on |
|---|---|---|---|
| 49 | `49-measure-the-gap.md` | Record each tablet's current count vs `star_totals`. No code. | — |
| 50 | `50-vendor-supabase-offline-boot.md` | Vendor supabase-js; make a failed hydrate survivable. Fixes D-2, D-3. | — |
| 51 | `51-always-queue.md` | Queue unconditionally; unconditional flush loop; serialize flush/refresh. Fixes D-1. | 50 |
| 52 | `52-derived-stars.md` | `starsFor()`; delete the counter and the diff machinery. Fixes D-4. | 51 |
| 53 | `53-reconcile-and-tablet-drill.md` | Re-grant the measured gap; run the airplane-mode drill on real hardware. | 49, 52 |

Slices 50 and 51 each ship a real improvement on their own and can be committed separately. Slice 52 must not start before 51 is green — deriving stars from a queue that does not reliably receive them would make the display *worse*, not better.
