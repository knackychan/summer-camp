# Parent app: supervise from the phone, get told when a task waits

**Status:** **Approved by Papa, 2026-10-19** (web app, not native; Q2–Q5 on defaults). **Amended the same day (§0):** Papa pointed out the PWA already exists, so the parent app *is* the existing `admin.html`, not a new `parent.html`.
**Date:** 2026-10-19.
**Asked by Papa (2026-10-19):** games stay locked until a kid has enough points from tasks; parents get a notification on their app / phone / PC to check the task; a proper parent app for Android phones, and iOS too unless a PWA is enough there; the points needed to unlock games and screen time are set from admin.
**Builds on:** `2026-10-03-points-system` (`points_claims` pending → `points_review_claim`), `2026-10-08-games-gate-ai-guide` (per-kid daily threshold in `family_settings.games_gate_v1`, "open Games today"), `2026-07-27-admin-ops-redesign` (the desktop admin shell), `2026-10-09-admin-cleanup`.
**Sibling thread:** the kid side (school mode, home chores list, the chores → points → games lock, admin thresholds) is built in the thread "School mode and home chores". This plan does **not** add chore kinds, thresholds or lock rules; it reads and acts on whatever that work writes to `points_claims`, `points_requests` and `games_gate_v1`.

---

## 0. Amendment, 2026-10-19: build on the existing PWA
Papa: "the PWA exist already". `admin.html` already ships in the PWA (shared `manifest.webmanifest`, cached by `sw.js`, Apple home-screen tags) and already shows browser notifications, but only while the page is open. So:
- **No `parent.html`.** Wherever this design says "parent app", read `admin.html`. D5's three tabs become a phone layout of admin (To check, Today, Settings with the gate thresholds) below 820 px; the desktop shell is unchanged.
- **Admin gets its own manifest** (`admin.webmanifest`, `start_url`/`id` `admin.html`). Today the shared manifest's `start_url` is `index.html`, so "Install" from admin opens the kid app.
- **The existing service worker** (`sw.js`) gains `push` and `notificationclick`; no second worker.
- The existing "Windows notifications" switch becomes "Notify this device" and registers a Web Push subscription, so notifications arrive with the app closed. Slice 06 folds into 02.
- Everything else (D3, D4, D7, §4–5) stands.

## 1. What already exists (so the parent app stays thin)

1. **Supabase is the single truth.** Tablets write claims (`status:'pending'`) when a kid finishes a task; parents confirm or decline with `points_review_claim(id, approve, note)`. Rewards go through `points_requests` → `points_approve_redemption` / `points_deny_redemption`.
2. **Parents already sign in.** `admin.html` signs in with Supabase email + password; a parent is a row in `public.admins`. Every parent-only RPC checks `points_parent()` / `games_gate_parent()`. Each parent can have their own account.
3. **The games points gate already exists** (`games_gate_v1`: `enabled`, per-kid `threshold`, open-today). Admin → Settings already edits it.
4. **Admin already listens live** (Supabase Realtime on `points_claims`, `points_requests`, `asks`, `photos`, …). That works only while the page is open; nothing reaches a parent whose screen is off. **That gap is the real missing piece.**
5. **The site is static** (GitHub Pages / Vercel, HTTPS) with a service worker (`sw.js`). Web Push needs exactly that.
6. **There is an Android Capacitor shell** (`apps/android`, `com.summerquest.app`) for the kids' tablets.

## 2. The approach in one paragraph

One **parent PWA** (`parent.html`), phone-first, installable on Android, iPhone and PC, talking to the same Supabase. When a tablet writes a pending claim or reward request, a database trigger calls a new Edge Function `notify-parents`, which sends a **Web Push** to every device a parent has switched notifications on for. Tapping the notification opens the parent app on that task, with **Confirm / Decline**. No app store, one codebase, and the same push path reaches Android, iPhone and the PC. A native Android wrapper is an optional later slice (D2).

## 3. Decisions

### D1 — A PWA, not a native app, for every parent device
`parent.html` + `js/parent-app.js` + its own `parent.webmanifest` (`start_url: parent.html`, scope limited to the parent page so it never opens the kid app). Install = "Add to Home Screen" (iPhone, Safari) or "Install app" (Android Chrome, desktop Chrome/Edge).
**Why:** Android Chrome and desktop browsers support installed PWAs and Web Push fully. iPhone supports Web Push for Home-Screen PWAs since iOS 16.4 (§5). A native iOS app would need a paid Apple Developer account (US$99/yr), a Mac to build and App Store/TestFlight review, for a screen that only lists tasks and sends two RPCs.

### D2 — Android native wrapper is optional and later (slice 07)
If Papa wants a real APK on the phones (icon without installing from Chrome, notifications through Firebase like other apps), a second Capacitor app id `com.summerquest.parent` loads the same `parent.html` and receives pushes through FCM. The Edge Function then sends to both kinds of subscription. Not needed for the first version; recommended only if Web Push on Android proves unreliable on Papa's phones.

### D3 — Sync: the parent app reads and writes Supabase directly, nothing new on the tablets
Same tables and RPCs as admin; Realtime keeps the open app live; a fetch on open/resume covers anything missed. Tablets stay offline-first and unchanged: a claim made offline syncs later, and the notification goes out when it reaches the database. The parent app needs the network to confirm (approval is a server action); offline it shows the last list read-only with "Offline".

