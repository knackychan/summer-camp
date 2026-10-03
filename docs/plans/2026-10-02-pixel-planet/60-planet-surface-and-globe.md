# Slice 60 — Planet surface + globe renderer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the pure pixel-planet core: the palette, the deterministic surface map, and the per-pixel globe renderer, each with node tests. Nothing in the app imports these modules yet.

**Architecture:** `planet-palette.js` holds the only 32 colours. `planet-map.js` builds a 256×128 equirectangular grid of palette indices: 8 biome districts, ocean, polar caps, and paths that hop between neighbouring districts. `planet-globe.js` holds the quaternion math, `project`/`unproject`, and `drawGlobe`, which fills a Uint32 RGBA buffer with banded, Bayer-dithered shading, a night edge, an atmosphere rim and cloud shadows. Design: [design.md](design.md) D1, D5, "Architecture" and "Look".

**Tech Stack:** Plain ES modules (no build step), `node:test`. Keep to the repo's legacy-syntax guard: no `?.`, no `??`, no `.flatMap(`. Watch for ternaries like `a?.5:1`, and always write `0.5`.

**Depends on:** nothing. **Branch:** `feat/pixel-planet`.

**DONE WHEN:**
- `node --test scripts/planet-map.test.mjs scripts/planet-globe.test.mjs` passes, with 7 + 7 tests.
- `node scripts/check.mjs` is green.
- Both modules and tests are committed.

---

### Task 1: Palette + surface map

**Files:**
- Create: `js/world/planet-palette.js`
- Create: `js/world/planet-map.js`
- Test: `scripts/planet-map.test.mjs`

- [ ] **Step 1: Write the failing test** — create `scripts/planet-map.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { HEX, DARK, LIGHT, RGBA, C, nearestIndex } from "../js/world/planet-palette.js";
import { buildPlanetMap, buildCloudMap, BIOMES, SITES, DISTRICTS, PATH_EDGES, MAP_W, MAP_H, cellIndex, latLonToVec, angleBetween, pathPoints } from "../js/world/planet-map.js";

const WORLD_IDS = ["section:quests","section:games","section:acts","section:learn","section:books","section:music","section:day","section:rewards",
  "game:monster-truck","game:solar","book:space","game:paint"];

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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test scripts/planet-map.test.mjs`
Expected: FAIL with `Cannot find module ... js/world/planet-palette.js`.

- [ ] **Step 3: Create `js/world/planet-palette.js`**

```js
/* Pixel Planet palette — the only colours the world ever draws (design D1).
   Indices are stable: planet-map stores them, sprites reference them by key char. */

export const HEX = [
  "#0b0a1f", // 0  outline
  "#17153b", // 1  space
  "#2a2560", // 2  space2 / night ocean
  "#123d33", // 3  greenDeep
  "#232174", // 4  oceanDark
  "#3340b8", // 5  ocean
  "#4d78e0", // 6  oceanLit
  "#8fd3ff", // 7  ice / shore foam
  "#1d5e45", // 8  greenDark
  "#2f9a4c", // 9  green
  "#7bd34b", // 10 greenLit
  "#c9ef6a", // 11 lime
  "#5a2d2a", // 12 rockDark
  "#8e4a3a", // 13 rock
  "#c9744a", // 14 rockLit
  "#ff7a1f", // 15 lava
  "#ffd23f", // 16 yellow
  "#e3b770", // 17 sand
  "#f6e2a4", // 18 sandLit
  "#a8743f", // 19 wood
  "#6b4528", // 20 woodDark
  "#ff5fa2", // 21 pink
  "#b5309a", // 22 magenta
  "#5b1e7a", // 23 purpleDark
  "#9a5ae0", // 24 purple
  "#d8c4ff", // 25 lilac
  "#ffffff", // 26 white
  "#c4d4ec", // 27 snowShade
  "#7d8fb8", // 28 steel
  "#e8402e", // 29 red
  "#39d0c8", // 30 cyan
  "#8a8aa8"  // 31 grey
];

export const C = {
  outline:0, space:1, space2:2, greenDeep:3, oceanDark:4, ocean:5, oceanLit:6, ice:7,
  greenDark:8, green:9, greenLit:10, lime:11, rockDark:12, rock:13, rockLit:14, lava:15,
  yellow:16, sand:17, sandLit:18, wood:19, woodDark:20, pink:21, magenta:22, purpleDark:23,
  purple:24, lilac:25, white:26, snowShade:27, steel:28, red:29, cyan:30, grey:31
};

/* One step darker / lighter inside the palette, per index. Shading never leaves the palette. */
export const DARK = Uint8Array.from([0,0,1,0,2,4,5,6,3,8,9,10,0,12,13,29,15,19,17,20,12,22,23,2,23,24,27,28,2,12,6,28]);
export const LIGHT = Uint8Array.from([2,2,23,8,5,6,7,26,9,10,11,18,13,14,17,16,18,18,26,17,19,25,21,24,25,26,26,26,27,15,7,27]);

function parseHex(hex){
  var n = parseInt(String(hex).replace("#",""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ImageData is RGBA bytes; on little-endian hosts a Uint32 view reads them as ABGR. */
export const RGBA = Uint32Array.from(HEX.map(function(hex){
  var c = parseHex(hex);
  return ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
}));

export function nearestIndex(hex){
  var target = parseHex(hex), best = 0, bestDist = Infinity;
  if (!/^#?[0-9a-fA-F]{6}$/.test(String(hex))) return C.cyan;
  for (var i = 0; i < HEX.length; i++) {
    if (i === C.outline || i === C.space || i === C.space2) continue;
    var c = parseHex(HEX[i]), d = (c[0]-target[0])*(c[0]-target[0]) + (c[1]-target[1])*(c[1]-target[1]) + (c[2]-target[2])*(c[2]-target[2]);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

export function luminance(index){
  var c = parseHex(HEX[index]);
  return (0.299*c[0] + 0.587*c[1] + 0.114*c[2]) / 255;
}
```

