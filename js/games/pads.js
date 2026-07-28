import { getSharedAudio } from "../game-services/audio.js";
import { createScheduler } from "../game-services/scheduler.js";
import { createTransport, judge, offset, rotateGuard } from "../game-services/music.js";
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

  S = {
    ctx: ctx, audio: audio, sched: sched, mount: mount,
    activePointers: activePointers, padElements: padElements,
    mode: "play", _onVisibility: null, _trainerState: null
  };

  /* Root */
  var root = document.createElement("div");
  root.style.cssText = "display:flex;flex-direction:column;height:100%;width:100%;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;";

  /* Mode bar */
  var modeBar = document.createElement("div");
  modeBar.style.cssText = "flex:none;display:flex;align-items:center;gap:8px;padding:4px 10px;border-bottom:1px solid #3A3850;";

  var btnPlay = document.createElement("button");
  btnPlay.textContent = "\uD83E\uDD41 Play";
  btnPlay.style.cssText = "background:#5AD1C4;border:2px solid #5AD1C4;color:#14131A;border-radius:10px;padding:6px 14px;font-size:13px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;font-weight:600;min-width:44px;min-height:36px;";

  var btnPractice = document.createElement("button");
  btnPractice.textContent = "\uD83C\uDFAF \u7DF4\u7FD2";
  btnPractice.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;color:#F4F2FA;border-radius:10px;padding:6px 14px;font-size:13px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;font-weight:600;min-width:44px;min-height:36px;";

  var kitLabel = document.createElement("span");
  kitLabel.style.cssText = "font-family:Fredoka,Nunito,system-ui;font-size:11px;font-weight:600;color:#9A96B4;margin-left:auto;";
  kitLabel.textContent = "Loading...";
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
      ".sq-pad-lane0{border-left:4px solid #FF7A45}" +
      ".sq-pad-lane1{border-left:4px solid #5AD1C4}" +
      ".sq-pad-lane2{border-left:4px solid #FFB13C}" +
      ".sq-pad-lane3{border-left:4px solid #B98CFF}";
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
        "<span style='font-family:Fredoka,Nunito,system-ui;font-weight:600;font-size:10px;color:" + color + ";line-height:1.05;'>" +
        label.en + "</span>" +
        "<span style='font-size:9px;color:#9A96B4;line-height:1.05;'>" + label.tz + "</span>";
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
    if (entry.padEl) {
      entry.padEl.classList.remove("sq-pad-active");
      try {
        if (entry.padEl.releasePointerCapture) entry.padEl.releasePointerCapture(pointerId);
      } catch (e) {}
    }
    activePointers.delete(pointerId);
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
  CHARTS.forEach(function (ch) {
    var row = document.createElement("button");
    row.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;border-radius:11px;padding:10px;cursor:pointer;color:#F4F2FA;text-align:left;min-height:44px;";
    row.innerHTML = "<span style='font-family:Fredoka,Nunito,system-ui;font-size:14px;font-weight:600;'>" + ch.name.en + " <span style='color:#9A96B4;font-size:12px;'>" + ch.name.tz + "</span></span>" +
      "<span style='display:block;font-size:10px;color:#9A96B4;'>Tier " + ch.tier + " \u30FB " + ch.bpm + " bpm</span>";
    row.addEventListener("pointerdown", function () {
      audio.unlock();
      startTrainer(ch);
    });
    drillList.appendChild(row);
  });
  practiceView.appendChild(drillList);

  /* Trainer runner view */
  var trainerView = document.createElement("div");
  trainerView.style.cssText = "position:absolute;inset:0;display:none;flex-direction:column;overflow:hidden;";
  practiceView.appendChild(trainerView);

  /* Trainer: note track */
  var trackArea = document.createElement("div");
  trackArea.style.cssText = "flex:1;min-height:0;position:relative;overflow:hidden;";
  trainerView.appendChild(trackArea);

  /* Trainer: pad grid (smaller, 1 row of 4) */
  var trainerGrid = document.createElement("div");
  trainerGrid.style.cssText = "flex:none;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:6px;height:100px;";
  trainerView.appendChild(trainerGrid);

  buildTrainerPads(trainerGrid);

  /* Trainer controls */
  var trainBar = document.createElement("div");
  trainBar.style.cssText = "flex:none;display:flex;align-items:center;gap:6px;padding:6px 10px;border-top:1px solid #3A3850;flex-wrap:wrap;";

  var trainName = document.createElement("span");
  trainName.style.cssText = "font-family:Fredoka,Nunito,system-ui;font-size:13px;font-weight:600;color:#F4F2FA;min-width:80px;";
  trainBar.appendChild(trainName);

  var pauseBtn = document.createElement("button");
  pauseBtn.textContent = "\u25B6\uFE0F";
  pauseBtn.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;color:#5AD1C4;border-radius:10px;padding:6px 14px;font-size:16px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;min-width:44px;min-height:44px;";
  trainBar.appendChild(pauseBtn);

  var restartBtn = document.createElement("button");
  restartBtn.textContent = "\u21BA";
  restartBtn.style.cssText = "background:#2F2E3D;border:2px solid #3A3850;color:#F4F2FA;border-radius:10px;padding:6px 12px;font-size:16px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;min-width:44px;min-height:44px;";
  trainBar.appendChild(restartBtn);

  var backBtn = document.createElement("button");
  backBtn.textContent = "\u2190 \u8FD4\u56DE";
  backBtn.style.cssText = "background:transparent;border:2px solid #3A3850;color:#9A96B4;border-radius:10px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:Fredoka,Nunito,system-ui;min-width:44px;min-height:32px;";
  trainBar.appendChild(backBtn);

  /* Score display */
  var scoreLabel = document.createElement("span");
  scoreLabel.style.cssText = "font-family:Fredoka,Nunito,system-ui;font-size:12px;font-weight:600;color:#FFB13C;margin-left:auto;";
  trainBar.appendChild(scoreLabel);

  /* Feedback (aria-live) */
  var feedbackEl = document.createElement("div");
  feedbackEl.setAttribute("aria-live", "polite");
  feedbackEl.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:Fredoka,Nunito,system-ui;font-size:28px;font-weight:700;pointer-events:none;z-index:10;text-shadow:0 0 8px rgba(0,0,0,0.8);transition:opacity 0.3s;opacity:0;";
  trackArea.appendChild(feedbackEl);

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

  function startTrainerFixed(chart) {
    audio.unlock();
    stopTrainer();
    drillList.style.display = "none";
    trainerView.style.display = "flex";
    trainName.textContent = chart.name.en + " / " + chart.name.tz;

    var backingNotes = collectBackingNotes(chart);
    var tChart = {
      bpm: chart.bpm,
      bars: chart.bars,
      lanes: chart.lanes.slice(),
      notes: backingNotes.map(function (n) {
        return { beat: n.beat, lane: n.lane, sample: chart.lanes[n.lane] };
      })
    };

    var clock = {
      get now() { return audio.clock().now; },
      get outputLatency() { return audio.clock().outputLatency; },
      get sampleRate() { return audio.clock().sampleRate; }
    };

    var transport = createTransport({
      clock: clock,
      playNote: function (note, absoluteTime) {
        if (!note.sample) return;
        var gain = kitMeta && kitMeta[note.sample] ? kitMeta[note.sample].gain : 1;
        audio.playSample("mpc", note.sample, { when: absoluteTime - clock.now, gain: gain });
      },
      sched: sched
    });

    trainState = {
      chart: chart,
      transport: transport,
      judgeState: chart.notes.map(function (n) {
        return { beat: n.beat, lane: n.lane, judged: false };
      }),
      tally: { perfect: 0, good: 0, ok: 0, miss: 0 },
      started: false,
      finished: false,
      noteEls: [],
      countInCancel: null,
      feedbackCancel: null,
      paintCancel: null,
      onPadTap: null,
      tChart: tChart
    };

    function renderScore() {
      var score = trainState.tally.perfect * 100 + trainState.tally.good * 70 + trainState.tally.ok * 40;
      scoreLabel.textContent = score + " \u2606 " +
        trainState.tally.perfect + "P " + trainState.tally.good + "G " + trainState.tally.ok + "O " + trainState.tally.miss + "M";
    }

    function showFeedback(text, instant) {
      if (!trainState) return;
      if (trainState.feedbackCancel) trainState.feedbackCancel();
      feedbackEl.textContent = text;
      feedbackEl.style.opacity = "1";
      feedbackEl.style.transition = instant ? "none" : "opacity 0.1s";
      trainState.feedbackCancel = sched.after(instant ? 600 : 800, function () {
        feedbackEl.style.opacity = "0";
        trainState.feedbackCancel = null;
      });
    }

    function buildNoteEls() {
      trainState.noteEls.forEach(function (el) {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
      trainState.noteEls = [];

      backingNotes.forEach(function (n) {
        var el = document.createElement("div");
        el.style.cssText = "position:absolute;height:25%;border-radius:4px;opacity:0.38;background:" + (LANE_COLORS[n.lane] || "#666") + ";";
        el.style.top = (n.lane * 25) + "%";
        el.style.width = "30px";
        el.dataset.beat = String(n.beat);
        el.dataset.lane = String(n.lane);
        el.dataset.type = "backing";
        trackArea.appendChild(el);
        trainState.noteEls.push(el);
      });

      chart.notes.forEach(function (n, idx) {
        var el = document.createElement("div");
        el.style.cssText = "position:absolute;height:25%;border-radius:4px;background:" + (LANE_COLORS[n.lane] || "#666") + ";";
        el.style.top = (n.lane * 25) + "%";
        el.style.width = "30px";
        el.dataset.beat = String(n.beat);
        el.dataset.lane = String(n.lane);
        el.dataset.type = "kid";
        el.dataset.judgeIdx = String(idx);
        trackArea.appendChild(el);
        trainState.noteEls.push(el);
      });
    }

    function allKidNotesJudged() {
      return trainState.judgeState.every(function (js) { return js.judged; });
    }

    function finishExercise() {
      if (!trainState || trainState.finished) return;
      trainState.finished = true;
      trainState.started = false;
      if (trainState.countInCancel) { trainState.countInCancel(); trainState.countInCancel = null; }
      if (trainState.transport) trainState.transport.stop();
      var score = trainState.tally.perfect * 100 + trainState.tally.good * 70 + trainState.tally.ok * 40;
      if (score < 0) score = 0;
      scoreLabel.textContent = "Done! / \u5B8C\u6210\uFF01 " + score + " \u2606";
      showFeedback(trainState.tally.perfect === trainState.judgeState.length
        ? "ALL PERFECT! \u5168\u90E8\u5B8C\u7F8E\uFF01"
        : "Great job! / \u505A\u5F97\u597D\uFF01", false);
      ctx.finish({ score: score });
    }

    function paintNotes() {
      if (!trainState || !trainState.started || trainState.finished) return;
      var w = trackArea.clientWidth;
      if (!w) return;
      var hitX = w * 0.18;
      var pxPerBeat = w / 4;
      var secondsPerBeat = 60 / trainState.chart.bpm;
      trainState.noteEls.forEach(function (el) {
        var beat = parseFloat(el.dataset.beat);
        var noteTime = trainState.transport.beatToTime(beat);
        var x = hitX + ((noteTime - clock.now) / secondsPerBeat) * pxPerBeat;
        el.style.left = x + "px";
        el.style.width = "28px";
        el.style.opacity = el.dataset.type === "kid" ? "1" : "0.3";
        if (el.dataset.type !== "kid") return;
        var js = trainState.judgeState[Number(el.dataset.judgeIdx)];
        if (!js || js.judged) return;
        if (x < hitX - 20) {
          js.judged = true;
          trainState.tally.miss++;
          renderScore();
          showFeedback("Almost! / \u5DEE\u4E00\u9EDE\uFF01", false);
          if (allKidNotesJudged()) finishExercise();
        }
      });
    }

    function onPadTap(sampleName) {
      if (!trainState || !trainState.started || trainState.finished) return;
      var laneIdx = TRAINER_SAMPLES.indexOf(sampleName);
      if (laneIdx < 0) return;

      var nowTime = clock.now;
      var bestIdx = -1;
      var bestTime = 0;
      var bestDiff = Infinity;

      for (var i = 0; i < trainState.judgeState.length; i++) {
        var js = trainState.judgeState[i];
        if (js.lane !== laneIdx || js.judged) continue;
        var noteTime = trainState.transport.beatToTime(js.beat);
        var diff = Math.abs(nowTime - noteTime);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
          bestTime = noteTime;
        }
      }

      if (bestIdx < 0) return;

      var result = judge(nowTime, bestTime, offset(), trainState.judgeState);
      trainState.judgeState[bestIdx].judged = true;
      trainState.tally[result]++;
      renderScore();

      if (result === "perfect") showFeedback("\u2606 Perfect! / \u592A\u68D2\u4E86\uFF01", true);
      else if (result === "good") showFeedback("Good / \u597D", true);
      else showFeedback("Almost! / \u5DEE\u4E00\u9EDE\uFF01", true);

      if (allKidNotesJudged()) finishExercise();
    }

    function startCountIn() {
      var beatDur = 60 / chart.bpm;
      var startAt = clock.now + 0.5;
      var beatCount = 0;
      if (trainState.countInCancel) trainState.countInCancel();
      trainState.countInCancel = sched.every(25, function () {
        var nowTime = clock.now;
        while (beatCount < 4 && nowTime >= startAt + beatCount * beatDur) {
          audio.play("ui-tap", { volume: 0.3 });
          showFeedback(String(4 - beatCount), true);
          beatCount++;
        }
        if (beatCount >= 4) {
          if (trainState.countInCancel) { trainState.countInCancel(); trainState.countInCancel = null; }
          trainState.started = true;
          pauseBtn.textContent = "\u23F8\uFE0F";
          trainState.transport.start(tChart, 0);
          showFeedback("Go! / \u958B\u59CB\uFF01", true);
        }
      });
    }

    function startSequence() {
      if (trainState.countInCancel) { trainState.countInCancel(); trainState.countInCancel = null; }
      if (trainState.feedbackCancel) { trainState.feedbackCancel(); trainState.feedbackCancel = null; }
      if (trainState.transport) trainState.transport.stop();
      trainState.judgeState.forEach(function (js) { js.judged = false; });
      trainState.tally = { perfect: 0, good: 0, ok: 0, miss: 0 };
      trainState.finished = false;
      trainState.started = false;
      scoreLabel.textContent = "";
      feedbackEl.style.opacity = "0";
      buildNoteEls();
      pauseBtn.textContent = "\u25B6\uFE0F";
      startCountIn();
    }

    if (!trainState.paintCancel) {
      trainState.paintCancel = sched.frame(function () {
        paintNotes();
      });
    }

    pauseBtn.onpointerdown = function () {
      if (!trainState.started) { startSequence(); return; }
      if (trainState.finished) { startSequence(); return; }
      if (trainState.transport.running) {
        trainState.transport.pause();
        pauseBtn.textContent = "\u25B6\uFE0F";
      } else {
        trainState.transport.resume();
        pauseBtn.textContent = "\u23F8\uFE0F";
      }
    };

    restartBtn.onpointerdown = function () {
      startSequence();
    };

    backBtn.onpointerdown = function () {
      stopTrainer();
    };

    trainState.onPadTap = onPadTap;
    startSequence();
  }

  function startTrainer(chart) {
    return startTrainerFixed(chart);
    stopTrainer();
    drillList.style.display = "none";
    trainerView.style.display = "flex";
    trainName.textContent = chart.name.en;

    /* Build composite: this chart's backing notes feed the transport for audio.
       The kid's notes (chart.notes) are visual targets. */
    var backingNotes = [];
    if (chart.backing) {
      var backingChart = CHARTS.find(function (c) { return c.id === chart.backing; });
      if (backingChart) {
        /* Collect backing chain: all previous exercise notes recursively */
        var chain = [];
        var cur = chart;
        while (cur && cur.backing) {
          cur = CHARTS.find(function (c) { return c.id === cur.backing; });
          if (cur && cur.notes) {
            cur.notes.forEach(function (n) { chain.push(n); });
          }
        }
        backingNotes = chain;
      }
    }

    /* Build transport chart from backing notes */
    var tChart = {
      bpm: chart.bpm,
      bars: chart.bars,
      lanes: chart.lanes,
      notes: backingNotes.map(function (n) { return { beat: n.beat, lane: n.lane, sample: chart.lanes[n.lane] }; })
    };

    /* Judge state: track which kid notes have been judged */
    var judgeState = chart.notes.map(function (n) {
      return { beat: n.beat, lane: n.lane, judged: false };
    });

    var tally = { perfect: 0, good: 0, ok: 0, miss: 0 };
    var started = false;
    var finished = false;
    var noteEls = [];
    var lastFeedback = "";
    var feedbackTimer = null;

    /* Clock for transport */
    var clock = {
      get now() { return audio.clock().now; },
      get outputLatency() { return audio.clock().outputLatency; },
      get sampleRate() { return audio.clock().sampleRate; }
    };

    var transport = createTransport({
      clock: clock,
      playNote: function (note, absoluteTime) {
        if (!note.sample) return;
        var gain = kitMeta && kitMeta[note.sample] ? kitMeta[note.sample].gain : 1;
        audio.playSample("mpc", note.sample, { when: absoluteTime - clock.now, gain: gain });
      },
      sched: sched
    });

    /* Build visual notes — backing notes are dim, kid notes are full */
    function buildNoteEls() {
      noteEls.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
      noteEls = [];

      /* Backing notes (dim) */
      backingNotes.forEach(function (n) {
        var el = document.createElement("div");
        el.style.cssText = "position:absolute;height:25%;border-radius:4px;opacity:0.4;background:" + (LANE_COLORS[n.lane] || "#666") + ";";
        el.style.top = (n.lane * 25) + "%";
        el.style.width = "30px";
        el.dataset.beat = n.beat;
        el.dataset.lane = n.lane;
        el.dataset.type = "backing";
        trackArea.appendChild(el);
        noteEls.push(el);
      });

      /* Kid notes (bright) */
      chart.notes.forEach(function (n) {
        var el = document.createElement("div");
        el.style.cssText = "position:absolute;height:25%;border-radius:4px;background:" + (LANE_COLORS[n.lane] || "#666") + ";";
        el.style.top = (n.lane * 25) + "%";
        el.style.width = "30px";
        el.dataset.beat = n.beat;
        el.dataset.lane = n.lane;
        el.dataset.type = "kid";
        trackArea.appendChild(el);
        noteEls.push(el);
      });
    }

    /* Count-in */
    function countIn(cb) {
      var count = 0;
      var beatsToGo = 4;
      var beatDur = 60 / chart.bpm;
      var start = audio.clock().now + 0.5;
      var timer = setInterval(function () {
        var nowTime = audio.clock().now;
        var idx = Math.floor((nowTime - start) / beatDur);
        if (idx >= 0 && idx > count) {
          count = idx;
          audio.play("ui-tap", { volume: 0.3 });
          showFeedback(count === 4 ? "Go! \u958B\u59CB\uFF01" : String(4 - count), true);
        }
        if (nowTime >= start + beatsToGo * beatDur) {
          clearInterval(timer);
          cb();
        }
      }, 25);
    }

    function showFeedback(text, instant) {
      if (feedbackTimer) clearTimeout(feedbackTimer);
      feedbackEl.textContent = text;
      feedbackEl.style.opacity = "1";
      feedbackEl.style.transition = instant ? "none" : "opacity 0.1s";
      lastFeedback = text;
      feedbackTimer = setTimeout(function () {
        feedbackEl.style.opacity = "0";
      }, instant ? 600 : 800);
    }

    function paintNotes() {
      if (!trainState || trainState.finished) return;
      var w = trackArea.clientWidth;
      var hitX = w * 0.18;
      var pxPerSec = w * chart.bpm / 60 / 4; /* pixels per quarter note */
      noteEls.forEach(function (el) {
        var beat = parseFloat(el.dataset.beat);
        var noteTime = transport.beatToTime(beat);
        var x = hitX + (noteTime - clock.now) * (w / 4) * (60 / chart.bpm) * 4;
        /* Alternative: x = hitX + (noteTime - clock.now) * pxPerBeat where pxPerBeat = w/4 */
        var pxPerBeat = w / 4;
        x = hitX + (noteTime - clock.now) * pxPerBeat / (60 / chart.bpm);
        if (el.dataset.type === "kid") {
          el.style.opacity = "1";
        } else {
          el.style.opacity = "0.3";
        }
        /* If note has passed the hit line and is a kid note, auto-miss */
        if (el.dataset.type === "kid" && x < hitX - 20) {
          el.style.opacity = "0";
        }
        el.style.left = x + "px";
        el.style.width = "28px";
      });
    }

    function onPadTap(sampleName) {
      if (!trainState || !started || finished) return;
      /* Only the trainer's 4 lanes count */
      var laneIdx = chart.lanes.indexOf(sampleName);
      if (laneIdx < 0) return;

      var nowTime = clock.now;

      /* Find nearest unjudged note in this lane */
      var best = null;
      var bestDiff = Infinity;
      for (var i = 0; i < judgeState.length; i++) {
        var js = judgeState[i];
        if (js.lane !== laneIdx || js.judged) continue;
        var noteTime = transport.beatToTime(js.beat);
        var diff = Math.abs(nowTime - noteTime);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = { js: js, idx: i, noteTime: noteTime };
        }
      }

      if (!best) return;

      /* Judge against the nearest */
      var result = judge(nowTime, best.noteTime, 0, []);
      judgeState[best.idx].judged = true;

      /* Count */
      if (result === "miss") result = diffIsOk(bestDiff) ? "ok" : "miss";
      /* Actually, re-judge with our own windows since the judge function signature
         doesn't work as we expect. Let me just compute directly. */
      /* Override: compute the actual diff */
      var absMs = Math.abs(nowTime - best.noteTime) * 1000;
      var actualResult;
      if (absMs <= 50) actualResult = "perfect";
      else if (absMs <= 100) actualResult = "good";
      else if (absMs <= 180) actualResult = "ok";
      else actualResult = "miss";

      tally[actualResult]++;
      judgeState[best.idx].judged = true;

      /* Show feedback word */
      var fbText = "";
      if (actualResult === "perfect") fbText = "\u2606 Perfect! / \u592A\u68D2\u4E86\uFF01";
      else if (actualResult === "good") fbText = "Good / \u597D";
      else if (actualResult === "ok") fbText = "Almost! / \u5DEE\u4E00\u9EDE\uFF01";
      else fbText = "Miss / \u518D\u8A66\u4E00\u6B21";
      showFeedback(fbText, true);

      scoreLabel.textContent =
        (tally.perfect * 100 + tally.good * 70 + tally.ok * 40) + " \u2606 " +
        tally.perfect + "P " + tally.good + "G " + tally.ok + "O " + tally.miss + "M";

      /* Check if all notes are judged */
      var allJudged = judgeState.every(function (js) { return js.judged; });
      if (allJudged && !finished && started) {
        finishExercise();
      }
    }

    function finishExercise() {
      if (finished) return;
      finished = true;
      transport.stop();
      var score = tally.perfect * 100 + tally.good * 70 + tally.ok * 40;
      if (score < 0) score = 0;
      scoreLabel.textContent = "Done! / \u5B8C\u6210\uFF01 " + score + " \u2606";

      var msg = "Great job! / \u505A\u5F97\u597D\uFF01";
      if (tally.perfect === judgeState.length) msg = "ALL PERFECT! \u5168\u90E8\u5B8C\u7F8E\uFF01";
      showFeedback(msg, false);

      /* Score through ctx.finish — the host writes the ledger */
      ctx.finish({ score: score });
    }

    function startSequence() {
      judgeState.forEach(function (js) { js.judged = false; });
      tally = { perfect: 0, good: 0, ok: 0, miss: 0 };
      finished = false;
      scoreLabel.textContent = "";
      buildNoteEls();
      transport.start(tChart);
      countIn(function () {
        started = true;
        transport.start(tChart);
      });
    }

    /* Paint loop */
    var paintRaf = null;
    function paintLoop() {
      paintNotes();
      paintRaf = requestAnimationFrame(paintLoop);
    }

    /* Controls */
    pauseBtn.onpointerdown = function () {
      if (!started) { startSequence(); pauseBtn.textContent = "\u23F8\uFE0F"; return; }
      if (finished) { startSequence(); pauseBtn.textContent = "\u23F8\uFE0F"; return; }
      /* pause/resume toggle */
      if (transport.running) {
        transport.pause();
        pauseBtn.textContent = "\u25B6\uFE0F";
      } else {
        transport.resume();
        pauseBtn.textContent = "\u23F8\uFE0F";
      }
    };

    restartBtn.onpointerdown = function () {
      transport.stop();
      startSequence();
      pauseBtn.textContent = "\u23F8\uFE0F";
    };

    backBtn.onpointerdown = function () {
      stopTrainer();
    };

    startSequence();
    paintLoop();
    pauseBtn.textContent = "\u23F8\uFE0F";

    trainState = {
      chart: chart,
      transport: transport,
      judgeState: judgeState,
      tally: tally,
      started: started,
      finished: finished,
      noteEls: noteEls,
      paintRaf: paintRaf,
      onPadTap: onPadTap
    };
  }

  function stopTrainer() {
    if (trainState) {
      clearPointers();
      if (trainState.countInCancel) { trainState.countInCancel(); trainState.countInCancel = null; }
      if (trainState.feedbackCancel) { trainState.feedbackCancel(); trainState.feedbackCancel = null; }
      if (trainState.transport) trainState.transport.stop();
      if (trainState.paintCancel) { trainState.paintCancel(); trainState.paintCancel = null; }
      if (trainState.noteEls) {
        trainState.noteEls.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
      }
      trainState = null;
    }
    feedbackEl.style.opacity = "0";
    scoreLabel.textContent = "";
    trainerView.style.display = "none";
    drillList.style.display = "";
  }

  /* Trainer pad taps */
  function buildTrainerPads(container) {
    /* 4 trainer pads matching chart lanes: kick, snare, hat-closed, clap */
    TRAINER_SAMPLES.forEach(function (sn, idx) {
      var btn = document.createElement("button");
      btn.setAttribute("role", "button");
      btn.className = "sq-pad sq-pad-lane" + idx;
      btn.style.cssText = "background:#2A2838;border:2px solid #3A3850;border-radius:10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px;min-width:0;min-height:0;outline:none;";
      btn.dataset.sample = sn;
      setPadLabel(btn, sn, idx, true);

      btn.addEventListener("pointerdown", function (e) {
        audio.unlock();
        if (!kitLoaded) return;
        var sn2 = this.dataset.sample;
        var gain = kitMeta && kitMeta[sn2] ? kitMeta[sn2].gain : 1;
        audio.playSample("mpc", sn2, { gain: gain });
        this.classList.add("sq-pad-active");
        activePointers.set(e.pointerId, { padEl: this, sampleName: sn2 });
        if (trainState && trainState.onPadTap) trainState.onPadTap(sn2);
        this.setPointerCapture(e.pointerId);
      });
      btn.addEventListener("pointerup", function (e) { releasePointer(e.pointerId); });
      btn.addEventListener("pointercancel", function (e) { releasePointer(e.pointerId); });

      container.appendChild(btn);
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
      drillList.style.display = "";
      trainerView.style.display = "none";
    }
  }

  btnPlay.addEventListener("pointerdown", function () { setMode("play"); });
  btnPractice.addEventListener("pointerdown", function () { setMode("practice"); });

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
        kitLabel.textContent = "808 Kit";
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
      .catch(function () { kitLabel.textContent = "Offline / \u96E2\u7DDA"; });
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
}

function stop() {
  if (!S) return;
  document.removeEventListener("visibilitychange", S._onVisibility);
  clearPointers();
  if (trainState) stopTrainer();
  if (S.padElements) S.padElements.forEach(function (el) { el.classList.remove("sq-pad-active"); });
  S.sched.cancelAll();
  S.audio.stopAll();
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
