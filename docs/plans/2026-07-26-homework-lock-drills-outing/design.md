# Design — Homework Block, Activity Lock, Outing Mode, Practice Drills

**Date:** 2026-07-26
**Status:** approved by Papa (brainstorm session, Claude Code)
**Extends:** `docs/SPEC.md` (v2). Where this document and the SPEC disagree, this document wins for the four features below; everything else in the SPEC stands.

## Context

Summer Quest is mid-implementation (P0 largely done: SyncStore, local fallback, day assistance). This design adds four features agreed in brainstorm. They are sliced into independent plans (`01`–`04` in this folder) ordered by when they can ship relative to the SPEC tiers.

Decisions recorded here were confirmed explicitly by Papa; implementers should not re-litigate them.

## 1. Homework block (slice 01)

- One **fixed morning block**, same slot for all 3 kids, **replacing** an existing morning block. Day progress stays `x/16`; no day-complete logic changes.
- Content differs per kid: Luis (9) and Lili (7) get summer homework 暑假作業; Lucien (4) gets quiet work (coloring / tracing / puzzle) so all tablets show the same schedule shape.
- Tick = done, earns a star like any other block. Bilingual labels required (e.g. "Homework time 寫作業時間").
- This is a **DAY-data-only** change plus optional guide steps. It can ship immediately, independent of tiers.
- Open at implementation time: *which* morning block is replaced and the exact time. Implementer proposes from current DAY data; Papa confirms.

## 2. Activity-time lock — hybrid (slice 02)

**Stance change:** the CLAUDE.md non-negotiable "no screen-time enforcement (indicate only)" is amended by Papa's decision: **games are blocked during scheduled activity blocks**. Everything else remains indicate-only, and the coach-not-cop tone stands (the lock invites, never shames).

- **What locks:** games only. My Day, activity guides, Learn tab, and the ask channel stay open — kids may need the guide *during* the activity.
- **When:** whenever the live timeline says a non-screen activity block is current and not yet ticked. Computed client-side from the existing timeline logic; no new tables.
- **Lock screen:** friendly overlay on the games area — current block name, bilingual invite ("It's Sport time! 運動時間到了！ Games are resting 遊戲休息中"), shortcut to the block's guide. No red, no countdown, no shame copy.
- **Unlock paths:**
  1. Kid ticks the current block done (already did the activity).
  2. An approved **Excused or Golden pass** on that block (SPEC P2 lifecycle).
  3. **Papa PIN override** on the tablet: instant unlock for the current block, works offline. 4-digit admin PIN, plaintext at the same trust level as kid PINs; stored in admin Settings, synced and cached in `localStorage` so it works with wifi off.
- Screen blocks keep their existing 🔓/🔒 earned-status logic; free blocks stay free.

## 3. Outing mode (slice 03)

Covers "we were out all morning" — visit, walk, trip. Kid is not at fault; amber "you can still start!" is the wrong message and the lock must not fire.

- Papa toggles **outing mode** over a block range (e.g. all morning blocks) from admin, or on a tablet via the PIN override.
- Affected blocks render an 🚶 outing state (bilingual, e.g. "Family outing 家庭出遊").
- **Stars:** Papa picks per outing at toggle time — **credited** (each block earns its star; a walk is a real activity; this is the default) or **excused** (no star, like a sick pass). Day-complete stays reachable either way.
- Lock is suspended for outing blocks. Implementation rides on the P2 pass lifecycle (an outing is effectively a bulk pass over a range).

## 4. Practice drills — dance & piano (slice 04, future)

Lili takes ballet; there is a piano in the kids' room. Guided practice mode, reusing existing infrastructure (ACT_GUIDE-style bilingual steps, Web Speech announcements, date-seeded rotation, stars ledger, proofs bucket).

- A drill = ordered list of `[en, zh]` steps (e.g. "Plié ×10 蹲步十次", "C scale ×5 C大調音階五次").
- **Kid-paced: no per-step timers.** Papa's explicit call — timers stress the kids and make them rush past content. Kid taps "next"; the app speaks each step aloud bilingually.
- Optional **metronome** button on piano steps (Web Audio oscillator, no dependency).
- Drills rotate date-seeded like mission pools. Per-kid assignment (Lili: ballet + piano; others as Papa decides) — configurable, not hardcoded.
- Completing a session ticks the practice block and earns a star through the ledger. Photo/video proof via the existing `proofs` bucket is a later option, not in scope for the first version.
- Drill content starts client-side and seeded (P0 style); admin editing of drill lists comes later with its own table.
- **Priority: after P2**, alongside P3 work.

## Ship order

| Slice | Feature | Depends on | When |
|-------|---------|-----------|------|
| 01 | Homework block | nothing (DAY data) | now |
| 02 | Activity lock + PIN override | P0 live timeline | after P0 |
| 03 | Outing mode | P2 pass lifecycle | with/after P2 |
| 04 | Practice drills | nothing hard; effort-gated | P3 era |

## Non-goals

- No per-minute tracking, no punishments, no red-for-late (unchanged).
- No pitch detection / audio grading for piano. No video analysis for dance.
- No lock on Learn tab, guides, My Day, or ask channel — ever.
