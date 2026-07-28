import { createKeybed } from "./keys-ui.js";
import { getSharedAudio } from "../game-services/audio.js";
import { createScheduler } from "../game-services/scheduler.js";
import { rotateGuard } from "../game-services/music.js";

/* midiToFreq */
function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/* Presets — bass, lead, pad, wobble (design.md D14) */
var PRESETS = {
  bass:   { cutoff: 400,  resonance: 12,  detune: 0,   attack: 0.01, release: 0.15, wave: "sawtooth", name: { en: "Bass", tz: "\u4F4E\u97F3" } },
  lead:   { cutoff: 3000, resonance: 6,   detune: 4,   attack: 0.01, release: 0.3,  wave: "sawtooth", name: { en: "Lead", tz: "\u4E3B\u97F3" } },
  pad:    { cutoff: 1200, resonance: 2,   detune: 12,  attack: 0.5,  release: 1.0,  wave: "triangle", name: { en: "Pad", tz: "\u57AB\u97F3" } },
  wobble: { cutoff: 800,  resonance: 16,  detune: 0,   attack: 0.02, release: 0.25, wave: "square", name: { en: "Wobble", tz: "\u6416\u6416" } }
};

/* Clamp resonance — hearing safety (design.md §6 constraint 3) */
var MAX_RESONANCE = 20;

/* Waveform selector options */
var WAVEFORMS = ["sine", "triangle", "sawtooth", "square"];

/* Create a single voice for a given midi note.
   Signal path: osc1+osc2 → resonant lowpass → amp gain → instrument bus.
   Filter envelope modulates the cutoff from an offset down to the base value. */
function createMoogVoice(ctx, bus, analyserNode, params, midi) {
  var freq = midiToFreq(midi);
  var detuneCents = params.detune || 0;
  var currentParams = params;

  /* Oscillators */
  var osc1 = ctx.createOscillator();
  osc1.type = params.wave || "sawtooth";
  osc1.frequency.setValueAtTime(freq * Math.pow(2, -detuneCents / 2400), ctx.currentTime);

  var osc2 = ctx.createOscillator();
  osc2.type = params.wave || "sawtooth";
  osc2.frequency.setValueAtTime(freq * Math.pow(2, detuneCents / 2400), ctx.currentTime);

  /* Resonant lowpass */
  var resonance = Math.min(params.resonance || 0, MAX_RESONANCE);
  var cutoff = Math.max(params.cutoff || 800, 20);
  var lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(cutoff, ctx.currentTime);
  lp.Q.setValueAtTime(resonance, ctx.currentTime);

  /* Amp ADSR: attack → sustain. Release handled in voice.release() */
  var ampGain = ctx.createGain();
  var attack = params.attack || 0.01;
  ampGain.gain.setValueAtTime(0, ctx.currentTime);
  ampGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + attack);
  ampGain.gain.setTargetAtTime(0.05, ctx.currentTime + attack + 0.01, 0.2);

  /* Filter envelope: open the cutoff briefly, then settle to the knob value.
     Scheduling the AudioParam directly avoids a silent zero-Hz filter. */
  var envCutoff = Math.min(cutoff * 1.5, ctx.sampleRate / 2);
  lp.frequency.cancelScheduledValues(ctx.currentTime);
  lp.frequency.setValueAtTime(envCutoff, ctx.currentTime);
  lp.frequency.linearRampToValueAtTime(cutoff, ctx.currentTime + attack);

  /* Chain: osc1+osc2 → lp → ampGain → analyser.
     The analyser already connects to the instrument bus (done once in init()),
     so voices just feed into it. */
  osc1.connect(lp);
  osc2.connect(lp);
  lp.connect(ampGain);
  ampGain.connect(analyserNode);

  osc1.start(ctx.currentTime);
  osc2.start(ctx.currentTime);

  var stopped = false;

  function glideParam(audioParam, value, timeConstant) {
    var now = ctx.currentTime;
    try {
      audioParam.cancelScheduledValues(now);
      audioParam.setTargetAtTime(value, now, timeConstant || 0.025);
    } catch (e) {
      audioParam.value = value;
    }
  }

  function update(nextParams) {
    if (stopped) return;
    currentParams = nextParams || currentParams;
    var nextDetune = currentParams.detune || 0;
    var nextWave = currentParams.wave || "sawtooth";
    var nextCutoff = Math.max(currentParams.cutoff || 800, 20);
    var nextResonance = Math.min(currentParams.resonance || 0, MAX_RESONANCE);

    osc1.type = nextWave;
    osc2.type = nextWave;
    glideParam(osc1.frequency, freq * Math.pow(2, -nextDetune / 2400), 0.02);
    glideParam(osc2.frequency, freq * Math.pow(2, nextDetune / 2400), 0.02);
    glideParam(lp.frequency, nextCutoff, 0.035);
    glideParam(lp.Q, nextResonance, 0.035);
  }

  function release() {
    if (stopped) return;
    stopped = true;
    var now = ctx.currentTime;
    var rel = currentParams.release || 0.3;
    ampGain.gain.cancelScheduledValues(now);
    ampGain.gain.setValueAtTime(ampGain.gain.value, now);
    ampGain.gain.linearRampToValueAtTime(0.0001, now + rel);
    var stopAt = now + rel + 0.05;
    osc1.stop(stopAt);
    osc2.stop(stopAt);
    setTimeout(function () {
      try { osc1.disconnect(); osc2.disconnect(); } catch (e) {}
      try { lp.disconnect(); } catch (e) {}
      try { ampGain.disconnect(); } catch (e) {}
    }, rel * 1000 + 100);
  }

  return { release: release, update: update, ampGain: ampGain };
}

