# Slice 33 — Quiz missions (stars)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quiz missions that make the knowledge stick — "Tap 火星 / Mars", "Which planet is the biggest?" — answered by tapping planets **in the 3D scene**, with stars flowing through the existing ledger.

**Architecture:** Question generation and grading live in a new pure module `js/games/solar-quiz.js` (no Three.js — node-testable). Questions are **computed from `solar-data.js`** (design D6): name-identification from `name`/`tz`, superlatives from `flags` plus computed `au`/`diameterKm` extrema. Hand-writing a question is forbidden — a fact and its answer can never drift apart. The scene's existing raycast (slice 31) is the answer mechanism; the quiz UI is DOM overlay. Entering Quiz mode **forces unfocus and hides the info card** (D8 — a tap during quiz is an answer, never a focus request; tech-spec §12).

**Tech Stack:** ES modules, `node:test`, `scripts/check.mjs`.

**Design:** `docs/plans/2026-07-27-solar-system/design.md` §4, D5, D6

**Depends on:** slice 31 (scene + raycast + fact cards); slice 30 (data). Slice 32 is *not* required — quiz mode freezes the sim clock while running.

**DONE WHEN:**
- A full 8-question mission plays offline on the tablet: spoken bilingual prompts, tap-to-answer, gentle retry, end card.
- Stars land in `stars_ledger` via `ctx.finish({score, stars})` and sync; **nothing** writes `game_stats` (`bestKey: null`, D5).
- `node --test scripts/solar-quiz.test.mjs` and `node scripts/check.mjs` green.

---

## Constraints you must not violate

1. **Coach, not cop** (project non-negotiable): a wrong tap gets "Try again! 再試一次!" + `ctx.sfx.bad`, and the mission moves on only when the kid gets it right. No strike counter, no red, no timer, no shame. First-try correct answers are what earn stars — retries are free and unrecorded.
2. **Bilingual invariant:** every prompt and the end card EN + 繁體中文, spoken via `ctx.sayPair(en, tz)`.
3. **Stars are a ledger:** the only write is `ctx.finish({score, stars})` at mission end. `score` = first-try-correct count (0–8); `stars` = same count, 1 star each.
4. **Legacy-syntax compatible** (design D7); new file joins `runtimeFiles`.
5. **Offline-first:** new file joins `APP_SHELL` + `CACHE_NAME` bump in the same commit.

---

## File Structure

| File | Change | Responsibility after this slice |
|---|---|---|
| `js/games/solar-quiz.js` | Create | Pure quiz engine: `buildMission`, `grade` |
| `js/games/solar.js` | Modify | Quiz mode in the mode bar, question banner, star feedback, end card, `ctx.finish` |
| `scripts/solar-quiz.test.mjs` | Create | Node tests: generation shape, no repeats, grading, superlative correctness |
| `sw.js` | Modify | `APP_SHELL` gains `solar-quiz.js`; `CACHE_NAME` bumped |
| `scripts/check.mjs` | Modify | `runtimeFiles` gains `js/games/solar-quiz.js` |

---

## Task 1: The quiz engine, test-first

**Files:**
- Create: `scripts/solar-quiz.test.mjs`
- Create: `js/games/solar-quiz.js`

- [ ] **Step 1: Write the failing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildMission, grade } from "../js/games/solar-quiz.js";
import { PLANETS } from "../js/games/solar-data.js";

// deterministic rng for tests
const seq = (arr) => { let i = 0; return () => arr[i++ % arr.length]; };

test("a mission is 8 questions, no repeated target", () => {
  const m = buildMission(PLANETS, seq([0.1, 0.5, 0.9]));
  assert.equal(m.length, 8);
  const targets = m.map((q) => q.targetId);
  assert.equal(new Set(targets).size, 8);
});

test("every question is bilingual and names a real planet", () => {
  const m = buildMission(PLANETS, Math.random);
  const ids = new Set(PLANETS.map((p) => p.id));
  for (const q of m) {
    assert.ok(q.promptEn && q.promptTz, "prompt must be bilingual");
    assert.ok(ids.has(q.targetId));
    assert.ok(q.kind === "name" || q.kind === "superlative");
  }
});

test("superlative answers agree with the data", () => {
  const m = buildMission(PLANETS, seq([0.3, 0.7]));
  for (const q of m) {
    if (!q.superlative) continue;
    const p = PLANETS.find((x) => x.id === q.targetId);
    if (q.superlative === "closest") assert.equal(p.id, "mercury");
    if (q.superlative === "biggest") assert.equal(p.id, "jupiter");
    if (q.superlative === "mostMoons") assert.equal(p.id, "saturn");
  }
});

