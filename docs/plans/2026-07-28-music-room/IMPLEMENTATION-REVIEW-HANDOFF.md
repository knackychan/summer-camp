# Implementation Review Handoff - Music Room

Date reviewed: 2026-07-28
Repo: `summer-quest`
Scope: Music Room implementation so far, with extra focus on the newly finalized MPC drum pads.

This is a code-review handoff, not the original feature prompt. Read it after:

1. `CLAUDE.md`
2. `js/CLAUDE.md`
3. `js/games/CLAUDE.md`
4. `docs/plans/2026-07-28-music-room/design.md`
5. The relevant slice docs in this folder

Terminology: "MPC" here means the Akai-style pad sampler instrument, not Model Context Protocol.

## Executive Summary

The Music Room shell and the piano/synth work are broadly in place. The project verification gate is currently green.

However, the MPC drum pads are not actually reachable from the Music tab because their manifest entry is still commented out. The `pads.js` file exists and is precached, but the UI uses `SQManifest` to decide which instruments appear, and `pads` is absent from that manifest.

The drum-pad implementation also contains several runtime issues that `node scripts/check.mjs` does not catch:

- A late trainer tap can throw a `ReferenceError` because `diffIsOk()` is called but not defined.
- Untapped notes fade visually but are never counted as misses, so an exercise can hang forever and never call `ctx.finish({ score })`.
- Count-in and backing transport start in the wrong order and can create duplicate scheduler loops.
- Trainer timing ignores the saved latency calibration.
- Free-play pad labels are overwritten back to raw sample ids after kit load, losing the bilingual labels.
- Pads do not use the shared portrait `rotateGuard()`.

Treat pads as not shippable until those are fixed and verified in a real browser.

## Verification Already Run

From `D:\WORK\10 - AI\SUMMER CAMP\summer-quest`:

```sh
node --test scripts\pad-charts.test.mjs
node --test scripts\music-transport.test.mjs scripts\music-calibration.test.mjs scripts\music-audio.test.mjs
node scripts\check.mjs
```

Results:

- `pad-charts`: 11 tests pass
- `music-audio`, `music-calibration`, `music-transport`: 24 tests pass
- `node scripts/check.mjs`: pass

Caveat: these tests do not exercise `js/games/pads.js` runtime behavior. The full check also stays green because `pads` is commented out of `js/games/index.js`.

Node prints `MODULE_TYPELESS_PACKAGE_JSON` warnings for ESM files. These warnings are pre-existing style/noise for this repo and are not the current blocker.

## Current File Status

Relevant untracked/new Music Room files:

- `docs/plans/2026-07-28-music-room/design.md`
- `docs/plans/2026-07-28-music-room/35-audio-samples.md`
- `docs/plans/2026-07-28-music-room/36-drum-kit-assets.md`
- `docs/plans/2026-07-28-music-room/37-pads-free-play.md`
- `docs/plans/2026-07-28-music-room/38-latency-calibration.md`
- `docs/plans/2026-07-28-music-room/39-transport-notedrop.md`
- `docs/plans/2026-07-28-music-room/40-finger-drum-trainer.md`
- `docs/plans/2026-07-28-music-room/41-piano.md`
- `docs/plans/2026-07-28-music-room/42-piano-practice.md`
- `docs/plans/2026-07-28-music-room/43-moog-synth.md`
- `js/game-services/music.js`
- `js/games/keys-ui.js`
- `js/games/piano.js`
- `js/games/piano-drills.js`
- `js/games/moog.js`
- `js/games/pads.js`
- `js/games/pad-charts.js`
- `assets/audio/mpc/*`
- `scripts/music-audio.test.mjs`
- `scripts/music-calibration.test.mjs`
- `scripts/music-transport.test.mjs`
- `scripts/pad-charts.test.mjs`
- `scripts/piano-drills.test.mjs`
- `scripts/synth-drums.mjs`

Relevant modified existing files:

