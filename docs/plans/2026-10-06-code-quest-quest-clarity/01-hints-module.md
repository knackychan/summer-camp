# Slice 01: Hints module

**Status:** Design approved by Papa 2026-10-06 (`design.md` D1, D4, D5, D6). Built 2026-10-06; unit tests green.
**Goal:** One pure module that knows, for any quest, which skills it needs, how hard it is, its three hints and a peek at its solution.
**Depends on:** —
**Files:** `js/games/codequest/hints.js` (new), `js/games/codequest/model.js` (one `export`), `sw.js`, `scripts/codequest-hints.test.mjs` (new).

## Change

- **`model.js`**: `function requirementPresent` → `export function requirementPresent`. Nothing else.
- **`hints.js`** (ES module, no DOM, no `S`):
  - `SKILLS`: one entry per tag that appears in any `level.requires` (today: `repeat if else call let return target forOf on signal state companion property expression member params arguments`), each `{ icon, name:[en,zh], why:[en,zh] }`. Names per D1. `params` and `arguments` share one entry (`param`).
    - Rune 🪨 why: "A Rune is a function: build the steps once, use them again and again." / "符文就是函式：步驟做一次，就能一直重複使用。"
    - Repeat 🔁 why: "Repeat does the same card many times, so the program stays short." / "重複可以讓同一張卡做很多次，程式就不會太長。"
    - If ❓ why: "If lets the hero look first and only act when it is needed." / "如果讓英雄先看一看，需要時才行動。"
    - the rest written in this slice, same length and tone.
  - `TEACH`: `{ q01:'sequence', q02:'direction', q03:'action', q04:'combat' }` + SKILLS-shaped entries for those four tags.
  - `skillsFor(level)` → array of SKILLS entries, de-duplicated, in `requires` order; `params`/`arguments` → one; `expression` and `member` dropped when `property` is present. Empty `requires` → `[TEACH entry]` if any, else `[]`. Tagged `{ teach: true }` when from TEACH.
  - `difficultyFor(level)` → `'easy' | 'medium' | 'hard'` per D5 (TEACH chips count as 0).
  - `HINTS`: object keyed by quest id, each `{ gentle:[en,zh], strong:[en,zh], near:[en,zh] }`. This slice ships it with **q12 only** (Papa's case) as the worked example:
    - gentle: "Good try! The golem is tough — one hit won't be enough." / "很棒的嘗試！魔像很強壯，打一下不夠。"
    - strong: "Put Attack with a 🔁 Repeat sticker in the 🪨 Rune row, then put the 🪨 card in the Hero row." / "把貼了 🔁 重複貼紙的攻擊放進 🪨 符文那一排，再把 🪨 卡片放到英雄那一排。"
    - (No count in the strong hint: with the Training Blade the golem needs 4 hits, with the Bronze Blade 2; the peek shows the reference's own shape.)
    - near: "Nearly! Your Hero row can start like this:" / "快成功了！英雄那一排可以這樣開始："
  - `hintFor(level, tier)` (`tier` 0 gentle, 1 strong, 2 near) → `[en,zh]`. Missing entry or tier → fallback built from `skillsFor` ("Look at the quest card: this quest needs 🪨 Rune + 🔁 Repeat." / "看看任務卡：這一關需要 🪨 符文＋🔁 重複。"; with no skills: "Look at the goal flag 🏁 and try one card at a time." / "看看目標旗子 🏁，一次試一張卡。").
  - `peekFor(level)`: card rooms (`codingView !== 'code'`) → `{ kind:'cards', nodes: reference.main.slice(0, 3), more: reference.main.length > 3, rune: reference.functions.rune || null }`; code rooms → `{ kind:'code', lines: first 3 non-empty lines of toJavaScript(reference.main, reference.functions), more }`. Uses the existing `toJavaScript` (the one `codequest.js` `sourceFromAst` calls).
  - `missingSkills(level, program, functions)` → SKILLS entries for each `requires` tag where `requirementPresent` is false (same folding as `skillsFor`).
- **`sw.js`**: add `./js/games/codequest/hints.js` to `APP_SHELL`, bump `CACHE_NAME`.

## DONE WHEN

- `scripts/codequest-hints.test.mjs`:
  - every tag in every `LEVELS[i].requires` has a SKILLS entry (via `skillsFor`) with non-empty EN and 中文 name and why;
  - `skillsFor(q12)` = Rune, Repeat; `skillsFor(q01)` = Sequence (teach); `skillsFor(q26)` shows one parameter chip;
  - `difficultyFor`: q01 easy, q05 medium, q12 hard, and every quest returns one of the three;
  - `hintFor` returns non-empty EN + 中文 for all 72 quests × 3 tiers (fallback allowed except q12);
  - every hand-written hint: ≤ 110 chars EN, no digit followed by "hit"/"punch"/"attack" (EN) or "下" (中文), none of "wrong", "didn't work", "failed", "錯", "失敗";
  - `peekFor` works for all 72 quests; card peeks hold ≤ 3 nodes; code peeks ≤ 3 lines;
  - `missingSkills(q12, [], {})` = Rune, Repeat; with q12's reference = `[]`.
- `node scripts/check.mjs` green.
