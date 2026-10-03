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

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character];
  });
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
  var round = C.buildRound(gameId, tier, questionRnd, null, { mathSkill: opts.mathSkill || "" });
  if (Number.isFinite(Number(opts.itemLimit)) && Number(opts.itemLimit) > 0) {
    round.items = round.items.slice(0, Math.max(1, Math.round(Number(opts.itemLimit))));
  }
  var visualRnd = C.mulberry32(C.dseed("brain-visual" + gameId + tier + Date.now()));

  var answers = [];
  var idx = 0;

  /* Resume a round abandoned mid-way (quit, reload, backgrounded tab) instead of
     making the kid redo every item. The saved items themselves are restored
     (not regenerated) so `answers` still lines up; only a shape mismatch —
     different tier, different item count — falls back to starting fresh. */
  var resume = opts.resume;
  var restored = false;
  if (resume && resume.gameId === gameId && resume.tier === tier &&
      (!opts.mathSkill || resume.mathSkill === opts.mathSkill) &&
      Array.isArray(resume.items) && resume.items.length === round.items.length &&
      (gameId !== 'crunch' || resume.items.every(function (item) { return item && item.prompt && item.prompt.type === 'numberbonds'; })) &&
      Number.isInteger(resume.idx) && resume.idx >= 0 && resume.idx < round.items.length) {
    round.items = resume.items;
    idx = resume.idx;
    answers = resume.answers ? resume.answers.slice() : [];
    restored = true;
  }
  var state = "loading";
  var destroyed = false;
  var finishedCalled = false;
  var sceneModule = null;
  var sceneInstance = null;
  var pendingSubmitAccepted = false;
  var activeMsAccum = restored ? (resume.ms || 0) : 0;
  var activeStartedAt = 0;
  var clockCancel = null;
  var audioUnlockedOnce = false;
  var attemptStartedAt = 0;
  var guidedRetry = false;
  var guidedRetryMeta = null;
  var activeLearningIntervention = null;
  var learningAttemptRecorded = false;

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
      '<span class="brain-round__feedback" aria-live="polite"></span>' +
      '<output class="brain-clock"></output>' +
    '</div>' +
    '<div class="brain-lesson" hidden><div class="brain-lesson__topic"></div><button class="brain-button" type="button" data-lesson-clue>Clue<span class="zhs">小提示</span></button></div>' +
    '<main class="brain-scene" aria-live="off"></main>' +
    '<section class="brain-learning-support" hidden aria-live="polite"></section>' +
    '<div class="brain-announcer sr-only" aria-live="polite"></div>';
  mountEl.innerHTML = "";
  mountEl.appendChild(overlay);

  var quitBtn = overlay.querySelector(".brain-round__quit");
  var identityEl = overlay.querySelector(".brain-round__identity");
  var scriptBtn = overlay.querySelector(".brain-round__script");
  var muteBtn = overlay.querySelector(".brain-round__mute");
  var progressEl = overlay.querySelector(".brain-progress");
  var clockEl = overlay.querySelector(".brain-clock");
  var feedbackEl = overlay.querySelector('.brain-round__feedback');
  var sceneMount = overlay.querySelector(".brain-scene");
  var supportEl = overlay.querySelector(".brain-learning-support");
  var announcerEl = overlay.querySelector(".brain-announcer");
  var lessonEl = overlay.querySelector('.brain-lesson');
  var clueBtn = overlay.querySelector('[data-lesson-clue]');
  var lessonHintUsed = false;

  function renderLesson() {
    var lesson = round.items[idx].lesson;
    lessonEl.hidden = !lesson;
    clueBtn.disabled = true;
    if (!lesson) return;
    lessonEl.querySelector('.brain-lesson__topic').innerHTML = escapeHtml(lesson.topic[0]) + '<span class="zhs">' + escapeHtml(lesson.topic[1]) + '</span>';
  }
  function lessonCopy(pair) {
    return '<div class="brain-learning-support__copy"><b>' + escapeHtml(pair[0]) + '</b><span>' + escapeHtml(pair[1]) + '</span></div>';
  }
  clueBtn.onclick = function () {
    if (state !== 'active' || destroyed || !round.items[idx].lesson) return;
    lessonHintUsed = true;
    stopActiveClock(true);
    state = 'lesson-clue';
    scheduler.pause();
    if (sceneInstance.setInputEnabled) sceneInstance.setInputEnabled(false);
    clueBtn.disabled = true;
    supportEl.hidden = false;
    supportEl.innerHTML = lessonCopy(round.items[idx].lesson.hint) + '<div class="brain-learning-support__actions"><button type="button" data-learning-action="resume"><b>Back to exercise</b><span>回到練習</span></button></div>';
    var resume = supportEl.querySelector('[data-learning-action="resume"]');
    resume.onclick = function () {
      if (destroyed || state !== 'lesson-clue') return;
      hideLearningSupport();
      state = 'active';
      if (!document.hidden) scheduler.resume();
      if (sceneInstance.setInputEnabled) sceneInstance.setInputEnabled(true);
      clueBtn.disabled = false;
      if (!guidedRetry) startActiveClock();
      clueBtn.focus({ preventScroll: true });
    };
    resume.focus({ preventScroll: true });
  };
  function showLessonReview(meta) {
    if (destroyed) return;
    state = 'lesson-review';
    clueBtn.disabled = true;
    notifyLearningAttempt(meta, lessonHintUsed ? 1 : 0);
    supportEl.hidden = false;
    supportEl.innerHTML = '<h3>Let’s work it out<span class="zhs">一起看懂</span></h3>' + lessonCopy(round.items[idx].lesson.explanation) +
      '<div class="brain-learning-support__actions"><button type="button" data-learning-action="retry"><b>Practise again</b><span>再練一次</span></button><button type="button" data-learning-action="next"><b>Next</b><span>下一題</span></button></div>' +
      '<p class="brain-lesson__practice-note">Practice keeps your first score.<span class="zhs">再練一次會保留第一次的分數。</span></p>';
    supportEl.querySelector('[data-learning-action="retry"]').onclick = function () { if (state === 'lesson-review') beginGuidedRetry(meta); };
    var next = supportEl.querySelector('[data-learning-action="next"]');
    next.onclick = function () { if (state === 'lesson-review') transition(); };
    next.focus({ preventScroll: true });
  }

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

  function hideLearningSupport() {
    if (!supportEl) return;
    supportEl.hidden = true;
    supportEl.innerHTML = "";
  }

  function learningMeta(given, responseMs) {
    return {
      gameId: gameId, tier: tier, kid: kid, index: idx, item: round.items[idx],
      childAnswer: given, responseMs: Math.max(0, Math.round(responseMs || 0)),
      skill: opts.mathSkill || (game && game.skill ? game.skill : "math")
    };
  }

  function notifyLearningAttempt(meta, hintsUsed) {
    if (!opts.onLearningAttempt || learningAttemptRecorded) return;
    learningAttemptRecorded = true;
    Promise.resolve(opts.onLearningAttempt(Object.assign({}, meta, { hintsUsed: hintsUsed || (lessonHintUsed ? 1 : 0) })))
      .catch(function (err) { console.warn("brain learning attempt was not stored", err); });
  }

  function notifyLearningSupportOutcome(meta, outcome, intervention) {
    if (!opts.onLearningSupportOutcome || !meta || !outcome) return;
    Promise.resolve(opts.onLearningSupportOutcome(Object.assign({}, meta, {
      outcome: outcome,
      intervention: intervention || activeLearningIntervention || undefined
    }))).catch(function (err) { console.warn("brain learning support outcome was not stored", err); });
  }

  function hintVisualHtml(result) {
    var presentation = result && result.presentation || {};
    if (presentation.equalGroups) {
      var groups = Math.max(1, Math.min(10, Math.round(Number(presentation.equalGroups.groups) || 1)));
      var each = Math.max(1, Math.min(10, Math.round(Number(presentation.equalGroups.each) || 1)));
      var layout = presentation.equalGroups.layout === "array" ? " is-array" : "";
      return '<div class="brain-learning-support__groups' + layout + '" aria-hidden="true">' + Array.from({ length: groups }, function () {
        return '<span>' + "●".repeat(each) + '</span>';
      }).join('') + '</div>';
    }
    if (presentation.skipCount) {
      var step = Math.max(1, Math.round(Number(presentation.skipCount.step) || 1));
      var count = Math.max(1, Math.min(10, Math.round(Number(presentation.skipCount.count) || 1)));
      var multiples = [0];
      for (var sc = 1; sc <= count; sc++) multiples.push(step * sc);
      return '<div class="brain-learning-support__numberline brain-learning-support__skipcount" aria-hidden="true">' + multiples.map(function (value, n) {
        return '<span class="' + (n === multiples.length - 1 ? "is-end" : "") + '">' + value + '</span>';
      }).join('<i>↗</i>') + '</div>';
    }
    if (presentation.comparison && presentation.comparison.length === 2) {
      var cLeft = Math.max(0, Math.round(Number(presentation.comparison[0]) || 0));
      var cRight = Math.max(0, Math.round(Number(presentation.comparison[1]) || 0));
      return '<div class="brain-learning-support__comparison" aria-hidden="true"><span><b>' + cLeft + '</b><i style="--q:' + Math.min(100, cLeft) + '"></i></span><em>?</em><span><b>' + cRight + '</b><i style="--q:' + Math.min(100, cRight) + '"></i></span></div>';
    }
    if (presentation.numberBond) {
      var known = Math.max(0, Math.round(Number(presentation.numberBond.known) || 0));
      var target = Math.max(0, Math.round(Number(presentation.numberBond.target) || 0));
      return '<div class="brain-learning-support__bond" aria-hidden="true"><span>' + known + '</span><b>+</b><span class="is-missing">?</span><b>=</b><span class="is-total">' + target + '</span></div>';
    }
    if (presentation.objectGroups && presentation.objectGroups.length === 2) {
      var left = Math.max(0, Math.min(20, Number(presentation.objectGroups[0]) || 0));
      var right = Math.max(0, Math.min(20, Number(presentation.objectGroups[1]) || 0));
      var operator = presentation.operator === "−" ? "−" : presentation.operator === "×" ? "×" : "+";
      return '<div class="brain-learning-support__objects" aria-hidden="true"><span>' + "●".repeat(left) + '</span><b>' + operator + '</b><span>' + "●".repeat(right) + '</span></div>';
    }
    if (presentation.numberLine) {
      var line = presentation.numberLine;
      var start = Number(line.start) || 0, direction = Number(line.direction) < 0 ? -1 : 1;
      var steps = Math.max(0, Math.round(Number(line.steps) || 0));
      var cells = [start];
      if (steps <= 10) {
        for (var i = 1; i <= steps; i++) cells.push(start + direction * i);
      } else {
        for (var j = 1; j <= 4; j++) cells.push(start + direction * j);
        cells.push("…");
        cells.push(start + direction * steps);
      }
      return '<div class="brain-learning-support__numberline" aria-hidden="true">' + cells.map(function (value, n) {
        return '<span class="' + (n === cells.length - 1 ? "is-end" : "") + '">' + escapeHtml(value) + '</span>';
      }).join('<i>→</i>') + '</div>';
    }
    return '<div class="brain-learning-support__retry" aria-hidden="true">👆 · 🧠 · ✨</div>';
  }

  function renderLearningHint(meta, result) {
    if (!supportEl) { transition(); return; }
    var hint = result && result.hint || {};
    var presentation = result && result.presentation || {};
    var showText = presentation.showText !== false;
    supportEl.hidden = false;
    supportEl.innerHTML =
      '<div class="brain-learning-support__hint">' +
        '<div class="brain-learning-support__visual">' + hintVisualHtml(result) + '</div>' +
        (showText ? '<div class="brain-learning-support__copy"><b>' + escapeHtml(hint.message || "Try one smaller step.") + '</b><span>' + escapeHtml(hint.messageZh || "先試一個小步驟。") + '</span></div>' : '') +
      '</div>' +
      '<div class="brain-learning-support__actions">' +
        '<button type="button" data-learning-action="retry">↻ <b>Try again</b><span>再試一次</span></button>' +
        '<button type="button" data-learning-action="next">→ <b>Next</b><span>下一題</span></button>' +
      '</div>';
    if (presentation.mode === "visual_audio" && opts.say && hint.message && hint.messageZh) opts.say([hint.message, hint.messageZh]);
    var retry = supportEl.querySelector('[data-learning-action="retry"]');
    var next = supportEl.querySelector('[data-learning-action="next"]');
    if (retry) retry.onclick = function () { beginGuidedRetry(meta); };
    if (next) next.onclick = function () { notifyLearningSupportOutcome(meta, "support_skipped", activeLearningIntervention); transition(); };
  }

  function beginGuidedRetry(meta) {
    if (destroyed || !sceneInstance) { transition(); return; }
    hideLearningSupport();
    overlay.removeAttribute('data-feedback');
    feedbackEl.textContent = '';
    guidedRetry = true;
    guidedRetryMeta = meta;
    pendingSubmitAccepted = false;
    state = "presenting-guided-retry";
    var item = round.items[idx];
    clueBtn.disabled = true;
    var result;
    try {
      result = sceneInstance.present(item, { index: idx, count: round.items.length, isFirst: idx === 0, clocked: !!round.clock, guidedRetry: true });
    } catch (err) {
      console.error("brain guided retry present() failed: " + gameId, err);
      transition();
      return;
    }
    var wait = (result && typeof result.then === "function") ? result : Promise.resolve();
    wait.then(function () {
      if (destroyed) return;
      state = "active";
      attemptStartedAt = now();
      if (sceneInstance.setInputEnabled) sceneInstance.setInputEnabled(true);
      clueBtn.disabled = false;
      announce(["Try that one again.", "再試一次這一題。"]);
    }).catch(function () { transition(); });
    void meta;
  }

  function requestLearningHint(meta, intervention) {
    if (!supportEl) { notifyLearningAttempt(meta, 1); transition(); return; }
    state = "learning-hint";
    supportEl.hidden = false;
    supportEl.innerHTML = '<div class="brain-learning-support__loading"><span>💡</span><b>Finding the right clue…</b><em>正在找適合的小提示…</em></div>';
    var requestMeta = Object.assign({}, meta, intervention ? { intervention: intervention } : {});
    Promise.resolve(opts.getLearningHint ? opts.getLearningHint(requestMeta) : null).then(function (result) {
      if (destroyed) return;
      notifyLearningAttempt(meta, 1);
      if (!result) {
        result = {
          hint: { message: "Try one smaller step.", messageZh: "先試一個小步驟。" },
          presentation: { showText: true, mode: "text_visual", strategy: "retry" }
        };
      }
      renderLearningHint(meta, result);
    }).catch(function () {
      if (destroyed) return;
      notifyLearningAttempt(meta, 1);
      renderLearningHint(meta, {
        hint: { message: "Try one smaller step.", messageZh: "先試一個小步驟。" },
        presentation: { showText: true, mode: "text_visual", strategy: "retry" }
      });
    });
  }

  function showLearningChoice(meta, intervention) {
    if (!supportEl) { notifyLearningAttempt(meta, 0); transition(); return; }
    state = "learning-support";
    supportEl.hidden = false;
    var promptEn = intervention && intervention.reason === "needs_support" ? "Want a small clue?" : "Want a hint?";
    var promptZh = intervention && intervention.reason === "needs_support" ? "要一個小提示嗎？" : "要提示嗎？";
    supportEl.innerHTML =
      '<div class="brain-learning-support__prompt"><span class="brain-learning-support__bulb">💡</span><div><b>' + promptEn + '</b><span>' + promptZh + '</span></div></div>' +
      '<div class="brain-learning-support__actions">' +
        '<button type="button" data-learning-action="hint">💡 <b>Small clue</b><span>小提示</span></button>' +
        '<button type="button" data-learning-action="next">→ <b>Next</b><span>下一題</span></button>' +
      '</div>';
    var hintBtn = supportEl.querySelector('[data-learning-action="hint"]');
    var nextBtn = supportEl.querySelector('[data-learning-action="next"]');
    if (nextBtn) nextBtn.onclick = function () { notifyLearningAttempt(meta, 0); notifyLearningSupportOutcome(meta, "support_skipped", intervention && intervention.kind); transition(); };
    if (hintBtn) hintBtn.onclick = function () {
      hintBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      requestLearningHint(meta, intervention);
    };
  }

  function showVisualExplanation(meta, intervention) {
    if (!supportEl) { notifyLearningAttempt(meta, 1); transition(); return; }
    supportEl.hidden = false;
    supportEl.innerHTML =
      '<div class="brain-learning-support__loading"><span>🧩</span><b>Let\'s look at it another way.</b><em>我們換一個方法看看。</em></div>';
    requestLearningHint(meta, intervention);
  }

  function scaffoldChoices(answer) {
    var a = Math.max(0, Math.round(Number(answer) || 0));
    var values = [Math.max(0, a - 1), a, a + 1];
    var unique = [];
    values.forEach(function (value) { if (unique.indexOf(value) < 0) unique.push(value); });
    while (unique.length < 3) unique.push(unique[unique.length - 1] + 1);
    return unique;
  }

  function scaffoldQuestionHtml(q) {
    if (q.operation === "multiplication") {
      return '<b>' + escapeHtml(q.left) + '</b><span>×</span><b>' + escapeHtml(q.right) + '</b><span>=</span><b>?</b>';
    }
    if (q.operation === "comparison") {
      return '<b>' + escapeHtml(q.left) + '</b><span>or</span><b>' + escapeHtml(q.right) + '</b><span>→</span><b>?</b>';
    }
    if (q.operation === "number_bond") {
      return '<b>' + escapeHtml(q.left) + '</b><span>+</span><b>?</b><span>=</span><b>' + escapeHtml(q.right) + '</b>';
    }
    var op = q.operation === "subtraction" ? "−" : "+";
    return '<b>' + escapeHtml(q.left) + '</b><span>' + op + '</span><b>' + escapeHtml(q.right) + '</b><span>=</span><b>?</b>';
  }

  function showEasierFollowUp(meta, intervention) {
    var q = intervention && intervention.easierQuestion;
    if (!supportEl || !q || !Number.isFinite(Number(q.answer))) {
      showVisualExplanation(meta, intervention);
      return;
    }
    notifyLearningAttempt(meta, 1);
    state = "learning-scaffold";
    supportEl.hidden = false;
    var choices = scaffoldChoices(q.answer);
    supportEl.innerHTML =
      '<div class="brain-learning-support__scaffold">' +
        '<div class="brain-learning-support__scaffold-head"><span>🪜</span><div><b>One smaller step first</b><em>先做一個簡單一點的小步驟</em></div></div>' +
        '<div class="brain-learning-support__scaffold-question" aria-label="Smaller math step 小一點的數學步驟">' +
          scaffoldQuestionHtml(q) +
        '</div>' +
        '<div class="brain-learning-support__scaffold-choices">' + choices.map(function (value) {
          return '<button type="button" data-scaffold-answer="' + value + '">' + value + '</button>';
        }).join("") + '</div>' +
        '<div class="brain-learning-support__scaffold-status" aria-live="polite"></div>' +
      '</div>' +
      '<div class="brain-learning-support__actions brain-learning-support__actions--single">' +
        '<button type="button" data-learning-action="next">→ <b>Skip</b><span>跳過</span></button>' +
      '</div>';
    var statusEl = supportEl.querySelector('.brain-learning-support__scaffold-status');
    var nextBtn = supportEl.querySelector('[data-learning-action="next"]');
    if (nextBtn) nextBtn.onclick = function () { notifyLearningSupportOutcome(meta, "support_skipped", intervention && intervention.kind); transition(); };
    Array.prototype.forEach.call(supportEl.querySelectorAll('[data-scaffold-answer]'), function (button) {
      button.onclick = function () {
        if (Number(button.getAttribute('data-scaffold-answer')) !== Number(q.answer)) {
          if (statusEl) statusEl.textContent = "Almost — one more try. 再試一次。";
          if (button.animate) button.animate([{ transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }], { duration: 180 });
          return;
        }
        audioSvc.play("success", {});
        Array.prototype.forEach.call(supportEl.querySelectorAll('[data-scaffold-answer]'), function (candidate) { candidate.disabled = true; });
        if (nextBtn) nextBtn.disabled = true;
        if (statusEl) statusEl.textContent = "Yes! Now try the original one. 好！現在回到原本那題。";
        notifyLearningSupportOutcome(meta, "scaffold_success", intervention && intervention.kind);
        scheduler.after(reducedMotion ? 80 : 620, function () { if (!destroyed) beginGuidedRetry(meta); });
      };
    });
  }

  function applyLearningIntervention(meta, intervention) {
    activeLearningIntervention = intervention && intervention.kind ? intervention.kind : null;
    if (!intervention || !intervention.kind) { showLearningChoice(meta, null); return; }
    if (intervention.kind === "continue") {
      notifyLearningAttempt(meta, 0);
      transition();
      return;
    }
    if (intervention.kind === "visual_explanation") {
      showVisualExplanation(meta, intervention);
      return;
    }
    if (intervention.kind === "easier_follow_up") {
      showEasierFollowUp(meta, intervention);
      return;
    }
    showLearningChoice(meta, intervention);
  }

  function maybeOfferLearningSupport(meta) {
    if (round.items[idx].lesson) { showLessonReview(meta); return; }
    if (!opts.canLearningSupport || !opts.getLearningHint) {
      notifyLearningAttempt(meta, 0);
      transition();
      return;
    }
    state = "learning-check";
    Promise.resolve(opts.canLearningSupport(meta)).then(function (supported) {
      if (destroyed) return;
      if (!supported) { notifyLearningAttempt(meta, 0); transition(); return; }
      if (!opts.getLearningIntervention) { showLearningChoice(meta, null); return; }
      return Promise.resolve(opts.getLearningIntervention(meta)).then(function (intervention) {
        if (destroyed) return;
        applyLearningIntervention(meta, intervention);
      });
    }).catch(function () {
      if (destroyed) return;
      showLearningChoice(meta, null);
    });
  }

  function unlockAudioOnce() {
    if (audioUnlockedOnce) return;
    audioUnlockedOnce = true;
    audioSvc.unlock();
  }
  overlay.addEventListener("pointerdown", unlockAudioOnce, { once: true, passive: true });
  overlay.addEventListener("keydown", unlockAudioOnce, { once: true });
  // Preserve native Space activation before the legacy typing-game listener.
  overlay.addEventListener("keydown", function (event) {
    if (event.key === " " && event.target && event.target.tagName === "BUTTON") event.stopPropagation();
  });

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
    if (!round.clock || scheduler.paused || clockCancel) return;
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
      if (state !== 'lesson-clue') scheduler.resume();
      if (state === "active" && !guidedRetry) startActiveClock();
    }
  }
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibilityChange);
  onVisibilityChange();

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
    overlay.removeAttribute('data-feedback');
    feedbackEl.textContent = '';
    state = "presenting";
    pendingSubmitAccepted = false;
    guidedRetry = false;
    guidedRetryMeta = null;
    activeLearningIntervention = null;
    learningAttemptRecorded = false;
    lessonHintUsed = false;
    renderLesson();
    hideLearningSupport();
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
      if (item.lesson && answers[idx]) {
        var savedAnswer = answers[idx];
        pendingSubmitAccepted = true;
        learningAttemptRecorded = true;
        state = savedAnswer.correct ? 'feedback-correct' : 'feedback-corrective';
        if (sceneInstance.setInputEnabled) sceneInstance.setInputEnabled(false);
        runFeedback(Object.freeze({ correct: savedAnswer.correct, got: savedAnswer.got, worth: savedAnswer.worth, given: savedAnswer.given, answer: item.answer }), savedAnswer.correct ? transition : function () { showLessonReview(learningMeta(savedAnswer.given, 0)); });
        return;
      }
      if (item.say && opts.say) opts.say(item.say);
      state = "active";
      attemptStartedAt = now();
      if (sceneInstance.setInputEnabled) sceneInstance.setInputEnabled(true);
      clueBtn.disabled = false;
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
    var responseMs = attemptStartedAt ? Math.max(0, now() - attemptStartedAt) : 0;

    if (guidedRetry) {
      guidedRetry = false;
      notifyLearningSupportOutcome(guidedRetryMeta || learningMeta(given, responseMs), graded.correct ? "retry_recovered" : "retry_failed", activeLearningIntervention);
      guidedRetryMeta = null;
      var guidedFeedback = Object.freeze({
        correct: graded.correct, got: graded.got, worth: graded.worth, given: given, answer: item.answer, guidedRetry: true
      });
      state = graded.correct ? "feedback-correct" : "feedback-corrective";
      renderProgress();
      if (graded.correct) audioSvc.play("success", {});
      runFeedback(guidedFeedback, function () {
        if (item.lesson && !graded.correct) showLessonReview(learningMeta(given, responseMs));
        else transition();
      });
      return;
    }

    answers[idx] = { given: given, got: graded.got, worth: graded.worth, correct: graded.correct };
    if (item.lesson) {
      notifyLearningAttempt(learningMeta(given, responseMs), lessonHintUsed ? 1 : 0);
      saveProgress();
    }

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
    var meta = learningMeta(given, responseMs);
    state = graded.correct ? "feedback-correct" : "feedback-corrective";
    renderProgress();
    if (graded.correct) {
      audioSvc.play("success", {});
      notifyLearningAttempt(meta, 0);
      runFeedback(feedback);
      return;
    }
    runFeedback(feedback, function () { maybeOfferLearningSupport(meta); });
  }

  function runFeedback(feedback, after) {
    clueBtn.disabled = true;
    overlay.setAttribute('data-feedback', feedback.correct ? 'correct' : 'corrective');
    feedbackEl.textContent = feedback.correct ? 'Nice! 很棒！' : 'Keep going 繼續試試';
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
    capped.then(function () {
      if (destroyed) return;
      if (after) after(); else transition();
    });
  }

  function saveProgress() {
    if (!opts.onProgress) return;
    opts.onProgress({ gameId: gameId, tier: tier, idx: idx, items: round.items, answers: answers, ms: activeMsAccum, mathSkill: opts.mathSkill || undefined });
  }

  function transition() {
    if (destroyed) return;
    state = "transitioning";
    hideLearningSupport();
    guidedRetry = false;
    guidedRetryMeta = null;
    activeLearningIntervention = null;
    attemptStartedAt = 0;
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
  round.ready=round.start();
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