- [ ] **Step 4: Create `js/world/planet-map.js`**

```js
/* Pixel Planet surface — an equirectangular grid of palette indices.
   Pure and deterministic: same seed, same planet. No DOM. */
import { C } from "./planet-palette.js";

export const MAP_W = 256;
export const MAP_H = 128;
export const BIOMES = ["ocean","village","arcade","volcano","snow","forest","grove","meadow","beach","ice","rock"];
export const DEFAULT_SEED = 7;

/* Section ids are district centres; featured content sits inside its parent biome. */
export const SITES = [
  {id:"section:quests",     biome:"village", lat:6,   lon:0},
  {id:"section:games",      biome:"arcade",  lat:30,  lon:55},
  {id:"game:monster-truck", biome:"arcade",  lat:19,  lon:68},
  {id:"game:paint",         biome:"arcade",  lat:41,  lon:68},
  {id:"section:acts",       biome:"volcano", lat:-30, lon:42},
  {id:"section:learn",      biome:"snow",    lat:40,  lon:-55},
  {id:"game:solar",         biome:"snow",    lat:30,  lon:-71},
  {id:"section:books",      biome:"forest",  lat:-26, lon:-45},
  {id:"book:space",         biome:"forest",  lat:-15, lon:-31},
  {id:"section:music",      biome:"grove",   lat:24,  lon:122},
  {id:"section:day",        biome:"meadow",  lat:-26, lon:162},
  {id:"section:rewards",    biome:"beach",   lat:4,   lon:-122}
];

export const DISTRICTS = SITES.filter(function(site){return site.id.indexOf("section:")===0;}).map(function(site){
  return {biome:site.biome, lat:site.lat, lon:site.lon, radius:site.biome==="village"?0.42:0.46};
});

var RAD = Math.PI/180;

export function latLonToVec(lat, lon){
  var la = lat*RAD, lo = lon*RAD, c = Math.cos(la);
  return [c*Math.sin(lo), Math.sin(la), c*Math.cos(lo)];
}
export function cellLatLon(col, row){
  return {lat:90-(row+0.5)/MAP_H*180, lon:(col+0.5)/MAP_W*360-180};
}
export function cellIndex(lat, lon){
  var col = Math.floor((lon+180)/360*MAP_W), row = Math.floor((90-lat)/180*MAP_H);
  col = ((col % MAP_W) + MAP_W) % MAP_W;
  row = Math.max(0, Math.min(MAP_H-1, row));
  return row*MAP_W + col;
}
export function angleBetween(a, b){
  var d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  return Math.acos(Math.max(-1, Math.min(1, d)));
}

function hash3(x, y, z, seed){
  var h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
function smooth(t){return t*t*(3-2*t);}
function valueNoise(x, y, z, seed){
  var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  var tx = smooth(x-xi), ty = smooth(y-yi), tz = smooth(z-zi);
  function corner(dx, dy, dz){return hash3(xi+dx, yi+dy, zi+dz, seed);}
  function lerp(a, b, t){return a+(b-a)*t;}
  var x00 = lerp(corner(0,0,0), corner(1,0,0), tx), x10 = lerp(corner(0,1,0), corner(1,1,0), tx);
  var x01 = lerp(corner(0,0,1), corner(1,0,1), tx), x11 = lerp(corner(0,1,1), corner(1,1,1), tx);
  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
}
export function fbm(v, scale, seed){
  return 0.65*valueNoise(v[0]*scale, v[1]*scale, v[2]*scale, seed)
       + 0.35*valueNoise(v[0]*scale*2.1, v[1]*scale*2.1, v[2]*scale*2.1, seed+1);
}

function biomeColor(biome, h, n, fine, gap){
  switch (biome) {
    case "village":
      if (h > 0.5 && h < 0.515) return C.pink;
      if (h >= 0.515 && h < 0.53) return C.yellow;
      if (h < 0.1 || n > 0.64) return C.greenLit;
      return h > 0.93 ? C.greenDark : C.green;
    case "arcade":
      if (h < 0.04) return C.cyan;
      if (h < 0.07) return C.pink;
      if (h < 0.09) return C.yellow;
      return fine > 0.6 ? C.purple : C.purpleDark;
    case "volcano":
      if (gap < -0.39) return C.lava;
      if (gap < -0.35) return C.rockDark;
      if (Math.abs(fine-0.5) < 0.025) return C.lava;
      return n > 0.6 ? C.rockLit : n < 0.38 ? C.rockDark : C.rock;
    case "snow":
      if (h < 0.05) return C.steel;
      return n < 0.42 ? C.snowShade : C.white;
    case "forest":
      if (h < 0.06) return C.greenDeep;
      return fine > 0.66 ? C.greenLit : fine > 0.55 ? C.green : C.greenDark;
    case "grove":
      if (h < 0.04) return C.cyan;
      return fine > 0.7 ? C.lilac : fine > 0.6 ? C.pink : C.magenta;
    case "meadow":
      if (h < 0.06) return C.yellow;
      if (h < 0.08) return C.white;
      return n > 0.6 ? C.lime : n < 0.35 ? C.green : C.greenLit;
    case "beach":
      if (h < 0.03) return C.pink;
      if (gap > -0.05) return C.sandLit;
      return n > 0.58 ? C.sandLit : C.sand;
    case "ice":
      return n > 0.62 ? C.white : n < 0.4 ? C.ice : C.snowShade;
    case "rock":
      return n > 0.6 ? C.rockLit : n < 0.4 ? C.rockDark : C.rock;
    default:
      if (gap < 0.012) return C.ice;
      if (gap < 0.035) return C.oceanLit;
      if (h < 0.015) return C.oceanLit;
      return n < 0.4 ? C.oceanDark : C.ocean;
  }
}

function slerpVec(a, b, t){
  var omega = angleBetween(a, b), s = Math.sin(omega);
  if (s < 1e-6) return a.slice();
  var wa = Math.sin((1-t)*omega)/s, wb = Math.sin(t*omega)/s;
  return [a[0]*wa+b[0]*wb, a[1]*wa+b[1]*wb, a[2]*wa+b[2]*wb];
}
function vecLatLon(v){
  return {lat:Math.asin(Math.max(-1, Math.min(1, v[1])))/RAD, lon:Math.atan2(v[0], v[2])/RAD};
}

/* Paths hop between neighbouring districts so none cuts through another biome. */
export const PATH_EDGES = [["village","arcade"],["village","volcano"],["village","snow"],["village","forest"],["arcade","grove"],["volcano","meadow"],["forest","beach"]];
export function district(biome){
  for (var i = 0; i < DISTRICTS.length; i++) if (DISTRICTS[i].biome === biome) return DISTRICTS[i];
  return null;
}

/* Great-circle samples between two districts. Shared by the map and its tests. */
export function pathPoints(fromBiome, toBiome, steps){
  var a = district(fromBiome), b = district(toBiome);
  var from = latLonToVec(a.lat, a.lon), end = latLonToVec(b.lat, b.lon), out = [];
  for (var i = 0; i <= steps; i++) out.push(vecLatLon(slerpVec(from, end, i/steps)));
  return out;
}

export function buildPlanetMap(seed){
  seed = seed == null ? DEFAULT_SEED : seed;
  var size = MAP_W*MAP_H, color = new Uint8Array(size), biome = new Uint8Array(size), path = new Uint8Array(size);
  var centres = DISTRICTS.map(function(d){return latLonToVec(d.lat, d.lon);});
  for (var row = 0; row < MAP_H; row++) {
    for (var col = 0; col < MAP_W; col++) {
      var ll = cellLatLon(col, row), v = latLonToVec(ll.lat, ll.lon), i = row*MAP_W + col;
      var n = fbm(v, 3.2, seed), h = hash3(col, row, 0, seed+99), fine = fbm(v, 14, seed+5), edge = (n-0.5)*0.22;
      var best = -1, gap = Infinity;
      for (var d = 0; d < DISTRICTS.length; d++) {
        var score = angleBetween(v, centres[d]) - (DISTRICTS[d].radius + edge);
        if (score < gap) { gap = score; best = d; }
      }
      var polar = (Math.abs(ll.lat) - (70 + (n-0.5)*14)) * RAD;
      var name = "ocean";
      if (polar > 0) name = ll.lat > 0 ? "ice" : "rock";
      else if (gap < 0) name = DISTRICTS[best].biome;
      else gap = Math.min(gap, -polar);
      biome[i] = BIOMES.indexOf(name);
      color[i] = biomeColor(name, h, n, fine, gap);
    }
  }
  PATH_EDGES.forEach(function(edge){
    pathPoints(edge[0], edge[1], 240).forEach(function(p, step){
      [cellIndex(p.lat, p.lon), cellIndex(p.lat, p.lon + 360/MAP_W)].forEach(function(i){
        path[i] = 1;
        color[i] = biome[i] === 0 ? (step % 3 === 0 ? C.woodDark : C.wood) : (step % 2 ? C.sand : C.sandLit);
      });
    });
  });
  return {width:MAP_W, height:MAP_H, color:color, biome:biome, path:path, sites:SITES};
}

/* Cloud layer: 0 clear, 1 cloud. Drifts over the surface at its own longitude offset. */
export function buildCloudMap(seed){
  seed = seed == null ? DEFAULT_SEED : seed;
  var out = new Uint8Array(MAP_W*MAP_H);
  for (var row = 0; row < MAP_H; row++) {
    for (var col = 0; col < MAP_W; col++) {
      var ll = cellLatLon(col, row), v = latLonToVec(ll.lat, ll.lon);
      out[row*MAP_W + col] = fbm([v[0], v[1]*3, v[2]], 4.2, seed+11) > 0.72 ? 1 : 0;
    }
  }
  return out;
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `node --test scripts/planet-map.test.mjs`
Expected: `ℹ pass 7`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add js/world/planet-palette.js js/world/planet-map.js scripts/planet-map.test.mjs
git commit -m "feat(world): add pixel planet palette and surface map"
```

