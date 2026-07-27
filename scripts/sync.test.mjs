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
  after.lili.stars = 5;                    // +5 with no reasons → one loud row
  after.lili.vocab["w:cat"] = 2;
  after.lili.best.race = 42;
  after.lili.best.city = 7;
  after.lili.best.dig = 4;

  store.enqueueDiff(before, after);
  const types = store.queue.map(o => o.type).sort();
  assert.deepEqual(types, ["actDone", "roll", "stars", "stat", "stat", "stat", "tick", "vocab"]);
  const starOps = store.queue.filter(o => o.type === "stars");
  assert.equal(starOps.length, 1, "unexplained stars collapse into ONE row, not innocent-looking chunks");
  assert.equal(starOps[0].delta, 5);
  assert.match(starOps[0].reason, /^Unlabelled/, "a star with no reason is labelled, never bucketed");
  assert.ok(store.queue.every(o => o.id), "every op carries a client uuid for dedupe");
  console.log("ok - enqueueDiff produces correct ops");
}

// --- Test 1b: reasons passed in survive onto the ledger ops, grouped by reason ---
{
  const ls = makeLocalStorage();
  const SyncStore = loadSyncStore(ls);
  const store = new SyncStore({ progress: seedProgress(), settings: {} }, fakeSupabase({}, []));

  const before = JSON.parse(JSON.stringify(store.progress));
  const after = JSON.parse(JSON.stringify(store.progress));
  after.luis.stars = 4;
  store.enqueueDiff(before, after, [
    { kid: "luis", delta: 2, reason: "Mission 任務 · 10:00 Homework 暑假作業 · one page" },
    { kid: "luis", delta: 1, reason: "Activity 活動 · House help 家事幫手 · dishes" },
    { kid: "luis", delta: 1, reason: "Learn 學習 · How to ask AI well · self-claimed" }
  ]);
  const stars = store.queue.filter(o => o.type === "stars");
  assert.equal(stars.length, 3, "one row per distinct reason");
  assert.deepEqual(stars.map(o => o.delta), [2, 1, 1], "same-reason stars merge, different ones do not");
  assert.ok(stars.every(o => !/^Unlabelled/.test(o.reason)), "no row falls back to the unlabelled bucket");
  console.log("ok - star reasons reach the ledger ops intact");
}

// --- Test 1c: a server-side star must not come back as a second, unlabelled one ---
{
  const ls = makeLocalStorage();
  const SyncStore = loadSyncStore(ls);
  const store = new SyncStore({ progress: seedProgress(), settings: {} }, fakeSupabase({}, []));
  store.last = JSON.parse(JSON.stringify(store.progress));

  store.applyServerStars("lili", 3);                 // Papa grants +3 from admin
  assert.equal(store.progress.lili.stars, 3, "the grant shows on the tablet");

  store.enqueueDiff(store.last, store.progress);     // any later save
  assert.equal(store.queue.filter(o => o.type === "stars").length, 0,
    "Papa's grant is already in the ledger — it must never be re-enqueued");

  store.applyServerStars("lili", -3);                // and a revoke
  store.progress.lili.stars += 1;                    // then the kid earns one for real
  store.enqueueDiff(store.last, store.progress, [{ kid: "lili", delta: 1, reason: "Mission 任務 · test" }]);
  const earned = store.queue.filter(o => o.type === "stars");
  assert.equal(earned.length, 1, "a revoke must not swallow the next real star");
  assert.equal(earned[0].delta, 1);
  console.log("ok - server-side stars rebaseline instead of duplicating");
}

