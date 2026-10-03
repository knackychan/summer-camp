# SPEC — Summer Quest × Supabase (v2)
## Points implementation (2026-10-03)

**Implemented and tested locally; live database deployment is pending.** This section supersedes
the older Stars, Quest Coins, flat schedule bonus, redemption and season-reset
contracts below. The approved [points design](plans/2026-10-03-points-system/design.md)
defines the amounts and limits. Root `index.html` remains the child runtime for
both Classic and the world.

- **Points / 點數** is the single currency. `point_totals` separates confirmed
  `total_earned`, `spent`, `available` and pending verification. The child also
  shows durable unsynchronized earnings as pending. Only confirmed funds can be
  redeemed. Achievement thresholds are ten times their legacy values and use
  total earned; spending never lowers achievement progress.
- `js/points.js` maps schedule components, quests and activities to the same
  child/day/task/slot. Three meal slots and two assigned learning slots enforce
  their daily caps. Brain Gym pays each assigned exercise once, with no extra
  trio award. Arcade play, assessment, rest, world toys and opening a guide pay
  zero. Parent verification is required for real-world work beyond the small
  self-checked routines. Existing age/difficulty adaptations stay in place;
  bilingual agreed goals can be tailored to each child without an age multiplier.
- Balanced days award 20 after learning, helping and movement; four balanced
  days award 50 once in a Monday–Sunday Taipei week. Parents can excuse unavailable
  categories. The former all-schedule bonus is retired. Passes and schedule
  resets never mint or remove points.
- Admin → Quests → Points & assignments configures future award amounts,
  bilingual goals, work references, category excuses, currency, conversion rate
  and the monthly redemption budget. Admin → Quests → Rewards preserves stable
  reward IDs and editable bilingual exchange labels, descriptions, icons,
  prices, type and availability. Cash stays disabled until explicitly enabled
  with a currency, rate and budget. Experience rewards need no cash settings.
- Supabase RPCs validate amounts and eligibility, preserve attempt amounts,
  enforce stable task identities and serialize currency changes on the child's
  database row. Only an allowlisted parent can verify work, approve exchanges,
  correct earnings or refund an undelivered exchange. Request labels, prices
  and rates are immutable snapshots. Approval and spending are one transaction;
  retries and refunds have unique records.
- `20261003_points_system.sql` migrates legacy value once at **1 legacy unit =
  10 points**, including ledger deltas, spending, reward prices and request
  prices. Stars and coins are not added together. Ledger/request IDs, original
  recovery snapshots and family settings are preserved. The client keeps an
  explicit points cache and durable queue; older clients retain legacy units
  and their uncertain awards require parent review. Season resets preserve
  earnings, award identities, spending, requests, refunds and unspent balances.

**Verification:** Focused points/Admin/sync tests, browser checks and the Android
payload build passed. `node scripts/check.mjs` passed in an isolated snapshot of
the working files, avoiding concurrent builds in the shared workspace. Native
PostgreSQL 17 tests passed, including actual concurrent approval transactions,
repeat migration and refunds. The reported late Check help failure did not
reproduce in the final full check or its standalone suite. See the
[implementation record](plans/2026-10-03-points-system/01-points-and-redemption.md)
for evidence and limits.

**Deployment:** Follow the [preview, backup and recovery procedure](../supabase/POINTS-ROLLOUT.md),
apply the versioned migration as the live Supabase owner, then deploy the updated
app and refresh tablets. No live migration or live redemption occurred in this session.

**Goal:** turn the single-file `summer_quest.html` into a small static site with shared state: kids connect to their profile on their tablets, Papa has an admin account with a dashboard to supervise progress and grant stars. Hosted free (GitHub Pages or Vercel) + Supabase free tier.

**Constraints**
- Keep the app 100% static — no server code. All data via `@supabase/supabase-js` from the browser.
- Anon key lives in `js/config.js` (public by design; RLS is the guard, URL obscurity + optional kid PINs are the perimeter — acceptable for a family app).
- Keep the app playable offline: writes queue locally and flush when back online. Games never block on network.
- Mission **assignment stays client-side** (date-seeded, already deterministic across devices). Only **state** syncs: ticks, rerolls, stars, activity dones, vocab mastery, bests.
- Do not change gameplay, translations, or the DAY/MISSIONS data model.