- `index.html`
- `js/game-services/audio.js`
- `js/games/index.js`
- `scripts/check.mjs`
- `sw.js`
- `CLAUDE.md`

There are also unrelated/unreviewed changes around books and solar in the working tree. Do not revert them.

## What Looks Healthy

### Music Tab / Host Shell

`index.html` now has a Music tab next to Books, a full-bleed `#music` view, a Music hub grid, a back button, and a mute button.

Important locations:

- Music tab chip: `index.html:619`
- Music tab content: `index.html:697`
- Full-bleed instrument view: `index.html:737`
- `musicIds()` excludes non-music games and returns manifest entries with `music: true`: `index.html:846`
- Games grid excludes instruments via `!e.music`: `index.html:843`
- Music is not category-locked, same as Books: `index.html:1659`
- `openInstrument()` loads instruments through `SQLoadGame()` and `runRegistered()`: `index.html:2527`
- Calibration UI exists in the Music tab: `index.html:2555`

This matches design decisions D15 and D13 in broad shape: instruments live outside the arcade shell and use the registry/ctx contract.

### Shared Audio Service

`js/game-services/audio.js` was extended additively:

- single shared lazy `AudioContext`
- `latencyHint: "interactive"`
- sample kit loading through `loadKit(kitName, manifest)`
- sample playback through `playSample(kitName, sampleName, opts)`
- shared clock through `clock()`
- graph access through `graph()`
- voice cap control through `setMaxVoices()`

Tests cover the main service behavior, including kit caching, missing file survival, mute/unlock behavior, `stopAll()`, shared graph, and voice cap.

### Music Service

`js/game-services/music.js` includes:

- latency calibration helpers
- stored offset
- `rotateGuard(root)`
- `createTransport()`
- `judge()`

Tests cover calibration math, transport ordering/scheduling, clock jumps, beat math, and judge windows.

### Piano

`js/games/piano.js` appears mostly coherent:

- Uses shared audio graph, not a second `AudioContext`.
- Uses shared `createKeybed()`.
- Calls `rotateGuard(root)`.
- Has free play and practice mode inside one registry game.
- `stop()` reaches into the practice closure and cancels practice state.
- Restores audio voice cap on stop.
- `bestKey: null`, so free play/practice do not score.

Known review note: no high-priority issue found in the pass, but runtime browser testing is still needed for actual touch/key release behavior.

### Keybed

`js/games/keys-ui.js` fixes the earlier white-key/black-key layout issues:

- `keysWrap` is `display:flex`.
- Black key indexing uses 7 white keys per octave.
- Pressed-key CSS lives with the component, so Synth-first sessions still light keys.
- Pointer tracking uses `pointerId`.
- `destroy()` removes the resize listener.

### Synth

`js/games/moog.js` uses:

- shared keybed
- shared audio graph
- instrument bus into master
- analyser on the synth bus
- `requestAnimationFrame` scope loop
- `rotateGuard(root)`
- teardown of scope, keybed, voices, scheduler, bus, and voice cap

The scope is now started only after `S` is assigned, avoiding the frozen-canvas bug.

## High-Priority Findings

### 1. Pads Are Disabled In The Manifest

Severity: blocker

Location:

- `js/games/index.js:33-38`

Current state:

```js
/* Drum Pads ... Uncomment
{ id: "pads", ... music: true,
  meta: { icon: "...", title: "Drum Pads", ... } }, */
```

Impact:

- `musicIds()` reads from `window.SQManifest`.
- Since `pads` is not in the manifest, the Music tab cannot show/open Drum Pads.
- `sw.js` already precaches `pads.js`, `pad-charts.js`, and the 12 audio files, but they are unreachable.
- `node scripts/check.mjs` passing does not prove pads are integrated.

Required fix:

- Uncomment or re-add the `pads` manifest entry.
- Update the stale comment that still says `js/games/pads.js` does not exist.
- Run `node scripts/check.mjs`.
- Verify Music tab renders Piano, Synth, and Drum Pads.

