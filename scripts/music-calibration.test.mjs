import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { calibrate, computeOffset } from "../js/game-services/music.js";
import { getSharedAudio, resetSharedAudioForTest } from "../js/game-services/audio.js";

/* computeOffset is pure: no DOM, no storage, no AudioContext. Feed it arrays of
   beat times (ms) and tap times (ms); it returns {offsetMs, confident}. */

test("drops the first two pairs", function () {
  var beats  = [0, 600, 1200, 1800, 2400, 3000, 3600, 4200];
  var taps   = [0, 600, 1200, 1803, 2405, 3002, 3600, 4200];
  /* The first two pairs (indices 0,1) are dropped. The remaining 6 (indices 2-7)
     all have offset 0 or tiny, so the median should be about 2. */
  var r = computeOffset(taps, beats);
  assert.ok(r.confident, "should be confident with tight taps");
  assert.ok(Math.abs(r.offsetMs) < 10, "offset should be near 0, got " + r.offsetMs);
});

test("returns the median, not the mean", function () {
  var beats = [0, 600, 1200, 1800, 2400, 3000, 3600, 4200];
  /* After dropping first two pairs, remaining taps have offsets spread widely:
     array indices:  2: +0, 3: +500, 4: +200, 5: -300, 6: +400 */
  var taps  = [0, 600, 1200, 2300, 2600, 2700, 4000, 4200];
  var r = computeOffset(taps, beats);
  /* Median of [0, 500, 200, -300, 400] = 200 */
  assert.equal(r.offsetMs, 100, "median should be 100");
  /* The IQR of these values is wide enough to trigger low confidence */
  assert.equal(r.confident, false, "wide spread should be low confidence");
});

test("one wild outlier does not move the result more than a few ms", function () {
  var beats = [0, 600, 1200, 1800, 2400, 3000, 3600, 4200];
  var taps  = [0, 600, 1200, 1805, 2405, 999999, 3600, 4200];
  var r = computeOffset(taps, beats);
  assert.ok(Math.abs(r.offsetMs) < 15, "outlier should not dominate, got " + r.offsetMs);
});

test("reports low confidence when spread exceeds threshold", function () {
  var beats = [0, 600, 1200, 1800, 2400, 3000, 3600, 4200];
  /* After dropping first two: offsets: 0, 200, -180, 100, -170, 300 */
  var taps  = [0, 600, 1200, 2000, 2220, 3100, 3430, 4500];
  var r = computeOffset(taps, beats);
  assert.equal(r.confident, false, "wide spread should be low confidence");
  /* Should still return a number, not NaN */
  assert.ok(typeof r.offsetMs === "number" && isFinite(r.offsetMs));
});

test("fewer than 4 usable taps returns no result", function () {
  var beats = [0, 600, 1200];
  var taps  = [0, 600, 1200];
  /* After dropping first two, only 1 pair left */
  var r = computeOffset(taps, beats);
  assert.equal(r.offsetMs, null, "too few taps should return null offset");
  assert.equal(r.confident, false);
});

test("no taps at all returns null", function () {
  var r = computeOffset([], []);
  assert.equal(r.offsetMs, null);
  assert.equal(r.confident, false);
});

test("mismatched tap/beat lengths handled cleanly", function () {
  var beats = [0, 600, 1200, 1800, 2400, 3000, 3600, 4200];
  var taps  = [0, 600, 1200, 1800];
  var r = computeOffset(taps, beats);
  /* After dropping first two: 2 pairs usable — too few */
  assert.equal(r.offsetMs, null);
  assert.equal(r.confident, false);
});

test("realistic calibration — consistent 50ms late", function () {
  var beats = [0, 600, 1200, 1800, 2400, 3000, 3600, 4200];
  var taps  = [0, 600, 1250, 1850, 2450, 3050, 3650, 4250];
  var r = computeOffset(taps, beats);
  assert.ok(r.confident, "consistent taps should be confident");
  assert.ok(Math.abs(r.offsetMs - 50) <= 5, "offset should be ~50ms, got " + r.offsetMs);
});

