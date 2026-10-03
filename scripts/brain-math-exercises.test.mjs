import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { installDom } from "./dom-stub.mjs";
import { createScheduler } from "../js/game-services/scheduler.js";
import { createMotion } from "../js/game-services/motion.js";
import fractions from "../js/brain/scenes/fractions.js";
import balance, { leftValue } from "../js/brain/scenes/balance.js";
import generic from "../js/brain/scenes/generic.js";

installDom();
const require = createRequire(import.meta.url);
const data = require("../js/brain-data.js");
const core = require("../js/brain-core.js");
const modules = { fractions, balance };

function setup(id, tier = "hard", reduced = false, module = modules[id], providedItem = null) {
  const scheduler = createScheduler();
  const previousMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: reduced });
  const motion = createMotion(scheduler);
  globalThis.matchMedia = previousMatchMedia;
  const submitted = [], animations = [], announcements = [];
  const animate = scheduler.animate;
  scheduler.animate = (element, frames, options) => { animations.push(frames); return animate(element, frames, options); };
  const ctx = {
    mount: document.createElement("div"), gameId: id, tier, scheduler, motion,
    reducedMotion: reduced, audio: { play() {} }, announce(pair) { announcements.push(pair); },
    submit(answer) { submitted.push(answer); return true; }
  };
  const item = JSON.parse(JSON.stringify(providedItem || core.buildRound(id, tier, core.mulberry32(12)).items[0]));
  const scene = module.create(ctx);
  scene.present(item);
  return { ctx, item, scene, submitted, animations, announcements, cleanup() {
    scene.destroy(); scheduler.cancelAll(); motion.dispose();
    assert.equal(ctx.mount.children.length, 0);
    assert.equal(scheduler.activeCount, 0);
  } };
}

test("math exercise generators preserve solvable bilingual, numeric, serialized rounds at every tier", () => {
  for (const id of ["fractions", "balance"]) {
    for (const tier of ["tot", "mid", "hard"]) {
      for (let seed = 0; seed < 100; seed++) {
        const round = core.buildRound(id, tier, core.mulberry32(seed));
        assert.equal(round.items.length, tier === "tot" ? 6 : 8);
        assert.equal(round.clock, tier !== "tot");
        assert.equal(round.pad, "choice");
        assert.deepEqual(round, core.buildRound(id, tier, core.mulberry32(seed)), "seed is deterministic");
        const signatures = round.items.map(({ prompt: p }) => id === "fractions" ? [p.mode, p.numerator, p.denominator, p.pieces].join(":") : [p.op, p.missing, p.a, p.target].join(":"));
        assert.equal(new Set(signatures).size, round.items.length, "a round never repeats the same mathematical question");
        for (const item of round.items) {
          const p = item.prompt, answer = Number(item.answer);
          assert.ok(Number.isInteger(answer) && answer >= 0);
          assert.ok(p.en && p.zh && item.say[0] && item.say[1]);
          for (const pair of [item.lesson.topic, item.lesson.hint, item.lesson.explanation]) assert.ok(pair[0] && pair[1]);
          assert.ok(item.lesson.explanation[0].includes("="), "lesson contains a worked calculation");
          assert.ok(!item.lesson.hint[0].includes("="), "strategy hints do not fill in the answer");
          assert.equal(new Set(item.choices).size, item.choices.length);
          assert.equal(item.choices.filter(choice => choice === item.answer).length, 1);
          assert.equal(core.gradeItem(JSON.parse(JSON.stringify(item)), item.answer).correct, true);
          assert.equal(core.gradeItem(item, item.choices.find(choice => choice !== item.answer)).correct, false);
          if (id === "fractions") {
            assert.ok(p.pieces >= 2 && p.pieces <= 12);
            assert.ok(answer > 0 && answer < p.pieces);
            assert.equal(answer * p.denominator, (p.mode === "left" ? p.denominator - p.numerator : p.numerator) * p.pieces, "visual answer equals the requested share or complement");
            assert.ok(p.columns >= 2 && p.columns <= 5 && p.pieces % p.columns === 0, "food forms equal complete rows");
            assert.ok(item.choices.every(choice => Number(choice) >= 0 && Number(choice) <= p.pieces));
            if (tier === "tot") assert.ok([2, 4].includes(p.denominator));
            if (tier === "hard") assert.ok(p.pieces > p.denominator, "equivalence needs a distinct drawing denominator");
          } else {
            assert.equal(leftValue(p, answer), p.target);
            assert.equal(item.choices.length, 4);
            assert.deepEqual(p.blocks, item.choices.map(Number));
            assert.equal(p.blocks.filter(n => leftValue(p, n) === p.target).length, 1);
            if (p.op === "÷") assert.ok(p.blocks.every(n => Number.isInteger(leftValue(p, n)) && n > 0), "division distractors stay exact with no zero divisors");
            if (tier === "tot") assert.ok(["+", "−"].includes(p.op));
          }
        }
        if (id === "fractions") {
          assert.equal(round.items[0].prompt.mode, "share");
          assert.equal(round.items.at(-1).prompt.mode, "left");
          assert.ok(round.items.every((item, i) => !i || item.prompt.food !== round.items[i - 1].prompt.food));
          if (tier === "mid") {
            assert.ok(round.items.slice(0, 4).every(item => item.prompt.pieces === item.prompt.denominator));
            assert.ok(round.items.slice(4).every(item => item.prompt.pieces > item.prompt.denominator));
          }
        } else {
          assert.deepEqual([...new Set(round.items.map(item => item.prompt.missing))].sort(), ["left", "right"]);
          assert.equal(new Set(round.items.map(item => item.prompt.op)).size, tier === "tot" ? 2 : 4);
        }
      }
      assert.ok(data.GAMES[id].title[1] && data.GAMES[id].blurb[1]);
      assert.ok(data.GAMES[id].tiers[tier].gen(core.mulberry32(9)).lesson, "standalone generation supports omitted ctx");
    }
  }
});