### 2. Trainer Can Throw `ReferenceError: diffIsOk is not defined`

Severity: blocker

Location:

- `js/games/pads.js:355-363`

Current code:

```js
var result = judge(nowTime, best.noteTime, 0, []);
judgeState[best.idx].judged = true;

if (result === "miss") result = diffIsOk(bestDiff) ? "ok" : "miss";
```

`diffIsOk()` is not defined anywhere in `pads.js` or imported. A late tap that produces `"miss"` from `judge()` can crash the trainer.

Required fix:

- Delete the `diffIsOk()` branch.
- Use `judge(nowTime, best.noteTime, offset(), judgeState)` or equivalent.
- Do not hand-roll a second timing window in `pads.js`.

Plan reference:

- Slice 40 constraint 6: reuse slice 39's judge.

### 3. Trainer Ignores Calibration

Severity: high

Locations:

- `js/games/pads.js:355`
- `js/games/pads.js:363-368`
- `js/game-services/music.js:124`
- `js/game-services/music.js:298`

Current state:

- Music tab exposes calibration.
- `music.js` has `offset()`.
- `judge()` accepts `offsetMs`.
- Pads pass `0`.
- Pads then compute their own absolute millisecond windows, again with no offset.

Impact:

- A tablet that measures 80-200ms late will still judge as if latency were 0ms.
- Slice 38's calibration gate becomes mostly cosmetic for the trainer.

Required fix:

- Import `offset` from `../game-services/music.js`.
- In trainer tap judging, call `judge(nowTime, best.noteTime, offset(), judgeState)` and use that result.
- Delete local duplicate timing windows.
- Add a runtime/unit test if practical: a tap that is late by the stored offset should judge as perfect/good according to `judge()`.

### 4. Untapped Notes Never Become Misses, So Exercises Can Hang Forever

Severity: high

Locations:

- `js/games/pads.js:321-324`
- `js/games/pads.js:385-389`
- `js/games/pads.js:392-405`

Current behavior:

- A kid note that passes the hit line is visually hidden.
- Its `judgeState` entry remains `judged: false`.
- `finishExercise()` only runs when `judgeState.every(js => js.judged)`.

Impact:

- If the kid skips one note, the exercise may never finish.
- `ctx.finish({ score })` may never fire.
- This violates the "Coach, not cop" requirement: the exercise always finishes warmly.

Required fix:

- In the paint/update loop, when a kid note passes the miss window, mark it judged and increment `tally.miss`.
- Continue the exercise to the end.
- Finish after all target notes are either hit or missed.
- Keep miss feedback warm and non-shaming.

### 5. Count-In Starts The Transport Too Early And Twice

Severity: high

Locations:

- `js/games/pads.js:278`
- `js/games/pads.js:414-418`

Current code starts transport before count-in:

```js
transport.start(tChart);
countIn(function () {
  started = true;
  transport.start(tChart);
});
```

Problems:

- Backing can play during the count-in.
- `createTransport.start()` calls `sched.every(25, tick)` every time, so starting twice can create duplicate intervals.
- `countIn()` uses raw `setInterval`, not `sched.every()`, so `stopTrainer()` / `stop()` cannot reliably cancel it.

Required fix:

- Use the scheduler for count-in.
- Start the transport only once, after count-in.
- Store any count-in cancel handle in `trainState`.
- Ensure `stopTrainer()` cancels count-in, paint RAF, feedback timeout, and transport.

Plan references:

- Slice 40 requires four clicks before every exercise.
- Project rule: timers should route through `createScheduler()` so `stop()` releases them.

### 6. Trainer `trainState` Captures Stale Values

Severity: medium/high

Location:

- `js/games/pads.js:452-463`

Current state:

`trainState` stores:

```js
started: started,
finished: finished,
paintRaf: paintRaf,
tally: tally
```

