# Slice 43 — Moog-style synth

**Goal:** A knob-twisting subtractive synth. Kids hold notes with one hand and sweep a filter with the other, and it sounds like a synthesizer.

**Architecture:** `js/games/moog.js` reuses `keys-ui.js` from slice 41 — this is the second consumer that made that component worth extracting. Behind the same keybed sits a completely different voice: two oscillators → resonant lowpass → amp ADSR + filter envelope. That is the actual Moog signal path, not a simplification of one; subtractive synthesis really is this short (design.md D6).

A rotary knob is a `pointermove` delta on a div with a CSS rotation — about twenty lines. No knob library, no `<input type="range">` dressed up (range inputs fight multi-touch and drag on tablets).

**Design:** `docs/plans/2026-07-28-music-room/design.md` §1 (D4, D6, D11, D13, D14), §3.2, §4.

**Depends on:** slice 41 (`keys-ui.js`), slice 35 (voice cap).

**DONE WHEN:**
- A knob turns **while three keys are held** — genuine simultaneous multi-touch across two widgets.
- The four presets sound clearly different from each other.
- Filter sweeps are smooth, with no zipper noise and no clicks.
- **All four waveforms are visibly different on the scope**, and the trace is stable — not sliding or jittering.
- **Turning cutoff down visibly rounds off** a square or saw wave on the scope while it sounds.
- The scope shows a flat centre line when nothing is playing, and draws nothing from other instruments.
- No stuck notes on release, octave change, backgrounding, or `stop()`.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **Knobs and keys must work at the same time.** This is the defining interaction of the instrument. Both use `pointerId` tracking and `setPointerCapture`; a knob that steals the keybed's pointers has failed the slice.
2. **Ramp parameter changes.** Assign filter cutoff and gain via `setTargetAtTime` or `linearRampToValueAtTime`, never bare `.value =` during playback — direct assignment on a live parameter produces audible zipper noise on every drag frame.
3. **Clamp resonance.** High `Q` plus a low cutoff self-oscillates into a painfully loud squeal. Cap `Q` around 20 and keep a modest master gain. Kids will absolutely turn every knob to maximum within ten seconds; this is hearing safety, not taste.
4. **Voice cap 24**, same as the piano. Raise it through `audio.setMaxVoices(24)` in `init()`, store the returned previous cap, and restore that value in `stop()`.
5. **`ponytail:` comment** where the ceiling is cut — one filter, no LFO, no modulation matrix.
6. **Bilingual** knob labels and preset names.
7. **Build on the shared graph.** Create oscillators, filters and the analyser from `audio.graph().ctx`; connect the instrument bus to `audio.graph().master`. No second `AudioContext`.
8. **Landscape proof.** The keybed, scope, presets, waveform selector and five knobs fit one tablet landscape viewport. Portrait shows the rotate prompt.
9. **`stop()` releases everything.**

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/games/moog.js` | Create | Voice, knobs, presets, game module |
| `js/games/index.js` | Modify | Manifest entry, `bestKey: null` |
| `sw.js` | Modify | `APP_SHELL` += `moog.js`, `CACHE_NAME` bump |

---

## Task 1: The voice

**Files:** Create `js/games/moog.js`

- [ ] **Step 1: Per-note graph:**
  ```
  osc1 (saw)  ─┐
               ├─→ lowpass (cutoff, Q) ─→ ampGain ─→ master
  osc2 (saw, detuned ±cents) ─┘
  ```
- [ ] **Step 2: Amp ADSR** on `ampGain` — attack and release from the knobs, decay and sustain fixed at sensible values. Full ADSR is four more knobs for a benefit no kid will find; two is the honest choice and can grow.

- [ ] **Step 3: Filter envelope** — on `noteOn`, sweep the cutoff from the knob value up by a fixed envelope amount and back down. This is what makes a synth note sound *plucked* rather than *organ-like*, and it is why the instrument will feel alive.

- [ ] **Step 4: `noteOff`** — release ramp on the amp, then `stop()` after the tail. Same retrigger rule as the piano: a `noteOn` for a sounding note releases the old voice first.

- [ ] **Step 5: Live knob changes reach sounding voices.** Turning cutoff while a chord is held must sweep *that chord*. Keep a set of live voices and apply the ramp to each — a synth whose knobs only affect the next note is not a synth.

---

## Task 2: The knobs

- [ ] **Step 1: `createKnob({mount, label, min, max, value, onChange})`.** `pointerdown` captures; `pointermove` maps vertical delta to value (up increases — the universal convention, and inverted feels broken); `pointerup` releases. Roughly 150px of drag covers the full range.

- [ ] **Step 2: Render** as a circle with an indicator line rotated by `transform: rotate()` across ~270°, with the bilingual label and current value beneath.

- [ ] **Step 3: Five knobs** — Cutoff 截止, Resonance 共振, Detune 失諧, Attack 起音, Release 釋音. Waveform is **not** a knob; it gets its own selector in Task 3.

- [ ] **Step 4: Fine control.** Slow drags move less per pixel than fast ones, or simply keep the range generous. Kids give up on a knob that jumps from nothing to everything in five pixels.

---

## Task 3: Waveform selector + oscilloscope

The point of putting these together: a kid picks a shape, *sees* the shape, then turns cutoff down and watches the corners round off. That is the whole lesson of subtractive synthesis in one gesture, and it is why the scope earns its place rather than being decoration.

- [ ] **Step 1: Four waveforms, not two.** `OscillatorNode.type` natively accepts `sine` / `triangle` / `sawtooth` / `square`, so a four-way selector costs exactly the same as a two-way toggle — one string assignment. Bilingual labels: Sine 正弦, Triangle 三角, Saw 鋸齒, Square 方波. Show the shape as a tiny glyph on each button; kids will pick by picture long before they read the word.

- [ ] **Step 2: Changing waveform updates sounding voices.** Same rule as the knobs — set `osc.type` on every live voice, not just the next one. `type` is a discrete switch, so it can click if changed mid-cycle; that is acceptable and normal on real hardware.

- [ ] **Step 3: The analyser goes on the instrument bus, not the master.** Give the Moog its own gain node: `voices → instrumentGain → analyser → master`. Tapping the shared master instead would draw the metronome and every UI cue into the scope. This keeps the visualization about *this instrument* and needs **no change to `audio.js`** — the analyser is entirely local to this file.

- [ ] **Step 4: `analyser.fftSize = 2048`**, `getByteTimeDomainData()` into a reused `Uint8Array`. Allocate the array **once**, not per frame.

- [ ] **Step 5: Zero-crossing trigger — do not skip this.** Drawing the buffer from index 0 makes the waveform slide and jitter unreadably, because the buffer boundary has no relationship to the wave's phase. Scan for the first upward zero crossing (`prev < 128 && cur >= 128`) and start drawing there. Five lines, and it is the entire difference between a readable oscilloscope and visual noise. This is the one part of the slice that looks broken when it is merely wrong.

- [ ] **Step 6: Draw in the existing `sched.frame()` loop.** No second rAF. Canvas sized to its CSS box × `devicePixelRatio` so it is not blurry on the tablet.

- [ ] **Step 7: Idle state.** With no note sounding the buffer is silence — draw a flat centre line, not an empty box. A dead-looking panel reads as broken.

---

## Task 4: Presets, manifest, verify

- [ ] **Step 1: Four presets** — Bass 貝斯 (low cutoff, fast attack, short release), Lead 主奏 (mid cutoff, high resonance), Pad 鋪底 (slow attack, long release, wide detune), Wobble 抖動 (low cutoff, very high resonance, snappy filter envelope). One tap loads a preset and visibly moves the knobs to match, so a kid sees what a sound *is* made of.

- [ ] **Step 2: Manifest entry:**

```js
{ id: "moog", brain: false, keyboard: false, bestKey: null, legacy: false,
  meta: { icon: "🎛️", title: "Synth", tz: "合成器", blurb: "Twist the knobs" } },
