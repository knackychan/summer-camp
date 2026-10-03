# Code Quest redesign — camera, art, screen

**Approved by Papa:** 2026-10-03 (chat)
**Game id:** `codequest` (unchanged)
**Supersedes:** in `docs/plans/2026-10-03-code-quest/` — slice 02's camera decision ("angled side / three-quarter diorama, not top-down") and design.md's *Visual decision* and *UI editor decision* sections. Everything else in that design (AST, interpreter, model, progression, saves, curriculum, tower, expedition) stays in force.

## Why

Papa's review of the shipped v0.14 build (screenshots at 1280×800 and 1280×600):

- **Camera reads wrong.** The oblique slant projection squashes floor rows to ~15 px strips; wall blocks read as a brown shelf. The grid is hard to read, so planning moves is hard.
- **Rooms are corridors.** All 72 authored maps are 7–16 tiles wide with only 2–3 walkable rows.
- **Scene too small.** The canvas gets ~40 % of the screen; the editor takes the rest and is mostly empty.
- **Too cluttered.** Six stat chips, a quest card, a notice bar, three tabs, a block counter, and English + 中文 on every label.

Reference style: Papa's mock (dark dungeon, warm torchlight, stone masonry, high 3/4 view, colour-coded command cards, numbered code sequence). We take its **style and camera**, not its panel count.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **High 3/4 top-down camera** (Zelda / Gungeon style): square floor tiles, walls show a front face, sprites upright. | Grid stays legible for programming; still reads as a dungeon. Rejected: true isometric (left/right/forward hard to map for 5–7 y/o, smaller tiles); flat top-down (board game, no atmosphere). |
| D2 | **Camera fits the whole room**, integer scale only, no pan/zoom. | Rooms are ≤ 9×7 after D6, so one fixed framing shows everything the program can touch. Integer device-pixel scale keeps pixels crisp (same rule as planet-focus-readability slice 01). |
| D3 | **Sprites stay code-drawn**, redrawn larger: actors 16×24, props 16×16, Pixel Planet palette plus a 10-colour Code Quest stone/torch/skin ramp appended in `codequest/palette.js` (planet indices unchanged; the planet palette has no neutral stone or skin tone), outline + 2-tone shading. Hero gets **4 facings**. Item icons (potions, ingredients, gear) keep current frames — potion/Camp area deferred by Papa. | Papa's choice: keep the Pixel Planet method, no image assets. Top-down needs visible facing; today the hero only flips. |
| D4 | **Stage + bottom dock layout.** Scene ~65 % of height; dock = program strip + command library + big Run. | Program reads left-to-right like a sentence (the reference's Code Sequence). Scene and program visible together while planning. |
| D5 | **One language on screen at a time**, EN default, EN/中 switch saved per kid in `settings.codequest.lang[kid]`. | Kitchen Quest v0.8 precedent. Halves on-screen text. Every kid-facing string still ships EN + 繁體中文 (bilingual invariant holds). Written JavaScript stays English. |
| D6 | **Re-shape rooms, keep lessons.** Every authored map is redrawn as a real room ≤ 9×7 with 3–5 walkable rows. Concept, objective, available cards, `requires`, `parBlocks`, `maxBlocks` are unchanged. | Papa invited puzzle changes; this fixes the corridor feel without touching the curriculum. Reference ASTs may change only where geometry demands, and must still hit the same par. |
| D7 | **Path preview for the Explorer stage only.** Dashed arrows on the floor show where the current program walks. | Helps 4–6 y/o connect cards to movement. From Builder stage on (Repeat/IF) there is no preview — predicting is the puzzle. |
| D8 | **Presentation layer only.** `model.js`, `interpreter.js`, `ast.js`, `parser.js`, `progression.js`, `loot.js`, `run.js` rules and save shape do not change (map strings in `levels.js`/`run.js` are content, see D6). | "Don't touch working gameplay" — the redesign is a view + content change. |
| D9 | **Old renderer kept.** `js/games/codequest/dungeon-view.js` stays in the repo, no longer imported. Papa decides later whether to remove it. | Never-delete rule. |

## Camera + renderer (`js/games/codequest/room-view.js`)

- Pure projection of `model.snapshot()`; no model or DOM knowledge beyond the canvas.
- Logical buffer: `T = 16` px per tile. Floor tile at `(x*T, y*T + top)`. A wall tile is a block: 16 px top + 8 px front face (`F = 8`). The back wall row shows its face; the front row is a low rim so nothing is hidden.
- Buffer size = room size in tiles × T, plus a fixed masonry margin. The canvas is sized to the stage in device pixels; `scale = max(1, floor(min(stageW/bufW, stageH/bufH) * dpr)) / dpr`; the room is centred; leftover space is dark masonry backdrop, never flat black.
- Draw order: backdrop → floor (2 stone variants, cracks seeded by `x,y`) → floor markings (exit rune, traps, plates, platforms, path preview) → depth-sorted verticals by `y` then `x` (walls, doors, gates, props, enemies, companion, hero) → FX → light layer.
- Light: torch pools in stepped palette bands with ordered-dither edges, edge vignette; 2-frame flicker. Hit shake 2 logical px; both off under `prefers-reduced-motion`.
- Keeps today's renderer inputs: `time`, `now`, `kidColor`, `heroState`, `heroMotion`, `enemyMotions`, `fx`, `paused`; adds `preview` (array of `{x,y,dir}`) and returns `anchors` for the speech bubble.

## Sprites (`js/games/codequest/pixel-art.js`, same API)

- `drawSprite(ctx, id, x, y, scale, {accent, flip})` and `spriteSize` unchanged; `CODEQUEST_SPRITE_IDS` keeps every existing id (renderer test asserts them).
- Hero: `hero-{s,n,e}-{idle,walk-1,walk-2,attack,hurt}`; west = east mirrored. Accent = kid colour. Old `hero-idle` etc. stay as aliases to the south frames.
- Enemies: 2-frame idle (`-0`/`-1`), plus existing ids aliased to frame 0.
- New: wall top/face tiles, floor variants, torch sconce, banner, pillar, rubble, skull decor.

## Screen

```
┌ ← Games ─────────────── Map · Camp · </> · EN/中 · ❚❚ ┐   host bar (settings())
│ ⚑ Reach the exit                         ♥♥♥♥♡  🔑1 │   overlays on the scene
│                                                     │
│                 [ dungeon room, 3/4 ]               │   stage ~65 %
│                                                     │
├─────────────────────────────────────────────────────┤
│ [1 ↑][2 ↑][3 ↱][ + ][ + ]                  ↶  │ ▶    │   program strip
│ [↑ Move][↰ Left][↱ Right][⚔ Hit][⟳ Repeat]     │ RUN  │   command library
└─────────────────────────────────────────────────────┘   Step · Reset beside Run
```

- **Goal pill** (top-left): icon + one line. Tap ⇒ objective checklist popover.
- **Hearts** (top-right) + key / potion counts only when the room uses them.
- **Program strip**: numbered slots; empty dashed slots up to `maxBlocks` (the budget is visible — no "0/5 blocks" counter). Repeat / IF are coloured brackets around their cards. Tap a card ⇒ small toolbar ◀ ▶ ✕ Wrap. ↶ Undo at the strip end. Running card glows.
- **Command library**: big icon cards, one word, colour per category — move blue, turn purple, attack red, interact gold, wait green, logic violet.
- **Run** big, green; Step and Reset smaller beside it.
- **Speech bubble** replaces the notice bar: appears over the hero for ~3 s only when something happens ("Bonk — wall!", "Got the key!"). Coach, not cop: no red, no shame wording.
- **Rune function**: a second strip "ƒ Rune" appears only in rooms that offer Call.
- **`</>` Code sheet**: full-height sheet with the canonical JS view, hybrid view, written-code editor and event debugger (Architect content unchanged, re-laid out).
- **Map / Camp**: same dialogs, restyled to the new palette and one language.
- Removed from the main screen: stat chips, quest card, notice bar, editor tabs, block counter, representation switcher (moves into the Code sheet).
- Tablet-first: every tap target ≥ 48 px, no hover-only affordances, no page scroll in landscape.

## Path preview (D7)

Built by running the current program on a throw-away `CodeQuestModel` created from the same level + current snapshot state, stepping the interpreter to completion and collecting hero positions/facings. Pure, bounded by the interpreter's existing budget. Shown only when `modeFor(profile) === 'explorer'` and the program changed since the last Run; hidden while executing.

## Rooms (D6)

- Authored `LEVELS` (72), `generateEndless` templates, and `run.js` encounter maps are redrawn ≤ 9×7, 3–5 walkable rows, decor walls / pillars for shape.
- Gate: `node scripts/codequest.test.mjs` stays green unchanged in intent — every reference solves, par matches exactly, Tower floors and expedition encounters verify.

## Out of scope

Model rules, combat, alchemy, loot, progression, save shape, curriculum order, new mechanics, audio.

## Slices

| # | Slice | Depends on |
|---|---|---|
| 01 | Sprite atlas redraw | — |
| 02 | `room-view.js` 3/4 renderer | 01 |
| 03 | Screen shell + language switch | 02 |
| 04 | Program strip editor + path preview | 03 |
| 05 | Room reshape + solver gate | 02 |
| 06 | Code / Map / Camp sheets + UI harness | 03, 04 |

05 can run in parallel with 03–04.
