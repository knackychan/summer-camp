# Slice 32 — Focus zoom + holo wiki card

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping a planet (or the Sun) **zooms the camera to it** and opens the sci-fi holo **info card**: real photo, classification, bilingual wiki description, a rotating random "Did you know" fact (🔀 reshuffle), and a stats grid. ✕ or double-tap zooms back out. This is the heart of the merged design (D8) — the scene from slice 31 becomes a living encyclopedia.

**Architecture:** All new behaviour lives in `js/games/solar.js` (focus rig + card DOM) on top of slice 31's scene. Content comes entirely from `solar-data.js`'s D8 fields (`type`, `desc`, `photo`, `facts`) — the module contains zero prose. Photos are **vendored** into `assets/solar/` (NASA public domain) and precached; the 3D spheres stay flat-shaded (photography lives only in the card).

**Tech Stack:** Vendored Three.js, ES modules, `node:test`, `scripts/check.mjs`.

**Design:** `design.md` D8 · **Binding:** `art-direction.md` §5 (focus motion), §6.2 (the card, exact) · `tech-spec.md` §4 (focus rig), §9 (card data flow), §13 (assets)

**Depends on:** slice 31 (living scene); slice 30 **with its D8 schema** (`type`/`desc`/`photo` fields + `assets/solar/*.jpg`).

**DONE WHEN:**
- Offline on the tablet: tap Mars → camera glides to it, other bodies dim, the card slides in with its real photo, 火星 description, a random fact, and stats; 🔀 swaps the fact (never the same twice in a row); 🔊 speaks; ✕ and double-tap both zoom home; dragging while focused orbits *around the planet*; everything still works with wifi off (photos included).
- `node scripts/check.mjs` passes; the card's prose is provably all sourced from `solar-data.js`.

---

## Constraints you must not violate

1. **Camera moves only on request:** tap-to-focus, ✕/double-tap-to-leave, kid's own drag/pinch. No idle auto-rotate, no cinematic fly-bys (art-direction §8).
2. **Photo rules (D8):** vendored files only (`assets/solar/<id>.jpg`), never a remote URL at runtime; every `<img>` has an `onerror` fallback to the planet's flat-shaded colour gradient (a missing file degrades gracefully, never a broken-image icon).
3. **Coach, not cop:** the card invites reading and listening; nothing locks, nothing tests here (that's slice 33's quiz, which suppresses this card).
4. **Bilingual invariant:** description, classification, fact, stats labels — all EN + 繁體中文, all from data.
5. **Legacy-syntax compatible** (D7); **offline-first:** any new file/asset joins `APP_SHELL` + `CACHE_NAME` bump in the same commit.

---

## File Structure

| File | Change | Responsibility after this slice |
|---|---|---|
| `js/games/solar.js` | Modify | Focus rig (target tracking, dim-others), info card DOM + data flow, unfocus paths |
| `assets/solar/*.jpg` | Create (9 files) | Vendored NASA public-domain photos, one per body |
| `sw.js` | Modify | `APP_SHELL` gains the 9 photos; `CACHE_NAME` bumped |
| `scripts/solar-card.test.mjs` | Create | Node tests for the card's pure data-flow helpers |

---

## Task 1: The photos

- [ ] **Step 1: Download the 9 NASA/PD images** into `assets/solar/` as `<id>.jpg` (`sun, mercury, venus, earth, mars, jupiter, saturn, uranus, neptune`). Sources: NASA (PD) or Wikimedia Commons files of NASA origin — record each file's source URL + credit in `assets/solar/README.md`. Suggested (Commons `Special:FilePath`): `Mercury_in_color_-_Prockter07-edit1.jpg`, `Venus-real_color.jpg`, `The_Earth_seen_from_Apollo_17.jpg`, `OSIRIS_Mars_true_color.jpg`, `Jupiter_by_Cassini-Huygens.jpg`, `Saturn_during_Equinox.jpg`, `Uranus2.jpg`, `Neptune_Full.jpg`, and an SDO Sun image. Downscale to ≤ 640 px wide, quality ~80 — these are tablet cards, not posters.
- [ ] **Step 2: Precache** all nine + `assets/solar/README.md` in `sw.js` `APP_SHELL`; bump `CACHE_NAME`.

## Task 2: The focus rig

- [ ] **Step 1:** Per `tech-spec.md` §4: the controls' `target` lerps to the focused body's world position every frame (ease 0.15); unfocused, it eases back to the origin (0.08). Focus distance = `max(40, size × 10)` scene units, tweened 0.5 s ease-out; polar re-clamped into [0.5, 1.2].
- [ ] **Step 2:** While focused, pinch/wheel zoom clamps to `≥ size × 4`; drag orbits around the planet. Non-focused bodies render at 0.35 alpha.
- [ ] **Step 3:** Unfocus paths: card ✕, double-tap anywhere, or tapping a *different* body (which refocuses). All restore distance to the home view tween.

## Task 3: The info card

- [ ] **Step 1: DOM + styling** exactly per `art-direction.md` §6.2 — right-side glass holo panel, gold corner brackets, photo with holo ring, classification line, bilingual name + description, dashed DID-YOU-KNOW box with 🔀, stats grid, full-width 🔊 Listen button. Injected stylesheet per `tech-spec.md` §8; everything removed in `stop()`.
- [ ] **Step 2: Data flow** per `tech-spec.md` §9: `openCard(body)` renders `type`/`desc`/stats from `solar-data.js`; `shuffleFact()` picks a random fact ≠ the current one and speaks it via `ctx.sayPair`; 🔊 speaks the description; the Sun's grid uses its special cells (§9).
- [ ] **Step 3: Extract pure helpers** (`factPool(body, excludeIdx)`, `statCells(body)`) as named exports and test them in `scripts/solar-card.test.mjs`: reshuffle never repeats when pool > 1; cells for a planet vs the Sun match the §9 shapes; no cell contains `undefined`.

## Task 4: Tablet + commit

- [ ] **Step 1:** `node scripts/check.mjs` PASS.
- [ ] **Step 2: Offline tablet run** — every DONE WHEN bullet, plus: kill wifi, reopen the game, open Earth's card (photo present from precache), delete nothing.
- [ ] **Step 3: Commit**

```bash
git add js/games/solar.js assets/solar sw.js scripts/solar-card.test.mjs
git commit -m "feat(games): add solar focus zoom and the holo wiki card"
```

---

## DONE WHEN

- Focus zoom tracks orbiting planets smoothly; dim-others; zoom clamps respected; all three unfocus paths work.
- Card renders all nine bodies fully bilingual; photos offline; fallback gradient proven (rename one file temporarily → gradient, no broken image).
- Random fact never repeats consecutively; speech fires on open (fact) and on 🔊 (description).
- Zero prose strings in `solar.js` (grep it); green check; bumped cache.
