# Slice 40 — Finger-drumming trainer

**Goal:** Melodics-style practice on the pads: notes travel right-to-left across four lanes, the kid hits in time, difficulty climbs, and each new exercise plays the previous one underneath it.

**Architecture:** A **mode inside `js/games/pads.js`**, not a new tile (design.md D1) — same grid, same kit, same pointer handling, with the slice 39 transport driving right-to-left notes above it. Exercises are plain data in `js/games/pad-charts.js`, in the spirit of `solar-data.js`: no logic, node-testable, bilingual.

**The layers trick (design.md D9):** each exercise's backing loop **is the previous exercise's pattern**. Papa asked for accumulating layers; authoring separate stems would be real work, and this way the kid literally hears what they already mastered playing under what they are learning. One field, `backing: <id of previous exercise>`, buys the whole feature.

**Design:** `docs/plans/2026-07-28-music-room/design.md` §1 (D8, D9, D11, D12, D13), §4.

**Depends on:** slices 37 (the grid), 38 (calibration), 39 (transport + judge).

**DONE WHEN:**
- Six exercises across three tiers, playable start to finish.
- Every exercise title, tier name and feedback word ships EN + 繁體中文.
- Backing layers accumulate up the ladder.
- Score reaches the stars ledger via one `ctx.finish({score})` call at exercise end.
- A kid who has never calibrated can still play (fallback offset), and is *offered* calibration once.
- `node --test scripts/pad-charts.test.mjs` passes.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **Four lanes in v1** (design.md D8). Sixteen columns is unreadable and is not what Melodics does either. A later six-lane expert tier is allowed only as its own follow-up slice with a fresh layout proof.
2. **Coach, not cop.** A miss is "almost! 差一點！", never a red X, never a fail screen, never a life lost. Project non-negotiable. The exercise always finishes.
3. **Scoring through `ctx.finish({score})`.** Never write `progress[kid]`, never call `saveProgress()`. Stars are a ledger, and `bestKey: "pads"` represents trainer progress only; free play still never scores.
4. **Charts are data.** No functions in `pad-charts.js`. If it computes, it belongs in `pads.js`.
5. **Calibration is offered, never required.**
6. **Reuse slice 39's judge.** Do not write a second timing comparison in this file — one judge, one set of windows.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/games/pad-charts.js` | Create | 6 exercises: bilingual titles, tiers, notes, `backing` links |
| `js/games/pads.js` | Modify | Trainer mode: lane UI, transport wiring, scoring, results |
| `scripts/pad-charts.test.mjs` | Create | Schema, bilingual completeness, beat bounds, backing chain |
| `sw.js` | Modify | `APP_SHELL` += `pad-charts.js`, `CACHE_NAME` bump |

---

## Task 1: Chart data + tests

**Files:** Create `js/games/pad-charts.js`, `scripts/pad-charts.test.mjs`

```js
{ id: "steady-kick", tier: 1, bpm: 70, bars: 4, backing: null,
  name: { en: "Steady Kick", tz: "穩定大鼓" },
  lanes: ["kick", "snare", "hat", "clap"],
  notes: [ {beat:0, lane:0}, {beat:2, lane:0}, … ] }
```

- [ ] **Step 1: Tests first** — every exercise has both languages; `beat < bars * 4`; `lane < lanes.length`; ids unique; `backing` names a real earlier exercise or `null`; the backing chain has no cycle; bpm rises monotonically within a tier.

- [ ] **Step 2: Six exercises, gently ramped.**

| # | Tier | Idea | bpm |
|---|---|---|---|
| 1 | 1 | kick on 1 and 3 | 70 |
| 2 | 1 | + snare on 2 and 4 — the backbeat | 70 |
| 3 | 2 | + eighth hats | 80 |
| 4 | 2 | off-beat clap | 85 |
| 5 | 3 | sixteenth hat run | 90 |
| 6 | 3 | two-hand pattern across four pads | 95 |

- [ ] **Step 3: Wire `backing`** — #2 backs on #1, #3 on #2, and so on. Tier 1 exercise 1 has no backing; it is the kid alone with a metronome, which is the right way to start.

- [ ] **Step 4: Bilingual names** in Taiwan usage.

- [ ] **Step 5: V1 lane proof.** Every starter exercise uses exactly four lanes. If a chart wants more, it waits for the later six-lane slice.

---

## Task 2: Trainer mode in `pads.js`

- [ ] **Step 1: Mode switch.** Free play stays the default; a bilingual "Practice 練習" button opens the exercise list. Same game module, same kit, no reload.

- [ ] **Step 2: Note track above, pad grid below — notes travel right → left** (Papa, 2026-07-28). Four **horizontal** lanes stacked in a full-width track, a fixed vertical hit line at ~18% from the left, notes as `translateX` rectangles. Right-to-left is how a groove is written and read, and it keeps the kid's eyes and hands in the same place: the pads sit directly under the track, so nothing forces a look-away mid-bar.

- [ ] **Step 2a: Colour-match lane to pad.** With horizontal lanes there is no column alignment to lean on, so each lane carries a colour and its target pad wears the same colour as a stripe. That stripe *is* the mapping — it has to be unmistakable at a glance or the layout fails.

- [ ] **Step 2b: Full width, no scrolling.** The whole instrument fits one tablet screen in landscape: track on top, 4×4 grid beneath, nothing clipped and nothing scrollable. A kid mid-exercise must never be able to scroll part of the instrument off-screen.

- [ ] **Step 3: Wire the transport.** `createTransport({clock, playNote, sched})` where `playNote` fires the **backing** layer only. The kid's lane notes are *not* auto-played — the kid plays those. Getting this backwards produces a player piano and no practice.

- [ ] **Step 4: Judging.** `pointerdown` on a pad → `judge(clock.now, nearestUnjudgedInLane, offset())`. Show the bilingual word in a polite `aria-live` region, light the hit line, add to the tally.

- [ ] **Step 5: Count-in.** Four clicks before every exercise, always. Starting cold on beat one is unfair and every rhythm game does this.

- [ ] **Step 6: Results.** Perfect/good/ok/miss tally, one warm bilingual line, and one `ctx.finish({ score })`. Score formula: `perfect * 100 + good * 70 + ok * 40`; misses add 0. A replay can improve `bestKey: "pads"` through the host's normal best-score path, but the slice does not create stars by hand and does not gate tiers.

- [ ] **Step 7: First-run calibration offer** — once, with a bilingual "let's check your tablet 檢查一下平板" and a skip that works.

---

## Task 3: Verify

- [ ] **Step 1:** `node --test scripts/pad-charts.test.mjs`, `node scripts/check.mjs` — green.
- [ ] **Step 2:** `APP_SHELL` += `pad-charts.js`, bump `CACHE_NAME`.
- [ ] **Step 3: On the tablet** — all six exercises end to end; backing audible and in time; score lands in the ledger through the normal host finish flow; a deliberately awful run still finishes warmly with no red anywhere.
- [ ] **Step 4: Viewport proof** — intended landscape tablet viewport shows track, hit line, and 4×4 pad grid with no page scroll or clipped primary controls; portrait shows the rotate prompt.

---

## Notes for the implementer

Resist adding a streak counter, a combo multiplier, stars-per-exercise, or an unlock gate between tiers. All six exercises are open from the start; a kid who wants #6 on day one should get to try it and find out. Gating is the thing that turns practice into homework.

If the ramp between tier 1 and tier 2 feels steep with real kids, add an exercise — do not add a difficulty setting. One more row of data beats a mode switch.
