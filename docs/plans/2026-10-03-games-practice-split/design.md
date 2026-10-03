# Games and Practice split · full-screen games

Requested by Papa, 2026-10-03 (approved in the request itself): "make a category for Games and Practice, move all the apps that concern practice and make the games on their own. Remove the Dig Site game, remove the Change Maker exercise." Kitchen Quest and all 3D apps open full screen without the left rail; only the calculation/exercise apps keep it.

## Decisions

- **D1 — two Adventure categories.** Adventure now shows **Games** (🎮 遊戲) and **Practice** (🧠 練習) side by side. New hub tab `practice` (`#tab-practice`, `#practiceRow`) and registry section `section:practice`. The Pixel Planet has no new landmark; Practice is reached from Adventure, from the brain-lock card on Games, and from every route that already opened a Brain Gym exercise directly.
- **D2 — what counts as Practice.** Every `brain: true` exercise, plus the manifest's new `practice: true` flag on Key Hunt, Home Row and Word Wizard (typing and word drills). Games: Big Machines, Monster Truck, Kitchen Quest, Balloon Pop, Word Racer, Orc Attack, Solar System, Paint & Colour. Moving a tile between categories is one flag in `js/games/index.js`.
- **D3 — access rules unchanged.** Moving a tile does not change who may open it. Brain Gym still passes the games locks; Key Hunt, Home Row and Word Wizard still follow the games locks exactly as before (Coach-not-cop exceptions in CLAUDE.md are untouched). `tabLocked("practice")` is always false; individual tiles show their own lock state.
- **D4 — Brain Gym door.** The daily trio is listed first in Practice. While the trio gates games, the Games tab shows the Brain Gym card with a **Go to Practice 去練習** button; inside Practice the card points at the "today" tiles, which stay bright (`.brainlocked #practiceRow`).
- **D5 — full-screen games.** Any non-Practice game sets `body.game-fs`: no game-switcher rail; one slim row holds Back · the game's own settings bar · its stats · sound, and the stage takes the rest of the screen. Practice keeps the switcher, which now lists Practice items only. The host clears the stat row on every launch so one game's stats never leak into the next.
- **D6 — retirements.** Dig Site leaves the manifest, `LEVELS` and the offline shell; its saved best keeps syncing (same treatment as City Drive). Change Maker gets `retired: true` in `brain-data.js`: never picked for a daily trio, no tile, no `LEVELS` entry. Per the never-delete rule, `js/games/dig.js`, Change Maker's generators and its scene stay in the repo (the brain host tests drive their fake scene through it). Papa decides whether those files are removed.

## Validation

- `node scripts/check.mjs` — the BRAIN guard skips retired exercises; the brain-gate guard looks for `.brainlocked #practiceRow`. Registry test counts 16 brain exercises and 9 sections.
- `python scripts/check-kitchen-counter-ui.py` — Adventure lists both categories; exact Games set; Practice contains Brain Gym and drills with no overlap; Dig Site/Change Maker absent and unopenable; brain-locked Games → Practice button; Practice keeps a Practice-only rail; Monster Truck, Solar System and Kitchen open full screen.
