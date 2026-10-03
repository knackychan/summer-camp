import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { installDom } from "./dom-stub.mjs";
import { createScheduler } from "../js/game-services/scheduler.js";
import { createMotion } from "../js/game-services/motion.js";
import circuit from "../js/brain/scenes/circuit.js";
import sorter from "../js/brain/scenes/sorter.js";
import generic from "../js/brain/scenes/generic.js";

installDom();
const require = createRequire(import.meta.url);
const data = require("../js/brain-data.js");
const core = require("../js/brain-core.js");

function setup(sceneModule, tier = "tot", reduced = false, gameId = sceneModule.id) {
  const scheduler = createScheduler();
  const oldMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: reduced });
  const motion = createMotion(scheduler);
  globalThis.matchMedia = oldMatchMedia;
  const submitted = [], animations = [];
  const animate = scheduler.animate;
  scheduler.animate = (element, frames, options) => { animations.push(frames); return animate(element, frames, options); };
  const ctx = { mount: document.createElement("div"), tier, gameId, scheduler, motion, audio: { play() {} }, announce() {}, submit(value) { submitted.push(value); return true; } };
  const item = core.buildRound(gameId, tier, core.mulberry32(12)).items[0];
  const scene = sceneModule.create(ctx);
  scene.present(item);
  return { ctx, scene, item, submitted, animations, cleanup() { scene.destroy(); scheduler.cancelAll(); motion.dispose(); } };
}

test("science generators keep answers, choices and explanations valid after JSON saves", () => {
  for (const id of ["circuit", "sorter"]) {
    assert.equal(data.GAMES[id].skill, "science");
    for (const tier of data.TIERS) {
      for (let seed = 0; seed < 70; seed++) {
        const round = core.buildRound(id, tier, core.mulberry32(seed));
        assert.equal(round.items.length, tier === "tot" ? 6 : 8);
        assert.equal(round.pad, "choice");
        assert.equal(round.clock, tier !== "tot");
        for (const original of round.items) {
          const item = JSON.parse(JSON.stringify(original));
          assert.ok(item.prompt.en && item.prompt.zh && item.say[0] && item.say[1]);
          assert.ok(item.corrective[0] && item.corrective[1]);
          for (const field of ["topic", "hint", "explanation"]) {
            assert.equal(item.lesson[field].length, 2);
            assert.ok(item.lesson[field][0] && /[\u3400-\u9fff]/.test(item.lesson[field][1]));
          }
          assert.deepEqual(item.lesson.explanation, item.corrective);
          assert.notDeepEqual(item.lesson.hint, item.lesson.explanation);
          assert.equal(new Set(item.choices).size, item.choices.length);
          assert.ok(item.choices.includes(item.answer));
          assert.ok(item.choices.every(choice => /[\u3400-\u9fff]/.test(choice)));
          for (const choice of item.choices) assert.equal(core.gradeItem(item, choice).correct, choice === item.answer);
          assert.equal(core.gradeItem(item, "").correct, false);
          if (id === "circuit") {
            const p = item.prompt;
            assert.ok(p.en.includes("A " + (p.switches[0] ? "closed" : "open")));
            assert.ok(p.zh.includes("A " + (p.switches[0] ? "閉合" : "斷開")));
            if (p.mode === "predict") {
              const connected = p.layout === "parallel" ? p.switches.some(Boolean) : p.switches.every(Boolean);
              const powered = connected && (!p.materials.length || p.materials[p.materialIndex].conducts);
              assert.equal(item.answer, powered ? "Bulb on / 燈泡會亮" : "Bulb off / 燈泡不亮");
              assert.equal(item.choices.length, 2);
              if (p.layout === "parallel") assert.ok(p.en.includes("shared return path") && p.zh.includes("共用的回路"));
              if (p.materials.length) assert.ok(p.en.includes(p.materials[p.materialIndex].name[0]) && p.zh.includes(p.materials[p.materialIndex].name[1]));
            } else {
              const valid = p.configurations.filter(c => c.switches.every(Boolean) && (!p.materials.length || p.materials[c.material].conducts));
              assert.equal(valid.length, 1, "build mode has one working configuration");
              if (p.goalOn) assert.equal(valid[0].value, item.answer);
              else assert.equal(p.configurations.find(c => c.value === item.answer).switches[0], false);
            }
            if (tier === "hard" && p.mode === "build") {
              assert.equal(p.materials.filter(m => m.conducts).length, 1);
              assert.ok(p.materials.every(m => m.conducts === ["copper", "foil", "steel"].includes(m.id)));
            }
          }
        }
        if (id === "sorter") {
          assert.equal(new Set(round.items.map(item => item.prompt.specimen.id)).size, round.items.length);
          assert.ok(new Set(round.items.map(item => item.prompt.topicId)).size >= 3, "each round covers several science topics");
        } else {
          assert.ok(round.items.slice(0, 2).every(item => item.prompt.mode === "build"));
          assert.ok(round.items.slice(2).every(item => item.prompt.mode === "predict"));
          assert.equal(new Set(round.items.slice(2).map(item => item.answer)).size, 2, "predictions include on and off");
        }
      }
    }
  }
});

