import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { installDom } from "./dom-stub.mjs";
import memorymatch from "../js/brain/scenes/memorymatch.js";
import patternecho from "../js/brain/scenes/patternecho.js";
import generic from "../js/brain/scenes/generic.js";

installDom();
const require = createRequire(import.meta.url);
const data = require("../js/brain-data.js");
const core = require("../js/brain-core.js");

function manualScheduler() {
  let now = 0, disposed = false;
  const jobs = new Set();
  return {
    after(ms, run) { const job = { at: now + ms, run }; if (!disposed) jobs.add(job); return () => jobs.delete(job); },
    advance(ms) {
      const until = now + ms;
      let guard = 100;
      while (jobs.size) {
        const job = [...jobs].sort((a, b) => a.at - b.at)[0];
        if (job.at > until) break;
        assert.ok(guard-- > 0, "scheduled work must finish");
        jobs.delete(job); now = job.at; job.run();
      }
      now = until;
    },
    cancelAll() { disposed = true; jobs.clear(); },
    get activeCount() { return jobs.size; }
  };
}

function setup(sceneModule, tier = "tot", gameId = sceneModule.id, seed = 12, index = 0) {
  const scheduler = manualScheduler(), submitted = [], announcements = [];
  const ctx = {
    mount: document.createElement("div"), gameId, tier, scheduler,
    motion: { tokens: { move: 320 }, move() {}, emphasize() {} },
    audio: { play() {} }, announce(words) { announcements.push(words); },
    submit(value) { submitted.push(value); return true; }
  };
  const item = JSON.parse(JSON.stringify(core.buildRound(gameId, tier, core.mulberry32(seed)).items[index]));
  const scene = sceneModule.create(ctx);
  const presenting = scene.present(item);
  return { ctx, scene, item, submitted, announcements, presenting, cleanup() { scene.destroy(); scheduler.cancelAll(); } };
}

