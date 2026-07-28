# Design — Music Room (piano, Moog synth, MPC pads, finger-drumming trainer)

**Date:** 2026-07-28
**Status:** approved by Papa (brainstorm session, Claude Code)
**Extends:** `docs/plans/2026-07-26-game-platform/design.md`. Every instrument is a registry-native game using that plan's §3 `ctx` contract unchanged. Where the two disagree on *how a thing is wired into the app*, the game-platform design wins.
**Slices:** `35-audio-samples.md`, `36-drum-kit-assets.md` … `43-moog-synth.md`. Numbering continues the global sequence (solar-system took 30–34).
**Does not touch:** `js/drills.js`. See D10.

## Context

Papa wants a music activity for the camp: each kid picks an instrument on their tablet and plays. Three instruments — a playable piano, a Moog-style synthesizer with knobs, and an MPC-style pad grid for finger drumming — plus two practice modes: a Melodics-style note-drop trainer for the pads, and an on-screen piano practice reference the kid mirrors on the real acoustic piano.

("MPC" throughout this document means the Akai MPC pad-grid sampler — the hardware instrument. Not Model Context Protocol.)

The brainstorm resolved four questions that each removed a subsystem:

- **Nothing listens.** No microphone pitch detection, no MIDI. Piano practice is screen + metronome; the kid plays their real piano alongside.
- **Android tablets.** This makes touch-to-sound latency the make-or-break engineering risk, and it rules out WebMIDI as a fallback anyway.
- **CC0 one-shots**, sourced and vendored, small enough that offline-first survives.
- **No band mode.** Kids each pick an instrument and play in the same room. Nothing is networked.

## 1. Papa's decisions

