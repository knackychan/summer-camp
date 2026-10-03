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
