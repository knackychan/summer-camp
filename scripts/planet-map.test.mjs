import test from "node:test";
import assert from "node:assert/strict";
import { HEX, DARK, LIGHT, RGBA, C, nearestIndex } from "../js/world/planet-palette.js";
import { buildPlanetMap, buildCloudMap, BIOMES, SITES, DISTRICTS, PATH_EDGES, MAP_W, MAP_H, cellIndex, latLonToVec, angleBetween, pathPoints } from "../js/world/planet-map.js";

const WORLD_IDS = ["section:quests","section:games","section:acts","section:learn","section:books","section:music","section:day","section:rewards",
  "game:monster-truck","game:solar","book:space","game:paint","game:kitchen"];

test("palette is 32 hex colours with in-palette shading steps", () => {
  assert.equal(HEX.length, 32);
  for (const hex of HEX) assert.match(hex, /^#[0-9a-f]{6}$/);
  assert.equal(DARK.length, 32);
  assert.equal(LIGHT.length, 32);
  for (const i of [...DARK, ...LIGHT]) assert.ok(i < 32);
  assert.equal(RGBA[C.white], 0xffffffff);
  assert.equal(nearestIndex("#ff6fb5"), C.pink);
  assert.equal(nearestIndex("not a colour"), C.cyan);
});

test("map is deterministic for a seed and differs across seeds", () => {
  const a = buildPlanetMap(7), b = buildPlanetMap(7), c = buildPlanetMap(8);
  assert.equal(a.width, MAP_W);
  assert.equal(a.height, MAP_H);
  assert.equal(a.color.length, MAP_W * MAP_H);
  assert.deepEqual(a.color, b.color);
  assert.notDeepEqual(a.color, c.color);
});

test("every world landmark has exactly one site, on land, inside its own biome", () => {
  const map = buildPlanetMap(7);
  assert.deepEqual(SITES.map(s => s.id).sort(), [...WORLD_IDS].sort());
  for (const site of SITES) {
    const at = cellIndex(site.lat, site.lon);
    assert.equal(BIOMES[map.biome[at]], site.biome, `${site.id} sits in ${BIOMES[map.biome[at]]}`);
  }
});

test("districts are separated by ocean and the planet has water and poles", () => {
  for (let i = 0; i < DISTRICTS.length; i++) for (let j = i + 1; j < DISTRICTS.length; j++) {
    const a = DISTRICTS[i], b = DISTRICTS[j];
    const gap = angleBetween(latLonToVec(a.lat, a.lon), latLonToVec(b.lat, b.lon)) - a.radius - b.radius;
    assert.ok(gap > 0.05, `${a.biome} and ${b.biome} overlap (gap ${gap.toFixed(3)})`);
  }
  const map = buildPlanetMap(7), count = name => map.biome.filter(v => v === BIOMES.indexOf(name)).length;
  assert.ok(count("ocean") > MAP_W * MAP_H * 0.25, "ocean present");
  assert.ok(count("ice") > 0 && count("rock") > 0, "both polar caps present");
});

test("every district is joined to the home village by unbroken paths", () => {
  const map = buildPlanetMap(7), reached = new Set(["village"]);
  for (let grew = true; grew;) {
    grew = false;
    for (const [a, b] of PATH_EDGES) if (reached.has(a) && !reached.has(b)) { reached.add(b); grew = true; }
  }
  assert.deepEqual([...reached].sort(), DISTRICTS.map(d => d.biome).sort());
  for (const [a, b] of PATH_EDGES) {
    for (const p of pathPoints(a, b, 240)) {
      const at = cellIndex(p.lat, p.lon);
      assert.ok(map.path[at] === 1, `${a}-${b} path broken at ${p.lat.toFixed(1)},${p.lon.toFixed(1)}`);
    }
  }
});

test("paths never cut through a district they do not join", () => {
  const map = buildPlanetMap(7);
  for (const [a, b] of PATH_EDGES) {
    for (const p of pathPoints(a, b, 240)) {
      const name = BIOMES[map.biome[cellIndex(p.lat, p.lon)]];
      assert.ok(["ocean", a, b].includes(name), `${a}-${b} path crosses ${name}`);
    }
  }
});

test("cloud layer covers some but not most of the planet", () => {
  const clouds = buildCloudMap(7), share = clouds.reduce((s, v) => s + v, 0) / clouds.length;
  assert.ok(share > 0.04 && share < 0.3, `cloud share ${share.toFixed(3)}`);
});