test("memory generators produce deterministic paired decks, valid sequences and serializable choices", () => {
  for (const id of ["memorymatch", "patternecho"]) {
    assert.equal(data.GAMES[id].skill, "memory");
    for (const tier of data.TIERS) {
      for (let seed = 0; seed < 100; seed++) {
        const round = core.buildRound(id, tier, core.mulberry32(seed));
        assert.deepEqual(round, core.buildRound(id, tier, core.mulberry32(seed)));
        assert.equal(round.clock, tier !== "tot");
        assert.equal(round.pad, "choice");
        assert.equal(round.items.length, 6);
        for (const [index, original] of round.items.entries()) {
          const item = JSON.parse(JSON.stringify(original)), p = item.prompt;
          const expectedSizes = id === "memorymatch" ? { tot: [2,2,2,2,2,2], mid: [3,3,4,4,4,4], hard: [4,4,5,5,6,6] } : { tot: [2,2,3,3,3,3], mid: [3,3,4,4,5,5], hard: [4,4,5,5,6,6] };
          const size = expectedSizes[tier][index];
          assert.ok(p.en && p.zh && item.corrective[0] && item.corrective[1]);
          for (const field of ["topic", "hint", "explanation"]) {
            assert.equal(item.lesson[field].length, 2);
            assert.ok(item.lesson[field][0] && /[\u3400-\u9fff]/.test(item.lesson[field][1]));
          }
          assert.deepEqual(item.lesson.explanation, item.corrective);
          assert.notDeepEqual(item.lesson.hint, item.lesson.explanation);
          assert.equal(new Set(item.choices).size, p.mode === "all" && size === 2 ? 3 : 4);
          assert.equal(item.choices.filter(value => core.gradeItem(item, value).correct).length, 1);
          assert.equal(core.gradeItem(item, item.answer).correct, true);
          assert.equal(core.gradeItem(item, "").correct, false);
          if (id === "memorymatch") {
            const allPairs = tier === "tot" ? index >= 4 : tier === "mid" ? index >= 2 : index >= 1;
            assert.equal(p.mode, allPairs ? "all" : "pair");
            assert.equal(p.cards.length, 2 * size);
            assert.equal(new Set(p.cards).size, size);
            assert.ok(p.studyMs > 0);
            for (const symbol of new Set(p.cards)) {
              assert.equal(p.cards.filter(value => value === symbol).length, 2);
              assert.ok(p.symbols[symbol][0] && p.symbols[symbol][1]);
            }
            const places = p.cards.map((symbol, i) => symbol === p.target ? i + 1 : 0).filter(Boolean);
            assert.equal(places.length, 2);
            if (allPairs) {
              const expectedPairs = [...new Set(p.cards)].map(symbol => p.cards.map((value, i) => value === symbol ? i + 1 : 0).filter(Boolean)).sort((a, b) => a[0] - b[0]);
              assert.equal(item.answer, expectedPairs.map(pair => pair.join(",")).join(";"));
              assert.equal(core.gradeItem(item, "needs-practice").correct, false);
              for (const choice of item.choices) {
                const pairs = choice.split(";").map(pair => pair.split(",").map(Number));
                assert.equal(pairs.length, size);
                assert.deepEqual(pairs.flat().sort((a, b) => a - b), Array.from({ length: p.cards.length }, (_, i) => i + 1), "each fallback partitions every card exactly once");
                assert.ok(pairs.every(([first, second], i) => first < second && (i === 0 || pairs[i - 1][0] < first)), "pair serialization is canonical");
                assert.equal(pairs.every(([first, second]) => p.cards[first - 1] === p.cards[second - 1]), choice === item.answer);
              }
            } else {
              assert.equal(item.answer, places.join(","));
              for (const choice of item.choices) {
                const [first, second] = choice.split(",").map(Number);
                assert.ok(first >= 1 && second <= p.cards.length && first < second);
                assert.equal(p.cards[first - 1] === p.target && p.cards[second - 1] === p.target, choice === item.answer);
              }
            }
          } else {
            assert.equal(p.confirm, true);
            assert.equal(p.reverse, tier === "hard" && index % 2 === 1);
            assert.equal(p.sequence.length, size);
            assert.ok(p.stepMs > 0);
            assert.ok(p.sequence.every(n => Number.isInteger(n) && n >= 1 && n <= 4));
            assert.equal(item.answer, (p.reverse ? p.sequence.slice().reverse() : p.sequence).join(","));
            if (p.reverse) {
              assert.notEqual(item.answer, p.sequence.join(","), "reverse challenges are never palindromes");
              assert.equal(core.gradeItem(item, p.sequence.join(",")).correct, false, "copying the shown order is incorrect in reverse mode");
            }
            for (const choice of item.choices) {
              const sequence = choice.split(",").map(Number);
              assert.equal(sequence.length, size);
              assert.ok(sequence.every(n => Number.isInteger(n) && n >= 1 && n <= 4));
            }
          }
        }
      }
    }
  }
});

test("Memory Match hides the target during study, gates taps, and submits two distinct positions once", async () => {
  const h = setup(memorymatch, "hard");
  const cards = h.ctx.mount.querySelectorAll(".brain-memory__card");
  assert.notEqual(h.ctx.mount.querySelector(".brain-memory__target").getAttribute("hidden"), null);
  assert.equal(h.ctx.mount.querySelectorAll(".brain-memory__symbol").length, cards.length + 1);
  h.scene.setInputEnabled(true);
  cards[0].onclick(); cards[1].onclick();
  assert.equal(h.submitted.length, 0);
  assert.ok(cards.every(card => card.disabled));
  h.ctx.scheduler.advance(h.item.prompt.studyMs - 1);
  assert.equal(h.ctx.mount.querySelectorAll(".brain-memory__back").length, 0);
  h.ctx.scheduler.advance(1); await h.presenting;
  assert.equal(h.ctx.mount.querySelectorAll(".brain-memory__back").length, cards.length);
  assert.equal(h.ctx.mount.querySelector(".brain-memory__target").hidden, false);
  assert.ok(cards.every(card => !card.disabled));
  const [first, second] = h.item.answer.split(",").map(n => Number(n) - 1);
  cards[second].onclick(); cards[second].onclick();
  assert.equal(h.submitted.length, 0, "the same card cannot fill both positions");
  assert.equal(cards[second].getAttribute("aria-pressed"), "true");
  h.scene.setInputEnabled(false); cards[first].onclick();
  assert.equal(h.submitted.length, 0, "pause ignores card taps");
  h.scene.setInputEnabled(true); cards[first].onclick(); cards[first].onclick();
  h.scene.setInputEnabled(true); cards[0].onclick();
  assert.deepEqual(h.submitted, [h.item.answer], "reverse selection order uses the canonical pair");
  assert.ok(cards.every(card => card.disabled));
  h.cleanup();
  assert.equal(h.ctx.scheduler.activeCount, 0);
});

