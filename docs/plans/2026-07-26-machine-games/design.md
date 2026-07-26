# Machine Games — City Drive 🏙️ + Dig Site ⛏️

**Status: approved by Papa 2026-07-26 (chat). Planning only — implementation not started.**
**Rev 2 (same day): Papa replaced the lane-gate racer with a free-roam city driving game (play-carpet style, see reference screenshot in chat).**
**Rev 3 (same day, after playtest): Papa dropped Lucien's auto-cruise — all three kids get the same ◀ ▶ + GAS controls. Lucien still plays untimed (no clock, no finish overlay); only the auto-throttle is gone.**

## What

Two new game levels in the games arena, for all three kids, with directional
controls (a first — every existing game is type-the-key):

1. **City Drive 城市開車** (`city`) — top-down free-roam car in a play-carpet
   city (canvas: roads, grass, pond, ~14 buildings). Simple arcade physics
   (gas, steer, friction; grass slows, buildings/water soft-block). Knowledge
   missions send the kid driving to places.
2. **Dig Site 挖土工地** (`dig`) — excavator on a 5×4 rock grid; d-pad moves,
   DIG button digs the rock under the excavator; task card says what to dig.
   90-second run, score = tasks completed.

Existing "Big Machines" (Lucien's typing level) is untouched.

## Decisions (Papa, 2026-07-26)

| Decision | Choice | Why |
|---|---|---|
| Concept | Free-roam city car (replaces earlier lane-gate racer idea) + Dig Site | Papa wants real navigation + physics, carpet-city feel |
| Players | All 3 kids | Difficulty derived from `KIDS[kid].age`, no settings UI |
| Controls | ◀ ▶ steer buttons (left thumb) + GAS button (right thumb); Arrow keys on laptop. **All three kids, incl. Lucien** — see rev 3 | Age-adaptive; big touch targets |
| Missions | All four: math deliveries, find-the-place vocab, letter hunt (Lucien), taxi sentences (Luis/Lili) | Papa picked all |
| Rewards | Best-score only (`best.city`, `best.dig` in `game_stats`) | No star inflation, no RLS change |

## City Drive — design

- **World**: 26×20 tile grid, 48 px tiles (1248×960 px), authored as an array
  of strings (`R` road / `G` grass / `W` water). Three horizontal + three
  vertical streets → 3×3 carpet blocks. Buildings are a data list (2×2-tile
  plots with a `door` road tile); ids match words in the existing vocab pool
  (`school`, `zoo`, `market`, `hospital`, `farm`, `park`, `castle`, `church`,
  `hotel`, `museum`, `police`) so every find-the-place mission is bilingual +
  spoken for free. Three `house` plots carry dynamic number signs for
  deliveries.
- **Physics** (arcade, per-frame dt): heading + speed; GAS accelerates to an
  age-based vmax, friction decays; steering rate scales with speed; grass
  halves vmax (rumble, never blocks); buildings/water/world edge soft-bounce
  (`v *= -0.3`). Camera follows the car, clamped to the world.
- **Missions** (age mix, one active at a time, marker 📍 pulses on the goal;
  "arrive" = near the door + nearly stopped):
  - `place` — "Drive to the **school**! 開到學校!" + `sayPair(en, fr)`. All kids;
    Lucien gets an easy subset (school/zoo/park/farm).
  - `deliver` (Lili +− ≤20, Luis +−× ≤100) — "Deliver 🍎 to house **5+7**!";
    the three houses show shuffled number signs; parking at a wrong house gets
    a friendly hint with that house's number, never a penalty.
  - `taxi` (Luis, Lili later if wanted) — pick up 🙋 at building A ("Pick up
    your passenger at the hotel!"), passenger asks in a full sentence for the
    drop-off; two-stop mission.
  - `letters` (Lucien) — three letters of an easy word placed on roads;
    drive over them **in order** to spell it; wrong letter = soft bloop only.
- **Session**: Lili/Luis = 180 s timed run, score = missions completed,
  finish overlay like Orc ("🏆 New best!"). Lucien = untimed free play, no
  clock on screen; best updates on every completed mission for everyone, so
  quitting via ← never loses progress.
- **Renderer**: single `<canvas>`, redraw per frame (tiles in view, buildings
  as colored plots + big emoji + signs, letter coins, passenger, vector car in
  the kid's color, rotating). Emoji via `fillText`. DPR-scaled.

## Dig Site — design (unchanged from rev 1)

| Kid | Task |
|---|---|
| Lucien (4) | "Dig all the **B** rocks" (letter match, 3 targets among 8) |
| Lili (7) | "Dig **C-A-T** in order" (spell, `WORDS_EASY` ≤4 letters) |
| Luis (9) | "Dig rocks that add up to **15**" (sum; overshoot resets sum + respawns rocks — always solvable) |

Wrong rock → clunk + shake, rock stays. Task done → confetti, next task.
90 s timer, score = tasks, `best.dig`, finish overlay like Orc.

## Integration constraints (from CLAUDE.md + code reading)

- Single inline script in `index.html`; **no `?.`, no `??`, no `flatMap`**
  (Android 8 guard in `scripts/check.mjs`).
- New levels = two entries in `LEVELS` → chips show for every kid;
  `startGame` gets two dispatch branches; on-screen keyboard + legend hidden
  for both levels.
- `handleInput` early-returns for `city` (and routes Space→DIG for `dig`) so
  letter keys can't hit the `state.word` fallthrough.
- Arrows are held keys for `city` → global `keydown` sets flags +
  a new global `keyup` listener clears them (existing filter only passes
  `[a-zA-Z0-9 ;'/]`).
- Bests: `progress[kid].best.city|dig` → existing `stat` op; whitelists in
  `js/sync.js` (`ensureKid`, `hydrate`, `enqueueDiff`) gain the two names.
  `game_stats` is generic — **no schema change**.
- Offline-first: zero network in game code; games-lock inherited via
  `startGame`'s `gameLockState()` check.
- Every user-facing string EN + 繁體中文; spoken audio EN (+FR where the pool
  has it), same as existing games.
- Coach, not cop: no red-for-wrong, no penalties; wrong choices get friendly
  bilingual hints and a retry.

## Out of scope

- Stars for gameplay (decided against).
- Traffic lights / pedestrians / other cars (nice-to-have later, listed as
  possible slice 03 — bonus points for stopping at crossings, never penalties).
- Settings bar for the new levels (age-derived difficulty only).
- New tables, RLS, or admin UI.

## Slices

- `01-city-drive.md` — City Drive complete + `best.city` sync. Ships alone.
- `02-dig-site.md` — Dig Site complete + `best.dig` sync. Depends on 01
  (shares the keyboard-hide edit in `startGame`).