test("Fraction Picnic allows reversals and pause, then submits the chosen share only once", () => {
  const h = setup("fractions");
  const pieces = h.ctx.mount.querySelectorAll(".brain-fractions__piece");
  const share = h.ctx.mount.querySelector('[data-act="share"]');
  assert.ok(pieces.every(button => button.disabled));
  pieces[0].onclick();
  assert.equal(pieces[0].getAttribute("aria-pressed"), "false");
  h.scene.setInputEnabled(true);
  assert.equal(share.disabled, true);
  pieces[0].onclick(); pieces[0].onclick();
  assert.equal(share.disabled, true, "tapping again returns a piece");
  h.ctx.mount.querySelector('[data-act="undo"]').onclick();
  assert.equal(pieces[0].getAttribute("aria-pressed"), "true");
  h.scene.setInputEnabled(false);
  pieces[1].onclick(); share.onclick();
  assert.deepEqual(h.submitted, []);
  h.scene.setInputEnabled(true);
  assert.equal(pieces[0].getAttribute("aria-pressed"), "true");
  h.ctx.mount.querySelector('[data-act="reset"]').onclick();
  assert.equal(h.ctx.mount.querySelector('[data-act="undo"]').disabled, true);
  for (let i = 0; i < Number(h.item.answer); i++) pieces[i].onclick();
  share.onclick(); share.onclick();
  h.scene.setInputEnabled(true); pieces[0].onclick();
  assert.deepEqual(h.submitted, [h.item.answer]);
  assert.ok(h.ctx.mount.querySelectorAll("button").every(button => button.disabled));
  h.cleanup(); h.scene.destroy(); pieces[0].onclick();
  assert.deepEqual(h.submitted, [h.item.answer]);
});

test("Fraction Picnic wrong shares reveal the equivalent share and a new item resets", async () => {
  const h = setup("fractions");
  h.scene.setInputEnabled(true);
  const wrong = Number(h.item.answer) === 1 ? 2 : 1;
  for (let i = 0; i < wrong; i++) h.ctx.mount.querySelectorAll(".brain-fractions__piece")[i].onclick();
  h.ctx.mount.querySelector('[data-act="share"]').onclick();
  assert.equal(core.gradeItem(h.item, h.submitted[0]).correct, false);
  await h.scene.showFeedback({ correct: false, answer: h.item.answer });
  assert.equal(h.ctx.mount.querySelectorAll(".is-answer").length, Number(h.item.answer));
  assert.equal(h.ctx.mount.querySelector(".brain-fractions__count").textContent, h.item.answer + " / " + h.item.prompt.pieces);
  h.scene.present(h.item);
  assert.equal(h.ctx.mount.querySelectorAll(".is-answer").length, 0);
  assert.equal(h.ctx.mount.querySelector(".brain-fractions__count").textContent, "0 / " + h.item.prompt.pieces);
  h.cleanup();
});

