/* Brain round host (implementation-guidelines.md §12.5; brain slice 34 task 7).
   State machine, active timer, progress, speech coordination, scene loading and
   finish. Scenes know nothing about Supabase, daily selection, stars or the
   outer app; they only ever see the frozen ctx/view/feedback objects below. */

import { createScheduler } from "../game-services/scheduler.js";
import { createMotion } from "../game-services/motion.js";
import { getSharedAudio } from "../game-services/audio.js";
import { SCENE_LOADERS } from "./scenes/index.js";
import genericScene from "./scenes/generic.js";

var activeRound = null;

function fmtClock(ms) {
  var s = Math.floor(ms / 1000), m = Math.floor(s / 60), r = s % 60;
  return m + ":" + (r < 10 ? "0" : "") + r;
}

function loadScene(gameId) {
  var loader = SCENE_LOADERS[gameId];
  if (!loader) return Promise.resolve(genericScene);
  return loader().then(function (mod) {
    var candidate = mod && mod.default;
    if (!candidate || typeof candidate.create !== "function") {
      throw new Error("scene contract violated: " + gameId);
    }
    return candidate;
  }).catch(function (err) {
    console.error("brain scene failed to load: " + gameId, err);
    return genericScene;
  });
}

function createRound(opts) {
  var D = window.SQBrainData, C = window.SQBrainCore;
  var gameId = opts.gameId, tier = opts.tier, kid = opts.kid;
  var game = D.GAMES[gameId];

  var scheduler = createScheduler();
  var motionSvc = createMotion(scheduler);
  var audioSvc = getSharedAudio({ isMuted: opts.isMuted, setMuted: opts.setMuted });
  var reducedMotion = motionSvc.reduced;

  var questionRnd = C.mulberry32(Date.now() >>> 0);
  var round = C.buildRound(gameId, tier, questionRnd);
  var visualRnd = C.mulberry32(C.dseed("brain-visual" + gameId + tier + Date.now()));

  var answers = [];
  var idx = 0;

  /* Resume a round abandoned mid-way (quit, reload, backgrounded tab) instead of
     making the kid redo every item. The saved items themselves are restored
     (not regenerated) so `answers` still lines up; only a shape mismatch —
     different tier, different item count — falls back to starting fresh. */
  var resume = opts.resume;
  if (resume && resume.gameId === gameId && resume.tier === tier &&
      Array.isArray(resume.items) && resume.items.length === round.items.length &&
      Number.isInteger(resume.idx) && resume.idx > 0 && resume.idx < round.items.length) {
    round.items = resume.items;
    idx = resume.idx;
    answers = resume.answers ? resume.answers.slice() : [];
  }
  var state = "loading";
  var destroyed = false;
  var finishedCalled = false;
  var sceneModule = null;
  var sceneInstance = null;
  var pendingSubmitAccepted = false;
  var activeMsAccum = resume && idx > 0 ? (resume.ms || 0) : 0;
  var activeStartedAt = 0;
  var clockCancel = null;
  var audioUnlockedOnce = false;

  /* Self-contained: renders into whatever mount the caller hands in (index.html
     passes the same #stage every arcade game uses, so the round sits in the
     same canvas area with the game list beside it) instead of an independent
     body-level modal. No mount ⇒ falls back to a full-screen dialog, which is
     also what the node tests exercise. */
  var mountEl = opts.mount || document.body;
  var contained = mountEl !== document.body;
  var overlay = document.createElement("div");
  overlay.className = "brain-round brain-round--" + gameId + (contained ? " brain-round--contained" : "");
  if (!contained) {
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
  }
  if (contained) mountEl.classList.add("arena");
  if (opts.kidColor) overlay.style.setProperty("--brain-round-kid", opts.kidColor);
  overlay.innerHTML =
    '<header class="brain-round__header">' +
      '<button class="brain-round__quit" type="button">Later <span class="zht">待會再玩</span></button>' +
      '<div class="brain-round__identity"></div>' +
      '<div class="brain-round__actions">' +
        '<button class="brain-round__script" type="button"></button>' +
        '<button class="brain-round__mute" type="button"></button>' +
      '</div>' +
    '</header>' +
    '<div class="brain-round__status">' +
      '<div class="brain-progress"></div>' +
      '<output class="brain-clock"></output>' +
    '</div>' +
    '<main class="brain-scene" aria-live="off"></main>' +
    '<div class="brain-announcer sr-only" aria-live="polite"></div>';
  mountEl.innerHTML = "";
  mountEl.appendChild(overlay);

  var quitBtn = overlay.querySelector(".brain-round__quit");
  var identityEl = overlay.querySelector(".brain-round__identity");
  var scriptBtn = overlay.querySelector(".brain-round__script");
  var muteBtn = overlay.querySelector(".brain-round__mute");
  var progressEl = overlay.querySelector(".brain-progress");
  var clockEl = overlay.querySelector(".brain-clock");
  var sceneMount = overlay.querySelector(".brain-scene");
  var announcerEl = overlay.querySelector(".brain-announcer");

  identityEl.innerHTML = (game.icon || "") + " " + game.title[0] + '<span class="zht">' + game.title[1] + "</span>";

  function renderMute() {
    var muted = opts.isMuted ? !!opts.isMuted() : false;
    muteBtn.textContent = muted ? "🔇" : "🔊";
    muteBtn.setAttribute("aria-label", muted ? "Sound off 靜音" : "Sound on 有聲音");
  }
  renderMute();
  function renderScriptMode() {
    var mode = opts.inputScript === "bpmf" ? "bpmf" : "abc";
    scriptBtn.textContent = mode === "bpmf" ? "ㄅㄆㄇ" : "ABC";
    scriptBtn.setAttribute("aria-label", mode === "bpmf" ? "Bopomofo mode 注音模式" : "ABC mode 英文模式");
  }
  renderScriptMode();

  function renderProgress() {
    var html = "";
    for (var i = 0; i < round.items.length; i++) {
      var cls = "brain-progress__pip";
      if (i < idx) cls += (answers[i] && answers[i].correct) ? " is-correct" : " is-corrective";
      else if (i === idx) cls += " is-current";
      else cls += " is-future";
      html += '<span class="' + cls + '"></span>';
    }
    progressEl.innerHTML = html;
    publishHud();
    progressEl.setAttribute("aria-label", "Question " + (idx + 1) + " of " + round.items.length + " 第 " + (idx + 1) + " 題，共 " + round.items.length + " 題");
  }

  function renderClock() {
    if (!round.clock) { clockEl.hidden = true; return; }
    clockEl.hidden = false;
    clockEl.innerHTML = '<span class="sr-only">Time 時間</span>' + fmtClock(liveMs());
    publishHud();
  }
  renderClock();

  function liveMs() {
    if (state === "active" && activeStartedAt) return activeMsAccum + (now() - activeStartedAt);
    return activeMsAccum;
  }

  function publishHud() {
    if (!opts.onHud) return;
    var score = answers.reduce(function (n, a) { return n + (a && a.correct ? 1 : 0); }, 0);
    opts.onHud([
      { k: "Time", v: round.clock ? fmtClock(liveMs()) : "--", c: opts.kidColor },
      { k: "Tasks", v: idx + "/" + round.items.length, c: opts.kidColor },
      { k: "Best", v: opts.best == null ? 0 : opts.best }
    ], { score: score, index: idx, total: round.items.length, clock: !!round.clock });
  }

  function announce(pair) {
    announcerEl.textContent = (pair && pair[0]) ? pair[0] + " " + (pair[1] || "") : "";
  }

  function unlockAudioOnce() {
    if (audioUnlockedOnce) return;
    audioUnlockedOnce = true;
    audioSvc.unlock();
  }
  overlay.addEventListener("pointerdown", unlockAudioOnce, { once: true, passive: true });
  overlay.addEventListener("keydown", unlockAudioOnce, { once: true });

  quitBtn.onclick = function () { destroy(true); if (opts.onQuit) opts.onQuit(); };
  muteBtn.onclick = function () {
    var muted = opts.isMuted ? !!opts.isMuted() : false;
    audioSvc.setMuted(!muted);
    renderMute();
  };
  scriptBtn.onclick = function () {
    if (!opts.onInputModeChange) return;
    opts.onInputModeChange(opts.inputScript === "bpmf" ? "abc" : "bpmf");
  };

  function startActiveClock() {
    if (!round.clock) return;
    activeStartedAt = now();
    clockCancel = scheduler.every(250, renderClock);
  }
  function stopActiveClock(commit) {
    if (clockCancel) { clockCancel(); clockCancel = null; }
    if (commit && activeStartedAt) activeMsAccum += now() - activeStartedAt;
    activeStartedAt = 0;
  }
  function now() { return typeof performance !== "undefined" ? performance.now() : Date.now(); }

  function onVisibilityChange() {
    if (typeof document === "undefined") return;
    if (document.hidden) {
      if (state === "active") stopActiveClock(true);
      scheduler.pause();
    } else {
      scheduler.resume();
      if (state === "active") startActiveClock();
    }
  }
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibilityChange);

  function sceneCtx() {
    return Object.freeze({
      mount: sceneMount,
      gameId: gameId,
      tier: tier,
      kid: kid,
      submit: submit,
      announce: announce,
      sayPair: function (pair) { if (opts.sayPair) opts.sayPair(pair); },
      audio: Object.freeze({ play: audioSvc.play, unlock: audioSvc.unlock }),
      motion: motionSvc,
      scheduler: scheduler,
      reducedMotion: reducedMotion,
      random: visualRnd,
      inputScript: opts.inputScript === "bpmf" ? "bpmf" : "abc",
      bopomofo: window.SQBopomofo || null
    });
  }

  function submit(answer) {
    if (state !== "active") return false;
    if (pendingSubmitAccepted) return false;
    pendingSubmitAccepted = true;
    evaluate(answer);
    return true;
  }

  function present() {
    if (destroyed) return Promise.resolve();
    state = "presenting";
    pendingSubmitAccepted = false;
    renderProgress();
    var item = round.items[idx];
    if (!sceneInstance) return Promise.resolve();
    var result;
    try {
      result = sceneInstance.present(item, {
        index: idx, count: round.items.length, isFirst: idx === 0, clocked: !!round.clock
      });
    } catch (err) {
      console.error("brain scene present() failed: " + gameId, err);
      return fallbackToGeneric();
    }
    var wait = (result && typeof result.then === "function") ? result : Promise.resolve();
    return wait.then(function () {
      if (destroyed) return;
      if (item.say && opts.say) opts.say(item.say);
      state = "active";
      if (sceneInstance.setInputEnabled) sceneInstance.setInputEnabled(true);
      startActiveClock();
    }).catch(function (err) {
      console.error("brain scene present() failed: " + gameId, err);
      return fallbackToGeneric();
    });
  }

  function fallbackToGeneric() {
    if (sceneModule === genericScene) { showRecoverable(); return Promise.resolve(); }
    try { if (sceneInstance && sceneInstance.destroy) sceneInstance.destroy(); } catch (e) {}
    sceneMount.innerHTML = "";
    sceneModule = genericScene;
    try {
      sceneInstance = genericScene.create(sceneCtx());
    } catch (e) {
      showRecoverable();
      return Promise.resolve();
    }
    return present();
  }

  function showRecoverable() {
    sceneMount.innerHTML =
      '<div class="brain-loading brain-loading--error">' +
      '<p>This game needs a fresh start.<br><span class="zhs">這個遊戲需要重新開始。</span></p>' +
      '<button class="btn" type="button">Back <span class="zht">返回</span></button></div>';
    var btn = sceneMount.querySelector("button");
    if (btn) btn.onclick = function () { destroy(true); };
  }

  function evaluate(given) {
    if (destroyed) return;
    state = "evaluating";
    if (sceneInstance && sceneInstance.setInputEnabled) sceneInstance.setInputEnabled(false);
    stopActiveClock(true);
    renderClock();
    var item = round.items[idx];
    var graded = C.gradeItem(item, given);
    answers[idx] = { given: given, got: graded.got, worth: graded.worth, correct: graded.correct };

    /* Math Recall's first "just remember it" item (worth 0) has no correct answer
       to grade against — the old UI advanced silently with no feedback overlay,
       and gradeItem's correct-only-if-worth>0 rule would otherwise mislabel it
       corrective (guidelines §12.4: "no false corrective language"). */
    if (graded.worth === 0) {
      renderProgress();
      transition();
      return;
    }

    var feedback = Object.freeze({
      correct: graded.correct, got: graded.got, worth: graded.worth, given: given, answer: item.answer
    });
    state = graded.correct ? "feedback-correct" : "feedback-corrective";
    renderProgress();
    if (graded.correct) audioSvc.play("success", {});
    runFeedback(feedback);
  }

  function runFeedback(feedback) {
    var settled = false;
    var result;
    try {
      result = sceneInstance && sceneInstance.showFeedback ? sceneInstance.showFeedback(feedback) : null;
    } catch (err) {
      console.error("brain scene showFeedback() failed: " + gameId, err);
      result = null;
    }
    var wait = (result && typeof result.then === "function") ? result : Promise.resolve();
    var cancelCap = null;
    var capped = new Promise(function (resolve) {
      cancelCap = scheduler.after(1200, function () { if (!settled) { settled = true; resolve(); } });
      wait.then(function () {
        if (settled) return;
        settled = true; if (cancelCap) cancelCap();
        resolve();
      }).catch(function () {
        if (settled) return;
        settled = true; if (cancelCap) cancelCap();
        resolve();
      });
    });
    capped.then(function () { if (!destroyed) transition(); });
  }

  function saveProgress() {
    if (!opts.onProgress) return;
    opts.onProgress({ gameId: gameId, tier: tier, idx: idx, items: round.items, answers: answers, ms: activeMsAccum });
  }

  function transition() {
    if (destroyed) return;
    state = "transitioning";
    idx++;
    if (idx >= round.items.length) { complete(); return; }
    saveProgress();
    present();
  }

  function complete() {
    if (destroyed) return;
    state = "completing";
    var ms = round.clock ? activeMsAccum : 0;
    var res = C.scoreRound({
      items: round.items,
      answers: answers.map(function (a) { return a ? a.given : ""; }),
      ms: ms, clock: round.clock
    });
    if (opts.onProgress) opts.onProgress(null);
    audioSvc.play("round-complete", {});
    finish(Object.assign({ gameId: gameId, tier: tier }, res));
  }

  function finish(res) {
    if (finishedCalled) return;
    finishedCalled = true;
    destroy(false);
    if (opts.onFinish) opts.onFinish(res);
  }

  function destroy(isQuit) {
    if (destroyed) return;
    destroyed = true;
    state = "destroyed";
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibilityChange);
    try { if (sceneInstance && sceneInstance.destroy) sceneInstance.destroy(); } catch (e) { console.error(e); }
    sceneInstance = null;
    scheduler.cancelAll();
    motionSvc.dispose();
    audioSvc.stopAll();
    try { if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); } catch (e) {}
    if (overlay.parentNode) overlay.remove();
    if (activeRound === handle) activeRound = null;
    void isQuit; /* quit never calls onFinish; finish() already handled the non-quit path */
  }

  function start() {
    state = "loading";
    sceneMount.innerHTML = '<div class="brain-loading"><span></span><span></span><span></span></div>';
    return loadScene(gameId).then(function (mod) {
      sceneModule = mod;
      if (destroyed) return;
      try {
        sceneInstance = sceneModule.create(sceneCtx());
      } catch (err) {
        console.error("brain scene create() failed: " + gameId, err);
        return fallbackToGeneric();
      }
      return present();
    });
  }

  var handle = {
    start: start,
    destroy: destroy,
    debugState: function () { return state; },
    debugScheduler: function () { return scheduler; },
    debugItemIndex: function () { return idx; },
    debugActiveMs: function () { return activeMsAccum; },
    debugOverlay: function () { return overlay; }
  };
  return handle;
}

export function openRound(opts) {
  var previous = activeRound;
  activeRound = null;
  if (previous) previous.destroy(true);
  var round = createRound(opts);
  activeRound = round;
  round.start();
  return round;
}

export function closeActive() {
  if (!activeRound) return;
  var round = activeRound;
  activeRound = null;
  round.destroy(true);
}

export function fmtMs(ms) { return fmtClock(ms); }

/* Tests only. */
export function resetActiveRoundForTest() { activeRound = null; }