test("Science Sorter classifications cover common misconceptions and room-temperature states", () => {
  const seen = new Map();
  for (const tier of data.TIERS) for (let seed = 0; seed < 30; seed++) {
    for (const item of core.buildRound("sorter", tier, core.mulberry32(seed)).items) {
      seen.set(tier + ":" + item.prompt.specimen.id, item.answer);
      if (item.prompt.topicId === "states") assert.ok(item.prompt.en.includes("20°C") && item.prompt.zh.includes("20°C"));
    }
  }
  for (const [key, category] of [["hard:dolphin", "Mammal"], ["hard:bat", "Mammal"], ["hard:penguin", "Bird"], ["hard:shark", "Fish"], ["hard:turtle", "Reptile"], ["hard:frog", "Amphibian"], ["mid:oil", "Liquid"], ["mid:oxygen", "Gas"], ["tot:flower", "Plant"], ["tot:never-robot", "Never alive"], ["tot:living-seedling", "Living thing"], ["tot:plant-food", "Leaves"], ["mid:change-puddle", "Evaporation"], ["mid:change-glass", "Condensation"], ["mid:change-freezer", "Freezing"], ["mid:change-ice", "Melting"], ["hard:magnet-foil", "Magnet cannot"], ["hard:magnet-nail", "Magnet picks"], ["hard:conduct-copper", "Conductor"], ["hard:conduct-glass", "Insulator"]]) {
    assert.ok(seen.get(key).startsWith(category), key);
  }
});

test("prediction circuits conceal the result, lock the setup and reveal truthful series/parallel paths", () => {
  const h = setup(circuit, "hard");
  const prototype = core.buildRound("circuit", "hard", core.mulberry32(4)).items[4];
  for (const layout of ["series", "parallel"]) for (const conducts of [false, true]) for (const flags of [[false, false], [true, false], [false, true], [true, true]]) {
    const item = JSON.parse(JSON.stringify(prototype));
    item.prompt.layout = layout; item.prompt.switches = flags; item.prompt.materials[0].conducts = conducts;
    const connected = layout === "parallel" ? flags.some(Boolean) : flags.every(Boolean);
    item.answer = connected && conducts ? "Bulb on / 燈泡會亮" : "Bulb off / 燈泡不亮";
    h.scene.present(item);
    const board = h.ctx.mount.querySelector(".brain-circuit__board");
    const switches = h.ctx.mount.querySelectorAll(".brain-circuit__switch");
    const predictions = h.ctx.mount.querySelectorAll(".brain-circuit__prediction");
    assert.equal(board.getAttribute("data-powered"), "unknown");
    assert.equal(h.ctx.mount.querySelectorAll('.brain-circuit__branch[data-flow="true"]').length, 0);
    const count = h.submitted.length;
    predictions[0].onclick(); assert.equal(h.submitted.length, count);
    h.scene.setInputEnabled(true);
    assert.ok(switches.every(button => button.disabled));
    switches.forEach(button => button.onclick());
    assert.deepEqual(switches.map(button => button.getAttribute("aria-pressed")), flags.map(String));
    const choice = item.choices.indexOf(item.answer);
    predictions[choice].onclick(); predictions[choice].onclick();
    assert.equal(h.submitted.length, count + 1);
    assert.equal(h.submitted.at(-1), item.answer);
    assert.equal(board.getAttribute("data-powered"), "unknown", "submission waits for feedback before revealing the answer");
    h.scene.showFeedback({ correct: true, answer: item.answer });
    assert.equal(board.getAttribute("data-powered"), String(connected && conducts));
    assert.equal(h.ctx.mount.querySelectorAll(".is-answer").length, 1);
    const branches = h.ctx.mount.querySelectorAll(".brain-circuit__branch");
    assert.equal(branches.length, layout === "parallel" ? 2 : 0);
    branches.forEach((branch, i) => assert.equal(branch.getAttribute("data-flow"), String(conducts && flags[i])));
  }
  h.cleanup(); assert.equal(h.ctx.scheduler.activeCount, 0);
});

