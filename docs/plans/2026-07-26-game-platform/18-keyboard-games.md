# Slice 18 — Keyboard games: Key Hunt, Home Row, Word Racer, Balloon Pop, Orc Attack

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the five keyboard games out of `index.html`, extract the word data they share, and give the registry a `key(ch)` route so `handleInput`'s per-game chain can die.

**Architecture:** Two things must come out before the games can: the **word data** (`VOCAB`, `SENT`, `LETTERS`, `WORDS_EASY`, `WORDS_HARD`, `SENTENCES`) which three of these games and the still-inline Word Wizard all read, and the **typing core** (`state.word`/`state.pos` matching, `drawWord`, `updatePlayHud`, `hintFinger`, `FINGER`) which Key Hunt, Home Row and Word Racer share. Both become their own modules first; then the five games move.

**Tech Stack:** ES modules, `node:test`, `scripts/check.mjs`.

**Design:** `docs/plans/2026-07-26-game-platform/design.md` §2, §3, §7

**Depends on:** slice 17 (the migration recipe, the test harness, `scripts/games.test.mjs`).

**Before you start — the D5 question.** Ask Papa which of these five, if any, has a gameplay rewrite planned. Any that does is dropped here and written directly in registry form in its own rewrite slice (design.md §8).

**DONE WHEN:**
- All five games play identically: same words, same speeds, same scoring, same settings bars.
- `handleInput` no longer names a game.
- The word data lives in one module and is read by `check.mjs` directly instead of by string-slicing `index.html`.
- `node --test scripts/games.test.mjs` passes.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **No `?.`, `??`, `.flatMap`** — `scripts/check.mjs:41-43`. All new files go into `runtimeFiles`.
2. **Behaviour preservation (design.md D4).** No tuning of speeds, spawn rates, word pools or difficulty. Every constant moves at its current value.
3. **`ALL_WORDS` must keep exactly one entry per English key.** `scripts/check.mjs:61-68` enforces uniqueness and 4-field shape with non-empty 中文. Moving the data must not reorder or dedupe it.
4. **The `/* finger map` marker at `index.html:913`.** Task 1 changes how `check.mjs` reads the data; until that task is done, do not move anything above line 913.
5. **`sw.js` gains every new file, `CACHE_NAME` bumped**, in the commit that creates it.

---

## File Structure

| File | Change | Responsibility after this slice |
|---|---|---|
| `js/games/word-data.js` | Create | `VOCAB`, `SENT`, `ALL_WORDS`, `LETTERS`, `WORDS_EASY`, `WORDS_HARD`, `SENTENCES`, `ORC_FIGS`, `BALLOON_COLORS`, `CUSTOMERS`. Data only. |
| `js/games/typing-core.js` | Create | `FINGER`, `fingerVar`, `hintFinger`, `drawWord`, `typingHud` — shared by hunt/home/race. Pure where possible. |
| `js/games/hunt.js` | Create | Key Hunt |
| `js/games/home.js` | Create | Home Row |
| `js/games/race.js` | Create | Word Racer, including its 60-second timer and WPM finish |
| `js/games/balloon.js` | Create | Balloon Pop, including its speed/count settings bar |
| `js/games/orc.js` | Create | Orc Attack, including its difficulty/speed/count settings bar |
| `index.html` | Modify | Deletes lines 1248-1546 and the word-data consts; `handleInput` routes to `currentGame.key` |
| `scripts/check.mjs` | Modify | Imports `word-data.js` instead of slicing the inline script |
| `sw.js`, `js/games/index.js` | Modify | Precache + `legacy:false` for five games |

---

## Task 1: Extract the word data

This is the task that unblocks everything else, and it is the one that touches `check.mjs`'s data validation. Do it carefully.

**Files:**
- Create: `js/games/word-data.js`
- Modify: `index.html:611-690`, `index.html:894-912`
- Modify: `scripts/check.mjs:46-59`

- [ ] **Step 1: Write the failing test**

Append to `scripts/games.test.mjs`:

```js
test("word-data: ALL_WORDS keeps one 4-field bilingual entry per English key", async () => {
  const W = await import("../js/games/word-data.js");
  assert.ok(W.ALL_WORDS.length > 100, "ALL_WORDS looks truncated");
  const seen = new Set();
  for (const [i, word] of W.ALL_WORDS.entries()) {
    assert.equal(Array.isArray(word), true, `entry ${i} is not an array`);
    assert.equal(word.length, 4, `entry ${i} must be [en, emoji, fr, zh]`);
    assert.ok(word[3], `entry ${i} (${word[0]}) has no 中文`);
    const key = String(word[0]).trim().toLowerCase();
    assert.equal(seen.has(key), false, `duplicate English key "${word[0]}"`);
    seen.add(key);
  }
});

test("word-data: the game pools moved intact", async () => {
  const W = await import("../js/games/word-data.js");
  assert.equal(Object.keys(W.LETTERS).length, 26, "LETTERS must cover A-Z");
  assert.ok(W.WORDS_EASY.length > 0);
  assert.ok(W.WORDS_HARD.length > 0);
  assert.ok(W.SENTENCES.length > 0);
  assert.ok(W.ORC_FIGS.length > 0);
  assert.ok(W.BALLOON_COLORS.length > 0);
  for (const pair of W.WORDS_EASY) {
    assert.equal(pair.length, 2, `WORDS_EASY entry ${pair[0]} must be [word, emoji]`);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/games.test.mjs`
Expected: FAIL — `Cannot find module '../js/games/word-data.js'`

- [ ] **Step 3: Create `js/games/word-data.js`**

Move — do not retype — these blocks from `index.html`:

