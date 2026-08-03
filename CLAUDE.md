# Summer Quest — project rules

## What this is
Family summer app: 3 kid profiles on tablets + Papa admin. Static site (GitHub Pages/Vercel) + Supabase free tier. Spec: docs/SPEC.md — follow it literally; it wins over improvisation.

## Non-negotiables
- **Never commit secrets.** js/config.js is gitignored; service_role key must never exist in this repo in any form.
- **Bilingual invariant:** every *kid-facing* string ships EN + 繁體中文 (Taiwan usage: 公車, 起司, 腳踏車). A kid-facing string without 中文 is a bug. Admin operator chrome is English-only (decision D23, 2026-07-27).
- **Coach, not cop:** late/locked states invite, never shame. No red-for-late, no punishments. No per-minute tracking. Screen-time is indicated, not enforced — **exceptions:** (1) games are blocked on a block Papa sent back for a redo, per docs/plans/2026-07-26-homework-lock-drills-outing/ (its automatic unticked-activity-block lock was removed by Papa's decision 2026-08-03 — games are free all day by default now); (2) the daily Brain Gym trio gates games until done, then games stay open the rest of the day (brain-gym design.md §6); (3) Papa can lock the Games category for a kid generally, from admin.html, same mechanism as Activities/Learn/Ask/Captain — persists until Papa unlocks it; (4) Papa can pause a kid's whole app (slice 08) — always Papa-triggered, never automatic. Outside these, guides, Learn, My Day, and ask channel are never locked.
- **Offline-first:** games and My Day must work with wifi off. Sync is additive; the app never blocks on network. Missing config.js ⇒ clean local-only mode.
- **Don't touch working gameplay** (games, vocab data, mission pools, seeding) unless the task explicitly says so. Mission *assignment* stays client-side and date-seeded; only *state* syncs.
- **Stars are a ledger** (sum of stars_ledger deltas), never a stored counter.
- **Never delete project files.** No plan, design doc, prototype or asset gets removed because it looks superseded — `docs/plans/2026-07-27-admin-ops-redesign/admin-prototype.html` is the reference the admin shell was ported from and stays in the repo. Supersede by writing a newer doc that says so; if a file is genuinely obsolete, say so and let Papa decide. A slice that says "delete X" is amended, not obeyed (decision 2026-07-27).
- Tablet-first UI: coarse-pointer targets, no hover-dependent interactions.

## Workflow
- Read docs/SPEC.md priorities; work one tier at a time; a tier is done only when its DONE WHEN passes.
- **Plans & brainstorms:** every brainstorm/planning session writes to `docs/plans/YYYY-MM-DD-<topic>/` — a `design.md` (decisions + rationale, marked approved by Papa) plus sliced plan files `NN-<slice>.md`, each with its own dependencies and DONE WHEN. Slices ship independently. Where a design.md and SPEC.md disagree, the newer approved design wins for its features. Approved plans currently pending: `docs/plans/2026-07-26-homework-lock-drills-outing/` (slices 01–08), `docs/plans/2026-07-26-brain-gym/` (slices 09–11), `docs/plans/2026-07-27-admin-ops-redesign/` (slices 19–29 — supersedes `2026-07-26-admin-layout/` for admin layout), `docs/plans/2026-07-27-solar-system/` (slices 30–34 — fills the game-platform "real 3D game" slot; requires game-platform slices 15, 16 + 21 (21 written 2026-07-27); its D7 retires the Android 8 / Chrome < 80 baseline, superseding game-platform §6's Three.js pinning; see HANDOVER_solar_system.md for the two-phase execution program), `docs/plans/2026-07-28-music-room/` (slices 35–43 — piano, Moog synth, MPC pads + finger-drumming trainer; three registry-native instruments on the game-platform `ctx` contract. Its D2 rules out mic, MIDI and any networked/band-sync feature; D10 keeps `js/drills.js` untouched and uncoupled), `docs/plans/2026-07-29-star-source-of-truth/` (slices 49–53 — the tablet stops keeping its own star counter; `star_totals` is truth, the offline queue is the only local addition. Its D7 removes `progress[kid].stars` from the shape and D8 replaces the `check.mjs` star-provenance gate rather than letting it go vacuous. Slices 50/51 also fix an offline boot silently discarding every tick, star and best score of the session).
- After ANY edit to index.html or js/: run `node scripts/check.mjs` (or /check). Red check ⇒ do not commit.
- **Android 8 baseline retired (Papa, 2026-07-27):** the Android 8 / Chrome < 80 tablet constraint is gone. Do NOT design around it — modern JS syntax and current Three.js/WebGL2 are fine. The `check.mjs` legacy-syntax scan (`?.`/`??`/`.flatMap`) still runs but is a stale guard, not a device requirement: if it ever trips on new code, relax the scan at that moment — don't contort the code to satisfy it.
- Conventional commits. Small commits per feature, not per tier.
- Timezone: all "day" computations via one shared helper pinned to Asia/Taipei.

## Verify
- `node scripts/check.mjs` — syntax + data integrity (bilingual completeness, pool alignment, no dup vocab keys, no secrets in tracked files).
