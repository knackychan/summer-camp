// SyncStore unit test — offline queue + hydration replay (the riskiest sync logic).
// Runs in plain Node with stubbed browser globals; no dependencies.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const src = readFileSync(new URL("../js/sync.js", import.meta.url), "utf8");
const SQStarId = createRequire(import.meta.url)("../js/star-id.js");

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
function fakeSupabase(tables, writes, readBarrier = Promise.resolve()) {
  return {
    from(table) {
      const rows = tables[table] || [];
      const builder = {};
      for (const m of ["select", "eq", "or", "order", "gte", "lte", "limit", "delete"]) {
        builder[m] = () => builder;
      }
      builder.maybeSingle = () => readBarrier.then(() => ({ data: rows[0] || null, error: null }));
      builder.then = (ok, bad) => readBarrier.then(() => ({ data: rows, error: null })).then(ok, bad);
      for (const m of ["upsert", "insert", "update"]) {
        builder[m] = payload => {
          writes.push({ table, op: m, payload });
          const result = Promise.resolve({ error: null });
          result.eq = () => result;
          return result;
        };
      }
      return builder;
    },
    storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) }
  };
}

function loadSyncStore(localStorage) {
  const windowObj = { SQStarId };
  const run = new Function("window", "localStorage", "navigator", "addEventListener", "document", src);
  run(windowObj, localStorage, { onLine: true }, () => {}, {});
  return windowObj.SyncStore;
}

const seedProgress = () => ({});

// --- Test 1: enqueueDiff never mints a star (slice 52) ---
{
  const ls = makeLocalStorage();
  const SyncStore = loadSyncStore(ls);
  const writes = [];
  const store = new SyncStore({ progress: seedProgress(), settings: {} }, fakeSupabase({}, writes));

  const before = JSON.parse(JSON.stringify(store.progress));
  const after = JSON.parse(JSON.stringify(store.progress));
  after.lili.day = { d: TODAY, done: { 2: true }, rr: { 4: 1 } };
  after.lili.actsDay = { d: TODAY, done: { 0: true } };
  after.lili.stars = 5;                    // a stale field from an old localStorage payload
  after.lili.vocab["w:cat"] = 2;
  after.lili.best.race = 42;
  after.lili.best.city = 7;
  after.lili.best.dig = 4;

  store.enqueueDiff(before, after);
  const types = store.queue.map(o => o.type).sort();
  assert.deepEqual(types, ["actDone", "roll", "stat", "stat", "stat", "tick", "vocab"]);
  assert.equal(store.queue.filter(o => o.type === "stars").length, 0,
    "enqueueDiff must never mint a star — addStars is the only path");
  assert.ok(store.queue.every(o => o.id), "every op carries a client uuid for dedupe");
  console.log("ok - enqueueDiff never mints a star");
}

// --- Test 1b: addStars is the only star path, reason reaches the queue (slice 52) ---
{
  const ls = makeLocalStorage();
  const SyncStore = loadSyncStore(ls);
  const store = new SyncStore({ progress: seedProgress(), settings: {} }, fakeSupabase({}, []));
  store.configured = true;

  store.addStars("luis", 1, "Brain Gym 頭腦體操 · daily set 每日三項 · test");
  // synchronous: the op is on the queue before the first await, so the celebration UI renders correctly
  assert.equal(store.queue.filter(o => o.type === "stars").length, 1, "addStars enqueued exactly one star op");
  const op = store.queue.find(o => o.type === "stars");
  assert.equal(op.delta, 1);
  assert.equal(op.reason, "Brain Gym 頭腦體操 · daily set 每日三項 · test");
  assert.ok(op.id, "op carries a uuid");

  // starsFor reflects it immediately — no await needed (Constraint 2)
  assert.equal(store.starsFor("luis"), 1, "starsFor reflects the pending op synchronously");
  console.log("ok - addStars is the only star path");
}