But `started`, `finished`, `paintRaf`, and sometimes `tally` are closure variables that change later. The object is a snapshot, not the source of truth.

Impact:

- `paintNotes()` checks `trainState.finished`, but `finishExercise()` only sets closure `finished = true`; `trainState.finished` may remain false.
- `stopTrainer()` cancels `trainState.paintRaf`, but only the first RAF id may be captured. Later RAF ids are assigned to the closure variable, not necessarily to `trainState.paintRaf`.
- Results and teardown can drift.

Required fix:

- Make one mutable `trainState` object the source of truth before starting loops.
- Mutate `trainState.started`, `trainState.finished`, `trainState.paintRaf`, `trainState.tally`, etc.
- Or keep closure variables only, but ensure teardown closes over and cancels the current handles reliably.

### 7. Free-Play Pad Labels Lose Bilingual Text After Kit Load

Severity: medium

Locations:

- `js/games/pads.js:581-583`
- initial raw labels at `js/games/pads.js:543`

Current code:

```js
el.innerHTML = "... bilingual labels ...";
el.textContent = el.dataset.sample;
```

The second line overwrites the bilingual label. The user sees `kick`, `snare`, etc. instead of English + Traditional Chinese labels from `kit.json`.

Required fix:

- Remove `el.textContent = el.dataset.sample`.
- Set `aria-label` for every pad, e.g. `Kick / [Traditional Chinese label]`.
- Use the same loaded label path for initial/trainer pads.

Plan reference:

- Slice 37 constraint 4: each pad has a bilingual visible label and accessible name.

### 8. Pads Do Not Use The Portrait Rotate Guard

Severity: medium

Locations:

- `js/games/pads.js:51`
- compare `js/games/piano.js:130`
- compare `js/games/moog.js:337`

Current state:

- Piano and synth call `rotateGuard(root)`.
- Pads do not.

Impact:

- Portrait/narrow view can show a squeezed or clipped pad/trainer layout instead of the bilingual rotate prompt.
- Violates design.md D13 and slice 37/40 viewport constraints.

Required fix:

- Import `rotateGuard` from `../game-services/music.js`.
- Call `rotateGuard(root)` after appending root.
- Verify portrait shows the prompt and landscape contains the instrument without scroll.

### 9. Pad Pointer Release Does Not Use The `pointerId -> pad` Map

Severity: medium

Locations:

- `js/games/pads.js:501-507`
- `js/games/pads.js:550-555`

The implementation stores `activePointers.set(e.pointerId, { padEl, sampleName })`, but release handlers remove the active class from `this`, not from the looked-up pad.

With `setPointerCapture`, `this` is probably the correct element in normal cases. But the slice explicitly says release should look up by `pointerId`, because slide-off/cancel cases are exactly where target assumptions get weird across mobile browsers.

Required fix:

- Add a shared `releasePointer(pointerId)` helper.
- Lookup `activePointers.get(pointerId)`.
- Remove the lit class from `entry.padEl`.
- Delete the pointer id.
- Use this helper for `pointerup`, `pointercancel`, visibility changes, and stop.

### 10. Trainer Uses A 4-Pad Grid, Not The Planned 4x4 Grid Beneath The Track

Severity: medium / design decision needed

Locations:

- `js/games/pads.js:156-161`
- `js/games/pads.js:482-507`

The slice says "pads directly underneath" and the 37 slice is a 4x4 grid. The implementation uses only one row of 4 trainer pads with `height:100px`.

This may be acceptable if Papa explicitly wants the trainer to reduce to the four active lane pads, but the current implementation does not document that as an amendment. If not intentional, it is a D12/D13 layout mismatch.

Required action:

- Decide whether trainer mode should show the full 4x4 pad grid with lane stripes on active pads, or only the four active trainer pads.
- If keeping 4 pads, amend `design.md` / slice 40 so this is deliberate.

