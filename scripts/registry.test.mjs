import test from "node:test";
import assert from "node:assert/strict";
import { SQGames } from "../js/games/registry.js";
import { MANIFEST } from "../js/games/index.js";

function fresh() {
  SQGames.reset();
  return SQGames;
}

var DIG = {
  id: "dig",
  meta: { icon: "\u26cf\ufe0f", title: "Dig Site", tz: "\u6316\u571f\u5de5\u5730", blurb: "Dig the right rocks" },
  keyboard: false,
  bestKey: "dig",
  init: function () {},
  stop: function () {},
};

test("register then get returns the same game", function () {
  var g = fresh();
  g.register(DIG);
  assert.equal(g.get("dig"), DIG);
  assert.equal(g.has("dig"), true);
  assert.equal(g.has("nope"), false);
});

test("get on an unknown id returns null, never throws", function () {
  var g = fresh();
  assert.equal(g.get("nope"), null);
});

test("registering the same id twice throws", function () {
  var g = fresh();
  g.register(DIG);
  assert.throws(function () { g.register(DIG); }, /already registered/);
});

test("register rejects a game with no id or no init", function () {
  var g = fresh();
  assert.throws(function () { g.register({ meta: DIG.meta, init: function () {} }); }, /id/);
  assert.throws(function () { g.register({ id: "x", meta: DIG.meta }); }, /init/);
});

test("isBest matches a registered bestKey and nothing else", function () {
  var g = fresh();
  g.register(DIG);
  assert.equal(g.isBest("dig"), true);
  assert.equal(g.isBest("balloon"), false);
  assert.equal(g.isBest(""), false);
});

test("isBest ignores games that declare no bestKey", function () {
  var g = fresh();
  g.register({ id: "hunt", meta: DIG.meta, bestKey: null, init: function () {}, stop: function () {} });
  assert.equal(g.isBest("hunt"), false);
});

test("ids returns registration order, not insertion-sorted order", function () {
  var g = fresh();
  g.register({ id: "zebra", meta: DIG.meta, init: function () {}, stop: function () {} });
  g.register({ id: "apple", meta: DIG.meta, init: function () {}, stop: function () {} });
  assert.deepEqual(g.ids(), ["zebra", "apple"]);
});

test("manifest lists every game with a bilingual title and blurb", function () {
  assert.ok(MANIFEST.length >= 18);
  var seen = new Set();
  for (var i = 0; i < MANIFEST.length; i++) {
    var entry = MANIFEST[i];
    assert.ok(entry.id, "entry missing id");
    assert.equal(seen.has(entry.id), false, "duplicate id " + entry.id);
    seen.add(entry.id);
    assert.ok(entry.meta.icon, entry.id + ": missing icon");
    assert.ok(entry.meta.title, entry.id + ": missing English title");
    assert.ok(entry.meta.tz, entry.id + ": missing \u4e2d\u6587 title");
    assert.ok(entry.meta.blurb, entry.id + ": missing blurb");
    assert.equal(typeof entry.keyboard, "boolean", entry.id + ": keyboard must be boolean");
  }
});

test("manifest bestKeys are unique where present", function () {
  var keys = MANIFEST.map(function (e) { return e.bestKey; }).filter(Boolean);
  assert.equal(new Set(keys).size, keys.length, "duplicate bestKey in manifest");
});

test("brain games are flagged and carry no arcade bestKey", function () {
  var brain = MANIFEST.filter(function (e) { return e.brain; });
  assert.equal(brain.length, 9);
  for (var i = 0; i < brain.length; i++) {
    assert.equal(brain[i].bestKey, null, brain[i].id + ": brain games score via brain_*");
  }
});
