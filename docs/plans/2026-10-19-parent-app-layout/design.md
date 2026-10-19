# Parents' app layout: Awaiting first on the phone

**Status:** **Asked by Papa (Fred), 2026-10-19**, built the same day on branch `claude/parents-app-layout-n9zh8t`, waiting on his look at the phone screenshots. Defaults marked *(default)* were picked by Claude.
**Builds on:** `2026-10-19-parent-app` (the system side: push, the `#check` route, deep links `#check/claim/<id>`, `js/admin-push.js`, merged in PR #7), `2026-10-19-school-mode-chores` (chores with `evidence.label`, `schoolThreshold`, `day_mode_v1`), `2026-10-08-games-gate-ai-guide`.
**Split:** the parent-app thread owns push, the service worker, the manifest and migrations; this plan owns the screens.

## What Papa said (2026-10-19)

- The main tab on the phone is **Awaiting**: what a parent has to answer.
- The schedule is not the main feature. It is its own tab and shows **one kid at a time**; all three together is messy on a phone.
- On a phone, scrolling over a schedule block got stuck because the finger started a drag. Fix it.

## Decisions

### D1 — One page, four tabs on a phone
The phone layout is `admin.html` itself (the installed parent app), not a second page. At ≤ 820 px a bottom bar shows **Awaiting · Kids · Schedule · Settings**; the ☰ drawer still reaches every admin section. Awaiting, Kids and Settings are tabs of the `#check` route; Schedule is the existing Today route with the day board first. Desktop keeps the nav rail and shows the three tabs as chips on `#check`. The nav item "To check" reads **Awaiting**.

### D2 — Awaiting
Pending task claims and reward asks, newest first, filterable by kid. A card: kid colour, time (Taipei), the chore's icon, EN + 中文 label as the kid saw it, points, a Bonus or Reward ask tag. **Confirm** / **Not yet** (claims), **Approve** / **Not now** (reward asks), 48 px buttons. Not yet opens a sheet with an optional note that is kept only for the parents' record (no kid screen shows it); the tablet shows its usual gentle try-again. Questions and passes are counted with a link to the Inbox *(default)*. Offline: last list, buttons off.

### D3 — Kids
One card per kid: today's points against today's bar (school or holiday), a bar in the kid's colour (never red), and the reason Games wait, in the tablets' order: paused or locked by Papa, Brain Gym first (n of 3, read from `brain_done`), then "n more points". Points waiting for a check count and are shown; bonus tasks never count. **Open Games today** / **Undo open today** as before.

### D4 — Settings
School or holiday (segmented), the games gate switch and per-kid **Holiday** and **School day** steppers (0–300, steps of 5). Changes collect into one draft with a sticky **Save changes / Discard**. Saving keeps any unknown key in `games_gate_v1`. Then "Notifications on this device" (the push thread's card, unchanged), all admin sections, sign out.

### D5 — Schedule on a phone
The day board comes first on the Today route and shows one kid, picked by three large chips (remembered for the session). A finger scrolls across blocks (`touch-action: pan-x pan-y` on coarse pointers); only the `::` grip reorders a block, and a tap without movement still opens Replace. Mouse drag on the desktop is unchanged.

## Checks
`node scripts/check.mjs`; `scripts/admin-check-core.test.mjs`; `python scripts/check-parent-app-ui.py --browser <Chrome 138>` (390×844 phone and 1280×800 desktop; includes a real touch swipe over a block).