### 11. Missing First-Run Calibration Offer Inside Pads Trainer

Severity: medium

Locations:

- `index.html:2555` has a Music-tab calibration UI.
- No `calibrationExists()` usage in `js/games/pads.js`.

Slice 40 says a kid who has never calibrated should still be able to play but be offered calibration once. The app-level Music tab now has calibration, which is useful, but the pads trainer itself does not appear to offer it once before practice.

Required action:

- Either implement the once-per-device offer in pads practice mode, or amend slice 40 to say the Music-tab calibration panel satisfies the requirement.
- If implementing, use `calibrationExists()` from `music.js`.

### 12. Synth Knobs Do Not Affect Held Voices

Severity: medium/high for slice 43

Locations:

- `js/games/moog.js:28-95`
- `js/games/moog.js:273-277`
- `js/games/moog.js:353-354`

Current state:

- `createMoogVoice()` creates oscillators and a filter from the current `params`.
- It returns only `{ release, ampGain }`.
- Knob `onChange` only does `params[key] = v`.
- Existing voices do not expose `lp`, oscillator refs, or an update method.

Impact:

- Turning cutoff/resonance/detune while holding notes will not sweep that held chord.
- This violates slice 43 acceptance criteria: live knob changes must reach sounding voices.

Required fix:

- Have each voice return an `update(params)` method or expose controlled params.
- On knob changes, iterate `voices` and ramp relevant `AudioParam`s:
  - cutoff -> `lp.frequency`
  - resonance -> `lp.Q`
  - detune -> oscillator frequencies or detune params
  - wave -> likely future notes only unless rebuilding held oscillators is intentional
  - attack affects future note-on only
  - release affects release behavior; current code reads `params.release` during `release()`, so that one already applies to held voices by reference
- Use short ramps to avoid zipper noise.

## Lower-Priority Cleanup / Polish

### Stale Manifest Comment

`js/games/index.js:33-36` still says `js/games/pads.js` does not exist and samples are not sourced. Both are now false. Update this even if the entry remains disabled temporarily.

### Raw `innerHTML` For Local Data

`pads.js`, `piano.js`, and Music tab rendering use `innerHTML` with local static data. This is not an immediate security issue because the data is repo-owned, but for consistency and future safety, prefer DOM node construction where convenient.

Do not let this distract from the runtime bugs above.

### Sample Provenance / D6 Deviation

`assets/audio/mpc/README.md` says the 12 drum sounds are synthesized by `scripts/synth-drums.mjs`, not sourced samples. `design.md` D6 says drums should be samples because finger drumming is about the sample. The previous handoff flagged this as a Papa call.

Current practical state:

- The files are small and precached.
- The README claims original synthesis / CC0 provenance.
- This is probably fine for v1 if Papa accepts the sound.

Needed:

- Make the deviation deliberate in `design.md` or `36-drum-kit-assets.md`.

### Audio `playSample({ when })` Semantics

`audio.playSample()` uses:

```js
var when = opts.when || 0;
src.start(when);
```

Web Audio `start(when)` expects an absolute AudioContext time, not a relative delay. Some caller code passes relative values. Tests may not catch this because mocks are permissive.

In `pads.js`, backing calls:

```js
audio.playSample("mpc", note.sample, { when: absoluteTime - clock.now, gain })
```

That is relative. If `playSample()` expects absolute, this is wrong. If `playSample()` is intended to accept relative, it should call `src.start(c.currentTime + when)`.

Required action:

- Decide and document whether `opts.when` is relative or absolute.
- Align `audio.playSample()`, `audio.play()`, transport tests, and callers.

## Suggested Fix Order

1. Fix `pads.js` trainer runtime crashes and lifecycle:
   - remove `diffIsOk`
   - use shared `judge()` with `offset()`
   - auto-mark passed notes as misses
   - make count-in scheduler-owned and cancellable
   - start transport once after count-in
   - make trainer state coherent