| # | Decision |
|---|---|
| D1 | **Three registry games, not a new section.** `pads`, `piano`, `moog` are the three tiles. Finger-drumming practice is a mode *inside* `pads`; piano practice is a mode *inside* `piano`. They register through `js/games/index.js` + `SQLoadGame` like any other game, so the tile grid, lazy loading, `ctx` injection and `stop()` teardown cost zero new host code. |
| D2 | **Nothing listens, nothing is networked.** No mic, no pitch detection, no WebMIDI, no band sync, no shared clock, no Supabase traffic. Real-time musical ensemble over wifi needs a <10ms budget that wifi cannot meet — and the kids are in the same room, so they can already hear each other. Do not build toward it. |
| D3 | **One `AudioContext` for the whole app.** `getSharedAudio()` in `js/game-services/audio.js` already owns it; the music work *extends* that service rather than forking a second context. One unlock gesture must cover every instrument, and Android charges real memory per context. |
| D4 | **No audio library.** Tone.js is ~200KB for a transport that is ~40 lines of `setInterval` lookahead (the standard two-clocks pattern). A rotary knob is a pointer-drag delta. Web Audio *is* the standard library for this problem. No new dependency enters the repo for the Music Room. |
| D5 | **Latency is calibrated, not assumed.** Android touch-to-sound latency ranges 40–300ms across devices and buffer states. A fixed offset guess makes the trainer feel broken in a way nobody can diagnose. The kid taps along to eight metronome beats once per device; the median offset is stored locally and shifts every judge window. This is a slice of its own (38) and it lands **before** the trainer. |
| D6 | **Synthesized instruments, sampled drums.** A real multi-velocity piano sample set is 20–100MB, and offline-first means all of it would have to sit in `APP_SHELL` — that wrecks the app shell for one game. Piano and Moog are synthesized (a Moog *is* oscillators→filter→envelope; that is the authentic architecture, not a compromise). Drums must be samples — finger drumming is *about* the sample — but one-shots are small: ~12 mono files, ≤40KB each. |
| D7 | **Do not build on `js/brain-audio-cues.js`.** Its recipes are fixed-duration, gateless and filterless ("nothing loops, nothing runs longer than 640ms"), and its own header says the file is deleted once recorded cues land. A held piano key and a resonant filter sweep need real note-on/note-off voices. Reusing it would couple new work to a doomed file for a shape that does not fit. Instruments carry their own voice code. |
| D8 | **The trainer has 4 lanes, not 16.** Sixteen columns is unreadable on a tablet and is not what Melodics does either. V1 is four lanes across all six starter exercises. A later top tier may widen to six only as its own follow-up slice, with a fresh layout proof; do not smuggle six-lane support into slice 40. |
| D9 | **Layers come from the exercise ladder.** Papa asked for "adding different layers/samples" as difficulty climbs. Rather than authoring separate backing stems, each exercise's backing loop **is the previous exercise's pattern**. Parts accumulate as the kid climbs, the content is free, and the kid literally hears what they already mastered playing underneath them. |
| D10 | **`js/drills.js` is left alone.** It already holds piano and rhythm drills — but those are the *away-from-the-tablet* routine: text steps, kid-paced, metronome, for practising at the real piano. Slice 42 is the *on-screen* reference that lights up keys. Same subject, different moment. Coupling them would force one file to serve two interaction models. If they should merge, that is a later decision made on evidence. |
| D11 | **Free-play instruments carry no high score; the trainer does.** `piano`, `moog` → `bestKey: null` (precedent: `solar`, `hunt`, `home`). `pads` reserves `bestKey: "pads"` for its trainer mode only: free play never calls `ctx.finish()`, and the trainer reports through `ctx.finish({score})` — never a stored counter, per the project's stars-are-a-ledger non-negotiable. |
| D12 | **Trainer notes travel right → left, pads directly underneath** (Papa, 2026-07-28, reviewing the preview). Four *horizontal* lanes in a full-width track, a fixed vertical hit line near the left edge. Right-to-left is the direction a groove is written and read, and putting the grid immediately below the track keeps eyes and hands in one place — a kid never looks away mid-bar. With no column alignment to lean on, **each lane is colour-matched to its target pad** via a coloured stripe; that stripe is the entire lane→pad mapping and has to be unmistakable at a glance. Supersedes the falling-column layout. |
| D13 | **Every instrument fills the tablet screen, and nothing scrolls** (Papa, 2026-07-28). Full-width layouts, sized to one landscape screen, fully contained. Scrolling is a failure mode here, not a fallback: a kid mid-exercise must not be able to push half the instrument off-screen, and a pad that moves under a finger is worse than a pad that is slightly small. Where content does not fit in landscape, it shrinks or content is cut. In portrait or very narrow widths, show a bilingual rotate prompt instead of allowing a broken scrollable instrument. |
| D14 | **Four waveforms and a scope on the synth** (Papa, 2026-07-28). `OscillatorNode.type` natively accepts sine / triangle / sawtooth / square, so a four-way selector costs one string assignment over the two-way toggle originally planned — take the free upgrade. Paired with an `AnalyserNode` oscilloscope on the **instrument bus, not the master** (so the metronome and UI cues never leak into the trace). Pick a shape, see the shape, turn cutoff down, watch the corners round off: that is subtractive synthesis taught in one gesture, and it is why the scope earns its place rather than being decoration. A zero-crossing trigger is mandatory — without it the trace slides and reads as broken. |
| D15 | **The Music Room is its own tab, not a Games tile** (Papa, 2026-07-28 — amends D1). D1 put the three instruments in the arcade grid because it cost zero host code. It cost D13 instead: the arcade shell spends ~229px on the game switcher, caps the stage height, and writes its own loading message into the mount, so an instrument could not fill the screen and 3 octaves of 44px keys overflowed a 1024px landscape tablet. Music gets a hub tab (`music`) and a full-bleed view, next to Books. The instruments stay registry-native and still load through `SQLoadGame` — only the shell changed — and carry `music: true` in the manifest so the Games grid skips them. Like Books, the Music tab is **not** category-locked: practising an instrument is not screen time. A Papa app-pause (slice 08) still covers it. |
| D16 | **Panel on top, keys along the bottom** (Papa, 2026-07-28, reviewing the first build). Both instruments dock the keybed at the bottom with a capped height rather than letting it fill the screen — an instrument is mostly controls, and keys only need to be tall enough to play. On the synth the knobs dock left and the oscilloscope sits to their right as a square. This supersedes nothing in D13; it is how D13 is met. |

## 2. The registry entries

Three lines in `js/games/index.js`, after the arcade games and before the brain block:

```js
{ id: "pads",  brain: false, keyboard: false, bestKey: "pads", legacy: false,
  meta: { icon: "🥁", title: "Drum Pads",  tz: "打擊墊",   blurb: "Finger drumming" } },
{ id: "piano", brain: false, keyboard: false, bestKey: null,   legacy: false,
  meta: { icon: "🎹", title: "Piano",      tz: "鋼琴",     blurb: "Play and practise" } },
{ id: "moog",  brain: false, keyboard: false, bestKey: null,   legacy: false,
  meta: { icon: "🎛️", title: "Synth",      tz: "合成器",   blurb: "Twist the knobs" } },
```

`legacy: false` from birth — these are new games written directly in registry form (game-platform §8: rewrite, don't migrate). `main.js:23` returns `null` for anything with `brain` set or `legacy !== false`, so both flags are load-bearing. That flag also arms the `check.mjs` guard that fails the build when a registry-native game is missing from `sw.js` `APP_SHELL` — offline-first is enforced, not remembered.

Each game uses the §3 `ctx` contract unchanged: reads nothing ambient, appends its own DOM to `ctx.mount`, ignores `ctx.stage` (these are DOM instruments, not canvas games), and releases everything in `stop()`.

## 3. Architecture — three layers

```
js/game-services/audio.js     shared AudioContext, sample kits, voice cap   (slice 35)
js/game-services/music.js     calibration, transport, chart runtime, judge  (slices 38, 39)
js/games/keys-ui.js           keybed component — piano + moog               (slice 41)
js/games/pads.js              MPC grid: free play + trainer                 (slices 37, 40)
js/games/pad-charts.js        exercise data                                 (slice 40)
js/games/piano.js             piano instrument + practice mode              (slices 41, 42)
js/games/moog.js              subtractive synth                             (slice 43)
```

`music.js` lives in `game-services/` and not `games/` deliberately: `js/games/CLAUDE.md` states that folder holds exactly three kinds of file (`index.js`, `registry.js`, `<id>.js`), and a shared non-game module there would break that rule. `game-services/` is precisely "services games import" — the existing `audio.js` / `motion.js` / `scheduler.js` set the pattern.

`keys-ui.js` *is* in `js/games/` and is the one exception worth taking: it is a component, not a service, and it has two real consumers (piano, Moog) on the day it is written. An abstraction with two callers is earned; one with one caller would not be.

### 3.1 Timing — two clocks

Musical events never come from `setTimeout`. The standard pattern:

- a **lookahead loop** runs every ~25ms and schedules any note due in the next ~100ms at an exact `audioCtx.currentTime + delta`
- **painting** runs in `requestAnimationFrame` and derives note positions from the audio clock

Both are hosted inside `createScheduler()` from `js/game-services/scheduler.js`. That service is a *resource-lifecycle* scheduler, not a musical one — but wrapping the lookahead in `sched.every(25, …)` and the paint loop in `sched.frame(…)` means `stop()` is a single `cancelAll()`, and the pause-on-document-hidden behaviour comes free. That is exactly the reuse it was built for.

### 3.2 Synth voices — service-owned graph, game-owned sound

Piano and Moog need Web Audio nodes, but they must not create a second `AudioContext` and they must not reach for one ambiently. Slice 35 therefore extends `audio.js` with:

- `setMaxVoices(n)` / `maxVoices` so music games can raise the cap to 24 after the singleton already exists, and restore the previous cap in `stop()`.
- `graph()` returning the shared `{ ctx, master }` after unlock/ensure, so game-owned oscillators and filters connect to the app's one master bus.

That is the only sanctioned escape hatch. Instruments may create their own oscillators, filters, gains and analysers from `graph().ctx`, but the final output connects to `graph().master`; no instrument calls `new AudioContext()`.

### 3.3 Latency — two different offsets

Do not conflate these:

| Offset | Source | Used for |
|---|---|---|
| **output latency** | `audio.clock().outputLatency` (from `audioCtx.outputLatency + audioCtx.baseLatency`) | aligning what is *drawn* with what is *heard* |
| **round-trip touch latency** | measured, slice 38 | shifting the *judge window* for the kid's taps |

Only the second requires the kid. The first is free and is the fallback when no calibration has been run yet.

## 4. The instruments

**Pads** — 4×4 grid, `touch-action: none`, `pointerdown` → `playSample`. A `pointerId` → pad map keeps fingers independent, so four hands-on-pads at once each light and fire their own cell. Velocity is fixed (Android exposes no usable pressure); the classic MPC trick of mapping y-position-within-pad to velocity is a marked ceiling, not v1.

**Piano** — two octaves visible with octave-shift buttons. Voice: three detuned oscillators, fast attack, exponential decay, a lowpass that tracks pitch, and real note-on/note-off so held keys sustain and release cleanly. This will read as a good electric piano rather than a Steinway — stated plainly so nobody is surprised, and marked as a swappable ceiling.

**Moog** — the real signal path: two oscillators (detunable, waveform selectable) → resonant lowpass → amp ADSR + filter envelope. Five knobs (cutoff, resonance, detune, attack, release), each a vertical pointer-drag delta of ~20 lines, plus a four-way waveform selector and oscilloscope (D14). Four presets (bass, lead, pad, wobble) so one tap gets a kid a sound worth playing.

**Trainer** — notes travel **right → left** along four horizontal lanes to a fixed hit line near the left edge, with the pad grid directly underneath (D12); `pointerdown` is judged against the scheduled beat after the calibration offset. Perfect <50ms, good <100ms, ok <180ms, else miss. Score is `perfect * 100 + good * 70 + ok * 40`, clamped to 0 when every note is missed, and `ctx.finish({score})` fires once at the end of an exercise only. Charts are plain data (`{bpm, bars, notes:[{beat, lane, sample}]}`) in the same spirit as `solar-data.js`.

## 5. Slice order and why

Riskiest first, and each slice leaves something usable.

| Slice | Why here |
|---|---|
| 35 audio service | everything depends on it; touching a service 19 games share is the highest-blast-radius change, so it goes first with tests |
| 36 kit assets | not code — sourcing and licensing; can run in parallel with 35 |
| 37 pads free play | **first thing kids can actually use**, and it proves multi-touch + samples on real hardware |
| 38 calibration | must precede 39 — without it the trainer feels broken and nobody can tell why |
| 39 transport + runtime | the engine, testable headless before any exercise exists |
| 40 trainer | content on top of a proven engine |
| 41 piano | independent of 35–40 except the audio service |
| 42 practice mode | content on top of 41 |
| 43 Moog | reuses the keybed from 41; last because it is the most toy-like |

## 6. Constraints that bite

- **Bilingual invariant.** Every kid-facing string ships EN + 繁體中文 (Taiwan usage). Note names, exercise titles, judge feedback, knob labels. A string without 中文 is a bug.
- **`pointerdown`, never `click`.** Tap latency is the whole game here; `click` adds a delay that would swamp the calibration this design spends a slice earning.
- **Touch-first does not mean inaccessible.** Playable pads/keys/knobs are pointer-primary, but every visible control still needs a semantic role or native element, a bilingual accessible name, and a visible focus state. Judge/result text uses an `aria-live` region. Colour may reinforce lane mapping, but labels/position must also identify the lane.
- **Offline-first.** Every new `js/` file and every sample joins `sw.js` `APP_SHELL` with a `CACHE_NAME` bump, in the same commit. `check.mjs` fails the build otherwise.
- **`stop()` releases everything.** Route every timer, loop and animation through `createScheduler()`; teardown is one `cancelAll()` plus stopping live voices.
- **Legacy-syntax scan.** `check.mjs` still scans for `?.` / `??` / `.flatMap`. The Android 8 baseline is retired, so this is a stale guard, not a device requirement — if it trips on new music code, relax the scan at that moment rather than contorting the code (project rule, 2026-07-27).
- `node scripts/check.mjs` after every edit. Red ⇒ do not commit.

## 7. Marked ceilings

Each gets a `ponytail:` comment at the point of compromise:

| Ceiling | Upgrade path |
|---|---|
| fixed pad velocity | map y-position within the pad, MPC-style, if kids ask for dynamics |
| 4 trainer lanes | a later six-lane expert tier if kids outgrow four; 16 is never right |
| synthesized piano | swap in a small sampled set if the tone disappoints — but weigh it against `APP_SHELL` size |
| no ensemble sync | out of scope by D2; revisit only if the kids are ever in different rooms |

## 8. Out of scope

Recording and looping, exporting audio, song mode, a kid-facing sample editor, note-drop for piano (D10 keeps piano practice screen-and-metronome), any networked feature. Each is its own brainstorm if it ever earns one.
