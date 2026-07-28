# Slice 35 — Audio service: sample kits, interactive latency, voice cap

**Goal:** Teach the shared audio service to load and fire sample buffers, ask the platform for low latency, expose the shared graph for synthesized voices, and hold more than four voices when a music game is active — without changing one audible thing about Brain Gym.

**Architecture:** `js/game-services/audio.js` already owns the app's single `AudioContext` (design.md D3). This slice extends it; it does not fork it. Every change is **additive with unchanged defaults**, because nineteen games and the whole Brain Gym cue system share this file. The music-specific logic (transport, judging, calibration) does **not** live here — it goes in `js/game-services/music.js` in slices 38–39. This file gains exactly five capabilities: decode/cache sample kits, fire a buffer, expose the audio clock, expose the shared Web Audio graph for synthesized voices, and let a running music game raise then restore the voice cap.

**Tech Stack:** ES module, Web Audio API, `node:test`.

**Design:** `docs/plans/2026-07-28-music-room/design.md` §1 (D3, D6), §3.

**Depends on:** nothing. Lands before every other music slice.

**DONE WHEN:**
- `node --test scripts/music-audio.test.mjs` passes.
- `node scripts/check.mjs` passes.
- Brain Gym cues sound **identical** — same voice-stealing behaviour, same cue rendering. Verified by test and by ear on one Brain round.
- A decoded buffer plays through the shared master gain, respects mute, and stops on `stopAll()`.
- Piano/Moog can obtain the shared `{ctx, master}` through `graph()` without creating a second `AudioContext`.

---

## Constraints you must not violate

1. **Additive only.** No existing exported name changes signature. `getSharedAudio()` called with no deps must behave exactly as it does today, including the 4-voice cap.
2. **One context, still.** Do not construct a second `AudioContext` anywhere. `ensureContext()` stays the only construction site.
3. **Mute is global.** Samples obey the same `muted` flag as cues. A muted app makes no drum sound.
4. **The singleton may already exist.** Brain Gym can create the shared audio service before any music game opens, so `getSharedAudio({maxVoices: 24})` is not enough. Add `setMaxVoices(n)` and use it from music game `init()` / `stop()`.
5. **No music logic here.** No BPM, no scheduling, no judging. If it knows what a beat is, it belongs in `music.js`.
6. Avoid `?.` / `??` / `.flatMap` — the `check.mjs` scan is stale but still runs (design.md §6).

---

## File Structure

| File | Change | Responsibility after this slice |
|---|---|---|
| `js/game-services/audio.js` | Modify | + `latencyHint`, `loadKit()`, `playSample()`, `clock()`, `graph()`, `setMaxVoices()` |
| `scripts/music-audio.test.mjs` | Create | Stub-context tests: decode caching, cap behaviour, mute, no-regression on cues |
| `sw.js` | Modify | `CACHE_NAME` bump (`audio.js` is already in `APP_SHELL`) |

---

## Task 1: Write the failing tests

**Files:** Create `scripts/music-audio.test.mjs`

A stub `AudioContext` is needed — node has no Web Audio. Model only what the service touches: `createGain`, `createBufferSource`, `decodeAudioData`, `currentTime`, `state`, `resume`, `destination`, `close`. Record calls so the tests can assert on them.

- [ ] **Step 1: Stub context + install it on `globalThis.window`** before importing the service.
- [ ] **Step 2: Default cap is still 4.** `getSharedAudio()` with no deps; fire six cues; assert the oldest non-speech voices were stolen exactly as today. This is the regression guard for Brain Gym.
- [ ] **Step 3: Cap is configurable after singleton creation.** Create the service with no deps, then call `setMaxVoices(24)`; fire twenty voices; assert none were stolen. Assert `setMaxVoices()` returns the previous cap, then restore that previous value and assert the old Brain cap is back.
- [ ] **Step 4: `graph()` returns the shared context and master.** No second `AudioContext` is created; synthesized voices have a sanctioned destination.
- [ ] **Step 5: `loadKit` decodes once and caches.** Call twice with the same manifest; assert `decodeAudioData` ran once per sample, and the second call resolves from cache.
- [ ] **Step 6: `loadKit` survives a missing file.** One bad URL must not reject the whole kit — the other samples still load and the bad name is simply absent.
- [ ] **Step 7: `playSample` respects mute and unlock.** Muted ⇒ no `BufferSource` created. Not yet unlocked ⇒ no sound. Unknown sample name ⇒ no throw.
- [ ] **Step 8: `stopAll()` stops live sample voices.**