// --- Test 1c: grant/revoke round trip through applyStarTotals (slice 52) ---
{
  const ls = makeLocalStorage();
  const SyncStore = loadSyncStore(ls);
  const store = new SyncStore({ progress: seedProgress(), settings: {} }, fakeSupabase({}, []));
  store.configured = true;

  // Papa grants +3 from admin
  store.applyStarTotals([{ kid_id: "lili", stars: 3 }], "lili");
  assert.equal(store.starsFor("lili"), 3, "Papa's grant shows on the tablet");

  // any later save must not re-enqueue it
  const before = JSON.parse(JSON.stringify(store.progress));
  store.last = before;
  store.enqueueDiff(store.last, store.progress);
  assert.equal(store.queue.filter(o => o.type === "stars").length, 0,
    "Papa's grant is already in the ledger — it must never be re-enqueued");

  // a revoke must actually lower the tablet
  store.applyStarTotals([{ kid_id: "lili", stars: 0 }], "lili");
  assert.equal(store.starsFor("lili"), 0, "a revoke must actually lower the tablet count");

  // then the kid earns one for real — the queue must receive it
  store.addStars("lili", 1, "Mission 任務 · test");
  // synchronous: op is enqueued before the first await
  const starOp = store.queue.find(o => o.type === "stars" && o.reason === "Mission 任務 · test");
  assert.ok(starOp, "the earned star is on the queue before flush");
  assert.equal(starOp.delta, 1, "revoke did not eat the star delta");
  console.log("ok - grant and revoke round-trip through serverStars");
}

// --- Test 1d: totals + pending, no flicker guarantee (slice 52) ---
{
  const ls = makeLocalStorage();
  const SyncStore = loadSyncStore(ls);
  const store = new SyncStore({ progress: seedProgress(), settings: {} }, fakeSupabase({}, []));

  // server says 5 for lili, 0 for luis
  store.applyStarTotals([{ kid_id: "lili", stars: 5 }, { kid_id: "luis", stars: 0 }]);
  // one unflushed local op
  store.enqueue({ type: "stars", kid: "lili", delta: 2, reason: "offline win" });

  assert.equal(store.starsFor("lili"), 7, "tablet shows server total plus its unflushed local stars");
  assert.equal(store.starsFor("luis"), 0, "luis has no pending stars");

  // simulate the op being flushed and the server total refreshed to include it
  store.queue = [];
  store.applyStarTotals([{ kid_id: "lili", stars: 7 }], "lili");
  assert.equal(store.starsFor("lili"), 7, "displayed count does not flicker at the sync boundary");
  console.log("ok - displayed stars are self-balancing across a sync");
}

// --- Test 1e: an act key act_done cannot store never reaches (and stalls) the queue ---
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

// --- Test 2: hydrate merges server rows THEN replays the pending queue (slice 52) ---
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
  assert.equal(store.starsFor("lili"), 5, "server total via starsFor after hydrate flush");
  assert.equal(store.kidPins.lili, "1234");
  assert.equal(store.queue.length, 0, "queue flushed to server");
  assert.ok(writes.some(w => w.table === "day_ticks" && w.op === "upsert"), "tick reached supabase");
  assert.ok(writes.some(w => w.table === "stars_ledger" && w.op === "insert"), "star reached supabase");
  console.log("ok - hydrate merges server state and replays pending queue");
}

