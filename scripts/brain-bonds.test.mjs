import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { installDom } from "./dom-stub.mjs";
import { createScheduler } from "../js/game-services/scheduler.js";
import { createMotion } from "../js/game-services/motion.js";
import bonds, { pairAnswer } from "../js/brain/scenes/bonds.js";
import generic from "../js/brain/scenes/generic.js";
import { openRound } from "../js/brain/host.js";

installDom();
const require = createRequire(import.meta.url);
const data = require("../js/brain-data.js");
const core = require("../js/brain-core.js");
require("../js/brain-audio-cues.js");

function setup(tier = "tot", reducedMotion = false, sceneModule = bonds) {
  const scheduler = createScheduler();
  const previousMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: reducedMotion });
  const motion = createMotion(scheduler);
  globalThis.matchMedia = previousMatchMedia;
  const submitted = [], animations = [];
  const animate = scheduler.animate;
  scheduler.animate = (element, frames, options) => {
    animations.push(frames);
    return animate(element, frames, options);
  };
  const ctx = {
    mount: document.createElement("div"), gameId: "crunch", tier,
    scheduler, motion, reducedMotion, announce() {},
    audio: { play() {} }, submit(answer) { submitted.push(answer); return true; }
  };
  const item = core.buildRound("crunch", tier, core.mulberry32(12)).items[0];
  const scene = sceneModule.create(ctx);
  scene.present(item);
  return { ctx, item, scene, submitted, animations, cleanup() {
    scene.destroy(); scheduler.cancelAll(); motion.dispose();
  } };
}

test("Number Bonds has one real pair, four fallback choices, and serializable grading at every tier", () => {
  assert.deepEqual(data.GAMES.crunch.title, ["Number Bonds", "數字好朋友"]);
  assert.equal(data.GAMES.crunch.skill, "math");
  for (const [tier, count, min, max] of [["tot", 4, 5, 10], ["mid", 6, 10, 20], ["hard", 8, 20, 100]]) {
    for (let seed = 0; seed < 100; seed++) {
      const round = core.buildRound("crunch", tier, core.mulberry32(seed));
      for (const item of round.items) {
        const { tiles, target } = item.prompt;
        assert.equal(tiles.length, count);
        assert.equal(new Set(tiles).size, count);
        assert.ok(target >= min && target <= max);
        assert.ok(tiles.every(n => Number.isInteger(n) && n >= 0 && n <= target));
        const solutions = [];
        for (let i = 0; i < count; i++) {
          for (let j = i + 1; j < count; j++) {
            if (tiles[i] + tiles[j] === target) solutions.push(pairAnswer([tiles[i], tiles[j]]));
          }
        }
        assert.deepEqual(solutions, [item.answer]);
        assert.equal(new Set(item.choices).size, 4);
        assert.equal(item.choices.filter(choice => choice.split(" + ").map(Number).reduce((a, b) => a + b) === target).length, 1);
        assert.equal(core.gradeItem(JSON.parse(JSON.stringify(item)), item.answer).correct, true);
        assert.ok(item.say[0] && item.say[1] && item.prompt.en && item.prompt.zh);
      }
    }
  }
});