test("Memory Match correct and wrong feedback reveal the target pair and reset the next item", async () => {
  for (const correct of [true, false]) {
    const h = setup(memorymatch, "mid");
    h.ctx.scheduler.advance(h.item.prompt.studyMs); await h.presenting;
    h.scene.setInputEnabled(true);
    const value = correct ? h.item.answer : h.item.choices.find(choice => choice !== h.item.answer);
    for (const position of value.split(",").map(Number)) h.ctx.mount.querySelectorAll(".brain-memory__card")[position - 1].onclick();
    assert.equal(core.gradeItem(h.item, h.submitted[0]).correct, correct);
    const feedback = h.scene.showFeedback({ correct, answer: h.item.answer });
    assert.equal(h.ctx.mount.querySelectorAll(".is-answer").length, 2);
    assert.equal(h.ctx.mount.querySelectorAll(".brain-memory__back").length, 0);
    assert.equal(h.ctx.mount.querySelector(".brain-corrective").textContent, h.item.corrective.join(" "));
    assert.equal(h.ctx.mount.querySelector(".brain-memory").classList.contains("is-success"), correct);
    h.ctx.scheduler.advance(1000); await feedback;
    const next = h.scene.present(h.item);
    assert.equal(h.ctx.mount.querySelectorAll(".is-answer").length, 0);
    assert.ok(h.ctx.mount.querySelectorAll(".brain-memory__card").every(card => card.getAttribute("aria-pressed") === "false"));
    h.cleanup(); await next;
  }
});

test("all-pair boards keep matched cards visible and finish once after every distinct pair", async () => {
  for (const tier of data.TIERS) {
    const h = setup(memorymatch, tier, "memorymatch", 12, 5);
    assert.equal(h.item.prompt.mode, "all");
    h.scene.setInputEnabled(true);
    const cards = h.ctx.mount.querySelectorAll(".brain-memory__card");
    cards[0].onclick(); cards[1].onclick(); assert.equal(h.submitted.length, 0);
    h.ctx.scheduler.advance(h.item.prompt.studyMs); await h.presenting;
    assert.equal(h.ctx.mount.querySelectorAll(".brain-memory__back").length, cards.length);
    const pairs = h.item.answer.split(";").map(pair => pair.split(",").map(n => Number(n) - 1)).reverse();
    for (const [i, [first, second]] of pairs.entries()) {
      cards[second].onclick(); cards[second].onclick();
      assert.equal(h.submitted.length, 0, "one physical card cannot make a pair");
      h.scene.setInputEnabled(false); cards[first].onclick();
      assert.equal(cards[first].getAttribute("aria-pressed"), "false");
      h.scene.setInputEnabled(true); cards[first].onclick();
      assert.equal(h.ctx.mount.querySelectorAll(".is-answer").length, (i + 1) * 2);
      assert.equal(h.ctx.mount.querySelectorAll(".brain-memory__back").length, cards.length - (i + 1) * 2);
      assert.ok(cards[first].disabled && cards[second].disabled, "matched cards remain locked");
      cards[first].onclick(); cards[second].onclick();
      assert.equal(h.submitted.length, i === pairs.length - 1 ? 1 : 0);
    }
    assert.deepEqual(h.submitted, [h.item.answer], "pair order and flip order do not affect canonical grading");
    assert.equal(core.gradeItem(h.item, h.submitted[0]).correct, true);
    h.scene.setInputEnabled(true); cards.forEach(card => card.onclick());
    assert.equal(h.submitted.length, 1);
    assert.match(h.ctx.mount.querySelector(".brain-memory__pairs").textContent, new RegExp("Pairs " + pairs.length + "/" + pairs.length));
    h.cleanup(); assert.equal(h.ctx.scheduler.activeCount, 0);
  }
});

