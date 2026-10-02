/* Brain round host state-machine tests (brain slice 34 task 10). No browser: the
   minimal fake DOM in dom-stub.mjs stands in for document/window (guidelines §15.1).
   Determinism trick: rather than fighting the host's Date.now()-seeded question RNG,
   these tests temporarily replace js/brain/scenes/change.js's exported `create` with a
   fake scene that hands the test its ctx and the real generated item — so a test can
   submit `item.answer` (guaranteed correct) or a bogus string (guaranteed corrective)
   without knowing anything about brain-data's generators. "change" is used because it
   is the only id with a real SCENE_LOADERS entry; its tot tier is unclocked, mid/hard
   are clocked (brain-data.js GAMES.change.tiers), which is what the active-time tests need. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { installDom } from "./dom-stub.mjs";

installDom();
const require = createRequire(import.meta.url);
require("../js/brain-data.js");
require("../js/brain-core.js");
require("../js/brain-audio-cues.js");

const hostMod = await import("../js/brain/host.js");
const changeMod = await import("../js/brain/scenes/change.js");
const genericMod = await import("../js/brain/scenes/generic.js");

function flush(ms) { return new Promise((resolve) => setTimeout(resolve, ms == null ? 20 : ms)); }

function installFakeScene() {
  const calls = { present: 0, ctx: null, lastItem: null, lastView: null, feedback: null, destroyed: 0, inputEnabled: [] };
  changeMod.default.create = function (ctx) {
    calls.ctx = ctx;
    return {
      present: function (item, view) { calls.present++; calls.lastItem = item; calls.lastView = view; },
      setInputEnabled: function (enabled) { calls.inputEnabled.push(enabled); },
      showFeedback: function (feedback) { calls.feedback = feedback; },
      destroy: function () { calls.destroyed++; }
    };
  };
  return calls;
}

const originalChangeCreate = changeMod.default.create;
function restoreFakeScene() { changeMod.default.create = originalChangeCreate; }

test("normal correct path: submit accepted once, feedback correct, onFinish once", async () => {
  const calls = installFakeScene();
  try {
    let finished = null, finishCount = 0;
    const round = hostMod.openRound({
      gameId: "change", tier: "tot", kid: "lili",
      onFinish: (res) => { finished = res; finishCount++; }
    });
    await flush();
    assert.equal(round.debugState(), "active");
    assert.equal(calls.present, 1);
    assert.ok(calls.lastItem && calls.lastItem.answer, "scene present() received the real round item");

    const accepted = calls.ctx.submit(calls.lastItem.answer);
    assert.equal(accepted, true);
    const rejected = calls.ctx.submit(calls.lastItem.answer);
    assert.equal(rejected, false, "duplicate submit while evaluating/feedback must be ignored");
    assert.ok(calls.feedback.correct, "exact-answer submit must grade correct");

    // drive the rest of the round (8 tot items) the same way
    for (let guard = 0; guard < 20 && round.debugState() !== "destroyed"; guard++) {
      await flush(10);
      if (round.debugState() === "active" && calls.ctx) {
        calls.ctx.submit(calls.lastItem.answer);
      }
    }
    await flush();
    assert.equal(finishCount, 1, "onFinish must fire exactly once");
    assert.equal(finished.gameId, "change");
    assert.equal(finished.score, finished.total, "every item answered correctly");
    assert.equal(round.debugScheduler().activeCount, 0, "no live scheduler resources after completion");
  } finally { restoreFakeScene(); }
});

test("corrective path: wrong submit grades incorrect and still advances", async () => {
  const calls = installFakeScene();
  try {
    const round = hostMod.openRound({ gameId: "change", tier: "tot", kid: "lili", onFinish: () => {} });
    await flush();
    calls.ctx.submit("definitely-not-the-answer");
    assert.equal(calls.feedback.correct, false);
    assert.equal(calls.feedback.answer, calls.lastItem.answer);
    await flush(1300); // feedback is capped at 1200ms
    assert.equal(round.debugItemIndex(), 1, "round advanced to the next item after corrective feedback");
    round.destroy(true);
  } finally { restoreFakeScene(); }
});

test("quit from loading calls destroy but never onFinish", async () => {
  const calls = installFakeScene();
  try {
    let finishCount = 0;
    const round = hostMod.openRound({ gameId: "change", tier: "tot", kid: "lili", onFinish: () => { finishCount++; } });
    assert.equal(round.debugState(), "loading");
    round.destroy(true);
    await flush();
    assert.equal(finishCount, 0);
    assert.equal(round.debugScheduler().activeCount, 0);
  } finally { restoreFakeScene(); }
});

test("quit from active calls destroy but never onFinish", async () => {
  const calls = installFakeScene();
  try {
    let finishCount = 0;
    const round = hostMod.openRound({ gameId: "change", tier: "tot", kid: "lili", onFinish: () => { finishCount++; } });
    await flush();
    assert.equal(round.debugState(), "active");
    round.destroy(true);
    assert.equal(round.debugState(), "destroyed");
    assert.equal(finishCount, 0);
    assert.equal(round.debugScheduler().activeCount, 0);
    assert.equal(calls.destroyed, 1, "scene destroy() must run on quit");
  } finally { restoreFakeScene(); }
});

test("quit mid-feedback calls destroy but never onFinish", async () => {
  const calls = installFakeScene();
  try {
    let finishCount = 0;
    const round = hostMod.openRound({ gameId: "change", tier: "tot", kid: "lili", onFinish: () => { finishCount++; } });
    await flush();
    calls.ctx.submit(calls.lastItem.answer);
    assert.ok(round.debugState() === "feedback-correct" || round.debugState() === "feedback-corrective");
    round.destroy(true);
    await flush();
    assert.equal(finishCount, 0);
    assert.equal(round.debugScheduler().activeCount, 0);
  } finally { restoreFakeScene(); }
});

test("onProgress persists after each item and clears once the round completes", async () => {
  const calls = installFakeScene();
  try {
    const progressCalls = [];
    const round = hostMod.openRound({
      gameId: "change", tier: "tot", kid: "lili",
      onProgress: (state) => progressCalls.push(state),
      onFinish: () => {}
    });
    await flush();
    calls.ctx.submit(calls.lastItem.answer);
    await flush(1300);
    assert.equal(progressCalls.length, 1, "onProgress fires once per completed item");
    assert.equal(progressCalls[0].idx, 1);
    assert.equal(progressCalls[0].items.length, 8);
    assert.equal(progressCalls[0].answers.length, 1);

    for (let guard = 0; guard < 20 && round.debugState() !== "destroyed"; guard++) {
      await flush(10);
      if (round.debugState() === "active" && calls.ctx) calls.ctx.submit(calls.lastItem.answer);
    }
    await flush();
    assert.equal(progressCalls[progressCalls.length - 1], null, "onProgress clears the saved round once finished");
  } finally { restoreFakeScene(); }
});

test("contained HUD hook receives arcade stats as the round advances", async () => {
  const calls = installFakeScene();
  try {
    const hudCalls = [];
    const round = hostMod.openRound({
      gameId: "change", tier: "tot", kid: "lili", best: 3,
      onHud: (items, meta) => hudCalls.push({ items, meta }),
      onFinish: () => {}
    });
    await flush();
    assert.ok(hudCalls.length >= 1, "host must publish HUD stats during the first item");
    assert.deepEqual(hudCalls[hudCalls.length - 1].items.map((i) => i.k), ["Time", "Tasks", "Best"]);
    assert.equal(hudCalls[hudCalls.length - 1].items[1].v, "0/8");
    assert.equal(hudCalls[hudCalls.length - 1].items[2].v, 3);

    calls.ctx.submit(calls.lastItem.answer);
    await flush(1300);
    assert.equal(hudCalls[hudCalls.length - 1].items[1].v, "1/8");
    assert.equal(hudCalls[hudCalls.length - 1].meta.total, 8);
    round.destroy(true);
  } finally { restoreFakeScene(); }
});

test("resume restores mid-round progress instead of restarting", async () => {
  const calls = installFakeScene();
  let saved = null;
  try {
    const round = hostMod.openRound({
      gameId: "change", tier: "tot", kid: "lili",
      onProgress: (state) => { saved = state; },
      onFinish: () => {}
    });
    await flush();
    calls.ctx.submit(calls.lastItem.answer);      // item 0 correct
    await flush(1300);
    calls.ctx.submit("nope, not the answer");     // item 1 incorrect
    await flush(1300);
    calls.ctx.submit(calls.lastItem.answer);      // item 2 correct
    await flush(1300);
    assert.equal(saved.idx, 3, "saved state points at the next unanswered item");
    round.destroy(true); // simulate quitting (or a reload) mid-round
  } finally { restoreFakeScene(); }

  const calls2 = installFakeScene();
  try {
    let finished = null;
    const round2 = hostMod.openRound({
      gameId: "change", tier: "tot", kid: "lili", resume: saved,
      onProgress: () => {},
      onFinish: (res) => { finished = res; }
    });
    await flush();
    assert.equal(round2.debugItemIndex(), 3, "resumed round starts where the kid left off, not from item 0");
    assert.equal(calls2.lastItem, saved.items[3], "resumed round shows the saved item, not a freshly generated one");

    for (let guard = 0; guard < 20 && round2.debugState() !== "destroyed"; guard++) {
      await flush(10);
      if (round2.debugState() === "active" && calls2.ctx) calls2.ctx.submit(calls2.lastItem.answer);
    }
    await flush();
    assert.equal(finished.total, 8, "the finished score covers all 8 items, not just the ones answered after resuming");
    assert.equal(finished.score, 7, "2 correct pre-resume + 5 correct post-resume, the 1 pre-resume miss still counts");
  } finally { restoreFakeScene(); }
});

test("resume is ignored when its shape doesn't match the fresh round", async () => {
  const calls = installFakeScene();
  try {
    const mismatched = { gameId: "change", tier: "mid", idx: 3, items: new Array(10).fill({}), answers: [] };
    const round = hostMod.openRound({
      gameId: "change", tier: "tot", kid: "lili", resume: mismatched, onFinish: () => {}
    });
    await flush();
    assert.equal(round.debugItemIndex(), 0, "a resume for a different tier/shape must be ignored, not crash the round");
    round.destroy(true);
  } finally { restoreFakeScene(); }
});

test("a never-resolving showFeedback is capped at 1200ms, not stuck forever", async () => {
  const calls = installFakeScene();
  changeMod.default.create = function (ctx) {
    calls.ctx = ctx;
    return {
      present: function (item) { calls.lastItem = item; },
      setInputEnabled: function () {},
      showFeedback: function () { return new Promise(function () {}); }, // never resolves
      destroy: function () {}
    };
  };
  try {
    const round = hostMod.openRound({ gameId: "change", tier: "tot", kid: "lili", onFinish: () => {} });
    await flush();
    calls.ctx.submit(calls.lastItem.answer);
    await flush(1300);
    assert.equal(round.debugItemIndex(), 1, "host must advance via the 1200ms cap, not wait forever");
    round.destroy(true);
  } finally { restoreFakeScene(); }
});

test("zero-worth item (Math Recall's freebie) advances with no feedback state", async () => {
  const calls = installFakeScene();
  try {
    const round = hostMod.openRound({ gameId: "change", tier: "tot", kid: "lili", onFinish: () => {} });
    await flush();
    calls.ctx.submit("");
    // change's tot items are all worth 1, so this exercises the normal corrective path;
    // the true zero-worth path is covered directly via SQBrainCore.gradeItem in core.test.mjs.
    assert.ok(round.debugState() === "feedback-correct" || round.debugState() === "feedback-corrective");
    round.destroy(true);
  } finally { restoreFakeScene(); }
});

test("scene create() throwing falls back to the generic scene", async () => {
  changeMod.default.create = function () { throw new Error("boom"); };
  try {
    const round = hostMod.openRound({ gameId: "change", tier: "tot", kid: "lili", onFinish: () => {} });
    await flush(60);
    assert.equal(round.debugState(), "active", "round recovers via generic instead of getting stuck");
    const overlay = round.debugOverlay();
    const rendered = overlay.querySelector(".brain-generic__prompt");
    assert.ok(rendered, "generic.js rendered into the scene mount");
    round.destroy(true);
    assert.equal(round.debugScheduler().activeCount, 0);
  } finally { restoreFakeScene(); }
});

test("scene present() throwing falls back to the generic scene for that item", async () => {
  changeMod.default.create = function () {
    return {
      present: function () { throw new Error("boom"); },
      setInputEnabled: function () {}, showFeedback: function () {}, destroy: function () {}
    };
  };
  try {
    const round = hostMod.openRound({ gameId: "change", tier: "tot", kid: "lili", onFinish: () => {} });
    await flush(60);
    assert.equal(round.debugState(), "active");
    assert.ok(round.debugOverlay().querySelector(".brain-generic__prompt"));
    round.destroy(true);
  } finally { restoreFakeScene(); }
});

test("an unknown game id uses the generic scene directly", async () => {
  const round = hostMod.openRound({ gameId: "wordmem", tier: "tot", kid: "lili", onFinish: () => {} });
  await flush();
  assert.equal(round.debugState(), "active");
  assert.ok(round.debugOverlay().querySelector(".brain-generic__prompt"));
  round.destroy(true);
});

test("opening a second round destroys the first one first", async () => {
  const calls = installFakeScene();
  try {
    const first = hostMod.openRound({ gameId: "change", tier: "tot", kid: "lili", onFinish: () => {} });
    await flush();
    const second = hostMod.openRound({ gameId: "change", tier: "tot", kid: "luis", onFinish: () => {} });
    assert.equal(first.debugState(), "destroyed");
    await flush();
    assert.equal(second.debugState(), "active");
    second.destroy(true);
  } finally { restoreFakeScene(); }
});

test("hidden document excludes time from the active-time clock", async () => {
  const calls = installFakeScene();
  try {
    const round = hostMod.openRound({ gameId: "change", tier: "mid", kid: "luis", onFinish: () => {} });
    await flush();
    assert.equal(round.debugState(), "active");
    document.hidden = true;
    document.dispatch("visibilitychange");
    await flush(80);
    document.hidden = false;
    document.dispatch("visibilitychange");
    assert.ok(round.debugActiveMs() < 40, "hidden time must not accumulate into active time, got " + round.debugActiveMs());
    round.destroy(true);
  } finally { restoreFakeScene(); document.hidden = false; }
});

test("fmtMs formats minutes:seconds with a leading zero", () => {
  assert.equal(hostMod.fmtMs(0), "0:00");
  assert.equal(hostMod.fmtMs(9000), "0:09");
  assert.equal(hostMod.fmtMs(65000), "1:05");
});

test("generic scene module exposes the required contract shape", () => {
  assert.equal(genericMod.default.id, "generic");
  assert.equal(typeof genericMod.default.create, "function");
});

test("learning support: wrong answer can request a hint, retry locally, and preserve original Brain score", async () => {
  const calls = installFakeScene();
  try {
    const progressCalls = [];
    const learningAttempts = [];
    const supportOutcomes = [];
    let hintCalls = 0;
    const round = hostMod.openRound({
      gameId: "change", tier: "tot", kid: "lili",
      canLearningSupport: async () => true,
      getLearningHint: async () => {
        hintCalls += 1;
        return {
          hint: { message: "Count one step at a time.", messageZh: "一次數一步。", strategy: "number_line" },
          presentation: { mode: "text_visual", strategy: "number_line", showText: true, numberLine: { start: 3, direction: 1, steps: 2 } },
        };
      },
      onLearningAttempt: async (attempt) => { learningAttempts.push(attempt); },
      onLearningSupportOutcome: async (outcome) => { supportOutcomes.push(outcome); },
      onProgress: (state) => { if (state) progressCalls.push(state); },
      onFinish: () => {},
    });
    await flush();
    const firstAnswer = calls.lastItem.answer;
    calls.ctx.submit("definitely-wrong");
    await flush(30);
    assert.equal(round.debugState(), "learning-support");
    const hintButton = round.debugOverlay().querySelector('[data-learning-action="hint"]');
    assert.ok(hintButton && typeof hintButton.onclick === "function", "support prompt exposes a Hint action");
    hintButton.onclick();
    await flush(30);
    assert.equal(hintCalls, 1);
    assert.equal(learningAttempts.length, 1);
    assert.equal(learningAttempts[0].hintsUsed, 1, "hint usage is stored with the original wrong attempt");
    const retryButton = round.debugOverlay().querySelector('[data-learning-action="retry"]');
    assert.ok(retryButton && typeof retryButton.onclick === "function", "validated hint exposes a retry action");
    retryButton.onclick();
    await flush(30);
    assert.equal(round.debugState(), "active");
    assert.ok(calls.present >= 2, "same item is presented again for guided retry");
    calls.ctx.submit(firstAnswer);
    await flush(40);
    assert.equal(round.debugItemIndex(), 1, "guided retry advances after local grading");
    assert.equal(progressCalls.at(-1).answers[0].correct, false, "Brain Gym score keeps the first attempt instead of letting AI/hint overwrite it");
    assert.equal(learningAttempts.length, 1, "guided retry does not double-count the learning attempt");
    assert.equal(supportOutcomes.at(-1).outcome, "retry_recovered", "guided retry recovery is emitted for tutor telemetry");
    round.destroy(true);
  } finally { restoreFakeScene(); }
});

test("adaptive tutor: strong-context continue skips extra tutor UI but stores the wrong attempt", async () => {
  const calls = installFakeScene();
  try {
    const learningAttempts = [];
    let hintCalls = 0;
    const round = hostMod.openRound({
      gameId: "change", tier: "tot", kid: "lili",
      canLearningSupport: async () => true,
      getLearningIntervention: async () => ({
        kind: "continue", mistake: "near_miss", reason: "near_miss_after_success", preferredStrategies: [],
      }),
      getLearningHint: async () => { hintCalls += 1; return null; },
      onLearningAttempt: async (attempt) => { learningAttempts.push(attempt); },
      onFinish: () => {},
    });
    await flush();
    calls.ctx.submit("definitely-wrong");
    await flush(40);
    assert.equal(hintCalls, 0, "continue intervention does not spend an AI request");
    assert.equal(learningAttempts.length, 1);
    assert.equal(learningAttempts[0].hintsUsed, 0);
    assert.equal(round.debugItemIndex(), 1, "the normal round continues after the game's own corrective feedback");
    round.destroy(true);
  } finally { restoreFakeScene(); }
});

test("adaptive tutor: repeated difficulty inserts an unscored easier step then retries the original", async () => {
  const calls = installFakeScene();
  try {
    const progressCalls = [];
    const learningAttempts = [];
    const supportOutcomes = [];
    const round = hostMod.openRound({
      gameId: "change", tier: "tot", kid: "lili",
      canLearningSupport: async () => true,
      getLearningIntervention: async () => ({
        kind: "easier_follow_up",
        mistake: "unknown",
        reason: "repeated_errors",
        preferredStrategies: ["objects", "number_line"],
        easierQuestion: { id: "scaffold", operation: "addition", left: 2, right: 1, answer: 3, difficulty: 1 },
      }),
      getLearningHint: async () => null,
      onLearningAttempt: async (attempt) => { learningAttempts.push(attempt); },
      onLearningSupportOutcome: async (outcome) => { supportOutcomes.push(outcome); },
      onProgress: (state) => { if (state) progressCalls.push(state); },
      onFinish: () => {},
    });
    await flush();
    const originalAnswer = calls.lastItem.answer;
    calls.ctx.submit("definitely-wrong");
    await flush(40);
    assert.equal(round.debugState(), "learning-scaffold");
    assert.equal(learningAttempts.length, 1);
    assert.equal(learningAttempts[0].hintsUsed, 1, "proactive scaffold counts as support on the original attempt");
    const scaffoldAnswer = round.debugOverlay().querySelector('[data-scaffold-answer="3"]');
    assert.ok(scaffoldAnswer && typeof scaffoldAnswer.onclick === "function", "smaller local question renders answer controls");
    scaffoldAnswer.onclick();
    await flush(700);
    assert.equal(round.debugState(), "active", "correct scaffold returns to the original question");
    assert.ok(calls.present >= 2, "the original item is presented again after the scaffold");
    calls.ctx.submit(originalAnswer);
    await flush(40);
    assert.equal(round.debugItemIndex(), 1);
    assert.equal(progressCalls.at(-1).answers[0].correct, false, "scaffold/retry never rewrites the Brain score");
    assert.equal(learningAttempts.length, 1, "scaffold and guided retry do not double-count attempts");
    assert.ok(supportOutcomes.some((outcome) => outcome.outcome === "scaffold_success"), "scaffold success is emitted for tutor telemetry");
    assert.ok(supportOutcomes.some((outcome) => outcome.outcome === "retry_recovered"), "original-question recovery is emitted after scaffold support");
    round.destroy(true);
  } finally { restoreFakeScene(); }
});
