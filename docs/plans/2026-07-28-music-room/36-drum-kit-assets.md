# Slice 36 — Drum kit assets

**Goal:** Twelve small, legally clean drum one-shots vendored into the repo and precached, so the pads make sound with the wifi off.

**Architecture:** Assets, not code. Follows the `assets/audio/brain/` precedent: a README carrying per-file provenance and licence is part of the deliverable, not paperwork after the fact. Every file joins `sw.js` `APP_SHELL` — offline-first is a project non-negotiable and `check.mjs` enforces it.

**Design:** `docs/plans/2026-07-28-music-room/design.md` §1 (D6).

**Depends on:** nothing. Can run in parallel with slice 35; slice 37 needs both.

**DONE WHEN:**
- Twelve `.wav` files in `assets/audio/mpc/`, each ≤40KB, kit total ≤500KB.
- `assets/audio/mpc/README.md` names a CC0 / public-domain source for **every** file.
- `assets/audio/mpc/kit.json` maps pad slot → filename.
- `sw.js` `APP_SHELL` lists every sample; `CACHE_NAME` bumped.
- `node scripts/check.mjs` passes.
- Cold load in airplane mode: every pad sounds.

---

## Constraints you must not violate

1. **CC0 or public domain only.** No "free for non-commercial", no attribution-required samples, no ripped commercial kits. If provenance cannot be established, the sample does not ship.
2. **Every file gets a named source in the README.** "Found online" is not provenance. A URL and a licence line per file.
3. **Size discipline.** Mono, 44.1kHz, 16-bit, trimmed to the tail. ≤40KB each. This whole kit is being added to the app shell that every kid downloads — 500KB is the budget, not a target to fill.
4. **No format cleverness.** Plain `.wav`. Not mp3 (decode latency and gapless issues), not ogg (Safari), not compressed-anything. Uncompressed one-shots this short are already small, and they decode instantly.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `assets/audio/mpc/*.wav` | Create | 12 one-shots |
| `assets/audio/mpc/kit.json` | Create | slot → filename manifest |
| `assets/audio/mpc/README.md` | Create | per-file provenance + licence |
| `sw.js` | Modify | `APP_SHELL` += 13 entries, `CACHE_NAME` bump |

---

## Task 1: Source the samples

Twelve sounds, chosen so a kid can play a recognisable groove with four fingers:

| Slot | Sound | Notes |
|---|---|---|
| 1 | kick | the anchor — pick one with a short tail |
| 2 | snare | |
| 3 | clap | distinct from snare, not a layered snare-clap |
| 4 | rimshot | |
| 5 | closed hat | short |
| 6 | open hat | ≤400ms |
| 7 | low tom | |
| 8 | high tom | |
| 9 | crash | trim hard — this is the one that will blow the size budget |
| 10 | cowbell / perc | |
| 11 | shaker | |
| 12 | zap / fx | one fun one; kids will find it first |

- [ ] **Step 1: Source from CC0 or public-domain libraries.** Freesound CC0-filtered, Wikimedia/Internet Archive public-domain recordings with explicit licence text, or locally generated hits are all fine. Avoid "royalty-free" sample packs unless the page explicitly says CC0 or public domain. Record the exact source URL as you go — reconstructing provenance afterwards is miserable and usually impossible.
- [ ] **Step 2: Convert.** Mono, 44.1kHz, 16-bit. Trim leading silence to the transient (leading silence is latency you cannot calibrate away) and trim the tail where it is inaudible.
- [ ] **Step 3: Normalise to a consistent perceived level.** Peak-normalising each file separately makes the shaker as loud as the kick, which is wrong. Aim for a kit that sounds balanced when played, then leave per-pad gain trim to `kit.json`.
- [ ] **Step 4: Check sizes.** Any file over 40KB gets trimmed further, not shipped.

---

## Task 2: Manifest and provenance

- [ ] **Step 1: `kit.json`** — `{ "name": "House Kit", "samples": { "kick": {"file":"kick.wav","gain":1.0}, … } }`. The `gain` field is the per-pad trim from Task 1 Step 3.
- [ ] **Step 2: `README.md`** — a table: filename, what it is, source URL, licence, any edit applied. Mirror the tone of `assets/audio/brain/README.md`.
- [ ] **Step 3: Licence sanity pass.** Re-read each source page. CC0 and "public domain" are fine; CC-BY is not (attribution in a kids' app is a burden nobody will maintain); "free download" with no licence stated is **not** a licence.

---

## Task 3: Precache

- [ ] **Step 1:** Add all twelve `.wav` paths **and** `kit.json` to `APP_SHELL` in `sw.js`.
- [ ] **Step 2:** Bump `CACHE_NAME`.
- [ ] **Step 3:** `node scripts/check.mjs` — green.
- [ ] **Step 4: Airplane-mode test** (after slice 37 exists, or with a scratch fetch in the console): load cold, kill wifi, reload, confirm all twelve decode from cache.

---

## Notes for the implementer

The crash is the trap. A natural crash tail runs 2–4 seconds and will be 300KB+ on its own. Trim it to ~800ms with a short fade — on a tablet speaker in a noisy camp room nobody will hear the difference, and the app shell will.

If a good CC0 kit cannot be assembled, synthesizing these twelve is a legitimate fallback (a kick is a pitch-dropping sine, a snare is noise + tone, a hat is filtered noise) — it costs zero bytes and zero licence risk. It sounds more 808 than acoustic. Ask Papa before taking that route; it is a sound-design change, not an implementation detail.
