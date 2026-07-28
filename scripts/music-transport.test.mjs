import test from "node:test";
import assert from "node:assert/strict";

import { createTransport, judge } from "../js/game-services/music.js";

/* Fake clock: the test drives time forward; the transport reads it. */
function fakeClock() {
  var t = 0;
  return {
    now: 0,
    get outputLatency() { return 0.01; },
    get baseLatency() { return 0.005; },
    get sampleRate() { return 44100; },
    advance: function (ms) { t += ms / 1000; this.now = t; }
  };
}

/* Fake scheduler: runs callbacks synchronously on demand (for testing), ignoring real time. */
function fakeScheduler() {
  var intervals = [];
  var animations = [];
  var afters = [];
  var cancelled = false;
  return {
    _intervals: intervals,
    _animations: animations,
    _afters: afters,
    every: function (ms, fn) {
      if (cancelled) return function () {};
      var entry = { ms: ms, fn: fn, isCancelled: false };
      intervals.push(entry);
      return function () { entry.isCancelled = true; };
    },
    frame: function (fn) {
      if (cancelled) return function () {};
      var entry = { fn: fn, isCancelled: false };
      animations.push(entry);
      return function () { entry.isCancelled = true; };
    },
    after: function (ms, fn) {
      if (cancelled) return function () {};
      afters.push({ ms: ms, fn: fn });
      return function () {};
    },
    pause: function () {},
    resume: function () {},
    cancelAll: function () {
      cancelled = true;
      intervals.length = 0;
      animations.length = 0;
      afters.length = 0;
    },
    tick: function () {
      intervals.forEach(function (e) { if (!e.isCancelled) e.fn(); });
    },
    tickAnim: function (ts) {
      animations.forEach(function (e) { if (!e.isCancelled) e.fn(ts); });
    },
    get activeCount() { return intervals.length + animations.length; }
  };
}

/* A simple 2-bar test chart at 120bpm, 4 beats per bar */
function testChart() {
  return {
    bpm: 120,
    bars: 2,
    lanes: ["kick", "snare", "hat", "clap"],
    notes: [
      { beat: 0, lane: 0 },
      { beat: 1, lane: 1 },
      { beat: 2, lane: 0 },
      { beat: 3, lane: 1 },
      { beat: 4, lane: 2 },
      { beat: 5, lane: 2 },
      { beat: 6, lane: 3 },
      { beat: 7, lane: 3 }
    ]
  };
}

/* Beat duration at 120bpm = 0.5s */
function secAtBeat(beat, bpm) { return beat * 60 / bpm; }

/* Transport tests */

test("every note fires exactly once, in beat order", function () {
  var clock = fakeClock();
  var sched = fakeScheduler();
  var played = [];
  var t = createTransport({
    clock: clock,
    playNote: function (note, absoluteTime) {
      played.push({ beat: note.beat, lane: note.lane, time: absoluteTime });
    },
    sched: sched
  });

  t.start(testChart());

  /* Advance clock through all beats */
  var endTime = secAtBeat(8, 120) + 0.5;
  while (clock.now < endTime) {
    sched.tick();
    clock.advance(25);
  }

  assert.equal(played.length, 8, "should play 8 notes, got " + played.length);
  for (var i = 0; i < played.length; i++) {
    assert.equal(played[i].beat, i, "note at index " + i + " should be beat " + i + ", got beat " + played[i].beat);
  }

  t.stop();
});

test("each note is scheduled ahead of its play time", function () {
  var clock = fakeClock();
  var sched = fakeScheduler();
  var scheduleTimes = [];
  var t = createTransport({
    clock: clock,
    playNote: function (note, absoluteTime) {
      scheduleTimes.push({ clockWhenScheduled: clock.now, playAt: absoluteTime });
    },
    sched: sched
  });

  var chart = testChart();
  var bpm = chart.bpm;
  t.start(chart);

  var endTime = secAtBeat(8, bpm) + 0.5;
  while (clock.now < endTime) {
    sched.tick();
    clock.advance(25);
  }

  for (var i = 0; i < scheduleTimes.length; i++) {
    var s = scheduleTimes[i];
    assert.ok(s.clockWhenScheduled <= s.playAt,
      "note scheduled at " + s.clockWhenScheduled + " for " + s.playAt + " — should be scheduled before play time");
  }

  t.stop();
});

