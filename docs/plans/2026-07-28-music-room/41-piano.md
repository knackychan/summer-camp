# Slice 41 — Piano + shared keybed

**Goal:** A two-octave piano a kid can play chords on with both hands, that sounds warm and releases cleanly. Plus the keybed component the Moog will reuse.

**Architecture:** Two files. `js/games/keys-ui.js` is a **presentation-only** keybed: it draws keys, tracks pointers, and emits `noteOn(midi)` / `noteOff(midi)`. It knows nothing about sound. `js/games/piano.js` owns the voice and wires it up. That split is what lets slice 43 reuse the keybed with a completely different synth behind it — two real consumers on the day it is written, which is what makes the abstraction earned rather than speculative (design.md §3).

**Sound:** synthesized, not sampled (design.md D6). Three detuned oscillators, fast attack, exponential decay, a lowpass that tracks pitch, real note-on/note-off. This reads as a good electric piano, not a Steinway — stated plainly, marked as a ceiling, swappable if the tone disappoints.

**Design:** `docs/plans/2026-07-28-music-room/design.md` §1 (D6, D7, D11, D13), §3.2, §4.

**Depends on:** slice 35 only (needs the voice cap raised to hold a sustained chord). Independent of 36–40 — can be built in parallel with the pads work.

**DONE WHEN:**
- A **five-note chord** sounds, sustains while held, and every voice releases cleanly.
- No stuck notes after: multi-touch release, sliding off a key, backgrounding the tab mid-chord, or `stop()` mid-chord.
- Octave shift works and does not orphan held notes.
- Black keys are reachable and hittable by a child's finger.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **Voice cap.** Call `audio.setMaxVoices(24)` while the game is active and store its returned previous cap; restore that value in `stop()`. Three oscillators per note × a five-note chord is fifteen nodes; the default cap of 4 would steal voices mid-chord, and `getSharedAudio({maxVoices: 24})` may be too late if Brain Gym already created the singleton.
2. **Never build on `js/brain-audio-cues.js`** (design.md D7). Its recipes are fixed-duration and gateless — a held key cannot be expressed in that table. This file carries its own voice code through `audio.graph().ctx`, connected to `audio.graph().master`.
3. **`pointerdown` + `pointerId` map + `setPointerCapture`**, same discipline as slice 37. A piano is multi-touch by definition.
4. **`touch-action: none`**, `user-select: none`.
5. **Release, don't cut.** `noteOff` starts the release envelope; it never calls `stop()` on the oscillator immediately. Cutting a piano note dead is the difference between an instrument and a beeper. Schedule the actual `osc.stop()` after the release tail.
6. **Bilingual** — note names, octave labels, any hint text.
7. **Landscape proof.** The keybed and controls fit one tablet landscape viewport. Portrait shows the rotate prompt.
8. **`stop()` releases everything** — every live voice, every scheduled stop, every listener.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/games/keys-ui.js` | Create | Keybed: layout, multi-touch, `noteOn`/`noteOff` callbacks. No audio. |
| `js/games/piano.js` | Create | Piano voice + game module |
| `js/games/index.js` | Modify | Manifest entry, `bestKey: null` |
| `sw.js` | Modify | `APP_SHELL` += both files, `CACHE_NAME` bump |

---

## Task 1: The keybed

**Files:** Create `js/games/keys-ui.js`

- [ ] **Step 1: `createKeybed({mount, lowMidi, octaves, onNoteOn, onNoteOff})`.** Returns `{ setOctave, highlight, allNotesOff, destroy }`. It emits MIDI numbers and nothing else — no frequencies, no sample names, no opinions about sound.

- [ ] **Step 2: Layout.** White keys as a flex row; black keys absolutely positioned over the gaps at the correct offsets (a piano's black keys are *not* evenly spaced — C♯ and D♯ sit differently within their group than F♯/G♯/A♯; getting this wrong is instantly visible to anyone who plays). Black keys draw above white and take pointer priority in the overlap.

- [ ] **Step 3: Multi-touch.** `pointerId` → midi map. `setPointerCapture` on `pointerdown`. `pointerup`/`pointercancel` look up by id, fire `onNoteOff`, clear.

- [ ] **Step 4: Slide between keys.** `pointermove` with a captured pointer that crosses into a new key fires `noteOff(old)` then `noteOn(new)`. Kids will glissando immediately; without this the first key sticks on.

- [ ] **Step 5: `highlight(midi, className)`** — for slice 42's practice mode to light target keys. Pure presentation; the keybed never decides *what* to highlight.

- [ ] **Step 6: `allNotesOff()`** — panic. Called on octave change, on visibility loss, and by `destroy()`.

- [ ] **Step 7: Sizing.** Two octaves must fit a tablet in landscape with white keys wide enough for a child's finger. If it does not fit, show fewer keys — never shrink below a usable target.

---

## Task 2: The voice

**Files:** Create `js/games/piano.js`

- [ ] **Step 1: `midiToFreq(m)`** = `440 * Math.pow(2, (m - 69) / 12)`. One line, no table.

- [ ] **Step 2: `noteOn(midi)`** — build per voice:
  - three oscillators: two `triangle` detuned ±4 cents, one `sine` an octave up at low gain for the strike shimmer
  - a lowpass whose cutoff tracks pitch (roughly `freq * 6`, clamped) — high notes stay bright, low notes stay warm
  - a gain envelope: attack ~5ms, then `setTargetAtTime` decay toward a low sustain
  Store the voice in a `Map` keyed by midi.

- [ ] **Step 3: `noteOff(midi)`** — ramp gain down over ~250ms, then `osc.stop()` after the tail. **Retrigger:** a `noteOn` for a midi already sounding must release the old voice first, or repeated taps leak oscillators until the tab dies.

- [ ] **Step 4: `ponytail:` comment** naming the ceiling — synthesized rather than sampled, with the upgrade path and the reason not to take it lightly (a sampled set is 20–100MB against an app shell that must precache).

- [ ] **Step 5: Game module** — standard shape, `bestKey: null`, `keyboard: false`. `init` builds the keybed into `ctx.mount`, unlocks audio on first touch, raises the shared voice cap to 24, adds octave up/down buttons and a bilingual note-name toggle.

---

## Task 3: Manifest, teardown, verify

- [ ] **Step 1: Manifest entry:**

```js
{ id: "piano", brain: false, keyboard: false, bestKey: null, legacy: false,
  meta: { icon: "🎹", title: "Piano", tz: "鋼琴", blurb: "Play and practise" } },
