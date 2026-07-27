import test from "node:test";
import assert from "node:assert/strict";
import { SOLAR, PLANETS } from "../js/games/solar-data.js";

test("sun and exactly eight planets, ordered by distance", function () {
  assert.equal(SOLAR.id, "sun");
  assert.ok(SOLAR.name && SOLAR.tz);
  assert.equal(typeof SOLAR.diameterKm, "number");
  assert.ok(SOLAR.type && SOLAR.type.en && SOLAR.type.tz);
  assert.ok(SOLAR.desc && SOLAR.desc.en && SOLAR.desc.tz);
  assert.ok(Array.isArray(SOLAR.facts) && SOLAR.facts.length === 3);
  assert.equal(PLANETS.length, 8);
  for (var i = 1; i < PLANETS.length; i++) {
    assert.ok(PLANETS[i].au > PLANETS[i - 1].au, PLANETS[i].id + " out of order");
  }
  assert.equal(PLANETS[0].id, "mercury");
  assert.equal(PLANETS[7].id, "neptune");
});

test("every planet has a complete bilingual schema", function () {
  var seen = new Set();
  for (var i = 0; i < PLANETS.length; i++) {
    var p = PLANETS[i];
    assert.ok(p.id && !seen.has(p.id)); seen.add(p.id);
    assert.ok(p.name, p.id + ": missing English name");
    assert.ok(p.tz, p.id + ": missing \u4e2d\u6587 name");
    assert.equal(typeof p.color, "number");
    var keys = ["diameterKm", "au", "yearDays", "dayHours", "moons"];
    for (var j = 0; j < keys.length; j++) {
      assert.equal(typeof p[keys[j]], "number", p.id + ": " + keys[j] + " must be a number");
    }
    assert.ok(Array.isArray(p.facts) && p.facts.length === 3, p.id + ": exactly 3 facts");
    for (var k = 0; k < p.facts.length; k++) {
      assert.ok(p.facts[k].en && p.facts[k].tz, p.id + ": fact must be bilingual");
    }
    assert.ok(p.type && p.type.en && p.type.tz, p.id + ": type must be bilingual");
    assert.ok(p.desc && p.desc.en && p.desc.tz, p.id + ": desc must be bilingual");
    assert.match(p.photo, /^assets\/solar\/[a-z]+\.jpg$/, p.id + ": photo must be a vendored asset path");
  }
});

test("quiz superlatives are computable and unique", function () {
  var byMax = function (k) { return PLANETS.reduce(function (a, b) { return b[k] > a[k] ? b : a; }); };
  var byMin = function (k) { return PLANETS.reduce(function (a, b) { return b[k] < a[k] ? b : a; }); };
  assert.equal(byMax("diameterKm").id, "jupiter");
  assert.equal(byMin("au").id, "mercury");
  assert.equal(byMax("au").id, "neptune");
  assert.equal(byMax("moons").id, "saturn");
  var flags = ["biggest", "hottest", "coldest", "mostMoons", "red", "rings"];
  for (var i = 0; i < flags.length; i++) {
    var holders = PLANETS.filter(function (p) { return p.flags && p.flags[flags[i]]; });
    assert.equal(holders.length, 1, "flag " + flags[i] + " must name exactly one planet");
  }
  assert.equal(PLANETS.find(function (p) { return p.flags.red; }).id, "mars");
});

test("anchor facts stay true (guard against well-meaning edits)", function () {
  var earth = PLANETS.find(function (p) { return p.id === "earth"; });
  assert.equal(earth.moons, 1);
  assert.equal(earth.yearDays, 365);
  assert.equal(PLANETS.find(function (p) { return p.id === "mercury"; }).moons, 0);
});
