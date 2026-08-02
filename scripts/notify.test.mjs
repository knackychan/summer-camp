/* js/notify.js — the feed and the achievement latch. No DOM: push() only touches
   document when it toasts, and it only toasts for the active kid, so passing a
   different activeKid exercises the storage half on its own. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const SQNotify = createRequire(import.meta.url)("../js/notify.js");
const OTHER = "nobody"; // never the kid under test → never toasts → never needs a DOM

test("feed records newest-first and unread clears on markSeen", () => {
  mem.clear();
  SQNotify.push("lili", OTHER, { kind: "star", en: "one" });
  SQNotify.push("lili", OTHER, { kind: "star", en: "two" });
  const rows = SQNotify.feed("lili");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].en, "two");
  assert.ok(rows[0].t, "entry is timestamped");
  assert.equal(SQNotify.unread("lili"), 2);
  SQNotify.markSeen("lili");
  assert.equal(SQNotify.unread("lili"), 0);
});

test("a repeated ref is dropped — realtime replays the same row on reconnect", () => {
  mem.clear();
  SQNotify.push("luis", OTHER, { kind: "msg", ref: "ask:1", en: "hi" });
  SQNotify.push("luis", OTHER, { kind: "msg", ref: "ask:1", en: "hi" });
  SQNotify.push("luis", OTHER, { kind: "msg", ref: "ask:2", en: "hi again" });
  assert.equal(SQNotify.feed("luis").length, 2);
});

test("feeds are per kid and capped", () => {
  mem.clear();
  for (let i = 0; i < 70; i++) SQNotify.push("lucien", OTHER, { kind: "star", en: "s" + i });
  assert.equal(SQNotify.feed("lucien").length, 60);
  assert.equal(SQNotify.feed("lucien")[0].en, "s69", "oldest rolls off, not newest");
  assert.equal(SQNotify.feed("lili").length, 0);
});

test("an achievement unlocks once and is never taken back", () => {
  mem.clear();
  const none = { stars: 0, words: 0, games: 0, acts: 0, fullDay: false, brain: false };
  assert.equal(SQNotify.check("lili", none).length, 0);

  const first = SQNotify.check("lili", Object.assign({}, none, { stars: 12 }));
  assert.deepEqual(first.map((a) => a.id), ["star1", "star10"], "both thresholds fire together");
  assert.equal(SQNotify.check("lili", Object.assign({}, none, { stars: 12 })).length, 0, "no re-fire");

  // stars revoked back to zero: the badge stays earned
  assert.equal(SQNotify.check("lili", none).length, 0);
  assert.ok(SQNotify.earned("lili").includes("star10"));
});

test("every achievement ships EN + 中文", () => {
  for (const a of SQNotify.ACHIEVEMENTS) {
    assert.ok(a.en && a.zh, `${a.id} must be bilingual`);
    assert.ok(/[一-鿿]/.test(a.zh), `${a.id} zh must contain Chinese`);
  }
});