// --- Test 3: local-only mode — stars still work with no server (slice 52) ---
{
  const ls = makeLocalStorage();
  const SyncStore = loadSyncStore(ls);
  const store = await SyncStore.init({ progress: seedProgress(), settings: { a: 1 } });
  assert.equal(store.mode, "local-only");
  store.addStars("luis", 3, "local-only test");
  assert.equal(store.starsFor("luis"), 3, "stars still work with no server configured");
  assert.equal(store.queue.length, 0, "local-only mode never queues network ops");
  const persisted = JSON.parse(ls.getItem("sq:serverStars"));
  assert.equal(persisted.luis, 3, "serverStars persisted for local-only mode");
  console.log("ok - local-only stars work without config");
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



// --- Test: a failed hydrate does not destroy the store (slice 50) ---
{
  // Build a fake client whose from() returns a builder that rejects every query,
  // so hydrate()'s Promise.all throws. init must still resolve with a working store.
  function fakeFailingSupabase() {
    const builder = {};
    for (const m of ["select", "eq", "or", "order", "gte", "lte", "limit", "delete"]) {
      builder[m] = () => builder;
    }
    builder.maybeSingle = () => builder;
    builder.then = function(_, bad) { setImmediate(() => bad(new Error("simulated offline"))); };
    for (const m of ["upsert", "insert", "update"]) {
      builder[m] = () => Promise.reject(new Error("simulated offline"));
    }
    return { from() { return builder; } };
  }

  const ls = makeLocalStorage({
    "keyquest:v2": JSON.stringify({
      progress: { lili: { stars: 12, best:{}, vocab:{}, missions:0, day:{d:"",done:{},rr:{}} } },
      settings: {}
    }),
    "sq:queue": JSON.stringify([{ id:"op-x", type:"stars", kid:"lili", delta:1, reason:"offline win" }])
  });

  const windowObj = { SQStarId };
  windowObj.SQ_CONFIG = { SUPABASE_URL: "https://test", SUPABASE_ANON_KEY: "test-key" };
  windowObj.supabase = { createClient: () => fakeFailingSupabase() };
  const run2 = new Function("window", "localStorage", "navigator", "addEventListener", "document", src);
  run2(windowObj, ls, { onLine: false }, () => {}, {});
  const SyncStoreF = windowObj.SyncStore;

  let store;
  try {
    store = await SyncStoreF.init({ progress: {}, settings: {} });
  } catch (e) {
    assert.fail("init must not reject when hydrate fails");
  }
  assert.ok(store, "init returns a store even when hydrate fails");
  await store.ready;
  assert.equal(store.queue.length, 1, "pending queue op not dropped");
  assert.equal(store.mode, "supabase", "mode stays supabase even when server unreachable");
  console.log("ok - init survives a failed hydrate");
}

// --- Test: configured but offline still queues (slice 51) ---
{
  const ls = makeLocalStorage();
  const windowObj = { SQStarId };
  windowObj.SQ_CONFIG = { SUPABASE_URL: "https://test.supabase.co", SUPABASE_ANON_KEY: "test" };
  windowObj.supabase = { createClient: () => fakeSupabase({}, []) };
  const run2 = new Function("window", "localStorage", "navigator", "addEventListener", "document", src);
  run2(windowObj, ls, { onLine: false }, () => {}, {});
  const SyncStore51 = windowObj.SyncStore;

  const store = new SyncStore51({ progress: seedProgress(), settings: {} }, fakeSupabase({}, []));

  const before = JSON.parse(JSON.stringify(store.progress));
  const after = JSON.parse(JSON.stringify(store.progress));
  after.lili.day = { d: TODAY, done: { 3: true }, rr: {} };

  store.enqueueDiff(before, after);
  assert.ok(store.queue.length > 0, "configured + offline still queues tick ops");
  assert.ok(store.queue.some(o => o.type === "tick"), "tick ops are queued offline");

  // round-trip through saveJson into localStorage
  const loaded = JSON.parse(ls._map.get("sq:queue"));
  assert.ok(loaded.some(o => o.type === "tick"), "tick op persists to localStorage queue");
  console.log("ok - configured but offline still queues");
}

// --- Test: a totals read cannot overtake a flush (slice 51 D5) ---
{
  const ls = makeLocalStorage({ "sq:queue": JSON.stringify([{ id: "op-star", type: "stars", kid: "lili", delta: 1, reason: "test" }]) });
  const SyncStore = loadSyncStore(ls);

  const writes = [];
  let totalsCalls = 0;

  const client = {
    from(table) {
      const builder = {};
      for (const m of ["select", "eq", "or", "order", "gte", "lte", "limit", "delete"]) {
        builder[m] = () => builder;
      }
      builder.maybeSingle = () => builder;
      for (const m of ["upsert", "insert", "update"]) {
        builder[m] = payload => {
          writes.push({ table, op: m, payload });
          return Promise.resolve({ error: null });
        };
      }
      if (table === "star_totals") {
        builder.then = function(ok, bad) {
          totalsCalls++;
          return Promise.resolve({ data: [{ kid_id: "lili", stars: 6 }], error: null }).then(ok, bad);
        };
      } else {
        builder.then = (ok, bad) => Promise.resolve({ data: [], error: null }).then(ok, bad);
      }
      return builder;
    }
  };

  const store = new SyncStore({ progress: seedProgress(), settings: {} }, client);
  store.configured = true;

  assert.equal(store.queue.length, 1, "pre-seeded star op is loaded from queue");

  const flushPromise = store.flush();
  const refreshPromise = store.refreshStarTotals("lili");
  await Promise.all([flushPromise, refreshPromise]);

  assert.ok(writes.some(w => w.table === "stars_ledger" && w.op === "insert"), "star was flushed to ledger");
  assert.ok(totalsCalls >= 1, "star_totals was read at least once");
  console.log("ok - totals read cannot overtake a flush");
}

// --- Test: full offline round trip (slice 52 end-to-end) ---
{
  const ls = makeLocalStorage();

  // Phase 1: earn a star offline
  const SyncStore = loadSyncStore(ls);
  const store = new SyncStore({ progress: seedProgress(), settings: {} }, fakeSupabase({}, []));
  store.configured = true;
  store.addStars("lili", 2, "offline win");
  assert.equal(store.starsFor("lili"), 2, "earned star shows immediately");

  // Phase 2: simulate reload — fresh store over same localStorage
  const queued = JSON.parse(ls._map.get("sq:queue"));
  const SyncStore2 = loadSyncStore(ls);
  const store2 = new SyncStore2({ progress: seedProgress(), settings: {} }, fakeSupabase({}, []));
  assert.equal(store2.starsFor("lili"), 2, "stars survive a reload with pending queue");

  // Phase 3: flush against a fake client that reflects the star
  const writes = [];
  const client = fakeSupabase({ star_totals: [{ kid_id: "lili", stars: 5 }] }, writes);
  const SyncStore3 = loadSyncStore(makeLocalStorage({ "sq:queue": ls._map.get("sq:queue") }));
  const store3 = new SyncStore3({ progress: seedProgress(), settings: {} }, client);
  store3.configured = true;
  assert.equal(store3.starsFor("lili"), 2, "starsFor with only the queued term");

  // Phase 4: flush sends the star, then refresh picks up the new total
  await store3.flush();
  assert.equal(store3.queue.length, 0, "queue drained after flush");
  store3.applyStarTotals([{ kid_id: "lili", stars: 7 }], "lili");
  assert.equal(store3.starsFor("lili"), 7, "post-sync total matches — no flicker, no dip");
  console.log("ok - full offline round trip");
}

// --- Test: a season reset wipes the tablet's local copy, and only once ---
{
  const ls = makeLocalStorage({
    "keyquest:v2": JSON.stringify({ progress: { lili: { vocab: { "w:cat": 3 }, best: { race: 40 } } }, settings: {} }),
    "sq:queue": JSON.stringify([{ id: "op-old", type: "stars", kid: "lili", delta: 2, reason: "last season" }]),
    "sq:serverStars": JSON.stringify({ lili: 40 })
  });
  const SyncStore = loadSyncStore(ls);
  const writes = [];
  const client = fakeSupabase({
    family_settings: [{ key: "season_reset_at", value: "2026-08-02T04:00:00Z" }]
  }, writes);
  const store = new SyncStore({ progress: seedProgress(), settings: {} }, client);

  await store.hydrate();
  assert.equal(ls._map.has("keyquest:v2"), false, "last season's progress dropped");
  assert.equal(ls._map.has("sq:queue"), false, "pending ops from last season dropped, not replayed");
  assert.equal(ls._map.has("sq:serverStars"), false, "cached star totals dropped");
  assert.equal(ls._map.get("sq:seasonReset"), '"2026-08-02T04:00:00Z"', "stamp recorded so the wipe cannot loop");
  assert.equal(writes.length, 0, "nothing from last season is pushed back to the server");

  // Same stamp on the next boot: hydrate must run normally, not wipe again.
  const SyncStore2 = loadSyncStore(ls);
  const writes2 = [];
  const store2 = new SyncStore2({ progress: seedProgress(), settings: {} }, fakeSupabase({
    family_settings: [{ key: "season_reset_at", value: "2026-08-02T04:00:00Z" }],
    star_totals: [{ kid_id: "lili", stars: 0 }]
  }, writes2));
  await store2.hydrate();
  assert.equal(store2.starsFor("lili"), 0, "new season starts at zero and hydrate completed");
  console.log("ok - a season reset wipes the tablet once");
}

// Startup and local actions must not wait for the first remote snapshot.
{
  let finishRead;
  const readBarrier = new Promise(resolve => { finishRead = resolve; });
  const ls = makeLocalStorage({
    "sq:kidPins": JSON.stringify({ lili: "1234" }),
    "sq:serverStars": JSON.stringify({ lili: 4 })
  });
  const writes = [];
  const client = fakeSupabase({
    kids: [{ id: "lili", pin: "1234" }],
    day_ticks: [{ kid_id: "lili", block_idx: 1 }],
    get star_totals() { return [{ kid_id: "lili", stars: writes.some(write => write.table === "stars_ledger") ? 6 : 4 }]; },
    family_settings: [{ key: "applock_lili", value: "old lock" }]
  }, writes, readBarrier);
  const windowObj = {
    SQStarId,
    SQ_CONFIG: { SUPABASE_URL: "https://test", SUPABASE_ANON_KEY: "test" },
    supabase: { createClient: () => client }
  };
  new Function("window", "localStorage", "navigator", "addEventListener", "document", src)(windowObj, ls, { onLine: true }, () => {}, {});
  const store = windowObj.SyncStore.init({ progress: {}, settings: {} });
  assert.equal(store.starsFor("lili"), 4, "cached store is returned before the first network await");
  assert.equal(store.pinsReady, true, "cached PIN protection is available immediately");
  let ready = false;
  store.ready.then(() => { ready = true; });
  const progress = structuredClone(store.progress);
  progress.lili.day = { d: TODAY, done: { 7: true }, rr: {} };
  await store.save(progress, {});
  await store.addStars("lili", 2, "during startup");
  await store.setFamilySetting("applock_lili", "");
  await store.setOverride(TODAY, 2, "09:30", "lili");
  assert.equal(ready, false, "local actions resolve while the remote read remains blocked");
  assert.equal(store.starsFor("lili"), 6, "local stars appear before sync is ready");
  assert.equal(writes.length, 0, "queued writes cannot overtake the initial season-reset check");
  assert.equal(JSON.parse(ls.getItem("sq:queue")).length, 4, "actions are durable before they resolve");
  finishRead();
  await store.ready;
  assert.equal(store.hydrated, true);
  assert.equal(store.progress, progress, "hydrate applies to the latest saved progress object");
  assert.equal(progress.lili.day.done[1], true, "server tick is retained");
  assert.equal(progress.lili.day.done[7], true, "local action during startup survives the snapshot");
  assert.equal(store.familySettings.applock_lili, "", "pending family-setting changes survive hydration");
  assert.equal(store.dayOverridesRaw.lili[2], "09:30", "pending schedule edits survive hydration");
  await store.flush();
  assert.equal(store.starsFor("lili"), 6, "queue drainage preserves the confirmed star count");
  assert.equal(store.queue.length, 0);
  clearInterval(store.flushTimer);
  console.log("ok - local startup and actions complete before delayed sync, with no lost edits");
}

// PostgREST failures return {error}, rather than rejecting: keep the usable cache.
{
  const ls = makeLocalStorage({ "sq:kidPins": JSON.stringify({ lili: "1234" }) });
  const SyncStore = loadSyncStore(ls);
  const client = fakeSupabase({ kids: [{ id: "lili", pin: "5678" }] }, []);
  const from = client.from.bind(client);
  client.from = table => table === "kids" ? {
    select: () => Promise.resolve({ data: null, error: new Error("offline") })
  } : from(table);
  const store = new SyncStore({ progress: {}, settings: {} }, client);
  store.progress.lili.day = { d: TODAY, done: { 3: true }, rr: {} };
  await assert.rejects(store.hydrate(), /offline/);
  assert.equal(store.kidPins.lili, "1234", "a failed read cannot clear PIN protection");
  assert.equal(store.progress.lili.day.done[3], true, "a failed read cannot clear the cached day");
  assert.equal(store.hydrated, false);
  client.from = table => {
    const builder = from(table);
    if (table === "photos") builder.then = (ok, bad) => Promise.resolve({ data: null, error: new Error("photos offline") }).then(ok, bad);
    return builder;
  };
  await assert.rejects(store.hydrate(), /photos offline/);
  assert.equal(store.kidPins.lili, "5678", "a successful PIN query applies even when another table fails");
  assert.equal(store.pinsReady, true);
  console.log("ok - failed snapshot preserves cached progress and PINs");
}

// Several realtime callbacks share a read; events during it get a fresh follow-up.
{
  let finishRead;
  const barrier = new Promise(resolve => { finishRead = resolve; });
  const SyncStore = loadSyncStore(makeLocalStorage());
  const client = fakeSupabase({}, [], barrier);
  const from = client.from.bind(client);
  let reads = 0;
  client.from = table => { reads++; return from(table); };
  const store = new SyncStore({ progress: {}, settings: {} }, client);
  const first = store.hydrate();
  assert.equal(store.hydrate(), first, "callbacks in one burst share the pending hydrate");
  await Promise.resolve();
  assert.equal(reads, 15);
  const trailing = store.hydrate();
  assert.notEqual(trailing, first, "an event during an active read gets a fresh snapshot");
  assert.equal(store.hydrate(), trailing, "later callbacks share that follow-up read");
  finishRead();
  await Promise.all([first, trailing]);
  assert.equal(reads, 30, "four callbacks issue two snapshot batches, rather than four");
  console.log("ok - realtime bursts coalesce without dropping later updates");
}

// The SDK is loaded from the packaged app and both network waits are bounded.
for (const fails of [false, true]) {
  let script, expire, options, removed = 0;
  const windowObj = { SQStarId, SQ_CONFIG: { SUPABASE_URL: "https://test", SUPABASE_ANON_KEY: "test" } };
  const document = {
    currentScript: { src: "https://app.test/subpath/js/sync.js" },
    querySelector: () => null,
    createElement: () => ({ remove() { removed++; } }),
    head: { appendChild: element => { script = element; } }
  };
  new Function("window", "localStorage", "navigator", "addEventListener", "document", "setTimeout", "clearTimeout", src)(
    windowObj, makeLocalStorage(), { onLine: false }, () => {}, document,
    (callback, delay) => { assert.equal(delay, 8000); expire = callback; }, () => {}
  );
  const store = windowObj.SyncStore.init({ progress: {}, settings: {} });
  assert.equal(store.pinsReady, false, "a fresh device has not checked the children's PINs");
  await Promise.resolve();
  assert.equal(script.src, "https://app.test/subpath/js/vendor/supabase.js");
  if (fails) expire();
  else {
    windowObj.supabase = { createClient: (url, key, config) => { options = config; return {}; } };
    script.onload();
  }
  await store.ready;
  if (!fails) assert.equal(options.db.timeout, 10000, "use the installed client's built-in database timeout");
  else {
    assert.equal(store.supabase, null, "SDK timeout leaves the cached app usable");
    assert.equal(removed, 1, "failed SDK element is removed so a retry can load it again");
    const failedScript = script;
    let connected = 0;
    let appended;
    const nextScript = new Promise(resolve => { appended = resolve; });
    document.head.appendChild = element => { script = element; appended(); };
    store.onConnected = () => { connected++; };
    const reconnect = store.connect();
    assert.equal(store.connect(), reconnect, "concurrent reconnect attempts share the same work");
    await nextScript;
    assert.notEqual(script, failedScript, "reconnect creates a new packaged SDK request");
    windowObj.supabase = { createClient: () => ({}) };
    script.onload();
    await reconnect;
    assert.equal(store.mode, "supabase");
    assert.equal(connected, 1, "new client notifies the app to attach realtime subscriptions");
    await store.connect();
    assert.equal(connected, 1, "an existing client does not attach realtime twice");
  }
  clearInterval(store.flushTimer);
}
console.log("ok - packaged SDK loading and database requests have deadlines");

// A later failed op must not skip refreshing stars that were already committed.
{
  const SyncStore = loadSyncStore(makeLocalStorage());
  const store = new SyncStore({ progress: {}, settings: {} }, fakeSupabase({
    star_totals: [{ kid_id: "lili", stars: 6 }]
  }, []));
  store.applyStarTotals([{ kid_id: "lili", stars: 4 }]);
  store.enqueue({ type: "stars", kid: "lili", delta: 2 });
  store.enqueue({ type: "tick", kid: "lili", day: TODAY, blockIdx: 1, ticked: true });
  store.applyOp = async op => { if (op.type === "tick") throw new Error("offline"); };
  await store.flush();
  assert.equal(store.starsFor("lili"), 6);
  assert.equal(store.queue.length, 1, "failed write remains durable for the next attempt");
  console.log("ok - a partially failed flush still refreshes committed stars");
}

console.log("sync tests passed");