/* Knob: pointer-drag delta. Returns a DOM div that tracks vertical drag and
   calls onChange(value, normValue) where value is in range [min, max] and
   normValue is 0-1 for rotation display. */
function createKnob(opts) {
  var label = opts.label || "";
  var labelTz = opts.labelTz || "";
  var min = opts.min || 0;
  var max = opts.max || 100;
  var value = opts.value !== undefined ? opts.value : (min + (max - min) / 2);
  var step = opts.step || 1;
  var onChange = opts.onChange || function () {};

  var wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;touch-action:none;user-select:none;-webkit-user-select:none;";

  var knob = document.createElement("div");
  knob.setAttribute("role", "slider");
  knob.setAttribute("aria-valuemin", String(min));
  knob.setAttribute("aria-valuemax", String(max));
  knob.setAttribute("aria-valuenow", String(value));
  knob.setAttribute("aria-label", label + " / " + labelTz);
  knob.style.cssText = "width:clamp(84px,13vmin,108px);height:clamp(84px,13vmin,108px);border-radius:50%;border:clamp(4px,0.6vmin,5px) solid #5AD1C4;background:#14131A;position:relative;cursor:pointer;";

  /* Indicator dot */
  var dot = document.createElement("div");
  dot.style.cssText = "position:absolute;top:clamp(11px,1.7vmin,14px);left:50%;width:clamp(6px,1vmin,8px);height:clamp(28px,4.4vmin,36px);background:#5AD1C4;border-radius:4px;transform-origin:bottom center;margin-left:clamp(-4px,-0.5vmin,-3px);";
  knob.appendChild(dot);

  /* Label — both languages on screen, not just in aria-label. A kid-facing string
     without its 中文 is a bug (CLAUDE.md), and a knob label is kid-facing. */
  var lbl = document.createElement("span");
  lbl.style.cssText = "font-family:Fredoka,Nunito,system-ui;font-size:13px;font-weight:600;color:#9A96B4;text-align:center;line-height:1.25;";
  lbl.textContent = label;
  var lblTz = document.createElement("span");
  lblTz.style.cssText = "display:block;font-size:12px;color:#7B7796;";
  lblTz.textContent = labelTz;
  lbl.appendChild(lblTz);

  /* Value display */
  var valDisplay = document.createElement("span");
  valDisplay.style.cssText = "font-family:Fredoka,Nunito,system-ui;font-size:12px;font-weight:600;color:#F4F2FA;text-align:center;min-width:56px;";
  valDisplay.textContent = formatValue(value);

  wrap.appendChild(knob);
  wrap.appendChild(lbl);
  wrap.appendChild(valDisplay);

  function formatValue(v) { return typeof v === "number" ? Math.round(v).toString() : String(v); }

  var dragging = false;
  var startY = 0;
  var startValue = value;
  var normValue = (value - min) / (max - min);
  dot.style.transform = "rotate(" + (normValue * 270 - 135) + "deg)";

  function updateKnob(newValue) {
    value = newValue;
    normValue = (value - min) / (max - min);
    dot.style.transform = "rotate(" + (normValue * 270 - 135) + "deg)";
    knob.setAttribute("aria-valuenow", String(Math.round(value)));
    valDisplay.textContent = formatValue(value);
    onChange(value, normValue);
  }

  knob.addEventListener("pointerdown", function (e) {
    dragging = true;
    startY = e.clientY;
    startValue = value;
    this.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  knob.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var dy = startY - e.clientY;
    var range = max - min;
    var newValue = startValue + (dy / 120) * range;
    newValue = Math.max(min, Math.min(max, newValue));
    if (step && step > 0) newValue = Math.round(newValue / step) * step;
    updateKnob(newValue);
  });

  knob.addEventListener("pointerup", function (e) {
    dragging = false;
  });

  knob.addEventListener("pointercancel", function (e) {
    dragging = false;
  });

  function setValue(v) {
    updateKnob(v);
  }

  return { element: wrap, setValue: setValue, get value() { return value; } };
}