- `VOCAB` (`index.html:611-643`)
- `SENT` (`index.html:644-690`)
- `ALL_WORDS` (`index.html:691`)
- `CUSTOMERS` (`index.html:893`)
- `LETTERS` (`index.html:894-897`)
- `WORDS_EASY` (`index.html:898-902`)
- `WORDS_HARD` (`index.html:903-905`)
- `SENTENCES` (`index.html:906-909`)
- `ORC_FIGS` (`index.html:910`)
- `BALLOON_COLORS` (`index.html:911`)

Wrap them as exports. The file is data only — no functions beyond the one derivation that already exists:

```js
/* Word and pool data shared by the typing games and Word Wizard.
   Moved verbatim from index.html (slice 18). Content is unchanged: reordering
   or deduping here would change what the kids see and would trip the
   uniqueness check in scripts/check.mjs. */

export const VOCAB = { /* ...moved from index.html:611-643... */ };

export const SENT = [ /* ...moved from index.html:644-690... */ ];

export const ALL_WORDS = Object.values(VOCAB).reduce(function (all, p) {
  return all.concat(p.words);
}, []);

export const CUSTOMERS = [ /* ...moved from index.html:893... */ ];
export const LETTERS = { /* ...moved from index.html:894-897... */ };
export const WORDS_EASY = [ /* ...moved from index.html:898-902... */ ];
export const WORDS_HARD = [ /* ...moved from index.html:903-905... */ ];
export const SENTENCES = [ /* ...moved from index.html:906-909... */ ];
export const ORC_FIGS = [ /* ...moved from index.html:910... */ ];
export const BALLOON_COLORS = [ /* ...moved from index.html:911... */ ];

export default { VOCAB, SENT, ALL_WORDS, CUSTOMERS, LETTERS,
  WORDS_EASY, WORDS_HARD, SENTENCES, ORC_FIGS, BALLOON_COLORS };
```

- [ ] **Step 4: Keep the inline script working**

Word Wizard and the mission pools still live in `index.html` until slice 19, and they read `VOCAB`, `SENT`, `ALL_WORDS` and `CUSTOMERS`. Rather than duplicating the data, the host hands it over.

In `js/main.js`, add near the top:

```js
import * as WORDS from "./games/word-data.js";
window.SQWords = WORDS;
```

In `index.html`, replace the ten deleted `const` blocks with one line at the same position (so the `/* finger map` marker at `index.html:913` stays below them):

```js
/* Word pools moved to js/games/word-data.js (slice 18). The module script is
   deferred, so these are read through SQWords at call time, never at parse time. */
const W=()=>window.SQWords;
```

Then, in the still-inline code, replace each use:

- `ALL_WORDS` → `W().ALL_WORDS`
- `VOCAB` → `W().VOCAB`
- `SENT` → `W().SENT`
- `CUSTOMERS` → `W().CUSTOMERS`

Find every use first so none is missed:

```bash
grep -n "ALL_WORDS\|VOCAB\|\bSENT\b\|CUSTOMERS\|LETTERS\|WORDS_EASY\|WORDS_HARD\|SENTENCES\|ORC_FIGS\|BALLOON_COLORS" index.html
```

`LETTERS`, `WORDS_EASY`, `WORDS_HARD`, `SENTENCES`, `ORC_FIGS` and `BALLOON_COLORS` are used **only** by the five games moving in this slice, so their uses disappear in Tasks 3–7 rather than needing `W()`.

- [ ] **Step 5: Repoint check.mjs at the module**

`scripts/check.mjs:46-59` currently evaluates a slice of the inline script to get the data. `ALL_WORDS` and `SENT` no longer live there, so inject them.

Replace the `const data = new Function(...)` call (`scripts/check.mjs:55-59`) with:

```js
  const words = await import(new URL("js/games/word-data.js", root));
  const data = new Function("SQ_WORDS", `const window={};
const VOCAB=SQ_WORDS.VOCAB, SENT=SQ_WORDS.SENT, ALL_WORDS=SQ_WORDS.ALL_WORDS;
${dayDataJs}
${actDataJs}
${dataScript}
return { ALL_WORDS, SENT, MISSIONS, BANK, ACT_GUIDE, BANK_POOL, DAY, PHOTO_POOL, PHOTO_TRICKS, LEARN_GUIDES };`)(words);
```

The existing validations below it — the `ALL_WORDS` uniqueness loop at `scripts/check.mjs:61-68` and everything after — keep working unchanged, which is the point: the data moved, the guarantees did not.

Add `"js/games/word-data.js"` to `runtimeFiles` at `scripts/check.mjs:20`, and `"./js/games/word-data.js"` to `APP_SHELL` in `sw.js` with `CACHE_NAME` bumped to `"summer-quest-v11"`.

- [ ] **Step 6: Run everything**

Run: `node --test scripts/games.test.mjs && node scripts/check.mjs`
Expected: both PASS. The `check.mjs` data validations are the ones that matter here — if `ALL_WORDS` lost an entry or gained a duplicate during the move, they fail now.

- [ ] **Step 7: Verify in the browser**

Open Word Wizard (still inline) and play a round. Expect the same words, the same 中文, the same French. Open My Day — the mission pools read `ALL_WORDS` too.

- [ ] **Step 8: Commit**

```bash
git add js/games/word-data.js js/main.js index.html scripts/check.mjs scripts/games.test.mjs sw.js
git commit -m "refactor(games): extract the shared word pools into js/games/word-data.js"
```

---

## Task 2: Extract the typing core

Key Hunt, Home Row and Word Racer share the letter-matching loop, the finger map and the play HUD. That shared code moves once, here, rather than three times.