2. Fix pad free-play basics:
   - keep bilingual labels after kit load
   - add accessible names
   - release active lights by `pointerId` lookup
   - add `rotateGuard(root)`

3. Decide trainer grid layout:
   - full 4x4 grid under track, or documented 4-pad trainer grid amendment

4. Re-enable manifest entry:
   - add `pads` with `music: true`
   - remove stale comment
   - verify Music tab shows Drum Pads

5. Run:

```sh
node --test scripts\pad-charts.test.mjs
node --test scripts\music-transport.test.mjs scripts\music-calibration.test.mjs scripts\music-audio.test.mjs
node scripts\check.mjs
```

6. Browser/tablet verification:
   - 1024x768 landscape: no scroll
   - portrait: rotate prompt
   - cold offline load: kit plays
   - four simultaneous free-play pads: all fire and light independently
   - press, drag off, release: light clears
   - background mid-hit: no stuck lights/sounds
   - trainer: count-in first, then backing
   - trainer: do nothing for a note; it counts as miss and exercise still finishes
   - trainer: late tap does not crash
   - trainer: score reaches normal host flow once via `ctx.finish({ score })`

7. Fix synth live knob updates:
   - at minimum cutoff and resonance should affect held notes
   - verify by holding a chord and sweeping cutoff

## Acceptance Checklist For Pads

Free play:

- [ ] `pads` appears in Music tab
- [ ] Not shown in Games grid
- [ ] Opens through `SQLoadGame()` / `runRegistered()`
- [ ] `stop()` empties mount and leaves no live timers/voices
- [ ] 12 kit sounds load from `assets/audio/mpc/kit.json`
- [ ] Pads are inert before kit load
- [ ] Failed sample would render dimmed, not fake-playable
- [ ] Every pad has visible English + Traditional Chinese label
- [ ] Every pad has an accessible name
- [ ] Uses `pointerdown`, not `click`
- [ ] Multi-touch works
- [ ] Release/cancel uses `pointerId`
- [ ] No stuck lights after slide-off, cancel, background, or stop
- [ ] Landscape has no scroll
- [ ] Portrait shows rotate prompt

Trainer:

- [ ] Practice mode opens inside `pads`
- [ ] Six exercises render from `pad-charts.js`
- [ ] Exercise names are bilingual
- [ ] Four horizontal lanes render right-to-left
- [ ] Hit line is near the left edge
- [ ] Lane colors match target pads
- [ ] Four-click count-in happens before exercise/backing starts
- [ ] Backing layer is previous exercise chain only
- [ ] Kid target notes are not auto-played
- [ ] Taps use shared `judge()`
- [ ] Judging uses saved/fallback latency `offset()`
- [ ] Untapped notes become misses
- [ ] Exercise always finishes
- [ ] Feedback remains warm
- [ ] Exactly one `ctx.finish({ score })` at exercise end
- [ ] No direct progress writes
- [ ] No stars counter writes

## Important Constraints To Preserve

- Do not add Tone.js or another music dependency.
- Do not create another `AudioContext`.
- Do not convert classic host scripts to modules.
- Do not make Music category-locked unless Papa decides practicing instruments is screen time.
- Do not add recording, looping, patch saving, pad banks, velocity, or unlock gates while fixing v1 bugs.
- Do not touch unrelated solar/books changes while fixing Music Room.

## Notes For The Next Agent

The current implementation looks like it moved quickly from slice 37 into slice 40. That is fine, but the trainer needs a small hardening pass before the manifest entry is turned on. The safest path is to make `pads.js` boring and explicit:

- one state object
- one scheduler
- one count-in handle
- one transport start
- one judge path
- one finish path

Do not trust the green project check as evidence that the pads work; it is a syntax/integration gate, not a browser interaction test.

After fixes, rerun the full gate and capture a real browser/tablet proof for 1024x768 landscape. That is the viewport Papa used for the latest layout verification.
