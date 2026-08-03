/* Static scene contract + view-model tests (brain slice 34 task 6, slice 35).
   createMoneyTray is pure and needs nothing (guidelines §15.1: "scene modules MUST
   expose pure view-model helpers for node tests"). The DOM-touching parts reuse the
   same minimal fake DOM as brain-host.test.mjs so generic.js/change.js run for real,
   not through a fake scene. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { installDom } from "./dom-stub.mjs";
import { createScheduler } from "../js/game-services/scheduler.js";
import { createMotion } from "../js/game-services/motion.js";
import { createMoneyTray } from "../js/brain/scenes/change.js";
import sceneIndex from "../js/brain/scenes/index.js";
import generic from "../js/brain/scenes/generic.js";
import changeScene from "../js/brain/scenes/change.js";
import recallScene, { recallView } from "../js/brain/scenes/recall.js";

installDom();
const require = createRequire(import.meta.url);
const SQBrainData = require("../js/brain-data.js");
const SQBrainCore = require("../js/brain-core.js");
require("../js/brain-audio-cues.js");

function fakeCtx(overrides) {
  const scheduler = createScheduler();
  const motion = createMotion(scheduler);
  const submitted = [];
  const announced = [];
  const base = {
    mount: document.createElement("div"),
    gameId: "change", tier: "mid", kid: "lili",
    submit: function (v) { submitted.push(v); return true; },
    announce: function (pair) { announced.push(pair); },
    sayPair: function () {},
    audio: { play: function () { return { stop: function () {} }; }, unlock: function () {} },
    motion: motion,
    scheduler: scheduler,
    reducedMotion: false,
    random: Math.random
  };
  const ctx = Object.assign(base, overrides || {});
  ctx._submitted = submitted;
  ctx._announced = announced;
  return ctx;
}

/* ---------- createMoneyTray (pure model) ---------- */

test("createMoneyTray: add/undo/clear/total/groups/serialize", () => {
  const tray = createMoneyTray([50, 10, 5, 1]);
  assert.equal(tray.add(10), true);
  assert.equal(tray.add(10), true);
  assert.equal(tray.add(1), true);
  assert.equal(tray.total(), 21);
  assert.equal(tray.serialize(), "21");
  assert.deepEqual(tray.groups(), [{ value: 10, count: 2, subtotal: 20 }, { value: 1, count: 1, subtotal: 1 }]);
  assert.equal(tray.undo(), 1);
  assert.equal(tray.total(), 20);
  tray.clear();
  assert.equal(tray.total(), 0);
  assert.deepEqual(tray.groups(), []);
});

test("createMoneyTray: invalid denominations are ignored, not added", () => {
  const tray = createMoneyTray([50, 10]);
  assert.equal(tray.add(7), false);
  assert.equal(tray.total(), 0);
});

test("createMoneyTray: undo on empty tray returns null and does not throw", () => {
  const tray = createMoneyTray([1]);
  assert.equal(tray.undo(), null);
});

test("createMoneyTray: groups are sorted highest denomination first", () => {
  const tray = createMoneyTray([50, 10, 5, 1]);
  tray.add(1); tray.add(50); tray.add(5);
  assert.deepEqual(tray.groups().map((g) => g.value), [50, 5, 1]);
});

/* ---------- static scene manifest ---------- */

test("SCENE_LOADERS keys are all known brain-data game ids", () => {
  for (const id of Object.keys(sceneIndex)) {
    assert.ok(SQBrainData.GAMES[id], id + " has no matching brain-data.GAMES entry");
  }
});

test("bespoke and generic scenes report matching ids and create() functions", async () => {
  const loaded = await sceneIndex.change();
  assert.equal(loaded.default.id, "change");
  assert.equal(typeof loaded.default.create, "function");
  const loadedRecall = await sceneIndex.recall();
  assert.equal(loadedRecall.default.id, "recall");
  assert.equal(typeof loadedRecall.default.create, "function");
  assert.equal(generic.id, "generic");
  assert.equal(typeof generic.create, "function");
});

/* ---------- generic.js contract (behaviour parity with the pre-slice-34 renderer) ---------- */

