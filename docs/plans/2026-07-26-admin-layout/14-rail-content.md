# Slice 14 — Left rail content

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the left rail actually fit a 300px column — compact Grant stars from three big cards into three rows, add a `Recent 最近` ledger strip for confirmation and undo, and compact App locks to one row per kid.

**Architecture:** Slice 12 *moved* Grant stars and App locks into the left rail unchanged; they render as three 260px-wide cards and overflow a 300px rail badly. This slice rewrites `renderGrants` and `renderAppLocks` to a rail-shaped layout and adds `renderLedgerRecent`. All Supabase writes reuse the existing `grantStars`, `resetStars` and the existing lock upsert handlers — no new write paths.

**Tech Stack:** Plain JS (ES2017, no optional chaining), CSS grid.

**Design:** `docs/plans/2026-07-26-admin-layout/design.md` §4

**Depends on:** slice 12 (`12-admin-shell.md`). Independent of slice 13 — the two can ship in either order.

**DONE WHEN:**
- On a 1080p screen with the page scrolled to top, the left rail shows day controls, Grant stars for all three kids, `Recent 最近`, and App locks **without the rail scrolling**.
- `Recent 最近` shows the last 8 ledger rows newest-first, each with a working undo/revoke.
- `[all ▸]` opens the centre `Ledger` fold and scrolls to it.
- Granting a star updates both the rail total and `Recent 最近` immediately.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **No `?.`, no `??`, no `.flatMap(`** in `admin.html` or `js/admin.js` (`scripts/check.mjs:41-43`).
2. **Bilingual invariant:** every new string ships EN + 繁體中文.
3. **Stars stay a ledger.** `Reset stars to 0` inserts a compensating negative row (`js/admin.js:519-529`); it never zeroes a counter. Do not change that behaviour while compacting the UI.
4. **App-earned ledger rows are never deleted** — revoking one inserts a matching negative admin row (`js/admin.js:593-606`). Only `source='admin'` rows get a hard `Undo`. Preserve that split in the rail.
5. **Tablet-first:** every button ≥44px tall despite the narrower column.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `admin.html` | Modify | Add the `Recent 最近` container to the left rail |
| `js/admin.js` | Modify | Rewrite `renderGrants`, `renderAppLocks`; add `renderLedgerRecent`; extract the shared ledger-action binder |
| `css/admin.css` | Modify | Rail-shaped grant rows, ledger strip, compact lock rows |

---

## Task 1: Compact Grant stars

**Files:**
- Modify: `js/admin.js:479-507` (`renderGrants`)
- Modify: `css/admin.css`

- [ ] **Step 1: Rewrite `renderGrants`**

Replace the whole `function renderGrants(){ … }` body (`js/admin.js:479-507`) with:

```js
  /* Rail-shaped: one row per kid instead of three 260px cards. The reason field
     is shared — Papa types once, then taps whichever kid it applies to. */
  function renderGrants(){
    $("grants").innerHTML=Object.entries(KIDS).map(function(e){
      const id=e[0], k=e[1];
      const stars=(rows.totals.find(function(t){return t.kid_id===id;})||{}).stars||0;
      return `<div class="grant-row" style="--kid-color:${k.color}">
        <div class="grant-row__who">
          <b>${esc(k.name)}</b>
          <span class="gold">⭐ ${stars}</span>
        </div>
        <div class="grant-row__btns">
          <button class="btn btn--danger" data-grant="${id}" data-delta="-1" title="Minus one star 扣1顆">−1</button>
          <button class="btn" data-grant="${id}" data-delta="1" title="Plus one star 加1顆">+1</button>
          <button class="btn btn--secondary" data-grant="${id}" data-delta="2">+2</button>
          <button class="btn btn--secondary" data-grant="${id}" data-delta="3">+3</button>
        </div>
      </div>`;
    }).join("")+`
      <label class="field"><span>Reason 原因</span>
        <input class="input" id="grantReason" placeholder="helped Lucien 幫Lucien"></label>
      <details class="grant-danger">
        <summary>More 更多</summary>
        <div class="row">
          ${Object.entries(KIDS).map(function(e){
            return `<button class="btn btn--danger" data-resetstars="${e[0]}">Reset ${esc(e[1].name)} to 0 歸零</button>`;
          }).join("")}
        </div>
      </details>`;
    document.querySelectorAll("[data-grant]").forEach(function(b){
      b.onclick=function(){grantStars(b.dataset.grant,+b.dataset.delta);};
    });
    document.querySelectorAll("[data-resetstars]").forEach(function(b){
      b.onclick=function(){resetStars(b.dataset.resetstars);};
    });
  }
```

