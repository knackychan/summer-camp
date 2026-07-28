import test from "node:test";
import assert from "node:assert/strict";
import { resetSharedAudioForTest, getSharedAudio } from "../js/game-services/audio.js";

function makeFakeContext() {
  var calls = [];
  var sources = [];
  var gains = [];
  var buffers = [];

  function makeBufferSource() {
    var self = {};
    self.buffer = null;
    self.playbackRate = { value: 1 };
    self.loop = false;
    self._started = null;
    self._stopped = false;
    self.start = function (when) { self._started = when || 0; };
    self.stop = function () { self._stopped = true; };
    self.connect = function (dest) { self._dest = dest; };
    self.disconnect = function () {};
    sources.push(self);
    calls.push("createBufferSource");
    return self;
  }

  function makeGain() {
    var self = {};
    self.gain = { value: 1, setValueAtTime: function () {}, exponentialRampToValueAtTime: function () {} };
    self.connect = function () {};
    self.disconnect = function () {};
    gains.push(self);
    calls.push("createGain");
    return self;
  }

  function decodeAudioData(buf) {
    calls.push("decodeAudioData");
    return Promise.resolve({ _decoded: true, _buf: buf });
  }

  var ctx = {
    currentTime: 0,
    state: "running",
    sampleRate: 44100,
    outputLatency: 0.01,
    baseLatency: 0.005,
    destination: { _isDestination: true },
    createGain: makeGain,
    createBufferSource: makeBufferSource,
    createBuffer: function (channels, frames, rate) {
      var b = { channels: channels, frames: frames, sampleRate: rate, _data: [] };
      for (var c = 0; c < channels; c++) {
        b._data[c] = new Float32Array(frames);
      }
      b.getChannelData = function (ch) { return b._data[ch]; };
      buffers.push(b);
      return b;
    },
    decodeAudioData: decodeAudioData,
    resume: function () { return Promise.resolve(); },
    close: function () { calls.push("close"); return Promise.resolve(); }
  };

  var ctor = function (opts) { calls.push("ctor:" + JSON.stringify(opts || {})); return ctx; };
  ctor._calls = calls;
  ctor._sources = sources;
  ctor._gains = gains;
  ctor._buffers = buffers;
  ctor._ctx = ctx;
  ctor.resetCalls = function () { calls.length = 0; sources.length = 0; gains.length = 0; buffers.length = 0; };
  return ctor;
}

function installFakeEnv() {
  var Ctor = makeFakeContext();
  globalThis.window = {
    AudioContext: Ctor,
    webkitAudioContext: Ctor,
    SQBrainCues: {
      CUES: { "ui-tap": [{ t: "tone", wave: "triangle", f0: 520, f1: 330, at: 0, dur: 0.045, gain: 0.1 }] },
      CUE_NAMES: ["ui-tap"],
      cueDuration: function () { return 0.045; },
      renderCue: function (ctx, dest, name, opts) {
        var src = ctx.createGain();
        src._started = true;
        return { stop: function () {} };
      }
    }
  };
  return Ctor;
}

function uninstallFakeEnv() {
  delete globalThis.window;
}

test("default cap is still 4", function () {
  var Ctor = installFakeEnv();
  resetSharedAudioForTest();
  try {
    var audio = getSharedAudio();
    audio.unlock();
    assert.equal(audio.maxVoices, 4);
    for (var i = 0; i < 6; i++) audio.play("ui-tap");
    var sources = Ctor._sources.filter(function (s) { return s._started !== null && !s._stopped; });
    assert.ok(sources.length <= 4, "at most 4 voices alive, got " + sources.length);
  } finally { uninstallFakeEnv(); resetSharedAudioForTest(); }
});

test("setMaxVoices raises cap, returns previous, can restore", function () {
  var Ctor = installFakeEnv();
  resetSharedAudioForTest();
  try {
    var audio = getSharedAudio();
    audio.unlock();
    assert.equal(audio.maxVoices, 4);
    var prev = audio.setMaxVoices(24);
    assert.equal(prev, 4);
    assert.equal(audio.maxVoices, 24);
    var prev2 = audio.setMaxVoices(prev);
    assert.equal(prev2, 24);
    assert.equal(audio.maxVoices, 4);
  } finally { uninstallFakeEnv(); resetSharedAudioForTest(); }
});

test("graph returns shared context and master without second context", function () {
  var Ctor = installFakeEnv();
  resetSharedAudioForTest();
  try {
    var audio = getSharedAudio();
    audio.unlock();
    var g = audio.graph();
    assert.ok(g.ctx);
    assert.ok(g.master);
    assert.equal(g.ctx, Ctor._ctx);
    assert.equal(Ctor._calls.filter(function (c) { return c.indexOf("ctor:") === 0; }).length, 1);
  } finally { uninstallFakeEnv(); resetSharedAudioForTest(); }
});

test("clock returns audio time values, zeroes with no context", function () {
  resetSharedAudioForTest();
  try {
    var audio = getSharedAudio();
    var c1 = audio.clock();
    assert.equal(c1.now, 0);
    assert.equal(c1.outputLatency, 0);
    assert.equal(c1.sampleRate, 0);

    installFakeEnv();
    var audio2 = getSharedAudio();
    audio2.unlock();
    var c2 = audio2.clock();
    assert.ok(typeof c2.now === "number");
    assert.equal(c2.outputLatency, 0.015);
    assert.equal(c2.sampleRate, 44100);
  } finally { uninstallFakeEnv(); resetSharedAudioForTest(); }
});