test("big clock jump does not fire a burst of stale notes", function () {
  var clock = fakeClock();
  var sched = fakeScheduler();
  var played = [];
  var t = createTransport({
    clock: clock,
    playNote: function (note, absoluteTime) {
      played.push({ beat: note.beat });
    },
    sched: sched
  });

  var chart = testChart();
  t.start(chart);

  /* Play through beat 2, then jump far ahead (tab backgrounded) */
  var midTime = secAtBeat(2, chart.bpm);
  while (clock.now < midTime) {
    sched.tick();
    clock.advance(25);
  }
  var playedBeforeJump = played.length;

  /* Jump ahead 30 seconds — should skip all missed notes */
  clock.advance(30000);
  /* Run a few more ticks after the jump */
  for (var j = 0; j < 20; j++) {
    sched.tick();
    clock.advance(25);
  }
  var playedAfterJump = played.length;

  assert.ok(playedBeforeJump >= 1, "should have played at least 1 note before jump");
  assert.ok(playedAfterJump - playedBeforeJump <= 2,
    "after 30s jump, should play at most 2 remaining notes in lookahead, got " + (playedAfterJump - playedBeforeJump));

  t.stop();
});

test("beat-to-time math is exact at 60, 100, 137 bpm", function () {
  var clock = fakeClock();
  var sched = fakeScheduler();
  var t = createTransport({
    clock: clock,
    playNote: function () {},
    sched: sched
  });

  var bpms = [60, 100, 137];
  for (var b = 0; b < bpms.length; b++) {
    var chart = { bpm: bpms[b], bars: 32, lanes: [], notes: [] };
    t.start(chart);
    var time0 = t.beatToTime(0);
    var time1 = t.beatToTime(1);
    var time32 = t.beatToTime(32);
    var expectedDelta = 60 / bpms[b];
    assert.ok(Math.abs(time1 - time0 - expectedDelta) < 0.0001,
      "bpm " + bpms[b] + ": one beat delta should be " + expectedDelta + ", got " + (time1 - time0));
    var expectedTime32 = time0 + 32 * expectedDelta;
    assert.ok(Math.abs(time32 - expectedTime32) < 0.01,
      "bpm " + bpms[b] + ": beat 32 drift too large");
    t.stop();
  }
});

test("pause and resume keep one transport loop", function () {
  var clock = fakeClock();
  var sched = fakeScheduler();
  var t = createTransport({
    clock: clock,
    playNote: function () {},
    sched: sched
  });

  t.start(testChart());
  assert.equal(sched._intervals.filter(function (e) { return !e.isCancelled; }).length, 1);

  t.pause();
  assert.equal(sched._intervals.filter(function (e) { return !e.isCancelled; }).length, 0);

  t.resume();
  assert.equal(sched._intervals.filter(function (e) { return !e.isCancelled; }).length, 1);

  t.stop();
});

/* Judge tests */

test("judge boundaries at offset=0", function () {
  var noteAbsTime = 0; /* reference: note should fire at time 0 */
  /* Perfect: <50ms */
  assert.equal(judge(noteAbsTime + 0.049, noteAbsTime, 0, []), "perfect");
  assert.equal(judge(noteAbsTime + 0.001, noteAbsTime, 0, []), "perfect");
  assert.equal(judge(noteAbsTime - 0.049, noteAbsTime, 0, []), "perfect");

  /* Good: 50-99ms */
  assert.equal(judge(noteAbsTime + 0.051, noteAbsTime, 0, []), "good");
  assert.equal(judge(noteAbsTime + 0.099, noteAbsTime, 0, []), "good");
  assert.equal(judge(noteAbsTime - 0.051, noteAbsTime, 0, []), "good");

  /* OK: 100-179ms */
  assert.equal(judge(noteAbsTime + 0.101, noteAbsTime, 0, []), "ok");
  assert.equal(judge(noteAbsTime + 0.179, noteAbsTime, 0, []), "ok");
  assert.equal(judge(noteAbsTime - 0.101, noteAbsTime, 0, []), "ok");

  /* Miss: >=180ms */
  assert.equal(judge(noteAbsTime + 0.181, noteAbsTime, 0, []), "miss");
  assert.equal(judge(noteAbsTime - 0.181, noteAbsTime, 0, []), "miss");
});

test("judge honours the calibration offset", function () {
  var noteAbsTime = 0;
  var offset = 80; /* ms — the tablet is 80ms late */

  /* Tap comes 80ms after the beat — with 80ms offset this is perfect */
  assert.equal(judge(noteAbsTime + 0.080, noteAbsTime, offset, []), "perfect");

  /* Tap exactly on the drawn beat — with 80ms offset, effective diff is 80ms, which is "good" */
  assert.equal(judge(noteAbsTime, noteAbsTime, offset, []), "good");
});

