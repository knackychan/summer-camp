# Slice 37 — MPC pads, free play

**Goal:** A 4×4 pad grid a kid can drum on with four fingers at once, offline. The first slice the kids can actually use.

**Architecture:** A registry-native game (`js/games/pads.js`) using the game-platform `ctx` contract unchanged. It is a **DOM** instrument: it ignores `ctx.stage` and appends its own grid to `ctx.mount`. Sound comes from slice 35's `playSample`; samples from slice 36's kit. No transport, no scheduling, no charts — this slice is only "finger goes down, sound comes out, correct pad lights up". The trainer arrives in slice 40 as a mode inside this same file.

**Design:** `docs/plans/2026-07-28-music-room/design.md` §1 (D1, D11, D13), §4.

**Depends on:** slices 35 (sample playback) and 36 (the kit).

**DONE WHEN:**
- Tile appears in the games grid and opens.
- **Four simultaneous fingers** fire four different pads, each lighting and releasing independently.
- No stuck lights after any combination of multi-touch release, drag-off, or backgrounding the tab.
- Works with wifi off, cold.
- `stop()` leaves zero live timers and zero live voices.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **`pointerdown`, never `click`.** Click adds tap latency that would swamp everything slice 38 exists to measure.
2. **`touch-action: none`** on the grid, plus `user-select: none`. Without it Android will scroll, long-press-select, and double-tap-zoom the instrument out from under the kid.
2a. **Full width, one screen, no scrolling** (design.md D13). The grid fills the tablet in landscape and is fully contained. A pad that shifts under a finger mid-hit is worse than a pad that is slightly small — where it does not fit, it shrinks.
3. **Track `pointerId`.** One `activePointers` map, id → pad. Multi-touch is the entire point of this game; a single `isDown` boolean fails the DONE WHEN on the first two-handed groove.
4. **Semantic controls.** Each pad has a bilingual visible label and accessible name. Pointerdown is the sound path, but keyboard/Enter activation may play a single pad for accessibility and QA; it must not affect trainer scoring until slice 40 wires judging.
5. **Free play never scores.** `bestKey: "pads"` exists because slice 40's trainer needs a ledger key. This slice must not call `ctx.finish()`.
6. **Bilingual.** Pad labels, kit name, any hint text: EN + 繁體中文.
7. **`stop()` releases everything.** Route timers through `createScheduler()`; call `audio.stopAll()`.
8. **Read nothing ambient.** Everything comes from `ctx` (`js/games/CLAUDE.md`).

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/games/pads.js` | Create | The game: grid, pointer handling, kit load, free play |
| `js/games/index.js` | Modify | Manifest entry (`bestKey: "pads"` — the trainer in slice 40 will use it) |
| `sw.js` | Modify | `APP_SHELL` += `pads.js`, `CACHE_NAME` bump |

---

## Task 1: Manifest entry

- [ ] **Step 1:** Add to `MANIFEST` in `js/games/index.js`, after `solar`, before the brain block:

```js
{ id: "pads", brain: false, keyboard: false, bestKey: "pads", legacy: false,
  meta: { icon: "🥁", title: "Drum Pads", tz: "打擊墊", blurb: "Finger drumming" } },
```

`legacy: false` and `brain: false` are both load-bearing — `main.js:23` returns `null` otherwise and the tile opens nothing. `meta` must match the game module's `meta` exactly; `check.mjs` enforces it.

- [ ] **Step 2:** Add `./js/games/pads.js` to `APP_SHELL` in `sw.js`, bump `CACHE_NAME`. Same commit — `check.mjs` fails a registry-native game missing from the shell.

---

## Task 2: The grid

**Files:** Create `js/games/pads.js`

- [ ] **Step 1: Module skeleton** in the standard game shape — `id`, `meta`, `keyboard: false`, `bestKey: "pads"`, `settings`, `init(ctx)`, `stop()`. Module-local state object `S`; no globals.

- [ ] **Step 2: Build the 4×4 grid** into `ctx.mount`. CSS grid, `aspect-ratio: 1`, sized to fit a tablet in landscape without scrolling. Each cell carries its sample name and a bilingual label. Coarse-pointer sizing: a pad is a finger target, minimum ~72px, and nothing depends on hover.

- [ ] **Step 3: Kit load.** On `init`, `audio.loadKit("mpc", manifest)` from `assets/audio/mpc/kit.json`. Show a brief bilingual loading state; pads are inert until decoded. A sample that failed to load (slice 35 skips it rather than rejecting) renders its pad visibly dimmed rather than lying about being playable.

- [ ] **Step 4: Unlock on first touch.** `audio.unlock()` on the first `pointerdown` anywhere in the game. Android will not make a sound before a user gesture, and this is the gesture.

---

## Task 3: Multi-touch

- [ ] **Step 1: `pointerdown` on each pad** → `audio.playSample("mpc", name)`, add `pointerId` to `S.active`, add the lit class.

- [ ] **Step 2: `pointerup` / `pointercancel`** → look the pad up **by `pointerId`**, not by event target. A finger that slides off the pad before lifting must still release *its* pad and nothing else.

- [ ] **Step 3: `setPointerCapture`** on the pad at `pointerdown`. This is what makes a slide-off release fire on the right element and is the difference between "works" and "occasionally leaves a pad lit forever".

- [ ] **Step 4: The one-shot rule.** A drum sample plays to its end regardless of when the finger lifts — `pointerup` releases the *light*, never the *sound*. Cutting the sample on release is a common and wrong instinct here.

- [ ] **Step 5: `ponytail:` comment for fixed velocity.** Android exposes no usable pressure. Name the ceiling and the upgrade path (y-position-within-pad, MPC-style) at the call site.

---

## Task 4: Teardown and verify

- [ ] **Step 1: `stop()`** — `sched.cancelAll()`, `audio.stopAll()`, clear `S.active`, remove listeners, empty `ctx.mount`. The kit stays cached in the audio service; that is deliberate, so reopening the game is instant.

- [ ] **Step 2:** `node scripts/check.mjs` — green.

- [ ] **Step 3: On the real tablet** — the only place these answers exist:
  - four fingers, four pads, simultaneously, repeatedly
  - press a pad, slide off, release → light clears
  - background the tab mid-hit, return → no stuck light, no stuck sound
  - airplane mode, cold reload → all twelve pads sound
  - landscape viewport contains the full 4×4 grid with no page scroll; portrait shows the rotate prompt, not a clipped instrument

---

## Notes for the implementer

No settings bar in this slice beyond a mute toggle if `ctx.settings` makes one trivial. Kit switching, velocity, and pad banks are all "add when a kid asks", not now.

If a pad feels laggy on the tablet even after slice 35's `latencyHint`, do **not** start tuning here — that is exactly what slice 38 measures, and guessing at an offset before measuring it is how this kind of feature gets quietly abandoned.
