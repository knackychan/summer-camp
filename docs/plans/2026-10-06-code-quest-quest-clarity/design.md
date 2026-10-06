# Code Quest: quest clarity — say the rule up front, hint when stuck, explain the win

**Status:** Design approved by Papa in chat, 2026-10-06. Not started.
**Game id:** `codequest`.
**Builds on:** `2026-10-03-code-quest/`, `2026-10-03-code-quest-redesign/`, `2026-10-05-code-quest-facing-and-rune/`, `2026-10-05-code-quest-simple-cards/`. All of them stay in force; this plan supersedes nothing.

## Why

Papa played q12 "Loop Golem". Nothing on screen says the quest needs a Rune **and** a Repeat. He found out by trial: Run was refused with "This quest needs the 🪨 Rune card…", he fixed that, Run was refused again for Repeat. The rule existed all along, in `level.requires`, but only the refusal ever said it, one requirement at a time.

What the code does today (checked 2026-10-06):

| Thing | Today |
|---|---|
| Required skills | `level.requires` (e.g. q12 `['call','repeat']`). `model.begin()` refuses a Run missing one, but returns only the **first** missing one (`model.js` `begin`, `requirementPresent`). |
| Refusal message | `codequest.js` `beginIfNeeded`: `repeat` → `needRepeat`, `if` → `needIf`, **anything else** → `needCall` ("needs the 🪨 Rune card"). A code room missing `let`, `forOf`, `signal`… is told to use a Rune. Bug. |
| Topic | `level.concept` shows on the quest map and in the 🏁 goal pop, never at entry. |
| Win condition | `level.objective` → the goal-pop checklist (`objectives()`), closed at entry. |
| Help when stuck | None beyond the per-action bubble messages. |
| Win card | "Quest clear! Your program worked." + size/par + loot. No word about the skill. |

Two facts that shape the hints:
- **Hit counts depend on gear.** q12's golem has 4 HP; the Training Blade does 1 damage, the Bronze Blade (q08 reward) does 2. A hint that says "3 punches" (as the brief proposed) or even "4 hits" is wrong for some kids. Hints never state a number of hits.
- **Running again is normal.** Code Quest is turn-based: Run plays the program, the dungeon takes its turn, the phase returns to programming, and many rooms (q18 "Read the Signal") are designed to be Run again unchanged. A Run that ends without a win is not a failed attempt.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Words: the game's own.** Skills are named as the cards already name them: Rune 符文, Repeat 重複, If 如果, Else 否則. Code-room skills use the words the Code toolbox already uses (variable 變數, parameter 參數, return 回傳, for…of, signal 訊號, event 事件, state 狀態, companion 夥伴, property 屬性). The brief's 函式 / 條件 are not used as skill names; "function 函式" may appear once in Rune's *why* line as the real-world word. | Papa, 2026-10-06. Kids already see 符文 / 如果 on their cards; two names for one card is worse than either. |
| D2 | **The rule is said before the first Run.** On entering a quest from the map, a quest card opens over the room: title + region, 🎯 the win checklist (the existing `objectives()` rows), **"This quest needs 這一關需要:"** + one chip per required skill, difficulty pips, 💡 the gentle hint, [Start 開始]. Quests with no `requires` show **"You'll practise 練習:"** + their `teach` chip instead. Not shown on Reset room, Replay, Infinite Tower floors or expedition rooms. The Rune coach (simple-cards D6) opens after Start, as today. | Papa: "it is not specified anywhere that I need to use a Rune". The model enforces `requires`; the kid must hear it before the model does. |
| D3 | **A refused Run names every missing skill, correctly.** `requirementPresent` in `model.js` becomes exported (one word, no behaviour change). On `missing-concept` the UI checks all of `level.requires` and says, e.g. "This quest needs 🪨 Rune + 🔁 Repeat. You still need: 🔁 Repeat." / "這一關需要 🪨 符文＋🔁 重複。還差：🔁 重複。" Each skill uses its `SKILLS` label, so `let` says variable, not Rune. `needRepeat` / `needIf` / `needCall` stay in `strings.js` (still used elsewhere or harmless) but `beginIfNeeded` stops picking among them. | Fixes the one-at-a-time discovery and the "everything else is Rune" bug. `model.begin()` itself is untouched. |
| D4 | **Skill chips come from data, not a new field.** `skillsFor(level)` maps `level.requires` through a `SKILLS` table (icon, name EN/中文, one *why* line EN/中文). `params` + `arguments` show as one chip ("parameter 參數"); `expression` and `member` fold into "property 屬性" when it is also required, else show alone. q01–q04 have no `requires`; a `teach` entry in `hints.js` gives them Sequence 順序, Direction 方向, Action 動作, Combat 戰鬥. | `requires` is already enforced by the model, so the chips can't disagree with what Run checks. |
| D5 | **Difficulty is computed.** `difficultyFor(level)`: count the chips from D4; 0 → Easy 簡單 ●, 1 → Medium 中等 ●●, ≥ 2 or `parBlocks ≥ 10` → Hard 困難 ●●●. Shown as pips + word on the quest card, the goal pop and the quest-map rows. Never stars (stars are the ledger). | Papa, 2026-10-06: worked out from data. No field to keep in step with 72 quests. |
| D6 | **Three hint tiers per quest, all 72.** `HINTS[id] = { gentle, strong, near }`, each `[en, zh]`.<br>• **gentle** — what to notice, no skill name ("The golem is tough. Hitting once won't be enough.").<br>• **strong** — names the skill and its job ("Put Attack in the 🪨 Rune, give it a Repeat sticker, then use the 🪨 card in the Hero row.").<br>• **near** — one line + a **peek**: the first 2–3 cards of the quest's `reference.main` (card rooms, drawn as small cards with their stickers) or its first 3 lines of `toJavaScript(reference)` (code rooms), with "…". The peek is built from `reference` at runtime, so it can't drift from a solution `solveLevel` already proves.<br>Rules for every hint: no hit counts, no "wrong" / "didn't work" / "failed"; ≤ 110 characters EN. The gentle hint is first read on the quest card, before any try, so it never opens with "Good try!"; strong and near may ("Nearly!", "Look at…"). | Papa chose all 72 quests. Generated peeks keep the most precise tier correct by construction; hand-written gentle/strong keep the nudge specific to the room. |
| D7 | **When the next tier shows: stuck signals only.** Tier starts at 0 (gentle, already on the quest card). Each stuck signal moves it up one (max 2 = near) and shows it in the speech bubble:<br>• the hero has to rest (phase `resting`);<br>• Reset room pressed after at least one Run since the last Reset;<br>• a Run refused for `missing-concept` or `too-many-blocks`.<br>A plain Run that ends back in programming never counts. When a refusal names a missing skill, the bubble shows the D3 message first and the hint after it. The current tier's hint also sits in the 🏁 goal pop, so it can be reread after the bubble steps aside. Tier resets when another quest starts. Nothing is saved. | Papa, 2026-10-06. Turn-based play makes "Run again" a strategy, not a mistake. Session-only state keeps profile v12 unchanged. |
| D8 | **The win card explains the skill.** Under "Quest clear!": "You used 🪨 Rune + 🔁 Repeat." / "你用了 🪨 符文＋🔁 重複。" (the D4 chips; true by construction because the model refused any Run without them), then each chip's *why* line, then "Next: *Key Crypt* — 🔁 Repeat with keys and doors." built from the next quest's title + chips. Quests with no `requires` say "You practised: ➡ Sequence." Nothing after the last quest. | Brief's "success explanation"; derived, so no new text per quest. |
| D9 | **Unchanged:** `levels.js` (maps, par, references, `requires`), `interpreter.js`, `parser.js`, `ast.js`, `model.js` except the `export` of D3, block counting, stickers, the two rows, the picker, the Lab, stars, offline, profile shape. Expedition and Tower rooms get no quest card, chips or hints (generated, no fixed solution). | Presentation and text only. |