```

- [ ] **Step 3:** `APP_SHELL` += `moog.js`, bump `CACHE_NAME`. `node scripts/check.mjs` — green.

- [ ] **Step 4: On the tablet:**
  - hold three keys with the left hand, sweep cutoff with the right → the held chord sweeps, smoothly, no clicks
  - every knob to maximum simultaneously → loud but not painful, no runaway squeal
  - each preset sounds obviously different
  - background mid-note → silence, no stuck voice
  - landscape viewport shows scope, waves, knobs, presets and playable keys with no page scroll; portrait shows the rotate prompt

---

## Notes for the implementer

Skipped deliberately: LFO, second filter, oscillator sync, sub-oscillator, portamento, arpeggiator, patch saving. Every one is a real Moog feature and every one is a rabbit hole. Five knobs, four waveforms and four presets is enough for a kid to discover that turning cutoff down makes it *darker* — which is the entire lesson this instrument teaches, and the scope is what makes that discovery visible instead of merely audible.

**Spectrum view** (`getByteFrequencyData`, same analyser, ~10 more lines) is the obvious sibling and arguably teaches the filter better — you watch cutoff literally delete the upper harmonics. Skipped for now because one clear visualization beats two competing ones on a tablet-width panel. Add when a kid asks *why* it gets darker.

Portamento (glide) is the one worth adding first if asked — it is a handful of lines on the oscillator frequency ramp and it is the most recognisably "Moog" thing on the list.
