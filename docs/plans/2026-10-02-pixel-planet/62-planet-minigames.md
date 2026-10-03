# Slice 62 — In-place mini-games

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the four mini-games as a pure-logic module with node tests:
- Star Catch 接星星
- Bubble Pop 戳泡泡
- Mole Hop 打地鼠
- Crystal Echo 水晶回音

The world wires them in slice 63.

**Architecture:** `createMinigame(kind, env)` returns `{step(dt), draw(ctx), pointer(type,x,y), timeLeft(), score, finished, info}`.
- **Coordinates:** everything is in world-buffer pixels.
- **`env`** (kept current by the explorer): `{width, height, top, floor, coarse, atlas, sound(name), rand()}`. `top`/`floor` keep play clear of the HUD and the selection card.
- **No fail state:** a wrong Crystal Echo note just replays the same song.
- **Isolation:** no stars, no ledger, no DOM.

Design: [design.md](design.md) D8, "Mini-games (D8)".

**Tech Stack:** ES modules, `node:test`. No `?.` / `??` / `.flatMap(`.

**Depends on:** slice 61 (`planet-toys.js` `GAMES`; sprite names `gStar`, `gBasket`, `gBubble`, `gMole`, `gHole`, `whale`, `crystal*`, `pSparkle`).

**DONE WHEN:**
- `node --test scripts/planet-minigames.test.mjs` passes, with 5 tests.
- `node scripts/check.mjs` is green.
- Everything is committed.

---

### Task 1: Mini-game engine + four games

**Files:**
- Create: `js/world/planet-minigames.js`
- Test: `scripts/planet-minigames.test.mjs`

- [ ] **Step 1: Write the failing test** — create `scripts/planet-minigames.test.mjs`:

```js
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test scripts/planet-minigames.test.mjs`
Expected: FAIL with `Cannot find module ... js/world/planet-minigames.js`.

- [ ] **Step 3: Create `js/world/planet-minigames.js`**

