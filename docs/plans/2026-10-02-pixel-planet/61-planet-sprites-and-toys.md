# Slice 61 — Sprites + toy data

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add all pixel art (12 places, 27 toys, hero, moon, particles, mini-game pieces) and the pure toy/sound/mini-game data, with node tests. Nothing in the app imports these yet.

**Architecture:** `planet-toys.js` is pure data:
- `TOYS`: site, sprite, reaction, effect and sound for each toy
- `SKY`: the moon, clouds and starfield
- `GAMES`: bilingual mini-game titles
- `SOUNDS`: note patterns as `[Hz, s, oscillator, delay ms, volume]`

`planet-sprites.js` holds the pixel art as text rows, one char per pixel (`KEY` maps chars to palette indices):
- `spritePixels()` is pure and returns palette indices for a frame/variant (`normal` | `dark` | `sleep`); an `outline` flag adds a 1px rim.
- `buildAtlas()` is the only DOM-touching function. It rasterises everything to canvases once.

Design: [design.md](design.md) D7, D9, "Biome districts", "Toys (D7)".

**Tech Stack:** ES modules, `node:test`. No `?.` / `??` / `.flatMap(`.

**Depends on:** slice 60 (`planet-palette.js`, `planet-map.js`).

**DONE WHEN:**
- `node --test scripts/planet-toys.test.mjs scripts/planet-sprites.test.mjs` passes, with 4 + 5 tests.
- `node scripts/check.mjs` is green.
- Everything is committed.

---

### Task 1: Toy, sound and mini-game data

**Files:**
- Create: `js/world/planet-toys.js`
- Test: `scripts/planet-toys.test.mjs`

- [ ] **Step 1: Write the failing test** — create `scripts/planet-toys.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { TOYS, SOUNDS, GAMES, SKY } from "../js/world/planet-toys.js";
import { buildPlanetMap, BIOMES, SITES, cellIndex, latLonToVec, angleBetween } from "../js/world/planet-map.js";

const DEG = Math.PI / 180;
const apart = (a, b) => angleBetween(latLonToVec(a.lat, a.lon), latLonToVec(b.lat, b.lon)) / DEG;
const REACTIONS = ["shake","hop","squash","spin","alt","glow","slide","grow","jump"];
const FX = ["apple","egg","heart","note","gumball","lava","smoke","snow","bunny","sparkle","bee","coconut","drop","rain","shootingStar"];

test("toys have unique ids, known reactions, effects and sounds", () => {
  assert.ok(TOYS.length >= 25, `only ${TOYS.length} toys`);
  assert.equal(new Set(TOYS.map(t => t.id)).size, TOYS.length);
  for (const toy of TOYS) {
    assert.match(toy.id, /^toy:[a-z-]+$/);
    assert.ok(REACTIONS.includes(toy.react), `${toy.id} reaction ${toy.react}`);
    assert.ok(toy.fx === null || FX.includes(toy.fx), `${toy.id} fx ${toy.fx}`);
    assert.ok(SOUNDS[toy.sound], `${toy.id} sound ${toy.sound}`);
    if (toy.game) assert.ok(GAMES[toy.game], `${toy.id} game ${toy.game}`);
  }
  assert.ok(FX.includes(SKY.cloud.fx) && FX.includes(SKY.stars.fx));
  assert.ok(GAMES[SKY.moon.game]);
});

test("every sound note is [Hz, seconds, oscillator, delay ms, volume] within safe ranges", () => {
  for (const [name, notes] of Object.entries(SOUNDS)) for (const [f, d, type, delay, vol] of notes) {
    assert.ok(f >= 60 && f <= 2600, `${name} freq`);
    assert.ok(d > 0 && d <= 0.5, `${name} duration`);
    assert.ok(["sine","square","triangle","sawtooth"].includes(type), `${name} type`);
    assert.ok(delay >= 0 && delay <= 600, `${name} delay`);
    assert.ok(vol > 0 && vol <= 0.2, `${name} volume`);
  }
});

test("each mini-game has bilingual kid-facing text and every game is reachable", () => {
  const reachable = new Set(TOYS.filter(t => t.game).map(t => t.game).concat(SKY.moon.game));
  assert.deepEqual([...reachable].sort(), Object.keys(GAMES).sort());
  for (const [id, game] of Object.entries(GAMES)) {
    for (const pair of [game.title, game.blurb]) {
      assert.equal(pair.length, 2, id);
      assert.ok(pair[0] && /[一-鿿]/.test(pair[1]), `${id} needs EN + 中文`);
    }
  }
});

test("toys sit in their declared biome, clear of landmarks and of each other", () => {
  const map = buildPlanetMap(7);
  for (const toy of TOYS) {
    assert.equal(BIOMES[map.biome[cellIndex(toy.lat, toy.lon)]], toy.biome, `${toy.id} biome`);
    for (const site of SITES) assert.ok(apart(toy, site) > 6, `${toy.id} crowds ${site.id} (${apart(toy, site).toFixed(1)}°)`);
  }
  for (let i = 0; i < TOYS.length; i++) for (let j = i + 1; j < TOYS.length; j++) {
    assert.ok(apart(TOYS[i], TOYS[j]) > 4.5, `${TOYS[i].id} crowds ${TOYS[j].id}`);
  }
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test scripts/planet-toys.test.mjs`
Expected: FAIL with `Cannot find module ... js/world/planet-toys.js`.

