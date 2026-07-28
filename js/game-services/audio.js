/* Audio service (implementation-guidelines.md §9-10, §12.10; brain slice 34 task 4).
   Wraps one lazy AudioContext and renders cues from the SQBrainCues placeholder
   table (js/brain-audio-cues.js, a classic script — by the time this ESM module
   runs, every classic <script> has already executed, so window.SQBrainCues is
   available; see js/CLAUDE.md on the classic->ESM boundary).

   getSharedAudio() is a module-level singleton so arcade modules that later
   import this same service reuse the AudioContext. The scheduler and motion
   services stay per-round; this one does not. */

var shared = null;

function createAudioService(deps) {
  deps = deps || {};
  var ctx = null;
  var master = null;
  var unlocked = false;
  var muted = !!(deps.isMuted && deps.isMuted());
  var active = [];

  function ensureContext() {
    if (ctx) return ctx;
    var Ctor = (typeof window !== "undefined") && (window.AudioContext || window.webkitAudioContext);
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
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
    if (active.length < 4) return;
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

  return {
    unlock: unlock,
    play: play,
    stopAll: stopAll,
    setMuted: setMuted,
    dispose: dispose,
    get muted() { return muted; },
    get unlocked() { return unlocked; }
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
