# Slice 49 — Measure the gap

**Goal:** Write down, per kid, what each tablet currently believes and what the server actually holds — **before** any code changes. After slice 52 the tablet will agree with the server, and the difference vanishes without a trace. This is the only chance to capture it.

**Design:** `docs/plans/2026-07-29-star-source-of-truth/design.md` §1 (D-1), §3 (D6).

**Depends on:** nothing. Must run **before** slice 52.

**Ships no code.** No file in `js/`, `index.html`, `sw.js` or `supabase/` is modified by this slice.

**DONE WHEN:**
- A completed table below, filled in, committed in this file.
- One row per kid per tablet, plus the server figure.
- Papa has seen the numbers and said whether he wants the difference re-granted (that grant happens in slice 53, not here).

---

## Why this is its own slice

The tablet's number and the server's number are about to be forcibly reconciled *in the server's favour*. If a kid currently sees 47 and the ledger says 41, then after slice 52 that kid sees 41 — six stars they genuinely earned, silently removed, with no way to find out how many there were.

Measure first. It costs ten minutes and it is not recoverable later.

---

## Task 1: Read the server figures

**Where:** the admin panel, on any device with internet.

- [ ] **Step 1:** Open the admin panel and go to the Stars view.
- [ ] **Step 2:** Record the total for each of `lucien`, `lili`, `luis` in the table below under **Server**.
- [ ] **Step 3:** Note the date and time you read them (Asia/Taipei). Stars move; a figure with no timestamp is not evidence.

Do **not** use `select sum(delta)` by hand or invent a query. The admin panel reads the `star_totals` view, which is the definition of the correct number.

---

## Task 2: Read each tablet's figure

**Where:** on each physical tablet, one at a time.

- [ ] **Step 1:** Open the app **exactly as the kid does** — same launcher icon, same profile. Do not hard-reload, do not clear anything, do not open it on a laptop instead. You are measuring what that device holds, and a reload can hydrate it away before you see it.

- [ ] **Step 2:** Read the star pill at the top of the kid's hub (the `⭐ N` chip). Record it under **Tablet**.

- [ ] **Step 3:** If the tablet has remote debugging available, also capture the raw stored state, which shows whether a queue is stuck:

  ```js
  JSON.stringify({
    stars: Object.fromEntries(["lucien","lili","luis"].map(k =>
      [k, (JSON.parse(localStorage.getItem("keyquest:v2")||"{}").progress||{})[k]?.stars])),
    queued: (JSON.parse(localStorage.getItem("sq:queue")||"[]"))
      .filter(o => o.type === "stars")
      .map(o => o.kid + ":" + o.delta + " " + o.reason)
  })
  ```

  Record the `queued` list verbatim in the notes column. **A non-empty queue is important** — those stars are *not* lost, they will flush once slice 51 ships, and they must not be re-granted by hand in slice 53 or the kid gets them twice.

- [ ] **Step 4:** Repeat on every tablet. A kid whose profile has been opened on two devices has two rows.

---

## Task 3: Record the result

Fill this in. Leave it in this file — it is the input to slice 53.

**Server figures read at:** `____-__-__ __:__` Asia/Taipei

| Kid | Device | Tablet shows | Server (`star_totals`) | Gap | Stuck in queue | Notes |
|---|---|---|---|---|---|---|
| lucien | | | | | | |
| lili | | | | | | |
| luis | | | | | | |

**Gap = Tablet − Server − Stuck in queue.** That is the number of stars genuinely destroyed by D-1. A negative gap means the tablet is *behind* the server (Papa granted stars the tablet has not picked up) — that is not a loss, it self-heals, and it must not be granted again.

---

## Notes for the implementer

If the gap is zero for all three kids, say so plainly and skip the re-grant half of slice 53. Do not invent a correction to have something to do.

If a tablet shows a wildly wrong number — zero stars, or an empty day, on a device that clearly has history — you have found defect **D-3** live. Record it as such. It is not a separate bug, and it does not need its own investigation; slice 50 fixes it.

Do not "fix" anything you find while measuring. Do not clear a stuck queue. Do not reload a tablet to "get a cleaner reading" — the uncleaned reading *is* the reading.