- [ ] **Step 3: Create `js/world/planet-toys.js`**

```js
/* Pixel Planet toys — Adibou-style tappables. Pure data: where each toy lives,
   how it reacts, what it sounds like. No stars, no ledger, no navigation. */

/* A note is [frequency Hz, duration s, oscillator type, delay ms, volume]. */
export const SOUNDS = {
  boing:  [[260,0.08,"triangle",0,0.16],[520,0.12,"triangle",70,0.14]],
  bounce: [[700,0.05,"triangle",0,0.14],[520,0.05,"triangle",120,0.12],[620,0.05,"triangle",240,0.1]],
  pop:    [[880,0.06,"square",0,0.1],[1320,0.08,"triangle",40,0.12]],
  cluck:  [[900,0.04,"square",0,0.08],[700,0.05,"square",80,0.08],[1100,0.06,"square",170,0.08]],
  whoosh: [[300,0.25,"sawtooth",0,0.05],[600,0.2,"sawtooth",120,0.04]],
  purr:   [[110,0.3,"sawtooth",0,0.06],[660,0.12,"sine",320,0.12]],
  robot:  [[440,0.06,"square",0,0.09],[660,0.06,"square",90,0.09],[330,0.08,"square",180,0.09]],
  rumble: [[90,0.3,"sawtooth",0,0.12],[150,0.12,"square",250,0.08]],
  yawn:   [[400,0.25,"sine",0,0.12],[260,0.3,"sine",220,0.1]],
  jingle: [[1320,0.07,"triangle",0,0.1],[1568,0.07,"triangle",80,0.1],[1760,0.1,"triangle",160,0.1]],
  whee:   [[500,0.08,"sine",0,0.12],[800,0.1,"sine",80,0.12],[1100,0.14,"sine",170,0.12]],
  hoot:   [[330,0.18,"sine",0,0.14],[294,0.25,"sine",260,0.14]],
  ribbit: [[180,0.06,"square",0,0.08],[220,0.08,"square",90,0.08]],
  noteC:  [[523,0.35,"sine",0,0.16]],
  noteE:  [[659,0.35,"sine",0,0.16]],
  noteG:  [[784,0.35,"sine",0,0.16]],
  rise:   [[392,0.08,"triangle",0,0.12],[523,0.08,"triangle",80,0.12],[659,0.12,"triangle",160,0.12]],
  moo:    [[150,0.4,"sawtooth",0,0.06],[130,0.35,"sawtooth",350,0.05]],
  buzz:   [[220,0.3,"sawtooth",0,0.04],[233,0.3,"sawtooth",150,0.04]],
  click:  [[1800,0.03,"square",0,0.06],[1600,0.03,"square",70,0.06],[1800,0.03,"square",140,0.06]],
  thunk:  [[200,0.08,"triangle",0,0.16],[140,0.1,"triangle",300,0.14]],
  spout:  [[180,0.2,"sawtooth",0,0.05],[900,0.12,"sine",150,0.1]],
  splash: [[1000,0.05,"sine",0,0.1],[600,0.1,"sawtooth",60,0.05]],
  toot:   [[392,0.2,"square",0,0.08],[392,0.25,"square",260,0.08]],
  wink:   [[1047,0.08,"sine",0,0.12],[1568,0.12,"sine",90,0.12]],
  rain:   [[2000,0.03,"sine",0,0.05],[2400,0.03,"sine",90,0.05],[1800,0.03,"sine",180,0.05],[2200,0.03,"sine",270,0.05]],
  zoom:   [[1500,0.2,"sine",0,0.08],[600,0.25,"sine",120,0.06]],
  yay:    [[523,0.12,"triangle",0,0.16],[659,0.12,"triangle",90,0.16],[784,0.12,"triangle",180,0.16],[1047,0.2,"triangle",270,0.16]],
  tick:   [[1200,0.04,"triangle",0,0.1]]
};

/* Mini-games launched from a game toy. Kid-facing text: always EN + 繁體中文. */
export const GAMES = {
  stars:   {title:["Star Catch","接星星"],   blurb:["Catch the falling stars!","接住掉下來的星星！"], icon:"🌟", unit:"🌟"},
  bubbles: {title:["Bubble Pop","戳泡泡"],   blurb:["Pop the whale's bubbles!","戳破鯨魚的泡泡！"],   icon:"🫧", unit:"🫧"},
  moles:   {title:["Mole Hop","打地鼠"],     blurb:["Tap the moles when they peek!","地鼠探頭就點牠！"], icon:"🐹", unit:"🐹"},
  echo:    {title:["Crystal Echo","水晶回音"], blurb:["Play the song back!","把歌彈回來！"],         icon:"💎", unit:"🎵"}
};

/* react: shake | hop | squash | spin | alt | glow | slide | grow | jump.
   fx: particle kind spawned on tap (see FX in world-explorer), count how many. */
export const TOYS = [
  {id:"toy:apple-tree", sprite:"appleTree",   biome:"village", lat:17,  lon:-12,  react:"shake",  fx:"apple",   count:3, sound:"bounce"},
  {id:"toy:chicken",    sprite:"chicken",     biome:"village", lat:-6,  lon:-11,  react:"hop",    fx:"egg",     count:1, sound:"cluck"},
  {id:"toy:windmill",   sprite:"windmill",    biome:"village", lat:18,  lon:11,   react:"spin",   fx:null,      count:0, sound:"whoosh"},
  {id:"toy:cat",        sprite:"cat",         biome:"village", lat:-6,  lon:12,   react:"squash", fx:"heart",   count:3, sound:"purr"},
  {id:"toy:robot",      sprite:"robot",       biome:"arcade",  lat:37,  lon:41,   react:"hop",    fx:"note",    count:2, sound:"robot"},
  {id:"toy:gumball",    sprite:"gumball",     biome:"arcade",  lat:21,  lon:44,   react:"shake",  fx:"gumball", count:2, sound:"pop"},
  {id:"toy:lava-vent",  sprite:"lavaVent",    biome:"volcano", lat:-41, lon:53,   react:"squash", fx:"lava",    count:3, sound:"rumble"},
  {id:"toy:rock-buddy", sprite:"rockBuddy",   biome:"volcano", lat:-19, lon:31,   react:"alt",    fx:"smoke",   count:2, sound:"yawn"},
  {id:"toy:snowman",    sprite:"snowman",     biome:"snow",    lat:51,  lon:-42,  react:"hop",    fx:"snow",    count:4, sound:"jingle"},
  {id:"toy:penguin",    sprite:"penguin",     biome:"snow",    lat:33,  lon:-41,  react:"slide",  fx:"snow",    count:2, sound:"whee"},
  {id:"toy:owl",        sprite:"owl",         biome:"forest",  lat:-36, lon:-57,  react:"alt",    fx:"note",    count:1, sound:"hoot"},
  {id:"toy:bush",       sprite:"bush",        biome:"forest",  lat:-15, lon:-58,  react:"shake",  fx:"bunny",   count:1, sound:"boing"},
  {id:"toy:mushroom",   sprite:"mushroom",    biome:"grove",   lat:34,  lon:110,  react:"squash", fx:"sparkle", count:2, sound:"boing"},
  {id:"toy:crystal-c",  sprite:"crystalCyan", biome:"grove",   lat:13,  lon:113,  react:"glow",   fx:"sparkle", count:2, sound:"noteC"},
  {id:"toy:crystal-e",  sprite:"crystalPink", biome:"grove",   lat:11,  lon:122,  react:"glow",   fx:"sparkle", count:2, sound:"noteE"},
  {id:"toy:crystal-g",  sprite:"crystalLilac",biome:"grove",   lat:13,  lon:131,  react:"glow",   fx:"sparkle", count:2, sound:"noteG"},
  {id:"toy:frog",       sprite:"frog",        biome:"grove",   lat:33,  lon:134,  react:"jump",   fx:null,      count:0, sound:"ribbit"},
  {id:"toy:echo-stone", sprite:"echoStone",   biome:"grove",   lat:41,  lon:122,  react:"glow",   fx:"sparkle", count:3, sound:"rise",   game:"echo"},
  {id:"toy:sunflower",  sprite:"sunflower",   biome:"meadow",  lat:-16, lon:151,  react:"grow",   fx:"sparkle", count:2, sound:"rise"},
  {id:"toy:cow",        sprite:"cow",         biome:"meadow",  lat:-36, lon:150,  react:"shake",  fx:"heart",   count:2, sound:"moo"},
  {id:"toy:beehive",    sprite:"beehive",     biome:"meadow",  lat:-19, lon:175,  react:"shake",  fx:"bee",     count:3, sound:"buzz"},
  {id:"toy:molehill",   sprite:"molehill",    biome:"meadow",  lat:-38, lon:174,  react:"hop",    fx:"sparkle", count:2, sound:"pop",    game:"moles"},
  {id:"toy:crab",       sprite:"crab",        biome:"beach",   lat:-6,  lon:-113, react:"slide",  fx:null,      count:0, sound:"click"},
  {id:"toy:palm",       sprite:"palm",        biome:"beach",   lat:14,  lon:-132, react:"shake",  fx:"coconut", count:1, sound:"thunk"},
  {id:"toy:whale",      sprite:"whale",       biome:"ocean",   lat:-4,  lon:-160, react:"hop",    fx:"drop",    count:4, sound:"spout",  game:"bubbles"},
  {id:"toy:fish",       sprite:"fish",        biome:"ocean",   lat:-6,  lon:88,   react:"jump",   fx:"drop",    count:2, sound:"splash"},
  {id:"toy:boat",       sprite:"boat",        biome:"ocean",   lat:16,  lon:-27,  react:"hop",    fx:null,      count:0, sound:"toot"}
];

/* Sky toys are not on the surface; the explorer hit-tests them itself. */
export const SKY = {
  moon:  {sprite:"moon", react:"alt", sound:"wink", game:"stars"},
  cloud: {fx:"rain", count:6, sound:"rain"},
  stars: {fx:"shootingStar", count:1, sound:"zoom"}
};
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --test scripts/planet-toys.test.mjs`
Expected: `ℹ pass 4`.

