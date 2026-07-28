# Slice 39 — Transport + note-drop runtime

**Goal:** The engine: a musically accurate clock, right-to-left note positions derived from it, and a judge — all testable headless, before a single exercise exists.

**Architecture:** Added to `js/game-services/music.js` alongside calibration. Two clocks, strictly separated (design.md §3.1): a **lookahead loop** on `sched.every(25, …)` schedules audio at exact `currentTime` offsets; a **paint loop** on `sched.frame(…)` positions notes from the audio clock. Painting never triggers sound and sound never waits on a frame. Both live inside the caller's `createScheduler()`, so a game's `stop()` is one `cancelAll()`.

This is the "40 lines instead of 200KB of Tone.js" slice (design.md D4). Keep it that size.

**Design:** `docs/plans/2026-07-28-music-room/design.md` §1 (D4, D8, D12), §3.1.

**Depends on:** slices 35 (playback + clock) and 38 (`offset()` and the `music.js` file).

**DONE WHEN:**
- `node --test scripts/music-transport.test.mjs` passes against a fake clock.
- A two-bar test chart scrolls **locked** to the metronome — no visible drift over 60 seconds.
- Every note is scheduled exactly once, in order, even across a pause/resume and a tab background.
- Judge boundaries are exact and calibration-shifted.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **No `setTimeout` for musical events.** Ever. `setTimeout` drift is tens of milliseconds and cumulative; it is the single most common way browser rhythm games are got wrong. The lookahead loop is `setInterval`-driven but only *decides*; the `AudioContext` does the actual timing.
2. **The audio clock is the only clock.** Note positions, judging and scheduling all read `audio.clock().now`. `performance.now()` appears nowhere in this file.
3. **Schedule ahead, exactly once.** Keep a cursor into the note array. A note scheduled twice is an audible flam; a note scheduled late is a miss the kid did not earn.
4. **Judge after the offset.** Every `dt` is `tapTime - noteTime - offset()`. A judge that forgets the offset is the bug slice 38 exists to prevent.
5. **Pause must not lose the cursor.** Backgrounding a tab suspends the context; on resume, re-anchor rather than dumping every missed note at once.
6. **The runtime is direction-agnostic except `positionOf()`.** Timing and judging operate on beats and lanes. Right-to-left is a rendering decision from D12; do not bake "falling" or vertical columns into the data model.
7. **No music content here.** No BPMs, no patterns, no kits. This slice ships an engine and a two-bar throwaway fixture. Content is slice 40.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/game-services/music.js` | Modify | + `createTransport()`, `judge()`, chart helpers |
| `scripts/music-transport.test.mjs` | Create | Fake-clock scheduling and judging tests |

---

## Task 1: Write the failing tests

**Files:** Create `scripts/music-transport.test.mjs`

The transport takes its clock and its "play a sound" function as injected dependencies, so node can drive it with a fake clock and a recording spy. Design it that way from the first line — it is what makes this slice testable at all.

- [ ] **Step 1: Every note fires once.** Advance a fake clock through a 2-bar chart in 25ms steps; assert the spy saw each note exactly once, in beat order.
- [ ] **Step 2: Scheduled ahead, not late.** Assert each note was handed to the audio layer *before* its play time, within the lookahead window.
- [ ] **Step 3: Big clock jump** (a backgrounded tab) does not fire a burst of stale notes.
- [ ] **Step 4: Beat→time math** is exact at 60, 100 and 137bpm — no accumulated float error by bar 32.
- [ ] **Step 5: Judge boundaries** — with `offset = 0`: 49ms ⇒ perfect, 51ms ⇒ good, 99ms ⇒ good, 101ms ⇒ ok, 179ms ⇒ ok, 181ms ⇒ miss. Symmetric for early and late.
- [ ] **Step 6: Judge honours the offset** — a tap 80ms late with an 80ms offset is *perfect*.
- [ ] **Step 7: One note, one judgement.** A second tap on an already-judged note does not double-score.

---

## Task 2: The transport

**Files:** Modify `js/game-services/music.js`

- [ ] **Step 1: `createTransport({clock, playNote, sched})`** — dependencies injected, no ambient reads.

- [ ] **Step 2: `start(chart)`** — anchor `startTime = clock.now + 0.15` (a short lead so the first note is never already late), reset the cursor, arm the lookahead via `sched.every(25, tick)`.

- [ ] **Step 3: `tick()`** — while `noteTime(cursor) < clock.now + 0.10`, call `playNote(note, absoluteTime)` and advance the cursor. Absolute times, never delays — slice 35's `playSample` takes `when` as an absolute `currentTime` for exactly this.

- [ ] **Step 4: `beatToTime(beat)`** = `startTime + beat * 60 / bpm`. Compute from the beat index every time; never accumulate by adding a per-beat delta, which drifts.

- [ ] **Step 5: `positionOf(note)`** for painting — `(beatToTime(note.beat) - clock.now) * pxPerSecond`, a **horizontal** offset from the hit line. Notes travel **right → left** (Papa, 2026-07-28): lanes are horizontal rows, the hit line is a fixed vertical bar near the left edge, and a note's distance from it is time. The paint loop calls this and does nothing else clever.

- [ ] **Step 6: Pause/resume.** `sched.pause()` already freezes the loops; on resume, re-anchor `startTime` by the elapsed gap so the chart continues from where it stopped rather than teleporting.

- [ ] **Step 7: `stop()`** — cancel, clear cursor, drop pending voices.

---

## Task 3: The judge

- [ ] **Step 1: `judge(tapTime, note, offsetMs)`** — pure and exported. Returns `"perfect" | "good" | "ok" | "miss"` from `|tapTime - beatToTime(note.beat) - offset|` against 50 / 100 / 180ms.

- [ ] **Step 2: Nearest unjudged note in the lane.** A tap judges against the closest *unjudged* note in *its own lane*, and marks it judged. Wrong-lane taps are their own feedback, not a steal from a neighbouring lane.

- [ ] **Step 3: Auto-miss.** A note whose window has fully passed is marked missed by the paint loop, so the chart moves on without a tap.

---

## Task 4: Prove it against a metronome

- [ ] **Step 1:** `node --test scripts/music-transport.test.mjs` — green.
- [ ] **Step 2:** `node scripts/check.mjs` — green.
- [ ] **Step 3: The drift test, on the tablet.** A two-bar fixture with a click on every beat, run for 60 seconds, watching the right-to-left notes against the click. Any visible separation by the end means the paint loop is using its own clock somewhere. This is the check that catches the classic mistake, and it takes one minute.

---

## Notes for the implementer

25ms interval, 100ms lookahead. Do not tune these before there is a problem — they are the long-standing defaults for this pattern and they work. If notes stutter on the tablet, the cause is almost never the window; it is a paint loop doing layout work per frame.

Position notes with `transform: translateX()`, not `left`. `left` triggers layout on every frame for every note and will visibly stutter with sixteen notes on screen.