test("grade: first-try correct scores; retries are free", () => {
  const q = { kind: "name", targetId: "mars", promptEn: "Tap Mars", promptTz: "點火星" };
  assert.deepEqual(grade(q, "venus", 0), { correct: false, star: false });
  assert.deepEqual(grade(q, "mars", 1), { correct: true, star: false });  // retry: right, no star
  assert.deepEqual(grade(q, "mars", 0), { correct: true, star: true });   // first try: star
});
```

Run — expected FAIL (module missing).

- [ ] **Step 2: Implement `js/games/solar-quiz.js`**

```js
/* Solar quiz engine (design.md §4, D6). Pure: no DOM, no Three.js.
   Questions are computed from solar-data — never hand-written. */

const SUPERLATIVES = [
  { key: "biggest",   en: "Which planet is the biggest?",            tz: "哪一顆行星最大?",     test: (ps) => byMax(ps, "diameterKm") },
  { key: "closest",   en: "Which planet is closest to the Sun?",     tz: "哪一顆行星離太陽最近?", test: (ps) => byMin(ps, "au") },
  { key: "farthest",  en: "Which planet is farthest from the Sun?",  tz: "哪一顆行星離太陽最遠?", test: (ps) => byMax(ps, "au") },
  { key: "mostMoons", en: "Which planet has the most moons?",        tz: "哪一顆行星的衛星最多?", test: (ps) => byMax(ps, "moons") },
  { key: "hottest",   en: "Which planet is the hottest?",            tz: "哪一顆行星最熱?",      test: (ps) => byFlag(ps, "hottest") },
  { key: "coldest",   en: "Which planet is the coldest?",            tz: "哪一顆行星最冷?",      test: (ps) => byFlag(ps, "coldest") },
  { key: "red",       en: "Tap the red planet!",                     tz: "點紅色的星球!",        test: (ps) => byFlag(ps, "red") },
];

/* buildMission(planets, rng) → 8 questions, unique targets, mixed kinds.
   name:        "Tap 火星 / Mars"            (target drawn from rng)
   superlative: prompt from SUPERLATIVES     (target computed by its test fn) */
export function buildMission(planets, rng) { /* ... */ }

/* grade(question, tappedId, attempts) → { correct, star }
   star only when correct on the FIRST attempt. */
export function grade(question, tappedId, attempts) { /* ... */ }
```

Run the tests — expected PASS.

---

## Task 2: Quiz mode in the game

**Files:**
- Modify: `js/games/solar.js`

- [ ] **Step 1: Mode bar entry and the question banner**

Add **Quiz 測驗** to the mode bar (slice 32's bar; if 32 hasn't shipped, create the bar here with Explore | Quiz). Entering Quiz freezes the sim clock and shows a top banner: round counter `3 / 8`, the prompt EN + 中文 large, and a 🔊 replay button (≥ 44 px). Each prompt is spoken on arrival via `ctx.sayPair`.

- [ ] **Step 2: Tap-to-answer through the existing raycast**

Reuse slice 31's hit-spheres. Correct: `ctx.sfx.good`, a star burst on the planet (`ctx.fx.burst` if the host exposes it), next question. Wrong: `ctx.sfx.bad` + banner flashes "Try again! 再試一次!" — same question stays, attempts increment, nothing else is recorded.

- [ ] **Step 3: End card and the ledger**

After round 8, a DOM end card: stars earned `★ 6 / 8`, bilingual well-done line, and two big buttons — **Again 再一次** (new mission) and **Explore 探索**. Exactly once per mission: `ctx.finish({ score: stars, stars: stars })`. `ctx.sfx.win` on the card.

- [ ] **Step 4: Prove the ledger path**

With devtools on the `game_stats` / `stars_ledger` traffic (or the local fallback store): finish a mission → one `stars_ledger` delta of the earned count appears, reason tagged `solar-quiz`; **zero** writes to `game_stats`. Sync on, then off — additive both ways.

---

## Task 3: Cache, check, tablet

- [ ] **Step 1:** `APP_SHELL` gains `"./js/games/solar-quiz.js"`; `CACHE_NAME` bumped; `runtimeFiles` gains the file.
- [ ] **Step 2:** `node scripts/check.mjs` and `node --test scripts/solar-quiz.test.mjs` → PASS.
- [ ] **Step 3: On the tablet (wifi off):** full mission end-to-end — spoken bilingual prompts, wrong tap coaches and lets the kid retry, stars burst on first-try corrects, end card shows the right count, Again deals a *different* 8. Close the game mid-mission: teardown clean, no stars written (finish never fired).
- [ ] **Step 4: Commit**

```bash
git add js/games/solar-quiz.js js/games/solar.js scripts/solar-quiz.test.mjs sw.js scripts/check.mjs
git commit -m "feat(games): add solar quiz missions with ledger stars"
```

---

## DONE WHEN

- 8-question missions play offline end-to-end on the tablet; no repeated targets; prompts spoken EN + 中文.
- Stars arrive as exactly one `stars_ledger` delta per mission; `game_stats` untouched (proven in Task 2 Step 4).
- Wrong answers coach, never punish; retries are unlimited and unrecorded.
- Quiz engine is pure and node-tested; every question computed from `solar-data.js`.
- Green check, green tests, bumped cache; legacy-syntax compatible.