test("Balance Lab compares actual values, undoes replacements, pauses, and guards duplicate checks", () => {
  const h = setup("balance");
  const blocks = h.ctx.mount.querySelectorAll(".brain-balance__block");
  const correct = blocks.find(button => button.dataset.value === h.item.answer);
  const wrong = blocks.find(button => button.dataset.value !== h.item.answer);
  const check = h.ctx.mount.querySelector('[data-act="check"]');
  correct.onclick();
  assert.equal(h.ctx.mount.querySelector(".brain-balance__slot").textContent, "?");
  h.scene.setInputEnabled(true);
  assert.equal(check.disabled, true);
  wrong.onclick();
  const actual = leftValue(h.item.prompt, Number(wrong.dataset.value));
  assert.equal(h.ctx.mount.querySelector(".brain-balance__left-value").textContent, String(actual));
  assert.equal(h.ctx.mount.querySelector(".brain-balance__relation").textContent, actual < h.item.prompt.target ? "<" : ">");
  correct.onclick();
  assert.equal(h.ctx.mount.querySelector(".brain-balance__relation").textContent, "=");
  h.ctx.mount.querySelector('[data-act="undo"]').onclick();
  assert.equal(wrong.getAttribute("aria-pressed"), "true");
  h.scene.setInputEnabled(false); correct.onclick(); check.onclick();
  assert.deepEqual(h.submitted, []);
  h.scene.setInputEnabled(true);
  h.ctx.mount.querySelector('[data-act="reset"]').onclick();
  assert.equal(check.disabled, true);
  correct.onclick(); check.onclick(); check.onclick();
  h.scene.setInputEnabled(true); wrong.onclick();
  assert.deepEqual(h.submitted, [h.item.answer]);
  assert.ok(h.ctx.mount.querySelectorAll("button").every(button => button.disabled));
  h.cleanup(); h.scene.destroy(); wrong.onclick();
});

test("Balance Lab corrects a wrong block and resets the next equation", async () => {
  const h = setup("balance", "mid");
  h.scene.setInputEnabled(true);
  h.ctx.mount.querySelectorAll(".brain-balance__block").find(button => button.dataset.value !== h.item.answer).onclick();
  h.ctx.mount.querySelector('[data-act="check"]').onclick();
  assert.equal(core.gradeItem(h.item, h.submitted[0]).correct, false);
  await h.scene.showFeedback({ correct: false, answer: h.item.answer });
  assert.equal(h.ctx.mount.querySelector(".brain-balance__relation").textContent, "=");
  assert.equal(h.ctx.mount.querySelector(".brain-balance__slot").textContent, h.item.answer);
  assert.ok(h.announcements.every(pair => pair[0] && pair[1]));
  h.scene.present(h.item);
  assert.equal(h.ctx.mount.querySelector(".brain-balance__relation").textContent, "?");
  h.cleanup();
});

test("both math scenes remove animated travel with reduced motion and retain numeric fallback", () => {
  for (const id of ["fractions", "balance"]) {
    const h = setup(id, "tot", true);
    h.scene.setInputEnabled(true);
    h.ctx.mount.querySelector(id === "fractions" ? ".brain-fractions__piece" : ".brain-balance__block").onclick();
    assert.ok(h.animations.length > 0);
    assert.ok(h.animations.every(frames => frames.every(frame => !("transform" in frame))));
    h.cleanup();
    const fallback = setup(id, "hard", false, generic);
    fallback.scene.setInputEnabled(true);
    fallback.ctx.mount.querySelectorAll(".brain-key").find(button => button.dataset.v === fallback.item.answer).onclick();
    assert.deepEqual(fallback.submitted, [fallback.item.answer]);
    fallback.cleanup();
  }
});

