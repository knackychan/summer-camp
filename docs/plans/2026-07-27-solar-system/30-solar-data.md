# Slice 30 — Solar data + validation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every name, number and fact the game will ever show, in one pure data module — bilingual, node-testable, and validated by `check.mjs` — before any 3D code exists.

**Architecture:** `js/games/solar-data.js` is data-only (same discipline as `js/brain-data.js`): no DOM, no Three.js, no globals. Quiz questions (slice 33) and the info card (slice 32) are *derived* from these structured fields, so this file is the single source of truth for both. D8 adds three card fields per body: `type:{en,tz}` (classification), `desc:{en,tz}` (wiki-style description), `photo` (vendored asset path).

**Tech Stack:** ES module, `node:test`, `scripts/check.mjs`.

**Design:** `docs/plans/2026-07-27-solar-system/design.md` §3, §6 (D6)

**Depends on:** nothing. Pure data; can land before game-platform slices 15/21.

**DONE WHEN:**
- `node --test scripts/solar-data.test.mjs` passes.
- `node scripts/check.mjs` passes, and fails when a fact loses its 中文.
- Moon counts verified against the Minor Planet Center at implementation time (Task 3).
- Nothing in the app changes visibly — no manifest entry yet (that arrives with the game in slice 31).

---

## Constraints you must not violate

1. **Legacy-syntax compatible** — no `?.`, `??`, `.flatMap(`. The Android 8 baseline is retired (design.md D7); this is belt-and-braces so the existing `check.mjs:41-43` scan passes unchanged. This file joins `runtimeFiles` in Task 4.
2. **Bilingual invariant:** every kid-facing string ships EN + 繁體中文 (Taiwan usage). A fact without 中文 is a bug; the check in Task 4 makes it a build failure.
3. **Data only.** No functions beyond trivial derivations. If logic appears here, it belongs in the game module.
4. **Numbers carry "at least" phrasing** where science keeps recounting (moons). Verify, don't guess (Task 3).

---

## File Structure

| File | Change | Responsibility after this slice |
|---|---|---|
| `js/games/solar-data.js` | Create | Sun + 8 planets: names, colours, real numbers, flags, 3 bilingual facts each |
| `scripts/solar-data.test.mjs` | Create | Schema, ordering, and quiz-derivability tests |
| `scripts/check.mjs` | Modify | `runtimeFiles` + solar-data bilingual block |
| `sw.js` | Modify | `APP_SHELL` gains `solar-data.js`; `CACHE_NAME` bumped |

---

## Task 1: Write the failing tests

**Files:**
- Create: `scripts/solar-data.test.mjs`

- [ ] **Step 1: Create the test file**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { SOLAR, PLANETS } from "../js/games/solar-data.js";

test("sun and exactly eight planets, ordered by distance", () => {
  assert.ok(SOLAR.name && SOLAR.tz);
  assert.equal(PLANETS.length, 8);
  for (let i = 1; i < PLANETS.length; i++) {
    assert.ok(PLANETS[i].au > PLANETS[i - 1].au, `${PLANETS[i].id} out of order`);
  }
  assert.equal(PLANETS[0].id, "mercury");
  assert.equal(PLANETS[7].id, "neptune");
});

test("every planet has a complete bilingual schema", () => {
  const seen = new Set();
  for (const p of PLANETS) {
    assert.ok(p.id && !seen.has(p.id)); seen.add(p.id);
    assert.ok(p.name, `${p.id}: missing English name`);
    assert.ok(p.tz, `${p.id}: missing 中文 name`);
    assert.equal(typeof p.color, "number");
    for (const k of ["diameterKm", "au", "yearDays", "dayHours", "moons"]) {
      assert.equal(typeof p[k], "number", `${p.id}: ${k} must be a number`);
    }
    assert.ok(Array.isArray(p.facts) && p.facts.length === 3, `${p.id}: exactly 3 facts`);
    for (const f of p.facts) {
      assert.ok(f.en && f.tz, `${p.id}: fact must be bilingual`);
    }
    // D8 card fields
    assert.ok(p.type && p.type.en && p.type.tz, `${p.id}: type must be bilingual`);
    assert.ok(p.desc && p.desc.en && p.desc.tz, `${p.id}: desc must be bilingual`);
    assert.match(p.photo, /^assets\/solar\/[a-z]+\.jpg$/, `${p.id}: photo must be a vendored asset path`);
  }
});

