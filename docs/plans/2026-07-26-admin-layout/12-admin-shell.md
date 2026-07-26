# Slice 12 — Admin three-column shell

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `admin.html` from one centred column into a three-column grid — sticky left rail, page-scrolling centre, sticky right rail — and collapse the five cold panels into closed `<details>` folds.

**Architecture:** Pure layout slice. No render function's internals change; only which container each existing panel lives in, and whether it starts closed. The conversation rail is created here as an **empty shell with a placeholder** — slice 13 fills it. Left-rail content is *moved* here as-is and *compacted* in slice 14.

**Tech Stack:** Plain HTML + CSS grid + `<details>`. No JS framework, no build step. `js/admin.js` gets one small addition (fold persistence) and no other change.

**Design:** `docs/plans/2026-07-26-admin-layout/design.md` §2, §5

**Depends on:** nothing. Ships independently.

**DONE WHEN:**
- At ≥1401px the admin shows three columns; Grant stars (left) and the conversation shell (right) are both visible with the page scrolled to top.
- At ≤1080px the page is one column with no horizontal scroll.
- The five cold panels render closed, open on click, and remember their state across a reload.
- Every button that worked before this slice still works.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

Read these before writing a line. `scripts/check.mjs` enforces the first three and will fail the build:

1. **No `?.` optional chaining, no `??` nullish coalescing, no `.flatMap(`** anywhere in `admin.html` or `js/admin.js`. These are banned for Android 8 tablet compatibility. Use `a && a.b` and `x || fallback`.
2. **`admin.html` must keep the literal string `helpClaims`** — `scripts/check.mjs:222` asserts it. This slice does not remove it; slice 13 preserves it deliberately.
3. **`admin.html` must keep `rel="manifest"` and the `serviceWorker` registration.**
4. **Bilingual invariant:** every user-facing string ships EN + 繁體中文. A new string without 中文 is a bug.
5. **Tablet-first:** no hover-only affordance. Everything must work on a tap.

---

## File Structure

| File | Change | Responsibility after this slice |
|---|---|---|
| `admin.html` | Modify | Three-column grid markup; panels distributed to `.rail--left`, `.col-center`, `.rail--right`; cold panels wrapped in `<details class="fold">` |
| `css/admin.css` | Modify | `.app-shell` grid + `.rail` sticky rules + `.fold` styling + three breakpoints |
| `js/admin.js` | Modify | Adds `restoreFolds()` / fold persistence only |
| `scripts/check.mjs` | Modify | Adds one assertion that the three-column shell markup exists |

---

## Task 1: Grid shell + rails in CSS

**Files:**
- Modify: `css/admin.css:36-38` (the `.app-shell` rule)
- Modify: `css/admin.css:710-733` (the existing `@media (max-width: 860px)` block)

- [ ] **Step 1: Replace the `.app-shell` rule**

Find this in `css/admin.css`:

```css
.app-shell {
  max-width: 1480px;
  margin: 0 auto;
}
```

Replace it with:

```css
.app-shell {
  max-width: 1800px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 380px;
  grid-template-areas:
    "top    top    top"
    "left   center right";
  gap: 14px;
  align-items: start;
}

.app-top {
  grid-area: top;
}

.col-center {
  grid-area: center;
  min-width: 0;
}

.rail--left {
  grid-area: left;
}

.rail--right {
  grid-area: right;
}

/* Rails stay put while the centre column scrolls the page. They get their own
   scrollbar only when their content is taller than the viewport. */
.rail {
  position: sticky;
  top: 14px;
  max-height: calc(100vh - 28px);
  overflow-y: auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Panels inside a rail lose the outer vertical margin — the flex gap owns spacing. */
.rail .panel {
  margin: 0;
}

/* Login and config are centre-only; the rails render nothing until #dash shows. */
.app-shell.is-locked {
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    "top"
    "center";
}

.app-shell.is-locked .rail {
  display: none;
}
```

