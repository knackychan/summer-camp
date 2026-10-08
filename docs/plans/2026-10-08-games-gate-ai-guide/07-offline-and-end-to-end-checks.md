# Slice 07 — Offline and end-to-end checks, CLAUDE.md amendment

**Implements:** design.md D12, §10; closes the plan.
**Depends on:** slices 01–04 (and 05–06 if they were built).

## Changes
- **`scripts/check-games-gate-ui.py`** (new, Chrome 138 + current Chromium, 1024 × 600 and 1280 × 800):
  1. Gate off → Games opens as before.
  2. Gate on, Lili 35 / 50 → card, no red pixels in the bar, both languages present, gift line present.
  3. Brain Gym undone → Brain Gym card first with the 30-points line. After the trio, the points card if still short.
  4. Guide → 2 questions → 3 cards → reroll → reopen shows the saved set.
  5. **Wifi off from a cold start** (service-worker offline): the same gate result from cached points, the guide works locally, decisions queue. Back online → one row per key on the server.
  6. Papa PIN → open today. Admin Undo → closed unless reached.
  7. Reaching the threshold mid-guide opens Games without a reload. A later declined claim does not close it (D2).
  8. Practice: Brain Gym tiles open while the points gate is shut. Guides, Learn, My Day, Ask, Books and Music never show the points card.
- **`scripts/check.mjs`**: wire the new unit tests (if not done in earlier slices) and a guard that only `games`-entrance code paths call `pointsLockHtml`.
- **CLAUDE.md**: exception (5), the fixed exception (1) and the plan line were already applied at approval (2026-10-08). Here, only mark the plan shipped in the pending-plans line.
- **SPEC.md**: a short dated section, "Games gate by helping points (2026-10-xx)", pointing to this plan, as the Points section does. Move the AI-tutor P3 line to say its base (Edge Function + caps) shipped with this plan if 05–06 shipped.
- `docs/plans/2026-10-08-games-gate-ai-guide/design.md` status → shipped, with build notes.

**DONE WHEN:** `node scripts/check.mjs` green. `scripts/check-games-gate-ui.py`, `scripts/check-android8-ui.py` (Chrome 138) and `scripts/check-instant-startup.py` pass (the gate adds no network wait to the first screen). The offline service-worker test passes. A one-day family trial on the real tablets with Papa's thresholds shows no case where a kid was locked out of Learn, My Day, Ask or Brain Gym. Papa signs off.
