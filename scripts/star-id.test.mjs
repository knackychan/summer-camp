// Star identity + grant-once/revoke-exactly. This is the currency path: if two
// blocks ever share an id a kid silently loses a star, and if an id is not a
// legal uuid Postgres rejects the insert and the tablet's queue parks.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SQStarId = require("../js/star-id.js");

const KIDS = ["lucien", "lili", "luis"];
const DAY = "2026-08-03";
// Postgres accepts any 32 hex digits in 8-4-4-4-12 shape.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// --- 1: every id is a legal uuid, and ids never collide ---
{
  const seen = new Map();
  for (const kid of KIDS) {
    for (const day of [DAY, "2026-08-04", "2026-12-31", "2027-01-01"]) {
      const ids = [];
      for (let i = 0; i < 16; i++) ids.push(SQStarId.block(kid, day, i));
      ids.push(SQStarId.bonus(kid, day));
      for (const id of ids) {
        assert.match(id, UUID, `${id} is not a uuid Postgres will accept`);
        assert.ok(!seen.has(id), `id collision: ${id} already used by ${seen.get(id)}`);
        seen.set(id, `${kid}/${day}`);
      }
    }
  }
  // 3 kids x 4 days x (16 blocks + 1 bonus)
  assert.equal(seen.size, 3 * 4 * 17);
  console.log("ok - star ids are legal uuids and never collide");
}

// --- 2: the same block always maps to the same id (that IS the dedup) ---
{
  assert.equal(SQStarId.block("lili", DAY, 4), SQStarId.block("lili", DAY, 4));
  assert.equal(SQStarId.bonus("lili", DAY), SQStarId.bonus("lili", DAY));
  // A frozen expectation: changing the encoding orphans every star already in
  // the ledger, so undo would stop finding them. Fail loudly if it ever moves.
  assert.equal(SQStarId.block("lucien", "2026-08-03", 0), "b10c57a2-2026-0803-0001-000000000000");
  assert.equal(SQStarId.block("luis", "2026-08-03", 15), "b10c57a2-2026-0803-0003-000000000015");
  assert.equal(SQStarId.bonus("lili", "2026-08-03"), "b10c57a2-2026-0803-0002-000000000999");
  console.log("ok - block -> id is stable");
}

// --- 3: junk in never produces someone else's id ---
{
  for (const bad of [
    () => SQStarId.block("mallory", DAY, 0),
    () => SQStarId.block("", DAY, 0),
    () => SQStarId.block(null, DAY, 0),
    () => SQStarId.block("lili", "not-a-day", 0),
    () => SQStarId.block("lili", "", 0),
    () => SQStarId.block("lili", DAY, -1),
    () => SQStarId.block("lili", DAY, undefined),
    () => SQStarId.bonus("mallory", DAY)
  ]) {
    assert.equal(bad(), null, "bad input must be null, never a usable id");
  }
  console.log("ok - bad input yields no id");
}

// --- 4: deterministic ids can be decoded for exact admin revoke ---
{
  assert.deepEqual(SQStarId.parse(SQStarId.block("lili", DAY, 4)), {
    kid: "lili",
    day: DAY,
    slot: 4,
    kind: "block"
  });
  assert.deepEqual(SQStarId.parse(SQStarId.bonus("luis", DAY)), {
    kid: "luis",
    day: DAY,
    slot: 999,
    kind: "bonus"
  });
  for (const bad of [
    "",
    "not-a-uuid",
    "b10c57a2-2026-0803-0009-000000000004",
    "b10c57a2-2026-0803-0002-000000000004".toUpperCase(),
    "10000000-1000-4000-8000-100000000000"
  ]) {
    assert.equal(SQStarId.parse(bad), null, "bad id must not look schedule-owned");
  }
  console.log("ok - deterministic star ids decode for admin actions");
}

// --- 4b: one rule for what a block is worth ---
// The admin panel and the tablet both ask blockDelta(). While they each decided
// it inline, Remove credited +1 on a routine block that Accept granted nothing
// for, so Remove -> Add back -> Accept lost a star nothing could give back.
{
  const { DAY } = require("../js/day-data.js");
  // Flat 1 per block (Papa, 2026-08-04): the schedule is what pays, so routine
  // blocks are worth the same as mission blocks.
  assert.equal(SQStarId.blockDelta({ kind: "mission" }), 1);
  assert.equal(SQStarId.blockDelta({ kind: "routine" }), 1);
  for (const junk of [null, undefined, {}, { kind: "" }]) {
    assert.equal(SQStarId.blockDelta(junk), 0, "an unknown block is worth nothing, never NaN");
  }
  // every block in the real day plan pays, so a full day is DAY.length + bonus
  assert.equal(DAY.reduce((s, b) => s + SQStarId.blockDelta(b), 0), DAY.length);
  assert.equal(SQStarId.BONUS_DELTA, 2, "the day-complete bonus is frozen at +2");
  console.log("ok - one rule prices a block for both apps");
}

// --- 5: addStars treats a repeat of the same id as the same star ---
{
  const src = readFileSync(new URL("../js/sync.js", import.meta.url), "utf8");
  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
  const windowObj = {};
  new Function("window", "localStorage", "navigator", "addEventListener", "document", src)(
    windowObj, localStorage, { onLine: false }, () => {}, {}
  );
  const SyncStore = windowObj.SyncStore;

  // configured: the queue must not double-count two pending inserts of one row
  const online = new SyncStore({ progress: {}, settings: {} }, null);
  online.configured = true;
  const id = SQStarId.block("lili", DAY, 4);
  online.addStars("lili", 1, "Block", id);
  online.addStars("lili", 1, "Block", id);
  assert.equal(online.queue.filter(o => o.type === "stars").length, 1, "same id must queue once");
  assert.equal(online.starsFor("lili"), 1, "a re-tick must not show a second star");
  online.addStars("lili", 1, "Block", SQStarId.block("lili", DAY, 5));
  assert.equal(online.starsFor("lili"), 2, "a different block still earns");
  // an unkeyed star (Activity, Learn, Brain Gym) is unaffected
  online.addStars("lili", 1, "Learn 學習 · test");
  online.addStars("lili", 1, "Learn 學習 · test");
  assert.equal(online.starsFor("lili"), 4, "stars with no id are not deduped");

  // local-only: no server primary key, so the store has to dedup itself
  const offline = new SyncStore({ progress: {}, settings: {} }, null);
  offline.configured = false;
  offline.addStars("luis", 1, "Block", SQStarId.block("luis", DAY, 2));
  offline.addStars("luis", 1, "Block", SQStarId.block("luis", DAY, 2));
  assert.equal(offline.starsFor("luis"), 1, "local-only must dedup on id too");
  offline.addStars("luis", 2, "Day complete", SQStarId.bonus("luis", DAY));
  assert.equal(offline.starsFor("luis"), 3, "the bonus is a different id");
  console.log("ok - one star per block, whoever asks twice");
}
