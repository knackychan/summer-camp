# SPEC — Summer Quest × Supabase (v2)
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

## Deploy
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
### P0 — shared state (the point of it all)
- [ ] Split `summer_quest.html` → `index.html` + `js/` per file plan; app works unchanged with SyncStore in "local-only" fallback when config is missing.
- [ ] Schema deployed (base + v2 tables); SyncStore hydrates + writes ticks, rolls, stars (app source), act dones.
- [ ] Live timeline + spoken transitions + earned-screen 🔓/🔒 indicator (client-only, no new tables).
- [ ] Papa's daily message rendered from `papa_notes`; admin can write tomorrow's note.
- [ ] **DONE WHEN:** tick on tablet A → visible on tablet B after reload; totals identical; app fully playable offline (queue flushes on reconnect); at 10:00 sharp a tablet announces "Create & build time! 創作與建造時間到了".

### P1 — Papa supervises & assists remotely
- [ ] `admin.html`: login, today-at-a-glance (live ticks), grant/undo stars with reason, ledger.
- [ ] Ask channel end-to-end: canned + typed + voice memo → admin inbox → answer (text/voice) → badge on kid tablet. Urgent → phone push via ntfy.
- [ ] Realtime: admin star lands on the kid's tablet with 🌟 fanfare.
- [ ] **DONE WHEN:** from work, Papa gets a push for Lucien's urgent voice memo, replies by voice, grants Lili +2 "helped Lucien", and both tablets react live within 2s.

### P2 — passes, proof & continuity
- [ ] Pass lifecycle: request → approve/deny → spend/excuse; My Day renders 🎟️/🤝 states; day-complete logic honours them.
- [ ] Photo proof upload + admin view + evening dinner-gallery mode.
- [ ] Vocab mastery + game bests synced; kid PINs; `search_log` writes from the Learn tab.
- [ ] 14-day history heatmap in admin.
- [ ] **DONE WHEN:** factory-reset a tablet → pick Lili + PIN → everything is there; Lili requests an excused pass for Sport ("knee hurts"), Papa approves from his phone, her day-complete bonus is still earnable.

### P3 — nice-to-have
- [ ] Captain view for Luis (+ approval queue for helped-a-sibling claims).
- [ ] 19:00 recap cards + Sunday digest; reward-threshold progress bars (20/50/80 ⭐); month CSV export.
- [ ] Mission pins (`mission_pins`: Papa fixes tomorrow's mission for a block).
- [ ] AI tutor Edge Function with transcript review in admin.

## Risks / notes
- Anon key + permissive RLS means anyone with the URL could write junk. Perimeter = unlisted URL + PINs; hardening path if ever needed = move kid writes behind Supabase magic-link "kid" users. Not worth it at family scale on day 1.
- `pin` is plaintext by design (it's a 4-digit toddler lock, not security).
- Clock skew: `day` is computed client-side (`Asia/Taipei`); pin the timezone in one shared helper so a tablet set to UTC doesn't split the day.
