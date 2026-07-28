# Slice 38 — Latency calibration

**Goal:** Measure how late this specific tablet actually is, once, and store it — so the trainer judges what the kid *played*, not what the hardware *reported*.

**Architecture:** A new shared service `js/game-services/music.js`. This slice creates the file and puts calibration in it; slice 39 adds the transport alongside. Calibration is a per-device local value: it describes hardware, not a kid, so it does **not** sync and is not per-profile.

**Why this is its own slice:** Android touch-to-sound latency ranges 40–300ms depending on device, buffer state and what else is running. That is up to a *demisemiquaver at 120bpm* of error — larger than the "perfect" judge window. Without calibration the trainer feels broken in a way that is undiagnosable from the couch: kids play in time and the app tells them they are late. This lands before slice 39 for that reason.

**Design:** `docs/plans/2026-07-28-music-room/design.md` §1 (D5), §3.3.

**Depends on:** slice 35 (needs `clock()` and audio playback). Independent of 36/37.

**DONE WHEN:**
- Three consecutive runs on the real Android tablet agree within **±15ms**.
- The measured value survives a reload and an app restart.
- A "recalibrate" control re-runs it.
- With no calibration ever run, `offset()` still returns a sane value (the output-latency fallback) and nothing crashes.
- `node --test scripts/music-calibration.test.mjs` passes.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **Two different offsets. Do not conflate them** (design.md §3.3):
   - `outputLatency + baseLatency` — free, from the context; aligns *drawing* with *hearing*.
   - measured round-trip — needs the kid; shifts the *judge window*.
2. **Median, not mean.** One distracted tap ruins a mean. Use the median of the kept samples.
3. **Discard the first two beats.** The kid is still finding the pulse. Everyone's first tap is garbage.
4. **Refuse a bad measurement.** If the spread is wide (kid was not really trying, which will happen), say so kindly, bilingually, and offer to redo — never silently store a number built from noise.
5. **Never blocking.** A kid who skips calibration gets the fallback and a working trainer. Calibration is an offer, not a gate.
6. **Bilingual.** Every word of the calibration UI, EN + 繁體中文.
7. **Coach, not cop.** "Let's try that again 再試一次" — never "failed", never a red X. Project non-negotiable.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/game-services/music.js` | Create | `calibrate()`, `offset()`, `clearCalibration()` |
| `scripts/music-calibration.test.mjs` | Create | Median, outlier rejection, discard-first-two, fallback |
| `sw.js` | Modify | `APP_SHELL` += `music.js`, `CACHE_NAME` bump |

---

## Task 1: Write the failing tests

**Files:** Create `scripts/music-calibration.test.mjs`

The math must be testable without a tablet, so keep it in a **pure exported function** — `computeOffset(taps, beats)` — and test that directly. The UI is a thin shell around it.

- [ ] **Step 1:** `computeOffset` drops the first two pairs.
- [ ] **Step 2:** It returns the median, and one wild outlier does not move the result more than a few ms.
- [ ] **Step 3:** It reports low confidence when the spread exceeds a threshold (suggest: interquartile range > 60ms).
- [ ] **Step 4:** Fewer than 4 usable taps ⇒ no result, not a garbage number.
- [ ] **Step 5:** `offset()` with nothing stored returns the output-latency fallback, not `0` and not `NaN`.

---

## Task 2: The measurement

**Files:** Create `js/game-services/music.js`

- [ ] **Step 1: `computeOffset(taps, beats)`** — pure, exported, no DOM, no storage. Pair each tap to its nearest beat, drop the first two, take the median of the differences, return `{ offsetMs, confident }`.

- [ ] **Step 2: `calibrate(host)`** — runs eight beats at 100bpm through the audio clock (a click via the existing cue path is fine; it does not need to be a sample). Record each tap as `audio.clock().now` at `pointerdown` — **the audio clock, never `Date.now()`**; mixing clocks reintroduces exactly the error being measured. Feed both arrays to `computeOffset`.

- [ ] **Step 3: Store** `{offsetMs, at, confident}` under `sq.music.latency` in `localStorage`. Per device, not per kid, not synced — this measures hardware.

- [ ] **Step 4: `offset()`** — returns the stored `offsetMs` when present and confident; otherwise `clock().outputLatency * 1000`. One number, callers do not branch.

- [ ] **Step 5: `clearCalibration()`** for the recalibrate button.

---

## Task 3: The kid-facing flow

- [ ] **Step 1: Frame it as a game, not a setup wizard.** "Tap along with the beat 跟著節拍點一點" — eight beats, a big target, a visible pulse. It takes six seconds.

- [ ] **Step 2: Show the result warmly.** A tick and "Ready! 準備好了！". Do not show the kid a millisecond number; show Papa one in the settings bar, since he is the one who will debug it.

- [ ] **Step 3: Low confidence ⇒ invite a retry**, bilingually, with no scolding. Store nothing.

- [ ] **Step 4: Entry points** — offered once on first trainer launch, and always available from the settings bar of any music game.

---

## Task 4: Verify

- [ ] **Step 1:** `node --test scripts/music-calibration.test.mjs`, `node scripts/check.mjs` — green.
- [ ] **Step 2:** Add `music.js` to `APP_SHELL`, bump `CACHE_NAME`.
- [ ] **Step 3: On the real tablet, three runs.** Spread over ±15ms means something is wrong upstream — check that taps are timestamped from the audio clock and that `latencyHint: "interactive"` actually took effect in slice 35. Record the measured value in the slice's completion note; it is the number that tells you whether the tablets are usable at all.

---

## Notes for the implementer

If the measured offset comes back above ~250ms, stop and report it before building slice 39. That would mean the tablet cannot do rhythm games in a browser, and the honest answer is to say so rather than ship a trainer that punishes kids for hardware.

Do not add a manual slider "so Papa can fine-tune it". Measure, or fall back. A slider is a knob nobody knows how to set, and the tap test *is* the calibration knob the physical world needs.
