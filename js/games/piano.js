import { createKeybed } from "./keys-ui.js";
import { getSharedAudio } from "../game-services/audio.js";
import { createScheduler } from "../game-services/scheduler.js";
import { DRILLS } from "./piano-drills.js";
import { rotateGuard } from "../game-services/music.js";

/* midiToFreq — one line, no table. */
function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/* Piano voice: three detuned oscillators, fast attack, exponential decay,
   lowpass that tracks pitch, real note-on/note-off. */
function createPianoVoice(ctx, master, midi) {
  var freq = midiToFreq(midi);

  var cutoff = Math.min(freq * 6, ctx.sampleRate / 3);
  cutoff = Math.max(cutoff, 300);
  var lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(cutoff, ctx.currentTime);
  lp.Q.setValueAtTime(0.8, ctx.currentTime);

  var osc1 = ctx.createOscillator();
  osc1.type = "triangle";
  osc1.frequency.setValueAtTime(freq * 0.9996, ctx.currentTime);

  var osc2 = ctx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(freq * 1.0004, ctx.currentTime);

  var osc3 = ctx.createOscillator();
  osc3.type = "sine";
  osc3.frequency.setValueAtTime(freq * 2, ctx.currentTime);

  var gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.005);
  /* ponytail: synthesized rather than sampled. Upgrade path: swap in a small
     sampled set if the tone disappoints — but weigh it against APP_SHELL size
     (a sampled set is 20-100MB). */
  gain.gain.setTargetAtTime(0.006, ctx.currentTime + 0.01, 0.7);

  osc1.connect(lp);
  osc2.connect(lp);
  osc3.connect(lp);
  lp.connect(gain);
  gain.connect(master);

  osc1.start(ctx.currentTime);
  osc2.start(ctx.currentTime);
  osc3.start(ctx.currentTime);

  var stopped = false;

  function release() {
    if (stopped) return;
    stopped = true;
    var now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.25);
    var stopAt = now + 0.3;
    osc1.stop(stopAt);
    osc2.stop(stopAt);
    osc3.stop(stopAt);
    setTimeout(function () {
      try { osc1.disconnect(); osc2.disconnect(); osc3.disconnect(); } catch (e) {}
      try { lp.disconnect(); } catch (e) {}
      try { gain.disconnect(); } catch (e) {}
    }, 350);
  }

  return { release: release, gain: gain };
}

var S = null;