### Task 2: Globe projection + pixel fill

**Files:**
- Create: `js/world/planet-globe.js`
- Test: `scripts/planet-globe.test.mjs`

- [ ] **Step 1: Write the failing test** — create `scripts/planet-globe.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildPlanetMap, buildCloudMap } from "../js/world/planet-map.js";
import { facingQuat, project, unproject, drawGlobe, quatMul, quatAxisAngle, quatRotate, quatSlerp, quatNormalize } from "../js/world/planet-globe.js";

const close = (a, b, eps, label) => assert.ok(Math.abs(a - b) < eps, `${label}: ${a} vs ${b}`);
const lonClose = (a, b, eps, label) => close(((a - b + 540) % 360) - 180, 0, eps, label);

test("facing a lat/lon puts it at the disc centre, nearest the viewer", () => {
  for (const [lat, lon] of [[0, 0], [30, 55], [-26, 162], [40, -55]]) {
    const view = { rotation: facingQuat(lat, lon), radius: 50, cx: 100, cy: 80 };
    const p = project(lat, lon, view);
    close(p.x, 100, 1e-6, "x"); close(p.y, 80, 1e-6, "y"); close(p.z, 1, 1e-9, "z");
    const back = unproject(100, 80, view);
    close(back.lat, lat, 1e-6, "lat"); lonClose(back.lon, lon, 1e-6, "lon");
  }
});

test("facing keeps north up", () => {
  const view = { rotation: facingQuat(20, 70), radius: 50, cx: 0, cy: 0 };
  const north = quatRotate(view.rotation, [0, 1, 0]);
  close(north[0], 0, 1e-9, "north has no sideways lean");
  assert.ok(north[1] > 0, "north points up");
});

test("project then unproject round-trips on the visible side", () => {
  const view = { rotation: quatNormalize(quatMul(quatAxisAngle([0, 0, 1], 0.3), facingQuat(12, -40))), radius: 64, cx: 90, cy: 70 };
  for (const [lat, lon] of [[12, -40], [30, -10], [-20, -70], [0, -40], [50, -40]]) {
    const p = project(lat, lon, view);
    assert.ok(p.z > 0, `${lat},${lon} visible`);
    const back = unproject(p.x, p.y, view);
    close(back.lat, lat, 1e-6, "lat"); lonClose(back.lon, lon, 1e-6, "lon");
  }
});

test("the far side reports negative depth and unproject misses outside the disc", () => {
  const view = { rotation: facingQuat(0, 0), radius: 40, cx: 50, cy: 50 };
  assert.ok(project(0, 180, view).z < -0.99);
  assert.ok(project(10, 120, view).z < 0);
  assert.equal(unproject(50 + 41, 50, view), null);
});

test("slerp walks from one rotation to another", () => {
  const a = facingQuat(0, 0), b = facingQuat(0, 90);
  const mid = quatSlerp(a, b, 0.5), view = { rotation: mid, radius: 10, cx: 0, cy: 0 };
  close(project(0, 45, view).z, 1, 1e-6, "halfway faces 45°");
});

test("drawGlobe paints the disc and its rim only, leaving the rest transparent", () => {
  const map = buildPlanetMap(7), clouds = buildCloudMap(7);
  const width = 160, height = 120, R = 40, cx = 80, cy = 60;
  const target = { data: new Uint32Array(width * height).fill(123), width, height };
  drawGlobe(target, map, clouds, { rotation: facingQuat(18, 0), radius: R, cx, cy }, 0.4);
  let painted = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const v = target.data[y * width + x];
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > R + 2.6) assert.equal(v, 0, `pixel ${x},${y} outside the rim was painted`);
    if (d < R - 1) { assert.notEqual(v, 0, `disc pixel ${x},${y} empty`); painted++; }
  }
  assert.ok(painted > Math.PI * (R - 1) * (R - 1) * 0.95);
});

test("drawGlobe is fast enough for a tablet frame", () => {
  const map = buildPlanetMap(7), clouds = buildCloudMap(7);
  const width = 320, height = 200;
  const target = { data: new Uint32Array(width * height), width, height };
  const view = { rotation: facingQuat(18, 0), radius: 120, cx: 160, cy: 100 };
  drawGlobe(target, map, clouds, view, 0);
  const t = performance.now();
  for (let i = 0; i < 10; i++) drawGlobe(target, map, clouds, view, i * 0.01);
  const each = (performance.now() - t) / 10;
  assert.ok(each < 25, `drawGlobe took ${each.toFixed(1)} ms on desktop node`);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test scripts/planet-globe.test.mjs`