## Units

| File | Change |
|---|---|
| `js/games/codequest/hints.js` (new, pure) | `SKILLS`, `TEACH`, `HINTS`, `skillsFor(level)`, `difficultyFor(level)`, `hintFor(level, tier)`, `peekFor(level)` (returns `{ kind: 'cards', nodes }` or `{ kind: 'code', lines }`), `missingSkills(level, program, functions)` |
| `js/games/codequest/model.js` | `export` on `requirementPresent` only |
| `js/games/codequest.js` | quest card dialog, chips/pips in goal pop + map rows, D3 refusal, hint tier state + stuck signals, win-card lines |
| `js/games/codequest/strings.js` | quest-card / win-card / difficulty UI words (EN + 中文) |
| `css/codequest.css` | quest card, chips, pips, peek |
| `sw.js` | add `hints.js` to `APP_SHELL`, bump `CACHE_NAME` |
| tests | `scripts/codequest-hints.test.mjs` (new), `scripts/check-codequest-ui.py` |

## Slices

| # | Slice | Depends on |
|---|---|---|
| 01 | `hints.js` skeleton: SKILLS, TEACH, skillsFor, difficultyFor, peekFor, missingSkills, HINTS shape + test | — |
| 02 | Quest card at entry; chips + pips in goal pop and quest map | 01 |
| 03 | Refusal names every missing skill (D3) | 01 |
| 04 | Hint ladder on stuck signals (D7) | 01, 02 |
| 05 | Win card explains the skill (D8) | 01 |
| 06 | Hint text: the 24 card rooms (q01–q20, q21, q43, q45, q46) | 01 |
| 07 | Hint text: code rooms q22–q42 | 01 |
| 08 | Hint text: code rooms q44, q47–q72 | 01 |

01 ships first. 02–05 and 06–08 are independent of each other. Until a quest's text slice ships, `hintFor` falls back to a line built from its chips ("Look at the quest card: this quest needs 🔁 Repeat." / "看看任務卡：這一關需要 🔁 重複。"), so the ladder works for every quest from day one. Each text slice makes the test strict for its range; after 08 all 72 are strict.