test("generic scene: choice pad renders buttons and submits on tap", () => {
  const round = SQBrainCore.buildRound("stroop", "tot", SQBrainCore.mulberry32(5));
  const ctx = fakeCtx({ gameId: "stroop", tier: "tot" });
  const scene = generic.create(ctx);
  scene.present(round.items[0], { index: 0, count: round.items.length, isFirst: true, clocked: false });
  scene.setInputEnabled(true);
  const buttons = ctx.mount.querySelectorAll(".brain-key");
  assert.ok(buttons.length >= 2);
  buttons[0].onclick();
  assert.equal(ctx._submitted.length, 1);
  assert.equal(ctx._submitted[0], buttons[0].dataset.v);
  scene.destroy();
});

test("generic scene: clockface renders separate hour and minute hands", () => {
  const ctx = fakeCtx({ gameId: "clock", tier: "mid" });
  const scene = generic.create(ctx);
  const item = {
    prompt: { type: "clockface", h: 7, m: 35, en: "What time is it?", zh: "現在幾點？" },
    answer: "7:35",
    choices: ["7:35", "7:50", "6:35", "8:35"]
  };
  scene.present(item, { index: 0, count: 1, isFirst: true, clocked: true });
  assert.equal(ctx.mount.querySelectorAll(".bclockface__hand").length, 2);
  assert.ok(ctx.mount.querySelector(".bclockface__hand--hour"));
  assert.ok(ctx.mount.querySelector(".bclockface__hand--minute"));
  scene.destroy();
});

test("generic scene: keypad pad accumulates digits and submits on checkmark", () => {
  const round = SQBrainCore.buildRound("calc", "mid", SQBrainCore.mulberry32(9));
  const ctx = fakeCtx({ gameId: "calc", tier: "mid" });
  const scene = generic.create(ctx);
  scene.present(round.items[0], { index: 0, count: round.items.length, isFirst: true, clocked: true });
  scene.setInputEnabled(true);
  const press = (v) => ctx.mount.querySelectorAll(".brain-key").filter((b) => b.dataset.v === v)[0].onclick();
  press("1"); press("2"); press("✓");
  assert.deepEqual(ctx._submitted, ["12"]);
  scene.destroy();
});

test("generic scene: showFeedback on a wrong answer shows the corrective panel and resolves via the scheduler", async () => {
  const round = SQBrainCore.buildRound("stroop", "tot", SQBrainCore.mulberry32(5));
  const ctx = fakeCtx({ gameId: "stroop", tier: "tot" });
  const scene = generic.create(ctx);
  const item = round.items[0];
  scene.present(item, { index: 0, count: round.items.length, isFirst: true, clocked: false });
  const result = scene.showFeedback({ correct: false, got: 0, worth: 1, given: "x", answer: item.answer });
  const panel = ctx.mount.querySelector(".brain-corrective");
  assert.equal(panel.hidden, false);
  await result;
  scene.destroy();
});

/* ---------- recall.js contract ---------- */

test("recallView: shows the current sum result as the next thing to remember", () => {
  const item = {
    shown: "9",
    answer: "7",
    prompt: { en: "4 + 5 = ?", zh: "4 + 5 = ?" }
  };
  assert.deepEqual(recallView(item), {
    first: false,
    oldValue: "7",
    freshValue: "9",
    freshText: "4 + 5 = 9"
  });
});

test("recall scene: first item renders a Next button instead of answer choices", () => {
  const round = SQBrainCore.buildRound("recall", "tot", SQBrainCore.mulberry32(41));
  const ctx = fakeCtx({ gameId: "recall", tier: "tot" });
  const scene = recallScene.create(ctx);
  scene.present(round.items[0], { index: 0, count: round.items.length, isFirst: true, clocked: false });
  scene.setInputEnabled(true);
  assert.ok(ctx.mount.querySelector(".brain-recall--first"));
  assert.equal(ctx.mount.querySelectorAll(".brain-key").length, 0);
  ctx.mount.querySelector("[data-next]").onclick();
  assert.deepEqual(ctx._submitted, [""]);
  scene.destroy();
});

test("recall scene: choice tier submits the old answer, not the new value", () => {
  const round = SQBrainCore.buildRound("recall", "tot", SQBrainCore.mulberry32(41));
  const ctx = fakeCtx({ gameId: "recall", tier: "tot" });
  const scene = recallScene.create(ctx);
  const item = round.items[1];
  scene.present(item, { index: 1, count: round.items.length, isFirst: false, clocked: false });
  scene.setInputEnabled(true);
  assert.equal(ctx.mount.querySelector(".brain-recall__old-value").textContent, item.answer);
  const correct = ctx.mount.querySelectorAll(".brain-key").filter((b) => b.dataset.v === item.answer)[0];
  correct.onclick();
  assert.deepEqual(ctx._submitted, [item.answer]);
  scene.destroy();
});