test("science scenes and fallback render every topic and accept legacy items without lesson metadata", () => {
  for (const sceneModule of [circuit, sorter]) {
    const h = setup(sceneModule, "hard");
    for (const tier of data.TIERS) for (let seed = 0; seed < 8; seed++) for (const item of core.buildRound(sceneModule.id, tier, core.mulberry32(seed)).items) {
      h.scene.present(JSON.parse(JSON.stringify(item)));
      assert.ok(!h.ctx.mount.querySelectorAll("path").some(path => path.getAttribute("d") === "undefined"));
      h.scene.setInputEnabled(true);
      h.scene.showFeedback({ correct: false, answer: item.answer });
      assert.ok(h.ctx.mount.querySelector(".brain-corrective").textContent.includes(item.lesson.explanation[1]));
    }
    const legacy = JSON.parse(JSON.stringify(h.item));
    delete legacy.lesson;
    for (const key of ["mode", "layout", "materialIndex", "instruction", "question", "topicId"]) delete legacy.prompt[key];
    if (legacy.prompt.specimen) delete legacy.prompt.specimen.icon;
    h.scene.present(legacy); h.scene.setInputEnabled(true);
    if (sceneModule === circuit) {
      const answer = legacy.prompt.configurations.find(c => c.value === legacy.answer);
      h.ctx.mount.querySelectorAll(".brain-circuit__switch").forEach((button, i) => { if (answer.switches[i] !== legacy.prompt.switches[i]) button.onclick(); });
      h.ctx.mount.querySelectorAll(".brain-circuit__material")[answer.material].onclick();
      h.ctx.mount.querySelector(".brain-circuit__check").onclick();
    } else h.ctx.mount.querySelectorAll(".brain-sorter__bin")[legacy.prompt.categories.findIndex(c => c.value === legacy.answer)].onclick();
    assert.equal(h.submitted.at(-1), legacy.answer);
    h.cleanup(); assert.equal(h.ctx.scheduler.activeCount, 0);
    const fallback = setup(generic, "hard", false, sceneModule.id);
    for (const item of core.buildRound(sceneModule.id, "hard", core.mulberry32(12)).items) {
      fallback.scene.present(item); fallback.scene.setInputEnabled(true);
      fallback.ctx.mount.querySelectorAll(".brain-key").find(button => button.dataset.v === item.answer).onclick();
      assert.equal(fallback.submitted.at(-1), item.answer);
    }
    fallback.cleanup();
  }
});

test("Circuit Builder computes powered state for every switch/material configuration and submits its serialized answer", () => {
  for (const tier of data.TIERS) {
    const h = setup(circuit, tier);
    for (const config of h.item.prompt.configurations) {
      h.scene.present(h.item);
      const buttons = h.ctx.mount.querySelectorAll(".brain-circuit__switch");
      buttons[0].onclick();
      assert.equal(buttons[0].getAttribute("aria-pressed"), String(h.item.prompt.switches[0]), "disabled input is ignored");
      h.scene.setInputEnabled(true);
      buttons.forEach((button, i) => { if (h.item.prompt.switches[i] !== config.switches[i]) button.onclick(); });
      const check = h.ctx.mount.querySelector(".brain-circuit__check");
      if (config.material >= 0) {
        assert.equal(check.disabled, true, "a material is required");
        const count = h.submitted.length;
        check.onclick(); assert.equal(h.submitted.length, count);
        h.ctx.mount.querySelectorAll(".brain-circuit__material")[config.material].onclick();
      }
      const powered = config.switches.every(Boolean) && (config.material < 0 || h.item.prompt.materials[config.material].conducts);
      assert.equal(h.ctx.mount.querySelector(".brain-circuit__board").getAttribute("data-powered"), String(powered));
      h.scene.setInputEnabled(false);
      check.onclick();
      buttons[0].onclick();
      assert.equal(buttons[0].getAttribute("aria-pressed"), String(config.switches[0]), "pause preserves the circuit");
      h.scene.setInputEnabled(true);
      const count = h.submitted.length;
      check.onclick(); check.onclick(); buttons[0].onclick();
      assert.equal(h.submitted.length, count + 1);
      assert.equal(h.submitted.at(-1), config.value);
      assert.ok(buttons.every(button => button.disabled));
    }
    h.cleanup(); h.scene.destroy();
    assert.equal(h.ctx.mount.children.length, 0);
    assert.equal(h.ctx.scheduler.activeCount, 0);
  }
});

