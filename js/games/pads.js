import { getSharedAudio } from "../game-services/audio.js";
import { createScheduler } from "../game-services/scheduler.js";
import { createTransport, judge, offset, rotateGuard, HIT_WINDOW_MS } from "../game-services/music.js";
import { CHARTS } from "./pad-charts.js";

/* 4-lane colours for the trainer track */
var LANE_COLORS = ["#FF7A45", "#5AD1C4", "#FFB13C", "#B98CFF"];

/* Pad grid layout — 4x4, 16 cells. First 4 at row 0 are the trainer pads. */
var PAD_LAYOUT = [
  { row: 0, col: 0, sample: "kick"       },
  { row: 0, col: 1, sample: "snare"      },
  { row: 0, col: 2, sample: "hat-closed" },
  { row: 0, col: 3, sample: "clap"       },
  { row: 1, col: 0, sample: "rim"        },
  { row: 1, col: 1, sample: "hat-open"   },
  { row: 1, col: 2, sample: "tom-low"    },
  { row: 1, col: 3, sample: "tom-high"   },
  { row: 2, col: 0, sample: "crash"      },
  { row: 2, col: 1, sample: "cowbell"    },
  { row: 2, col: 2, sample: "shaker"     },
  { row: 2, col: 3, sample: "zap"        },
  { row: 3, col: 0, sample: "kick"       },
  { row: 3, col: 1, sample: "snare"      },
  { row: 3, col: 2, sample: "hat-closed" },
  { row: 3, col: 3, sample: "zap"        }
];

var PAD_LABELS = {
  kick:       { en: "Kick",       tz: "\u5927\u9F13" },
  snare:      { en: "Snare",      tz: "\u5C0F\u9F13" },
  "hat-closed": { en: "Closed Hat", tz: "\u9589\u5408\u8E34\u9434" },
  "hat-open":  { en: "Open Hat",   tz: "\u958B\u653E\u8E34\u9434" },
  clap:       { en: "Clap",       tz: "\u62CD\u624B" },
  rim:        { en: "Rim",        tz: "\u9F13\u908A" },
  "tom-low":   { en: "Low Tom",    tz: "\u4F4E\u97F3\u9F13" },
  "tom-high":  { en: "High Tom",   tz: "\u9AD8\u97F3\u9F13" },
  crash:      { en: "Crash",      tz: "\u947D\u9438" },
  cowbell:    { en: "Cowbell",    tz: "\u725B\u923A" },
  shaker:     { en: "Shaker",     tz: "\u6C99\u9235" },
  zap:        { en: "Zap",        tz: "\u96FB\u653E" }
};

var TRAINER_SAMPLES = ["kick", "snare", "hat-closed", "clap"];

var S = null;