```js
/* Pixel Planet mini-games — tiny in-place games on the world canvas.
   No fail state, no stars, no ledger (coach, not cop). Coordinates are buffer pixels.
   env = {width, height, top, floor, coarse, atlas, sound(name), rand()} — the explorer keeps it current. */
import { GAMES } from "./planet-toys.js";

var DURATION = {stars:20, bubbles:20, moles:20, echo:30};

function blit(ctx, env, name, x, y, frame, scale){
  var canvas = env.atlas[name].normal[frame || 0], s = scale || 1;
  ctx.drawImage(canvas, Math.round(x - canvas.width*s/2), Math.round(y - canvas.height*s/2), canvas.width*s, canvas.height*s);
}
function sparkle(game, env, x, y, n){
  for (var i = 0; i < n; i++) game.fx.push({x:x, y:y, vx:(env.rand()-0.5)*40, vy:-10 - env.rand()*20, life:0.7});
}

var IMPL = {
  stars: {
    init:function(game, env){game.basketX = env.width/2; game.targetX = game.basketX; game.spawn = 0;},
    step:function(game, env, dt){
      game.spawn -= dt;
      if (game.spawn <= 0) { game.items.push({x:8 + env.rand()*(env.width - 16), y:env.top, vy:26 + env.rand()*18}); game.spawn = 0.55; }
      game.basketX += (game.targetX - game.basketX)*Math.min(1, dt*14);
      var basketY = env.floor - 6;
      game.items = game.items.filter(function(item){
        item.y += item.vy*dt;
        if (item.y >= basketY - 3 && item.y <= basketY + 3 && Math.abs(item.x - game.basketX) <= 6) {
          game.score++; env.sound("tick"); sparkle(game, env, item.x, basketY - 2, 3); return false;
        }
        return item.y < env.floor + 6;
      });
    },
    draw:function(game, env, ctx){
      game.items.forEach(function(item){blit(ctx, env, "gStar", item.x, item.y);});
      blit(ctx, env, "gBasket", game.basketX, env.floor - 4);
    },
    pointer:function(game, env, type, x){if (type !== "up") game.targetX = Math.max(6, Math.min(env.width - 6, x));}
  },

  bubbles: {
    init:function(game){game.spawn = 0;},
    step:function(game, env, dt){
      game.spawn -= dt;
      if (game.spawn <= 0) { game.items.push({x:10 + env.rand()*(env.width - 20), y:env.floor - 6, vy:16 + env.rand()*14, phase:env.rand()*6}); game.spawn = 0.45; }
      game.items = game.items.filter(function(item){item.y -= item.vy*dt; item.phase += dt*3; return item.y > env.top;});
    },
    draw:function(game, env, ctx){
      game.items.forEach(function(item){blit(ctx, env, "gBubble", item.x + Math.round(Math.sin(item.phase)*2), item.y);});
      blit(ctx, env, "whale", env.width/2, env.floor - 4);
    },
    pointer:function(game, env, type, x, y){
      if (type !== "down") return;
      var reach = env.coarse ? 8 : 5;
      for (var i = game.items.length - 1; i >= 0; i--) {
        var item = game.items[i], bx = item.x + Math.round(Math.sin(item.phase)*2);
        if (Math.abs(bx - x) <= reach && Math.abs(item.y - y) <= reach) {
          game.items.splice(i, 1); game.score++; env.sound("pop"); sparkle(game, env, bx, item.y, 4); return;
        }
      }
    }
  },

  moles: {
    init:function(game, env){
      game.spawn = 0.4;
      game.holes = [];
      for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) game.holes.push({col:c, row:r, up:0});
    },
    holeAt:function(env, hole){
      var mid = (env.top + env.floor)/2;
      return {x:env.width/2 + (hole.col - 1)*22, y:mid + (hole.row ? 12 : -12)};
    },
    step:function(game, env, dt){
      game.spawn -= dt;
      game.holes.forEach(function(hole){hole.up = Math.max(0, hole.up - dt);});
      if (game.spawn <= 0) {
        var down = game.holes.filter(function(hole){return hole.up <= 0;});
        if (down.length) down[Math.floor(env.rand()*down.length)].up = 1.2;
        game.spawn = 0.75;
      }
    },
    draw:function(game, env, ctx){
      game.holes.forEach(function(hole){
        var at = IMPL.moles.holeAt(env, hole);
        blit(ctx, env, "gHole", at.x, at.y + 2);
        if (hole.up > 0) blit(ctx, env, "gMole", at.x, at.y - 2 + (hole.up < 0.15 || hole.up > 1.05 ? 2 : 0));
      });
    },
    pointer:function(game, env, type, x, y){
      if (type !== "down") return;
      var reach = env.coarse ? 9 : 6;
      game.holes.forEach(function(hole){
        var at = IMPL.moles.holeAt(env, hole);
        if (hole.up > 0 && Math.abs(at.x - x) <= reach && Math.abs(at.y - 2 - y) <= reach) {
          hole.up = 0; game.score++; env.sound("boing"); sparkle(game, env, at.x, at.y - 4, 4);
        }
      });
    }
  },

  echo: {
    NOTES:["noteC","noteE","noteG"],
    SPRITES:["crystalCyan","crystalPink","crystalLilac"],
    init:function(game, env){game.glow = [0,0,0]; IMPL.echo.newSong(game, env, 3);},
    newSong:function(game, env, length){
      game.song = [];
      for (var i = 0; i < length; i++) game.song.push(Math.floor(env.rand()*3));
      IMPL.echo.listen(game, 0.8);
    },
    listen:function(game, wait){game.phase = "listen"; game.clock = -wait; game.played = 0; game.pos = 0;},
    crystalAt:function(env, i){return {x:env.width/2 + (i - 1)*24, y:(env.top + env.floor)/2};},
    ring:function(game, env, i){game.glow[i] = 0.35; env.sound(IMPL.echo.NOTES[i]);},
    step:function(game, env, dt){
      game.glow = game.glow.map(function(g){return Math.max(0, g - dt);});
      if (game.phase === "listen") {
        game.clock += dt;
        if (game.clock >= game.played*0.6 && game.clock >= 0 && game.played < game.song.length) { IMPL.echo.ring(game, env, game.song[game.played]); game.played++; }
        if (game.played >= game.song.length && game.clock >= game.song.length*0.6) game.phase = "play";
      } else if (game.phase === "rest") {
        game.clock += dt;
        if (game.clock >= 0) IMPL.echo.newSong(game, env, Math.min(6, 3 + Math.floor(game.score/2)));
      }
    },
    draw:function(game, env, ctx){
      IMPL.echo.SPRITES.forEach(function(name, i){
        var at = IMPL.echo.crystalAt(env, i), lift = game.glow[i] > 0 ? -2 : 0;
        blit(ctx, env, name, at.x, at.y + lift, 0, 2);
        if (game.glow[i] > 0) {
          ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = game.glow[i]*2;
          blit(ctx, env, name, at.x, at.y + lift, 0, 2);
          ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
        }
      });
    },
    pointer:function(game, env, type, x, y){
      if (type !== "down" || game.phase !== "play") return;
      var reach = env.coarse ? 12 : 9;
      for (var i = 0; i < 3; i++) {
        var at = IMPL.echo.crystalAt(env, i);
        if (Math.abs(at.x - x) > reach || Math.abs(at.y - y) > reach + 4) continue;
        IMPL.echo.ring(game, env, i);
        if (i === game.song[game.pos]) {
          game.pos++;
          if (game.pos === game.song.length) { game.score++; sparkle(game, env, at.x, at.y - 10, 6); game.phase = "rest"; game.clock = -0.8; }
        } else {
          IMPL.echo.listen(game, 0.7); /* gentle replay — never a "wrong" state */
        }
        return;
      }
    }
  }
};

export function createMinigame(kind, env){
  var impl = IMPL[kind];
  if (!impl || !GAMES[kind]) throw new Error("Unknown mini-game " + kind);
  var game = {kind:kind, info:GAMES[kind], elapsed:0, duration:DURATION[kind], score:0, finished:false, items:[], fx:[]};
  impl.init(game, env);
  game.step = function(dt){
    game.fx = game.fx.filter(function(p){p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt; return p.life > 0;});
    if (game.finished) return;
    game.elapsed += dt;
    impl.step(game, env, dt);
    if (game.elapsed >= game.duration) { game.finished = true; env.sound("yay"); }
  };
  game.draw = function(ctx){
    impl.draw(game, env, ctx);
    game.fx.forEach(function(p){blit(ctx, env, "pSparkle", p.x, p.y);});
  };
  game.pointer = function(type, x, y){if (!game.finished) impl.pointer(game, env, type, x, y);};
  game.timeLeft = function(){return Math.max(0, Math.ceil(game.duration - game.elapsed));};
  return game;
}
```

- [ ] **Step 4: Run the tests and the repo gate**

Run: `node --test scripts/planet-minigames.test.mjs` — expected: `ℹ pass 5`.
Run: `node scripts/check.mjs` — expected: green.

- [ ] **Step 5: Commit**

```bash
git add js/world/planet-minigames.js scripts/planet-minigames.test.mjs
git commit -m "feat(world): add pixel planet mini-games"
```