test("all-pair mismatches stay visible for 850ms, block taps, and preserve a mistake in the final grade", async () => {
  const h = setup(memorymatch, "tot", "memorymatch", 12, 5);
  h.ctx.scheduler.advance(h.item.prompt.studyMs); await h.presenting; h.scene.setInputEnabled(true);
  const cards = h.ctx.mount.querySelectorAll(".brain-memory__card");
  const wrong = h.item.prompt.cards.findIndex(symbol => symbol !== h.item.prompt.cards[0]);
  cards[0].onclick(); cards[wrong].onclick();
  assert.equal(h.submitted.length, 0, "a mismatch allows further practice before completing the board");
  assert.equal(h.ctx.mount.querySelectorAll(".brain-memory__back").length, cards.length - 2);
  assert.ok(cards.every(card => card.disabled));
  assert.equal(h.ctx.scheduler.activeCount, 1);
  cards.forEach(card => card.onclick());
  h.scene.setInputEnabled(true); cards.forEach(card => card.onclick());
  assert.equal(h.ctx.scheduler.activeCount, 1, "blocked taps cannot schedule another mismatch");
  h.ctx.scheduler.advance(849);
  assert.equal(h.ctx.mount.querySelectorAll(".brain-memory__back").length, cards.length - 2);
  h.ctx.scheduler.advance(1);
  assert.equal(h.ctx.mount.querySelectorAll(".brain-memory__back").length, cards.length);
  assert.ok(cards.every(card => !card.disabled));
  assert.match(h.ctx.mount.querySelector(".brain-memory__pairs").textContent, /Pairs 0\/2/);
  for (const pair of h.item.answer.split(";")) for (const position of pair.split(",").map(Number)) cards[position - 1].onclick();
  assert.deepEqual(h.submitted, ["needs-practice"]);
  assert.equal(core.gradeItem(h.item, h.submitted[0]).correct, false);
  const feedback = h.scene.showFeedback({ correct: false, answer: h.item.answer });
  assert.equal(h.ctx.mount.querySelectorAll(".is-answer").length, cards.length);
  assert.equal(h.ctx.mount.querySelector(".brain-corrective").textContent, h.item.lesson.explanation.join(" "));
  h.ctx.scheduler.advance(1000); await feedback;
  const retry = h.scene.present(h.item);
  h.ctx.scheduler.advance(h.item.prompt.studyMs); await retry; h.scene.setInputEnabled(true);
  for (const pair of h.item.answer.split(";")) for (const position of pair.split(",").map(Number)) h.ctx.mount.querySelectorAll(".brain-memory__card")[position - 1].onclick();
  assert.deepEqual(h.submitted, ["needs-practice", h.item.answer], "a new presentation resets local mistakes for host-managed unscored retry");
  h.cleanup();
});

test("present and destroy cancel an in-flight mismatched flip without changing the replacement board", async () => {
  for (const replace of [true, false]) {
    const h = setup(memorymatch, "hard", "memorymatch", 12, 5);
    h.ctx.scheduler.advance(h.item.prompt.studyMs); await h.presenting; h.scene.setInputEnabled(true);
    const cards = h.ctx.mount.querySelectorAll(".brain-memory__card");
    const wrong = h.item.prompt.cards.findIndex(symbol => symbol !== h.item.prompt.cards[0]);
    cards[0].onclick(); cards[wrong].onclick(); h.ctx.scheduler.advance(100);
    assert.equal(h.ctx.scheduler.activeCount, 1);
    if (replace) {
      const next = h.scene.present(h.item);
      assert.equal(h.ctx.scheduler.activeCount, 1, "the new study timer replaces the mismatch timer");
      h.ctx.scheduler.advance(750);
      assert.equal(h.ctx.mount.querySelectorAll(".brain-memory__back").length, 0, "old flip callback cannot hide the replacement study cards");
      assert.ok(h.ctx.mount.querySelectorAll(".brain-memory__card").every(card => card.disabled));
      h.ctx.scheduler.advance(h.item.prompt.studyMs - 750); await next;
      assert.equal(h.ctx.mount.querySelectorAll(".brain-memory__back").length, cards.length);
      assert.ok(!h.ctx.mount.querySelector(".brain-memory__pairs").textContent.includes("Try again"));
    }
    h.cleanup(); h.ctx.scheduler.advance(1000);
    assert.equal(h.ctx.scheduler.activeCount, 0);
    assert.equal(h.ctx.mount.children.length, 0);
    assert.equal(h.submitted.length, 0);
  }
});

