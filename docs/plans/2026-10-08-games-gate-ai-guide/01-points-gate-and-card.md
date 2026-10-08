# Slice 01 — Points gate and the "not enough yet" card (fixed list, no AI)

**Implements:** design.md D1, D2, D3 (data file only), D4, D7 (settings read only), D12 (gate), §5.
**Depends on:** Papa's approval of design.md, with answers to Q1–Q3 (or defaults accepted). It does **not** depend on the live points rollout: the gate reads the tablet's points cache and queue.
**Ships switched off:** with no `games_gate_v1` setting, or `enabled:false`, the app behaves exactly as today.

## Changes
- **`js/home-help-data.js`** (new, `SQHomeHelp`): the 8 activities as data (id, kind, slot rule, icon, `label`, `pitch`, per-kid `goal`, `minutes`, `windows`, `verify`), `slots`, and the bilingual card `lines` pool. For now the 4 new kinds point at kinds added in slice 02. Their cards show "Ask Papa 問爸爸" and start nothing until 02 ships (`SQPoints.rules[kind]` missing ⇒ not startable).
- **`js/games-gate-core.js`** (new, `SQGamesGate`, pure):
  - `parseSettings(raw)` → defaults (`enabled:false`, thresholds 50 / 50 / 40, steps of 5, 0–300 clamp).
  - `todayPoints(kid, day, {claims, queue, manual})`: D1 formula; ignores `denied` / `started`; no double count between a queued op and its claim (same identity rule as `SyncStore.pointsFor`).
  - `state(kid, ctx)` → `{open, reason, today, threshold, need}`; `reason` ∈ `off` | `papa` (`braingate_<kid>` = today) | `reached` (incl. the D2 remembered-open day) | `points`.
  - `giftReminder(available, catalog, requests)` → `{kind:'saving'|'can'|'generic', reward, cost, need}` (design D4 rule).
- **`js/lock-core.js`**: `computeLock` accepts `pointsOpen` (default `true`). Order: `brain`, then `points`. A caller that passes nothing behaves exactly as before. The header comment records the new reason and links this plan.
- **`index.html`**:
  - `gameLockState` passes `pointsOpen` from `SQGamesGate.state`. Remembers "opened today" in `sq:gamesgate:open:<kid>` (D2).
  - `pointsLockHtml()` beside `brainLockHtml()`: bar (teal / gold, never red), today / threshold, the invite line, gift line, buttons 🧭 *Help me choose 幫我選* (opens the **fixed list** view in this slice: the 8 activities filtered by the D6 drop-rules only, not yet ranked), 📅 *My Day*, 🔧 *Papa* (existing PIN → `openGamesToday`).
  - `brainLockHtml()` gains the "Brain Gym gives 30 points too 頭腦體操也有 30 點" line when the points gate is also shut.
  - Lucien (`age ≤ 5`): icon bar + read-aloud of the line via the existing speech helper.
  - Every Games entrance already routes through `gameLockState` / `refreshLockUI` (hub tab, tiles, registry `available`, world landmarks, `startGame`). Add `.pointslocked` beside `.brainlocked` so the tab styling matches.
  - My Day screen blocks show the §5 indicator (🔓 / 🏡 N / M).
- **`scripts/check.mjs`** guards:
  - `SQHomeHelp`: every item has `[en, zh]` for `label`, `pitch` and each kid's `goal`; ids unique; `windows` parse; the 4 existing kinds resolve in `SQPoints.rules`.
  - `SQLock.computeLock({})` still opens. `{brainOpen:false, pointsOpen:false}` returns `brain`. `{pointsOpen:false}` returns `points`.
  - `SQGamesGate` unit cases: pending counts, denied doesn't, a queued op and its claim count once, a threshold of 0 opens, `enabled:false` opens, a Papa open-today opens, a remembered open survives a declined claim.
  - The lock card markup contains no `red` / `#f00` / "late" wording (existing coach-not-cop scan, extended to the new card).
- **`scripts/games-gate.test.mjs`** (new; wired into `check.mjs`): the unit cases above under Node.