If you ever move a toy and the "clear of landmarks" test fails, nudge its lat/lon by a few degrees inside its biome. Don't loosen the test.

- [ ] **Step 5: Commit**

```bash
git add js/world/planet-toys.js scripts/planet-toys.test.mjs
git commit -m "feat(world): declare planet toys, sounds and mini-game titles"
```

### Task 2: Pixel-art sprites

**Files:**
- Create: `js/world/planet-sprites.js`
- Test: `scripts/planet-sprites.test.mjs`

- [ ] **Step 1: Write the failing test** — create `scripts/planet-sprites.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { SPRITES, KEY, LANDMARK_SPRITE, spritePixels, frameCount } from "../js/world/planet-sprites.js";
import { SITES } from "../js/world/planet-map.js";
import { TOYS, SKY } from "../js/world/planet-toys.js";
import { C, DARK } from "../js/world/planet-palette.js";

test("every sprite parses with known pixels in every frame and variant", () => {
  for (const name of Object.keys(SPRITES)) {
    for (let f = 0; f < frameCount(name); f++) for (const variant of ["normal", "dark", "sleep"]) {
      const s = spritePixels(name, f, variant, C.pink);
      assert.equal(s.pixels.length, s.width * s.height, name);
      assert.ok(s.pixels.some(v => v >= 0), `${name} is empty`);
      for (const v of s.pixels) assert.ok(v >= -1 && v < 32, `${name} pixel ${v}`);
    }
  }
});

test("explicit second frames keep the first frame's size", () => {
  for (const [name, def] of Object.entries(SPRITES)) {
    if (!def.alt) continue;
    assert.equal(def.alt.length, def.art.length, `${name} height`);
    const width = rows => Math.max(...rows.map(r => r.length));
    assert.equal(width(def.alt), width(def.art), `${name} width`);
  }
});

test("every landmark, toy and sky toy has a sprite; places are big, toys small", () => {
  for (const site of SITES) {
    const name = LANDMARK_SPRITE[site.id];
    assert.ok(SPRITES[name], `${site.id} has no sprite`);
    const h = spritePixels(name, 0, "normal").height - 2;
    assert.ok(h >= (site.id.startsWith("section:") ? 12 : 8) && h <= 18, `${name} height ${h}`);
  }
  for (const toy of TOYS) {
    assert.ok(SPRITES[toy.sprite], `${toy.id} sprite ${toy.sprite}`);
    assert.ok(spritePixels(toy.sprite, 0, "normal").height - 2 <= 13, `${toy.sprite} too tall for a toy`);
  }
  assert.ok(SPRITES[SKY.moon.sprite]);
});

test("hero takes the kid's colour; sleeping places are grey, never red", () => {
  const hero = spritePixels("hero", 0, "normal", C.purple);
  assert.ok(hero.pixels.includes(C.purple) && hero.pixels.includes(DARK[C.purple]));
  for (const name of Object.values(LANDMARK_SPRITE)) {
    const asleep = spritePixels(name, 0, "sleep");
    for (const v of asleep.pixels) assert.ok([-1, C.outline, C.snowShade, C.grey, C.steel].includes(v), `${name} sleep pixel ${v}`);
  }
});

test("outline option rims sprites drawn without one", () => {
  const fish = spritePixels("fish", 0, "normal");
  assert.equal(fish.pixels[0], -1);
  assert.ok(fish.pixels.filter(v => v === C.outline).length > 8);
  assert.ok(Object.keys(KEY).every(ch => ch.length === 1));
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test scripts/planet-sprites.test.mjs`
Expected: FAIL with `Cannot find module ... js/world/planet-sprites.js`.