**Files:**
- Create: `js/games/typing-core.js`
- Modify: `scripts/games.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
test("typing-core: fingerVar maps a letter to its finger CSS variable", async () => {
  const T = await import("../js/games/typing-core.js");
  assert.equal(typeof T.fingerVar("a"), "string");
  assert.equal(T.fingerVar("a").startsWith("--f-"), true);
  assert.equal(T.fingerVar("A"), T.fingerVar("a"), "must be case-insensitive");
  assert.equal(T.fingerVar("!").startsWith("--f-"), true, "unknown chars fall back, never crash");
});

test("typing-core: hintFinger names the finger bilingually or falls back", async () => {
  const T = await import("../js/games/typing-core.js");
  assert.match(T.hintFinger("f"), /f|F/);
  assert.equal(typeof T.hintFinger(""), "string");
});

test("typing-core: matchChar advances on the right key and flags the wrong one", async () => {
  const T = await import("../js/games/typing-core.js");
  const s = { word: "cat", pos: 0, correct: 0, errors: 0 };
  assert.equal(T.matchChar(s, "c"), true);
  assert.equal(s.pos, 1);
  assert.equal(s.correct, 1);
  assert.equal(T.matchChar(s, "z"), false);
  assert.equal(s.pos, 1, "a wrong key must not advance");
  assert.equal(s.errors, 1);
  assert.equal(T.matchChar(s, "a"), true);
  assert.equal(T.matchChar(s, "t"), true);
  assert.equal(s.pos, 3, "word complete");
});

test("typing-core: matchChar accepts a space against a space", async () => {
  const T = await import("../js/games/typing-core.js");
  const s = { word: "a b", pos: 1, correct: 0, errors: 0 };
  assert.equal(T.matchChar(s, " "), true);
  assert.equal(s.pos, 2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/games.test.mjs`
Expected: FAIL — `Cannot find module '../js/games/typing-core.js'`

- [ ] **Step 3: Create `js/games/typing-core.js`**

Move `FINGER`, `setF`, `fingerVar` (`index.html:914-922`) and `hintFinger` (`index.html:2376-2380`) verbatim. `matchChar` is the letter-matching branch of `handleInput` (`index.html:2358-2373`) lifted into a pure function — the same comparisons, the same counters, with the drawing and sound left to the caller.

```js
/* Shared typing logic for Key Hunt, Home Row and Word Racer (slice 18).
   Pure: takes state in, returns a verdict. Sound, drawing and HUD stay with
   the game that owns them. */

export const FINGER = {};
function setF(keys, v, name) {
  keys.split("").forEach(function (k) { FINGER[k] = [v, name]; });
}
/* ---- copy the setF(...) calls from index.html:916-920 verbatim ---- */

export function fingerVar(ch) {
  const f = FINGER[String(ch || "").toLowerCase()];
  return f ? f[0] : "--f-th";
}

export function hintFinger(ch) {
  const f = FINGER[String(ch || "").toLowerCase()];
  if (!f) return "Try again! 再試一次！";
  return `Use your ${f[1]} for "${String(ch).toUpperCase()}"`;
}

/* Advance `s.pos` when `ch` is the character the word wants next.
   Mutates s.pos / s.correct / s.errors and returns whether it matched —
   exactly what handleInput did inline at index.html:2358-2373. */
export function matchChar(s, ch) {
  const expect = s.word[s.pos];
  if (expect == null) return false;
  if (ch === String(expect).toLowerCase() || (expect === " " && ch === " ")) {
    s.pos++; s.wrong = false; s.correct = (s.correct || 0) + 1;
    return true;
  }
  s.errors = (s.errors || 0) + 1;
  s.wrong = true;
  return false;
}

export function wordComplete(s) {
  return s.pos >= s.word.length;
}
```

**On `hintFinger` gaining 中文:** the original returns the English-only `"Try again!"`. The bilingual invariant in CLAUDE.md says every user-facing string ships EN + 中文, so the fallback is corrected here. This is the one deliberate string change in the slice; note it in the commit. The `Use your ... for "X"` branch keeps its existing wording because the finger names come from `FINGER` and changing them is gameplay-visible.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/games.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/games/typing-core.js scripts/games.test.mjs
git commit -m "refactor(games): extract the shared typing core, and give its fallback hint 中文"
```

---

## Task 3: Migrate Key Hunt and Home Row

The two smallest games, taken together because they share `drawWord("home")` and neither has a settings bar or a score.

Source: `index.html:1248-1264` (hunt: `initHunt`, `nextHunt`), `index.html:1265-1275` (home: `initHome`, `nextHome`), plus `drawWord` (`index.html:1307-1319`).

**Files:**
- Create: `js/games/hunt.js`, `js/games/home.js`
- Modify: `scripts/games.test.mjs`, `js/games/index.js`, `sw.js`, `scripts/check.mjs:20`

- [ ] **Step 1: Write the failing tests**

```js
runContractTests("hunt", () => import("../js/games/hunt.js"));
runContractTests("home", () => import("../js/games/home.js"));

test("hunt and home declare no bestKey, matching the manifest", async () => {
  const { findEntry } = await import("../js/games/index.js");
  for (const id of ["hunt", "home"]) {
    const game = (await import(`../js/games/${id}.js`)).default;
    assert.equal(game.bestKey, null, `${id} must not claim a best score`);
    assert.equal(game.bestKey, findEntry(id).bestKey);
    assert.equal(game.keyboard, true);
  }
});