test("Pattern Echo displays every step in order and rejects taps until playback finishes", async () => {
  const h = setup(patternecho, "hard");
  const pads = h.ctx.mount.querySelectorAll(".brain-echo__pad");
  h.scene.setInputEnabled(true);
  pads.forEach(pad => pad.onclick());
  assert.equal(h.submitted.length, 0);
  assert.ok(pads.every(pad => pad.disabled));
  h.ctx.scheduler.advance(349);
  assert.equal(h.ctx.mount.querySelectorAll(".is-lit").length, 0);
  h.ctx.scheduler.advance(1);
  for (const [i, value] of h.item.prompt.sequence.entries()) {
    assert.equal(h.ctx.mount.querySelectorAll(".is-lit").length, 1);
    assert.equal(h.ctx.mount.querySelector(".is-lit").dataset.pad, String(value));
    pads[0].onclick();
    h.ctx.scheduler.advance(h.item.prompt.stepMs);
    assert.equal(h.ctx.mount.querySelectorAll(".is-lit").length, 0, "each step has a visible gap, including repeated pads");
    h.ctx.scheduler.advance(200);
    if (i < h.item.prompt.sequence.length - 1) assert.ok(pads.every(pad => pad.disabled));
  }
  await h.presenting;
  assert.ok(pads.every(pad => !pad.disabled));
  assert.equal(h.submitted.length, 0);
  assert.equal(h.ctx.scheduler.activeCount, 0);
  h.cleanup();
});

test("Pattern Echo clears partial input, replays safely, accepts repeated pads, and submits only once", async () => {
  let seed = 0;
  while (!core.buildRound("patternecho", "hard", core.mulberry32(seed)).items[0].prompt.sequence.some((n, i, list) => i > 0 && n === list[i - 1])) seed++;
  const h = setup(patternecho, "hard", "patternecho", seed);
  h.ctx.scheduler.advance(20000); await h.presenting; h.scene.setInputEnabled(true);
  const pads = h.ctx.mount.querySelectorAll(".brain-echo__pad");
  const clear = h.ctx.mount.querySelector("[data-clear]"), replay = h.ctx.mount.querySelector("[data-replay]");
  const undo = h.ctx.mount.querySelector("[data-undo]"), check = h.ctx.mount.querySelector("[data-check]");
  assert.equal(clear.disabled, true);
  assert.equal(undo.disabled, true); assert.equal(check.disabled, true);
  check.onclick(); assert.equal(h.submitted.length, 0, "an incomplete entry cannot be checked");
  pads[0].onclick(); pads[1].onclick();
  assert.deepEqual(h.ctx.mount.querySelectorAll(".brain-echo__slot").slice(0, 2).map(slot => slot.textContent), ["1", "2"]);
  clear.onclick();
  assert.ok(h.ctx.mount.querySelectorAll(".brain-echo__slot").every(slot => slot.textContent === "·"));
  assert.equal(clear.disabled, true);
  pads[2].onclick();
  h.scene.setInputEnabled(false); clear.onclick(); replay.onclick(); undo.onclick(); check.onclick(); pads[0].onclick();
  assert.equal(h.ctx.mount.querySelector(".brain-echo__slot").textContent, "3", "pause preserves entered taps");
  assert.equal(h.ctx.scheduler.activeCount, 0);
  h.scene.setInputEnabled(true); replay.onclick();
  assert.ok(h.ctx.mount.querySelectorAll(".brain-echo__slot").every(slot => slot.textContent === "·"));
  assert.ok(pads.every(pad => pad.disabled));
  replay.onclick(); clear.onclick(); pads[0].onclick();
  assert.equal(h.ctx.scheduler.activeCount, 1, "replay cannot stack multiple playbacks");
  assert.equal(h.submitted.length, 0);
  h.ctx.scheduler.advance(20000);
  for (const value of h.item.prompt.sequence) pads[value - 1].onclick();
  assert.equal(h.submitted.length, 0, "new items wait for explicit confirmation");
  assert.equal(check.disabled, false);
  assert.ok(pads.every(pad => pad.disabled));
  pads[0].onclick();
  assert.equal(h.submitted.length, 0, "a full entry cannot overflow");
  undo.onclick();
  assert.equal(check.disabled, true);
  assert.ok(pads.every(pad => !pad.disabled));
  assert.equal(h.ctx.mount.querySelectorAll(".brain-echo__slot").at(-1).textContent, "·");
  pads[h.item.prompt.sequence.at(-1) - 1].onclick();
  check.onclick(); check.onclick();
  h.scene.setInputEnabled(true); pads[0].onclick(); replay.onclick(); clear.onclick();
  assert.deepEqual(h.submitted, [h.item.answer]);
  assert.ok(pads.every(pad => pad.disabled));
  assert.equal(replay.disabled, true); assert.equal(clear.disabled, true);
  assert.equal(h.ctx.scheduler.activeCount, 0);
  h.cleanup();
});

