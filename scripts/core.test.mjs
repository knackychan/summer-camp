import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SQTime = require("../js/time-core.js");

const DAY = [
  { t: "8:00", title: "Wake", tz: "起床", kind: "routine", txtz: {} },
  { t: "10:00", title: "Homework", tz: "暑假作業", kind: "mission" },
  { t: "11:15", title: "Screen #1 — earned", tz: "螢幕#1", kind: "routine", txtz: {} },
  { t: "17:15", title: "Sport", tz: "運動", kind: "mission" },
  { t: "✨", title: "Bonus", tz: "加碼", kind: "mission" },
];

test("parseMins", () => {
  assert.equal(SQTime.parseMins("8:00"), 480);
  assert.equal(SQTime.parseMins("17:15"), 1035);
  assert.equal(SQTime.parseMins("✨"), null);
  assert.equal(SQTime.parseMins(undefined), null);
});

test("effMins uses override when present", () => {
  assert.equal(SQTime.effMins(DAY, {}, 1), 600);
  assert.equal(SQTime.effMins(DAY, { 1: "15:00" }, 1), 900);
  assert.equal(SQTime.effMins(DAY, {}, 4), null);
});

test("timedOrder sorts by effective time and skips untimed", () => {
  assert.deepEqual(SQTime.timedOrder(DAY, {}).map(x => x.i), [0, 1, 2, 3]);
  assert.deepEqual(SQTime.timedOrder(DAY, { 1: "15:00" }).map(x => x.i), [0, 2, 1, 3]);
});

test("timelineInfo current/next with and without overrides", () => {
  assert.deepEqual(SQTime.timelineInfo(DAY, {}, 7 * 60), { now: 420, current: 0, next: 0 });
  const mid = SQTime.timelineInfo(DAY, {}, 10 * 60 + 30);
  assert.equal(mid.current, 1);
  assert.equal(mid.next, 2);
  const late = SQTime.timelineInfo(DAY, {}, 23 * 60);
  assert.equal(late.current, 3);
  assert.equal(late.next, null);
  const moved = SQTime.timelineInfo(DAY, { 1: "15:00" }, 10 * 60 + 30);
  assert.equal(moved.current, 0);
  assert.equal(moved.next, 2);
  const aft = SQTime.timelineInfo(DAY, { 1: "15:00" }, 15 * 60 + 5);
  assert.equal(aft.current, 1);
  assert.equal(aft.next, 3);
});

test("timelineInfo before first block clamps to first timed", () => {
  const info = SQTime.timelineInfo(DAY, {}, 0);
  assert.equal(info.current, 0);
});

test("neededBefore respects effective order", () => {
  assert.deepEqual(SQTime.neededBefore(DAY, {}, 2), [0, 1]);
  assert.deepEqual(SQTime.neededBefore(DAY, { 1: "15:00" }, 2), [0]);
});

test("displayOrder = timed ascending then untimed in DAY order", () => {
  assert.deepEqual(SQTime.displayOrder(DAY, {}), [0, 1, 2, 3, 4]);
  assert.deepEqual(SQTime.displayOrder(DAY, { 1: "15:00" }), [0, 2, 1, 3, 4]);
});

test("resolveOverrides: kid row wins over all row", () => {
  const raw = {
    all: { 1: "15:00", 3: "17:30" },
    lili: { 1: "16:00" },
  };
  assert.deepEqual(SQTime.resolveOverrides(raw, "lili"), { 1: "16:00", 3: "17:30" });
  assert.deepEqual(SQTime.resolveOverrides(raw, "luis"), { 1: "15:00", 3: "17:30" });
  assert.deepEqual(SQTime.resolveOverrides(raw, null), { 1: "15:00", 3: "17:30" });
  assert.deepEqual(SQTime.resolveOverrides(null, "lili"), {});
});
