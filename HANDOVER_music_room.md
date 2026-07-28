# Handover — Music Room (slices 35–43)

Paste the block below into a fresh agent session. It is written to be self-contained: it names the
binding documents, the order, the gate, and the specific mistakes this feature invites.

---

## The prompt

> You are implementing the **Music Room** feature in the Summer Quest repo — three tablet instruments
> (MPC-style drum pads, piano, Moog-style synth) plus a finger-drumming trainer and a piano practice
> mode, for three kids at a family summer camp.
>
> ### Read first, in this order
> 1. `CLAUDE.md` — project non-negotiables. These override anything you would otherwise prefer.
> 2. `js/CLAUDE.md` — the classic-script ↔ ES-module boundary. Cross it with injection, never by
>    converting a classic file to ESM.
> 3. `js/games/CLAUDE.md` — the game contract: `ctx` injection, `stop()` teardown, the three kinds of
>    file allowed in that folder.
> 4. `docs/plans/2026-07-28-music-room/design.md` — **this binds.** Decisions D1–D14 are Papa's and are
>    not yours to relitigate. §3 is the architecture, §6 the constraints that bite.
> 5. The slice file you are about to build, `35-…` through `43-…` in that same folder. Each carries its
>    own dependencies, constraints, task list and DONE WHEN.
> 6. `docs/plans/2026-07-28-music-room/design-preview.html` — **illustrates, does not bind.** Open it to
>    understand the layouts (right-to-left trainer, full-screen instruments, the scope). Do not copy its
>    code into the app: it has an external font import and a five-tab preview nav that must not ship.
>
> ### Build order — one slice at a time
> ```
> 35 audio service ──┬── 37 pads free play ── 40 trainer
>                    │        ▲                  ▲
>                    ├── 36 kit assets ──────────┘
>                    ├── 38 calibration ── 39 transport ─┘
>                    └── 41 piano ── 42 practice
>                            └────── 43 moog
> ```
> 35 and 36 are independent and can be done in either order. 38 **must** precede 39. 41 must precede 43
> (shared keybed). A slice is finished only when its own DONE WHEN block passes — not when the code
> looks right.
>
> ### The gate — do not skip this
> Slice 38 measures this tablet's real touch-to-sound latency. **If it comes back above ~250ms, stop and
> report it before starting slice 39.** That result would mean the hardware cannot do rhythm games in a
> browser, and the honest answer is to say so rather than ship a trainer that punishes kids for their
> tablet. Record the measured number either way; it is the most important fact this project will learn.
>
> ### Non-negotiables you will be tempted to break
> - **Bilingual.** Every kid-facing string ships EN + 繁體中文 (Taiwan usage). Note names, exercise
>   titles, judge words, knob labels, error text. A kid-facing string without 中文 is a bug and
>   `check.mjs` will fail you.
> - **`pointerdown`, never `click`.** Tap latency is the entire feature. `click` adds delay that swamps
>   the calibration slice 38 exists to earn.
> - **Offline-first.** Every new `js/` file and every audio sample joins `APP_SHELL` in `sw.js` with a
>   `CACHE_NAME` bump, **in the same commit**. `check.mjs` fails a registry-native game missing from the
>   shell. This is enforced, not remembered.
> - **One `AudioContext`.** Never `new AudioContext()` in an instrument. Get the shared graph through
>   `audio.graph()` (added in slice 35). Android charges real memory per context and one unlock gesture
>   must cover every instrument.
> - **`stop()` releases everything.** Route every timer, loop and animation through `createScheduler()`
>   from `js/game-services/scheduler.js`; teardown becomes one `cancelAll()` plus stopping live voices.
>   Music games also restore the voice cap to 4 on `stop()`.
> - **Coach, not cop.** A missed note is "almost! 差一點！" — never a red X, never a fail screen, never a
>   life lost, never a broken streak. The exercise always finishes. Project-wide rule.
> - **Stars are a ledger.** Score reaches the app only through `ctx.finish({score})`. Never write
>   `progress[kid]`, never call `saveProgress()`.
> - **Read nothing ambient.** Everything a game touches arrives in `ctx`.
> - **`node scripts/check.mjs` after every edit.** Red ⇒ do not commit.
>
> ### Things you will want to add. Don't.
> The plan is deliberately lazy and each omission is a decision, not an oversight:
> - No audio library. Tone.js is ~200KB for a transport that is ~40 lines of lookahead `setInterval`.
>   No knob library — a knob is a pointer-drag delta.
> - No mic, no pitch detection, no WebMIDI, no band mode, no clock sync, no networked anything (D2).
>   Piano practice is screen + metronome; nothing listens. Do not build toward any of it.
> - Do not build instrument voices on `js/brain-audio-cues.js` (D7). It is fixed-duration, gateless, and
>   its own header says it gets deleted.
> - Do not touch `js/drills.js` (D10). It is the away-from-tablet routine; slice 42 is the on-screen one.
> - No streaks, no combo multipliers, no unlock gates between tiers, no difficulty settings, no sustain
>   pedal, no LFO, no patch saving, no recording. Each is named in a slice's "Notes for the implementer"
>   with the reason and the condition under which it earns its way in.
> - Do not fix, tune or improve an unrelated game while you are in a shared file. Write it down, leave it.
>
> ### Where the honest answers live
> Unit tests prove the arithmetic; they cannot prove an instrument. These need the **real Android tablet
> in landscape**, and every slice's DONE WHEN says so:
> four simultaneous fingers on four pads · a five-note chord that releases cleanly · no stuck notes after
> backgrounding the tab · calibration stable across three runs · a knob turning while three keys are held
> · airplane-mode cold load · nothing scrolling off-screen.
>
> ### Working style
> Small conventional commits, one per slice or smaller — never one commit for the whole feature. Mark
> deliberate shortcuts with a `ponytail:` comment naming the ceiling and the upgrade path (§7 lists the
> four already agreed). If you hit something the plan gets wrong, say so and propose the amendment —
> plans are amended, not silently obeyed or silently ignored. Ask before deviating from a Papa decision.
>
> Start with slice 35. Report the DONE WHEN results for each slice before moving to the next.

---

## Notes for whoever hands this off

**Two slices are not code.** Slice 36 is sourcing CC0 samples with provenance — an agent without web
access cannot finish it, and its fallback (synthesizing the twelve one-shots) is a sound-design change
that needs Papa's call first. Slice 38's DONE WHEN needs a human tapping a real tablet.

**Slice 35 is the blast radius.** It modifies `js/game-services/audio.js`, which Brain Gym and nineteen
games share. Its changes are additive with unchanged defaults, and it ships with
`scripts/music-audio.test.mjs` plus a by-ear Brain Gym regression check. If a reviewer only reads one
diff, read that one.

**The plan is sliced so it can stop early and still be worth it.** Slice 37 alone gives the kids a
working drum machine. If latency measures badly at slice 38, everything from 41 onward (piano, practice,
synth) is unaffected — only the trainer depends on timing being good enough.

**Related:** `docs/plans/2026-07-28-music-room/` is registered in `CLAUDE.md`'s pending-plans list.
Numbering continues the global sequence; solar-system took 30–34.
