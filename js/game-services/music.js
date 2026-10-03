/* Music service: calibration, transport, chart runtime, judging (design.md §3).
   Moves into js/game-services/ not js/games/ by deliberate choice: that folder
   holds exactly three file kinds and a shared non-game would break that rule.
   game-services/ already holds audio.js / motion.js / scheduler.js — this is
   the same pattern.

   Slice 38: latency calibration. Slice 39 adds the transport + judge alongside. */

import { getSharedAudio } from "./audio.js";
import { createScheduler } from "./scheduler.js";

/* --- Storage key --- */
var STORAGE_KEY = "sq.music.latency";

/* --- computeOffset: pure, exported for testing --- */

function median(arr) {
  if (!arr.length) return 0;
  var sorted = arr.slice().sort(function (a, b) { return a - b; });
  var mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function iqr(arr) {
  if (!arr.length) return 0;
  var sorted = arr.slice().sort(function (a, b) { return a - b; });
  var q1 = sorted[Math.floor((sorted.length - 1) / 4)];
  var q3 = sorted[Math.floor(3 * (sorted.length - 1) / 4)];
  return q3 - q1;
}

export function computeOffset(taps, beats) {
  var diffs = [];
  var len = Math.min(taps.length, beats.length);
  for (var i = 0; i < len; i++) {
    diffs.push(taps[i] - beats[i]);
  }
  /* Drop the first two pairs — the kid is finding the pulse */
  diffs = diffs.slice(2);
  if (diffs.length < 4) return { offsetMs: null, confident: false };
  var m = median(diffs);
  var spread = iqr(diffs);
  /* confidence threshold from slice spec: IQR > 60ms */
  var confident = spread <= 60;
  return { offsetMs: m, confident: confident };
}

/* --- Calibration runtime --- */

export function calibrate(host, onDone) {
  var audio = getSharedAudio();
  host = host || {};
  var onResult = host.onResult || (onDone || function () {});
  var sched = createScheduler();
  var beatInterval = 0.6; /* 100 BPM */
  var totalBeats = 8;
  var beats = [];
  var taps = [];
  var sounds = [];
  var ctx = null;
  var startTime = null;
  var beatIdx = 0;
  var tapCount = 0;
  var finished = false;

  function cancel() {
    finished = true;
    sched.cancelAll();
    sounds.forEach(function (sound) { sound.stop(); });
    sounds = [];
  }

  function finish(reason) {
    if (finished) return;
    cancel();
    if (!reason && tapCount !== totalBeats) reason = "not_enough_taps";
    var result = reason
      ? { offsetMs: null, confident: false, reason: reason }
      : computeOffset(taps, beats);
    if (result.offsetMs !== null) result.offsetMs = Math.round(result.offsetMs);
    if (result.confident) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          offsetMs: result.offsetMs, at: Date.now(), confident: true
        }));
      } catch (e) {}
    }
    onResult(result);
  }

  function lookaheadTick() {
    if (finished) return;
    if (audio.muted || ctx.state !== "running") { finish("interrupted"); return; }
    var nowTime = ctx.currentTime;
    /* A backgrounded or stalled page must not play a burst of overdue clicks. */
    if (beatIdx < totalBeats && beats[beatIdx] / 1000 < nowTime) {
      finish("interrupted"); return;
    }
    while (beatIdx < totalBeats) {
      var beatTime = beats[beatIdx] / 1000;
      if (beatTime > nowTime + 0.1) break;
      sounds.push(audio.play("ui-tap", { when: Math.max(0, beatTime - ctx.currentTime), volume: 0.5 }));
      beatIdx++;
      if (host.onBeat) {
        (function (number, time) {
          sched.after(Math.max(0, time - ctx.currentTime) * 1000, function () {
            if (!finished) host.onBeat(number, totalBeats);
          });
        })(beatIdx, beatTime);
      }
    }
    if (nowTime >= startTime + (totalBeats - 1) * beatInterval + 0.5) finish();
  }

  function onTap() {
    if (finished || startTime === null || ctx.state !== "running") return false;
    var nowTime = ctx.currentTime;
    /* ponytail: nearest-beat pairing covers offsets under 300 ms; slower clicks
       are needed if a device requires a wider measurement window. */
    var index = Math.round((nowTime - startTime) / beatInterval);
    if (index < 0 || index >= totalBeats || taps[index] !== undefined) return false;
    taps[index] = nowTime * 1000;
    tapCount++;
    if (host.onTap) host.onTap(tapCount, totalBeats);
    return true;
  }

  function start() {
    if (finished) return;
    if (!ctx || ctx.state !== "running") { finish("audio_unavailable"); return; }
    startTime = ctx.currentTime + 1.5;
    for (var i = 0; i < totalBeats; i++) beats.push((startTime + i * beatInterval) * 1000);
    sched.every(25, lookaheadTick);
  }

  /* Unlock during the gesture, then wait for a suspended context to resume.
     Deferring results also lets callers retain the returned cancellation handle. */
  try {
    if (audio.muted) sched.after(0, function () { finish("muted"); });
    else {
      audio.unlock();
      ctx = audio.graph().ctx;
      var resumed = ctx && ctx.state !== "running" && ctx.resume ? ctx.resume() : null;
      Promise.resolve(resumed).then(start, function () { finish("audio_unavailable"); });
    }
  } catch (e) { sched.after(0, function () { finish("audio_unavailable"); }); }

  return { onTap: onTap, cancel: cancel };
}

