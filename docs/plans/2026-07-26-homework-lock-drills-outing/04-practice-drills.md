# Slice 04 — Practice drills (dance & piano)

**Depends on:** nothing hard; scheduled for the P3 era. Reuses existing machinery only.
**Design:** see `design.md` §4.

## Goal

Guided, kid-paced practice sessions for ballet (Lili) and piano. No timers — Papa's explicit decision; per-step timers stress the kids and make them rush.

## Changes

1. **Drill data (client-side, seeded):** drill = ordered `[en, zh]` step list, e.g. ballet "Plié ×10 蹲步十次", piano "C scale ×5 C大調音階五次". Several drills per discipline; rotation date-seeded exactly like mission pools. Per-kid discipline assignment in data (Lili: ballet + piano; others as Papa decides) — configurable, not hardcoded.
2. **Practice session UI:** one step at a time, big "Next 下一步" button (kid-paced), progress dots. Each step spoken aloud bilingually via the existing Web Speech helper. No countdowns, no per-step clocks anywhere in the UI.
3. **Metronome:** toggle button shown on piano steps only. Web Audio oscillator click, adjustable BPM presets (60/80/100). ~20 lines, no dependency, works offline.
4. **Completion:** finishing the last step ticks the practice block and awards its star through `stars_ledger` (reason "practice 練習"). Session is repeatable; star granted once per block per day (existing tick semantics).
5. **Schedule hookup:** practice appears as a DAY block (like any other); the drill UI opens from that block. Slice 02 lock treats it as a normal activity block.
6. **Later, out of scope now:** admin-editable drill lists (own table), photo/video proof via `proofs` bucket, streaks.

## DONE WHEN

- Lili's tablet on a practice block opens ballet drills; steps advance only on tap; each step is spoken EN + 中文.
- Piano steps show the metronome; it clicks at the chosen BPM offline.
- Finishing a session ticks the block and lands a ledger star.
- Rotation: different drill set on different dates, identical across devices for the same date (seeded).
- No timer appears anywhere in the practice flow.
- `node scripts/check.mjs` green.