Run it. Every test must fail for the right reason before Task 2.

---

## Task 2: Extend the service

**Files:** Modify `js/game-services/audio.js`

- [ ] **Step 1: Interactive latency hint.** In `ensureContext()`, construct with `new Ctor({ latencyHint: "interactive" })`. This is the single cheapest latency win available and it costs one argument. Keep a `try`/`catch` fallback to `new Ctor()` — the option is ignored on some builds and throws on a few old ones.

- [ ] **Step 2: Runtime voice cap.** `makeRoom()` currently hardcodes `if (active.length < 4) return;`. Replace that with module-local `maxVoices`, defaulting to 4. Expose `setMaxVoices(n)` and a `maxVoices` getter; `setMaxVoices()` returns the previous cap so a game can restore it in `stop()`. Music games set 24 on `init()` and restore the previous cap on `stop()`; otherwise Brain Gym after a music visit would quietly change behaviour.

- [ ] **Step 3: `loadKit(kitName, manifest)`** where `manifest` is `{ sampleName: url }`. Returns a promise resolving to the kit. `fetch` → `arrayBuffer` → `decodeAudioData`, stored in a module-level `Map` keyed by kit name so a second visit to the game is instant. A failed sample logs and is skipped; it never rejects the kit (offline-first: a partial kit still makes music, a rejected promise makes a black screen).

- [ ] **Step 4: `playSample(kitName, sampleName, opts)`** with `opts = {when, gain}`. Guard on `muted` / `!unlocked` / unknown name, exactly as `play()` does. Build `BufferSource → Gain → master`, `start(when || 0)`, register in `active` with `isSpeech: false` so the existing sweep and steal logic manages it, and return a `{stop}` handle matching `play()`'s shape.
  `when` is an **absolute `currentTime` value**, not a delay — the transport in slice 39 schedules ahead and needs the precise form.

- [ ] **Step 5: `clock()`** returning `{ now, outputLatency, sampleRate }`, reading the service-owned AudioContext's `currentTime`, `(outputLatency || 0) + (baseLatency || 0)`, and `sampleRate`. Returns zeroes when no context exists yet.

- [ ] **Step 6: `graph()`** returning `{ ctx, master }` after `ensureContext()`. This is how piano and Moog create oscillators/filters while still using the app's one `AudioContext`; instrument code must not call `new AudioContext()`.

- [ ] **Step 7: Export the new methods** on the returned object alongside `unlock`/`play`/`stopAll`/`setMuted`/`dispose`.

---

## Task 3: Verify no regression

- [ ] **Step 1:** `node --test scripts/music-audio.test.mjs` — green.
- [ ] **Step 2:** `node scripts/check.mjs` — green.
- [ ] **Step 3:** Bump `CACHE_NAME` in `sw.js`.
- [ ] **Step 4: By ear.** Open Brain Gym, play one round, confirm the cues sound unchanged — same clicks, same coins, same voice-stealing under a fast tap burst. A test can prove the cap arithmetic; only ears prove the cue pack.

---

## Notes for the implementer

`decodeAudioData` on Android Chrome wants the promise form but some builds only honour the callback form. Use the promise, and if a sample silently never resolves on the real tablet, that is the known cause — wrap the callback form behind the same promise.

Do not be tempted to add a compressor or limiter on the master bus "while you're in here". Sixteen pads through a limiter is a different sound design decision and belongs to whoever asks for it.