test("loadKit decodes once and caches", async function () {
  var Ctor = installFakeEnv();
  resetSharedAudioForTest();
  var prevFetch = globalThis.fetch;
  try {
    globalThis.fetch = function (url) {
      return Promise.resolve({
        ok: true,
        arrayBuffer: function () { return Promise.resolve(new ArrayBuffer(8)); }
      });
    };

    var audio = getSharedAudio();
    audio.unlock();
    var manifest = { kick: "http://test/kick.wav", snare: "http://test/snare.wav" };
    var kit1 = await audio.loadKit("test-kit", manifest);
    assert.ok(kit1);
    assert.ok(kit1.samples && kit1.samples.kick);
    assert.ok(kit1.samples && kit1.samples.snare);
    var decodeCalls1 = Ctor._calls.filter(function (c) { return c === "decodeAudioData"; }).length;
    assert.equal(decodeCalls1, 2);

    Ctor.resetCalls();
    var kit2 = await audio.loadKit("test-kit", manifest);
    assert.ok(kit2);
    assert.equal(kit2, kit1);
    var decodeCalls2 = Ctor._calls.filter(function (c) { return c === "decodeAudioData"; }).length;
    assert.equal(decodeCalls2, 0);
  } finally {
    globalThis.fetch = prevFetch;
    uninstallFakeEnv();
    resetSharedAudioForTest();
  }
});

test("loadKit survives a missing file, other samples still load", async function () {
  var Ctor = installFakeEnv();
  resetSharedAudioForTest();
  var prevFetch = globalThis.fetch;
  try {
    globalThis.fetch = function (url) {
      if (url.indexOf("bad") >= 0) return Promise.resolve({ ok: false, arrayBuffer: function () { return Promise.reject(new Error("fail")); } });
      return Promise.resolve({ ok: true, arrayBuffer: function () { return Promise.resolve(new ArrayBuffer(8)); } });
    };

    var audio = getSharedAudio();
    audio.unlock();
    var manifest = { kick: "http://test/kick.wav", bad: "http://test/bad.wav", snare: "http://test/snare.wav" };
    var kit = await audio.loadKit("survive-kit", manifest);
    assert.ok(kit);
    assert.ok(kit.samples && kit.samples.kick);
    assert.ok(kit.samples && kit.samples.snare);
    assert.equal(kit.samples.bad, undefined);
  } finally {
    globalThis.fetch = prevFetch;
    uninstallFakeEnv();
    resetSharedAudioForTest();
  }
});

test("playSample respects mute", function () {
  var Ctor = installFakeEnv();
  resetSharedAudioForTest();
  try {
    var audio = getSharedAudio();
    var r = audio.playSample("any", "kick");
    assert.ok(r && typeof r.stop === "function");
    assert.equal(Ctor._sources.length, 0);

    audio.setMuted(true);
    var r2 = audio.playSample("any", "kick");
    assert.equal(Ctor._sources.length, 0);
    assert.ok(r2 && typeof r2.stop === "function");
  } finally { uninstallFakeEnv(); resetSharedAudioForTest(); }
});

test("playSample respects unlock, no sound before gesture", function () {
  var Ctor = installFakeEnv();
  resetSharedAudioForTest();
  try {
    var audio = getSharedAudio();
    audio.setMuted(false);
    var r = audio.playSample("any", "kick");
    assert.ok(r && typeof r.stop === "function");
    assert.equal(Ctor._sources.length, 0);
  } finally { uninstallFakeEnv(); resetSharedAudioForTest(); }
});

test("playSample returns noop for unknown sample name", function () {
  var Ctor = installFakeEnv();
  resetSharedAudioForTest();
  try {
    var audio = getSharedAudio();
    audio.unlock();
    var r = audio.playSample("any", "noSuchSample");
    assert.ok(r && typeof r.stop === "function");
    assert.equal(Ctor._sources.length, 0);
  } finally { uninstallFakeEnv(); resetSharedAudioForTest(); }
});

test("playSample treats when as a relative delay", async function () {
  var Ctor = installFakeEnv();
  resetSharedAudioForTest();
  var prevFetch = globalThis.fetch;
  try {
    globalThis.fetch = function (url) {
      return Promise.resolve({ ok: true, arrayBuffer: function () { return Promise.resolve(new ArrayBuffer(8)); } });
    };
    var audio = getSharedAudio();
    audio.unlock();
    await audio.loadKit("when-kit", { boom: "http://test/boom.wav" });
    Ctor.resetCalls();
    audio.playSample("when-kit", "boom", { when: 0.5 });
    assert.equal(Ctor._sources[0]._started, 0.5);
  } finally {
    globalThis.fetch = prevFetch;
    uninstallFakeEnv();
    resetSharedAudioForTest();
  }
});

test("stopAll stops live sample voices", async function () {
  var Ctor = installFakeEnv();
  resetSharedAudioForTest();
  var prevFetch = globalThis.fetch;
  try {
    globalThis.fetch = function (url) {
      return Promise.resolve({ ok: true, arrayBuffer: function () { return Promise.resolve(new ArrayBuffer(8)); } });
    };
    var audio = getSharedAudio();
    audio.unlock();
    var prev = audio.setMaxVoices(6);
    await audio.loadKit("stopkit", { boom: "http://test/boom.wav" });
    Ctor.resetCalls();
    audio.playSample("stopkit", "boom");
    audio.playSample("stopkit", "boom");
    var aliveBefore = Ctor._sources.filter(function (s) { return s._started !== null && !s._stopped; }).length;
    assert.ok(aliveBefore > 0, "should have live sources before stopAll, got " + aliveBefore);
    audio.stopAll();
    var aliveAfter = Ctor._sources.filter(function (s) { return s._started !== null && !s._stopped; }).length;
    assert.equal(aliveAfter, 0, "no sources should be alive after stopAll, got " + aliveAfter);
  } finally {
    globalThis.fetch = prevFetch;
    uninstallFakeEnv();
    resetSharedAudioForTest();
  }
});