export function offset() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      var data = JSON.parse(raw);
      if (data && typeof data.offsetMs === "number" && data.confident) {
        return data.offsetMs;
      }
    }
  } catch (e) {}
  /* Fallback: output latency of the shared AudioContext, in ms */
  var audio = getSharedAudio();
  var c = audio.clock();
  var fallback = c.outputLatency * 1000;
  if (typeof fallback !== "number" || !isFinite(fallback) || fallback < 0) fallback = 0;
  return fallback;
}

export function clearCalibration() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

export function calibrationExists() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    var data = JSON.parse(raw);
    return data && typeof data.offsetMs === "number" && data.confident;
  } catch (e) { return false; }
}

/* --- Portrait guard (D13) --- */

/* D13: in portrait, show a bilingual rotate prompt rather than let an instrument
   render squeezed or scrollable. Pure CSS media query — no resize listener, so
   there is nothing for stop() to release. Append to a positioned element. */
export function rotateGuard(root) {
  if (!document.getElementById("sq-rotate-style")) {
    var st = document.createElement("style");
    st.id = "sq-rotate-style";
    st.textContent =
      ".sq-rotate{display:none}" +
      "@media (orientation:portrait){.sq-rotate{display:flex;position:absolute;inset:0;z-index:60;" +
      "flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;" +
      "padding:20px;background:#1B1A24;font-family:Fredoka,Nunito,system-ui;color:#F4F2FA;font-weight:600}}";
    document.head.appendChild(st);
  }
  var el = document.createElement("div");
  el.className = "sq-rotate";
  var icon = document.createElement("div");
  icon.style.cssText = "font-size:44px";
  icon.textContent = "🔄";
  var en = document.createElement("div");
  en.style.cssText = "font-size:17px";
  en.textContent = "Turn your tablet sideways";
  var tz = document.createElement("div");
  tz.style.cssText = "font-size:15px;color:#9A96B4";
  tz.textContent = "把平板轉成橫的";
  el.appendChild(icon); el.appendChild(en); el.appendChild(tz);
  root.appendChild(el);
  return el;
}

/* --- Slice 39: transport + judge --- */

export function createTransport(deps) {
  var clock = deps.clock;
  var playNote = deps.playNote;
  var sched = deps.sched;
  var chart = null;
  var startTime = 0;
  var cursor = 0;
  var running = false;
  var pauseOffset = null;
  var loopCancel = null;

  function beatToTime(beat) {
    if (!chart) return 0;
    return startTime + beat * 60 / chart.bpm;
  }

  function positionOf(note) {
    return beatToTime(note.beat) - (pauseOffset === null ? clock.now : pauseOffset);
  }

  function tick() {
    if (!running || !chart) return;
    var nowTime = clock.now;
    var lookahead = nowTime + 0.10;

    /* If the clock has jumped far ahead (tab backgrounded, context resumed),
       re-anchor and skip past all stale notes rather than dumping a burst. */
    if (cursor < chart.notes.length) {
      var firstNoteTime = beatToTime(chart.notes[cursor].beat);
      if (firstNoteTime < nowTime - 2.0) {
        startTime = nowTime - chart.notes[cursor].beat * 60 / chart.bpm;
        while (cursor < chart.notes.length) {
          if (beatToTime(chart.notes[cursor].beat) > lookahead) break;
          cursor++;
        }
        return;
      }
    }

    while (cursor < chart.notes.length) {
      var note = chart.notes[cursor];
      var absoluteTime = beatToTime(note.beat);
      if (absoluteTime > lookahead) break;
      playNote(note, absoluteTime);
      cursor++;
    }
  }

  function start(ch, leadSeconds) {
    chart = ch;
    cursor = 0;
    running = true;
    pauseOffset = null;
    startTime = clock.now + (leadSeconds !== undefined ? leadSeconds : 0.15);
    if (loopCancel) loopCancel();
    loopCancel = sched.every(25, tick);
  }

  function pause() {
    if (!running) return;
    pauseOffset = clock.now;
    running = false;
    if (loopCancel) {
      loopCancel();
      loopCancel = null;
    }
  }

  function resume() {
    if (running || !chart) return;
    if (pauseOffset !== null) {
      var gap = clock.now - pauseOffset;
      startTime += gap;
    }
    pauseOffset = null;
    running = true;
    tick();
    if (loopCancel) loopCancel();
    loopCancel = sched.every(25, tick);
  }

  function stop() {
    running = false;
    chart = null;
    cursor = 0;
    pauseOffset = null;
    if (loopCancel) {
      loopCancel();
      loopCancel = null;
    }
  }

  return {
    start: start,
    stop: stop,
    pause: pause,
    resume: resume,
    beatToTime: beatToTime,
    positionOf: positionOf,
    get running() { return running; },
    get cursor() { return cursor; }
  };
}

/* judge(tapTime, noteAbsTime, offsetMs)
   tapTime:      audio clock time in seconds of the tap
   noteAbsTime:  absolute audio time in seconds the note should have fired
   offsetMs:     calibration offset in milliseconds (subtracted from tap judgement)
   Returns "perfect"|"good"|"ok"|"miss" without changing note state. */

var PERFECT_MS = 80;
var GOOD_MS = 140;
export var HIT_WINDOW_MS = 240;

export function judge(tapTime, noteAbsTime, offsetMs) {
  offsetMs = offsetMs || 0;
  var diffSec = tapTime - noteAbsTime;
  var diffMs = Math.abs(diffSec * 1000 - offsetMs);

  var result;
  if (diffMs <= PERFECT_MS) result = "perfect";
  else if (diffMs <= GOOD_MS) result = "good";
  else if (diffMs <= HIT_WINDOW_MS) result = "ok";
  else result = "miss";

  return result;
}
