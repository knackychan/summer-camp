# Handover — Solar System game (3D) + its game-platform foundation

**Date:** 2026-07-27 · **Status:** planning 100 % complete and approved by Papa — **no game code exists yet**
**This is a two-phase program:** Phase 0 builds the game-platform foundation the 3D game stands on; Phase 1 builds the Solar System itself.
**Plan folders:** `docs/plans/2026-07-26-game-platform/` (Phase 0) · `docs/plans/2026-07-27-solar-system/` (Phase 1)
**Visual draft:** `docs/plans/2026-07-27-solar-system/design-preview.html` (open in a browser — illustrates the target; the docs win over the mockup)

## What exists today

| Piece | State |
|---|---|
| Solar: `design.md` (D1–D9), `art-direction.md`, `tech-spec.md` — all binding | ✅ approved |
| Solar: slices `30`–`34` | ✅ written, unexecuted |
| Platform: `design.md`, slices `15` (registry host), `16` (persistence) | ✅ written earlier, unexecuted |
| Platform: slice `21` (3D seam, D7-simplified) | ✅ written 2026-07-27, unexecuted |
| Platform: slices `17`–`20` (migrating the old nine games) | ⛔ **OUT OF SCOPE for this run** — solar doesn't need them; they're a separate program |
| `js/games/`, `js/vendor/` | ❌ do not exist |

**Execution order:** solar `30` (zero deps — warms up the workflow) → platform `15` → `16` → `21` → solar `31` → `32` → `33`; solar `34` (pixel-art textures) any time after `31`.

## The prompt — paste this into the new agent session

```text
You are implementing the Summer Quest Solar System game AND the game-platform
foundation it stands on. Summer Quest is a bilingual (EN + 繁體中文) kids' tablet
app; the repo root is the summer-quest/ folder. This is a two-phase program:
Phase 0 = game-platform slices 15, 16, 21 (docs/plans/2026-07-26-game-platform/).
Phase 1 = solar slices 30–34 (docs/plans/2026-07-27-solar-system/).

READ FIRST, in this order, before writing any code:
1. CLAUDE.md                                   — project non-negotiables (they win)
2. docs/plans/2026-07-27-solar-system/design.md         — solar decisions D1–D9 (D7 retires
   the Android 8 baseline; D8 merges Explore/Orbit; D9 gates the pixel-art tooling)
3. docs/plans/2026-07-27-solar-system/art-direction.md  — BINDING visual bible
4. docs/plans/2026-07-27-solar-system/tech-spec.md      — BINDING engineering bible
5. docs/plans/2026-07-26-game-platform/design.md        — registry/ESM/3D-seam rationale
6. The slice file you are executing (platform 15/16/21, then solar 30–34)
Optionally open docs/plans/2026-07-27-solar-system/design-preview.html in a browser
to see the approved look and interaction. The docs bind, the mockup illustrates.

EXECUTION ORDER (one slice at a time, task by task, ticking checkboxes):
  solar 30 (zero deps, start here)
  → platform 15 (registry + ESM host) → 16 (generic persistence) → 21 (3D seam)
  → solar 31 (living scene) → 32 (focus zoom + wiki card) → 33 (quiz)
  → solar 34 (pixel-art textures) any time after 31.
Do NOT touch platform slices 17–20 (old-game migrations) — out of scope.

HARD RULES — violating any of these is a bug:
- art-direction.md and tech-spec.md are binding. Never improvise a colour, component,
  motion, value or structure. If a needed decision is bigger than small, STOP and ask me.
- Every kid-facing string ships EN + 繁體中文 (Taiwan usage). All prose lives in
  solar-data.js / solar-sim.js / solar-quiz.js — solar.js contains zero prose.
- Offline-first: every new file or asset goes into sw.js APP_SHELL with a CACHE_NAME
  bump in the SAME commit. The app must work with wifi off.
- Coach, not cop: no shaming, no timers, no red failure states. Stars are a ledger via
  ctx.finish({score, stars}); solar has bestKey: null and never writes game_stats.
- First-party code avoids ?. ?? .flatMap while scripts/check.mjs's legacy-syntax scan
  exists (the Android 8 device constraint itself is retired — D7; don't design around
  old browsers, just don't trip the scan). js/vendor/ is third-party and exempt.
- Tablet-first: ≥44px touch targets, no hover-dependent interactions.
- Platform slices 15/16 must preserve behaviour exactly: all existing games keep
  working through the legacy path; per-slice DONE WHENs are the acceptance bar.

WORKFLOW:
- After ANY edit to index.html or js/: run `node scripts/check.mjs` — red means stop.
- Run the slice's node tests (e.g. `node --test scripts/registry.test.mjs`,
  `node --test scripts/solar-data.test.mjs`).
- Conventional commits, one per task (feat(games): ...).
- Serve locally with `npx serve .` (ES modules don't run from file://).

HUMAN CHECKPOINTS — do not simulate these; stop and hand them to me:
- Any step that says "on the tablet" (platform 15 Task 1 module probe — trivial under
  D7 but still confirmed on device; platform 21 Task 1 WebGL2 probe and Task 4 cube
  proof; every solar slice's tablet task).
- Solar slice 34, Task 1 (tooling route decision) and Task 3 (I review the eight
  pixel-art planet maps together as a set — no solo sign-off).

A slice is done only when its DONE WHEN section fully passes. When you finish one,
report what shipped, what's verified, and which slice is next.
```

## Notes for whoever picks this up mid-flight

- Slice files follow the repo's plan conventions (goal / constraints / file structure / tasks / DONE WHEN). Keep them updated if reality diverges — amend docs, don't smuggle changes.
- `CLAUDE.md`'s pending-plans list includes this plan; update it as slices ship.
- The preview's photo hotlinks (Wikimedia) are **preview-only** — the app vendors NASA photos into `assets/solar/` (slice 32, Task 1) so they work offline.
- Platform slices 17–20 (migrating the nine existing arcade games into the registry) are deliberately excluded from this program: solar is registry-native and doesn't need them. They become their own handover when Papa wants the scalability win.
- If a future design change contradicts these docs, the change is written into the docs FIRST (project rule: supersede by writing), then the code follows.