## File plan
```
/                      (repo root = deploy root)
├── index.html         ← current summer_quest.html, storage layer swapped for sync.js
├── admin.html         ← Papa's dashboard (login + supervision + star grants)
├── js/
│   ├── config.js      ← SUPABASE_URL, SUPABASE_ANON_KEY (gitignored template: config.example.js)
│   ├── sync.js        ← SyncStore module (below)
│   └── supabase.min.js (or CDN import)
└── schema.sql         ← base + v2 tables; paste in Supabase SQL editor
Storage buckets: 'voices' (ask-channel memos), 'proofs' (photo missions) — public read, anon insert.
```

## Auth model
- **Kids:** no Supabase auth. Profile select in the app; optional 4-digit PIN checked against `kids.pin` (client-side check is fine at this trust level). Session = `localStorage['sq:kid']`.
- **Admin:** Supabase email+password (create Papa's user in Dashboard → Authentication, disable signups). `admin.html` = `signInWithPassword`, everything gated on session. RLS grants `authenticated` the admin-only writes (`source='admin'` ledger rows, deletions, PIN updates).

## SyncStore contract (`js/sync.js`)
Replaces `loadProgress()` / `saveProgress()` wholesale. The in-memory `progress` object shape is unchanged; SyncStore hydrates and persists it.

```js
const store = await SyncStore.init(supabaseClient);
store.progress                    // same shape the app already uses
store.tick(kid, dayISO, blockIdx, ticked)   // upsert/delete day_ticks
store.roll(kid, dayISO, blockIdx)           // increment day_rolls.count
store.addStars(kid, delta, reason)          // insert stars_ledger (source:'app')
store.actDone(kid, dayISO, actIdx)          // insert act_done
store.setVocab(kid, wordKey, box)           // upsert vocab_mastery (debounced 2s, batched)
store.setStat(kid, stat, value)             // upsert game_stats
store.onStars(cb)                           // realtime: ledger inserts → cb(row)
```

Rules:
- **Hydration:** on init, fetch today's ticks/rolls/acts + star totals + this kid's vocab/stats. Merge into `progress`; local queue replays anything pending.
- **Offline queue:** every write goes to an in-memory + `localStorage['sq:queue']` FIFO; flush on `online` event and every 30s. Idempotent by design (PKs on natural keys; ledger inserts carry a client-generated uuid to dedupe).
- **Stars are read-only derived state:** the app never stores a stars counter again — it displays `sum(ledger)` from hydration, incremented optimistically on local `addStars`, corrected on next hydration.
- **Realtime treat:** subscribe to `stars_ledger` inserts for the active kid; when `source='admin'`, fire the existing `bigFloat('🌟')` + `sWin()` so a Papa-granted star lands live on the kid's tablet with fanfare.

## Admin dashboard (`admin.html`)
Reuse the app's CSS variables/fonts (dark navy theme). Sections:
1. **Login** — email+password, session persisted.
2. **Today at a glance** — 3 kid columns: day progress bar (`x/16`), each DAY block with ✓/– status (live via realtime on `day_ticks`), star total (from `star_totals` view), missions count.
3. **Grant stars** — per kid: `+1 +2 +3 / custom` with a required reason field; writes `stars_ledger {source:'admin', granted_by: session.user.id}`. Undo = delete row.
4. **Ledger** — last 30 entries per kid (reason, delta, source, time). Admin rows deletable.
5. **History** — 14-day grid per kid: blocks-done count per day (mini heatmap, tracker-style).
6. **Settings** — set/clear kid PINs.
7. **Quests → Rewards** — edit each reward's exchange label in English and Traditional Chinese, description, icon, point cost, type and availability. Labels use the existing shared reward catalog and appear in the child shop. See the current points implementation contract above; its database migration must be deployed before confirming earnings or exchanges.

## Deploy

### Android 8 compatibility (2026-10-03)

Papa requested Android 8 support again. This supersedes the retirement in the
2026-07-27 solar-system design. Target Android 8/8.1 with Chrome or its WebView
provider updated to version 138, the [last Chrome generation for Android 8/9](https://groups.google.com/a/chromium.org/g/chromium-dev/c/vEZz0721rUY).
The original factory browser is outside this tested baseline. The native shell
already has minSdk 24; Android 8 is API 26/27, so no Capacitor downgrade is needed.

- Solar, Monster Truck and the development Cube share graphics initialization.
  WebGL2 keeps Three r185; a WebGL1-only GPU loads pinned r162 and matching addons.
  Failed antialias allocation retries without it. Android 8/9, devices reporting
  at most 4 GB memory, and WebGL1 use pixel ratio 1 with antialiasing and truck
  shadows disabled. Both renderers and addons are packaged for offline play.
- The shared renderer pauses drawing/simulation while its context is lost and
  resumes when it returns, preserving the round. Failed launches clean up and
  show a bilingual Retry screen; Back still returns to the world. The obsolete
  global context-restore restart was removed because it reset rounds and could
  lose asynchronous errors. Late texture loads cannot retain disposed scenes.
- UUID creation reuses the existing secure random fallback when `randomUUID`
  is unavailable (including LAN HTTP). Failed microphone initialization stops
  acquired tracks. The native haptic plugin no longer calls `String.isBlank`.
  Android device diagnostics now report the active WebView provider/version.

`scripts/check-android8-ui.py` checks actual rendering with Chrome 138, forced
WebGL1, no graphics context, Retry, context restoration, navigation, remembered
heroes and offline WebGL1. `check-instant-startup.py` verifies the first screen
still appears within one second under the existing network/CPU slowdown.
These are desktop browser tests; the attached Samsung runs Android 16, so
physical Android 8 performance and GPU compatibility remain unverified.

### Loading performance and remembered heroes (2026-10-03)

The selected `sq:kid` now survives returning to Heroes, page reloads and a new
browser session. A returning child resumes the saved activity or enters the
world; the Heroes control still allows an explicit profile change. Unknown or
invalid profiles show the selector. Switching to a protected profile still
requires its PIN. A configured device without cached PINs must fetch them before
opening a new profile.

The performance pass addressed these measured loading costs:

- A small inline bootstrap renders the real hero choices before any external
  scripts or styles arrive. Taps immediately show the chosen character and a
  loading message; the existing PIN check still runs before profile selection
  is saved. Returning children see their character immediately. Runtime CSS is
  loaded asynchronously from `css/app.css`; failed startup offers Reload.
  World modules preload as soon as a child is selected. HTML gzip streams flush
  early chunks so compression cannot hold back the first screen.
- Startup previously downloaded the cloud SDK and all eight books before the
  first interaction. The SDK now loads only when sync is configured; book data
  and Minecraft presentation code load when that book opens. Fonts no longer
  block rendering. Failed book downloads can retry; competing launches honor
  the latest request and navigation cancels stale results.
- Cached progress now renders immediately. Cloud hydration and durable queued
  actions run in the background. Server reads/writes remain serialized to keep
  star totals and pending local changes consistent. Read failures retain cached
  state, network waits are bounded, and a failed SDK connection can retry.
- The world loads alongside its game manifest without waiting for the lesson
  catalog. Sprite canvases are generated on demand (25–27 in the sampled first
  view, previously 252). Each landmark refresh reads the content catalog once.
  Unchanged resizes and idle reduced-motion frames skip rendering work.
- Offline preparation starts after the first screen and uses four concurrent
  downloads. Cached media and vendor libraries load immediately; app code stays
  network-first with a two-second cached fallback on slow connections. The local
  server now serves gzip and conditional ETag responses; APIs remain uncached.

Measurements used isolated Edge browser profiles, an empty HTTP cache, 100 ms
latency, 1 Mbps download bandwidth and 4× CPU slowdown. External services were
blocked; separate regressions held cloud/font requests open. These are desktop
simulations, not timings from the physical tablet.

| Cold-load measurement | Before, plain static server | After, same static server | After, compressed local server |
| --- | ---: | ---: | ---: |
| Full runtime ready (before the instant bootstrap) | 9.86 s | 6.94 s | 2.90 s |
| Select hero → world ready | 4.69 s | 1.68 s | 1.40 s |

With the instant bootstrap, the first screen appears in **0.52–0.72 seconds**
under the same slowdown, including tests that hold the main configuration script
and all six runtime stylesheets indefinitely. Click feedback takes **36–54 ms**.
The app continues loading behind that screen. Measure this separately from
DOMContentLoaded with
`python scripts/check-instant-startup.py --browser <Chromium executable>`.

Reproduce the static comparison and navigation/PIN/book checks with
`python scripts/check-performance-ui.py --browser <Chromium executable> --target source`.
The focused sync, world-performance, service-worker-offline and agent-local-server
tests cover background writes, hydration races, rendering reuse, cache updates
and compression. Browser offline checks also open games, books and music after a
cold document restart and decode all 178 shipped book images. Full native APK
timings still require testing the rebuilt app on the tablet.

### Brain Gym pixel presentation (2026-10-03)

All seventeen Brain Gym games use the shared pixel handheld shell with a compact game selector, bilingual title, progress, touch controls and reduced motion. Early calculation prompts include tap-to-count objects; numeric calculation rounds accept keyboard input; Change Maker supports adding and taking back coins with immediate feedback. Scoring, daily completion and offline behavior remain in the shared Brain runtime.

Number Bonds / 數字好朋友 replaces Number Cruncher under the existing `crunch` ID. Four-, six- and eight-tile boards ask for two numbers that make a target, with counting dots for beginners. New rounds resume after serialization; old counting-field resumes restart. City Drive is retired from the active manifest, launch paths and precache; historical source and scores are retained. See [the design and proposed future exercises](plans/2026-10-03-pixel-brain-gym/design.md).

Eight additional exercises provide Fraction Picnic, Balance Lab, Circuit Builder, Science Sorter, Sentence Train, Sound Match, Memory Match and Pattern Echo. Each has three difficulty tiers and an unclocked beginner tier. Their rounds now progress through distinct challenges: fraction shares/leftovers/equivalence, either missing operand with four arithmetic operations, circuit building and series/parallel predictions, broader science classifications, 54 authored sentences and 36 bilingual listening words. Sound Match adds English initial sounds/rhymes/spelling and Bopomofo matching, with a written alternative to speech. Memory Match progresses from targeted pairs to full boards of up to twelve cards. Pattern Echo progresses from two to six taps, adds reverse sequences, and supports undo/check. Old saved questions retain their original behavior.

Every new question includes a bilingual concept, optional strategy clue and worked explanation. Clues pause input and timing; incorrect answers hold the explanation until the child practises again or continues. Practice keeps the first-attempt score, including when an answered question is restored from a save. Full memory boards let the child finish after a mismatch while retaining that first-attempt result. Study/playback pauses with page visibility, all data survives JSON serialization, and questions grade locally and work offline. See [the depth plan](plans/2026-10-03-pixel-brain-gym/03-exercise-depth.md) and [the next game proposals](plans/2026-10-03-pixel-brain-gym/02-six-exercises.md).

### Architecture recovery update (approved 2026-10-02)

The authoritative child application is root `index.html`. Classic and the 3D world are views of that runtime and share `SummerQuest` launch/Back operations; existing SyncStore keys and the star ledger remain authoritative. `apps/kid` is retained as historical source with a root redirect, excluded from production execution/distribution. See [the recovery plan](plans/SUMMER-QUEST-ARCHITECTURE-RECOVERY-PLAN.md).

Deployments now require `npm ci` and `npm run build:android-web`; publish `dist/android-web`, which includes the child runtime, parent admin and compiled learning dependencies. Android syncs that same payload. The older no-build/root-directory instructions below describe the original static release and are superseded by this build requirement.
- **GitHub Pages:** repo → Settings → Pages → deploy from `main` root. Done. (No build step.)
- **Vercel:** import repo, framework = Other, no build command, output dir = `/`. Either is fine; Vercel gives nicer preview URLs for iterating.
- Supabase: new project (region: Southeast Asia / Singapore for Taiwan latency) → run `schema.sql` → enable Realtime replication on `day_ticks` + `stars_ledger` → create Papa's auth user → copy URL + anon key into `js/config.js`.

## Assistance features (agreed 2026-07-26)
Design stance for all of these: **coach, not cop** — late/locked states invite, never shame; no punishment mechanics; no per-minute tracking; screen-time is indicated, not enforced.

1. **⏰ Live timeline** — current DAY block glows + auto-scrolls; next block flagged; unticked past blocks turn amber ("You can still start! 還來得及開始！"). Screen blocks compute their own 🔓/🔒 earned status from ticked prerequisites.
2. **🔊 Spoken transitions** — chime + bilingual announcement at block changes (Web Speech, already in app). Essential for Lucien (non-reader).
3. **📝 Papa's daily message** — `papa_notes` row shown atop My Day; written from admin the night before.
4. **💬 Ask channel** — typed (Luis), canned one-tap asks, and **voice memos** (Storage bucket `voices`) for the little ones; two levels: question vs urgent; urgent triggers push to Papa's phone via Edge Function → ntfy.sh/Telegram (free).
5. **🎟️ Passes** — Golden (reward; kid spends to skip one mission block, still counts toward day-complete) and Excused (incapacity; 🤝 block, no star, day-complete stays reachable). Kids can *request* with a reason → approve/deny from admin.
6. **📸 Photo proof + dinner gallery** — post-mission "snap what you made" → `proofs` bucket → admin sees it; evening gallery view plays the family's day.
7. **🧭 Learn tab** *(already shipped client-side)* — question builder, KNOW/DO/ask-AI guides. Sync hook: log composed queries to `search_log` (transparency → dinner conversation, not surveillance).
8. **👑 Captain view (Luis)** — read-only sibling progress + "helped a sibling" claim pending Papa approval.
9. **🌙 Recaps** — 19:00 per-kid recap card; Sunday weekly digest in admin.
10. **🤖 AI tutor (last)** — Edge Function proxy, kid-safe system prompt, rate-limited, full transcripts in admin. Luis first.

## Priorities
_Status reviewed against the code 2026-07-26 — see "Review status" below for gaps._

### P0 — shared state (the point of it all)
- [x] Split `summer_quest.html` → `index.html` + `js/` per file plan; app works unchanged with SyncStore in "local-only" fallback when config is missing.
- [x] Schema deployed (base + v2 tables); SyncStore hydrates + writes ticks, rolls, stars (app source), act dones.
- [x] Live timeline + spoken transitions + earned-screen 🔓/🔒 indicator (client-only, no new tables).
- [x] Papa's daily message rendered from `papa_notes`; admin can write tomorrow's note.
- [x] **DONE WHEN:** tick on tablet A → visible on tablet B after reload; totals identical; app fully playable offline (queue flushes on reconnect); at 10:00 sharp a tablet announces the block (10:00 is now Homework per approved 2026-07-26 plan).

### P1 — Papa supervises & assists remotely
- [x] `admin.html`: login, today-at-a-glance (live ticks), grant/undo stars with reason, ledger. _(Ledger is last 30 total, not per kid — acceptable, noted.)_
- [x] Ask channel end-to-end: canned + typed + voice memo → admin inbox → answer (text/voice) → badge on kid tablet. Urgent → phone push via ntfy. _(Push is direct from kid tablet to ntfy.sh — no Edge Function; silently skipped if `NTFY_TOPIC` unset or tablet offline.)_
- [x] Realtime: admin star lands on the kid's tablet with 🌟 fanfare.
- [x] **DONE WHEN:** from work, Papa gets a push for Lucien's urgent voice memo, replies by voice, grants Lili +2 "helped Lucien", and both tablets react live within 2s.

### P2 — passes, proof & continuity
- [x] Pass lifecycle: request → approve/deny → spend/excuse; My Day renders 🎟️/🤝 states (excused blocks get the 🤝 treatment); day-complete logic honours them.
- [x] Photo proof upload + admin view + evening dinner-gallery mode (full-screen slideshow of today's photos in admin, auto-advance + manual nav).
- [x] Vocab mastery + game bests synced; kid PINs; `search_log` writes from the Learn tab. _(Vocab syncs via save-diff, not the spec'd 2s debounced `setVocab` batch — equivalent in practice.)_
- [x] 14-day history heatmap in admin.
- [x] **DONE WHEN:** factory-reset a tablet → pick Lili + PIN → everything is there; excused pass flow works and the day-complete bonus is still earnable (bonus-via-pass fixed 2026-07-26).

### P3 — nice-to-have
- [~] Captain view for Luis (+ approval queue for helped-a-sibling claims) — in progress (`help_claims` schema + kid tab + admin queue landed, uncommitted).
- [ ] 19:00 recap cards + Sunday digest; reward-threshold progress bars (20/50/80 ⭐); month CSV export.
- [ ] Mission pins (`mission_pins`: Papa fixes tomorrow's mission for a block).
- [ ] AI tutor Edge Function with transcript review in admin.

## Review status (2026-07-26, updated after gap-fix pass)
**Fixed in review pass 1:** papa-note HTML escaped in My Day; day-complete +2 bonus granted when the last block is finished via a pass; SyncStore hydration replays the pending offline queue into local state (spec rule); admin boot errors surface instead of writing to a hidden panel.

**Fixed in gap-fix pass 2:**
- Day/timezone unified into one shared helper `js/day.js` (`SQ_DAY`, honours `FAMILY_TZ`); `index.html`, `js/sync.js`, `js/admin.js` all delegate to it.
- Admin write failures (grant/undo stars, approve/deny pass, answer ask incl. voice upload) now surface via a toast; successes confirm too.
- Dinner-gallery evening mode: full-screen slideshow of today's proofs in admin (auto-advance 6s, prev/next, Escape).
- Excused blocks now get the 🤝 treatment (pass label emoji, soft green row, 🤝 on the tick button).
- `scripts/sync.test.mjs`: node-run SyncStore tests (queue diff ops, hydrate + queue replay, local-only fallback) — wired into `scripts/check.mjs`.

**Known gaps / deviations (accepted or open):**
1. Urgent push has no Edge Function fallback — an offline tablet's urgent ask reaches Papa only after reconnect, with no retry for the ntfy ping itself.
2. `DAY[]` labels duplicated in `js/admin.js` — must be updated in lockstep with `index.html`.
3. Admin ledger shows last 30 entries total, not per kid.
4. Accessibility: kid-app overlays (PIN, pass request) lack Escape-to-close/focus trap. Tablet-first targets are otherwise good.

**Next steps in priority order:**
1. Finish + commit captain view (in flight), then remaining P3: recaps/digest, reward-threshold bars, CSV export, mission pins, AI tutor.
2. Approved 2026-07-26 plan slices still pending (02-06: day core, activity lock, reschedule, outing mode, practice drills).
3. Optional hardening: ntfy retry queue for urgent asks; kid-app overlay a11y.

## Risks / notes
- Anon key + permissive RLS means anyone with the URL could write junk. Perimeter = unlisted URL + PINs; hardening path if ever needed = move kid writes behind Supabase magic-link "kid" users. Not worth it at family scale on day 1.
- `pin` is plaintext by design (it's a 4-digit toddler lock, not security).
- Clock skew: `day` is computed client-side (`Asia/Taipei`); pin the timezone in one shared helper so a tablet set to UTC doesn't split the day.

## Kitchen Quest integration (2026-10-03)

Kitchen Quest v0.7.0 is available through Games and a diner on Pixel Planet. Its native game module keeps two customer dishes, exact recipe sequences, grill, chopping board, lasagna oven, and easy/standard shifts. Art uses the existing planet palette; controls, recipes and read-aloud instructions use English / Traditional Chinese. The shared host owns access checks, Back, sound and per-child `best.kitchen` (the best session order count).

Each child has a saved cookbook and repeating shift goals in `settings.kitchen.profiles[kid]`. Four additional recipes unlock after 4, 8, 12 and 16 successful serves, bringing the menu to nine. Kitchen Shift introduces extra-tomato, extra-pickles and no-cheese requests after the introductory orders; Very Easy keeps ordinary recipes. The ticket and grading use the customer's exact requested sequence. A Prep tab combines both open orders' remaining food needs, stock, reserved patties and batches underway.

Dishes and kitchen stock are session-only; cookbook progress persists across reloads and difficulty changes. Opening the cookbook, backgrounding the app or awaiting a mode change pauses the cooking clock. Closing a backgrounded cookbook requires an explicit resume. All runtime files are in the offline and Android web bundle. See the [integration plan](plans/2026-10-03-kitchen-quest/01-integration.md) and [v0.7 plan](plans/2026-10-03-kitchen-quest/02-v07.md) for scope and validation.

At 1280 × 600, Kitchen keeps customer selectors, station tabs, all ingredients and Serve on screen. Recipes and workstation details scroll within their own panes; oven actions remain visible. Touch swipes do not activate food controls, and held taps survive timer redraws. Shared overlays also freeze cooking until the child explicitly resumes. The [tablet layout validation](plans/2026-10-03-kitchen-quest/03-tablet-layout.md) records the Chrome 138, Edge and packaged-web checks.