test("Circuit Builder feedback demonstrates the correct loop and starts the next item fresh", () => {
  const h = setup(circuit, "hard");
  h.scene.showFeedback({ answer: h.item.answer, correct: false });
  assert.equal(h.ctx.mount.querySelector(".brain-circuit__board").getAttribute("data-powered"), "true");
  assert.equal(h.ctx.mount.querySelector(".brain-corrective").textContent, h.item.corrective.join(" / "));
  h.scene.present(h.item);
  assert.equal(h.ctx.mount.querySelector(".brain-circuit__board").getAttribute("data-powered"), "false");
  assert.ok(h.ctx.mount.querySelectorAll(".brain-circuit__material").every(button => button.getAttribute("aria-pressed") === "false"));
  h.cleanup();
  assert.equal(h.ctx.scheduler.activeCount, 0);
});

test("Science Sorter accepts one category, ignores paused input, reveals a bilingual reason, and cleans up", () => {
  const h = setup(sorter, "hard");
  const buttons = h.ctx.mount.querySelectorAll(".brain-sorter__bin");
  const answerIndex = h.item.prompt.categories.findIndex(c => c.value === h.item.answer);
  buttons[answerIndex].onclick(); assert.equal(h.submitted.length, 0);
  h.scene.setInputEnabled(true); h.scene.setInputEnabled(false);
  buttons[answerIndex].onclick(); assert.equal(h.submitted.length, 0);
  h.scene.setInputEnabled(true);
  buttons[answerIndex].onclick(); buttons[answerIndex].onclick();
  h.scene.setInputEnabled(true); buttons[answerIndex].onclick();
  assert.deepEqual(h.submitted, [h.item.answer]);
  assert.ok(buttons.every(button => button.disabled));
  h.scene.showFeedback({ correct: true, answer: h.item.answer });
  assert.equal(h.ctx.mount.querySelector(".brain-corrective").textContent, h.item.corrective.join(" / "));
  assert.equal(h.ctx.mount.querySelectorAll(".is-answer").length, 1);
  h.scene.present(h.item);
  assert.equal(h.ctx.mount.querySelectorAll(".is-answer").length, 0);
  h.cleanup(); h.scene.destroy();
  assert.equal(h.ctx.mount.children.length, 0);
  assert.equal(h.ctx.scheduler.activeCount, 0);
  buttons[0].onclick(); assert.equal(h.submitted.length, 1, "detached controls cannot submit");
});

test("science scenes honor reduced motion and their generic fallback choices grade correctly", () => {
  for (const sceneModule of [circuit, sorter]) {
    const h = setup(sceneModule, "tot", true);
    h.scene.setInputEnabled(true);
    h.ctx.mount.querySelector(sceneModule === circuit ? ".brain-circuit__switch" : ".brain-sorter__bin").onclick();
    assert.ok(h.animations.length >= 2);
    assert.ok(h.animations.every(frames => frames.every(frame => !("transform" in frame))));
    h.cleanup();
    for (const tier of data.TIERS) {
      const fallback = setup(generic, tier, false, sceneModule.id);
      fallback.scene.setInputEnabled(true);
      fallback.ctx.mount.querySelectorAll(".brain-key").find(button => button.dataset.v === fallback.item.answer).onclick();
      assert.deepEqual(fallback.submitted, [fallback.item.answer]);
      fallback.cleanup();
    }
  }
});
