# Slice 42 — Piano practice mode

**Goal:** On-screen exercises that light up keys in time with a metronome, so a kid can mirror them on the real acoustic piano — daily hand drilling, no listening, no grading.

**Architecture:** A mode inside `js/games/piano.js`, using `keybed.highlight()` from slice 41 and the transport from slice 39 to drive the metronome and the step timing. Exercise data goes in `js/games/piano-drills.js` as plain bilingual data.

**Nothing listens** (design.md D2). The app cannot know what the kid played and does not pretend to. It is a metronome with a visual score — the same role a teacher's hand pointing at the page plays. That is what Papa asked for, and it is why this slice is small.

**Not coupled to `js/drills.js`** (design.md D10). That file is the away-from-the-tablet routine: text steps, kid-paced, "play your piece once, gently". This is the on-screen reference. Same subject, different moment. Leave `drills.js` untouched.

**Design:** `docs/plans/2026-07-28-music-room/design.md` §1 (D2, D10, D13), §4.

**Depends on:** slice 41 (keybed + `highlight`), slice 39 (transport, for the metronome and step clock).

**DONE WHEN:**
- Five exercises, each bilingual EN + 繁體中文.
- Keys light in time; the metronome is locked to the exercise tempo.
- Tempo is adjustable down to a genuinely slow practice speed.
- A kid can pause, and can loop a single bar.
- Nothing is scored, nothing is graded, nothing is unlocked.
- `node --test scripts/piano-drills.test.mjs` passes.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **No grading, no score, no stars.** `bestKey` stays `null`. There is no input to grade — inventing a score from taps on the *tablet* would reward the wrong instrument entirely.
2. **Tempo must go slow.** Down to 40bpm. Real practice happens below the speed that feels impressive, and a floor of 80 makes the feature useless for the hard bits.
3. **Loop a bar.** The single most useful practice control there is. One button.
4. **Bilingual**, including finger numbers and hand labels (左手 / 右手).
5. **Reuse `highlight()` and the transport.** No second timing implementation, no second key renderer.
6. **Landscape proof.** The exercise list, tempo controls, lit keybed, and loop/pause controls fit one tablet landscape viewport. Portrait shows the rotate prompt.
7. **Do not touch `js/drills.js`.**

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/games/piano-drills.js` | Create | 5 exercises: bilingual, notes with finger numbers |
| `js/games/piano.js` | Modify | Practice mode UI, tempo, loop, metronome |
| `scripts/piano-drills.test.mjs` | Create | Schema + bilingual completeness |
| `sw.js` | Modify | `APP_SHELL` += `piano-drills.js`, `CACHE_NAME` bump |

---

## Task 1: Exercise data

**Files:** Create `js/games/piano-drills.js`, `scripts/piano-drills.test.mjs`

```js
{ id: "c-five-finger", bpm: 60, bars: 4,
  name: { en: "C Five-Finger", tz: "C大調五指" },
  hint: { en: "Curved fingers, wrists relaxed", tz: "手指彎曲，手腕放鬆" },
  hand: "right",
  steps: [ {beat:0, midi:60, finger:1}, {beat:1, midi:62, finger:2}, … ] }
```

- [ ] **Step 1: Tests first** — both languages on every string; `midi` inside the keybed's visible range for the exercise's octave; `finger` 1–5; `beat < bars * 4`; ids unique.

- [ ] **Step 2: Five exercises:**

| # | Exercise | Hand |
|---|---|---|
| 1 | C five-finger pattern, up and down | right, then left |
| 2 | C major scale, one octave | right |
| 3 | C major scale, one octave | left |
| 4 | Contrary motion from middle C | both |
| 5 | G major five-finger (introduces F♯) | right |

- [ ] **Step 3: Finger numbers on every step.** This is what makes it a *hand* drill rather than a note-reading drill, and it is what Papa asked for.

---

## Task 2: Practice mode UI

- [ ] **Step 1: Mode switch.** Free play stays default; a bilingual "Practice 練習" button opens the exercise list. Same module, no reload.

- [ ] **Step 2: Light the key** at each step via `keybed.highlight()`, with the finger number shown on the key. Light the *next* key faintly a beat ahead — reading one step ahead is how playing actually works.

- [ ] **Step 3: Metronome** from the transport, count-in of four, running through the exercise.

- [ ] **Step 4: Tempo control** — 40 to 120bpm, big coarse-pointer stepper, current bpm shown. Persist per exercise in `localStorage`, so tomorrow's practice starts where yesterday's ended.

- [ ] **Step 5: Loop control** — loop the current bar, on/off, bilingual label.

- [ ] **Step 6: Hand label** — 左手 / 右手 / 雙手 shown prominently. A kid glancing up mid-exercise needs to know which hand without reading a sentence.

- [ ] **Step 7: Pause / resume**, and a plain restart.

---

## Task 3: Verify

- [ ] **Step 1:** `node --test scripts/piano-drills.test.mjs`, `node scripts/check.mjs` — green.
- [ ] **Step 2:** `APP_SHELL` += `piano-drills.js`, bump `CACHE_NAME`.
- [ ] **Step 3: With a kid at the real piano** — the only test that matters here: can they follow the lit keys at 60bpm on their own instrument without looking back and forth constantly? If the answer is no, the lights are too small or the look-ahead is too short. Both are cheap to change; find out early.
- [ ] **Step 4: Viewport proof** — landscape contains the keybed and controls with no page scroll or clipped primary control; portrait shows the rotate prompt.

---

## Notes for the implementer

The tablet's own sound should be **off by default** in practice mode — the kid is playing a real piano and two pianos at once is confusing. Leave a toggle for kids who want to hear the reference, defaulting to metronome-only.

Resist adding a "did you practise today?" streak. This is a coach-not-cop project and a broken streak is a punishment. If daily practice needs tracking, `drills.js` and the day system already own that question.