The per-kid `Custom 自訂` number input is dropped: `+1/+2/+3/−1` plus `Reset to 0` cover every real case, and a number spinner per kid does not fit a 300px rail. Papa can still reach any total by tapping more than once.

- [ ] **Step 2: Point `grantStars` at the shared reason field**

`grantStars` currently reads a per-kid input (`js/admin.js:510`). Find:

```js
  async function grantStars(kid,delta){
    const input=$(`reason-${kid}`);
```

Replace with:

```js
  async function grantStars(kid,delta){
    const input=$("grantReason");
```

The rest of the function — including `input.value=""` at the end — works unchanged.

- [ ] **Step 3: Add the CSS**

Append to `css/admin.css`:

```css
/* Grant stars, rail shape: identity on the left, four taps on the right. */
.grant-panel .kid-grid,
#grants {
  display: block;
}

.grant-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
  padding: 8px;
  margin-bottom: 8px;
  border-radius: 8px;
  background: #151127;
  border-left: 3px solid var(--kid-color, var(--blue));
}

.grant-row__who {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.grant-row__btns {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.grant-row__btns .btn {
  min-height: 44px;
  padding: 0;
  font-size: 16px;
}

.grant-danger {
  margin-top: 8px;
}

.grant-danger > summary {
  cursor: pointer;
  color: var(--muted);
  font-size: 13px;
  min-height: 32px;
  display: flex;
  align-items: center;
}
```

- [ ] **Step 4: Verify**

Reload, sign in. Expected: three compact kid rows in the left rail, each with `−1 +1 +2 +3`; one shared `Reason 原因` field below; `More 更多` hides the three reset buttons. Type a reason, tap `+1` on Lili — a toast confirms, her total rises, the reason field clears.

- [ ] **Step 5: Commit**

```bash
git add js/admin.js css/admin.css
git commit -m "feat(admin): rail-shaped Grant stars with a shared reason field"
```

---

## Task 2: `Recent 最近` ledger strip

**Files:**
- Modify: `admin.html` (left rail)
- Modify: `js/admin.js:577-607` (`renderLedger`)
- Modify: `css/admin.css`

- [ ] **Step 1: Add the container**

In `admin.html`, inside `<aside class="rail rail--left …>`, insert this **between** the `grant-panel` section and the App locks section:

```html
    <section class="panel">
      <div class="section-head">
        <h2 class="section-title">🧾 Recent 最近</h2>
        <button class="btn btn--secondary" id="ledgerAllBtn">All ▸ 全部</button>
      </div>
      <div class="ledger-recent" id="ledgerRecent"></div>
    </section>
```

- [ ] **Step 2: Extract the shared ledger-action binder**

`renderLedger` (`js/admin.js:577-607`) binds `[data-delstar]` and `[data-revokestar]` with `document.querySelectorAll`, which would also catch the rail's buttons and vice versa — whichever render ran last would win. Extract the binder so both views share one implementation and both call it after rendering.

Replace the whole `function renderLedger(){ … }` (through its closing brace, currently line 607) with:

```js
  function ledgerActionsHtml(r){
    /* Admin grants are Papa's own rows: hard-delete is honest. App-earned rows
       are the kid's history — revoking inserts a matching negative row instead,
       so the ledger still shows what happened and why. */
    if(r.source==="admin")return `<button class="btn btn--danger" data-delstar="${r.id}" title="Undo 復原">⟲</button>`;
    return r.delta>0?`<button class="btn btn--danger" data-revokestar="${r.id}" title="Revoke 收回">⟲</button>`:"";
  }

  function bindLedgerActions(){
    document.querySelectorAll("[data-delstar]").forEach(function(b){
      b.onclick=async function(){
        const {error}=await client.from("stars_ledger").delete().eq("id",b.dataset.delstar);
        if(error){writeFailed(error);return;}
        toast("Grant undone 已復原",true);
        await loadAll();
      };
    });
    document.querySelectorAll("[data-revokestar]").forEach(function(b){
      b.onclick=async function(){
        const r=rows.ledger.find(function(x){return x.id===b.dataset.revokestar;});
        if(!r)return;
        if(!confirm(`Revoke ${r.delta} ⭐ from ${kidName(r.kid_id)} — "${r.reason}"?\n收回${kidName(r.kid_id)}的${r.delta}顆星星？`))return;
        const {error}=await client.from("stars_ledger").insert({
          kid_id:r.kid_id,delta:-r.delta,reason:`Revoked 收回: ${r.reason}`,
          source:"admin",granted_by:session.user.id
        });
        if(error){writeFailed(error);return;}
        toast(`−${r.delta} ⭐ ${kidName(r.kid_id)} — revoked 已收回`,true);
        await loadAll();
      };
    });
  }

  function renderLedger(){
    $("ledger").innerHTML=`<table class="table"><thead><tr>
      <th>Time 時間</th><th>Kid 孩子</th><th>Delta 星</th><th>Reason 原因</th><th>Source 來源</th><th></th>
    </tr></thead><tbody>${rows.ledger.map(function(r){return `<tr>
      <td>${fmt(r.created_at)}</td><td>${kidName(r.kid_id)}</td><td>${r.delta>0?"+":""}${r.delta}</td>
      <td>${esc(r.reason)}</td><td>${esc(r.source)}</td>
      <td>${ledgerActionsHtml(r)}</td>
    </tr>`;}).join("")}</tbody></table>`;
  }

  /* Rail view: confirmation, not audit. Last 8 rows so Papa can see a grant land
     and undo a mis-tap without leaving the rail. Full history lives in the
     centre Ledger fold. */
  function renderLedgerRecent(){
    const recent=rows.ledger.slice(0,8);
    $("ledgerRecent").innerHTML=recent.length?recent.map(function(r){
      const k=KIDS[r.kid_id]||{name:r.kid_id,color:"var(--blue)"};
      return `<div class="ledger-row" style="--kid-color:${k.color}">
        <span class="muted">${timeOnly(r.created_at)}</span>
        <span class="ledger-row__delta ${r.delta>0?"gold":"bad"}">${r.delta>0?"+":""}${r.delta}</span>
        <span class="ledger-row__why"><b>${esc(k.name)}</b> ${esc(r.reason)}</span>
        ${ledgerActionsHtml(r)}
      </div>`;
    }).join(""):`<p class="compact-copy">No stars yet today 今天還沒有星星</p>`;
  }
```

- [ ] **Step 3: Call both, then bind once**

In `renderAll`, find:

```js
    renderLedger();
```

Replace with:

```js
    renderLedger();
    renderLedgerRecent();
    bindLedgerActions();
```

Binding **after** both renders is what makes the shared `document.querySelectorAll` correct — it sees the rail rows and the table rows in one pass.

- [ ] **Step 4: Wire `All ▸ 全部`**

At the bottom of `js/admin.js`, near the other handlers, add:

```js
  $("ledgerAllBtn").onclick=function(){
    const fold=document.querySelector('[data-fold="ledger"]');
    if(!fold)return;
    fold.open=true;
    fold.scrollIntoView({behavior:"smooth",block:"start"});
  };
```

