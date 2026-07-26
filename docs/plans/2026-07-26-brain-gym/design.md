# Design — Brain Gym (Dr Kawashima–style daily training)

**Date:** 2026-07-26
**Status:** approved by Papa (brainstorm session, Claude Code)
**Extends:** `docs/SPEC.md` and `docs/plans/2026-07-26-homework-lock-drills-outing/design.md`. Where this document disagrees with either, this document wins for the Brain Gym feature; everything else stands.
**Slices:** `09-brain-core.md`, `10-brain-games.md`, `11-brain-gate.md` (numbering continues the global sequence; slices 01–08 live in the homework-lock-drills-outing folder).

## Context

Papa asked for Brain Age (Dr Kawashima, Nintendo DS) style exercises: short daily arithmetic, memory and attention drills. Beyond adding games, this changes the shape of the games tab: **a daily set of three brain exercises becomes a mandatory door to all other games.**

Decisions recorded here were confirmed explicitly by Papa in the 2026-07-26 brainstorm; implementers should not re-litigate them.

## 1. Papa's decisions (verbatim intent)

| # | Decision |
|---|---|
| D1 | Brain games are **entries in the existing games grid** (`LEVELS`), not a new hub tab. |
| D2 | **Daily 3 mandatory:** before any other game opens, the kid completes three brain exercises. |
| D3 | Difficulty is **automatic per kid**, with an **admin override** Papa can set. |
| D4 | Lucien (4) gets the **easiest tier**, built for a four-year-old. |
| D5 | The daily 3 is a **seeded rotation** from the full pool, not a fixed set, not free choice. |
| D6 | **Clock is a property of the difficulty tier.** Count-up timer on the higher tiers; Lucien's tier shows no clock at all. |
| D7 | Completing the set earns **⭐1**; replays afterwards record best scores but earn nothing. |
| D8 | Gate bypasses: **Papa PIN on the tablet** and a **granted golden/excused pass**. Outing mode does *not* clear it. |
| D9 | When several locks apply, the kid sees **one card naming whichever blocks first**, not a checklist. |
| D10 | Launch pool is **9 games**; ship in **3 slices** (engine → games → gate). |

## 2. Stance note — third exception to "indicate, never enforce"

CLAUDE.md's non-negotiable is "screen-time is indicated, not enforced", already amended twice by Papa (activity-time lock; app pause). The daily-3 gate is a **third Papa-approved exception**: games stay closed until the brain set is done.

The limits of the exception are unchanged and absolute: the gate holds back **games only**. My Day, activity guides, the Learn tab, the ask channel, and the brain games themselves are never gated. Tone stays coach-not-cop — the gate card invites ("Brain Gym first! about 3 minutes"), never shames, never counts down, never turns red.

## 3. Module architecture

Follows the §6 rule from the previous design: data in one place, behaviour in small dependency-injected modules, UI in the page that owns it.

| Module | Owns | Used by |
|---|---|---|
| `js/brain-data.js` (`SQBrainData`) | the 9 games — id, icon, bilingual title, skill tag, pad type, per-tier item generators, per-tier config. Pure data + pure functions, `module.exports` for tests/check | brain-core, brain-ui, check.mjs |
| `js/brain-core.js` (`SQBrainCore`) | pure logic: `tierFor`, `eligibleGames`, `dailyThree`, `scoreRound`, `gateState`. No DOM, no globals, node-testable | index.html, lock-core, tests |
| `js/brain-ui.js` (`SQBrain`) | the round overlay: prompt renderers, four answer pads, count-up clock, result card. Injected deps (`say`, `onFinish`) exactly like `drills.js` | index.html |
| `js/lock-core.js` (existing) | gains the brain-gate reason; `computeLock` returns `{locked, reason, blockIdx}` | index.html, tests |
| `js/sync.js` (existing) | `brainDone` + `setting` ops, hydration of `brain_done`; best-stat keys recognised by prefix instead of a hardcoded list | index.html |
| `scripts/core.test.mjs` (existing) | tests for `dailyThree` determinism, tier resolution, gate transitions, scoring | /check |

`index.html` keeps: the `LEVELS` entries, the lock card, and thin wrappers feeding globals into the modules.

## 4. The nine games

One row = one entry in `brain-data.js`. `pad` is the answer widget; the prompt renderer varies per game.

