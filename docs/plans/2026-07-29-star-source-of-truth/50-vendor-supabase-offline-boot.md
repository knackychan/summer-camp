# Slice 50 — Vendor supabase-js, survive an offline boot

**Goal:** A tablet that starts the app with no internet gets a fully working store that records everything for later — instead of a `null` store showing zero stars and an empty day.

**Fixes:** design.md D-2 (store stays offline for the whole session) and D-3 (a failed hydrate destroys the store).

**Design:** `docs/plans/2026-07-29-star-source-of-truth/design.md` §1, §3 (D1, D3).

**Depends on:** nothing. Ships on its own.

**DONE WHEN:**
- With the network disabled in devtools and a cold reload, the app loads, `window.store` is not `null`, `store.mode === "supabase"`, and the kid's day and star count show the last known values from `localStorage` — not zeros.
- `js/vendor/supabase.js` exists, is precached, and no runtime path fetches `cdn.jsdelivr.net` in the normal case.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **`js/vendor/` is third-party. Never edit its contents, never lint it, never reformat it.** `check.mjs:27` deliberately excludes it from the legacy-syntax scan. Download the file and commit it byte-for-byte.
2. **Do not change `createSupabaseClient`'s contract.** After this slice it returns `null` for exactly one reason: `SQ_CONFIG` has no URL or anon key. That "no client ⇒ no config" equivalence is what slice 51 relies on.
3. **Do not remove the CDN fallback.** `loadScript` short-circuits on `window.supabase` already; leaving the CDN as a dead fallback costs nothing and covers a mis-deployed vendor file.
4. **`js/config.js` is gitignored and must never be committed.** Do not touch it.
5. **No secrets.** `check.mjs` scans every tracked text file for JWT prefixes and the service-role string. The vendored bundle contains neither; if the scan trips, you downloaded the wrong thing.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/vendor/supabase.js` | Create (download) | The supabase-js v2 UMD bundle; sets `window.supabase` |
| `index.html` | Modify | `<script>` tag before `js/sync.js` |
| `admin.html` | Modify | `<script>` tag before `js/admin.js` |
| `js/sync.js` | Modify | `init()` survives a failed `hydrate()` |
| `sw.js` | Modify | `APP_SHELL` += vendor file; `CACHE_NAME` bump |
| `scripts/sync.test.mjs` | Modify | One new test: init with a hydrate that throws |

---

## Task 1: Vendor the bundle

- [ ] **Step 1:** Download the UMD build that today's CDN URL resolves to:

  ```
  https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js
  ```

  Save it as `js/vendor/supabase.js`. Do not minify, transpile, or run a formatter over it.

- [ ] **Step 2:** Verify it is the right artifact before going further. It must be a UMD bundle that assigns `window.supabase`, and `window.supabase.createClient` must be a function. A quick check:

  ```powershell
  node -e "const s=require('fs').readFileSync('js/vendor/supabase.js','utf8'); console.log(s.length, /createClient/.test(s))"
  ```

  Expect a length in the hundreds of KB and `true`. If you got an ES-module build (it starts with `import` / has no UMD wrapper), it will not set `window.supabase` and everything downstream fails silently — get the `dist/umd/` file.

- [ ] **Step 3:** Add the tag to `index.html`, immediately **before** `js/sync.js` (currently `index.html:867`):

  ```html
  <script src="js/vendor/supabase.js"></script>
  <script src="js/sync.js"></script>
  ```

  Order matters: `sync.js` is a classic script and `loadScript()` checks `window.supabase` synchronously.

- [ ] **Step 4:** Add the same tag to `admin.html`, before `js/admin.js` (currently `admin.html:345`). `js/admin.js:2` has its own `CDN` constant and its own loader; the global being already present short-circuits it the same way. **Do not delete that constant** — leave admin.js untouched (design.md §5.2).

- [ ] **Step 5:** `sw.js` — add `"./js/vendor/supabase.js"` to `APP_SHELL` next to the other `js/vendor/` entries, and bump `CACHE_NAME` from `summer-quest-v63` to `summer-quest-v64`.

  Both halves are required. `check.mjs:96` fails the build if `APP_SHELL` names a file that does not exist, and an un-bumped cache name means tablets keep serving the old shell forever.

---

## Task 2: A failed hydrate must not destroy the store

**File:** `js/sync.js`, in `static async init(seed)` (currently `js/sync.js:137-148`).

- [ ] **Step 1:** Wrap the hydrate call:

  ```js
  if(client){
    /* A tablet with no network still gets a working store: hydrate is how the
       server's state arrives, not how the app starts. Letting this reject took
       `store` to null in index.html's catch, and the kid saw zero stars and an
       empty day for the whole session. */
    try{ await store.hydrate(); }catch(e){}
  }
  ```

- [ ] **Step 2:** Confirm what the store looks like after a failed hydrate. It must:
  - keep the `progress` loaded from `localStorage` (`init` already did this at `js/sync.js:138-139`, before the client exists);
  - keep `mode === "supabase"` — the app *is* configured, it just cannot reach the server this second;
  - keep the persisted queue;
  - still call `store.startFlush()` and `store.persistLocal()` on the lines that follow.

  Change nothing else in `init`.

- [ ] **Step 3:** Do **not** add a retry, a backoff, a "reconnecting" state or a status flag. The 30s flush timer and the `online` listener (slice 51) are the recovery path and they already exist.

---

## Task 3: Test it

**File:** `scripts/sync.test.mjs` — append a new block. Follow the file's existing style exactly: a bare `{ }` block, `assert` from `node:assert/strict`, a `console.log("ok - …")` at the end. No test framework, no fixtures.

- [ ] **Step 1:** Build a fake client whose `from()` returns a builder that **rejects**, so `hydrate()`'s `Promise.all` throws. The existing `fakeSupabase` helper (line 28) always resolves; write a small local variant rather than changing the shared one — other tests depend on it resolving.

- [ ] **Step 2:** Seed `localStorage` with a realistic prior state before calling `init`:

  ```js
  const ls = makeLocalStorage({
    "keyquest:v2": JSON.stringify({ progress: { lili: { stars: 12, best:{}, vocab:{}, missions:0, day:{d:"",done:{},rr:{}} } }, settings: {} }),
    "sq:queue": JSON.stringify([{ id:"op-x", type:"stars", kid:"lili", delta:1, reason:"offline win" }])
  });
  ```

- [ ] **Step 3:** Assert, after `await SyncStore.init(...)`:
  - it **resolves** — `init` must not reject;
  - the returned store is truthy;
  - `store.progress.lili.stars === 12` — the locally persisted state survived (**note:** slice 52 changes this assertion; that is expected and handled there);
  - `store.queue.length === 1` — the pending op was not dropped;
  - `store.mode === "supabase"`.

- [ ] **Step 4:** `node --test scripts/sync.test.mjs` — green. Then `node scripts/check.mjs` — green.

---

## Task 4: Verify on a real device

- [ ] **Step 1:** Deploy. On a tablet, open the app **once with wifi on** so the new service worker installs and precaches `js/vendor/supabase.js`. Confirm the new `CACHE_NAME` took effect (devtools → Application → Cache Storage shows `summer-quest-v64`).

- [ ] **Step 2:** Turn on airplane mode. Force-quit the app. Reopen it cold.

- [ ] **Step 3:** Confirm: the day list renders, the star count shows the kid's real number (not 0), and the app is usable. Before this slice, this is the scenario that produced the empty-app symptom.

- [ ] **Step 4:** Check the network tab (or `serve.log` if testing locally) for any request to `cdn.jsdelivr.net`. There should be none.

---

## Notes for the implementer

If step 4.3 still shows zero stars, **stop and report** — do not start patching `index.html`'s render path. It would mean `localStorage` is not being read, which is a different fault from the one this slice fixes, and papering over it here would hide it.

Do not "improve" the offline experience while you are here — no offline banner, no retry button, no connection indicator. Design decision D4 is explicitly silent. Slice 51 handles reconnection.