## Not in this slice
Ranking, questions, reroll, saved decisions, admin UI, AI, new award kinds.

**DONE WHEN:** `node scripts/check.mjs` green. With `games_gate_v1` absent, a browser run shows no change on the Games tab and in a Brain Gym-locked day. With `{"enabled":true,"threshold":{"lili":50}}` set by hand in `family_settings` (or the local settings cache), Lili at 35 points sees the card with "15 more" and the gift line from the current catalog. Finishing a table job and Brain Gym (≥ 50) opens Games without a reload. Papa's PIN opens Games for today. Wifi off: the same card and the same open/closed result from cached points. `scripts/check-android8-ui.py` with Chrome 138 passes. Papa looks at the card at 1024 × 600.

## Build notes (2026-10-08)

**Status:** built and checked in the browser, waiting on Papa's look on a tablet. Nothing changes for the kids until `games_gate_v1` has `enabled: true`. The admin switch for it comes in slice 03; until then it can only be set by hand.

- **Where the card shows:** Games tiles are disabled while a lock is on, so the kid mostly meets the card **on the Games tab**: the full card in place of the old one-line banner, with the same body as the overlay. The overlay is still used by `startGame` and by the eviction tick. Buttons use `data-gg`, not ids, because the tab card and the overlay can be on screen at the same time.
- **Practice tab** under the points gate: a one-line banner. Brain Gym tiles stay bright through the existing `.brainlocked` style. Key Hunt, Home Row and Word Wizard dim, the same as under the brain gate.
- **Gift line:** with numbers, as Papa chose. At **0 points to spend**, it names the reward instead of the zero ("🎁 'Choose dessert' is 120 points — every job gets you closer!").
- **"Help me choose"** opens the fixed list. Meals come from today's `DAY` through `SQPoints.block()`, with no hard-coded block indices. Homework goes to My Day. The four new kinds show "Coming soon — ask Papa" until slice 02.
- **Lucien** (age ≤ 5) sees 5 🧹 icons instead of the bar. The invite line is read aloud only when the overlay opens, and only if TTS is on.
- **My Day** screen blocks add `🎮 Games open` or `🏡 N / M` next to the existing earned-screen flag. The Brain Gym result card says "Brain Gym done! N more points for games" instead of "All games unlocked" while the points gate is still shut.
- **Deviation: guards live in `scripts/games-gate.test.mjs`, not inline in `check.mjs`.** `check.mjs` runs every `scripts/*.test.mjs`, and another session was editing `check.mjs` at the same time. The test covers lock order, settings clamping, today's points (pending counts, denied and started don't, a queued op and its claim count once), gate states, gift choice, bilingual completeness of all `SQHomeHelp` strings, the existing kinds resolving to real awards and quests, windows and meal slots, and no red in the card.
- **Deviation: no `pitch` field.** The kid's `goal` line already does that job. Slice 06's AI writes its own line.
- **Known gap:** Papa's manual awards (`stars_ledger` admin rows) don't count toward today on the tablet, because the tablet doesn't load ledger rows. `todayPoints` accepts `manual` rows for when that's added. Until then, Papa uses **Open games today**.

**Checks run:**
- `node scripts/check.mjs`: green, after `npm run build:android-web` refreshed the payload the bundle test compares against.
- New `scripts/check-games-gate-ui.py` on Chrome 138 at 1024 × 600: passed. It covers gate off/on, the card with today / threshold and the gift line, the chooser at 12:10 (4 ready + 4 "soon", unready last, table = lunch slot), tapping Table opening Table Helper, pending points counting, reaching 50 opening Games, a later decline not re-closing it, Brain Gym first with the "30 points too" line, Brain Gym tiles open under the points gate, Papa's open-today, and Lucien's broom bar plus the rest line at 21:30.
- `scripts/check-android8-ui.py` with Chrome 138: **fails at the Code Quest Lab step** ("Cannot read properties of null (reading 'lab')"). The same failure happens on a clean `HEAD` checkout without this slice, so it isn't caused by this work.