| # | id | Game | Skill | Pad | tot (Lucien 4) | mid (Lili 7) | hard (Luis 9) |
|---|---|---|---|---|---|---|---|
| 1 | `calc` | ➕ Calculations 計算 | math | keypad / choice | count 🍎🍎+🍎, sums ≤5, 4 choices | ± within 20, keypad | ± × within 100, 2-digit |
| 2 | `signs` | ❓ Sign Finder 找符號 | math | choice | `2 ? 1 = 3`, + − only | + − × | + − × ÷, 2-digit |
| 3 | `lowhigh` | 🔢 Low to High 由小到大 | memory | grid | 3 numbers 1–5, long flash | 5 numbers 1–20 | 7 numbers 1–50 |
| 4 | `stroop` | 🎨 Color Words 顏色字 | attention | choice | pure colour naming, no word conflict | EN colour words, ink ≠ word | mixed EN/中文 words |
| 5 | `crunch` | 🔍 Number Cruncher 數一數 | attention | choice / keypad | count 3–6 animals | count a digit among 30 | among 60 + distractors |
| 6 | `clock` | 🕐 Time Lapse 時鐘 | logic | choice | o'clock only | read to 5 min | "what time in 40 min" |
| 7 | `change` | 💱 Change Maker 找零錢 | money | choice / keypad | which coin is bigger (NT$1/5/10) | price ≤NT$50, change from 50/100 | change from NT$500, count notes |
| 8 | `wordmem` | 🧠 Word Memory 記單字 | memory | grid / type | 4 emoji flash → tap the missing one | 8 EN words 45 s → type back | 12 words 60 s → type back |
| 9 | `recall` | 🔁 Math Recall 記憶計算 | memory | choice / keypad | tap the number you saw *before* | answer the previous sum | previous sum, 2-digit |

- Game 8 reuses the existing `VOCAB` data — no new word content, and check.mjs's bilingual rule already covers it.
- Game 7 uses NT$ denominations, the money the kids actually handle.
- **A game may omit a tier.** `eligibleGames(kid)` returns only games defining that kid's tier, and `dailyThree` picks from that. If `recall`/tot turns out too abstract for a real four-year-old, deleting that one generator removes it from Lucien's rotation and nothing else breaks. This is the designed escape hatch for any tier that fails contact with the child.
- Every user-facing string ships EN + 繁體中文 (bilingual invariant). Digits and colours carry most games cheaply; games 6, 7, 8 are the content-heavy ones.

## 5. Difficulty tiers

Three tiers: `tot`, `mid`, `hard`.

- **Default by kid** — a table in `brain-data.js`: `{lucien:"tot", lili:"mid", luis:"hard"}`. Kept as data so it changes without touching logic.
- **Admin override** — `family_settings.brain_tier_<kid>`. Present and valid ⇒ wins. Absent, empty, or unrecognised ⇒ default. Papa bumps a kid up as they grow.
- **The clock rides the tier** (D6). `tot` has `clock:false` and renders no timer element whatsoever; `mid`/`hard` have `clock:true` and count up. Override a kid to `mid` and the clock appears with it — one code path, no per-kid branching anywhere.

## 6. Daily 3 and the gate

**Selection.** `dailyThree(kid, dateStr)` seeded exactly like missions and drills (`dseed("brain"+dateStr+kid)`), picking 3 distinct games from `eligibleGames(kid)`. Selection prefers three *different* skill tags before allowing a second from the same tag, so a day is never three arithmetic games. Deterministic ⇒ same trio on every tablet, no server round-trip, works with wifi off.

**Gate state.** Open when the kid has completed all three of **today's trio**. Completing a brain game outside the trio records a best score but does not advance the counter — otherwise a kid clears the gate by replaying their favourite three times.

**Free play.** All 9 brain games are always reachable, gate open or shut. They are the door; the door is never locked. The activity-time lock and redo lock (slices 03/08) also do **not** apply to brain games — otherwise the two systems can deadlock, with the activity lock hiding the only way to open the games.

**Reset.** Day rollover through the shared Asia/Taipei helper (`SQ_DAY.iso()`). Yesterday's completions never carry over.

**Bypasses (D8).** Papa PIN on the tablet, or a granted `golden`/`excused` pass dated today. Outing mode does *not* clear the gate; brain games travel fine, and the gate only holds back games.

**Precedence, one card (D9).** App pause › activity lock / redo flag › brain gate. Rationale: a pause is total; an activity lock is time-sensitive ("do it now"); the brain gate is doable at any hour. The card names only the top reason and offers its single next action.