- [ ] **Step 2: Add the two new breakpoints**

Immediately **before** the existing `@media (max-width: 860px) {` block in `css/admin.css`, insert:

```css
/* 1400px: the left rail folds into the top of the centre column, the
   conversation rail survives — it is the one Papa watches all day. */
@media (max-width: 1400px) {
  .app-shell {
    grid-template-columns: minmax(0, 1fr) 380px;
    grid-template-areas:
      "top    top"
      "left   right"
      "center right";
  }

  .rail--left {
    position: static;
    max-height: none;
    overflow: visible;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .rail--left > .panel {
    flex: 1 1 260px;
  }
}

/* 1080px: everything stacks. Rails unstick — this is the pre-slice behaviour. */
@media (max-width: 1080px) {
  .app-shell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "top"
      "left"
      "right"
      "center";
  }

  .rail {
    position: static;
    max-height: none;
    overflow: visible;
    flex-direction: column;
  }

  .rail--left {
    flex-direction: column;
  }
}
```

- [ ] **Step 3: Add the `<details>` fold styling**

Append to `css/admin.css` (after the `.heat-cell` rule, before the `@media` blocks):

```css
/* Cold panels — closed by default, count badge on the summary so a shut fold
   still reports something. <details> is used on purpose: keyboard- and
   screen-reader-correct with zero JavaScript. */
.fold {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  margin: 12px 0;
}

.fold > summary {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  cursor: pointer;
  font-size: 18px;
  font-weight: 700;
  list-style: none;
  min-height: 52px;
}

.fold > summary::-webkit-details-marker {
  display: none;
}

.fold > summary::before {
  content: "▸";
  color: var(--muted);
  transition: transform .15s ease;
}

.fold[open] > summary::before {
  transform: rotate(90deg);
}

.fold > summary:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: -2px;
}

.fold__count {
  margin-left: auto;
  padding: 2px 10px;
  border-radius: 999px;
  background: #151127;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.fold__body {
  padding: 0 16px 16px;
}

@media (prefers-reduced-motion: reduce) {
  .fold > summary::before {
    transition: none;
  }
}
```

- [ ] **Step 4: Verify the CSS parses**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed` (check.mjs does not lint CSS, but it must not regress on anything else).

- [ ] **Step 5: Commit**

```bash
git add css/admin.css
git commit -m "feat(admin): three-column grid shell with sticky rails"
```

---

## Task 2: Restructure `admin.html` into the three columns

**Files:**
- Modify: `admin.html:13-139`

- [ ] **Step 1: Wrap the header and add the empty columns**

In `admin.html`, the `<main class="app-shell">` currently contains a flat list of sections. Restructure it. Replace lines 13–41 (from `<main class="app-shell">` through the opening `<section id="dash" class="hidden">`) with:

```html
<main class="app-shell is-locked" id="shell">
  <header class="app-top">
    <div>
      <h1 class="page-title">Summer Quest Admin</h1>
      <p class="page-subtitle">Papa dashboard 爸爸管理頁</p>
    </div>
    <button class="btn btn--secondary hidden" id="logoutBtn">Sign out 登出</button>
  </header>

  <div class="col-center">
    <section class="panel" id="configState">
      <h2 class="section-title">Config needed 需要設定</h2>
      <p>Create <code>js/config.js</code> from <code>js/config.example.js</code>.</p>
    </section>

    <section class="panel hidden" id="login">
      <h2 class="section-title">Login 登入</h2>
      <label class="field">
        <span>Email 電子信箱</span>
        <input class="input" id="email" type="email" autocomplete="email">
      </label>
      <label class="field">
        <span>Password 密碼</span>
        <input class="input" id="password" type="password" autocomplete="current-password">
      </label>
      <p class="message message--error" id="loginErr"></p>
      <button class="btn" id="loginBtn">Sign in 登入</button>
    </section>

    <section id="dash" class="hidden">