test("Number Bonds waits for two distinct tiles, preserves selection on pause, and submits only once", () => {
  const h = setup();
  const tiles = h.ctx.mount.querySelectorAll(".brain-bonds__tile");
  const pair = h.item.answer.split(" + ").map(Number).map(n => h.item.prompt.tiles.indexOf(n));
  tiles[pair[0]].onclick();
  assert.equal(h.submitted.length, 0, "input starts disabled");
  h.scene.setInputEnabled(true);
  tiles[pair[0]].onclick();
  tiles[pair[0]].onclick();
  assert.equal(h.submitted.length, 0, "the same tile cannot count twice");
  assert.equal(tiles[pair[0]].getAttribute("aria-pressed"), "false");
  tiles[pair[1]].onclick();
  h.scene.setInputEnabled(false);
  tiles[pair[0]].onclick();
  assert.equal(h.submitted.length, 0, "paused input is ignored");
  h.scene.setInputEnabled(true);
  assert.equal(tiles[pair[1]].getAttribute("aria-pressed"), "true");
  tiles[pair[0]].onclick();
  h.scene.setInputEnabled(true);
  tiles[pair[0]].onclick();
  assert.deepEqual(h.submitted, [h.item.answer], "either order grades identically, repeated input is ignored");
  assert.ok(tiles.every(button => button.disabled));
  h.cleanup();
  h.scene.destroy();
  assert.equal(h.ctx.mount.children.length, 0);
  assert.equal(h.ctx.scheduler.activeCount, 0);
});

test("Number Bonds highlights the correct pair after a wrong choice and resets on the next item", async () => {
  const h = setup("hard");
  h.scene.setInputEnabled(true);
  await h.scene.showFeedback({ correct: false, answer: h.item.answer });
  assert.equal(h.ctx.mount.querySelectorAll(".is-answer").length, 2);
  assert.equal(h.ctx.mount.querySelector(".brain-corrective").textContent, h.item.answer + " = " + h.item.prompt.target);
  h.scene.present(h.item);
  assert.equal(h.ctx.mount.querySelectorAll(".is-answer").length, 0);
  assert.ok(h.ctx.mount.querySelectorAll(".brain-bonds__slot").every(slot => slot.textContent === "?"));
  h.cleanup();
});

test("Number Bonds reduced motion removes tile rotation, scale and travel", () => {
  const h = setup("tot", true);
  h.scene.setInputEnabled(true);
  h.ctx.mount.querySelector(".brain-bonds__tile").onclick();
  assert.ok(h.animations.length >= 2);
  assert.ok(h.animations.every(frames => frames.every(frame => !("transform" in frame))));
  h.cleanup();
});

test("Number Bonds generic fallback can submit a complete pair", () => {
  const h = setup("mid", false, generic);
  h.scene.setInputEnabled(true);
  const answer = h.ctx.mount.querySelectorAll(".brain-key").find(button => button.dataset.v === h.item.answer);
  answer.onclick();
  assert.deepEqual(h.submitted, [h.item.answer]);
  h.cleanup();
});

test("host restarts legacy Number Cruncher saves but resumes serialized Number Bonds", async () => {
  const generated = core.buildRound("crunch", "tot", core.mulberry32(4));
  const saved = JSON.parse(JSON.stringify({
    gameId: "crunch", tier: "tot", idx: 2, items: generated.items,
    answers: generated.items.slice(0, 2).map(item => ({ given: item.answer, got: 1, worth: 1, correct: true })), ms: 0
  }));
  const legacy = { ...saved, items: saved.items.map(() => ({ prompt: { type: "countfield", glyphs: ["1", "1"], target: "1" }, answer: "2" })) };
  for (const [resume, expectedIndex] of [[legacy, 0], [saved, 2]]) {
    const round = openRound({ gameId: "crunch", tier: "tot", kid: "lucien", resume });
    try {
      await round.ready;
      assert.equal(round.debugItemIndex(), expectedIndex);
      assert.equal(round.debugState(), "active");
      const buttons = round.debugOverlay().querySelectorAll(".brain-bonds__tile");
      assert.equal(buttons.length, 4);
      if (resume === saved) {
        const current = saved.items[2];
        assert.deepEqual(buttons.map(button => Number(button.getAttribute("aria-label"))), current.prompt.tiles);
        for (const n of current.answer.split(" + ").map(Number)) buttons[current.prompt.tiles.indexOf(n)].onclick();
        assert.equal(round.debugState(), "feedback-correct", "JSON-restored pair still grades correctly");
      }
    } finally { round.destroy(true); }
    assert.equal(round.debugScheduler().activeCount, 0);
  }
});