**Copy.** `🧠 Brain Gym first! 先做頭腦體操! · 0/3 today 今天 0/3 · about 3 minutes 大約三分鐘 · [▶ Start 開始]`. No red, no countdown, no shame.

## 7. Data model

One new table, mirroring `day_ticks`:

```sql
create table if not exists brain_done (
  kid_id  text not null references kids(id),
  day     date not null,
  game_id text not null,
  score   int  not null default 0,
  ms      int,                    -- null on unclocked tiers
  created_at timestamptz default now(),
  primary key (kid_id, day, game_id)
);
```

Read-all + anon insert + admin-all RLS, added to `supabase_realtime`. Everything else rides existing tables:

- **Difficulty:** `family_settings.brain_tier_<kid>`. Admin writes it (the existing `admin settings` policy covers all keys); tablets read it (`read settings` is already public to anon).
- **PIN bypass:** `family_settings.braingate_<kid>` = the ISO date the gate was cleared for. Needs a new anon-UPDATE policy alongside the existing `kid applock clear`, restricted to `key like 'braingate_%'`.
  **Timezone caveat, to be written into the SQL comment:** Postgres `current_date` is UTC while the app's day is Asia/Taipei (UTC+8), so a strict same-day equality check would reject Taipei mornings. The policy allows a ±1 day window; correctness stays client-side. The policy's job is to stop anon writing to *other* keys, not to enforce the date.
- **Best scores:** `game_stats` keys `brain_<id>` (best score) and `brain_<id>_ms` (elapsed ms of that best run, absent on unclocked tiers). No schema change — `game_stats` is already `(kid_id, stat) → int`. The `brain_` prefix is what makes them recognisable without a list.
- **Star:** one `stars_ledger` delta `+1`, `source='app'`, reason `brain gym: <date>`. Already legal under the `kid star` policy (`source='app' and delta between 1 and 3`). The ledger has no unique constraint, so the **client** guards double-award: award only on the transition from 2 to 3 completed trio games, and only when `progress[kid].brain.starred` is false.
- **Offline mirror:** `progress[kid].brain = {d:"YYYY-MM-DD", done:{gameId:{score,ms}}, starred:false}`, same shape as `progress[kid].day`. `sync.js` gains a `brainDone` op following its existing queue pattern.

## 8. Round behaviour and tone

- A round is N tier-defined items. Score = number correct; on clocked tiers elapsed ms is the tiebreak and is stored for "your best time 你的最佳時間".
- **No fail state.** A wrong answer gives a gentle shake, shows the correct answer, and the round continues. No cutoff, no game over, no red — same as every existing game.
- Prompts are spoken bilingually through the existing Web Speech helper on `tot`. Lucien cannot read yet; an unspoken text prompt is an unplayable game for him.
- The result card shows score, comparison with best, and ⭐ when it completed the set.

## 9. Verification

`scripts/check.mjs` gains:
- bilingual completeness across all `brain-data.js` user-facing strings;
- every game defines at least one tier, and every tier id is one of `tot|mid|hard`;
- no duplicate game ids, and every id matches its `LEVELS` key;
- a `dailyThree` determinism smoke test (same kid + date ⇒ same trio, three distinct ids).

`scripts/core.test.mjs` gains node tests for `tierFor`, `eligibleGames`, `dailyThree`, `scoreRound`, and `gateState` transitions including every bypass.

## 10. Ship order

| Slice | Feature | Depends on | When |
|---|---|---|---|
| 09 | Brain core — engine, tiers, scoring, stats plumbing | slice 02 (day/time core) | first |
| 10 | Brain games — the 9-game pool + content | 09 | after 09 |
| 11 | Brain gate — daily 3, lock integration, admin override | 09, 10; slice 03 (pinpad, `family_settings`) | **last** |

The gate ships last, deliberately: never lock kids out of the games before the games that open the lock exist.

## Non-goals

- **No "brain age" number.** A score presented as an age invites exactly the sibling comparison and shame the app's tone forbids.
- No voice-input games (Voice Calculation, Word Blend, Rock-Paper-Scissors) — speech recognition breaks the offline-first rule.
- No Sudoku, Virus Buster, or other 10-minute formats — wrong shape for the block schedule.
- No leaderboard between siblings. Best scores are personal.
- No penalty, ever, for being slow. No streak-breaking, no lost stars, no red.
- No gate on My Day, guides, Learn, the ask channel, or the brain games themselves.
