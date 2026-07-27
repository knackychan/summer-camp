# Slice 32 — Orbit simulation (time-warp)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the orbiting planets into the lesson: a pause/play + time-warp control and a live counter that lets a kid *watch* Mercury lap Neptune — inner planets finish years fast, outer ones barely move.

**Architecture:** Sim math lives in a new pure module `js/games/solar-sim.js` (no Three.js import — node-testable, same discipline as `solar-data.js`). `solar.js` imports it and drives the DOM controls. Sim days accumulate from wall-clock `dt × daysPerSec`; each planet's angle is a pure function of total sim-days and its real `yearDays` (design D4: ratios are real, visuals compressed).

**Tech Stack:** ES modules, `node:test`, `scripts/check.mjs`.

**Design:** `docs/plans/2026-07-27-solar-system/design.md` §4, §5

**Depends on:** slice 31 (Explore mode running).

**DONE WHEN:**
- Slider warps time through the five speeds; pause freezes everything.
- The counter after exactly 365 sim-days reads Earth 1 year, Mercury ≈4 years, Neptune 0.
- The default speed persists across relaunch via `ctx.settings`.
- `node --test scripts/solar-sim.test.mjs` and `node scripts/check.mjs` green; offline play unaffected.

---

## Constraints you must not violate

1. **Legacy-syntax compatible** (design D7) in `solar-sim.js` and the `solar.js` additions; both are in `runtimeFiles`.
2. **Bilingual invariant:** every control label and the counter EN + 繁體中文.
3. **Real ratios only.** No per-planet fudge factors — the counter must agree with `yearDays` from `solar-data.js`, because the counter IS the teaching moment.
4. **Coarse-pointer:** the speed control is big buttons or a fat slider, not a desktop-grade range input.
5. **Offline-first:** new file joins `APP_SHELL` + `CACHE_NAME` bump in the same commit.

---

## File Structure

| File | Change | Responsibility after this slice |
|---|---|---|
| `js/games/solar-sim.js` | Create | Pure sim math: speed steps, accumulated sim-days, orbit counts |
| `js/games/solar.js` | Modify | Mode bar (Explore / Orbit 軌道), time-warp controls, day/year counter, `settings(bar, ctx)` |
| `scripts/solar-sim.test.mjs` | Create | Node tests for the sim math |
| `sw.js` | Modify | `APP_SHELL` gains `solar-sim.js`; `CACHE_NAME` bumped |
| `scripts/check.mjs` | Modify | `runtimeFiles` gains `js/games/solar-sim.js` |

---

## Task 1: The sim module, test-first

**Files:**
- Create: `scripts/solar-sim.test.mjs`
- Create: `js/games/solar-sim.js`

- [ ] **Step 1: Write the failing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { SPEEDS, daysPerSec, advance, orbitCount } from "../js/games/solar-sim.js";

test("five speed steps, pause is zero", () => {
  assert.equal(SPEEDS.length, 5);
  assert.equal(daysPerSec("pause"), 0);
  assert.equal(daysPerSec("day"), 1);
  assert.equal(daysPerSec("year"), 365);
  assert.equal(daysPerSec("nope"), 10); // unknown id falls back to the default
});

test("advance accumulates sim-days from wall-clock dt", () => {
  assert.equal(advance(100, 2000, 10), 120);   // 2 s at 10 days/s
  assert.equal(advance(100, 2000, 0), 100);    // paused
});

test("orbitCount honours real year ratios", () => {
  assert.equal(orbitCount(365, 365), 1);                    // Earth: exactly 1
  assert.ok(Math.abs(orbitCount(365, 88) - 4.15) < 0.01);   // Mercury laps ~4×
  assert.equal(orbitCount(365, 60190), 0);                  // Neptune: floor is 0
});