Expected: FAIL with `Cannot find module ... js/world/planet-globe.js`.

- [ ] **Step 3: Create `js/world/planet-globe.js`**

```js
/* Pixel Planet globe — quaternion math, projection and the per-pixel fill.
   View space: x right, y up, z toward the viewer. A surface point is visible when its view z > 0.
   `view` = {rotation:[x,y,z,w] (planet -> view), radius (art px), cx, cy (buffer px)}. */
import { RGBA, DARK, LIGHT, C } from "./planet-palette.js";
import { MAP_W, MAP_H, latLonToVec } from "./planet-map.js";

var RAD = Math.PI/180;
var BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
export var LIGHT_DIR = [-0.55, 0.6, 0.58];

export function quatAxisAngle(axis, angle){
  var s = Math.sin(angle/2);
  return [axis[0]*s, axis[1]*s, axis[2]*s, Math.cos(angle/2)];
}
/* a*b: rotating by the result applies b first, then a. */
export function quatMul(a, b){
  return [
    a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
    a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
    a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
    a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]
  ];
}
export function quatNormalize(q){
  var l = Math.sqrt(q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3]) || 1;
  return [q[0]/l, q[1]/l, q[2]/l, q[3]/l];
}
export function quatConj(q){return [-q[0], -q[1], -q[2], q[3]];}
export function quatRotate(q, v){
  var tx = 2*(q[1]*v[2] - q[2]*v[1]), ty = 2*(q[2]*v[0] - q[0]*v[2]), tz = 2*(q[0]*v[1] - q[1]*v[0]);
  return [
    v[0] + q[3]*tx + (q[1]*tz - q[2]*ty),
    v[1] + q[3]*ty + (q[2]*tx - q[0]*tz),
    v[2] + q[3]*tz + (q[0]*ty - q[1]*tx)
  ];
}
export function quatSlerp(a, b, t){
  var d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
  if (d < 0) { b = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
  if (d > 0.9995) return quatNormalize([a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t, a[3]+(b[3]-a[3])*t]);
  var omega = Math.acos(d), s = Math.sin(omega), wa = Math.sin((1-t)*omega)/s, wb = Math.sin(t*omega)/s;
  return [a[0]*wa+b[0]*wb, a[1]*wa+b[1]*wb, a[2]*wa+b[2]*wb, a[3]*wa+b[3]*wb];
}
/* Rotation that puts (lat, lon) at the disc centre with north up. */
export function facingQuat(lat, lon){
  return quatMul(quatAxisAngle([1,0,0], lat*RAD), quatAxisAngle([0,1,0], -lon*RAD));
}
function quatMatrix(q){
  var x = q[0], y = q[1], z = q[2], w = q[3];
  return [
    1-2*(y*y+z*z), 2*(x*y-z*w),   2*(x*z+y*w),
    2*(x*y+z*w),   1-2*(x*x+z*z), 2*(y*z-x*w),
    2*(x*z-y*w),   2*(y*z+x*w),   1-2*(x*x+y*y)
  ];
}

export function project(lat, lon, view){
  var p = quatRotate(view.rotation, latLonToVec(lat, lon));
  return {x:view.cx + p[0]*view.radius, y:view.cy - p[1]*view.radius, z:p[2]};
}
export function unproject(x, y, view){
  var nx = (x - view.cx)/view.radius, ny = -(y - view.cy)/view.radius, d2 = nx*nx + ny*ny;
  if (d2 > 1) return null;
  var local = quatRotate(quatConj(view.rotation), [nx, ny, Math.sqrt(1-d2)]);
  return {lat:Math.asin(Math.max(-1, Math.min(1, local[1])))/RAD, lon:Math.atan2(local[0], local[2])/RAD};
}

/* Fills target.data (Uint32 RGBA) with the shaded globe; everything else becomes transparent.
   cloudOffset is in radians of longitude. clouds may be null. */
export function drawGlobe(target, map, clouds, view, cloudOffset){
  var data = target.data, w = target.width, h = target.height, R = view.radius, cx = view.cx, cy = view.cy;
  var M = quatMatrix(quatConj(view.rotation)), L = LIGHT_DIR, colors = map.color, shift = cloudOffset || 0;
  var TWO_PI = Math.PI*2, ext = Math.ceil(R + 3);
  data.fill(0);
  var x0 = Math.max(0, Math.floor(cx - ext)), x1 = Math.min(w - 1, Math.ceil(cx + ext));
  var y0 = Math.max(0, Math.floor(cy - ext)), y1 = Math.min(h - 1, Math.ceil(cy + ext));
  for (var py = y0; py <= y1; py++) {
    var ny = -(py + 0.5 - cy)/R;
    for (var px = x0; px <= x1; px++) {
      var nx = (px + 0.5 - cx)/R, d2 = nx*nx + ny*ny, at = py*w + px;
      if (d2 > 1) {
        var dist = Math.sqrt(d2)*R;
        if (dist <= R + 1) data[at] = RGBA[C.outline];
        else if (dist <= R + 2.5 && (nx*L[0] + ny*L[1] > -0.1 || ((px + py) & 1) === 0)) data[at] = RGBA[C.cyan];
        continue;
      }
      var nz = Math.sqrt(1 - d2);
      var lx = M[0]*nx + M[1]*ny + M[2]*nz, ly = M[3]*nx + M[4]*ny + M[5]*nz, lz = M[6]*nx + M[7]*ny + M[8]*nz;
      var lon = Math.atan2(lx, lz), lat = Math.asin(ly > 1 ? 1 : ly < -1 ? -1 : ly);
      var row = ((Math.PI/2 - lat)/Math.PI*MAP_H) | 0, col = ((lon + Math.PI)/TWO_PI*MAP_W) | 0;
      if (row >= MAP_H) row = MAP_H - 1;
      if (col >= MAP_W) col = MAP_W - 1;
      var c = colors[row*MAP_W + col];
      if (clouds) {
        var cc = (((lon + shift + Math.PI)/TWO_PI*MAP_W) | 0) % MAP_W;
        if (cc < 0) cc += MAP_W;
        if (clouds[row*MAP_W + cc]) c = C.white;
        else if (row + 1 < MAP_H && clouds[(row + 1)*MAP_W + (cc + MAP_W - 1) % MAP_W]) c = DARK[c];
      }
      var lam = nx*L[0] + ny*L[1] + nz*L[2], v = lam + (BAYER[(py & 3)*4 + (px & 3)]/16 - 0.47)*0.18;
      if (v > 0.75 || (d2 > 0.93 && lam > 0.3)) c = LIGHT[c];
      else if (v <= 0.15) c = v > -0.2 ? DARK[c] : DARK[DARK[c]];
      data[at] = RGBA[c];
    }
  }
}
```