### D4 — Notifications are server-driven by a database trigger
- New table `parent_push_subscriptions(id, user_id → auth.users, endpoint unique, p256dh, auth, kind 'webpush'|'fcm', device_label, kids text[], enabled, created_at, last_ok_at)`; RLS: a parent sees and edits only their own rows; tablets (anon) can't read it.
- `after insert` trigger on `points_claims` (when `status='pending'`) and on `points_requests` (`status='requested'`) calls `notify-parents` through `pg_net` (Supabase "database webhook"). The function signs pushes with a **VAPID key kept as a Supabase secret** (never in the repo, like the OpenAI key) and deletes subscriptions the push service reports gone (404/410).
- One notification per claim, text in the kid's words of the task: "Lili finished: Wash rice 洗米 · +10 points". Tag = claim id, so a re-sent claim replaces rather than stacks.
- **Quiet hours** per device (default 21:30–07:00 Asia/Taipei, via `SQ_DAY`): pushes are held and sent as one summary at the end ("3 tasks waiting").
- Also notified (default on, switchable per device): reward requests, Summer chat flagged by moderation (if `kid_chat_v1` is on). Not notified: Brain Gym, games, ordinary ticks.

### D5 — What the parent app shows (three tabs)
1. **To check** — pending task claims and reward requests, newest first, per kid colour: task (EN + 中文 as the kid saw it), time, points, photo if the kid took one. **Confirm** / **Not yet** (decline, optional note). Coach-not-cop: the decline button reads "Not yet", and the kid sees the existing gentle wording.
2. **Today** — per kid: points today vs. their threshold, Games open or still locked (and why: Brain Gym / points / Papa lock / paused), **Open Games today** (the existing override), Brain Gym done, school/holiday mode once the sibling thread ships it.
3. **Settings** — the per-kid points thresholds and the gate on/off (same `games_gate_v1` key and guards as admin, so the two never disagree), notifications on/off for this device and which kids it follows, quiet hours, sign out. Everything else (schedules, rewards catalog, cleanup, AI lab) stays in the desktop `admin.html`, which also gets the "Notify this computer" switch so the PC gets the same pushes.

### D6 — Language
Parent app chrome is English, like admin (D23). Task names and reward names show EN + 中文 as stored, since they come from kid-facing data. (Q2 if the other parent prefers 中文 chrome.)

### D7 — Security
Sign-in is the existing Supabase email + password, session remembered on the device. Only `admins` members can confirm, change thresholds or register a push device; the trigger sends only to subscriptions whose `user_id` is in `admins`. Push payloads carry kid name, task label and points only — no photos, no chat text. No new secret in the repo; `js/config.js` stays the only config and stays gitignored.

## 4. Limits on iPhone (why a PWA is still enough)
- Push works only after the app is **added to the Home Screen from Safari** and opened from there; iOS 16.4 or later. The parent app detects "Safari, not installed" and shows a 3-step install card instead of the switch.
- The notification permission prompt must come from a tap (the "Turn on notifications" button).
- No action buttons on the iPhone notification (Confirm from the lock screen is Android/PC only); tapping opens the task, one more tap confirms.
- Delivery is usually seconds, but iOS can delay pushes when the phone is in Low Power Mode / Focus. Fine for "a task is waiting", not for alarms.
- If iOS clears the subscription (rare, e.g. after long non-use), the app re-subscribes silently the next time it is opened.

## 5. Limits on Android and PC
- Android: any phone with current Chrome. Battery savers on some brands (Xiaomi, Huawei) can delay Chrome pushes; D2's native wrapper is the fix if that happens.
- PC: Chrome / Edge must be running (it usually runs in the background on Windows). Notifications from the desktop admin or the installed parent app.

## 6. Slices (to be written as `NN-<slice>.md` after approval)
1. `01-push-subscriptions` — table, RLS, VAPID secret setup doc, `notify-parents` Edge Function with tests (stubbed push), trigger via `pg_net`. Migration Papa runs live.
2. `02-parent-shell` — `parent.html`, manifest, sign-in, service worker (notification click → open task), install card for iPhone.
3. `03-to-check` — pending claims + reward requests, Confirm / Not yet, Realtime, offline read-only.
4. `04-today` — per-kid gate state, Open Games today; reads `games-gate-core.js`, never duplicates its rules.
5. `05-settings` — thresholds + gate switch (shared with admin), notification preferences, quiet hours.
6. `06-desktop-push` — "Notify this computer" in `admin.html`.
7. `07-android-wrapper` *(optional, only if Papa asks)* — Capacitor `com.summerquest.parent` + FCM.
Checks: `node scripts/check.mjs`; a new `scripts/check-parent-app-ui.py` at phone size (390×844) and on Chrome 138; Edge Function unit test like `kid-chat-fn.test.mjs`.

## 7. Depends on the sibling thread
Chore claims arrive as `points_claims` rows with a bilingual label; the parent app shows whatever `kind` they use. The thresholds stay in `games_gate_v1` unless the sibling thread moves them; if it adds a "screen time" threshold separate from Games, the Settings tab shows it from the same key. This plan agrees the data model with that thread before slice 03.

## 8. Questions for Papa (answered 2026-10-19: Q1 web app; Q2–Q5 defaults)
- **Q1** — PWA for all phones now, native Android wrapper only if pushes are unreliable? *(Recommended: yes.)*
- **Q2** — Parent app in English like admin, or also 中文 for the other parent? *(Default: English.)*
- **Q3** — Which notifications: finished tasks + reward requests (default), plus Summer chat flags?
- **Q4** — Quiet hours 21:30–07:00 Taipei OK?
- **Q5** — Each parent signs in with their own account? *(Default: yes, both added to `admins`.)*
