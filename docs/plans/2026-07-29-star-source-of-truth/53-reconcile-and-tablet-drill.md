# Slice 53 — Hand back the lost stars, then prove it on hardware

**Goal:** Close the plan honestly. Give the kids back the stars defect D-1 destroyed, and confirm on the real tablets that tablet and admin now agree under every condition — including outdoors with no signal.

**Design:** `docs/plans/2026-07-29-star-source-of-truth/design.md` §3 (D6), §6.

**Depends on:** slice 49 (the measured gap) and slice 52 (deployed and live on the tablets).

**DONE WHEN:**
- Every kid's tablet and the admin panel show the same number, at the same moment, on every device.
- The seven checks of design.md §6 pass on real hardware.
- The completion note at the bottom of this file is filled in.

---

## Task 1: Re-grant the gap

**Where:** the admin panel. **Not** SQL, **not** a script, **not** a migration.

- [ ] **Step 1:** Confirm slice 52 is actually live on the tablets before granting anything. Open a tablet, check that its count now matches `star_totals`. If a tablet is still running the old build, its number is meaningless and granting against it double-counts.

- [ ] **Step 2:** Re-read the table in `49-measure-the-gap.md`. For each kid, the number to grant is:

  ```
  Gap = Tablet shows − Server − Stuck in queue
  ```

  **Stuck-in-queue stars are not lost.** They flushed by themselves once slice 51 shipped. Granting them again gives the kid the star twice. This is the single most likely way to get this slice wrong.

  A **negative** gap is not a loss either — it means Papa had granted stars the tablet had not yet picked up. Grant nothing.

- [ ] **Step 3:** For each kid with a positive gap, grant that many stars from the admin's star-grant control, with the reason:

  ```
  Restored: stars earned offline before the sync fix 補回離線時得到的星星
  ```

  One grant per kid, not one per star. It is honest, it is auditable in the ledger, and Papa can explain it in one sentence.

- [ ] **Step 4:** If every gap is zero, grant nothing and say so. Do not manufacture a correction.

- [ ] **Step 5:** Tell the kids. A star that appears with no explanation is confusing; *"the app lost some of your stars when you were outside, here they are back"* is a fine thing for a kid to hear and costs nothing.

---

## Task 2: The airplane-mode drill

Run on **each** physical tablet, with its own profile. Not in a desktop browser, not with devtools throttling — real airplane mode, on the device the kid actually uses. Devtools offline mode does not reproduce Android's PWA startup path, and that path is where D-3 lived.

For each tablet, in order:

- [ ] **Step 1:** Wifi on. Note the star count. Confirm the admin agrees. → §6.6 territory.
- [ ] **Step 2:** Airplane mode on. Force-quit the app. Reopen cold.
  - App loads. Day list renders. Star count is the same as step 1. **Not zero, not empty.** (fixes D-3)
- [ ] **Step 3:** Complete the Brain Gym daily three.
  - Count goes up by 1 immediately, with the normal celebration.
- [ ] **Step 4:** Force-quit again, still offline. Reopen.
  - Count still shows the new value. (fixes D-1)
- [ ] **Step 5:** Wifi back on. **Do not reload.** Watch the star pill for 60s.
  - The count does **not** change. (the no-flicker guarantee)
  - Within 30s the star appears in the admin ledger with its full bilingual reason.
- [ ] **Step 6:** From the admin, grant +2. Tablet rises within 15s without being touched.
- [ ] **Step 7:** From the admin, revoke those 2. Tablet drops within 15s.

Any step failing stops the drill. Record which step, on which device, and report — do not patch on the spot and re-run.

---

## Task 3: Close out

- [ ] **Step 1:** Fill in the completion note below.
- [ ] **Step 2:** Update `CLAUDE.md`'s "Approved plans currently pending" line: move `2026-07-29-star-source-of-truth` from pending to done, or drop it from the pending list, following whatever convention the neighbouring entries use.
- [ ] **Step 3:** `node scripts/check.mjs` one last time on the final tree.
- [ ] **Step 4:** Do **not** delete any file from this plan directory. `CLAUDE.md`: *"Never delete project files."* The slices stay as the record of why the sync works the way it does.

---

## Completion note

**Drill run on:** `____-__-__` Asia/Taipei

| Kid | Device | Gap re-granted | §6 checks 1–7 | Notes |
|---|---|---|---|---|
| lucien | | | | |
| lili | | | | |
| luis | | | | |

**Anything that did not pass:**

---

## Notes for the implementer

If a tablet fails step 2 (still empty or zero on a cold offline start) after slice 50 shipped, the likely cause is the service worker never installing the new shell — check that `CACHE_NAME` was bumped in *every* slice that changed a precached file, and that the device is actually running the new cache. `KNOWN_ISSUE.md` also records that the installed PWA does not launch at all on Android 8.1.0; if this is that tablet, use Chrome directly and note it, rather than treating it as a new failure of this plan.

Do not extend the drill into a general regression test of the app. Seven checks, three tablets, done.