test("hunt: a correct key advances, a wrong one does not", async () => {
  installGlobals();
  const game = (await import("../js/games/hunt.js")).default;
  const ctx = makeCtx();
  game.init(ctx);
  const before = game.debugState().found;
  game.key(game.debugState().letter.toLowerCase());
  assert.equal(game.debugState().found, before + 1, "correct key did not score");
  game.stop();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/games.test.mjs`
Expected: FAIL — `Cannot find module '../js/games/hunt.js'`

- [ ] **Step 3: Create `js/games/hunt.js`**

Apply the slice 17 recipe. The `key(ch)` export is new — it is the branch that lived in `handleInput` at `index.html:2349-2355`.

```js
/* Key Hunt 🔎 找按鍵 — migrated from index.html:1248-1264 (slice 18). */
import { LETTERS } from "./word-data.js";

let S = null, C = null;

/* ---- copy initHunt's body and nextHunt from index.html:1249-1264, applying
   the recipe: state. -> S., KIDS[kid] -> C.kids[C.kid], sGood() ->
   C.sfx.good(), flash( -> C.fx.flash(, burst( -> C.fx.burst(,
   highlightTarget( -> C.keys.highlight(, say( -> C.say( ---- */

function key(ch) {
  if (!S) return;
  if (String(ch).toUpperCase() === S.letter) {
    S.found++;
    C.sfx.good(); C.fx.flash("ok"); C.fx.burst(6);
    S.timeout = setTimeout(nextHunt, 220);
  } else {
    C.sfx.bad(); C.fx.flash("bad");
    C.fx.wobbleMsg("Oops! Press the glowing key 👆 按發光的鍵");
  }
}

function init(ctx) {
  C = ctx;
  C.keys.build();
  /* ---- copy initHunt's body here ---- */
}

function stop() {
  if (S && S.timeout) clearTimeout(S.timeout);
  S = null;
}

export default {
  id: "hunt",
  meta: { icon: "🔎", title: "Key Hunt", tz: "找按鍵", blurb: "Find the glowing key" },
  keyboard: true,
  bestKey: null,
  init: init, stop: stop, key: key,
  debugState: () => S,
};
```

**Note the `S.timeout`:** the original called a bare `setTimeout(nextHunt,220)` and relied on nothing cancelling it. A kid who taps the right key and immediately leaves would previously get `nextHunt` running against a torn-down game. Capturing and clearing it in `stop()` is a teardown fix, not a gameplay change — the game plays identically.

**Note the 中文 on the wobble message:** `"Oops! Press the glowing key 👆"` had no 中文, violating the bilingual invariant. Corrected here, same as Task 2's fallback hint.

- [ ] **Step 4: Create `js/games/home.js`**

Same recipe against `index.html:1265-1275`. Home Row uses `drawWord("home")` and the typing core:

```js
/* Home Row 🎯 基準鍵 — migrated from index.html:1265-1275 (slice 18). */
import { matchChar, wordComplete, hintFinger, fingerVar } from "./typing-core.js";

let S = null, C = null;

/* ---- copy initHome, nextHome (index.html:1266-1275) and the "home" branch of
   drawWord (index.html:1307-1319), applying the recipe ---- */

function key(ch) {
  if (!S) return;
  if (matchChar(S, ch)) {
    C.sfx.good();
    drawWord();
    if (wordComplete(S)) {
      S.words++; C.fx.burst(10); C.sfx.win();
      S.i++;
      S.timeout = setTimeout(nextHome, 300);
    }
    updateHud();
  } else {
    C.sfx.bad(); C.fx.flash("bad");
    drawWord();
    C.fx.hint(hintFinger(S.word[S.pos]));
    updateHud();
  }
}

function updateHud() {
  const total = (S.correct || 0) + (S.errors || 0);
  const acc = total ? Math.round((S.correct / total) * 100) : 100;
  C.hud([
    { k: "Words", v: S.words, c: C.kids[C.kid].raw },
    { k: "Accuracy", v: acc + "%" },
    { k: "Stars", v: C.stars },
  ]);
}

function init(ctx) { C = ctx; C.keys.build(); /* ...copy initHome... */ }
function stop() { if (S && S.timeout) clearTimeout(S.timeout); S = null; }

export default {
  id: "home",
  meta: { icon: "🎯", title: "Home Row", tz: "基準鍵", blurb: "Learn your fingers" },
  keyboard: true, bestKey: null,
  init: init, stop: stop, key: key,
  debugState: () => S,
};
```

`C.stars` is new on `ctx` — the old HUD read `progress[kid].stars` directly. Add it to the bridge in `index.html` (`window.SQHost`) as a getter, and to `startRegistered`'s ctx literal:

```js
  get stars(){return progress[kid]?progress[kid].stars:0;},
```

and in `startRegistered`: `stars:progress[kid]?progress[kid].stars:0,`

Also add `stars: 0` to `makeCtx()` in `scripts/games.test.mjs`.

- [ ] **Step 5: Route keys through the registry**

In `index.html`, replace the top of `handleInput` (`index.html:2341-2348`):

```js
function handleInput(ch){
  pressFx(ch);
  if(level==="balloon"){ balloonInput(ch); return; }
```

with:

```js
function handleInput(ch){
  pressFx(ch);
  /* Migrated games own their own key handling (design.md §3). */
  if(currentGame){ if(currentGame.key) currentGame.key(ch); return; }
  if(level==="balloon"){ balloonInput(ch); return; }
```

- [ ] **Step 6: Flip, precache, play**

Add `legacy: false` to `hunt` and `home` in `js/games/index.js`; add both files to `APP_SHELL` with `CACHE_NAME` → `"summer-quest-v12"`; add both to `runtimeFiles`.

Run: `node --test scripts/games.test.mjs && node scripts/check.mjs`
Expected: PASS.

In the browser: play Key Hunt (the glowing key highlights, correct keys score, wrong keys wobble) and Home Row (words advance, accuracy tracks, the finger hint appears on a mistake). Leave each mid-round and confirm nothing keeps running.

- [ ] **Step 7: Commit**

```bash
git add js/games/hunt.js js/games/home.js js/games/index.js index.html sw.js scripts/check.mjs scripts/games.test.mjs
git commit -m "refactor(games): move Key Hunt and Home Row into modules"
```

---

## Task 4: Migrate Word Racer

Source: `index.html:1276-1324` (`initRace`, `makeRacePool`, `nextRace`, `startTimer`, `drawWord`, `drawRace`), plus `updatePlayHud`'s race branch (`index.html:2391-2397`) and `finishRace` (`index.html:2400-2421`).

Word Racer is the first migrated game with a **best score**, so it exercises the `ctx.finish` path against a real `bestKey`.

**Files:**
- Create: `js/games/race.js`
- Modify: `scripts/games.test.mjs`, `js/games/index.js`, `sw.js`, `scripts/check.mjs:20`

- [ ] **Step 1: Write the failing tests**

```js
runContractTests("race", () => import("../js/games/race.js"));

test("race: finishes through ctx.finish with a numeric score", async () => {
  installGlobals();
  const game = (await import("../js/games/race.js")).default;
  let reported = null;
  const ctx = makeCtx({ finish: (r) => { reported = r; } });
  game.init(ctx);
  game.forceFinishForTest();
  assert.ok(reported, "race never reported a score");
  assert.equal(typeof reported.score, "number");
  game.stop();
});

test("race: its countdown interval is released by stop", async () => {
  const live = installGlobals();
  const game = (await import("../js/games/race.js")).default;
  game.init(makeCtx());
  game.key("a");                       // starts the timer on first keypress
  assert.ok(live.intervals.size > 0, "race timer never started");
  game.stop();
  assert.equal(live.intervals.size, 0, "race leaked its countdown");
});

test("race declares bestKey race, matching the manifest", async () => {
  const game = (await import("../js/games/race.js")).default;
  const { findEntry } = await import("../js/games/index.js");
  assert.equal(game.bestKey, "race");
  assert.equal(game.bestKey, findEntry("race").bestKey);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/games.test.mjs`
Expected: FAIL — `Cannot find module '../js/games/race.js'`

- [ ] **Step 3: Create `js/games/race.js`**

```js
/* Word Racer 🚀 文字競速 — migrated from index.html:1276-1324 + 2391-2421. */
import { ALL_WORDS, SENT } from "./word-data.js";
import { matchChar, wordComplete, hintFinger } from "./typing-core.js";

let S = null, C = null;

/* ---- copy makeRacePool, nextRace, drawWord's "race" branch and drawRace
   from index.html:1282-1324, applying the recipe ---- */

function startTimer() {
  if (S.started) return;
  S.started = true;
  S.startTs = Date.now();
  S.timer = setInterval(function () {
    if (!S) return;
    S.time--;
    updateHud();
    if (S.time <= 0) finishRace();
  }, 1000);
}

function updateHud() {
  const mins = S.started ? Math.max((Date.now() - S.startTs) / 60000, 1 / 60) : 1 / 60;
  const wpm = Math.round(((S.correct || 0) / 5) / mins);
  const total = (S.correct || 0) + (S.errors || 0);
  const acc = total ? Math.round((S.correct / total) * 100) : 100;
  C.hud([
    { k: "Time", v: S.time + "s", c: S.time <= 10 ? "var(--bad)" : C.kids[C.kid].raw },
    { k: "WPM", v: S.started ? wpm : 0 },
    { k: "Accuracy", v: acc + "%" },
    { k: "Words", v: S.words },
  ]);
}

function finishRace() {
  if (!S || !S.running) return;
  S.running = false;
  if (S.timer) { clearInterval(S.timer); S.timer = null; }
  /* ---- copy the result-card markup from finishRace (index.html:2400-2421)
     verbatim, including both languages, replacing the direct writes to
     progress[kid].best.race with the ctx.finish call below ---- */
  const mins = Math.max((Date.now() - S.startTs) / 60000, 1 / 60);
  const wpm = Math.round(((S.correct || 0) / 5) / mins);
  C.sfx.win();
  C.finish({ score: wpm });
}

function key(ch) {
  if (!S) return;
  startTimer();
  if (matchChar(S, ch)) {
    C.sfx.good();
    drawRaceWord();
    if (wordComplete(S)) { S.words++; C.fx.burst(10); C.sfx.win(); S.timeout = setTimeout(nextRace, 120); }
  } else {
    C.sfx.bad(); C.fx.flash("bad");
    drawRaceWord();
    C.fx.hint(hintFinger(S.word[S.pos]));
  }
  updateHud();
}

function init(ctx) { C = ctx; C.keys.build(); /* ...copy initRace... */ }

function stop() {
  if (S) {
    S.running = false;
    if (S.timer) clearInterval(S.timer);
    if (S.timeout) clearTimeout(S.timeout);
  }
  S = null;
}

export default {
  id: "race",
  meta: { icon: "🚀", title: "Word Racer", tz: "文字競速", blurb: "Type fast for a score" },
  keyboard: true, bestKey: "race",
  init: init, stop: stop, key: key,
  forceFinishForTest: finishRace,
  debugState: () => S,
};
```

**Note the scoring:** the old `finishRace` stored WPM as `best.race`. Keep that — switching to word count would orphan every existing score in `game_stats`.

- [ ] **Step 4: Run, flip, precache, play**

Run: `node --test scripts/games.test.mjs && node scripts/check.mjs` — expect PASS.

Add `legacy:false` to `race`; add the file to `APP_SHELL` with `CACHE_NAME` → v13; add to `runtimeFiles`.

In the browser: the 60-second countdown starts on the first keypress, WPM and accuracy update live, the result card shows the same fields in both languages, and a new best saves and survives a reload.

- [ ] **Step 5: Commit**

```bash
git add js/games/race.js js/games/index.js sw.js scripts/check.mjs scripts/games.test.mjs
git commit -m "refactor(games): move Word Racer into a module"
```

---

## Task 5: Migrate Balloon Pop — the first game with a settings bar

Source: `index.html:1325-1406` (`initBalloon`, `balloonHud`, `usedLetters`, `spawnBalloon`, `balloonLoop`, `balloonInput`), plus its `renderSetbar` branch (`index.html:1131-1136`).

**Files:**
- Create: `js/games/balloon.js`
- Modify: `scripts/games.test.mjs`, `js/games/index.js`, `sw.js`, `scripts/check.mjs:20`

- [ ] **Step 1: Write the failing tests**

```js
runContractTests("balloon", () => import("../js/games/balloon.js"));

test("balloon: settings() renders the speed and count controls", async () => {
  const game = (await import("../js/games/balloon.js")).default;
  assert.equal(typeof game.settings, "function");
  const bar = makeCtx().stage;
  game.settings(bar, makeCtx({ settings: { balloon: { speed: 3, count: 4 } } }));
  assert.match(bar.innerHTML, /setSpeed/, "speed slider missing");
  assert.match(bar.innerHTML, /setCount/, "count slider missing");
});

test("balloon: stop cancels its animation loop", async () => {
  const live = installGlobals();
  const game = (await import("../js/games/balloon.js")).default;
  game.init(makeCtx({ settings: { balloon: { speed: 3, count: 4 } } }));
  assert.ok(live.frames.size > 0, "balloon never started its loop");
  game.stop();
  assert.equal(live.frames.size, 0, "balloon leaked its loop");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/games.test.mjs`
Expected: FAIL — `Cannot find module '../js/games/balloon.js'`

- [ ] **Step 3: Create `js/games/balloon.js`**

The `settings(bar, ctx)` function is the game's `renderSetbar` branch, moved. It owns its own markup and its own change handlers, and calls `ctx.restart()` when a change needs a fresh round.

```js
/* Balloon Pop 🎈 戳氣球 — migrated from index.html:1325-1406 + 1131-1136. */
import { LETTERS, BALLOON_COLORS } from "./word-data.js";

let S = null, C = null;

/* ---- copy balloonHud, usedLetters, spawnBalloon, balloonLoop and the
   balloonInput body from index.html:1334-1406, applying the recipe ---- */

/* Was the `if(level==="balloon")` branch of renderSetbar (index.html:1131-1136).
   Markup and wiring move verbatim; only the persistence call changes. */
function settings(bar, ctx) {
  const s = ctx.settings.balloon;
  bar.innerHTML =
    `<div class="grp">🐢 Speed <input type="range" id="setSpeed" min="1" max="5" value="${s.speed}"> 🐇
      <span class="val" id="vSpeed">${s.speed}</span></div>
     <div class="grp">🎈 Balloons <input type="range" id="setCount" min="1" max="6" value="${s.count}">
      <span class="val" id="vCount">${s.count}</span></div>`;
  const sp = bar.querySelector("#setSpeed"), ct = bar.querySelector("#setCount");
  sp.oninput = function () { s.speed = +sp.value; bar.querySelector("#vSpeed").textContent = sp.value; ctx.saveSettings(); };
  ct.oninput = function () { s.count = +ct.value; bar.querySelector("#vCount").textContent = ct.value; ctx.saveSettings(); };
}

function loopStart() {
  S.raf = requestAnimationFrame(function frame(now) {
    if (!S || !S.running) return;
    balloonLoop(now);
    S.raf = requestAnimationFrame(frame);
  });
}

function init(ctx) { C = ctx; C.keys.build(); /* ...copy initBalloon... */ loopStart(); }

function stop() {
  if (S) { S.running = false; if (S.raf) cancelAnimationFrame(S.raf); }
  S = null;
}

export default {
  id: "balloon",
  meta: { icon: "🎈", title: "Balloon Pop", tz: "戳氣球", blurb: "Pop balloons with keys" },
  keyboard: true, bestKey: "balloon",
  init: init, stop: stop, key: balloonInput, settings: settings,
  debugState: () => S,
};
```

- [ ] **Step 4: Add `saveSettings` and `restart` to the bridge**

The settings bar needs to persist a change and, for Orc Attack in Task 6, restart the round. Add to `window.SQHost` in `index.html`:

```js
  saveSettings:saveProgress,
  restart:function(){ if(kid&&level) startGame(kid,level); },
```

and to the ctx literal in `startRegistered`:

```js
  saveSettings:saveProgress,
  restart:function(){ startGame(kid,level); },
```

Add `saveSettings() {}` and `restart() {}` to `makeCtx()` in `scripts/games.test.mjs`.

- [ ] **Step 5: Route the settings bar through the registry**

In `renderSetbar` (`index.html:1101`), replace the opening guard:

```js
function renderSetbar(){
  const bar=document.getElementById("setbar");
  if(level!=="balloon" && level!=="orc" && level!=="vocab"){bar.classList.add("hidden");bar.innerHTML="";return;}
```

with:

```js
function renderSetbar(){
  const bar=document.getElementById("setbar");
  /* A migrated game draws its own bar (design.md §2). */
  if(currentGame){
    if(!currentGame.settings){bar.classList.add("hidden");bar.innerHTML="";return;}
    bar.classList.remove("hidden");
    currentGame.settings(bar,buildCtx());
    return;
  }
  if(level!=="balloon" && level!=="orc" && level!=="vocab"){bar.classList.add("hidden");bar.innerHTML="";return;}
```

`renderSetbar` runs *before* `startRegistered` in `startGame`, so hoist the ctx construction out of `startRegistered` into a `buildCtx()` helper that both call, and move the `renderSetbar()` call to after `currentGame` is set.

- [ ] **Step 6: Flip, precache, play**

Add `legacy:false` to `balloon`; file into `APP_SHELL` with `CACHE_NAME` → v14; into `runtimeFiles`.

Run: `node --test scripts/games.test.mjs && node scripts/check.mjs` — expect PASS.

In the browser: balloons rise at the set speed, the two sliders change speed and count live, the setting survives leaving and re-entering the game, letters pop the matching balloon, and the best score saves.

- [ ] **Step 7: Commit**

```bash
git add js/games/balloon.js js/games/index.js index.html sw.js scripts/check.mjs scripts/games.test.mjs
git commit -m "refactor(games): move Balloon Pop and give games their own settings bar"
```

---

## Task 6: Migrate Orc Attack

The largest of the five (140 lines) and the one with the richest settings bar — difficulty chips plus two sliders, where a difficulty change restarts the round.

Source: `index.html:1407-1546` (`orcWordPool`, `initOrc`, `orcHud`, `spawnOrc`, `drawOrcTag`, `orcLoop`, `orcInput`, `killOrc`, `zapTo`, `finishOrc`), plus its `renderSetbar` branch (`index.html:1137-1150`).

**Files:**
- Create: `js/games/orc.js`
- Modify: `scripts/games.test.mjs`, `js/games/index.js`, `sw.js`, `scripts/check.mjs:20`

- [ ] **Step 1: Write the failing tests**

```js
runContractTests("orc", () => import("../js/games/orc.js"));

test("orc: word pool follows the difficulty setting", async () => {
  const game = (await import("../js/games/orc.js")).default;
  const easy = game.poolFor("easy");
  const hard = game.poolFor("hard");
  assert.ok(easy.length > 0 && hard.length > 0);
  assert.notDeepEqual(easy, hard, "easy and hard must draw from different pools");
});

test("orc: settings() renders difficulty chips and both sliders", async () => {
  const game = (await import("../js/games/orc.js")).default;
  const bar = makeCtx().stage;
  game.settings(bar, makeCtx({ settings: { orc: { diff: "medium", speed: 3, count: 3 } } }));
  assert.match(bar.innerHTML, /data-d="easy"/);
  assert.match(bar.innerHTML, /data-d="hard"/);
  assert.match(bar.innerHTML, /setSpeed/);
  assert.match(bar.innerHTML, /setCount/);
});

test("orc: finishes through ctx.finish and releases its loop", async () => {
  const live = installGlobals();
  const game = (await import("../js/games/orc.js")).default;
  let reported = null;
  const ctx = makeCtx({ settings: { orc: { diff: "medium", speed: 3, count: 3 } },
                        finish: (r) => { reported = r; } });
  game.init(ctx);
  game.forceFinishForTest();
  assert.ok(reported, "orc never reported a score");
  game.stop();
  assert.equal(live.frames.size, 0, "orc leaked its loop");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/games.test.mjs`
Expected: FAIL — `Cannot find module '../js/games/orc.js'`

- [ ] **Step 3: Create `js/games/orc.js`**

```js
/* Orc Attack ⚔️ 半獸人來襲 — migrated from index.html:1407-1546 + 1137-1150. */
import { LETTERS, WORDS_EASY, WORDS_HARD, SENTENCES, ORC_FIGS } from "./word-data.js";

let S = null, C = null;

/* Was orcWordPool (index.html:1408-1413). Exported so its behaviour is
   testable without starting a round. */
export function poolFor(diff) {
  /* ---- copy orcWordPool's body, replacing settings.orc.diff with the
     `diff` argument ---- */
}

/* ---- copy orcHud, spawnOrc, drawOrcTag, orcLoop, orcInput, killOrc and
   zapTo from index.html:1424-1525, applying the recipe ---- */

/* Was the else-branch of renderSetbar (index.html:1137-1150). A difficulty
   change restarts the round, exactly as before. */
function settings(bar, ctx) {
  const s = ctx.settings.orc;
  const D = [["easy", "🙂 Letters"], ["medium", "😀 Words"], ["hard", "😈 Big words"]];
  bar.innerHTML =
    `<div class="grp dchips">${D.map(function (d) {
      return `<button class="chip ${s.diff === d[0] ? "on" : ""}" data-d="${d[0]}"
        style="${s.diff === d[0] ? "background:" + ctx.kids[ctx.kid].raw : ""}">${d[1]}</button>`;
    }).join("")}</div>
     <div class="grp">🐢 Speed <input type="range" id="setSpeed" min="1" max="5" value="${s.speed}"> 🐇
      <span class="val" id="vSpeed">${s.speed}</span></div>
     <div class="grp">👹 Orcs <input type="range" id="setCount" min="1" max="5" value="${s.count}">
      <span class="val" id="vCount">${s.count}</span></div>`;
  bar.querySelectorAll("[data-d]").forEach(function (c) {
    c.onclick = function () { s.diff = c.dataset.d; ctx.saveSettings(); ctx.restart(); };
  });
  const sp = bar.querySelector("#setSpeed"), ct = bar.querySelector("#setCount");
  sp.oninput = function () { s.speed = +sp.value; bar.querySelector("#vSpeed").textContent = sp.value; ctx.saveSettings(); };
  ct.oninput = function () { s.count = +ct.value; bar.querySelector("#vCount").textContent = ct.value; ctx.saveSettings(); };
}

function finishOrc() {
  if (!S || !S.running) return;
  S.running = false;
  if (S.raf) { cancelAnimationFrame(S.raf); S.raf = null; }
  /* ---- copy the result markup from finishOrc (index.html:1526-1546) ---- */
  C.finish({ score: S.killed });
}

function loopStart() {
  S.raf = requestAnimationFrame(function frame(now) {
    if (!S || !S.running) return;
    orcLoop(now);
    S.raf = requestAnimationFrame(frame);
  });
}

function init(ctx) { C = ctx; C.keys.build(); /* ...copy initOrc... */ loopStart(); }

function stop() {
  if (S) { S.running = false; if (S.raf) cancelAnimationFrame(S.raf); }
  S = null;
}

export default {
  id: "orc",
  meta: { icon: "⚔️", title: "Orc Attack", tz: "半獸人來襲", blurb: "Type to defend the hero" },
  keyboard: true, bestKey: "orc",
  init: init, stop: stop, key: orcInput, settings: settings,
  poolFor: poolFor,
  forceFinishForTest: finishOrc,
  debugState: () => S,
};
```

- [ ] **Step 4: Flip, precache, play**

Add `legacy:false` to `orc`; file into `APP_SHELL` with `CACHE_NAME` → v15; into `runtimeFiles`.

Run: `node --test scripts/games.test.mjs && node scripts/check.mjs` — expect PASS.

In the browser, on Luis's hub (Orc Attack is his game):
1. Orcs spawn at the set rate and march at the set speed.
2. The three difficulty chips switch the word pool, and choosing one restarts the round with the chip highlighted in his colour.
3. Typing a word zaps the matching orc; a wrong key does not.
4. Losing shows the same result card, in both languages, and a new best saves.
5. Leaving mid-wave stops the loop — check the CPU, not just the screen.

- [ ] **Step 5: Commit**

```bash
git add js/games/orc.js js/games/index.js sw.js scripts/check.mjs scripts/games.test.mjs
git commit -m "refactor(games): move Orc Attack into a module"
```

---

## Task 7: Delete the five originals

**Files:**
- Modify: `index.html:1248-1546`, `handleInput`, `updatePlayHud`, `finishRace`, `renderSetbar`

- [ ] **Step 1: Delete the game bodies**

Delete `index.html:1248-1546` in full — from `/* ---- MODE: KEY HUNT ---- */` through the end of `finishOrc`, stopping immediately before `/* ---- MODE: BIG MACHINES ... ---- */`.

Then delete, from further down the file:
- the whole `updatePlayHud` function (its `home` and `race` branches now live in the two modules)
- the whole `finishRace` function
- the whole `hintFinger` function (now in `typing-core.js`)
- the `FINGER` map, the `setF` helper and `fingerVar` (now in `typing-core.js`) — but **keep** the `/* finger map` comment marker itself, because `scripts/check.mjs:47` still slices on it

- [ ] **Step 2: Reduce `handleInput` to the registry route**

`handleInput` should now be only:

```js
function handleInput(ch){
  pressFx(ch);
  if(currentGame){ if(currentGame.key) currentGame.key(ch); return; }
  if(level==="vocab"){ vocabInput(ch); return; }
  if(level==="machines"){ machinesInput(ch); return; }
}
```

The two remaining branches go in slice 19.

- [ ] **Step 3: Reduce `renderSetbar`**

Delete its `balloon` and `orc` branches and the shared slider wiring at the bottom (`index.html:1151-1156`). Only the `vocab` branch stays, until slice 19.

- [ ] **Step 4: Check for orphans**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed`

```bash
grep -n "initHunt\|nextHunt\|initHome\|nextHome\|initRace\|makeRacePool\|nextRace\|drawRace\|initBalloon\|spawnBalloon\|balloonLoop\|balloonInput\|initOrc\|spawnOrc\|orcLoop\|orcInput\|killOrc\|zapTo\|finishOrc\|updatePlayHud\|finishRace\|hintFinger\|FINGER\|WORDS_EASY\|WORDS_HARD\|SENTENCES\|ORC_FIGS\|BALLOON_COLORS\|LETTERS" index.html
```

Expected: no output except the `/* finger map` comment line.

- [ ] **Step 5: Full regression**

Run: `node --test scripts/games.test.mjs && node --test scripts/registry.test.mjs && node scripts/sync.test.mjs && node scripts/check.mjs`
Expected: all PASS.

In the browser, play **all nine** arcade games and two brain games. The two unmigrated games — Word Wizard and Big Machines — must be untouched.

Then: wifi off, hard reload, play all seven migrated games.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "refactor(games): remove the five keyboard games from index.html"
```

---

## DONE WHEN

- Key Hunt, Home Row, Word Racer, Balloon Pop and Orc Attack play identically — same pools, speeds, spawn rates, scoring and settings.
- Balloon and Orc settings bars work and persist; changing Orc difficulty restarts the round.
- `handleInput` names only `vocab` and `machines`.
- The word pools live in `js/games/word-data.js`, and `check.mjs` validates them by import rather than by slicing `index.html`.
- Every migrated game releases its loop and its timers on leaving — proven by test and observed in the browser.
- Word Racer's and Orc Attack's and Balloon Pop's best scores still read, write and sync.
- All seven migrated games work with wifi off.
- `node --test scripts/games.test.mjs`, `node --test scripts/registry.test.mjs`, `node scripts/sync.test.mjs` and `node scripts/check.mjs` all pass.
- No `?.`, `??`, or `.flatMap` in any new file.