- [ ] **Step 4: Run the tests and the repo gate**

Run: `node --test scripts/planet-globe.test.mjs` — expected: `ℹ pass 7`.
Run: `node scripts/check.mjs` — expected: green. The new tests are auto-discovered from `scripts/*.test.mjs`.

On a slow machine, the "fast enough" test has a 25 ms budget per 320×200 fill. On the reference workstation it measured ≈3 ms.

- [ ] **Step 5 (optional, recommended): Eyeball the planet**

This script writes `preview-front.png` to your scratch folder (never into the repo). Run it from the repo root and open the PNG:

```js
// save as <scratch>/preview.mjs, run: node <scratch>/preview.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const repo = pathToFileURL(process.cwd() + "/").href;
const { buildPlanetMap, buildCloudMap } = await import(repo + "js/world/planet-map.js");
const { facingQuat, drawGlobe } = await import(repo + "js/world/planet-globe.js");
const { RGBA, C } = await import(repo + "js/world/planet-palette.js");
function png(path, w, h, u32, scale){
  const W=w*scale,H=h*scale, raw=Buffer.alloc((W*4+1)*H);
  for(let y=0;y<H;y++){raw[y*(W*4+1)]=0;for(let x=0;x<W;x++){let v=u32[((y/scale)|0)*w+((x/scale)|0)]||RGBA[C.space];const o=y*(W*4+1)+1+x*4;raw[o]=v&255;raw[o+1]=(v>>>8)&255;raw[o+2]=(v>>>16)&255;raw[o+3]=255;}}
  const T=new Int32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c;});
  const crc=b=>{let c=-1;for(const x of b)c=T[(c^x)&255]^(c>>>8);return (c^-1)>>>0;};
  const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
  const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=6;
  writeFileSync(path,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",ih),chunk("IDAT",deflateSync(raw)),chunk("IEND",Buffer.alloc(0))]));
}
const map=buildPlanetMap(7), clouds=buildCloudMap(7), w=180, h=150, t={data:new Uint32Array(w*h),width:w,height:h};
drawGlobe(t,map,clouds,{rotation:facingQuat(18,0),radius:62,cx:90,cy:75},0.3);
png(new URL("./preview-front.png", import.meta.url), w, h, t.data, 4);
```

Expected look: a round planet, lit from the upper left. The green home village sits at the centre with sand paths radiating out. Snow is at the upper left, the purple arcade at the upper right, the brown volcano at the lower right, the dark-green forest at the lower left. There is a thin dark crescent on the right edge, a cyan rim, and small white clouds.

- [ ] **Step 6: Commit**

```bash
git add js/world/planet-globe.js scripts/planet-globe.test.mjs
git commit -m "feat(world): render the pixel planet globe in software"
```
