import test from "node:test";
import assert from "node:assert/strict";
import { DRILLS } from "../js/games/piano-drills.js";

test("exactly 6 exercises", function () {
  assert.equal(DRILLS.length, 6);
});

test("every exercise has a unique id", function () {
  var seen = new Set();
  DRILLS.forEach(function (d) {
    assert.ok(!seen.has(d.id), "duplicate id: " + d.id);
    seen.add(d.id);
  });
});

test("every exercise is fully bilingual", function () {
  DRILLS.forEach(function (d) {
    assert.ok(d.name && d.name.en && d.name.tz, d.id + ": name must be bilingual");
    assert.ok(d.hint && d.hint.en && d.hint.tz, d.id + ": hint must be bilingual");
  });
});

test("hand is right, left, or both", function () {
  var valid = ["right", "left", "both"];
  DRILLS.forEach(function (d) {
    assert.ok(valid.indexOf(d.hand) >= 0, d.id + ": hand must be right/left/both, got " + d.hand);
  });
});

test("every step has finger 1-5", function () {
  DRILLS.forEach(function (d) {
    d.steps.forEach(function (s, i) {
      assert.ok(s.finger >= 1 && s.finger <= 5,
        d.id + " step " + i + ": finger must be 1-5, got " + s.finger);
    });
  });
});

test("every step has at least one midi note", function () {
  DRILLS.forEach(function (d) {
    d.steps.forEach(function (s, i) {
      var hasMidi = typeof s.midi === "number" || typeof s.midiR === "number";
      assert.ok(hasMidi, d.id + " step " + i + ": must have midi or midiR");
    });
  });
});

test("midi values are in piano range (21-108)", function () {
  DRILLS.forEach(function (d) {
    d.steps.forEach(function (s, i) {
      if (typeof s.midi === "number") {
        assert.ok(s.midi >= 21 && s.midi <= 108,
          d.id + " step " + i + ": midi " + s.midi + " out of range");
      }
      if (typeof s.midiR === "number") {
        assert.ok(s.midiR >= 21 && s.midiR <= 108,
          d.id + " step " + i + ": midiR " + s.midiR + " out of range");
      }
      if (typeof s.midiL === "number") {
        assert.ok(s.midiL >= 21 && s.midiL <= 108,
          d.id + " step " + i + ": midiL " + s.midiL + " out of range");
      }
    });
  });
});

test("beats are within bars * 4", function () {
  DRILLS.forEach(function (d) {
    var maxBeat = d.bars * 4;
    d.steps.forEach(function (s, i) {
      assert.ok(s.beat < maxBeat,
        d.id + " step " + i + ": beat " + s.beat + " >= " + maxBeat);
    });
  });
});

test("beats are in non-decreasing order", function () {
  DRILLS.forEach(function (d) {
    for (var i = 1; i < d.steps.length; i++) {
      assert.ok(d.steps[i].beat >= d.steps[i - 1].beat,
        d.id + ": beats out of order at step " + i);
    }
  });
});

test("bpm is reasonable (30-200)", function () {
  DRILLS.forEach(function (d) {
    assert.ok(d.bpm >= 30 && d.bpm <= 200, d.id + ": bpm " + d.bpm + " out of range");
  });
});
