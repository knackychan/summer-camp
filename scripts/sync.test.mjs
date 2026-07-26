// SyncStore unit test — offline queue + hydration replay (the riskiest sync logic).
// Runs in plain Node with stubbed browser globals; no dependencies.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/sync.js", import.meta.url), "utf8");

function taipeiToday() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date()).reduce((a, x) => ((a[x.type] = x.value), a), {});
  return `${p.year}-${p.month}-${p.day}`;
}
const TODAY = taipeiToday();

function makeLocalStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
    _map: map
  };
}

// Minimal thenable query builder: every chained call returns itself,
// awaiting it resolves {data, error:null}; writes record themselves.
function fakeSupabase(tables, writes) {
  return {
    from(table) {
      const rows = tables[table] || [];
      const builder = {};
      for (const m of ["select", "eq", "or", "order", "gte", "lte", "limit", "delete"]) {
        builder[m] = () => builder;
      }
      builder.maybeSingle = () => Promise.resolve({ data: rows[0] || null, error: null });
      builder.then = (ok, bad) => Promise.resolve({ data: rows, error: null }).then(ok, bad);
      for (const m of ["upsert", "insert", "update"]) {
        builder[m] = payload => {
          writes.push({ table, op: m, payload });
          return Promise.resolve({ error: null });
        };
      }
      return builder;
    },
    storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) }
  };
}

function loadSyncStore(localStorage) {
  const windowObj = {};
  const run = new Function("window", "localStorage", "navigator", "addEventListener", "document", src);
  run(windowObj, localStorage, { onLine: true }, () => {}, {});
  return windowObj.SyncStore;
}

const seedProgress = () => ({});

// --- Test 1: enqueueDiff turns a progress diff into the right queue ops ---
{
  const ls = makeLocalStorage();
  const SyncStore = loadSyncStore(ls);
  const writes = [];
  const store = new SyncStore({ progress: seedProgress(), settings: {} }, fakeSupabase({}, writes));

  const before = JSON.parse(JSON.stringify(store.progress));
  const after = JSON.parse(JSON.stringify(store.progress));
  after.lili.day = { d: TODAY, done: { 2: true }, rr: { 4: 1 } };
  after.lili.actsDay = { d: TODAY, done: { 0: true } };
  after.lili.stars = 5;                    // +5 → chunked into +3 and +2
  after.lili.vocab["w:cat"] = 2;
  after.lili.best.race = 42;
  after.lili.best.city = 7;
  after.lili.best.dig = 4;

  store.enqueueDiff(before, after);
  const types = store.queue.map(o => o.type).sort();
  assert.deepEqual(types, ["actDone", "roll", "stars", "stars", "stat", "stat", "stat", "tick", "vocab"]);
  const starOps = store.queue.filter(o => o.type === "stars").map(o => o.delta).sort();
  assert.deepEqual(starOps, [2, 3], "star deltas must be chunked 1-3");
  assert.ok(store.queue.every(o => o.id), "every op carries a client uuid for dedupe");
  console.log("ok - enqueueDiff produces correct ops");
}

// --- Test 2: hydrate merges server rows THEN replays the pending queue ---
{
  const pending = [
    { id: "op-1", type: "tick", kid: "lili", day: TODAY, blockIdx: 7, ticked: true },
    { id: "op-2", type: "stars", kid: "lili", delta: 2, reason: "test" }
  ];
  const ls = makeLocalStorage({ "sq:queue": JSON.stringify(pending) });
  const SyncStore = loadSyncStore(ls);
  const writes = [];
  const client = fakeSupabase({
    kids: [{ id: "lili", pin: "1234" }],
    day_ticks: [{ kid_id: "lili", block_idx: 2 }],
    star_totals: [{ kid_id: "lili", stars: 5 }]
  }, writes);
  const store = new SyncStore({ progress: seedProgress(), settings: {} }, client);

  await store.hydrate();
  assert.equal(store.progress.lili.day.done[2], true, "server tick merged");
  assert.equal(store.progress.lili.day.done[7], true, "queued offline tick replayed locally");
  assert.equal(store.progress.lili.stars, 7, "server total + optimistic queued delta");
  assert.equal(store.kidPins.lili, "1234");
  assert.equal(store.queue.length, 0, "queue flushed to server");
  assert.ok(writes.some(w => w.table === "day_ticks" && w.op === "upsert"), "tick reached supabase");
  assert.ok(writes.some(w => w.table === "stars_ledger" && w.op === "insert"), "star reached supabase");
  console.log("ok - hydrate merges server state and replays pending queue");
}

// --- Test 3: local-only mode — no config, no client, save still persists ---
{
  const ls = makeLocalStorage();
  const SyncStore = loadSyncStore(ls);
  const store = await SyncStore.init({ progress: seedProgress(), settings: { a: 1 } });
  assert.equal(store.mode, "local-only");
  store.progress.luis.stars = 3;
  await store.save(store.progress, store.settings);
  const persisted = JSON.parse(ls.getItem("keyquest:v2"));
  assert.equal(persisted.progress.luis.stars, 3, "local-only save persists to localStorage");
  assert.equal(store.queue.length, 0, "local-only mode never queues network ops");
  console.log("ok - local-only fallback works without config");
}

console.log("sync tests passed");