test("Fraction Picnic asks for the complement and reveals that fraction after a wrong share", async () => {
  const item = core.buildRound("fractions", "mid", core.mulberry32(8)).items[6];
  const h = setup("fractions", "mid", false, fractions, item);
  assert.equal(item.prompt.mode, "left");
  assert.equal(h.ctx.mount.querySelector(".brain-fractions").dataset.mode, "left");
  assert.ok(h.ctx.mount.querySelector(".brain-fractions__hint").textContent.includes("pieces left"));
  h.scene.setInputEnabled(true);
  const pieces = h.ctx.mount.querySelectorAll(".brain-fractions__piece");
  const wrong = Number(item.answer) === 1 ? 2 : 1;
  pieces.slice(0, wrong).forEach(button => button.onclick());
  h.ctx.mount.querySelector('[data-act="share"]').onclick();
  assert.equal(core.gradeItem(item, h.submitted[0]).correct, false);
  await h.scene.showFeedback({ correct: false, answer: item.answer });
  assert.equal(h.ctx.mount.querySelector(".brain-corrective").textContent, item.answer + " / " + item.prompt.pieces + " = " + (item.prompt.denominator - item.prompt.numerator) + " / " + item.prompt.denominator);
  assert.equal(h.ctx.mount.querySelectorAll(".is-answer").length, Number(item.answer));
  h.cleanup();
});

test("Balance Lab puts the missing operand in the right place and compares both exact-division forms", () => {
  for (const p of [
    { a: 3, op: "−", missing: "left", target: 5, blocks: [6, 7, 8, 9], answer: "8" },
    { a: 4, op: "÷", missing: "left", target: 3, blocks: [4, 8, 12, 16], answer: "12" },
    { a: 24, op: "÷", missing: "right", target: 6, blocks: [2, 3, 4, 6], answer: "4" }
  ]) {
    const h = setup("balance", "hard", false, balance, { prompt: p, answer: p.answer });
    const equation = h.ctx.mount.querySelector(".brain-balance__equation");
    const expected = (p.missing === "left" ? "?" : p.a) + p.op + (p.missing === "left" ? p.a : "?") + "=" + p.target;
    assert.equal(equation.textContent, expected);
    h.scene.setInputEnabled(true);
    for (const button of h.ctx.mount.querySelectorAll(".brain-balance__block")) {
      button.onclick();
      const n = Number(button.dataset.value), result = p.op === "−" ? n - p.a : p.missing === "left" ? n / p.a : p.a / n;
      assert.equal(h.ctx.mount.querySelector(".brain-balance__left-value").textContent, String(result));
      assert.equal(h.ctx.mount.querySelector(".brain-balance__relation").textContent, result === p.target ? "=" : result < p.target ? "<" : ">");
    }
    h.ctx.mount.querySelectorAll(".brain-balance__block").find(button => button.dataset.value === p.answer).onclick();
    h.ctx.mount.querySelector('[data-act="check"]').onclick();
    assert.deepEqual(h.submitted, [p.answer]);
    h.cleanup();
  }
});

test("math scenes still render and grade serialized saves from before lesson variants", () => {
  const legacy = {
    fractions: { prompt: { numerator: 1, denominator: 2, pieces: 4 }, answer: "2" },
    balance: { prompt: { a: 3, op: "−", target: 1, blocks: [0, 1, 2, 3] }, answer: "2" }
  };
  for (const [id, item] of Object.entries(legacy)) {
    const h = setup(id, "tot", false, modules[id], item);
    h.scene.setInputEnabled(true);
    if (id === "fractions") {
      assert.equal(h.ctx.mount.querySelector(".brain-fractions").dataset.mode, "share");
      h.ctx.mount.querySelectorAll(".brain-fractions__piece").slice(0, 2).forEach(button => button.onclick());
      h.ctx.mount.querySelector('[data-act="share"]').onclick();
    } else {
      assert.equal(h.ctx.mount.querySelector(".brain-balance__equation").textContent, "3−?=1");
      h.ctx.mount.querySelector('[data-value="2"]').onclick();
      h.ctx.mount.querySelector('[data-act="check"]').onclick();
    }
    assert.equal(core.gradeItem(item, h.submitted[0]).correct, true);
    h.cleanup();
  }
});