test("Pattern Echo correct and wrong feedback exposes the full sequence and resolves through the scheduler", async () => {
  for (const correct of [true, false]) {
    const h = setup(patternecho, "mid");
    h.ctx.scheduler.advance(20000); await h.presenting; h.scene.setInputEnabled(true);
    const value = correct ? h.item.answer : h.item.choices.find(choice => choice !== h.item.answer);
    for (const pad of value.split(",").map(Number)) h.ctx.mount.querySelectorAll(".brain-echo__pad")[pad - 1].onclick();
    assert.equal(h.submitted.length, 0);
    h.ctx.mount.querySelector("[data-check]").onclick();
    assert.equal(core.gradeItem(h.item, h.submitted[0]).correct, correct);
    const feedback = h.scene.showFeedback({ correct, answer: h.item.answer });
    assert.equal(h.ctx.mount.querySelector(".brain-corrective").textContent, h.item.corrective.join(" "));
    assert.equal(h.ctx.mount.querySelector(".brain-echo").classList.contains("is-success"), correct);
    assert.ok(h.ctx.mount.querySelectorAll(".brain-echo__pad").every(pad => pad.disabled));
    h.ctx.scheduler.advance(1000); await feedback;
    const next = h.scene.present(h.item);
    assert.equal(h.ctx.mount.querySelectorAll(".is-success").length, 0);
    assert.ok(h.ctx.mount.querySelectorAll(".brain-echo__slot").every(slot => slot.textContent === "·"));
    h.cleanup(); await next;
  }
});

test("reverse Pattern Echo plays the original order but grades the child's reversed entry", async () => {
  const h = setup(patternecho, "hard", "patternecho", 12, 3);
  assert.equal(h.item.prompt.reverse, true);
  assert.notEqual(h.item.answer, h.item.prompt.sequence.join(","));
  h.ctx.scheduler.advance(350);
  assert.equal(h.ctx.mount.querySelector(".is-lit").dataset.pad, String(h.item.prompt.sequence[0]), "playback does not silently reverse the sequence");
  h.ctx.scheduler.advance(20000); await h.presenting; h.scene.setInputEnabled(true);
  assert.match(h.ctx.mount.querySelector(".brain-echo__instruction").textContent, /Last tap first/);
  for (const value of h.item.prompt.sequence) h.ctx.mount.querySelectorAll(".brain-echo__pad")[value - 1].onclick();
  h.ctx.mount.querySelector("[data-check]").onclick();
  assert.equal(h.submitted[0], h.item.prompt.sequence.join(","), "the scene submits actual taps, not the expected answer");
  assert.equal(core.gradeItem(h.item, h.submitted[0]).correct, false);
  const feedback = h.scene.showFeedback({ correct: false, answer: h.item.answer });
  assert.equal(h.ctx.mount.querySelector(".brain-corrective").textContent, h.item.lesson.explanation.join(" "));
  h.ctx.scheduler.advance(1000); await feedback;
  const next = h.scene.present(h.item);
  h.ctx.scheduler.advance(20000); await next; h.scene.setInputEnabled(true);
  for (const value of h.item.prompt.sequence.slice().reverse()) h.ctx.mount.querySelectorAll(".brain-echo__pad")[value - 1].onclick();
  assert.equal(h.submitted.length, 1);
  h.ctx.mount.querySelector("[data-check]").onclick();
  assert.equal(h.submitted[1], h.item.answer);
  assert.equal(core.gradeItem(h.item, h.submitted[1]).correct, true);
  h.cleanup();
});