test("recall scene: keypad tier accumulates digits and submits on checkmark", () => {
  const round = SQBrainCore.buildRound("recall", "mid", SQBrainCore.mulberry32(41));
  const ctx = fakeCtx({ gameId: "recall", tier: "mid" });
  const scene = recallScene.create(ctx);
  const item = round.items[1];
  scene.present(item, { index: 1, count: round.items.length, isFirst: false, clocked: true });
  scene.setInputEnabled(true);
  const press = (v) => ctx.mount.querySelectorAll(".brain-key").filter((b) => b.dataset.v === v)[0].onclick();
  item.answer.split("").forEach(press);
  press("✓");
  assert.deepEqual(ctx._submitted, [item.answer]);
  scene.destroy();
});

/* ---------- change.js contract (slice 35) ---------- */

test("change scene: tot presents two coins and submits the tapped value", () => {
  const round = SQBrainCore.buildRound("change", "tot", SQBrainCore.mulberry32(4));
  const ctx = fakeCtx({ gameId: "change", tier: "tot" });
  const scene = changeScene.create(ctx);
  const item = round.items[0];
  scene.present(item, { index: 0, count: round.items.length, isFirst: true, clocked: false });
  scene.setInputEnabled(true);
  const tokens = ctx.mount.querySelectorAll(".brain-change__token");
  assert.equal(tokens.length, 2);
  tokens[0].onclick();
  assert.deepEqual(ctx._submitted, [String(item.prompt.coins[0])]);
  scene.destroy();
});

test("change scene: mid shop renders the drawer, adds tokens to the tray, and Give change submits the total", async () => {
  const round = SQBrainCore.buildRound("change", "mid", SQBrainCore.mulberry32(23));
  const ctx = fakeCtx({ gameId: "change", tier: "mid" });
  const scene = changeScene.create(ctx);
  const item = round.items[0];
  scene.present(item, { index: 0, count: round.items.length, isFirst: true, clocked: true });
  await new Promise((resolve) => setTimeout(resolve, 20));
  scene.setInputEnabled(true);

  const denomButtons = ctx.mount.querySelectorAll(".brain-change__token");
  assert.equal(denomButtons.length, item.prompt.denominations.length);

  // add pieces until the tray totals the expected change, then give change
  let total = 0;
  const target = Number(item.answer);
  const byValue = {};
  denomButtons.forEach((b) => { byValue[b.dataset.v] = b; });
  const sortedDenoms = item.prompt.denominations.slice().sort((a, b) => b - a);
  for (const d of sortedDenoms) {
    while (total + d <= target) { byValue[String(d)].onclick(); total += d; }
  }
  assert.equal(total, target, "greedy fill must reach the exact generated change");

  const giveBtn = ctx.mount.querySelector('[data-act="give"]');
  assert.equal(giveBtn.disabled, false);
  giveBtn.onclick();
  assert.deepEqual(ctx._submitted, [String(target)]);
  scene.destroy();
});

test("change scene: undo removes exactly the last piece", () => {
  const round = SQBrainCore.buildRound("change", "mid", SQBrainCore.mulberry32(23));
  const ctx = fakeCtx({ gameId: "change", tier: "mid" });
  const scene = changeScene.create(ctx);
  const item = round.items[0];
  scene.present(item, { index: 0, count: round.items.length, isFirst: true, clocked: true });
  scene.setInputEnabled(true);
  const denomButtons = ctx.mount.querySelectorAll(".brain-change__token");
  denomButtons[0].onclick();
  const totalAfterAdd = ctx.mount.querySelector(".brain-change__tray-total").textContent;
  assert.equal(totalAfterAdd, "NT$" + denomButtons[0].dataset.v);
  ctx.mount.querySelector('[data-act="undo"]').onclick();
  assert.equal(ctx.mount.querySelector(".brain-change__tray-total").textContent, "NT$0");
  scene.destroy();
});

test("change scene: destroy is idempotent and clears the mount", () => {
  const round = SQBrainCore.buildRound("change", "tot", SQBrainCore.mulberry32(4));
  const ctx = fakeCtx({ gameId: "change", tier: "tot" });
  const scene = changeScene.create(ctx);
  scene.present(round.items[0], { index: 0, count: round.items.length, isFirst: true, clocked: false });
  scene.destroy();
  scene.destroy();
  assert.equal(ctx.mount.children.length, 0);
});
