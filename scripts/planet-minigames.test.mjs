import test from "node:test";
import assert from "node:assert/strict";
import { createMinigame } from "../js/world/planet-minigames.js";

function env(){
  let seed = 3;
  const sounds = [];
  return {
    width:200, height:150, top:20, floor:120, coarse:true, atlas:{},
    sound:name => sounds.push(name), sounds,
    rand:() => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  };
}
const run = (game, seconds, step = 1 / 30) => { for (let t = 0; t < seconds; t += step) game.step(step); };

test("every game ends on its own with a cheer and never fails the kid", () => {
  for (const kind of ["stars", "bubbles", "moles", "echo"]) {
    const e = env(), game = createMinigame(kind, e);
    assert.equal(game.finished, false);
    run(game, game.duration + 0.5);
    assert.equal(game.finished, true, kind);
    assert.equal(e.sounds.filter(s => s === "yay").length, 1, `${kind} cheers once`);
    if (kind !== "stars") assert.equal(game.score, 0, `${kind} scores only from taps`);
    assert.equal(game.timeLeft(), 0);
  }
  assert.throws(() => createMinigame("nope", env()));
});

test("Star Catch: the basket follows the finger and catches stars", () => {
  const e = env(), game = createMinigame("stars", e);
  for (let t = 0; t < 8; t += 1 / 30) {
    const next = game.items.slice().sort((a, b) => b.y - a.y)[0];
    if (next) game.pointer("move", next.x, 100);
    game.step(1 / 30);
  }
  assert.ok(game.score >= 3, `caught ${game.score}`);
});

test("Bubble Pop: tapping a bubble pops it", () => {
  const e = env(), game = createMinigame("bubbles", e);
  run(game, 1);
  const bubble = game.items[0];
  game.pointer("down", bubble.x + Math.round(Math.sin(bubble.phase) * 2), bubble.y);
  assert.equal(game.score, 1);
  assert.ok(e.sounds.includes("pop"));
});

test("Mole Hop: tapping a peeking mole bonks it, an empty hole does nothing", () => {
  const e = env(), game = createMinigame("moles", e);
  run(game, 0.5);
  const up = game.holes.find(h => h.up > 0.3), down = game.holes.find(h => h.up <= 0);
  const mid = (e.top + e.floor) / 2, at = h => ({ x: e.width / 2 + (h.col - 1) * 22, y: mid + (h.row ? 12 : -12) - 2 });
  game.pointer("down", at(down).x, at(down).y);
  assert.equal(game.score, 0);
  game.pointer("down", at(up).x, at(up).y);
  assert.equal(game.score, 1);
});

test("Crystal Echo: playing the song back scores, a wrong note just replays it", () => {
  const e = env(), game = createMinigame("echo", e);
  const tap = i => game.pointer("down", e.width / 2 + (i - 1) * 24, (e.top + e.floor) / 2);
  tap(0);
  assert.equal(game.score, 0, "taps while listening are ignored");
  run(game, 3);
  assert.equal(game.phase, "play");
  const song = game.song.slice(), wrong = (song[0] + 1) % 3;
  tap(wrong);
  assert.equal(game.phase, "listen");
  assert.equal(game.score, 0);
  assert.deepEqual(game.song, song, "same song is replayed");
  run(game, 3);
  song.forEach(tap);
  assert.equal(game.score, 1);
});