test("calibration runs from first gesture, measures live audio time and cleans up", async function (t) {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: 0 });
  const cues = createRequire(import.meta.url)("../js/brain-audio-cues.js");
  const sources = [], saved = new Map(), results = [], beatProgress = [], tapProgress = [];
  const parameter = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {} });
  const source = () => {
    const value = Object.assign(node(), {
      frequency: parameter(), start(time) { this.started = time; },
      stop(time) { if (time === undefined) this.cancelled = true; }
    });
    sources.push(value);
    return value;
  };
  const ctx = {
    state: "suspended", sampleRate: 1000, destination: {},
    get currentTime() { return Date.now() / 1000; },
    createGain: () => Object.assign(node(), { gain: parameter() }),
    createOscillator: source, createBufferSource: source,
    createBiquadFilter: () => Object.assign(node(), { frequency: parameter(), Q: parameter() }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(500) }),
    resume() { return Promise.resolve().then(() => { ctx.state = "running"; }); },
    close() {}
  };
  const previousWindow = globalThis.window, previousStorage = globalThis.localStorage;
  globalThis.window = { AudioContext: function () { return ctx; }, SQBrainCues: cues };
  globalThis.localStorage = {
    getItem: key => saved.get(key) || null,
    setItem: (key, value) => saved.set(key, value)
  };
  resetSharedAudioForTest();
  let run;
  const begin = async () => {
    run = calibrate({
      onResult: value => results.push(value),
      onBeat: (number, total) => beatProgress.push([number, total]),
      onTap: (number, total) => tapProgress.push([number, total])
    });
    await Promise.resolve();
    await Promise.resolve();
    return run;
  };
  const advance = ms => {
    for (let remaining = ms; remaining > 0; remaining -= 25) t.mock.timers.tick(Math.min(25, remaining));
  };
  try {
    const starting = begin();
    assert.equal(getSharedAudio().unlocked, true, "audio unlock happens in the starting gesture");
    await starting;
    assert.equal(run.onTap(), false, "ignore taps before the count-in ends");
    for (let i = 0; i < 8; i++) {
      advance(i ? 600 : 1550);
      assert.equal(run.onTap(), true);
      assert.equal(run.onTap(), false, "one tap per beat, including duplicate pointer events");
    }
    advance(500);
    assert.deepEqual(results, [{ offsetMs: 50, confident: true }]);
    assert.deepEqual(beatProgress, Array.from({ length: 8 }, (_, i) => [i + 1, 8]));
    assert.deepEqual(tapProgress, beatProgress);
    assert.equal(sources.length, 16, "two real cue layers for each of eight clicks");
    sources.forEach((value, i) => assert.ok(Math.abs(value.started - (1.5 + Math.floor(i / 2) * 0.6)) < 1e-9));
    const goodCalibration = saved.get("sq.music.latency");
    assert.equal(JSON.parse(goodCalibration).offsetMs, 50);
    advance(1000);
    assert.equal(results.length, 1, "finish reports exactly once");
    assert.equal(run.onTap(), false, "finished calibration no longer accepts input");

    await begin();
    for (let i = 0; i < 8; i++) {
      advance(i ? 600 : 1550);
      if (i !== 3) run.onTap();
    }
    advance(500);
    assert.equal(results.at(-1).reason, "not_enough_taps");
    assert.equal(saved.get("sq.music.latency"), goodCalibration, "missing beat must not overwrite a valid offset");

    await begin();
    advance(1400);
    const beforeCancel = sources.length, resultCount = results.length;
    run.cancel();
    run.cancel();
    advance(6500);
    assert.equal(sources.length, beforeCancel, "cancel stops future clicks");
    assert.ok(sources.every(value => value.cancelled), "cancel also stops already scheduled clicks");
    assert.equal(results.length, resultCount, "cancel does not report a result later");

    await begin();
    ctx.state = "suspended";
    advance(25);
    assert.equal(results.at(-1).reason, "interrupted");
    assert.equal(saved.get("sq.music.latency"), goodCalibration);

    getSharedAudio().setMuted(true);
    await begin();
    advance(25);
    assert.equal(results.at(-1).reason, "muted");
    assert.equal(getSharedAudio().muted, true, "calibration respects mute");

    resetSharedAudioForTest();
    delete window.AudioContext;
    await begin();
    assert.equal(results.at(-1).reason, "audio_unavailable");
  } finally {
    if (run) run.cancel();
    resetSharedAudioForTest();
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousStorage;
  }
});