The `ontoggle` handler from slice 12 persists the newly-open state automatically.

- [ ] **Step 5: Add the CSS**

Append to `css/admin.css`:

```css
/* Recent ledger strip — its own scroll so a busy morning cannot push App locks
   off the rail. */
.ledger-recent {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 26vh;
  overflow-y: auto;
}

.ledger-row {
  display: grid;
  grid-template-columns: auto 34px minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
  padding: 5px 6px;
  border-radius: 6px;
  background: #151127;
  border-left: 3px solid var(--kid-color, var(--blue));
  font-size: 12px;
}

.ledger-row__delta {
  font-weight: 700;
  text-align: right;
}

.ledger-row__why {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ledger-row .btn {
  min-height: 30px;
  min-width: 34px;
  padding: 0;
}

.bad {
  color: var(--bad);
}
```

`.ledger-row__why` is the one place ellipsis is allowed — it is a log line, not a message from a kid. Message bubbles always wrap (design §8).

- [ ] **Step 6: Verify**

Reload. Expected: `Recent 最近` lists the last 8 ledger rows newest-first with kid colour, delta, reason and a `⟲` button. Grant `+1` to Luis — the row appears at the top immediately. Tap its `⟲` — the grant is undone and his total drops. Tap `All ▸ 全部` — the page scrolls to the `Ledger` fold and it is open.

- [ ] **Step 7: Verify the undo split is intact**

In `Recent 最近`, find a row with `source` `app` (a kid-earned star, e.g. from a brain-gym completion) and tap its `⟲`. Expected: a confirm dialog, then a **new** negative row appears in the strip — the original row is still there. Then find an admin row and tap `⟲`. Expected: the row disappears with no new row.

- [ ] **Step 8: Commit**

```bash
git add admin.html js/admin.js css/admin.css
git commit -m "feat(admin): Recent ledger strip in the left rail"
```

---

## Task 3: Compact App locks

**Files:**
- Modify: `js/admin.js:895-929` (`renderAppLocks`)
- Modify: `css/admin.css`

- [ ] **Step 1: Rewrite the markup half of `renderAppLocks`**

Replace the `$("applocks").innerHTML=…` assignment (`js/admin.js:897-911`) with:

```js
    $("applocks").innerHTML=Object.entries(KIDS).map(function(e){
      const id=e[0], k=e[1];
      const paused=(fs["applock_"+id]||"")!=="";
      const cats=LOCK_CATS.filter(function(c){return c[0]!=="captain"||id==="luis";});
      const lockedCount=cats.filter(function(c){return (fs[`catlock_${id}_${c[0]}`]||"")!=="";}).length;
      const summary=paused?"⏸ paused 已暫停":lockedCount?`🔒 ${lockedCount} locked ${lockedCount}項鎖定`:"free 自由";
      return `<details class="lock-row ${paused?"is-paused":""}" style="--kid-color:${k.color}">
        <summary><b>${esc(k.name)}</b> <span class="muted">${summary}</span></summary>
        <div class="lock-row__body">
          <button class="btn ${paused?"":"btn--danger"}" data-applock="${id}" data-paused="${paused?1:0}">
            ${paused?"Resume app 恢復app":"Pause whole app 暫停整個app"}</button>
          <div class="cat-locks">
            ${cats.map(function(c){
              const locked=(fs[`catlock_${id}_${c[0]}`]||"")!=="";
              return `<button class="btn ${locked?"btn--danger":"btn--secondary"}" data-catlock="${id}:${c[0]}" data-locked="${locked?1:0}">
                ${locked?"Unlock 解鎖":"Lock 鎖定"} ${c[1]}</button>`;
            }).join("")}
          </div>
        </div>
      </details>`;
    }).join("");
```

The two `document.querySelectorAll` handler blocks below it (`js/admin.js:912-928`) are unchanged — the `data-applock` and `data-catlock` attributes are identical.