- [ ] **Step 3: Create `js/world/planet-sprites.js`**

Copy the art rows exactly. Every char matters. `'.'` is transparent.

```js
/* Pixel Planet sprites — hand-placed pixel art as text rows, one char per pixel.
   Pure data + pure pixel builder; buildAtlas() is the only DOM-touching function. */
import { C, DARK, RGBA, luminance } from "./planet-palette.js";

/* '.' and ' ' are transparent. 'H'/'h' are the kid's colour and its shadow. */
export const KEY = {
  o:C.outline, x:C.space2, D:C.greenDeep, n:C.oceanDark, b:C.ocean, B:C.oceanLit, i:C.ice,
  d:C.greenDark, g:C.green, G:C.greenLit, l:C.lime, r:C.rockDark, k:C.rock, K:C.rockLit, L:C.lava,
  y:C.yellow, s:C.sand, z:C.sandLit, w:C.wood, W:C.woodDark, p:C.pink, m:C.magenta, u:C.purpleDark,
  v:C.purple, q:C.lilac, "#":C.white, c:C.snowShade, e:C.steel, R:C.red, t:C.cyan, a:C.grey
};

/* art: rows. alt: explicit second frame. remap: second frame by swapping chars.
   from + tint: reuse another sprite's art with chars swapped. outline: add a 1px dark rim. */
export const SPRITES = {
  /* ---- places (section landmarks) ---- */
  questHut: {art:[
    "......oyo......",
    "......oyyo.....",
    "......oyyyo....",
    "......ow.......",
    ".....oRwRo.....",
    "....oRRRRRo....",
    "...oRRRRRRRo...",
    "..oRRRRRRRRRo..",
    ".oRRRRRRRRRRRo.",
    "ooooooooooooooo",
    ".ozzzzzzzzzzzo.",
    ".ozBBzzowwozzo.",
    ".ozBBzzowwozzo.",
    ".ozzzzzowyozzo.",
    ".ozzzzzowwozzo.",
    "ooooooooooooooo"], remap:{y:"z"}},
  arcade: {art:[
    "......opo.....",
    "......oto.....",
    "oooooooooooooo",
    "optpytptpytpto",
    "oooooooooooooo",
    ".ovvvvvvvvvvo.",
    ".ovqqvvvvqqvo.",
    ".ovqqvvvvqqvo.",
    ".ovvvvvvvvvvo.",
    ".ovttvvvvttvo.",
    ".ovttvvvvttvo.",
    ".ovvvvoovvvvo.",
    ".ovvvoyyovvvo.",
    ".ovvvoyyovvvo.",
    "oooooooooooooo"], remap:{t:"p", p:"y", y:"t"}},
  volcano: {art:[
    "......oLLo......",
    ".....oLyyLo.....",
    "....okLLLLko....",
    "...okkkLkkKko...",
    "...okkkkkkKKo...",
    "..okkrkkkkkKKo..",
    "..okkkkkkkkkKo..",
    ".okkkkkkrkkkkKo.",
    ".okrkkoooookkKo.",
    "okkkkkowwwokkKko",
    "okkrkkowywokkkko",
    "okkkkkowwwokkkko",
    "oooooooooooooooo"], remap:{L:"y", y:"L"}},
  observatory: {art:[
    ".......oyo.....",
    ".....ooooo.....",
    "...oo##ccoo....",
    "..o###cccceo...",
    ".o###cccccceo..",
    ".o##ccccooceo..",
    "ooooooooooooooo",
    ".oeeeeeeeeeeo..",
    ".oeiieeeeiieo..",
    ".oeiieeeeiieo..",
    ".oeeeowwoeeeo..",
    ".oeeeowyoeeeo..",
    "ooooooooooooooo"], remap:{y:"#"}},
  libraryTree: {art:[
    ".....oooooo.....",
    "...ooGGgGGgoo...",
    "..oGGgggGgggdo..",
    ".oGgggdggggGgdo.",
    ".ogggggggGggddo.",
    "ogGggdgggggggddo",
    "oggggggGgggdgddo",
    ".oddgggggggdddo.",
    "..oodddoodddoo..",
    "......owwo......",
    ".....owwwwo.....",
    ".....owooWo.....",
    ".....owoyWo.....",
    "....owwooWwo....",
    "...oooooooooo..."]},
  musicShroom: {art:[
    "....oooooo....",
    "..oop#pppppoo.",
    ".opp###ppp#ppo",
    "op#pppppp###po",
    "oppppp#ppppppo",
    "ommmmmmmmmmmmo",
    ".oooooooooooo.",
    "....oqqqqo....",
    "....oqtqqo....",
    "....oqqoqo....",
    "....oqqwqo....",
    "....oqqwqo....",
    "...oooooooo..."], remap:{t:"y"}},
  clockTower: {art:[
    "....oo....",
    "...oyyo...",
    "..oBBBBo..",
    ".oBBBBBBo.",
    "oooooooooo",
    ".ozzzzzzo.",
    ".oz####zo.",
    ".oz#o##zo.",
    ".oz#oo#zo.",
    ".oz####zo.",
    ".ozzzzzzo.",
    ".ozzBBzzo.",
    ".ozzBBzzo.",
    ".ozowwozo.",
    ".ozowwozo.",
    "oooooooooo"], alt:[
    "....oo....",
    "...oyyo...",
    "..oBBBBo..",
    ".oBBBBBBo.",
    "oooooooooo",
    ".ozzzzzzo.",
    ".oz####zo.",
    ".oz#o##zo.",
    ".oz#o##zo.",
    ".oz#o##zo.",
    ".ozzzzzzo.",
    ".ozzBBzzo.",
    ".ozzBBzzo.",
    ".ozowwozo.",
    ".ozowwozo.",
    "oooooooooo"]},
  chest: {art:[
    "....oo..oo..",
    "...oyyooyyo.",
    "..oooooooo..",
    ".owwwwwwwwo.",
    "owWwwwwwwWwo",
    "oyyyyyyyyyyo",
    "owwwwooowwwo",
    "owwwwoyowwwo",
    "owWwwooowWwo",
    "oyyyyyyyyyyo",
    "owwwwwwwwwwo",
    "oooooooooooo"], remap:{y:"z"}},

  /* ---- featured content ---- */
  truck: {art:[
    "........ooooo.",
    "........oBBRo.",
    ".ooooooooBBRRo",
    "oRRRRRRRRRRRRo",
    "oRyRRRRRRRRRyo",
    "oooooooooooooo",
    ".oooo....oooo.",
    "ooeeoo..ooeeoo",
    "ooeeoo..ooeeoo",
    ".oooo....oooo."], remap:{y:"z"}},
  easel: {art:[
    "oooooooooo",
    "o#pp###yyo",
    "o#pp#BB#yo",
    "o###BBB##o",
    "o#G####R#o",
    "oooooooooo",
    ".ow....wo.",
    ".ow....wo.",
    "ow......wo",
    "oo......oo"]},
  orrery: {art:[
    ".....ooo...o.",
    "....oyyyo.oBo",
    "...oyyLyyo.o.",
    "ttoyyyyyyyott",
    "...oyyyLyo...",
    "....oyyyo....",
    ".....ooo.....",
    "......o......",
    "....ooooo...."], remap:{L:"y", t:"q"}},
  spaceBook: {art:[
    ".oooo..oooo.",
    "o####oo####o",
    "o#ee#oo#yy#o",
    "o####oo#yy#o",
    "o#ee#oo####o",
    "o####oo#ee#o",
    "oooooooooooo",
    ".ouuuuuuuuo.",
    "..oooooooo.."], remap:{y:"t"}},

  /* ---- the kid ---- */
  hero: {art:[
    "..ooooo..",
    ".oHHHHHo.",
    "ohhhhhhho",
    ".ozzzzzo.",
    ".ozozozo.",
    ".ozzzzzo.",
    "..ooooo..",
    ".oHHHHHo.",
    "ozHHHHHzo",
    ".oHHHHHo.",
    ".ohhohho.",
    ".oo...oo."], alt:[
    "..ooooo..",
    ".oHHHHHo.",
    "ohhhhhhho",
    ".ozzzzzo.",
    ".ozozozo.",
    ".ozzozzo.",
    "..ooooo..",
    "zoHHHHHoz",
    ".oHHHHHo.",
    ".oHHHHHo.",
    ".ohhohho.",
    ".oo...oo."]},

  /* ---- toys ---- */
  appleTree: {art:[
    "...ooooo...",
    ".ooGGgGGoo.",
    "oGgRggggRgo",
    "ogggGggRggo",
    "oRgggggggdo",
    ".oddgggddo.",
    "..ooowooo..",
    "....owo....",
    "....owo....",
    "...ooooo..."]},
  chicken: {art:[
    "..oRRo...",
    ".o####o..",
    "yy#o##o..",
    ".o#####oo",
    ".o##c###o",
    "..o####o.",
    "...y.y...",
    "..yy.yy.."]},
  windmill: {art:[
    "#.......#",
    ".#.....#.",
    "..#...#..",
    "...oyo...",
    "..#ozo#..",
    ".#owzwo#.",
    "#.owwwo.#",
    "..owzwo..",
    "..owwwo..",
    ".owwWwwo.",
    ".ooooooo."], alt:[
    "....#....",
    "....#....",
    "....#....",
    "###oyo###",
    "...ozo...",
    "..owzwo..",
    "..owwwo..",
    "..owzwo..",
    "..owwwo..",
    ".owwWwwo.",
    ".ooooooo."]},
  cat: {art:[
    ".o.o......",
    "oKoKo.....",
    "oKKKKoooo.",
    "oKoKoKKKKo",
    ".oKKKKKKKo",
    "..oooooooo"], alt:[
    ".o.o......",
    "oKoKo.....",
    "oKKKKoooo.",
    "oyKyoKKKKo",
    ".oKpKKKKKo",
    "..oooooooo"]},
  robot: {art:[
    "...oRo..",
    ".oooooo.",
    ".oetteo.",
    ".oeeeeo.",
    ".oeyyeo.",
    ".oooooo.",
    "ooeeeeoo",
    "eoeRReoe",
    ".oeeeeo.",
    ".oo..oo."], remap:{t:"p", R:"y"}},
  gumball: {art:[
    "..oooo..",
    ".o#ptyo.",
    "o#yRBp#o",
    "o#BpyR#o",
    ".optRyo.",
    "..oooo..",
    ".oRRRRo.",
    ".oRyRRo.",
    ".oRRRRo.",
    "oooooooo"]},
  lavaVent: {art:[
    "..oLLo..",
    ".okLLko.",
    "okkkkkko",
    "okrkkkKo",
    "oooooooo"], remap:{L:"y"}},
  rockBuddy: {art:[
    "..oooo..",
    ".okKKko.",
    "okKkkkko",
    "okokkoko",
    "okkkkkko",
    "okkrrkko",
    ".oooooo."], alt:[
    "..oooo..",
    ".okKKko.",
    "okKkkkko",
    "okrkkrko",
    "okkkkkko",
    "okooooko",
    ".oooooo."]},
  snowman: {art:[
    "...ooo...",
    "..oWWWo..",
    ".ooooooo.",
    ".o#####o.",
    ".o#o#o#o.",
    ".o##L##o.",
    "..ooooo..",
    ".o##y##o.",
    "o#######o",
    "o###y###o",
    ".o#####o.",
    "..ooooo.."]},
  penguin: {art:[
    "..ooo..",
    ".ouuuo.",
    "ou#u#uo",
    "ouuyuuo",
    "ou###uo",
    "ou###uo",
    ".oyoyo."]},
  owl: {art:[
    ".o....o.",
    ".oWooWo.",
    "oWWWWWWo",
    "oyyWWyyo",
    "oyoWWoyo",
    "oWWLLWWo",
    "oWssssWo",
    ".oWssWo.",
    "..oyyo.."], alt:[
    ".o....o.",
    ".oWooWo.",
    "oWWWWWWo",
    "oWWWWWWo",
    "ooWWWWoo",
    "oWWLLWWo",
    "oWssssWo",
    ".oWssWo.",
    "..oyyo.."]},
  bush: {art:[
    "..oooooo..",
    ".oGGgGgdo.",
    "oGggGgggdo",
    "ogGgggGgdo",
    "odggggggdo",
    ".oooooooo."]},
  mushroom: {art:[
    "..oooooo..",
    ".oRR#RRRo.",
    "oR#RRRR#Ro",
    "oRRRR#RRRo",
    "oooooooooo",
    "...o##o...",
    "...o##o...",
    "..oooooo.."]},
  crystalCyan: {art:[
    "..oo..",
    ".o#to.",
    "o#ttBo",
    "o#ttBo",
    "otttBo",
    "ottBBo",
    ".oBBo.",
    "oooooo"]},
  crystalPink: {from:"crystalCyan", tint:{t:"p", B:"m"}},
  crystalLilac: {from:"crystalCyan", tint:{t:"q", B:"v"}},
  frog: {art:[
    ".oo..oo.",
    "o#oGGo#o",
    "oGGGGGGo",
    "oGooooGo",
    "oGGGGGGo",
    "ogGooGgo",
    "oo....oo"]},
  echoStone: {outline:true, art:[
    "....q....",
    "...q#q...",
    ".q.q#q.t.",
    "q#qq#qt#t",
    "q#qqqqt#t",
    "qqqvqqttt",
    "vvvvvvvvv"], remap:{q:"#", t:"i"}},
  sunflower: {outline:true, art:[
    "..yyy..",
    ".yWWWy.",
    "yWWWWWy",
    ".yWWWy.",
    "..yyy..",
    "...g...",
    ".GGg...",
    "...gGG.",
    "...g..."]},
  cow: {outline:true, art:[
    "c..c.......",
    "####.......",
    "#o#o###o###",
    "####o######",
    "pp#####oo##",
    "...########",
    "...#.#..#.#"]},
  beehive: {art:[
    "..ooo..",
    ".oyyyo.",
    "oWWWWWo",
    "oyyyyyo",
    "oWWoWWo",
    "oyyyyyo",
    ".ooooo."]},
  molehill: {art:[
    "...ooo...",
    "..oWWWo..",
    ".oWwWwWo.",
    "oWwWwWwWo",
    "ooooooooo"]},
  crab: {outline:true, art:[
    "RR.....RR",
    ".R.#.#.R.",
    ".RRRRRRR.",
    "RRRRRRRRR",
    "R.R.R.R.R"]},
  palm: {outline:true, art:[
    "..GG...GG..",
    ".GGGG.GGGG.",
    "GG..GGG..GG",
    "G..WGwGW..G",
    ".....w.....",
    "....w......",
    "....w......",
    "...ww......"]},
  whale: {outline:true, art:[
    "..........e.e",
    "...eeeee..ee.",
    ".eeeeeeeeee..",
    "eoeeeeeeeee..",
    "#####eeee....",
    ".#####......."]},
  fish: {outline:true, art:[
    "..LLL.L",
    ".LoLLLL",
    "..LLL.L"]},
  boat: {outline:true, art:[
    "....#.....",
    "....##....",
    "....###...",
    "....w.....",
    "RRRRRRRRRR",
    ".wWwWwWww.",
    "..wwwwww.."]},
  moon: {outline:true, art:[
    "...qqqqq...",
    ".qq#qqqqqq.",
    ".q#qqqqqqv.",
    "qqqoqqqoqvv",
    "qqqqqqqqqvv",
    "qqpqqqqqpvv",
    "qqqqoooqqvv",
    ".qqqqqqqvv.",
    ".qqqqqqvvv.",
    "...vvvvv..."], alt:[
    "...qqqqq...",
    ".qq#qqqqqq.",
    ".q#qqqqqqv.",
    "qqqoqqoooqv",
    "qqqqqqqqqvv",
    "qqpqqqqqpvv",
    "qqqqoooqqvv",
    ".qqqqqqqvv.",
    ".qqqqqqvvv.",
    "...vvvvv..."]},

  /* ---- particles + mini-game pieces ---- */
  pApple:   {art:[".G.","RRR","RRR"]},
  pEgg:     {art:[".#.","###",".#."]},
  pHeart:   {art:["p.p","ppp",".p."]},
  pNote:    {art:["..yy","..y.","yyy.","yy.."]},
  pGumball: {art:[".p.","ppp",".p."], remap:{p:"t"}},
  pLava:    {art:[".L.","LyL",".L."]},
  pSmoke:   {art:[".c.","c#c",".c."]},
  pSnow:    {art:[".#.","#.#",".#."]},
  pBunny:   {outline:true, art:["#.#","#.#","###","o#o","###"]},
  pSparkle: {art:[".z.","z#z",".z."]},
  pBee:     {art:["yoy"]},
  pCoconut: {art:["WW","WW"]},
  pDrop:    {art:["t","B"]},
  pRain:    {art:["B","B"]},
  pShooting:{art:["....#","..zz.","zz..."]},
  pZ:       {art:["###","..#",".#.","###"]},
  gStar:    {outline:true, art:["..y..",".yyy.","yyzyy",".yyy.","y...y"]},
  gBubble:  {art:[".iii.","i#..i","i...i","i...i",".iii."]},
  gBasket:  {outline:true, art:["w.....w","wWwWwWw",".wWwWw."]},
  gMole:    {art:[".ooooo.","oWWWWWo","oWoWoWo","oWWpWWo","oWWWWWo"]},
  gHole:    {art:[".ooooo.","oWWWWWo",".ooooo."]}
};

/* Which sprite draws each landmark from planet-map SITES. */
export const LANDMARK_SPRITE = {
  "section:quests":"questHut", "section:games":"arcade", "section:acts":"volcano", "section:learn":"observatory",
  "section:books":"libraryTree", "section:music":"musicShroom", "section:day":"clockTower", "section:rewards":"chest",
  "game:monster-truck":"truck", "game:paint":"easel", "game:solar":"orrery", "book:space":"spaceBook"
};

function rowsOf(name, frame){
  var def = SPRITES[name];
  if (!def) throw new Error("Unknown sprite " + name);
  if (def.from) {
    var base = rowsOf(def.from, frame);
    return base.map(function(row){return row.replace(/./g, function(ch){return def.tint[ch] || ch;});});
  }
  if (frame === 1 && def.alt) return def.alt;
  if (frame === 1 && def.remap) return def.art.map(function(row){return row.replace(/./g, function(ch){return def.remap[ch] || ch;});});
  return def.art;
}

export function frameCount(name){
  var def = SPRITES[name];
  if (def.from) return frameCount(def.from);
  return def.alt || def.remap ? 2 : 1;
}

/* Palette indices for one frame, -1 = transparent, padded 1px all round.
   variant: "normal" | "dark" (near the limb) | "sleep" (place not available — calm grey, never red). */
export function spritePixels(name, frame, variant, heroIndex){
  var def = SPRITES[name], rows = rowsOf(name, frame || 0);
  var outline = def.outline || (def.from && SPRITES[def.from].outline);
  var w = 0;
  rows.forEach(function(row){w = Math.max(w, row.length);});
  var W = w + 2, H = rows.length + 2, px = new Int16Array(W*H).fill(-1);
  var hero = heroIndex == null ? C.cyan : heroIndex;
  rows.forEach(function(row, y){
    for (var x = 0; x < row.length; x++) {
      var ch = row[x];
      if (ch === "." || ch === " ") continue;
      var index = ch === "H" ? hero : ch === "h" ? DARK[hero] : KEY[ch];
      if (index === undefined) throw new Error("Sprite " + name + " uses unknown pixel '" + ch + "'");
      px[(y+1)*W + x + 1] = index;
    }
  });
  if (outline) {
    var copy = px.slice();
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (copy[y*W + x] !== -1) continue;
      var near = (x > 0 && copy[y*W + x - 1] !== -1) || (x < W-1 && copy[y*W + x + 1] !== -1) ||
                 (y > 0 && copy[(y-1)*W + x] !== -1) || (y < H-1 && copy[(y+1)*W + x] !== -1);
      if (near) px[y*W + x] = C.outline;
    }
  }
  if (variant === "dark" || variant === "sleep") {
    for (var i = 0; i < px.length; i++) {
      var c = px[i];
      if (c < 0 || c === C.outline) continue;
      if (variant === "dark") px[i] = DARK[c];
      else { var lum = luminance(c); px[i] = lum > 0.6 ? C.snowShade : lum > 0.35 ? C.grey : C.steel; }
    }
  }
  return {width:W, height:H, pixels:px};
}

/* Browser only: rasterise every sprite into canvases. atlas[name][variant][frame] -> canvas. */
export function buildAtlas(heroIndex){
  var atlas = {};
  Object.keys(SPRITES).forEach(function(name){
    atlas[name] = {};
    ["normal","dark","sleep"].forEach(function(variant){
      atlas[name][variant] = [];
      for (var f = 0; f < frameCount(name); f++) {
        var sprite = spritePixels(name, f, variant, heroIndex);
        var canvas = document.createElement("canvas");
        canvas.width = sprite.width; canvas.height = sprite.height;
        var ctx = canvas.getContext("2d"), img = ctx.createImageData(sprite.width, sprite.height);
        var out = new Uint32Array(img.data.buffer);
        for (var i = 0; i < sprite.pixels.length; i++) out[i] = sprite.pixels[i] < 0 ? 0 : RGBA[sprite.pixels[i]];
        ctx.putImageData(img, 0, 0);
        atlas[name][variant].push(canvas);
      }
    });
  });
  return atlas;
}
```

