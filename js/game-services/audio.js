/* Audio service (implementation-guidelines.md §9-10, §12.10; brain slice 34 task 4).
   Wraps one lazy AudioContext and renders cues from the SQBrainCues placeholder
   table (js/brain-audio-cues.js, a classic script — by the time this ESM module
   runs, every classic <script> has already executed, so window.SQBrainCues is
   available; see js/CLAUDE.md on the classic->ESM boundary).

   getSharedAudio() is a module-level singleton so arcade modules that later
   import this same service reuse the AudioContext. The scheduler and motion
   services stay per-round; this one does not.

   Music Room (slice 35) extends it with sample kit loading, interactive-latency
   hint, runtime voice-cap control, clock exposure, and graph access — all
   additive with unchanged defaults so the nineteen games and Brain Gym sharing
   this service are not affected. */

var shared = null;

function createAudioService(deps) {
  deps = deps || {};
  var ctx = null;
  var master = null;
  var unlocked = false;
  var muted = !!(deps.isMuted && deps.isMuted());
  var active = [];
  var maxVoices = 4;  /* slice 35: was hardcoded in makeRoom() */
  var kits = new Map();  /* slice 35: kitName -> {samples:{name:AudioBuffer}} */

  function ensureContext() {
    if (ctx) return ctx;
    var Ctor = (typeof window !== "undefined") && (window.AudioContext || window.webkitAudioContext);
    if (!Ctor) return null;
    try { ctx = new Ctor({ latencyHint: "interactive" }); }
    catch (e) { ctx = new Ctor(); }
    if (!ctx.createGain) {
      master = ctx.createGainNode();
    } else {
      master = ctx.createGain();
    }
    master.gain.value = 1;
    master.connect(ctx.destination);
    return ctx;
  }

  function unlock() {
    var c = ensureContext();
    if (!c) return;
    if (c.state === "suspended" && c.resume) c.resume().catch(function () {});
    unlocked = true;
  }

  function sweepDead() {
    active = active.filter(function (n) { return n.alive; });
  }

  function makeRoom() {
    sweepDead();
    if (active.length < maxVoices) return;
    var idx = active.findIndex(function (n) { return !n.isSpeech; });
    if (idx < 0) return;
    try { active[idx].stop(); } catch (e) {}
    active.splice(idx, 1);
  }

  function play(cue, opts) {
    opts = opts || {};
    if (muted || !unlocked) return { stop: function () {} };
    var c = ensureContext();
    var cues = (typeof window !== "undefined") && window.SQBrainCues;
    if (!c || !cues) return { stop: function () {} };
    makeRoom();
    var handle = cues.renderCue(c, master, cue, opts);
    if (!handle) return { stop: function () {} };
    var node = { stop: handle.stop, alive: true, isSpeech: false };
    active.push(node);
    var durationMs = cues.cueDuration(cue) * 1000 + 40;
    setTimeout(function () { node.alive = false; }, durationMs);
    return handle;
  }

  function stopAll() {
    active.forEach(function (n) { try { n.stop(); } catch (e) {} });
    active = [];
  }

  function setMuted(value) {
    muted = !!value;
    if (deps.setMuted) deps.setMuted(muted);
    if (muted) stopAll();
  }

  function dispose() {
    stopAll();
    if (ctx && ctx.close) { try { ctx.close(); } catch (e) {} }
    ctx = null; master = null; unlocked = false;
  }

  /* --- Music Room extensions (slice 35) --- */

  function setMaxVoices(n) {
    var prev = maxVoices;
    maxVoices = n;
    return prev;
  }

  function loadKit(kitName, manifest) {
    if (kits.has(kitName)) return Promise.resolve(kits.get(kitName));
    var c = ensureContext();
    if (!c) return Promise.resolve(null);
    var sampleNames = Object.keys(manifest);
    var kit = { samples: {} };
    kits.set(kitName, kit);
    return Promise.all(sampleNames.map(function (name) {
      var url = manifest[name];
      return fetch(url)
        .then(function (r) {
          if (!r.ok) {
            console.warn("loadKit: " + url + " returned " + r.status);
            return null;
          }
          return r.arrayBuffer();
        })
        .then(function (buf) {
          if (!buf) return null;
          return new Promise(function (resolve, reject) {
            var promise = c.decodeAudioData(buf);
            if (promise && typeof promise.then === "function") {
              promise.then(function (decoded) {
                kit.samples[name] = decoded;
                resolve(decoded);
              }).catch(function (err) {
                console.warn("loadKit: decode failed for " + name, err);
                resolve(null);
              });
            } else {
              c.decodeAudioData(buf, function (decoded) {
                kit.samples[name] = decoded;
                resolve(decoded);
              }, function (err) {
                console.warn("loadKit: decode failed for " + name, err);
                resolve(null);
              });
            }
          });
        }).catch(function (err) {
          console.warn("loadKit: failed to load " + url, err);
          return null;
        });
    })).then(function () { return kit; });
  }

  function playSample(kitName, sampleName, opts) {
    opts = opts || {};
    if (muted || !unlocked) return { stop: function () {} };
    var kit = kits.get(kitName);
    var buffer = kit && kit.samples && kit.samples[sampleName];
    if (!buffer) return { stop: function () {} };
    var c = ensureContext();
    if (!c) return { stop: function () {} };
    makeRoom();
    var src = c.createBufferSource();
    src.buffer = buffer;
    var gain = c.createGain();
    gain.gain.value = opts.gain !== undefined ? opts.gain : 1;
    src.connect(gain);
    gain.connect(master);
    /* `when` is a relative delay in seconds so callers can pass transport
       deltas directly instead of converting to absolute AudioContext time. */
    var when = opts.when || 0;
    src.start(c.currentTime + Math.max(0, when));
    var stopped = false;
    var node = {
      alive: true,
      isSpeech: false,
      stop: function () {
        if (stopped) return;
        stopped = true;
        try { src.stop(); } catch (e) {}
        try { gain.disconnect(); } catch (e) {}
        try { src.disconnect(); } catch (e) {}
      }
    };
    active.push(node);
    var durationMs = (buffer.duration * 1000) + 100;
    setTimeout(function () { node.alive = false; }, durationMs);
    return { stop: node.stop };
  }

  function clock() {
    if (!ctx) return { now: 0, outputLatency: 0, sampleRate: 0 };
    return {
      now: ctx.currentTime,
      outputLatency: (ctx.outputLatency || 0) + (ctx.baseLatency || 0),
      sampleRate: ctx.sampleRate
    };
  }

  function graph() {
    ensureContext();
    return { ctx: ctx, master: master };
  }

  return {
    unlock: unlock,
    play: play,
    playSample: playSample,
    loadKit: loadKit,
    clock: clock,
    graph: graph,
    stopAll: stopAll,
    setMuted: setMuted,
    setMaxVoices: setMaxVoices,
    dispose: dispose,
    get muted() { return muted; },
    get unlocked() { return unlocked; },
    get maxVoices() { return maxVoices; }
  };
}

export function getSharedAudio(deps) {
  if (!shared) shared = createAudioService(deps);
  return shared;
}

/* Tests only — the app creates the singleton once at first Brain round and never
   tears it down for the life of the tab. */
export function resetSharedAudioForTest() {
  if (shared) shared.dispose();
  shared = null;
}

export default getSharedAudio;