test("quiz superlatives are computable and unique", () => {
  const byMax = (k) => PLANETS.reduce((a, b) => (b[k] > a[k] ? b : a));
  const byMin = (k) => PLANETS.reduce((a, b) => (b[k] < a[k] ? b : a));
  assert.equal(byMax("diameterKm").id, "jupiter");
  assert.equal(byMin("au").id, "mercury");
  assert.equal(byMax("au").id, "neptune");
  assert.equal(byMax("moons").id, "saturn");
  for (const flag of ["biggest", "hottest", "coldest", "mostMoons", "red", "rings"]) {
    const holders = PLANETS.filter((p) => p.flags && p.flags[flag]);
    assert.equal(holders.length, 1, `flag ${flag} must name exactly one planet`);
  }
  assert.equal(PLANETS.find((p) => p.flags.red).id, "mars");
});

test("anchor facts stay true (guard against well-meaning edits)", () => {
  const earth = PLANETS.find((p) => p.id === "earth");
  assert.equal(earth.moons, 1);
  assert.equal(earth.yearDays, 365);
  assert.equal(PLANETS.find((p) => p.id === "mercury").moons, 0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test scripts/solar-data.test.mjs`
Expected: FAIL — `Cannot find module '../js/games/solar-data.js'`

---

## Task 2: Implement `js/games/solar-data.js`

- [ ] **Step 1: Create the data module**

The schema, then the full dataset below — facts may be reworded for the kids' reading level, but the structured numbers may not change without fixing Task 1's anchor test:

```js
/* Solar System data (design.md §3). Data only — no DOM, no Three.js.
   Structured fields (diameterKm, au, yearDays, moons, flags) are the single
   source of truth for fact cards AND computed quiz questions. */

export const SOLAR = {
  name: "Sun", tz: "太陽", color: 0xfdb813, diameterKm: 1392700,
  type: { en: "STAR", tz: "恆星" },
  desc: { en: "The Sun is the giant star at the centre of our solar system. Its gravity holds all eight planets, and its light gives Earth warmth and energy.",
          tz: "太陽是位於太陽系中心的巨大恆星。它的引力抓住八顆行星,它的光帶給地球溫暖與能量。" },
  photo: "assets/solar/sun.jpg",
  facts: [
    { en: "The Sun is a star — a giant ball of hot gas.", tz: "太陽是一顆恆星,一個巨大的熱氣球。" },
    { en: "Eight planets travel around the Sun.", tz: "有八顆行星繞著太陽轉。" },
    { en: "The Sun is so big that one million Earths could fit inside!", tz: "太陽非常大,可以裝下一百萬個地球!" },
  ],
};

export const PLANETS = [
  { id: "mercury", name: "Mercury", tz: "水星", color: 0x9c8e84,
    diameterKm: 4879, au: 0.39, yearDays: 88, dayHours: 1416, moons: 0,
    flags: {},
    type: { en: "TERRESTRIAL PLANET", tz: "類地行星" },
    desc: { en: "Mercury is a small rocky world that sprints around the Sun. With almost no air, its days are scorching and its nights are freezing.",
            tz: "水星是一顆小小的岩石星球,繞著太陽飛奔。因為幾乎沒有空氣,白天酷熱、夜晚嚴寒。" },
    photo: "assets/solar/mercury.jpg",
    facts: [
      { en: "Mercury is the closest planet to the Sun.", tz: "水星是離太陽最近的行星。" },
      { en: "One year on Mercury is only 88 days!", tz: "水星上的一年只有 88 天!" },
      { en: "Mercury has no moons.", tz: "水星沒有衛星。" },
    ] },
  { id: "venus", name: "Venus", tz: "金星", color: 0xe8cda5,
    diameterKm: 12104, au: 0.72, yearDays: 225, dayHours: 5832, moons: 0,
    flags: { hottest: true },
    facts: [
      { en: "Venus is the hottest planet.", tz: "金星是最熱的行星。" },
      { en: "Venus spins backwards compared to Earth.", tz: "金星的自轉方向和地球相反。" },
      { en: "Venus is the brightest planet in our night sky.", tz: "金星是夜空中最亮的行星。" },
    ] },
  { id: "earth", name: "Earth", tz: "地球", color: 0x4d7dd1,
    diameterKm: 12742, au: 1, yearDays: 365, dayHours: 24, moons: 1,
    flags: {},
    facts: [
      { en: "Earth is our home — the only planet with life.", tz: "地球是我們的家,是唯一有生命的行星。" },
      { en: "Most of Earth is covered by ocean.", tz: "地球表面大部分是海洋。" },
      { en: "Earth has one moon.", tz: "地球有一顆衛星。" },
    ] },
  { id: "mars", name: "Mars", tz: "火星", color: 0xc1440e,
    diameterKm: 6779, au: 1.52, yearDays: 687, dayHours: 24.6, moons: 2,
    flags: { red: true },
    facts: [
      { en: "Mars is called the red planet.", tz: "火星被稱為紅色星球。" },
      { en: "It has the tallest volcano in the solar system.", tz: "它有太陽系最高的火山。" },
      { en: "Mars has two tiny moons.", tz: "火星有兩顆小衛星。" },
    ] },
  { id: "jupiter", name: "Jupiter", tz: "木星", color: 0xc88b3a,
    diameterKm: 139820, au: 5.2, yearDays: 4333, dayHours: 10, moons: 95,
    flags: { biggest: true },
    facts: [
      { en: "Jupiter is the biggest planet.", tz: "木星是最大的行星。" },
      { en: "Its Great Red Spot is a storm bigger than Earth!", tz: "它的大紅斑是一場比地球還大的風暴!" },
      { en: "Jupiter has at least 95 moons.", tz: "木星至少有 95 顆衛星。" },
    ] },
  { id: "saturn", name: "Saturn", tz: "土星", color: 0xead6b8,
    diameterKm: 116460, au: 9.54, yearDays: 10759, dayHours: 10.7, moons: 274,
    flags: { mostMoons: true, rings: true },
    facts: [
      { en: "Saturn's rings are made of ice and rock.", tz: "土星環是由冰和岩石組成的。" },
      { en: "Saturn is so light it could float on water!", tz: "土星非常輕,輕到可以浮在水上!" },
      { en: "Saturn has the most moons — at least 274!", tz: "土星的衛星最多,至少有 274 顆!" },
    ] },
  { id: "uranus", name: "Uranus", tz: "天王星", color: 0x9fe3e0,
    diameterKm: 50724, au: 19.2, yearDays: 30687, dayHours: 17, moons: 29,
    flags: { coldest: true },
    facts: [
      { en: "Uranus spins on its side like a rolling ball.", tz: "天王星像滾動的球一樣側躺著自轉。" },
      { en: "It is the coldest planet.", tz: "它是最冷的行星。" },
      { en: "It looks blue-green because of its gas.", tz: "因為氣體的關係,它看起來是藍綠色的。" },
    ] },
  { id: "neptune", name: "Neptune", tz: "海王星", color: 0x3457d5,
    diameterKm: 49244, au: 30.1, yearDays: 60190, dayHours: 16, moons: 16,
    flags: {},
    facts: [
      { en: "Neptune is the farthest planet from the Sun.", tz: "海王星是離太陽最遠的行星。" },
      { en: "It has the fastest winds in the solar system.", tz: "它有太陽系最快的風。" },
      { en: "One year on Neptune is 165 Earth years!", tz: "海王星上的一年等於地球的 165 年!" },
    ] },
];

/* Visual scale is compressed (design.md D4): these are scene units, not km. */
export const SCENE = {
  sunRadius: 2,
  sizes: { mercury: 0.3, venus: 0.45, earth: 0.5, mars: 0.4, jupiter: 1.2, saturn: 1.0, uranus: 0.8, neptune: 0.75 },
  orbits: { mercury: 4, venus: 5.5, earth: 7, mars: 8.5, jupiter: 11, saturn: 14, uranus: 17, neptune: 20 },
};

export default { SOLAR, PLANETS, SCENE };
```

**The D8 fields for the remaining bodies:** `type` is `TERRESTRIAL PLANET 類地行星` (venus, earth, mars), `GAS GIANT 氣態巨行星` (jupiter, saturn), `ICE GIANT 冰巨行星` (uranus, neptune); `photo` is `assets/solar/<id>.jpg`. The `desc` texts are authored and locked in `design-preview.html`'s data block (fields `descEn`/`descTz`) — copy them **verbatim** into `desc.en`/`desc.tz`; do not rephrase. Classifications: terrestrial ×4, gas giant ×2, ice giant ×2, star ×1.

- [ ] **Step 2: Run to verify pass**

Run: `node --test scripts/solar-data.test.mjs`
Expected: PASS — 4 tests green.

---

## Task 3: Verify the science

- [ ] **Step 1: Check moon counts against the Minor Planet Center**

Open https://minorplanetcenter.net/iau/NaturalSatellites.html (or current MPC/JPL summary) and confirm the counts used above — Jupiter 95, Saturn 274, Uranus 29, Neptune 16 — are each **not higher than** the current confirmed count. The dataset deliberately phrases facts as "at least N", so a count that has since *grown* is still true; a count that was wrong at authoring is not.

- [ ] **Step 2: Spot-check the anchor numbers**

Mercury year 88 days, Neptune year 165 Earth years, Olympus Mons tallest volcano, Venus hottest surface, Uranus coldest atmosphere, Neptune fastest winds. Any correction lands in this slice, not later — slice 33's quiz answers are computed from this file.

---

## Task 4: Wire the checks and the cache

**Files:**
- Modify: `scripts/check.mjs` (`runtimeFiles`, plus new block)
- Modify: `sw.js:1-25`

- [ ] **Step 1: Add to `runtimeFiles`**

Add `"js/games/solar-data.js"` to `runtimeFiles` in `scripts/check.mjs:20`. (D7: the file stays legacy-syntax compatible, so the existing scan passes as-is.)

- [ ] **Step 2: Add the bilingual data block**

Append near the manifest block, using the existing `assertPair` helper:

```js
try {
  const { SOLAR, PLANETS } = await import(new URL("js/games/solar-data.js", root));
  assertPair([SOLAR.name, SOLAR.tz], "solar.sun.name");
  SOLAR.facts.forEach((f, i) => assertPair([f.en, f.tz], `solar.sun.fact${i}`));
  if (PLANETS.length !== 8) fail("solar", `expected 8 planets, got ${PLANETS.length}`);
  const seen = new Set();
  for (const p of PLANETS) {
    if (seen.has(p.id)) fail("solar", `duplicate planet id ${p.id}`);
    seen.add(p.id);
    assertPair([p.name, p.tz], `solar.${p.id}.name`);
    if (p.type) assertPair([p.type.en, p.type.tz], `solar.${p.id}.type`);
    if (p.desc) assertPair([p.desc.en, p.desc.tz], `solar.${p.id}.desc`);
    (p.facts || []).forEach((f, i) => assertPair([f.en, f.tz], `solar.${p.id}.fact${i}`));
    if ((p.facts || []).length !== 3) fail("solar", `${p.id}: exactly 3 facts required`);
  }
} catch (error) {
  fail("solar data load", error.message);
}
```

- [ ] **Step 3: Precache and bump**

Add `"./js/games/solar-data.js"` to `APP_SHELL` and bump `CACHE_NAME`. Offline non-negotiable: the file exists on disk → it is precached in the same commit. (Note: at this point nothing imports `solar-data.js` yet, so the import-graph precache guard in `tech-spec §16.1` does not require it. Once slice 31's `solar.js` statically imports `./solar-data.js`, that import becomes the enforceable proof — forgetting to precache the file fails `check.mjs` automatically.)

- [ ] **Step 4: Prove the guard guards**

Delete the `tz` from one Mars fact, run `node scripts/check.mjs` → expected FAIL naming `solar.mars.fact…`. Restore, re-run → PASS.

- [ ] **Step 5: Commit**

```bash
git add js/games/solar-data.js scripts/solar-data.test.mjs scripts/check.mjs sw.js
git commit -m "feat(games): add bilingual solar-system data with validation"
```

---

## DONE WHEN

- 4 tests in `scripts/solar-data.test.mjs` green; `node scripts/check.mjs` green.
- The check fails when any fact or name loses its 中文 (proven, not assumed).
- Moon counts verified against MPC (Task 3) and phrased "at least N".
- `sw.js` precaches the file; `CACHE_NAME` bumped.
- Legacy-syntax compatible per D7. No DOM, no Three.js imports in the data file.