- [ ] **Step 4: Run the tests and the repo gate**

Run: `node --test scripts/planet-sprites.test.mjs` — expected: `ℹ pass 5`.
Run: `node scripts/check.mjs` — expected: green.

- [ ] **Step 5 (optional, recommended): Contact sheet**

Render every sprite to a PNG in your scratch folder and look at it. Reuse the `png()` helper from slice 60 step 5, then:

```js
const { SPRITES, spritePixels, frameCount } = await import(repo + "js/world/planet-sprites.js");
const { nearestIndex } = await import(repo + "js/world/planet-palette.js");
const W=200,H=130,buf=new Uint32Array(W*H).fill(RGBA[C.green]);let x=2,y=2,rowH=0;
for(const name of Object.keys(SPRITES))for(let f=0;f<frameCount(name);f++){
  const s=spritePixels(name,f,"normal",nearestIndex("#ff6fb5"));
  if(x+s.width>W){x=2;y+=rowH+2;rowH=0;}
  for(let j=0;j<s.height;j++)for(let i=0;i<s.width;i++){const c=s.pixels[j*s.width+i];if(c>=0)buf[(y+j)*W+x+i]=RGBA[c];}
  x+=s.width+2;rowH=Math.max(rowH,s.height);}
png(new URL("./sheet.png", import.meta.url),W,H,buf,5);
```

Expected sprites: a red-roof hut with a yellow flag, a purple arcade with a neon strip, a volcano, an observatory dome, a library tree, a pink music mushroom, a clock tower and a treasure chest. Then the truck, easel, orrery, space book and the pink hero, followed by toys and particles.

- [ ] **Step 6: Commit**

```bash
git add js/world/planet-sprites.js scripts/planet-sprites.test.mjs
git commit -m "feat(world): add pixel planet sprite art"
```