var S = null;

function init(ctx) {
  if (S) stop();
  var audio = getSharedAudio();
  var graph = audio.graph();
  var sched = createScheduler();
  var previousCap = audio.setMaxVoices(24);
  var voices = new Map();
  var mount = ctx.mount;

  /* Current parameters */
  var params = { cutoff: 800, resonance: 6, detune: 4, attack: 0.01, release: 0.3, wave: "sawtooth" };

  function updateActiveVoices() {
    voices.forEach(function (voice) {
      if (voice.update) voice.update(params);
    });
  }

  /* Instrument bus: separate from master so scope shows only synth */
  var instrumentBus = graph.ctx.createGain();
  instrumentBus.gain.value = 1;
  instrumentBus.connect(graph.master);

  /* Analyser for oscilloscope */
  var analyser = graph.ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.3;
  analyser.connect(instrumentBus);

  /* Root wrapper — full-screen, no scroll (D13) */
  var root = document.createElement("div");
  root.style.cssText = "position:relative;display:flex;flex-direction:column;height:100%;width:100%;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;";

  /* Panel on top (knobs docked left, square scope right), keys along the bottom.
     Papa, 2026-07-28: the keybed was eating the whole screen — a synth is mostly
     controls, and the keys only need to be tall enough to play. */
  var panel = document.createElement("div");
  panel.style.cssText = "flex:1;min-height:0;display:flex;gap:10px;padding:8px 10px;align-items:stretch;";

  /* Left column: waveform selector, knobs, presets */
  var leftCol = document.createElement("div");
  leftCol.style.cssText = "flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;justify-content:space-evenly;";
  panel.appendChild(leftCol);

  /* Right: the scope, kept square (D14) */
  var scopeBox = document.createElement("div");
  scopeBox.style.cssText = "flex:none;align-self:center;aspect-ratio:1;height:100%;max-height:100%;display:flex;";

  var scopeCanvas = document.createElement("canvas");
  scopeCanvas.width = 256;
  scopeCanvas.height = 256;
  scopeCanvas.style.cssText = "width:100%;height:100%;aspect-ratio:1;background:#14131A;border-radius:12px;border:1px solid #3A3850;image-rendering:pixelated;";
  scopeBox.appendChild(scopeCanvas);
  panel.appendChild(scopeBox);

  /* Waveform selector */
  var waveSelect = document.createElement("div");
  waveSelect.style.cssText = "display:flex;gap:3px;flex:none;justify-content:center;flex-wrap:wrap;";
  WAVEFORMS.forEach(function (w) {
    var btn = document.createElement("button");
    btn.textContent = w[0].toUpperCase() + w.slice(1);
    btn.style.cssText = "background:" + (w === params.wave ? "#5AD1C4" : "#2F2E3D") + ";border:2px solid " + (w === params.wave ? "#5AD1C4" : "#3A3850") + ";color:" + (w === params.wave ? "#14131A" : "#F4F2FA") + ";border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;font-weight:600;min-width:44px;min-height:32px;";
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", String(w === params.wave));
    btn.addEventListener("pointerdown", function () {
      params.wave = w;
      updateActiveVoices();
      waveSelect.querySelectorAll("button").forEach(function (b) {
        var bw = b.textContent.toLowerCase();
        b.style.background = bw === params.wave ? "#5AD1C4" : "#2F2E3D";
        b.style.borderColor = bw === params.wave ? "#5AD1C4" : "#3A3850";
        b.style.color = bw === params.wave ? "#14131A" : "#F4F2FA";
        b.setAttribute("aria-checked", String(bw === params.wave));
      });
    });
    waveSelect.appendChild(btn);
  });
  leftCol.appendChild(waveSelect);

  /* Knobs row */
  var knobRow = document.createElement("div");
  knobRow.style.cssText = "display:flex;gap:clamp(12px,2.2vmin,18px);justify-content:center;flex-wrap:wrap;";

  function makeParamKnob(name, tz, min, max, step, key) {
    var k = createKnob({
      label: name, labelTz: tz, min: min, max: max, step: step, value: params[key],
      onChange: function (v) {
        params[key] = v;
        updateActiveVoices();
      }
    });
    knobRow.appendChild(k.element);
    return k;
  }

  var knobs = {
    cutoff:     makeParamKnob("Cutoff", "\u6FFE\u6CE2\u5668", 20, 8000, 1, "cutoff"),
    resonance:  makeParamKnob("Reso", "\u5171\u9CF4", 0.1, 20, 0.1, "resonance"),
    detune:     makeParamKnob("Detune", "\u5FAE\u8ABF", 0, 50, 1, "detune"),
    attack:     makeParamKnob("Attack", "\u8D77\u97F3", 0.005, 2, 0.005, "attack"),
    release:    makeParamKnob("Release", "\u91CB\u653E", 0.05, 3, 0.01, "release")
  };

  leftCol.appendChild(knobRow);

  /* Presets row */
  var presetRow = document.createElement("div");
  presetRow.style.cssText = "display:flex;gap:6px;justify-content:center;flex-wrap:wrap;";
  var presetNames = Object.keys(PRESETS);
  presetNames.forEach(function (pid) {
    var p = PRESETS[pid];
    var btn = document.createElement("button");
    btn.textContent = p.name.en + " " + p.name.tz;
    btn.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;color:#B98CFF;border-radius:10px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;font-weight:600;min-width:44px;min-height:36px;";
    btn.setAttribute("role", "button");
    btn.addEventListener("pointerdown", function () {
      var preset = PRESETS[pid];
      params.cutoff = preset.cutoff;
      params.resonance = preset.resonance;
      params.detune = preset.detune;
      params.attack = preset.attack;
      params.release = preset.release;
      params.wave = preset.wave;
      knobs.cutoff.setValue(params.cutoff);
      knobs.resonance.setValue(params.resonance);
      knobs.detune.setValue(params.detune);
      knobs.attack.setValue(params.attack);
      knobs.release.setValue(params.release);
      updateActiveVoices();
      /* Update waveform selector buttons */
      waveSelect.querySelectorAll("button").forEach(function (b) {
        var bw = b.textContent.toLowerCase();
        b.style.background = bw === params.wave ? "#5AD1C4" : "#2F2E3D";
        b.style.borderColor = bw === params.wave ? "#5AD1C4" : "#3A3850";
        b.style.color = bw === params.wave ? "#14131A" : "#F4F2FA";
        b.setAttribute("aria-checked", String(bw === params.wave));
      });
    });
    presetRow.appendChild(btn);
  });
  leftCol.appendChild(presetRow);

  root.appendChild(panel);

  /* Keybed area — docked at the bottom, capped so it cannot eat the panel.
     44px is the coarse-pointer floor (CLAUDE.md); black keys sit at 60% of it. */
  var kbArea = document.createElement("div");
  kbArea.style.cssText = "flex:none;height:clamp(120px,34%,220px);min-height:120px;position:relative;border-top:1px solid #3A3850;border-radius:0 0 12px 12px;overflow:hidden;";
  root.appendChild(kbArea);

  mount.appendChild(root);
  rotateGuard(root);   /* D13: portrait gets a rotate prompt, not a squeezed instrument */

  /* Keybed */
  var keybed = createKeybed({
    mount: kbArea,
    lowMidi: 24, /* C1 — one more bass octave for low synth lines */
    octaves: 3,
    onNoteOn: function (midi) {
      if (!S || !S.unblocked) {
        audio.unlock();
        if (S) S.unblocked = true;
      }
      if (voices.has(midi)) {
        voices.get(midi).release();
        voices.delete(midi);
      }
      var voice = createMoogVoice(graph.ctx, instrumentBus, analyser, params, midi);
      voices.set(midi, voice);
    },
    onNoteOff: function (midi) {
      if (voices.has(midi)) {
        voices.get(midi).release();
        voices.delete(midi);
      }
    }
  });

  /* Oscilloscope — draw with zero-crossing trigger to stabilise trace */
  var scopeCtx = scopeCanvas.getContext("2d");
  var drawScope = function () {
    if (!S) return;
    scopeCtx.clearRect(0, 0, scopeCanvas.width, scopeCanvas.height);

    var buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);

    /* Zero-crossing trigger: find the first upward crossing */
    var triggerIdx = -1;
    for (var i = 1; i < buf.length; i++) {
      if (buf[i - 1] < 128 && buf[i] >= 128) { triggerIdx = i; break; }
    }
    if (triggerIdx < 0) triggerIdx = 0;

    /* Draw */
    scopeCtx.strokeStyle = "#5AD1C4";
    scopeCtx.lineWidth = 1.5;
    scopeCtx.beginPath();
    var w = scopeCanvas.width;
    var h = scopeCanvas.height;
    var midY = h / 2;

    for (var j = 0; j < buf.length; j++) {
      var idx = (triggerIdx + j) % buf.length;
      var x = (j / buf.length) * w;
      var y = ((buf[idx] - 128) / 128) * (h * 0.45) + midY;
      if (j === 0) scopeCtx.moveTo(x, y);
      else scopeCtx.lineTo(x, y);
    }
    scopeCtx.stroke();

    S._scopeRaf = requestAnimationFrame(drawScope);
  };

  S = {
    ctx: ctx,
    audio: audio,
    graph: graph,
    sched: sched,
    previousCap: previousCap,
    voices: voices,
    instrumentBus: instrumentBus,
    keybed: keybed,
    mount: mount,
    unblocked: false,
    _scopeRaf: null
  };

  /* Only now — drawScope bails on a null S, so starting it any earlier left the
     scope frozen on an empty canvas (D14 calls the trace mandatory). */
  drawScope();

  /* visibility change: kill all voices */
  function onVisibility() {
    if (document.hidden && S) {
      if (S.keybed) S.keybed.allNotesOff();
      voices.forEach(function (v) { v.release(); });
      voices.clear();
    }
  }
  document.addEventListener("visibilitychange", onVisibility);
  S._onVisibility = onVisibility;
}

function stop() {
  if (!S) return;

  if (S._scopeRaf) cancelAnimationFrame(S._scopeRaf);

  document.removeEventListener("visibilitychange", S._onVisibility);

  if (S.keybed) {
    S.keybed.allNotesOff();
    S.keybed.destroy();
  }

  S.voices.forEach(function (v) { v.release(); });
  S.voices.clear();

  S.sched.cancelAll();

  if (S.instrumentBus) {
    try { S.instrumentBus.disconnect(); } catch (e) {}
  }

  if (S.audio && S.previousCap !== undefined) {
    S.audio.setMaxVoices(S.previousCap);
  }

  if (S.mount) S.mount.innerHTML = "";
  S = null;
}

export default {
  id: "moog",
  meta: { icon: "\uD83C\uDF9B\uFE0F", title: "Synth", tz: "\u5408\u6210\u5668", blurb: "Twist the knobs" },
  keyboard: false,
  bestKey: null,
  init: init,
  stop: stop
};