test("legacy serialized target-pair and automatic Echo items still play without new metadata", async () => {
  for (const module of [memorymatch, patternecho]) {
    const h = setup(module, "mid");
    const legacy = JSON.parse(JSON.stringify(h.item));
    delete legacy.lesson;
    delete legacy.prompt.mode; delete legacy.prompt.confirm; delete legacy.prompt.reverse;
    const next = h.scene.present(legacy); await h.presenting;
    h.ctx.scheduler.advance(20000); await next; h.scene.setInputEnabled(true);
    if (module === memorymatch) {
      assert.equal(h.ctx.mount.querySelectorAll(".brain-memory__symbol").length, 1, "the target symbol is shown after study");
      const cards = h.ctx.mount.querySelectorAll(".brain-memory__card");
      const pair = legacy.answer.split(",").map(n => Number(n) - 1);
      cards[pair[1]].onclick(); cards[pair[1]].onclick();
      assert.equal(h.submitted.length, 0);
      cards[pair[0]].onclick();
    } else {
      assert.equal(h.ctx.mount.querySelector("[data-check]"), null);
      assert.equal(h.ctx.mount.querySelector("[data-undo]"), null);
      for (const value of legacy.prompt.sequence) h.ctx.mount.querySelectorAll(".brain-echo__pad")[value - 1].onclick();
    }
    assert.deepEqual(h.submitted, [legacy.answer]);
    assert.equal(core.gradeItem(legacy, h.submitted[0]).correct, true);
    h.cleanup();
  }
});

test("replacing or destroying memory study/playback cancels work and resolves pending present promises", async () => {
  for (const module of [memorymatch, patternecho]) {
    for (const cancelSchedulerFirst of [false, true]) {
      const h = setup(module);
      const previousControls = h.ctx.mount.querySelectorAll("button");
      h.ctx.scheduler.advance(400);
      const next = h.scene.present(h.item);
      await h.presenting;
      assert.equal(h.ctx.scheduler.activeCount, 1, "replacement cancels the previous step");
      h.ctx.scheduler.advance(400);
      if (cancelSchedulerFirst) h.ctx.scheduler.cancelAll();
      h.scene.destroy(); await next; h.scene.destroy();
      assert.equal(h.ctx.scheduler.activeCount, 0);
      assert.equal(h.ctx.mount.children.length, 0);
      for (const button of previousControls) button.onclick();
      assert.equal(h.submitted.length, 0, "detached controls ignore input after destroy");
      h.ctx.scheduler.advance(20000);
      assert.equal(h.ctx.mount.children.length, 0, "canceled callbacks cannot recreate the scene");
    }
  }
});

test("both memory games retain a working generic choice fallback for every generated mode", () => {
  for (const gameId of ["memorymatch", "patternecho"]) for (const tier of data.TIERS) {
    const h = setup(generic, tier, gameId);
    for (const item of core.buildRound(gameId, tier, core.mulberry32(12)).items) {
      h.scene.present(item); h.scene.setInputEnabled(true);
      h.ctx.mount.querySelectorAll(".brain-key").find(button => button.dataset.v === item.answer).onclick();
      assert.equal(h.submitted.at(-1), item.answer);
    }
    assert.equal(h.submitted.length, 6);
    h.cleanup();
  }
});
