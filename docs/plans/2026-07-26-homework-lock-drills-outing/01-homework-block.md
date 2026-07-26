# Slice 01 — Homework Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 10:00 "Create & build" block with a homework block for all 3 kids, awarding a star on tick like any mission block.

**Architecture:** Data-only change to the `DAY` array plus a new `homework` mission pool in `MISSIONS`, both inside index.html's inline script (before the `/* finger map` marker — check.mjs validates them there). Two tiny render/announce tweaks.

**Tech Stack:** Vanilla JS single-file app, `node scripts/check.mjs` as the gate.

**Read first:** `design.md` §1 in this folder, and `CLAUDE.md` (bilingual invariant, don't touch working gameplay).

**⚠ Concurrency:** another agent may be committing to this repo. Start from a clean, up-to-date `main` (`git pull`). Anchor edits by the code snippets shown, NOT by line numbers — they drift.

---

### Task 1: Swap the DAY block and add the homework mission pool

**Files:**
- Modify: `index.html` (inline script, data section before `/* finger map`)

- [x] **Step 1: Replace the 10:00 block in `const DAY=[...]`**

Find this entry (search for `Create & build`):

```js
 {t:"10:00",icon:"🎨",title:"Create & build",tz:"創作與建造",kind:"mission",pool:"desk"},
```

Replace with:

```js
 {t:"10:00",icon:"✏️",title:"Homework",tz:"暑假作業",kind:"mission",pool:"homework"},
```

Note: `tz` deliberately has no `時間` suffix — `announceBlock` appends `時間到了`, and `暑假作業時間到了` reads correctly.

- [x] **Step 2: Add the `homework` pool to `const MISSIONS={...}`**

`MISSIONS` is an object of pools (`sport`, `desk`, `skill`, …), each with `lucien`/`lili`/`luis` arrays of `[en, zh]` pairs. Add this pool at the same level as the others (e.g. right after `skill:{...},`):

```js
homework:{
 lucien:[["Quiet work — coloring, tracing or a puzzle 🎨","安靜活動——著色、描寫或拼圖 🎨"]],
 lili:[["Summer homework — one page, best effort ✏️","暑假作業——寫一頁，盡力就好 ✏️"]],
 luis:[["Summer homework — one page, then check it yourself ✏️","暑假作業——寫一頁，然後自己檢查 ✏️"]],
},
```

Do NOT delete the now-unused `desk` pool — check.mjs validates it and it may migrate into `project` later.

- [x] **Step 3: Hide the 🎲 reroll die for single-entry pools**

In `renderMyDay()`, find the reroll button line inside the `dbtns` div:

```js
${b.kind==="mission"&&!isDone?`<button class="btn small tick" data-rr="${i}">🎲</button>`:""}
```

Replace with:

```js
${b.kind==="mission"&&!isDone&&MISSIONS[b.pool][hubKid].length>1?`<button class="btn small tick" data-rr="${i}">🎲</button>`:""}
```

(The surrounding buttons in `dbtns` may differ from what you expect — another agent adds pass/proof buttons there. Change only this one line.)

- [x] **Step 4: Remove the dead "Create & build" special case in `announceBlock`**

Current:

```js
function announceBlock(i){
  const b=DAY[i]; if(!b||blockMins(b)==null)return;
  const en=b.title==="Create & build"?"Create & build time!":`${b.title.split("—")[0].trim()} time!`;
  const zh=b.title==="Create & build"?"創作與建造時間到了":`${(b.tz||"").split("——")[0].split("（")[0].trim()}時間到了`;
  sWin(); say(en,"en-US"); setTimeout(()=>say(zh,"zh-TW",true),900);
}
```

Replace the two ternaries with the plain expressions:

```js
function announceBlock(i){
  const b=DAY[i]; if(!b||blockMins(b)==null)return;
  const en=`${b.title.split("—")[0].trim()} time!`;
  const zh=`${(b.tz||"").split("——")[0].split("（")[0].trim()}時間到了`;
  sWin(); say(en,"en-US"); setTimeout(()=>say(zh,"zh-TW",true),900);
}
```

(If slice 02 already landed, the guard reads `SQTime.effMins(DAY,dayOverrides,i)==null` instead of `blockMins(b)==null` — keep whatever guard is there, only change the `en`/`zh` lines.)

- [x] **Step 5: Run the check**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed: ...`

- [x] **Step 6: Manual smoke (browser, no config.js needed — local-only mode works)**

Open `index.html`, pick each kid → My Day:
- 10:00 row shows `✏️ Homework 暑假作業` with that kid's mission text (Lucien: quiet work; Lili/Luis: homework), no 🎲 die.
- Tick it → star fanfare fires (mission path), progress bar advances, un-tick works.
- Other mission blocks still show their 🎲.

- [x] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: homework block replaces create & build at 10:00"
```

## DONE WHEN

- All 3 kids show the homework/quiet block at 10:00 with correct bilingual labels; tick earns a star; `x/16` unchanged; check green; the 10:00 spoken announcement says "Homework time! 暑假作業時間到了".