- [ ] **Step 2: Add the CSS**

Append to `css/admin.css`:

```css
/* App locks — one summary row per kid; the controls expand in place. Paused is
   the one state that must read at a glance, so it keeps a coloured edge. */
#applocks {
  display: block;
}

.lock-row {
  margin-bottom: 6px;
  border-radius: 8px;
  background: #151127;
  border-left: 3px solid var(--kid-color, var(--blue));
}

.lock-row.is-paused {
  border-left-color: var(--gold);
}

.lock-row > summary {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 44px;
  padding: 0 10px;
  cursor: pointer;
  font-size: 14px;
}

.lock-row__body {
  padding: 0 10px 10px;
  display: grid;
  gap: 6px;
}

.lock-row .cat-locks {
  display: grid;
  gap: 6px;
}
```

- [ ] **Step 3: Verify**

Reload. Expected: three collapsed lock rows in the left rail, each reading `Name — free 自由` / `⏸ paused 已暫停` / `🔒 2 locked 2項鎖定`. Expand Lili, tap `Lock 鎖定 Games 遊戲` — a toast confirms, the row collapses back with `🔒 1 locked`, and the kid tablet blocks games.

- [ ] **Step 4: Commit**

```bash
git add js/admin.js css/admin.css
git commit -m "feat(admin): compact one-row-per-kid App locks in the rail"
```

---

## Task 4: Finish the fold counts and verify the whole rail fits

**Files:**
- Modify: `js/admin.js` — `renderFoldCounts` (added in slice 12)

- [ ] **Step 1: Cover the folds slice 13 added**

Slice 13 added two folds — `data-fold="note"` and `data-fold="notify"` — whose badges (`#foldCountNote`, `#foldCountNotify`) render empty because `renderFoldCounts` does not know about them. Find:

```js
    const counts={
      Acts:rows.acts.length,
      Proofs:rows.photos.length,
      History:rows.history.length,
      Ledger:rows.ledger.length,
      Settings:rows.kids.filter(function(k){return k.pin;}).length
    };
```

Replace with:

```js
    const counts={
      Note:$("noteBody").value.trim()?1:0,
      Acts:rows.acts.length,
      Proofs:rows.photos.length,
      History:rows.history.length,
      Ledger:rows.ledger.length,
      Notify:notifyItems.length,
      Settings:rows.kids.filter(function(k){return k.pin;}).length
    };
```

and replace the label line:

```js
      el.textContent=name==="Settings"?`${n} PIN${n===1?"":"s"} 密碼`:String(n);
```

with:

```js
      el.textContent=name==="Settings"?`${n} PIN${n===1?"":"s"} 密碼`
        :name==="Note"?(n?"written 已寫":"empty 未寫")
        :String(n);
```

If slice 13 has not shipped yet, `$("noteBody")` still exists (it is in the Messages panel from slice 12) and `#foldCountNote` / `#foldCountNotify` simply do not exist — `renderFoldCounts` already guards with `if(!el)return;`, so this is safe in either order.

- [ ] **Step 2: Verify the rail fits without scrolling**

Set the browser window to 1920×1080, scroll the page to the top.
Expected: the left rail shows, top to bottom — Today controls, Grant stars (3 rows + reason + `More 更多`), `Recent 最近`, App locks (3 collapsed rows) — with **no scrollbar on the rail itself**.

If the rail scrolls, reduce `.ledger-recent { max-height }` from `26vh` to `20vh` and re-check. Do not shrink button heights below 44px.

- [ ] **Step 3: Verify the short-screen fallback**

Resize the window to 1400×700. Expected: the left rail grows its own scrollbar; Grant stars is still reachable by scrolling the rail; the page's own scroll still moves the centre column independently.

- [ ] **Step 4: Run the full check**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed`

- [ ] **Step 5: Commit**

```bash
git add js/admin.js
git commit -m "feat(admin): fold count badges for note and raw feed"
```
