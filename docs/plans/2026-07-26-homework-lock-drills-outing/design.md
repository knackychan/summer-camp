# Design — Homework Block, Activity Lock, Outing Mode, Practice Drills

**Date:** 2026-07-26
**Status:** approved by Papa (brainstorm session, Claude Code)
**Extends:** `docs/SPEC.md` (v2). Where this document and the SPEC disagree, this document wins for the four features below; everything else in the SPEC stands.

## Context

Summer Quest is mid-implementation (P0 largely done: SyncStore, local fallback, day assistance). This design adds four features agreed in brainstorm. They are sliced into independent plans (`01`–`04` in this folder) ordered by when they can ship relative to the SPEC tiers.

Decisions recorded here were confirmed explicitly by Papa; implementers should not re-litigate them.

## 1. Homework block (slice 01)

- One **fixed morning block**, same slot for all 3 kids, **replacing the 10:00 "Create & build" block** (Papa's pick, 2026-07-26). Day progress stays `x/16`; no day-complete logic changes.
- Implemented as a **mission block with a new `homework` pool** so the tick awards a star through the existing mission machinery. Content differs per kid: Luis (9) and Lili (7) get summer homework 暑假作業; Lucien (4) gets quiet work (coloring / tracing / puzzle) so all tablets show the same schedule shape.
- Single-entry mission pools hide the 🎲 reroll die (small render tweak).
- The unused `desk` mission pool stays in the data (harmless; may migrate into `project` later).
- This is a **DAY-data-only** change plus small render/announce tweaks. It can ship immediately, independent of tiers.

## 2. Activity-time lock — hybrid (slice 03)

**Stance change:** the CLAUDE.md non-negotiable "no screen-time enforcement (indicate only)" is amended by Papa's decision: **games are blocked during scheduled activity blocks**. Everything else remains indicate-only, and the coach-not-cop tone stands (the lock invites, never shames).

- **What locks:** games only. My Day, activity guides, Learn tab, and the ask channel stay open — kids may need the guide *during* the activity.
- **When:** whenever the live timeline says a non-screen activity block is current and not yet ticked. Computed client-side from the existing timeline logic; no new tables.
- **Lock screen:** friendly overlay on the games area — current block name, bilingual invite ("It's Sport time! 運動時間到了！ Games are resting 遊戲休息中"), shortcut to the block's guide. No red, no countdown, no shame copy.
- **Unlock paths:**
  1. Kid ticks the current block done (already did the activity).
  2. An approved **Excused or Golden pass** on that block (SPEC P2 lifecycle).
  3. **Papa PIN override** on the tablet: instant unlock for the current block, works offline. 4-digit admin PIN, plaintext at the same trust level as kid PINs; stored in admin Settings, synced and cached in `localStorage` so it works with wifi off.
- Screen blocks keep their existing 🔓/🔒 earned-status logic; free blocks stay free.

### Overrun handling — soft linger, no shifting (Papa's decision 2026-07-26)

The clock stays the authority: the schedule is a rhythm, not a stopwatch, and real anchors (meals, 19:00 recap) never move. When an activity runs past its slot:

- The block turns amber as today ("You can still start/finish! 還來得及！"); a late tick still counts fully and earns its star. No shifting of later blocks, ever — no per-kid drift, no announcement drift.
- **Lock persistence:** if the previous activity block is unticked, the games lock persists into the following block(s) until it is ticked — *except* when the current block is itself an activity, in which case the current activity governs the lock. The lock overlay names the unfinished block. Passes, outing mode, and the Papa PIN override clear it as usual.
- No "extend block" button, no auto-shift. Rejected for complexity and predictability loss.

## 3. Outing mode (slice 05)

Covers "we were out all morning" — visit, walk, trip. Kid is not at fault; amber "you can still start!" is the wrong message and the lock must not fire.

- Papa toggles **outing mode** over a block range (e.g. all morning blocks) from admin, or on a tablet via the PIN override.
- Affected blocks render an 🚶 outing state (bilingual, e.g. "Family outing 家庭出遊").
- **Stars:** Papa picks per outing at toggle time — **credited** (each block earns its star; a walk is a real activity; this is the default) or **excused** (no star, like a sick pass). Day-complete stays reachable either way.
- Lock is suspended for outing blocks. Implementation rides on the P2 pass lifecycle (an outing is effectively a bulk pass over a range).

## 4. Practice drills — dance & piano (slice 06, future)

Lili takes ballet; there is a piano in the kids' room. Guided practice mode, reusing existing infrastructure (ACT_GUIDE-style bilingual steps, Web Speech announcements, date-seeded rotation, stars ledger, proofs bucket).

- A drill = ordered list of `[en, zh]` steps (e.g. "Plié ×10 蹲步十次", "C scale ×5 C大調音階五次").
- **Kid-paced: no per-step timers.** Papa's explicit call — timers stress the kids and make them rush past content. Kid taps "next"; the app speaks each step aloud bilingually.
- Optional **metronome** button on piano steps (Web Audio oscillator, no dependency).
- Drills rotate date-seeded like mission pools. Per-kid assignment (Lili: ballet + piano; Luis: piano; Lucien: rhythm/movement) — configurable in data, not hardcoded in logic.
- **Slot (Papa's pick, 2026-07-26):** the 16:30 "Free — invent your own game" block **alternates date-seeded** with "Practice 練習" — both survive at half frequency, `x/16` unchanged.
- Completing a session ticks the practice block and earns a star through the ledger. Photo/video proof via the existing `proofs` bucket is a later option, not in scope for the first version.
- Drill content starts client-side and seeded (P0 style); admin editing of drill lists comes later with its own table.
- **Priority: after P2**, alongside P3 work.

## 5. Reschedule blocks (slice 04) — added 2026-07-26

Papa (or Maman's change of plans, relayed by Papa) can **move any block to a different time, today only**.

- Scope: **all kids by default, or one kid individually** (updated 2026-07-26 — e.g. Luis did homework, Lili didn't). From **admin.html and from any tablet via the Papa PIN pad** (offline-queued). Overrides reset automatically tomorrow — the base DAY plan is never edited.
- Data: `day_overrides` table `(day, block_idx, kid_id, t)` with `kid_id = 'all'` for family-wide moves; a kid-specific row **wins over** the `'all'` row for that kid. Tablets hydrate + realtime-subscribe and resolve `dayOverrides = merge(all, activeKid)` — each tablet's timeline, announcements, and lock follow its own kid's effective schedule. Caveat accepted: kid-specific moves mean tablets in the same room can announce different things.
- **Everything follows effective time**: timeline current/next, announcements, amber "still can start", screen-earned prerequisites (a block moved *after* a screen block stops being its prerequisite), the activity lock, and My Day row order (rows sort by effective time). This is why slice 02 extracts a shared time core first.
- Moved rows show a small "moved 已調整" flag. No shame states.

## 6. Module architecture (shared components — keep it clean)

Rule for all slices: **data stays in one place, behavior lives in small shared modules with injected dependencies, UI stays in the page that owns it.** No copy-pasted schedule logic between index.html and admin.html — that's how spaghetti starts.

| Module | Owns | Used by |
|--------|------|---------|
| `js/day-data.js` | the `DAY` array (single source; classic script exposing a global + `module.exports` for tests/check) | index.html, admin.html, check.mjs |
| `js/time-core.js` (`SQTime`) | pure time math: `parseMins`, `effMins`, `timedOrder`, `timelineInfo`, `neededBefore`, `displayOrder` — all take `(day, overrides, …)` args, no globals, node-testable | index.html, admin.html, lock-core, tests |
| `js/lock-core.js` (`SQLock`) | pure lock decision `computeLock({day, overrides, now, done, passOk})` → `{locked, blockIdx}` — no DOM | index.html, tests |
| `js/pinpad.js` (`SQPin`) | the 4-digit Papa PIN pad overlay (one component, one look) | lock overlay, papa-tools |
| `js/papa-tools.js` (`SQPapa`) | tablet-side Papa menu behind the PIN: unlock, reschedule, outing | index.html |
| `js/drills.js` (`SQDrills`) | drill data + seeded rotation + practice-day alternation + practice UI + metronome | index.html, check.mjs, tests |
| `scripts/core.test.mjs` | `node:test` suite over the pure modules; wired into `check.mjs` | /check |

`index.html` keeps: game code, remaining data constants (check.mjs contract), thin wrappers that feed globals (`DAY`, `dayOverrides`, `nowMins()`) into the modules. `sync.js` gains ops (`override`, `outingBlock`) and hydration for `family_settings` + `day_overrides` following its existing queue pattern.

## Ship order

| Slice | Feature | Depends on | When |
|-------|---------|-----------|------|
| 01 | Homework block | nothing (DAY data) | now |
| 02 | Day-core refactor (day-data + time-core + tests) | nothing (pure refactor) | now, before 03/04 |
| 03 | Activity lock + admin PIN + pinpad | slice 02; GPT's P2 passes landed | after P2 |
| 04 | Reschedule blocks + papa-tools | slice 02, 03 (pinpad) | after 03 |
| 05 | Outing mode | slice 03/04 (pinpad, papa-tools), P2 pass lifecycle | after 04 |
| 06 | Practice drills | slice 01 landed (schedule stable); 02 helpful | P3 era |
| 07 | Installable PWA (manifest + icons + service worker) | deployed HTTPS site; best after 02 (stable js/ list) | anytime |
| 08 | Admin controls (stars ± / send-back / app pause) | slice 03 (`family_settings`, pinpad, lock-core) | after 03 |

## 7. Installable PWA (slice 07) — added 2026-07-26

Manifest + icons + service worker so tablets install Summer Quest to the home screen (fullscreen standalone, shell loads offline). The worker is network-first, same-origin GET only: it **never** touches Supabase (sync.js's queue owns offline data) and never pins versions, so frequent deploys propagate without cache-busting. iOS gets add-to-home-screen meta tags; admin.html stays a plain browser page (YAGNI).

## 8. Admin controls — star adjust, tick verification, app pause (slice 08) — added 2026-07-26

Papa's requests (2026-07-26): adjust star counts up **or down**; review kid-ticked blocks and send unfinished ones back (block re-locks until redone); pause a kid's whole app when needed.

- **Star adjust:** the admin grants panel gains minus buttons and a signed custom amount. Every adjustment is a `stars_ledger` delta with `source='admin'` — never an edit of a total (the ledger non-negotiable stands). Negative deltas are quiet on tablets: no celebration, no shame animation.
- **Tick verification / send-back:** the overview stays a read-only glance by default. Each ticked block gets a small "↩︎ Send back 退回" action: deletes the `day_ticks` row, refunds earned stars through the ledger (−1 if it was a mission block; −2 more if the day-complete bonus had fired), and flags the block in a new `day_redos` table with an optional note. The kid's row shows an invite badge ("Papa asked: please finish this one 爸爸請你再完成 💪" — no red, no shame), and **games lock on any redo-flagged block until it is re-ticked, regardless of the clock** (extends `lock-core`). A granted pass on that block clears the lock too (Papa can always excuse instead). Re-ticking re-awards normally, so the ledger stays balanced. Redo flags expire with the day.
- **App pause:** per-kid `family_settings` key `applock_<kid>` (non-empty value = paused, value doubles as an optional reason). The paused kid's hub shows a calm full-screen overlay ("Time for a break 休息一下 😌") — no tabs, no games; siblings' profiles are untouched. Unpause: admin toggle, or Papa PIN on the tablet (clears the flag through the offline queue). Tone rule: this is Papa's pause button, not the app punishing — copy invites, never blames, and the pause is **always Papa-triggered, never automatic**.
- **Stance note:** CLAUDE.md's "no punishments / indicate-only" non-negotiable gains a second Papa-approved exception for the app pause; "guides/Learn/My Day/ask never lock" still holds for everything the *app* decides on its own — only an explicit Papa pause covers the whole app.

## Non-goals

- No per-minute tracking, no punishments, no red-for-late (unchanged).
- No pitch detection / audio grading for piano. No video analysis for dance.
- No lock on Learn tab, guides, My Day, or ask channel — ever.
