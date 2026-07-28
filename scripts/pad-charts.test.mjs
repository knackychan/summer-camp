import test from "node:test";
import assert from "node:assert/strict";
import { CHARTS } from "../js/games/pad-charts.js";

test("exactly 6 exercises", function () {
  assert.equal(CHARTS.length, 6);
});

test("every exercise has a unique id", function () {
  var seen = new Set();
  CHARTS.forEach(function (c) {
    assert.ok(!seen.has(c.id), "duplicate id: " + c.id);
    seen.add(c.id);
  });
});

test("every exercise is fully bilingual", function () {
  CHARTS.forEach(function (c) {
    assert.ok(c.name && c.name.en && c.name.tz, c.id + ": name must be bilingual");
  });
});

test("every exercise has exactly 4 lanes", function () {
  CHARTS.forEach(function (c) {
    assert.ok(Array.isArray(c.lanes) && c.lanes.length === 4,
      c.id + ": must have exactly 4 lanes, got " + (c.lanes ? c.lanes.length : 0));
  });
});

test("lane indices in notes are within range", function () {
  CHARTS.forEach(function (c) {
    c.notes.forEach(function (n, i) {
      assert.ok(n.lane >= 0 && n.lane < c.lanes.length,
        c.id + " note " + i + ": lane " + n.lane + " out of range");
    });
  });
});

test("beats are within bars * 4", function () {
  CHARTS.forEach(function (c) {
    var maxBeat = c.bars * 4;
    c.notes.forEach(function (n, i) {
      assert.ok(n.beat < maxBeat,
        c.id + " note " + i + ": beat " + n.beat + " >= " + maxBeat);
    });
  });
});

test("bpm is reasonable (40-200)", function () {
  CHARTS.forEach(function (c) {
    assert.ok(c.bpm >= 40 && c.bpm <= 200, c.id + ": bpm " + c.bpm + " out of range");
  });
});

test("bpm rises monotonically within a tier", function () {
  for (var tier = 1; tier <= 3; tier++) {
    var tierCharts = CHARTS.filter(function (c) { return c.tier === tier; });
    for (var i = 1; i < tierCharts.length; i++) {
      assert.ok(tierCharts[i].bpm >= tierCharts[i - 1].bpm,
        "tier " + tier + ": bpm should not decrease at " + tierCharts[i].id);
    }
  }
});

test("backing names a real earlier exercise or null", function () {
  CHARTS.forEach(function (c) {
    if (c.backing === null) return;
    var found = CHARTS.some(function (d) { return d.id === c.backing; });
    assert.ok(found, c.id + ": backing \"" + c.backing + "\" does not exist");
    /* backing must be an earlier exercise (the chain) */
    var idx = CHARTS.indexOf(c);
    var backingIdx = CHARTS.findIndex(function (d) { return d.id === c.backing; });
    assert.ok(backingIdx < idx, c.id + ": backing must be earlier, got idx " + backingIdx + " but current is " + idx);
  });
});

test("backing chain has no cycles", function () {
  /* Every exercise with non-null backing points to an earlier exercise */
  CHARTS.forEach(function (c) {
    if (!c.backing) return;
    var visited = new Set();
    var current = c;
    while (current && current.backing) {
      if (visited.has(current.id)) {
        assert.fail("Cycle detected at " + current.id);
      }
      visited.add(current.id);
      current = CHARTS.find(function (d) { return d.id === current.backing; });
    }
  });
});

test("tiers are 1, 2, or 3", function () {
  CHARTS.forEach(function (c) {
    assert.ok(c.tier >= 1 && c.tier <= 3, c.id + ": tier must be 1-3, got " + c.tier);
  });
});