// --- Test 1d: an act key act_done cannot store never reaches (and stalls) the queue ---
{
  const ls = makeLocalStorage({
    "sq:queue": JSON.stringify([{ id: "poison", type: "actDone", kid: "luis", day: TODAY, actIdx: null }])
  });
  const SyncStore = loadSyncStore(ls);
  const store = new SyncStore({ progress: seedProgress(), settings: {} }, fakeSupabase({}, []));
  assert.equal(store.queue.length, 0, "an unappliable actDone op is dropped on load, not retried forever");

  const before = JSON.parse(JSON.stringify(store.progress));
  const after = JSON.parse(JSON.stringify(store.progress));
  after.luis.actsDay = { d: TODAY, done: { 3: true, Lknow: true } };
  store.enqueueDiff(before, after);
  const acts = store.queue.filter(o => o.type === "actDone");
  assert.deepEqual(acts.map(o => o.actIdx), [3], "non-numeric act keys are skipped, numeric ones still sync");
  console.log("ok - non-numeric act keys cannot stall the queue");
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

// --- Test 4: brain best scores round-trip through hydration and diffing ---
{
  const ls = makeLocalStorage();
  const SyncStore = loadSyncStore(ls);
  const writes = [];
  const client = fakeSupabase({
    game_stats: [
      { kid_id: "lili", stat: "race", value: 40 },
      { kid_id: "lili", stat: "brain_calc", value: 18 },
      { kid_id: "lili", stat: "brain_calc_ms", value: 41000 },
      { kid_id: "lili", stat: "missions", value: 7 }
    ]
  }, writes);
  const store = new SyncStore({ progress: seedProgress(), settings: {} }, client);

  await store.hydrate();
  assert.equal(store.progress.lili.best.brain_calc, 18, "brain best hydrated");
  assert.equal(store.progress.lili.best.brain_calc_ms, 41000, "brain best time hydrated");
  assert.equal(store.progress.lili.best.race, 40, "original game best still hydrated");
  assert.equal(store.progress.lili.missions, 7, "missions still routed to its own field");

  const before = JSON.parse(JSON.stringify(store.progress));
  const after = JSON.parse(JSON.stringify(store.progress));
  after.lili.best.brain_calc = 20;
  after.lili.best.city = 9;
  store.enqueueDiff(before, after);
  const brainOp = store.queue.find(o => o.type === "stat" && o.stat === "brain_calc");
  assert.ok(brainOp, "brain best diff enqueued");
  assert.equal(brainOp.value, 20);
  assert.ok(store.queue.some(o => o.type === "stat" && o.stat === "city"), "city best diff still enqueued");
  console.log("ok - brain best scores round-trip through hydration and diffing");
}

// --- Legacy high scores must survive the persistence refactor (slice 16) ---
{
  var localStorage3 = makeLocalStorage();
  var SyncStore3 = loadSyncStore(localStorage3);
  var store3 = new SyncStore3({ progress: {} });
  var progress3 = {};

  store3.applyStatRows(progress3, [
    { kid_id: "lili", stat: "balloon", value: 12 },
    { kid_id: "lili", stat: "race", value: 40 },
    { kid_id: "lili", stat: "orc", value: 7 },
    { kid_id: "lili", stat: "shop", value: 22 },
    { kid_id: "lili", stat: "city", value: 3 },
    { kid_id: "lili", stat: "dig", value: 9 },
    { kid_id: "lili", stat: "missions", value: 5 },
    { kid_id: "lili", stat: "bogus_key", value: 99 },
  ]);

  assert.equal(progress3.lili.best.balloon, 12, "balloon best lost");
  assert.equal(progress3.lili.best.race, 40, "race best lost");
  assert.equal(progress3.lili.best.orc, 7, "orc best lost");
  assert.equal(progress3.lili.best.shop, 22, "shop best lost");
  assert.equal(progress3.lili.best.city, 3, "city best lost");
  assert.equal(progress3.lili.best.dig, 9, "dig best lost");
  assert.equal(progress3.lili.missions, 5, "missions lost");
  assert.equal(progress3.lili.best.bogus_key, undefined, "unknown stat must not be stored");
  console.log("ok - legacy high scores hydrate");
}

// --- Injected best-stat predicate (slice 16) ---
{
  var localStorage4 = makeLocalStorage();
  var SyncStore4 = loadSyncStore(localStorage4);

  // Default: unchanged whitelist, so sync.js is correct with no registry present.
  var plain4 = new SyncStore4({ progress: {} });
  var p1 = {};
  plain4.applyStatRows(p1, [
    { kid_id: "luis", stat: "orc", value: 30 },
    { kid_id: "luis", stat: "rocket", value: 11 },
  ]);
  assert.equal(p1.luis.best.orc, 30);
  assert.equal(p1.luis.best.rocket, undefined, "unregistered key must be ignored by default");

  // Injected: a new game's key is recognised without editing sync.js.
  SyncStore4.setBestStatCheck(function (key) { return key === "rocket" || key === "orc"; });
  var injected4 = new SyncStore4({ progress: {} });
  var p2 = {};
  injected4.applyStatRows(p2, [
    { kid_id: "luis", stat: "rocket", value: 11 },
    { kid_id: "luis", stat: "balloon", value: 4 },
  ]);
  assert.equal(p2.luis.best.rocket, 11, "injected predicate not consulted");
  assert.equal(p2.luis.best.balloon, undefined, "injected predicate must fully replace the default");

  // brain_* keys survive whatever is injected — the gym does not go through the registry.
  SyncStore4.setBestStatCheck(function (key) { return key === "rocket"; });
  var brain4 = new SyncStore4({ progress: {} });
  var p3 = {};
  brain4.applyStatRows(p3, [{ kid_id: "lili", stat: "brain_calc", value: 18 }]);
  assert.equal(p3.lili.best.brain_calc, 18, "brain_ prefix must be unconditional");

  SyncStore4.setBestStatCheck(null); // restore for any later test in this file
  console.log("ok - best-stat predicate is injectable");
}

console.log("sync tests passed");
