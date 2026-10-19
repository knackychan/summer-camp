# School mode, after-school plan and home chores

**Status:** **Requested by Papa, 2026-10-19** (project thread). Built the same day on branch `claude/school-mode-chores-46k4fr`; the defaults marked *(default)* below were picked by Claude where Papa didn't say, and wait on his look.
**Slices:** 01–03 in this folder, all built 2026-10-19. 02's SQL must be run live by Papa (`supabase/migrations/20261019_school_chores_kinds.sql`).
**Builds on:** `2026-10-08-games-gate-ai-guide` (the daily points gate, `games_gate_v1`, `SQGamesGate`), `2026-10-03-points-system` (`points_claims`, Papa's check), `2026-07-26-brain-gym` (§6 gate).
**Supersedes:** nothing. It **amends CLAUDE.md exception (5)**: the points threshold can differ on school days, and bonus tasks never count toward it.
**Shared with:** `2026-10-19-parent-app` (parents' Android app thread) relies on: chores are ordinary `points_claims` rows with a bilingual `evidence.label`, Papa confirms with `points_review_claim`, and every threshold lives in `family_settings.games_gate_v1`.

---

## 1. What Papa asked for

- A **school mode** next to the holiday mode we already have. On school days the kids come home in the afternoon; the app shows an **after-school schedule** that is **only informative**: an idea of what they can expect, not a list to tick.
- **Screen time** (Games) after school opens once they have done their **Brain Gym + a few home chores**.
- **Weekends** look like the holiday day, even with school mode on.
- Twelve **home chores**: wash rice, fill the dishwasher, empty the dishwasher, clean the table and prepare for dinner, tidy clothes, tidy desk, prepare bed, gather toys from the floor, tidy garden toys and bicycles, peel garlic, tidy their after-school bowls, tidy shoes. Then two more: **change the water for the Gohonzon** (the small water cup on the family prayer altar) and **vacuum the floor**; later the same day, **bring in the dry laundry**.
- Games locked until enough points, kids do the task, **parents get a notification** to check it.
- The **number of points** to unlock screen time and games is **set in the admin panel**.
- **Bonus tasks** such as Gym exercise and Music practice: not chores, extra points to exchange later.
- The parents' phone app is its own thread (`2026-10-19-parent-app`), not this plan.

## 2. What already existed

- The holiday day is `DAY` in `js/day-data.js`: 16 timed blocks with ticks and missions.
- Games already lock behind the Brain Gym trio and then the daily points gate (`js/lock-core.js`, `js/games-gate-core.js`). The gate counts **today's** points, pending ones included, and stays open for the rest of the day once reached. Papa sets one threshold per kid in Admin → Points (`games_gate_v1`). It shipped switched off.
- Papa-checked tasks become `pending` claims that Admin lists for "Confirm work". Admin already shows browser notifications for some live events, but **not** for a new pending claim.
- Points kinds already existed for three of Papa's chores: `table_helper` (dinner slot), `laundry_helper`, `shoe_tidy`.

## 3. Decisions

### D1 — One switch: holiday or school, Monday–Friday only

`family_settings.day_mode_v1 = {"mode":"holiday"|"school"}`, holiday by default. Papa flips it in Admin → Points (School or holiday). `SQSchool.modeFor(day, settings)` says what today is: **school** only when the switch is on **and** the Taipei day is Monday–Friday; Saturday and Sunday are always the holiday day (Papa, 2026-10-19). No calendar of school holidays *(default)*: Papa flips the switch at the start and end of a school period.

### D2 — The after-school plan is information only

`SQSchool.SCHEDULE`, 8 rows from 16:00 *(default times)*: Home from school (snack, bowl and shoes) → Brain Gym → Help at home → Homework → Screen time → Dinner → Bath + school bag → Story and bed. Per-kid lines in EN + 中文. Rows have **no ticks, no missions, no points, no "late" colour** — the current row is highlighted, past rows are just dimmed. Three rows carry live status: Brain Gym (n / 3, tap to play), Help at home (jumps to the chores), Screen time (open, or what is left: Brain Gym first, then "n more points from home jobs"). The holiday day is unchanged.

### D3 — Fifteen chores, kept as data, each a points kind Papa checks

| Chore | Points kind | Points | Check |
|---|---|---:|---|
| Wash the rice 洗米 | `rice_wash` (new) | 5 | Papa |
| Fill the dishwasher 把碗盤放進洗碗機 | `dishwasher_load` (new) | 10 | Papa |
| Empty the dishwasher 把洗碗機的碗盤拿出來 | `dishwasher_unload` (new) | 10 | Papa |
| Clean the table and set it for dinner 擦桌子，準備晚餐 | `table_helper` : dinner (existing) | 5 | self (existing rule) |
| Tidy up your clothes 整理衣服 | `laundry_helper` (existing) | 15 | Papa |
| Tidy up your desk 整理書桌 | `desk_tidy` (new) | 5 | Papa |
| Get your bed ready 整理床鋪 | `bed_prepare` (new) | 5 | Papa |
| Pick up toys from the floor 把地上的玩具撿起來 | `floor_toys` (new) | 5 | Papa |
| Put away garden toys and bikes 收好花園玩具和腳踏車 | `garden_toys` (new) | 10 | Papa |
| Peel the garlic 剝大蒜 | `garlic_peel` (new) | 5 | Papa |
| Put away your after-school bowl 收好放學後的碗 | `bowls_tidy` (new) | 5 | Papa |
| Tidy up the shoes 整理鞋子 | `shoe_tidy` (existing) | 5 | self (existing rule) |
| Change the water for the Gohonzon 幫御本尊換水 | `altar_water` (new) | 5 | Papa |
| Vacuum the floor 用吸塵器吸地 | `vacuum_floor` (new) | 10 | Papa |
| Bring in the dry laundry 把曬乾的衣服收進來 | `laundry_in` (new) | 10 | Papa |

- Reusing the three existing kinds means the same work never pays twice (the holiday Dinner tick and the chore card share one identity).
- Amounts *(default)* follow the size of the job. Papa changes any of them in Admin → Points → Award amounts, as for every kind.
- All new kinds are helping, once a day, need no assignment. They are added in `js/points.js` and in `points_policy` / `points_claim` (slice 02 migration), exactly like games-gate slice 02.

### D4 — The Help at home card

On My Day, in **both** modes *(default)*: below the after-school plan on school days, below the holiday blocks otherwise. A tile per chore with icon, EN + 中文 and points. A tap asks "All done? 做完了嗎？" (so a stray tap sends nothing), then sends the claim with `evidence = {chore, label:[en, zh], completed:true}`. The tile then shows ⏳ Papa will check, ✓ Points in! when confirmed, or ↻ Try again if Papa declined. The head shows today's points against today's bar.

### D5 — Thresholds per mode, in the admin panel

`games_gate_v1` gains `schoolThreshold` per kid next to `threshold` (holiday). A setting saved before this plan keeps one bar for both (the school value defaults to the holiday value). Admin → Points shows both columns. **Screen time and Games are one gate** after school: Brain Gym trio first, then the points bar for today's mode. Pending points count, as in games-gate D1, so a kid never waits on Papa being at work to play. The gate still ships switched off; Papa turns it on with "Games gate on".

### D6 — Papa is told when a task waits for him

Admin's live channel already listens to `points_claims`. A row that **becomes `pending`** (insert, or a started attempt turned pending) now raises the browser notification "Lili finished a task — please check: Wash the rice · 5 points", once per claim. Phone notifications when Admin is closed belong to the parents' app thread (a trigger on `points_claims` status pending).

### D7 — Bonus tasks are extra points, never needed for Games

`SQSchool.BONUS`: **Gym exercise 健身運動** (`gym_exercise`, 20) and **Music practice 音樂練習** (`music_bonus`, 15), both Papa-checked, shown in their own ⭐ Bonus points card. Kinds marked `extra: true` in `js/points.js` are left out of the gate's daily count (`todayPoints(..., {exclude})`), so they only grow the wallet for the reward catalog. `music_bonus` is separate from the practice-day `music` kind; Papa decides if both were really done.

## 4. Not in this plan

The parents' Android app and push notifications (own thread). A school-holiday calendar. Editing the after-school times from Admin (the holiday template editor is not reused; ask if wanted). Adding the chores to the home-help guide's eight suggestions.