function init(ctx) {
  if (S) stop();

  var audio = getSharedAudio();
  var graph = audio.graph();
  var sched = createScheduler();
  var previousCap = audio.setMaxVoices(24);
  var voices = new Map();

  S = {
    ctx: ctx, audio: audio, graph: graph, sched: sched,
    previousCap: previousCap, voices: voices, mount: null,
    unblocked: false, keybed: null, mode: "play",
    _onVisibility: null, _stopPractice: null
  };

  var mount = ctx.mount;
  S.mount = mount;

  /* Keybed styles now ship with createKeybed() — see keys-ui.js injectStyle(). */

  /* Root wrapper */
  var root = document.createElement("div");
  root.style.cssText = "position:relative;display:flex;flex-direction:column;height:100%;width:100%;overflow:hidden;touch-action:none;";

  /* Mode bar */
  var modeBar = document.createElement("div");
  modeBar.style.cssText = "flex:none;display:flex;align-items:center;gap:8px;padding:4px 10px;border-bottom:1px solid #3A3850;";

  var btnPlay = document.createElement("button");
  btnPlay.textContent = "\uD83C\uDFB9 Play";
  btnPlay.style.cssText = "background:#5AD1C4;border:2px solid #5AD1C4;color:#14131A;border-radius:10px;padding:6px 14px;font-size:13px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;font-weight:600;min-width:44px;min-height:36px;";

  var btnPractice = document.createElement("button");
  btnPractice.textContent = "\uD83D\uDCDD \u7DF4\u7FD2";
  btnPractice.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;color:#F4F2FA;border-radius:10px;padding:6px 14px;font-size:13px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;font-weight:600;min-width:44px;min-height:36px;";

  var handLabel = document.createElement("span");
  handLabel.style.cssText = "font-family:Fredoka,Nunito,system-ui;font-size:14px;font-weight:600;color:#FFB13C;margin-left:auto;min-width:60px;text-align:right;";

  modeBar.appendChild(btnPlay);
  modeBar.appendChild(btnPractice);
  modeBar.appendChild(handLabel);
  root.appendChild(modeBar);

  /* Container for the two modes */
  var stageContainer = document.createElement("div");
  stageContainer.style.cssText = "flex:1;min-height:0;position:relative;";
  root.appendChild(stageContainer);

  mount.appendChild(root);
  rotateGuard(root);   /* D13: portrait gets a rotate prompt, not a squeezed instrument */

  /* ---- Free Play view ----
     Controls on top, keys docked along the bottom with a capped height (Papa,
     2026-07-28 — same rule as the synth: keys sized to be played, not to fill). */
  var playView = document.createElement("div");
  playView.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;";

  var kbContainer = document.createElement("div");
  kbContainer.style.cssText = "flex:none;height:clamp(150px,52%,340px);min-height:140px;position:relative;border-top:1px solid #3A3850;border-radius:0 0 12px 12px;overflow:hidden;";

  var playBar = document.createElement("div");
  playBar.style.cssText = "flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:8px;padding:6px 10px;";
  var octLabel = document.createElement("span");
  octLabel.style.cssText = "font-family:Fredoka,Nunito,system-ui;font-size:13px;font-weight:600;color:#F4F2FA;min-width:50px;text-align:center;";
  var currentOctave = 2;
  /* MIDI octave numbering: lowMidi = currentOctave*12, and midi 36 is C2 — so the
     readout is one below the internal number, not equal to it. */
  function octaveName() { return "C" + (currentOctave - 1); }

  var btnDown = document.createElement("button");
  btnDown.textContent = "\u25C0";
  btnDown.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;color:#F4F2FA;border-radius:10px;padding:8px 14px;font-size:16px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;min-width:44px;min-height:44px;";
  var btnUp = document.createElement("button");
  btnUp.textContent = "\u25B6";
  btnUp.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;color:#F4F2FA;border-radius:10px;padding:8px 14px;font-size:16px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;min-width:44px;min-height:44px;";
  octLabel.textContent = octaveName();

  playBar.appendChild(btnDown);
  playBar.appendChild(octLabel);
  playBar.appendChild(btnUp);
  playView.appendChild(playBar);
  playView.appendChild(kbContainer);
  stageContainer.appendChild(playView);

  /* ---- Practice view ---- */
  var practiceView = document.createElement("div");
  practiceView.style.cssText = "position:absolute;inset:0;display:none;flex-direction:column;overflow:hidden;";
  stageContainer.appendChild(practiceView);

  /* Practice: exercise list */
  var drillList = document.createElement("div");
  drillList.style.cssText = "flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px;";
  practiceView.appendChild(drillList);

  /* Build exercise list items */
  DRILLS.forEach(function (d) {
    var row = document.createElement("button");
    row.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;border-radius:11px;padding:10px 12px;cursor:pointer;color:#F4F2FA;text-align:left;display:flex;flex-direction:column;gap:2px;min-height:44px;";
    row.innerHTML = "<span style='font-family:Fredoka,Nunito,system-ui;font-size:14px;font-weight:600;'>" + d.name.en + " <span style='color:#9A96B4;font-size:12px;'>" + d.name.tz + "</span></span>" +
      "<span style='font-size:11px;color:#9A96B4;'>" + d.hint.en + " / " + d.hint.tz + "</span>" +
      "<span style='font-size:10px;color:#5AD1C4;'>" + (d.hand === "right" ? "\u2192 Right / \u53F3\u624B" : d.hand === "left" ? "\u2190 Left / \u5DE6\u624B" : "\u2194 Both / \u96D9\u624B") + " \u30FB " + d.bpm + " bpm</span>";
    row.addEventListener("pointerdown", function () { startPractice(d); });
    drillList.appendChild(row);
  });

  /* Practice: exercise runner (hidden until selected) */
  var drillRunner = document.createElement("div");
  drillRunner.style.cssText = "position:absolute;inset:0;display:none;flex-direction:column;overflow:hidden;";
  practiceView.appendChild(drillRunner);

  /* Same shape as free play: exercise + transport on top, keys along the bottom. */
  var drillKbArea = document.createElement("div");
  drillKbArea.style.cssText = "flex:none;height:clamp(150px,52%,340px);min-height:140px;position:relative;border-top:1px solid #3A3850;";

  var drillInfo = document.createElement("div");
  drillInfo.style.cssText = "flex:1;min-height:0;padding:6px 10px;display:flex;flex-direction:column;gap:6px;justify-content:center;";

  var drillNameEl = document.createElement("span");
  drillNameEl.style.cssText = "font-family:Fredoka,Nunito,system-ui;font-size:14px;font-weight:600;color:#F4F2FA;text-align:center;";
  drillInfo.appendChild(drillNameEl);

  var drillControls = document.createElement("div");
  drillControls.style.cssText = "display:flex;align-items:center;gap:8px;justify-content:center;flex-wrap:wrap;";

  /* Tempo minus */
  var tempoMinus = document.createElement("button");
  tempoMinus.textContent = "\u2212";
  tempoMinus.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;color:#F4F2FA;border-radius:10px;padding:6px 14px;font-size:18px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;min-width:44px;min-height:44px;";

  var tempoLabel = document.createElement("span");
  tempoLabel.style.cssText = "font-family:Fredoka,Nunito,system-ui;font-size:16px;font-weight:700;color:#FFB13C;min-width:50px;text-align:center;";

  var tempoPlus = document.createElement("button");
  tempoPlus.textContent = "+";
  tempoPlus.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;color:#F4F2FA;border-radius:10px;padding:6px 14px;font-size:18px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;min-width:44px;min-height:44px;";

  var btnPause = document.createElement("button");
  btnPause.textContent = "\u25B6\uFE0F";
  btnPause.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;color:#5AD1C4;border-radius:10px;padding:6px 14px;font-size:16px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;min-width:44px;min-height:44px;";

  var btnLoop = document.createElement("button");
  btnLoop.textContent = "Loop \u5FAA\u74B0 OFF";
  btnLoop.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;color:#9A96B4;border-radius:10px;padding:6px 10px;font-size:11px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;min-width:44px;min-height:44px;";

  var btnRestart = document.createElement("button");
  btnRestart.textContent = "\u21BA";
  btnRestart.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;color:#F4F2FA;border-radius:10px;padding:6px 12px;font-size:16px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;min-width:44px;min-height:44px;";

  var btnBack = document.createElement("button");
  btnBack.textContent = "\u2190 \u8FD4\u56DE";
  btnBack.style.cssText = "background:transparent;border:2px solid #3A3850;color:#9A96B4;border-radius:10px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;min-width:44px;min-height:32px;";

  drillControls.appendChild(tempoMinus);
  drillControls.appendChild(tempoLabel);
  drillControls.appendChild(tempoPlus);
  drillControls.appendChild(btnPause);
  drillControls.appendChild(btnLoop);
  drillControls.appendChild(btnRestart);
  drillControls.appendChild(btnBack);
  drillInfo.appendChild(drillControls);

  var drillHintEl = document.createElement("span");
  drillHintEl.style.cssText = "font-size:11px;color:#9A96B4;text-align:center;";
  drillInfo.appendChild(drillHintEl);

  drillRunner.appendChild(drillInfo);
  drillRunner.appendChild(drillKbArea);

  /* Practice state */
  var practiceState = null;

  function stopPractice() {
    if (practiceState && practiceState.pause) {
      practiceState.pause();      /* the metronome loop, before its keybed goes */
    }
    if (practiceState && practiceState.keybed) {
      practiceState.keybed.destroy();
    }
    practiceState = null;
    drillRunner.style.display = "none";
    drillList.style.display = "";
  }
  S._stopPractice = stopPractice;   /* so stop() can reach into this closure */

  function startPractice(drill) {
    stopPractice();

    drillRunner.style.display = "flex";
    drillList.style.display = "none";
    drillNameEl.textContent = drill.name.en + " — " + drill.name.tz;
    drillHintEl.textContent = drill.hint.en + " / " + drill.hint.tz;

    /* Tempo from localStorage, fallback to drill default */
    var storedBpm = null;
    try {
      var raw = localStorage.getItem("sq.piano.tempo." + drill.id);
      if (raw) storedBpm = parseInt(raw, 10);
    } catch (e) {}
    var bpm = (storedBpm && storedBpm >= 40 && storedBpm <= 120) ? storedBpm : drill.bpm;
    tempoLabel.textContent = bpm + " bpm";

    var looping = false;
    var currentBar = 0;
    var playing = false;
    var totalSteps = drill.steps.length;

    btnLoop.textContent = "Loop \u5FAA\u74B0 OFF";
    btnLoop.style.color = "#9A96B4";
    btnPause.textContent = "\u25B6\uFE0F";

    /* Hand label */
    var handText = drill.hand === "right" ? "RIGHT \u53F3\u624B" : drill.hand === "left" ? "LEFT \u5DE6\u624B" : "BOTH \u96D9\u624B";
    handLabel.textContent = handText;

    /* Build drill keybed */
    var drillKb = createKeybed({
      mount: drillKbArea,
      lowMidi: Math.floor(drill.steps[0].midi / 12) * 12,
      octaves: 3,
      onNoteOn: function () {},
      onNoteOff: function () {}
    });

    var prevMidi = null;
    var stepIdx = 0;

    /* ponytail: this screen sequences with its own lookahead loop instead of
       createTransport() — it needs bar-aware looping and a count-in the transport
       does not model, and nothing here is judged (D2: nothing listens). The
       transport earns its place in the slice-40 trainer, where judging is the
       point; wire this screen to it only if the two ever need one clock. */

    var startTime = 0;
    var countInBeats = 4;
    var metronomeCursor = -countInBeats; /* negative for count-in */
    var stopSeq = null; /* sched.every() cancel fn — sched.cancelAll() also kills it */
    var bpmRef = bpm;

    function computeStepTime(beatIdx) {
      return startTime + beatIdx * 60 / bpmRef;
    }

    function clearHighlights() {
      if (prevMidi !== null && prevMidi !== undefined) {
        drillKb.unhighlight(prevMidi, "sq-key-highlight");
        prevMidi = null;
      }
    }

    function advanceMetronome() {
      if (!playing) return;
      var nowTime = audio.clock().now;
      var lookahead = nowTime + 0.15;

      while (metronomeCursor <= totalSteps) {
        var stepTime = computeStepTime(metronomeCursor);
        if (stepTime > lookahead) break;

        if (metronomeCursor >= 0) {
          /* Actual step */
          var step = drill.steps[metronomeCursor];
          if (step) {
            clearHighlights();
            var midi = step.midi || step.midiR;
            if (midi !== undefined) {
              drillKb.highlight(midi, "sq-key-highlight");
              prevMidi = midi;
            }
            /* For contrary motion, try to highlight left hand note */
            /* The keybed can highlight both */
          }
          stepIdx = metronomeCursor;
        }

        /* Metronome click on every beat and on count-in */
        audio.play("ui-tap", { volume: 0.3, when: Math.max(0, stepTime - nowTime) });

        metronomeCursor++;

        /* Detect bar boundaries for loop */
        if (metronomeCursor > 0) {
          var newBar = Math.floor((metronomeCursor - 1) / 4);
          if (newBar !== currentBar && metronomeCursor >= totalSteps) {
            if (looping) {
              /* Loop back to start of current bar */
              metronomeCursor = currentBar * 4;
              stepIdx = metronomeCursor;
              startTime = nowTime + 0.5;
              clearHighlights();
            }
          }
          currentBar = newBar;
        }

        /* Check if exercise is done */
        if (metronomeCursor >= totalSteps && !looping) {
          clearHighlights();
          playing = false;
          btnPause.textContent = "\u25B6\uFE0F";
          return;
        }
      }
    }

    function startSeq() {
      /* Rebuild chart with current bpm */
      bpmRef = bpm;
      startTime = audio.clock().now + 1.0; /* 1s lead */
      metronomeCursor = -countInBeats;
      currentBar = 0;
      stepIdx = 0;
      playing = true;
      clearHighlights();
      if (stopSeq) stopSeq();
      stopSeq = sched.every(25, advanceMetronome);
      btnPause.textContent = "\u23F8\uFE0F";
    }

    function pauseSeq() {
      playing = false;
      if (stopSeq) { stopSeq(); stopSeq = null; }
      btnPause.textContent = "\u25B6\uFE0F";
    }

    function resumeSeq() {
      if (metronomeCursor >= totalSteps && !looping) {
        /* Restart */
        metronomeCursor = -countInBeats;
      }
      startTime = audio.clock().now + 1.0;
      playing = true;
      if (stopSeq) stopSeq();
      stopSeq = sched.every(25, advanceMetronome);
      btnPause.textContent = "\u23F8\uFE0F";
    }

    function setTempo(newBpm) {
      bpm = Math.max(40, Math.min(120, newBpm));
      tempoLabel.textContent = bpm + " bpm";
      try { localStorage.setItem("sq.piano.tempo." + drill.id, String(bpm)); } catch (e) {}
      if (playing) {
        pauseSeq();
        startSeq();
      }
    }

    /* Tempo controls */
    tempoMinus.onpointerdown = function () { setTempo(bpm - 5); };
    tempoPlus.onpointerdown = function () { setTempo(bpm + 5); };

    btnPause.onpointerdown = function () {
      if (!playing) {
        if (metronomeCursor < 0 || metronomeCursor >= totalSteps) {
          /* Start fresh */
          startSeq();
        } else {
          resumeSeq();
        }
      } else {
        pauseSeq();
      }
    };

    btnLoop.onpointerdown = function () {
      looping = !looping;
      btnLoop.textContent = "Loop \u5FAA\u74B0 " + (looping ? "ON" : "OFF");
      btnLoop.style.color = looping ? "#FFB13C" : "#9A96B4";
    };

    btnRestart.onpointerdown = function () {
      if (playing) pauseSeq();
      clearHighlights();
      startSeq();
    };

    btnBack.onpointerdown = function () {
      if (playing) pauseSeq();
      clearHighlights();
      stopPractice();
    };

    practiceState = {
      keybed: drillKb,
      drill: drill,
      pause: pauseSeq,
      clear: clearHighlights
    };

    /* Auto-start */
    startSeq();
  }

  /* Mode switching */
  function setMode(mode) {
    S.mode = mode;
    if (mode === "play") {
      playView.style.display = "flex";
      practiceView.style.display = "none";
      btnPlay.style.background = "#5AD1C4";
      btnPlay.style.borderColor = "#5AD1C4";
      btnPlay.style.color = "#14131A";
      btnPractice.style.background = "#2F2E3D";
      btnPractice.style.borderColor = "#3A3850";
      btnPractice.style.color = "#F4F2FA";
      handLabel.textContent = "";
      if (practiceState) stopPractice();
      /* Rebuild free-play keybed if needed */
      if (!S.keybed) rebuildFreePlay();
    } else {
      playView.style.display = "none";
      practiceView.style.display = "flex";
      btnPlay.style.background = "#2F2E3D";
      btnPlay.style.borderColor = "#3A3850";
      btnPlay.style.color = "#F4F2FA";
      btnPractice.style.background = "#5AD1C4";
      btnPractice.style.borderColor = "#5AD1C4";
      btnPractice.style.color = "#14131A";
      /* Destroy free-play voices, not keybed — we'll show drill list */
      S.keybed && S.keybed.allNotesOff();
      voices.forEach(function (v) { v.release(); });
      voices.clear();
      drillList.style.display = "";
      drillRunner.style.display = "none";
    }
  }

  btnPlay.addEventListener("pointerdown", function () { setMode("play"); });
  btnPractice.addEventListener("pointerdown", function () { setMode("practice"); });

  /* Free-play keybed */
  function rebuildFreePlay() {
    if (S.keybed) S.keybed.destroy();
    S.keybed = createKeybed({
      mount: kbContainer,
      lowMidi: currentOctave * 12,
      octaves: 3,
      onNoteOn: function (midi) {
        if (!S.unblocked) { audio.unlock(); S.unblocked = true; }
        if (voices.has(midi)) { voices.get(midi).release(); voices.delete(midi); }
        var voice = createPianoVoice(graph.ctx, graph.master, midi);
        voices.set(midi, voice);
      },
      onNoteOff: function (midi) {
        if (voices.has(midi)) { voices.get(midi).release(); voices.delete(midi); }
      }
    });
  }

  rebuildFreePlay();

  btnDown.addEventListener("pointerdown", function () {
    if (S.mode !== "play") return;
    if (currentOctave > 1) {
      currentOctave--;
      octLabel.textContent = octaveName();
      S.keybed.allNotesOff();
      voices.forEach(function (v) { v.release(); });
      voices.clear();
      rebuildFreePlay();
    }
  });

  btnUp.addEventListener("pointerdown", function () {
    if (S.mode !== "play") return;
    if (currentOctave < 6) {
      currentOctave++;
      octLabel.textContent = octaveName();
      S.keybed.allNotesOff();
      voices.forEach(function (v) { v.release(); });
      voices.clear();
      rebuildFreePlay();
    }
  });

  /* visibility change */
  function onVisibility() {
    if (document.hidden && S) {
      if (practiceState) {
        if (practiceState.keybed) practiceState.keybed.allNotesOff();
        practiceState.clear();
      }
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

  /* Quitting mid-exercise used to leave the metronome loop and the practice
     keybed alive — practiceState lives in init()'s closure, so stop() has to be
     handed the way in. */
  if (S._stopPractice) { try { S._stopPractice(); } catch (e) {} }

  document.removeEventListener("visibilitychange", S._onVisibility);

  if (S.keybed) { S.keybed.allNotesOff(); S.keybed.destroy(); S.keybed = null; }

  S.voices.forEach(function (v) { v.release(); });
  S.voices.clear();

  S.sched.cancelAll();

  if (S.audio && S.previousCap !== undefined) {
    S.audio.setMaxVoices(S.previousCap);
  }

  if (S.mount) S.mount.innerHTML = "";
  S = null;
}

export default {
  id: "piano",
  meta: { icon: "\uD83C\uDFB9", title: "Piano", tz: "\u92FC\u7434", blurb: "Play and practise" },
  keyboard: false,
  bestKey: null,
  init: init,
  stop: stop
};