function init(ctx) {
  if (S) stop();

  var audio = getSharedAudio();
  var sched = createScheduler();
  var mount = ctx.mount;

  var activePointers = new Map();
  var padElements = [];
  var kitLoaded = false;
  var kitMeta = null;
  var practiceSpeed = 0.8;
  var trainerPads = [];
  var targets = [];
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  S = {
    ctx: ctx, audio: audio, sched: sched, mount: mount,
    activePointers: activePointers, padElements: padElements,
    mode: "play", _onVisibility: null, previousCap: audio.setMaxVoices(24)
  };

  /* Root */
  var root = document.createElement("div");
  root.style.cssText = "position:relative;display:flex;flex-direction:column;height:100%;width:100%;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;";

  /* Mode bar */
  var modeBar = document.createElement("div");
  modeBar.style.cssText = "flex:none;display:flex;align-items:center;gap:8px;padding:4px 10px;border-bottom:1px solid #3A3850;";

  var btnPlay = document.createElement("button");
  btnPlay.textContent = "Play 自由玩";
  btnPlay.dataset.mode = "play";
  btnPlay.style.cssText = "background:#5AD1C4;border:2px solid #5AD1C4;color:#14131A;border-radius:10px;padding:6px 14px;font-size:13px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;font-weight:600;min-width:44px;min-height:44px;";

  var btnPractice = document.createElement("button");
  btnPractice.textContent = "Learn a beat 節奏練習";
  btnPractice.dataset.mode = "practice";
  btnPractice.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;color:#F4F2FA;border-radius:10px;padding:6px 14px;font-size:13px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;font-weight:600;min-width:44px;min-height:44px;";

  var kitLabel = document.createElement("span");
  kitLabel.style.cssText = "font-family:Fredoka,Nunito,system-ui;font-size:11px;font-weight:600;color:#9A96B4;margin-left:auto;";
  kitLabel.textContent = "Loading sounds… 載入音效…";
  modeBar.appendChild(btnPlay);
  modeBar.appendChild(btnPractice);
  modeBar.appendChild(kitLabel);
  root.appendChild(modeBar);

  /* Stage */
  var stage = document.createElement("div");
  stage.style.cssText = "flex:1;min-height:0;position:relative;";
  root.appendChild(stage);

  mount.appendChild(root);
  rotateGuard(root);   /* D13: portrait gets a rotate prompt, not a squeezed instrument */

  /* Styles */
  if (!document.getElementById("sq-pad-style")) {
    var sEl = document.createElement("style");
    sEl.id = "sq-pad-style";
    sEl.textContent =
      ".sq-pad-active{background:#FF7A45!important;border-color:#FF7A45!important}" +
      ".sq-pad-active span{color:#14131A!important}" +
      ".sq-pad:focus-visible,.sq-pad-trainer button:focus-visible{outline:3px solid #fff!important;outline-offset:-4px}" +
      ".sq-drill-intro{padding:6px 4px 10px;color:#F4F2FA;font:600 14px Nunito,system-ui;line-height:1.4}" +
      ".sq-drill-intro small{display:block;color:#C9C5E0;font-size:12px}" +
      ".sq-speed{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:10px}" +
      ".sq-speed button{min-height:44px;padding:7px 14px;border:2px solid #625E7A;border-radius:9px;background:#2F2E3D;color:#F4F2FA;font:700 13px Nunito,system-ui}" +
      ".sq-speed button[aria-pressed=true]{background:#5AD1C4;border-color:#5AD1C4;color:#14131A}" +
      ".sq-train-help{flex:none;padding:6px 10px;color:#C9C5E0;font:600 13px/1.3 Nunito,system-ui}" +
      ".sq-train-status{flex:none;display:flex;align-items:center;gap:10px;min-height:48px;padding:3px 10px;background:#211F30}" +
      ".sq-train-feedback{flex:1;color:#F4F2FA;font:700 clamp(14px,2.5vmin,20px)/1.15 Nunito,system-ui}" +
      ".sq-train-feedback[data-result=perfect],.sq-train-feedback[data-result=good]{color:#79E9C7}" +
      ".sq-beat-count{display:flex;gap:5px}.sq-beat-count span{display:grid;place-items:center;width:28px;height:28px;border:1px solid #625E7A;border-radius:50%;font:700 13px Nunito,system-ui;color:#C9C5E0}" +
      ".sq-beat-count .is-beat{background:#F4F2FA;color:#211F30;border-color:#F4F2FA}" +
      ".sq-pad-track{background:#181620;isolation:isolate}" +
      ".sq-track-lane{position:absolute;left:0;right:0;height:25%;border-bottom:1px solid #39354B}" +
      ".sq-lane-label{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--lane);font:700 clamp(10px,1.8vmin,14px)/1.3 Nunito,system-ui}" +
      ".sq-lane-label small{display:block;font-size:11px;color:#C9C5E0}" +
      ".sq-hit-line{position:absolute;left:22%;top:0;bottom:0;width:3px;transform:translateX(-50%);background:#F4F2FA;z-index:2}" +
      ".sq-train-target{position:absolute;left:22%;top:50%;width:38px;height:38px;transform:translate(-50%,-50%);border:2px solid var(--lane);border-radius:8px;background:#211F30;z-index:3;display:grid;place-items:center;color:var(--lane);font:800 20px Nunito,system-ui}" +
      ".sq-train-note{position:absolute;left:0;width:34px;height:calc(25% - 14px);max-height:52px;display:grid;place-items:center;border-radius:7px;background:var(--lane);color:#14131A;font:800 19px Nunito,system-ui;z-index:4;pointer-events:none}" +
      ".sq-train-note[data-result]{visibility:hidden}" +
      ".sq-trainer-pad{background:#2A2838;border:2px solid var(--lane);border-radius:10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:0;min-height:44px;color:#F4F2FA;touch-action:none}" +
      ".sq-trainer-pad:disabled{opacity:.3;cursor:default}.sq-trainer-pad.sq-pad-soon{background:#40394E}" +
      ".sq-trainer-pad.sq-pad-cue,.sq-train-target.is-beat{background:var(--lane);color:#14131A}" +
      ".sq-trainer-pad.sq-pad-cue span{color:#14131A!important}" +
      ".sq-trainer-pad[data-feedback],.sq-train-target[data-feedback]{background:#DAFFF1!important;color:#124C39!important;border-color:#79E9C7!important;box-shadow:inset 0 0 0 2px #79E9C7}" +
      ".sq-trainer-pad[data-feedback] span{color:#124C39!important}" +
      ".sq-train-score{color:#79E9C7;font:700 13px Nunito,system-ui;margin-left:auto}" +
      "@media(max-height:650px){.sq-train-help{font-size:12px;padding:3px 8px}.sq-train-status{min-height:40px}.sq-trainer-pad b{font-size:20px!important}}";
    document.head.appendChild(sEl);
  }

  function labelFor(sampleName) {
    var meta = kitMeta && kitMeta[sampleName] && kitMeta[sampleName].label;
    return meta || PAD_LABELS[sampleName] || { en: sampleName, tz: sampleName };
  }

  function setPadLabel(el, sampleName, laneIdx, compact) {
    var label = labelFor(sampleName);
    var color = laneIdx != null ? (LANE_COLORS[laneIdx] || "#F4F2FA") : "#F4F2FA";
    el.setAttribute("aria-label", label.en + " / " + label.tz);
    if (compact) {
      el.innerHTML =
        "<b style='font:800 26px Nunito,system-ui'>" + (laneIdx + 1) + "</b>" +
        "<span style='font-family:Fredoka,Nunito,system-ui;font-weight:600;font-size:14px;color:" + color + ";line-height:1.05;'>" +
        label.en + "</span>" +
        "<span style='font-size:12px;color:#C9C5E0;line-height:1.05;'>" + label.tz + "</span>";
    } else {
      el.innerHTML =
        "<span style='font-family:Fredoka,Nunito,system-ui;font-size:11px;font-weight:600;color:" + color + ";line-height:1.05;'>" +
        label.en + "</span>" +
        "<span style='font-size:10px;color:#C9C5E0;line-height:1.05;'>" + label.tz + "</span>";
    }
  }

  function releasePointer(pointerId) {
    var entry = activePointers.get(pointerId);
    if (!entry) return;
    activePointers.delete(pointerId);
    if (entry.padEl) {
      if (!Array.from(activePointers.values()).some(function (other) { return other.padEl === entry.padEl; })) entry.padEl.classList.remove("sq-pad-active");
      try {
        if (entry.padEl.releasePointerCapture) entry.padEl.releasePointerCapture(pointerId);
      } catch (e) {}
    }
  }

  function clearPointers() {
    Array.from(activePointers.keys()).forEach(function (pointerId) {
      releasePointer(pointerId);
    });
  }

  /* ---- Free Play view ---- */
  var playView = document.createElement("div");
  playView.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;";
  var grid = document.createElement("div");
  grid.style.cssText = "flex:1;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);gap:6px;padding:8px;min-height:0;";
  playView.appendChild(grid);
  stage.appendChild(playView);

  buildPads(grid);

  /* ---- Practice view ---- */
  var practiceView = document.createElement("div");
  practiceView.style.cssText = "position:absolute;inset:0;display:none;flex-direction:column;overflow:hidden;";
  stage.appendChild(practiceView);

  /* Exercise list */
  var drillList = document.createElement("div");
  drillList.style.cssText = "flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px;";
  var intro = document.createElement("div");
  intro.className = "sq-drill-intro";
  intro.innerHTML = "Follow the numbered notes. Tap the matching pad at the white line." +
    "<small>跟著數字音符，音符到白線時敲同號碼的墊子。亮起的墊子會提醒你。</small>" +
    "<div class='sq-speed'><span>Speed 速度</span><button data-speed='0.8' aria-pressed='true'>Slow 慢速</button><button data-speed='1' aria-pressed='false'>Normal 原速</button></div>";
  intro.querySelectorAll("[data-speed]").forEach(function (button) {
    button.onclick = function () {
      practiceSpeed = Number(button.dataset.speed);
      intro.querySelectorAll("[data-speed]").forEach(function (el) { el.setAttribute("aria-pressed", String(el === button)); });
    };
  });
  drillList.appendChild(intro);
  CHARTS.forEach(function (ch) {
    var row = document.createElement("button");
    row.dataset.chart = ch.id;
    row.disabled = true;
    row.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;border-radius:11px;padding:10px;cursor:pointer;color:#F4F2FA;text-align:left;min-height:44px;";
    row.innerHTML = "<span style='font-family:Fredoka,Nunito,system-ui;font-size:14px;font-weight:600;'>" + ch.name.en + " <span style='color:#9A96B4;font-size:12px;'>" + ch.name.tz + "</span></span>" +
      "<span style='display:block;font-size:12px;color:#C9C5E0;'>" +
      (ch.tier === 1 ? "Start here 從這裡開始" : ch.tier === 2 ? "Add a layer 加一層節奏" : "Challenge 挑戰") + "</span>";
    row.addEventListener("pointerdown", function () {
      audio.unlock();
      startTrainer(ch);
    });
    row.addEventListener("click", function (e) { if (e.detail === 0) startTrainer(ch); });
    drillList.appendChild(row);
  });
  practiceView.appendChild(drillList);

  /* Trainer runner view */
  var trainerView = document.createElement("div");
  trainerView.className = "sq-pad-trainer";
  trainerView.style.cssText = "position:absolute;inset:0;display:none;flex-direction:column;overflow:hidden;";
  practiceView.appendChild(trainerView);
  var trainHelp = document.createElement("div");
  trainHelp.className = "sq-train-help";
  trainerView.appendChild(trainHelp);
  var statusRow = document.createElement("div");
  statusRow.className = "sq-train-status";
  trainerView.appendChild(statusRow);

  /* Trainer: note track */
  var trackArea = document.createElement("div");
  trackArea.className = "sq-pad-track";
  trackArea.style.cssText = "flex:1;min-height:0;position:relative;overflow:hidden;";
  trainerView.appendChild(trackArea);
  TRAINER_SAMPLES.forEach(function (sample, lane) {
    var row = document.createElement("div");
    row.className = "sq-track-lane";
    row.style.top = (lane * 25) + "%";
    row.style.setProperty("--lane", LANE_COLORS[lane]);
    var label = labelFor(sample);
    row.innerHTML = "<div class='sq-lane-label'>" + (lane + 1) + " " + label.en + "<small>" + label.tz + "</small></div>" +
      "<div class='sq-train-target'>" + (lane + 1) + "</div>";
    targets.push(row.lastElementChild);
    trackArea.appendChild(row);
  });
  var hitLine = document.createElement("div");
  hitLine.className = "sq-hit-line";
  hitLine.setAttribute("aria-hidden", "true");
  trackArea.appendChild(hitLine);

  /* Trainer: pad grid (smaller, 1 row of 4) */
  var trainerGrid = document.createElement("div");
  trainerGrid.style.cssText = "flex:none;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:6px;height:clamp(88px,24%,124px);";
  trainerView.appendChild(trainerGrid);

  buildTrainerPads(trainerGrid);

  /* Trainer controls */
  var trainBar = document.createElement("div");
  trainBar.style.cssText = "flex:none;display:flex;align-items:center;gap:6px;padding:6px 10px;border-top:1px solid #3A3850;flex-wrap:wrap;";

  var trainName = document.createElement("span");
  trainName.style.cssText = "font-family:Fredoka,Nunito,system-ui;font-size:13px;font-weight:600;color:#F4F2FA;min-width:80px;";
  trainBar.appendChild(trainName);

  var pauseBtn = document.createElement("button");
  pauseBtn.dataset.action = "start-pause";
  pauseBtn.textContent = "\u25B6\uFE0F";
  pauseBtn.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;color:#5AD1C4;border-radius:10px;padding:6px 14px;font-size:16px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;min-width:44px;min-height:44px;";
  trainBar.appendChild(pauseBtn);

  var restartBtn = document.createElement("button");
  restartBtn.dataset.action = "restart";
  restartBtn.textContent = "Restart 重來";
  restartBtn.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;color:#F4F2FA;border-radius:10px;padding:6px 12px;font-size:16px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;min-width:44px;min-height:44px;";
  trainBar.appendChild(restartBtn);

  var backBtn = document.createElement("button");
  backBtn.dataset.action = "exercises";
  backBtn.textContent = "Lessons 練習列表";
  backBtn.style.cssText = "background:transparent;border:2px solid #3A3850;color:#9A96B4;border-radius:10px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;min-width:44px;min-height:44px;";
  trainBar.appendChild(backBtn);

  /* Score display */
  var scoreLabel = document.createElement("span");
  scoreLabel.className = "sq-train-score";
  trainBar.appendChild(scoreLabel);

  /* Feedback (aria-live) */
  var feedbackEl = document.createElement("div");
  feedbackEl.className = "sq-train-feedback";
  feedbackEl.setAttribute("aria-live", "polite");
  statusRow.appendChild(feedbackEl);
  var beatCount = document.createElement("div");
  beatCount.className = "sq-beat-count";
  beatCount.setAttribute("aria-hidden", "true");
  beatCount.innerHTML = "<span>1</span><span>2</span><span>3</span><span>4</span>";
  statusRow.appendChild(beatCount);

  trainerView.appendChild(trainBar);

  /* ---- Trainer logic ---- */
  var trainState = null;

  function collectBackingNotes(chart) {
    var notes = [];
    var current = chart;
    while (current && current.backing) {
      current = CHARTS.find(function (c) { return c.id === current.backing; });
      if (!current) break;
      (current.notes || []).forEach(function (n) { notes.push(n); });
    }
    return notes;
  }

  function startTrainer(originalChart) {
    if (!kitLoaded) return;
    stopTrainer();
    var chart = Object.assign({}, originalChart, { bpm: Math.round(originalChart.bpm * practiceSpeed) });
    var beatDur = 60 / chart.bpm;
    var timingOffset = offset() / 1000;
    var hitWindow = HIT_WINDOW_MS / 1000;
    var clock = { get now() { return audio.clock().now; } };
    var backing = collectBackingNotes(chart);
    var tChart = { bpm: chart.bpm, bars: chart.bars, notes: backing.map(function (note) {
      return { beat: note.beat, sample: chart.lanes[note.lane] };
    }) };
    /* One clock schedules the four count-in beats, metronome and backing layers. */
    for (var beat = -4; beat < chart.bars * 4; beat++) tChart.notes.push({ beat: beat, click: true });
    tChart.notes.sort(function (a, b) { return a.beat - b.beat; });
    var state = {
      chart: chart, originalChart: originalChart, started: false, finished: false,
      pausedAt: null, pending: [], sounds: [], noteEls: [], flashCancels: [],
      feedbackCancel: null, paintCancel: null, lastBeat: null,
      tally: { perfect: 0, good: 0, ok: 0, miss: 0 },
      judgeState: chart.notes.map(function (note) { return { beat: note.beat, lane: note.lane, judged: false }; })
    };
    trainState = state;
    drillList.style.display = "none";
    trainerView.style.display = "flex";
    trainName.textContent = chart.name.en + " · " + chart.name.tz + " · " + chart.bpm + " BPM";
    var usedLanes = new Set(chart.notes.map(function (note) { return note.lane; }));
    trainHelp.textContent = "Tap the matching number at the white line. 音符到白線時敲同號碼。" +
      (chart.backing ? " Other drums play along. 其他鼓聲會自動伴奏。" : " Follow the clicks. 跟著拍子。" );
    trainerPads.forEach(function (pad, lane) {
      pad.disabled = !usedLanes.has(lane);
      targets[lane].parentNode.style.opacity = usedLanes.has(lane) ? "1" : "0.35";
    });

    function playNote(note, time) {
      var handle;
      if (note.click) handle = audio.play("ui-tap", { when: Math.max(0, time - clock.now), volume: 0.3 });
      else handle = audio.playSample("mpc", note.sample, {
        when: Math.max(0, time - clock.now), gain: kitMeta && kitMeta[note.sample] ? kitMeta[note.sample].gain : 1
      });
      state.sounds.push({ handle: handle, note: note, time: time });
    }
    state.transport = createTransport({ clock: clock, playNote: playNote, sched: sched });
    state.silence = function () {
      state.sounds.forEach(function (sound) { sound.handle.stop(); });
      state.sounds = [];
    };
    function renderScore() {
      var hits = state.tally.perfect + state.tally.good + state.tally.ok;
      scoreLabel.textContent = hits + " / " + chart.notes.length + " matched 敲中";
      scoreLabel.dataset.hits = String(hits);
      scoreLabel.dataset.misses = String(state.tally.miss);
    }
    function showFeedback(text, result) {
      if (state.feedbackCancel) state.feedbackCancel();
      feedbackEl.textContent = text;
      feedbackEl.dataset.result = result;
    }
    function flashHit(lane, result) {
      var pad = trainerPads[lane], target = targets[lane];
      if (state.flashCancels[lane]) state.flashCancels[lane]();
      pad.dataset.feedback = result;
      target.dataset.feedback = result;
      target.textContent = "✓";
      if (!reducedMotion && pad.animate) {
        pad.getAnimations().forEach(function (animation) { animation.cancel(); });
        pad.animate([{ transform: "scale(0.96)" }, { transform: "scale(1)" }], { duration: 130, easing: "ease-out" });
      }
      state.flashCancels[lane] = sched.after(450, function () {
        delete pad.dataset.feedback; delete target.dataset.feedback;
        target.textContent = String(lane + 1);
        state.flashCancels[lane] = null;
      });
      audio.play("token-pick", { volume: result === "perfect" ? 0.7 : 0.5 });
    }
    function finishExercise() {
      if (state.finished) return;
      state.finished = true;
      state.transport.stop();
      state.silence();
      if (state.paintCancel) { state.paintCancel(); state.paintCancel = null; }
      clearCues();
      pauseBtn.textContent = "Again 再一次";
      var hits = state.tally.perfect + state.tally.good + state.tally.ok;
      showFeedback(hits + " / " + chart.notes.length + " matched! Try the beat again. 敲中了！再來一次。", "complete");
      audio.play("success", { volume: 0.45 });
      var score = state.tally.perfect * 100 + state.tally.good * 70 + state.tally.ok * 40;
      ctx.finish({ score: score });
    }
    function clearCues() {
      trainerPads.forEach(function (pad, lane) {
        pad.classList.remove("sq-pad-cue", "sq-pad-soon");
        targets[lane].classList.remove("is-beat");
      });
    }
    function paintNotes() {
      if (trainState !== state || state.finished || state.pausedAt !== null) return;
      var width = trackArea.clientWidth;
      if (!width) return;
      var now = clock.now - timingOffset;
      var hitX = width * 0.22, pxPerBeat = width / 4;
      var nearest = [Infinity, Infinity, Infinity, Infinity];
      var nearestNotes = [null, null, null, null];
      state.judgeState.forEach(function (note, index) {
        var time = state.transport.beatToTime(note.beat);
        var delta = state.started ? time - now : (note.beat + 1.5) * beatDur;
        var el = state.noteEls[index];
        el.style.transform = "translate(" + (hitX + delta / beatDur * pxPerBeat - 17) + "px, -50%)";
        if (Math.abs(delta) < Math.abs(nearest[note.lane])) {
          nearest[note.lane] = delta;
          nearestNotes[note.lane] = note;
        }
        if (note.judged) return;
        if (state.started && delta < -hitWindow) {
          note.judged = true;
          state.tally.miss++;
          el.dataset.result = "miss";
          renderScore();
          showFeedback("Keep going — catch the next note. 繼續，跟上下一個音符。", "miss");
        }
      });
      trainerPads.forEach(function (pad, lane) {
        var available = state.started && nearestNotes[lane] && !nearestNotes[lane].judged;
        var cue = !!available && Math.abs(nearest[lane]) <= hitWindow;
        pad.classList.toggle("sq-pad-cue", cue);
        pad.classList.toggle("sq-pad-soon", !!available && nearest[lane] > hitWindow && nearest[lane] < 0.65);
        targets[lane].classList.toggle("is-beat", cue);
      });
      if (!state.started) return;
      var currentBeat = Math.floor((now - state.transport.beatToTime(0)) / beatDur);
      if (currentBeat !== state.lastBeat) {
        state.lastBeat = currentBeat;
        Array.from(beatCount.children).forEach(function (el, i) { el.classList.toggle("is-beat", i === ((currentBeat % 4) + 4) % 4); });
        if (currentBeat >= -4 && currentBeat < 0) showFeedback("Ready " + (currentBeat + 5) + " / 4 · 預備", "count");
        if (currentBeat === 0 && feedbackEl.dataset.result === "count") showFeedback("Your turn! Tap at the line. 輪到你！到白線就敲。", "go");
      }
      if (state.judgeState.every(function (note) { return note.judged; })) finishExercise();
    }
    state.onPadTap = function (sample) {
      if (!state.started || state.finished || state.pausedAt !== null) return;
      var lane = TRAINER_SAMPLES.indexOf(sample), now = clock.now - timingOffset;
      var best = -1, bestDiff = Infinity;
      /* Include judged neighbours: a second tap on one beat must not eat the next. */
      state.judgeState.forEach(function (note, index) {
        if (note.lane !== lane) return;
        var diff = Math.abs(now - state.transport.beatToTime(note.beat));
        if (diff < bestDiff) { best = index; bestDiff = diff; }
      });
      if (best < 0) return;
      if (state.judgeState[best].judged && bestDiff <= hitWindow) return;
      if (bestDiff > hitWindow || state.judgeState[best].judged) {
        showFeedback("Wait for the note at the line. 等音符到白線再敲。", "early");
        return;
      }
      var note = state.judgeState[best];
      var result = judge(now, state.transport.beatToTime(note.beat), 0);
      if (result === "miss") return;
      note.judged = true;
      state.noteEls[best].dataset.result = result;
      state.tally[result]++;
      renderScore();
      flashHit(lane, result);
      showFeedback(result === "perfect" ? "On beat! 正好！" : result === "good" ? "Nice timing! 節奏很好！" : "Got it! 敲中了！", result);
      state.feedbackCancel = sched.after(650, function () {
        if (trainState === state && !state.finished) showFeedback("Follow the next note. 跟著下一個音符。", "guide");
      });
      if (state.judgeState.every(function (item) { return item.judged; })) finishExercise();
    };
    state.judgeState.forEach(function (note, index) {
      var el = document.createElement("div");
      el.className = "sq-train-note";
      el.style.top = (note.lane * 25 + 12.5) + "%";
      el.style.setProperty("--lane", LANE_COLORS[note.lane]);
      el.textContent = String(note.lane + 1);
      el.dataset.type = "kid"; el.dataset.judgeIdx = String(index);
      el.dataset.beat = String(note.beat); el.dataset.lane = String(note.lane);
      el.setAttribute("aria-hidden", "true");
      trackArea.appendChild(el);
      state.noteEls.push(el);
    });
    function startSequence() {
      audio.setMuted(ctx.isMuted ? ctx.isMuted() : audio.muted);
      audio.unlock();
      state.silence();
      state.started = true;
      state.transport.start(tChart, 0.35 + 4 * beatDur);
      pauseBtn.textContent = "Pause 暫停";
      showFeedback("Listen: four clicks, then your turn. 聽四拍，接著換你。", "count");
    }
    pauseBtn.onpointerdown = function () {
      if (state.finished) { startTrainer(originalChart); pauseBtn.onpointerdown(); return; }
      if (!state.started) { startSequence(); return; }
      if (state.pausedAt === null) {
        state.pausedAt = clock.now;
        state.pending = state.sounds.filter(function (sound) { return sound.time >= state.pausedAt; });
        state.transport.pause();
        state.silence();
        clearPointers();
        clearCues();
        pauseBtn.textContent = "Resume 繼續";
        showFeedback("Paused. Resume when ready. 已暫停，準備好就繼續。", "paused");
      } else {
        audio.unlock();
        var gap = clock.now - state.pausedAt;
        state.pausedAt = null;
        state.transport.resume();
        state.pending.forEach(function (sound) { playNote(sound.note, sound.time + gap); });
        state.pending = [];
        pauseBtn.textContent = "Pause 暫停";
        showFeedback("Follow the next note. 跟著下一個音符。", "guide");
      }
    };
    restartBtn.onpointerdown = function () { startTrainer(originalChart); pauseBtn.onpointerdown(); };
    backBtn.onpointerdown = stopTrainer;
    [pauseBtn, restartBtn, backBtn].forEach(function (button) {
      button.onclick = function (event) { if (event.detail === 0) button.onpointerdown(); };
    });
    pauseBtn.textContent = "Start 開始";
    showFeedback("Press Start. Listen to four clicks, then play. 按開始，聽四拍再敲。", "ready");
    renderScore();
    paintNotes();
    state.paintCancel = sched.frame(paintNotes);
  }

  function stopTrainer() {
    if (trainState) {
      clearPointers();
      if (trainState.feedbackCancel) { trainState.feedbackCancel(); trainState.feedbackCancel = null; }
      if (trainState.transport) trainState.transport.stop();
      trainState.silence();
      trainState.flashCancels.forEach(function (cancel) { if (cancel) cancel(); });
      if (trainState.paintCancel) { trainState.paintCancel(); trainState.paintCancel = null; }
      if (trainState.noteEls) {
        trainState.noteEls.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
      }
      trainState = null;
    }
    trainerPads.forEach(function (pad, lane) {
      pad.classList.remove("sq-pad-soon", "sq-pad-cue", "sq-pad-active");
      delete pad.dataset.feedback;
      if (pad.getAnimations) pad.getAnimations().forEach(function (animation) { animation.cancel(); });
      targets[lane].classList.remove("is-beat");
      delete targets[lane].dataset.feedback;
      targets[lane].textContent = String(lane + 1);
    });
    Array.from(beatCount.children).forEach(function (el) { el.classList.remove("is-beat"); });
    feedbackEl.textContent = "";
    scoreLabel.textContent = "";
    trainerView.style.display = "none";
    drillList.style.display = "flex";
  }

  /* Trainer pad taps */
  function buildTrainerPads(container) {
    /* 4 trainer pads matching chart lanes: kick, snare, hat-closed, clap */
    TRAINER_SAMPLES.forEach(function (sn, idx) {
      var btn = document.createElement("button");
      btn.setAttribute("role", "button");
      btn.className = "sq-pad sq-trainer-pad";
      btn.style.setProperty("--lane", LANE_COLORS[idx]);
      btn.dataset.sample = sn;
      setPadLabel(btn, sn, idx, true);

      function strike() {
        if (!kitLoaded || btn.disabled) return;
        if (ctx.isMuted && audio.muted !== ctx.isMuted()) audio.setMuted(ctx.isMuted());
        if (!audio.unlocked || audio.graph().ctx.state !== "running") audio.unlock();
        var sn2 = btn.dataset.sample;
        var gain = kitMeta && kitMeta[sn2] ? kitMeta[sn2].gain : 1;
        audio.playSample("mpc", sn2, { gain: gain });
        if (trainState && trainState.onPadTap) trainState.onPadTap(sn2);
      }
      btn.addEventListener("pointerdown", function (e) {
        if (btn.disabled || activePointers.has(e.pointerId)) return;
        e.preventDefault();
        strike();
        this.classList.add("sq-pad-active");
        activePointers.set(e.pointerId, { padEl: this, sampleName: this.dataset.sample });
        try { this.setPointerCapture(e.pointerId); } catch (err) {}
      });
      btn.addEventListener("pointerup", function (e) { releasePointer(e.pointerId); });
      btn.addEventListener("pointercancel", function (e) { releasePointer(e.pointerId); });
      btn.addEventListener("lostpointercapture", function (e) { releasePointer(e.pointerId); });
      btn.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();e.stopPropagation();
        if (!e.repeat) { strike(); btn.classList.add("sq-pad-active"); }
      });
      btn.addEventListener("keyup", function () { btn.classList.remove("sq-pad-active"); });
      btn.addEventListener("blur", function () { btn.classList.remove("sq-pad-active"); });
      btn.addEventListener("click", function (e) { if (e.detail === 0) strike(); });

      container.appendChild(btn);
      trainerPads.push(btn);
    });
  }

  /* Mode switching */
  function setMode(mode) {
    S.mode = mode;
    stopTrainer();
    if (mode === "play") {
      playView.style.display = "flex";
      practiceView.style.display = "none";
      btnPlay.style.background = "#5AD1C4"; btnPlay.style.borderColor = "#5AD1C4"; btnPlay.style.color = "#14131A";
      btnPractice.style.background = "#2F2E3D"; btnPractice.style.borderColor = "#3A3850"; btnPractice.style.color = "#F4F2FA";
    } else {
      playView.style.display = "none";
      practiceView.style.display = "flex";
      btnPlay.style.background = "#2F2E3D"; btnPlay.style.borderColor = "#3A3850"; btnPlay.style.color = "#F4F2FA";
      btnPractice.style.background = "#5AD1C4"; btnPractice.style.borderColor = "#5AD1C4"; btnPractice.style.color = "#14131A";
      drillList.style.display = "flex";
      trainerView.style.display = "none";
    }
  }

  btnPlay.addEventListener("pointerdown", function () { setMode("play"); });
  btnPractice.addEventListener("pointerdown", function () { setMode("practice"); });
  btnPlay.addEventListener("click", function (e) { if (e.detail === 0) setMode("play"); });
  btnPractice.addEventListener("click", function (e) { if (e.detail === 0) setMode("practice"); });

  /* Build free-play pads */
  function buildPads(container) {
    PAD_LAYOUT.forEach(function (pad) {
      var btn = document.createElement("button");
      btn.setAttribute("role", "button");
      btn.className = "sq-pad";
      btn.style.cssText = "background:#2A2838;border:2px solid #3A3850;border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px;min-width:0;min-height:0;outline:none;";
      btn.dataset.sample = pad.sample;
      setPadLabel(btn, pad.sample, null, false);
      btn.addEventListener("pointerdown", function (e) {
        if (!kitLoaded) { audio.unlock(); return; }
        audio.unlock();
        var sn = this.dataset.sample;
        var gain = kitMeta && kitMeta[sn] ? kitMeta[sn].gain : 1;
        audio.playSample("mpc", sn, { gain: gain });
        this.classList.add("sq-pad-active");
        activePointers.set(e.pointerId, { padEl: this, sampleName: sn });
        this.setPointerCapture(e.pointerId);
      });
      btn.addEventListener("pointerup", function (e) { releasePointer(e.pointerId); });
      btn.addEventListener("pointercancel", function (e) { releasePointer(e.pointerId); });
      container.appendChild(btn);
      padElements.push(btn);
    });
  }

  /* Load kit */
  function loadKit() {
    fetch("./assets/audio/mpc/kit.json")
      .then(function (r) { return r.json(); })
      .then(function (manifest) {
        kitMeta = manifest.samples;
        var urls = {};
        Object.keys(kitMeta).forEach(function (k) {
          urls[k] = "./assets/audio/mpc/" + kitMeta[k].file;
        });
        return audio.loadKit("mpc", urls);
      })
      .then(function () {
        kitLoaded = true;
        kitLabel.textContent = "808 Kit 鼓組";
        drillList.querySelectorAll("[data-chart]").forEach(function (button) { button.disabled = false; });
        /* Update pad labels */
        padElements.forEach(function (el) {
          var sn = el.dataset.sample;
          setPadLabel(el, sn, null, false);
        });
        /* Also update trainer pads */
        trainerGrid.querySelectorAll("[data-sample]").forEach(function (el) {
          var sn = el.dataset.sample;
          var laneIdx = TRAINER_SAMPLES.indexOf(sn);
          setPadLabel(el, sn, laneIdx, true);
        });
      })
      .catch(function () { kitLabel.textContent = "Sounds unavailable 音效載入失敗"; });
  }
  loadKit();

  /* visibility */
  function onVis() {
    if (document.hidden && S) {
      clearPointers();
      if (trainState) stopTrainer();
      padElements.forEach(function (el) { el.classList.remove("sq-pad-active"); });
      audio.stopAll();
    }
  }
  document.addEventListener("visibilitychange", onVis);
  S._onVisibility = onVis;
  S._clearPointers = clearPointers;
  S._stopTrainer = stopTrainer;
}

function stop() {
  if (!S) return;
  document.removeEventListener("visibilitychange", S._onVisibility);
  if (S._clearPointers) S._clearPointers();
  if (S._stopTrainer) S._stopTrainer();
  if (S.padElements) S.padElements.forEach(function (el) { el.classList.remove("sq-pad-active"); });
  S.sched.cancelAll();
  S.audio.stopAll();
  S.audio.setMaxVoices(S.previousCap);
  if (S.mount) S.mount.innerHTML = "";
  S = null;
}

export default {
  id: "pads",
  meta: { icon: "\uD83E\uDD41", title: "Drum Pads", tz: "\u6253\u64CA\u588A", blurb: "Finger drumming" },
  keyboard: false,
  bestKey: "pads",
  init: init,
  stop: stop
};