```

Note the two changes: `<main>` gains `class="app-shell is-locked"` and `id="shell"`, and everything centre-bound is now inside `<div class="col-center">`.

- [ ] **Step 2: Move the day controls and Grant stars into the left rail**

The left rail is a **sibling** of `.col-center`, not a child of `#dash`. Because `#dash` is toggled by `show("dash", true)`, the rails need their own visibility. Add the left rail immediately **after** the closing `</div>` of `.col-center` (you will add that closing tag in Step 4):

```html
  <aside class="rail rail--left hidden" id="railLeft">
    <section class="panel">
      <div class="section-head">
        <h2 class="section-title">Today 今天</h2>
        <span class="pill" id="todayLabel"></span>
      </div>
      <div class="row">
        <button class="btn btn--secondary" id="refreshBtn">Refresh 更新</button>
        <button class="btn btn--danger" id="resetAcceptedBtn">Reset day 重設今天</button>
      </div>
      <label class="toggle-line"><input type="checkbox" id="removedCredited" checked> Removed blocks earn stars 移除也算星星</label>
    </section>

    <section class="panel grant-panel">
      <h2 class="section-title">Grant stars 加星星</h2>
      <div class="kid-grid" id="grants"></div>
    </section>

    <section class="panel">
      <h2 class="section-title">App locks 暫停與分類鎖</h2>
      <p class="muted">Pause the whole app, or lock one category while My Day stays available. 可暫停整個app，或只鎖某個分類，「我的一天」仍可查看。</p>
      <div id="applocks" class="kid-grid"></div>
    </section>
  </aside>
```

- [ ] **Step 3: Add the right-rail conversation shell**

After the left rail, add:

```html
  <aside class="rail rail--right hidden" id="railRight">
    <section class="panel notify-panel">
      <div class="section-head">
        <h2 class="section-title">Live notifications 即時通知</h2>
        <span class="pill" id="notifyStatus">Dashboard only 只在頁面內</span>
      </div>
      <div class="row">
        <button class="btn" id="notifyEnableBtn">Enable Windows notifications 開啟Windows通知</button>
        <button class="btn btn--secondary" id="notifyClearBtn">Clear 清除</button>
      </div>
      <div class="notify-feed" id="notifyFeed" role="log" aria-live="polite"></div>
    </section>
  </aside>
</main>
```

This is the **placeholder** rail. Slice 13 replaces the whole `notify-panel` section with the conversation panel; keeping the feed here means this slice ships a working page on its own.

- [ ] **Step 4: Rewrite the `#dash` body — Today stays open, cold panels become folds**

Inside `<section id="dash" class="hidden">`, replace all its current children with:

```html
      <section class="panel">
        <div class="section-head">
          <h2 class="section-title">Today at a glance 今日總覽</h2>
        </div>
        <p class="hint">Drag blocks to change order. Use the time field for exact moves. Accept, undo, remove, or add blocks back from each kid's list. 拖曳格子調整順序，也可直接改時間。</p>
        <div class="kid-grid" id="overview"></div>
      </section>

      <section class="panel comms-panel">
        <div class="section-head">
          <h2 class="section-title">Messages 訊息</h2>
          <label class="toggle-line"><input type="checkbox" id="showArchivedAsks"> Show archived 顯示封存</label>
        </div>
        <div class="comms-layout">
          <div class="message-composer">
            <h3 class="subsection-title">Papa's daily message 爸爸每日留言</h3>
            <p class="compact-copy" id="noteDay"></p>
            <label class="field">
              <span>Message for today 給今天的留言</span>
              <textarea class="input textarea" id="noteBody" placeholder="Have a brave, kind day! 今天也要勇敢又溫柔！"></textarea>
            </label>
            <p class="message message--ok" id="noteStatus"></p>
            <button class="btn" id="saveNoteBtn">Save message 儲存留言</button>
          </div>
          <div class="inbox-panel">
            <h3 class="subsection-title">Ask inbox 求助收件匣</h3>
            <div id="askInbox"></div>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2 class="section-title">Captain claims 隊長申請</h2>
        <p class="message message--error" id="helpClaimsStatus"></p>
        <div id="helpClaims"></div>
      </section>

      <section class="panel">
        <h2 class="section-title">Pass requests 券申請</h2>
        <div id="passes"></div>
      </section>

      <details class="fold" data-fold="acts">
        <summary>Activities ticked today 今天完成的活動<span class="fold__count" id="foldCountActs"></span></summary>
        <div class="fold__body">
          <p class="hint">Revoke takes the star back and un-ticks the activity, so the kid can do it for real and earn it again today. 收回星星並取消勾選，孩子今天可以真的做完再拿一次。</p>
          <div class="kid-grid" id="actsToday"></div>
        </div>
      </details>

      <details class="fold" data-fold="proofs">
        <summary>Proof gallery 照片證明<span class="fold__count" id="foldCountProofs"></span></summary>
        <div class="fold__body">
          <button class="btn btn--secondary" id="galleryBtn">🍽 Dinner gallery 晚餐播放</button>
          <div id="proofs"></div>
        </div>
      </details>

      <details class="fold" data-fold="history">
        <summary>14-day history 14天紀錄<span class="fold__count" id="foldCountHistory"></span></summary>
        <div class="fold__body"><div id="history"></div></div>
      </details>

      <details class="fold" data-fold="ledger">
        <summary>Ledger 星星紀錄<span class="fold__count" id="foldCountLedger"></span></summary>
        <div class="fold__body"><div id="ledger"></div></div>
      </details>

      <details class="fold" data-fold="settings">
        <summary>Settings 設定<span class="fold__count" id="foldCountSettings"></span></summary>
        <div class="fold__body">
          <div class="kid-grid" id="pinSettings"></div>
          <div class="kid-card" id="adminPinSettings"></div>
        </div>
      </details>
    </section>
  </div>
```

The `Messages`, `Captain claims` and `Pass requests` panels stay in the centre **for this slice only** — slice 13 deletes them once the conversation rail can do their job. Shipping them here means slice 12 loses no capability.

- [ ] **Step 5: Verify in a browser**

Run: `python -m http.server 8000` (or any static server) from the repo root, open `http://localhost:8000/admin.html`, sign in.
Expected at a window ≥1401px wide:
- Three columns. Left rail shows Today controls, Grant stars, App locks. Right rail shows the live notification feed. Centre shows Today at a glance, then five closed folds.
- Scrolling the page moves the centre column only; both rails stay put.

Narrow the window to ~1200px: left rail content flows into a row above the centre column, right rail survives.
Narrow to ~900px: single column, no horizontal scrollbar.

- [ ] **Step 6: Commit**

```bash
git add admin.html
git commit -m "feat(admin): move panels into left/right rails and cold folds"
```

---

## Task 3: Show the rails only when the dashboard is open

**Files:**
- Modify: `js/admin.js:176-184` (`openDashboard`)

- [ ] **Step 1: Reveal the rails on login**

In `js/admin.js`, find:

```js
  async function openDashboard(){
    show("login",false); show("dash",true); show("logoutBtn",true);
```

Replace those two lines with:

```js
  async function openDashboard(){
    show("login",false); show("dash",true); show("logoutBtn",true);
    show("railLeft",true); show("railRight",true);
    $("shell").classList.remove("is-locked");
```

`show(id,on)` is the existing helper at `js/admin.js:28`; it toggles the `hidden` class.

- [ ] **Step 2: Verify**

Reload `admin.html` while signed out. Expected: one centred column, no empty rail gutters. Sign in. Expected: three columns appear.

- [ ] **Step 3: Commit**

```bash
git add js/admin.js
git commit -m "feat(admin): reveal rails only after sign-in"
```

---

## Task 4: Fold persistence + count badges

**Files:**
- Modify: `js/admin.js:218-231` (`renderAll`) and the bottom event-wiring block near `js/admin.js:953-985`