```

- [ ] **Step 2: `stop()`** — `allNotesOff()`, stop every live voice, restore the previous shared voice cap, `sched.cancelAll()`, `keybed.destroy()`, empty `ctx.mount`.

- [ ] **Step 3:** `visibilitychange` → `allNotesOff()`. A suspended context with held notes resumes into a stuck chord otherwise.

- [ ] **Step 4:** `APP_SHELL` += both files, bump `CACHE_NAME`. `node scripts/check.mjs` — green.

- [ ] **Step 5: On the tablet:**
  - five fingers down → five notes, all sustaining
  - lift them one at a time → each releases alone
  - hold a chord, switch apps, come back → silence, no stuck notes
  - hammer one key 30 times fast → no crackle, no runaway voice count
  - glissando across an octave → clean
  - landscape viewport shows all primary controls and playable keys with no page scroll; portrait shows the rotate prompt

---

## Notes for the implementer

The detune amounts and the decay curve are the whole sound. Expect to sit and tune them by ear for twenty minutes; that is not wasted time, it is the instrument. Start from: detune ±4 cents, attack 5ms, decay `setTargetAtTime` with a ~0.7s time constant, sustain ~8% of peak.

Do not add a sustain pedal button in this slice. It changes voice lifetime rules everywhere and is a whole conversation about how many voices can be alive at once. Add when a kid asks.
