import test from "node:test";
import assert from "node:assert/strict";
import { buildMission, grade } from "../js/games/solar-quiz.js";
import { PLANETS } from "../js/games/solar-data.js";

/* deterministic rng for tests — generates values 0.01, 0.02, … cyclically */
var seq = function (arr) { var i = 0; return function () { return arr[i++ % arr.length]; }; };
var longSeq = function () {
  var vals = [];
  for (var n = 0; n < 200; n++) vals.push((n + 1) / 201);
  return seq(vals);
};

test("a mission is 8 questions, no repeated target", function () {
  var m = buildMission(PLANETS, longSeq());
  assert.equal(m.length, 8);
  var targets = m.map(function (q) { return q.targetId; });
  assert.equal(new Set(targets).size, 8);
});

test("every question is bilingual and names a real planet", function () {
  var m = buildMission(PLANETS, Math.random);
  var ids = new Set(PLANETS.map(function (p) { return p.id; }));
  for (var i = 0; i < m.length; i++) {
    var q = m[i];
    assert.ok(q.promptEn && q.promptTz, "prompt must be bilingual");
    assert.ok(ids.has(q.targetId));
    assert.ok(q.kind === "name" || q.kind === "superlative");
  }
});

test("superlative answers agree with the data", function () {
  var m = buildMission(PLANETS, longSeq());
  for (var i = 0; i < m.length; i++) {
    var q = m[i];
    if (!q.superlative) continue;
    var p = PLANETS.find(function (x) { return x.id === q.targetId; });
    if (q.superlative === "closest") assert.equal(p.id, "mercury");
    if (q.superlative === "biggest") assert.equal(p.id, "jupiter");
    if (q.superlative === "mostMoons") assert.equal(p.id, "saturn");
  }
});

test("grade: first-try correct scores a star; retries are free", function () {
  var q = { kind: "name", targetId: "mars", promptEn: "Tap Mars", promptTz: "\u9ede\u706b\u661f" };
  assert.deepEqual(grade(q, "venus", 0), { correct: false, star: false });
  assert.deepEqual(grade(q, "mars", 1), { correct: true, star: false });  // retry: right, no star
  assert.deepEqual(grade(q, "mars", 0), { correct: true, star: true });   // first try: star
});

test("four superlative questions exist in every mission", function () {
  var m = buildMission(PLANETS, Math.random);
  var sups = m.filter(function (q) { return q.kind === "superlative"; });
  assert.equal(sups.length, 4);
  var names = m.filter(function (q) { return q.kind === "name"; });
  assert.equal(names.length, 4);
});