- [ ] **Step 1: Add the fold helpers**

In `js/admin.js`, immediately **above** `function renderAll(){`, insert:

```js
  /* Cold panels remember whether Papa left them open. One localStorage key holds
     an array of the open fold names, so adding a fold later needs no migration. */
  const FOLD_KEY="sq-admin-folds";
  function openFolds(){
    try{
      const raw=JSON.parse(localStorage.getItem(FOLD_KEY)||"[]");
      return new Set(Array.isArray(raw)?raw:[]);
    }catch(e){return new Set();}
  }
  function bindFolds(){
    const open=openFolds();
    document.querySelectorAll("[data-fold]").forEach(function(el){
      el.open=open.has(el.dataset.fold);
      el.ontoggle=function(){
        const set=openFolds();
        if(el.open)set.add(el.dataset.fold); else set.delete(el.dataset.fold);
        localStorage.setItem(FOLD_KEY,JSON.stringify([...set]));
      };
    });
  }
  function renderFoldCounts(){
    const counts={
      Acts:rows.acts.length,
      Proofs:rows.photos.length,
      History:rows.history.length,
      Ledger:rows.ledger.length,
      Settings:rows.kids.filter(function(k){return k.pin;}).length
    };
    Object.keys(counts).forEach(function(name){
      const el=$("foldCount"+name);
      if(!el)return;
      const n=counts[name];
      el.textContent=name==="Settings"?`${n} PIN${n===1?"":"s"} 密碼`:String(n);
    });
  }
```

- [ ] **Step 2: Call them from `renderAll`**

Find:

```js
  function renderAll(){
    renderOverview();
```

Change to:

```js
  function renderAll(){
    renderFoldCounts();
    renderOverview();
```

- [ ] **Step 3: Bind the folds once at startup**

At the bottom of `js/admin.js`, find:

```js
  init().catch(e=>{show("configState",true);$("configState").querySelector("p").textContent=e.message;});
```

Insert **above** it:

```js
  bindFolds();
```

`bindFolds` runs once against static markup — the folds are in `admin.html`, not re-rendered, so re-binding on every `renderAll` would be wasted work and would fight the `ontoggle` handler.

- [ ] **Step 4: Verify**

Reload, sign in. Expected: all five folds closed, each summary showing a count. Open `Ledger`, reload the page. Expected: `Ledger` is still open, the other four closed.

- [ ] **Step 5: Verify the full check passes**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed`

If it fails on `android 8 syntax`, you used `?.` or `??` — replace with `a && a.b` / `x || fallback`.

- [ ] **Step 6: Commit**

```bash
git add js/admin.js
git commit -m "feat(admin): persist fold state and show live count badges"
```

---

## Task 5: Guard the shell in check.mjs

**Files:**
- Modify: `scripts/check.mjs:222` (after the existing `helpClaims` assertion)

- [ ] **Step 1: Add the assertion**

In `scripts/check.mjs`, find:

```js
if (!adminHtml.includes("helpClaims")) {
  fail("captain", "admin missing help claims queue");
}
```

Insert immediately after it:

```js
for (const marker of ['id="railLeft"', 'id="railRight"', 'class="col-center"']) {
  if (!adminHtml.includes(marker)) {
    fail("admin shell", `admin.html missing ${marker}`);
  }
}
if (!/<details class="fold"/.test(adminHtml)) {
  fail("admin shell", "admin.html missing collapsed cold panels");
}
```

- [ ] **Step 2: Run it and confirm it passes**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed`

- [ ] **Step 3: Confirm the guard actually guards**

Temporarily rename `id="railLeft"` to `id="railLeftX"` in `admin.html`, then run: `node scripts/check.mjs`
Expected: FAIL with `- admin shell: admin.html missing id="railLeft"`
Then undo the rename and re-run — expected: pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/check.mjs
git commit -m "test(admin): assert three-column shell markup exists"
```