test("angle is derived, never stored", () => {
  const { angle } = orbitCount(182.5, 365);
  assert.ok(Math.abs(angle - Math.PI) < 0.01); // half a year = half a turn
});
```

Run: `node --test scripts/solar-sim.test.mjs` — expected FAIL (module missing).

- [ ] **Step 2: Implement `js/games/solar-sim.js`**

```js
/* Orbit simulation math (design.md §4). Pure: no DOM, no Three.js.
   Angles and counters are always derived from total sim-days — nothing
   integrates frame-to-frame drift into planet positions. */

export const SPEEDS = [
  { id: "pause", en: "Pause",  tz: "暫停",   daysPerSec: 0 },
  { id: "day",   en: "1 day",  tz: "1 天",   daysPerSec: 1 },
  { id: "10day", en: "10 days",tz: "10 天",  daysPerSec: 10 },
  { id: "month", en: "1 month",tz: "1 個月", daysPerSec: 30 },
  { id: "year",  en: "1 year", tz: "1 年",   daysPerSec: 365 },
];

export function daysPerSec(id) { /* find by id, default the "10day" step */ }
export function advance(totalDays, dtMs, perSec) { return totalDays + (dtMs / 1000) * perSec; }
export function orbitCount(totalDays, yearDays) {
  /* returns { count: floor, angle: fraction * 2π } — count is whole completed orbits */
}
```

Run the tests — expected PASS.

---

## Task 2: Wire the controls into the game

**Files:**
- Modify: `js/games/solar.js`

- [ ] **Step 1: Mode bar and time-warp UI (DOM overlay)**

A mode bar at the top of the mount: **Explore 探索** | **Orbit 軌道** (Quiz arrives in slice 33). In Orbit mode a bottom control band appears: five large speed buttons from `SPEEDS` (EN + 中文 labels, current one highlighted) and the counter.

- [ ] **Step 2: The counter**

One DOM line, updated each frame the sim advances:

`Day 730 · Mercury 8 · Earth 2 · Jupiter 0 years` / `第 730 天 · 水星 8 年 · 地球 2 年 · 木星 0 年`

Whole completed orbits only (`count` from `orbitCount`); show all eight planets in two rows if space demands. When a planet ticks over a new year, `ctx.sfx.pop` — that *ding* is the lap moment.

- [ ] **Step 3: Drive angles from the sim**

Replace slice 31's fixed-speed angle update with `angleAt(planet, totalSimDays)` — i.e. `orbitCount(totalDays, yearDays).angle`. Sim state (`totalDays`, current speed id) lives in the module runtime `R`, reset in `stop()`.

- [ ] **Step 4: Persist the default speed**

Add `settings(bar, ctx)` to the module export: a game-settings row (rendered by the host's setbar like every other game) choosing the speed the game starts in; read/write `ctx.settings.speed`. Default `"10day"` when unset — the same fallback the sim uses.

---

## Task 3: Cache, check, tablet

- [ ] **Step 1:** `APP_SHELL` gains `"./js/games/solar-sim.js"`; `CACHE_NAME` bumped; `runtimeFiles` gains the file.
- [ ] **Step 2:** `node scripts/check.mjs` → PASS; `node --test scripts/solar-sim.test.mjs` → PASS.
- [ ] **Step 3: On the tablet (wifi off):** Orbit mode opens; Pause freezes all motion; "1 year" speed visibly crawls Mercury and spins Earth; the counter matches reality at Day 365 (Earth 1, Mercury 4); the 🔔 pop fires on each completed Mercury orbit; chosen default speed survives closing and reopening the game.
- [ ] **Step 4: Commit**

```bash
git add js/games/solar-sim.js js/games/solar.js scripts/solar-sim.test.mjs sw.js scripts/check.mjs
git commit -m "feat(games): add solar orbit simulation with time-warp"
```

---

## DONE WHEN

- All tablet checks pass offline; counter ratios provably match `solar-data.js` (test + tablet).
- Settings row renders through the host like every other game's; default speed persists.
- Sim math is pure and node-tested; angles are derived, never accumulated.
- Green check, green tests, bumped cache; legacy-syntax compatible.
