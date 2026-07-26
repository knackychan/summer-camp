# Slice 13 — Conversation rail

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Messages, Captain claims and Pass requests panels with a single chat-style conversation panel in the right rail — one chronological stream, kid bubbles left, Papa bubbles right, filterable by kid and by kind, with a send box that lets Papa start a conversation.

**Architecture:** The merge-and-filter logic goes in a new pure module `js/chat-core.js` (`SQChat`), unit-tested with `node --test` exactly like `js/time-core.js`. `js/admin.js` keeps all DOM and Supabase work: it feeds `SQChat` the already-fetched `rows` object and renders whatever comes back. No new queries and no new realtime subscriptions — `subscribeRealtime` at `js/admin.js:938-950` already listens to all ten source tables.

**Tech Stack:** Plain JS (ES2017, no optional chaining), `node --test` for the pure module, Supabase JS v2 for writes.

**Design:** `docs/plans/2026-07-26-admin-layout/design.md` §3, §6

**Depends on:** slice 12 (`12-admin-shell.md`) — the right rail must exist.

**DONE WHEN:**
- The right rail shows one merged stream: asks, Papa replies, captain claims, pass requests, photos, system events.
- Filtering by kid and by kind both work and survive a page reload.
- The `⚡ Needs you` chip count matches the header badge exactly.
- Every action from the three deleted panels is reachable from the rail: answer an ask (text **and** voice), archive/restore an ask, approve/deny a claim, approve/deny a pass, save Papa's daily message.
- Papa can send a message to a kid who has not asked anything.
- `node scripts/check.mjs` passes, including the new `chat-core` unit tests.

---

## Constraints you must not violate

1. **No `?.`, no `??`, no `.flatMap(`** in `admin.html`, `js/admin.js`, or the new `js/chat-core.js`. `scripts/check.mjs:41-43` fails the build on these. Use `a && a.b` and `x || fallback`.
2. **`admin.html` must keep the literal string `helpClaims`** (`scripts/check.mjs:222`). This slice keeps it honestly: the `#helpClaimsStatus` error element moves into the rail, because `setHelpClaim` at `js/admin.js:725` writes to it.
3. **Bilingual invariant:** every new string ships EN + 繁體中文.
4. **Stars stay a ledger.** Approving a claim inserts a `+1` row; it never edits a counter. The existing `setHelpClaim` already does this — do not rewrite it.
5. **Tablet-first / coarse pointer:** every chip and button ≥40px tall. No hover-only affordance.
6. **A new runtime file must be registered in three places** or it will silently not ship: `scripts/check.mjs` `runtimeFiles`, `sw.js` `APP_SHELL`, and a `<script>` tag in `admin.html`.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/chat-core.js` | **Create** | Pure: merge six row sets into one sorted stream; filter it; count what needs Papa. No DOM, no network. |
| `scripts/chat-core.test.mjs` | **Create** | `node --test` unit tests for `SQChat` |
| `admin.html` | Modify | Conversation panel markup in the right rail; delete Messages / Captain claims / Pass requests panels; add `<script src="js/chat-core.js">` |
| `js/admin.js` | Modify | `renderConversation()` replaces `renderAsks` / `renderHelpClaims` / `renderPasses`; filter state; send box |
| `css/admin.css` | Modify | Chat bubble, chip, action-card, send-box styling |
| `sw.js` | Modify | Add `js/chat-core.js` to `APP_SHELL`, bump `CACHE_NAME` |
| `scripts/check.mjs` | Modify | Add `js/chat-core.js` to `runtimeFiles`; run the new test file |
| `supabase/schema.sql` | Modify | Add the `admin ask` INSERT policy |

---

## Task 1: `SQChat.buildStream` — merge the tables

**Files:**
- Create: `js/chat-core.js`
- Create: `scripts/chat-core.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/chat-core.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SQChat = require("../js/chat-core.js");

const TODAY = "2026-07-26";

const emptyRows = {
  asks: [], helpClaims: [], passes: [], photos: [], ticks: [], ledger: [], redos: []
};
const rowsWith = extra => Object.assign({}, emptyRows, extra);

test("buildStream on empty data returns an empty array", () => {
  assert.deepEqual(SQChat.buildStream(emptyRows, { today: TODAY }), []);
});

test("buildStream turns an unanswered ask into one kid row that needs Papa", () => {
  const stream = SQChat.buildStream(rowsWith({
    asks: [{ id: "a1", kid_id: "lucien", kind: "question", body: "how say 儀餐?",
             answer: null, answered_at: null, created_at: "2026-07-26T09:20:00Z" }]
  }), { today: TODAY });
  assert.equal(stream.length, 1);
  assert.equal(stream[0].type, "ask");
  assert.equal(stream[0].side, "kid");
  assert.equal(stream[0].kidId, "lucien");
  assert.equal(stream[0].body, "how say 儀餐?");
  assert.equal(stream[0].needs, true);
});

test("buildStream splits an answered ask into a kid row and a papa row", () => {
  const stream = SQChat.buildStream(rowsWith({
    asks: [{ id: "a1", kid_id: "lili", kind: "question", body: "can I paint?",
             answer: "yes after lunch 午餐後可以", answered_at: "2026-07-26T09:30:00Z",
             created_at: "2026-07-26T09:20:00Z" }]
  }), { today: TODAY });
  assert.equal(stream.length, 2);
  assert.equal(stream[0].type, "ask");
  assert.equal(stream[0].needs, false);
  assert.equal(stream[1].type, "reply");
  assert.equal(stream[1].side, "papa");
  assert.equal(stream[1].body, "yes after lunch 午餐後可以");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test scripts/chat-core.test.mjs`
Expected: FAIL — `Cannot find module '../js/chat-core.js'`

- [ ] **Step 3: Write the minimal implementation**

Create `js/chat-core.js`:

```js
/* SQChat — pure merge/filter for the admin conversation rail.
   No DOM, no network: it takes the rows admin.js already fetched and returns
   one sorted stream. Same dual-export shape as js/time-core.js so node --test
   can require it. */
(function(){
  function askRows(asks, ctx){
    const out=[];
    (asks||[]).forEach(function(a){
      const archived=ctx.archivedIds && ctx.archivedIds.has(a.id);
      if(a.kind!=="papa"){
        out.push({
          id:"ask:"+a.id, srcId:a.id, type:"ask", side:"kid", kidId:a.kid_id,
          at:a.created_at, body:a.body||"", audio:a.audio_path||null,
          needs:!a.answered_at && !archived, archived:!!archived,
          meta:{kind:a.kind||"question"}
        });
      }
      if(a.answer||a.answer_audio_path){
        out.push({
          id:"reply:"+a.id, srcId:a.id, type:"reply", side:"papa", kidId:a.kid_id,
          at:a.answered_at||a.created_at, body:a.answer||"",
          audio:a.answer_audio_path||null, needs:false, archived:!!archived, meta:{}
        });
      }
    });
    return out;
  }

  function buildStream(rows, ctx){
    const c=ctx||{};
    return askRows(rows&&rows.asks, c).sort(function(x,y){
      return new Date(x.at)-new Date(y.at);
    });
  }

  const api={buildStream:buildStream};
  if(typeof window!=="undefined")window.SQChat=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test scripts/chat-core.test.mjs`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add js/chat-core.js scripts/chat-core.test.mjs
git commit -m "feat(admin): SQChat.buildStream merges asks into a chat stream"
```

---

## Task 2: `buildStream` — claims, passes, photos, system rows

**Files:**
- Modify: `js/chat-core.js`
- Modify: `scripts/chat-core.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/chat-core.test.mjs`:

```js
test("buildStream turns a requested claim into an action card that needs Papa", () => {
  const stream = SQChat.buildStream(rowsWith({
    helpClaims: [{ id: "c1", captain_id: "luis", helped_kid_id: "lili", day: TODAY,
                   body: "helped Lili tidy up", status: "requested",
                   created_at: "2026-07-26T10:00:00Z" }]
  }), { today: TODAY });
  assert.equal(stream.length, 1);
  assert.equal(stream[0].type, "claim");
  assert.equal(stream[0].side, "kid");
  assert.equal(stream[0].kidId, "luis");
  assert.equal(stream[0].needs, true);
  assert.equal(stream[0].meta.helped, "lili");
});

test("buildStream marks a reviewed claim as no longer needing Papa", () => {
  const stream = SQChat.buildStream(rowsWith({
    helpClaims: [{ id: "c1", captain_id: "luis", helped_kid_id: "lili", day: TODAY,
                   body: "helped", status: "approved",
                   created_at: "2026-07-26T10:00:00Z" }]
  }), { today: TODAY });
  assert.equal(stream[0].needs, false);
  assert.equal(stream[0].meta.status, "approved");
});

test("buildStream includes requested passes but not outing passes", () => {
  const stream = SQChat.buildStream(rowsWith({
    passes: [
      { id: "p1", kid_id: "lili", kind: "golden", status: "requested", block_idx: 3,
        reason: "tired", created_at: "2026-07-26T11:00:00Z" },
      { id: "p2", kid_id: "lili", kind: "outing", status: "granted", block_idx: 4,
        reason: "removed", created_at: "2026-07-26T11:05:00Z" }
    ]
  }), { today: TODAY });
  assert.equal(stream.length, 1);
  assert.equal(stream[0].type, "pass");
  assert.equal(stream[0].needs, true);
});

test("buildStream adds photo and system rows", () => {
  const stream = SQChat.buildStream(rowsWith({
    photos: [{ id: "ph1", kid_id: "luis", day: TODAY, block_idx: 2, path: "x.jpg",
               created_at: "2026-07-26T12:00:00Z" }],
    ticks: [{ kid_id: "lili", day: TODAY, block_idx: 1,
              created_at: "2026-07-26T12:30:00Z" }],
    ledger: [{ id: "l1", kid_id: "lucien", delta: 1, reason: "brain gym",
               source: "app", created_at: "2026-07-26T12:45:00Z" }]
  }), { today: TODAY });
  assert.deepEqual(stream.map(r => r.type), ["photo", "system", "system"]);
  assert.equal(stream.every(r => r.needs === false), true);
});

test("buildStream sorts every source together, oldest first", () => {
  const stream = SQChat.buildStream(rowsWith({
    asks: [{ id: "a1", kid_id: "lili", kind: "question", body: "late",
             answer: null, answered_at: null, created_at: "2026-07-26T15:00:00Z" }],
    helpClaims: [{ id: "c1", captain_id: "luis", helped_kid_id: "lili", day: TODAY,
                   body: "early", status: "requested",
                   created_at: "2026-07-26T08:00:00Z" }]
  }), { today: TODAY });
  assert.deepEqual(stream.map(r => r.body), ["early", "late"]);
});

test("buildStream ignores ticks and photos from other days", () => {
  const stream = SQChat.buildStream(rowsWith({
    ticks: [{ kid_id: "lili", day: "2026-07-25", block_idx: 1,
              created_at: "2026-07-25T12:30:00Z" }],
    photos: [{ id: "ph1", kid_id: "luis", day: "2026-07-25", block_idx: 2,
               path: "x.jpg", created_at: "2026-07-25T12:00:00Z" }]
  }), { today: TODAY });
  assert.deepEqual(stream, []);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test scripts/chat-core.test.mjs`
Expected: FAIL — the claim/pass/photo/system tests report `stream.length` of `0`.

- [ ] **Step 3: Implement the remaining row builders**

In `js/chat-core.js`, insert these functions **above** `function buildStream`:

```js
  function claimRows(claims){
    return (claims||[]).map(function(c){
      return {
        id:"claim:"+c.id, srcId:c.id, type:"claim", side:"kid", kidId:c.captain_id,
        at:c.created_at, body:c.body||"", audio:null,
        needs:c.status==="requested", archived:false,
        meta:{helped:c.helped_kid_id, status:c.status||"requested"}
      };
    });
  }

  /* 'outing' passes are Papa's own bulk removals from the Today panel, not a kid
     asking for anything — they would flood the rail with noise. */
  function passRows(passes){
    return (passes||[]).filter(function(p){return p.kind!=="outing";}).map(function(p){
      return {
        id:"pass:"+p.id, srcId:p.id, type:"pass", side:"kid", kidId:p.kid_id,
        at:p.created_at, body:p.reason||"", audio:null,
        needs:p.status==="requested", archived:false,
        meta:{kind:p.kind||"golden", status:p.status||"requested", blockIdx:p.block_idx}
      };
    });
  }

  function photoRows(photos, today){
    return (photos||[]).filter(function(p){return p.day===today;}).map(function(p){
      return {
        id:"photo:"+p.id, srcId:p.id, type:"photo", side:"kid", kidId:p.kid_id,
        at:p.created_at, body:"", audio:null, needs:false, archived:false,
        meta:{path:p.path, blockIdx:p.block_idx}
      };
    });
  }

  function systemRows(rows, today){
    const out=[];
    (rows.ticks||[]).filter(function(t){return t.day===today;}).forEach(function(t){
      out.push({
        id:"tick:"+t.kid_id+":"+t.day+":"+t.block_idx, srcId:null, type:"system",
        side:"system", kidId:t.kid_id, at:t.created_at, body:"", audio:null,
        needs:false, archived:false, meta:{event:"tick", blockIdx:t.block_idx}
      });
    });
    (rows.ledger||[]).forEach(function(l){
      out.push({
        id:"star:"+l.id, srcId:l.id, type:"system", side:"system", kidId:l.kid_id,
        at:l.created_at, body:l.reason||"", audio:null, needs:false, archived:false,
        meta:{event:"star", delta:l.delta, source:l.source}
      });
    });
    (rows.redos||[]).filter(function(r){return r.day===today;}).forEach(function(r){
      out.push({
        id:"redo:"+r.kid_id+":"+r.day+":"+r.block_idx, srcId:null, type:"system",
        side:"system", kidId:r.kid_id, at:r.created_at, body:r.note||"", audio:null,
        needs:false, archived:false, meta:{event:"redo", blockIdx:r.block_idx}
      });
    });
    return out;
  }
```

Then replace `buildStream` with:

```js
  function buildStream(rows, ctx){
    const c=ctx||{}, r=rows||{};
    return []
      .concat(askRows(r.asks, c))
      .concat(claimRows(r.helpClaims))
      .concat(passRows(r.passes))
      .concat(photoRows(r.photos, c.today))
      .concat(systemRows(r, c.today))
      .sort(function(x,y){return new Date(x.at)-new Date(y.at);});
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test scripts/chat-core.test.mjs`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add js/chat-core.js scripts/chat-core.test.mjs
git commit -m "feat(admin): SQChat merges claims, passes, photos and system events"
```

---

## Task 3: `SQChat.filterStream` and `SQChat.needsCount`

**Files:**
- Modify: `js/chat-core.js`
- Modify: `scripts/chat-core.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/chat-core.test.mjs`:

```js
const mixed = () => SQChat.buildStream(rowsWith({
  asks: [{ id: "a1", kid_id: "lucien", kind: "question", body: "ask-lucien",
           answer: null, answered_at: null, created_at: "2026-07-26T09:00:00Z" }],
  helpClaims: [{ id: "c1", captain_id: "luis", helped_kid_id: "lili", day: TODAY,
                 body: "claim-luis", status: "requested",
                 created_at: "2026-07-26T10:00:00Z" }],
  passes: [{ id: "p1", kid_id: "lili", kind: "golden", status: "granted",
             block_idx: 3, reason: "pass-lili",
             created_at: "2026-07-26T11:00:00Z" }],
  ticks: [{ kid_id: "lili", day: TODAY, block_idx: 1,
            created_at: "2026-07-26T12:00:00Z" }]
}), { today: TODAY });

test("filterStream with no filters returns everything", () => {
  assert.equal(SQChat.filterStream(mixed(), {}).length, 4);
});

test("filterStream by kid keeps only that kid", () => {
  const out = SQChat.filterStream(mixed(), { kid: "lili" });
  assert.equal(out.every(r => r.kidId === "lili"), true);
  assert.equal(out.length, 2);
});

test("filterStream kid 'all' is the same as no kid filter", () => {
  assert.equal(SQChat.filterStream(mixed(), { kid: "all" }).length, 4);
});

test("filterStream by type keeps only the listed types", () => {
  const out = SQChat.filterStream(mixed(), { types: ["ask", "claim"] });
  assert.deepEqual(out.map(r => r.type), ["ask", "claim"]);
});

test("filterStream treats reply as part of the ask type", () => {
  const stream = SQChat.buildStream(rowsWith({
    asks: [{ id: "a1", kid_id: "lili", kind: "question", body: "q",
             answer: "a", answered_at: "2026-07-26T09:30:00Z",
             created_at: "2026-07-26T09:20:00Z" }]
  }), { today: TODAY });
  assert.equal(SQChat.filterStream(stream, { types: ["ask"] }).length, 2);
});

test("needs filter overrides both axes", () => {
  const out = SQChat.filterStream(mixed(), { kid: "lili", types: ["system"], needs: true });
  assert.equal(out.length, 2);
  assert.equal(out.every(r => r.needs === true), true);
});

test("needsCount counts exactly what the needs filter returns", () => {
  const stream = mixed();
  assert.equal(SQChat.needsCount(stream), SQChat.filterStream(stream, { needs: true }).length);
  assert.equal(SQChat.needsCount(stream), 2);
});

test("archived rows are hidden unless asked for", () => {
  const rows = rowsWith({
    asks: [{ id: "a1", kid_id: "lili", kind: "question", body: "old",
             answer: null, answered_at: null, created_at: "2026-07-26T09:00:00Z" }]
  });
  const ctx = { today: TODAY, archivedIds: new Set(["a1"]) };
  const stream = SQChat.buildStream(rows, ctx);
  assert.equal(SQChat.filterStream(stream, {}).length, 0);
  assert.equal(SQChat.filterStream(stream, { archived: true }).length, 1);
  assert.equal(SQChat.needsCount(stream), 0);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test scripts/chat-core.test.mjs`
Expected: FAIL — `SQChat.filterStream is not a function`

- [ ] **Step 3: Implement**

In `js/chat-core.js`, insert **above** `const api=`:

```js
  /* A Papa reply belongs to the same conversation as the ask that produced it,
     so the 'ask' chip must keep both halves — filtering one away would leave
     an answer with no question. */
  const TYPE_GROUP={ask:"ask", reply:"ask", claim:"claim", pass:"pass", photo:"photo", system:"system"};

  function filterStream(stream, filters){
    const f=filters||{};
    const wantArchived=!!f.archived;
    const types=f.types&&f.types.length?f.types:null;
    return (stream||[]).filter(function(row){
      if(row.archived&&!wantArchived)return false;
      if(f.needs)return row.needs===true;
      if(f.kid&&f.kid!=="all"&&row.kidId!==f.kid)return false;
      if(types&&types.indexOf(TYPE_GROUP[row.type])<0)return false;
      return true;
    });
  }

  function needsCount(stream){
    return (stream||[]).filter(function(row){
      return row.needs===true&&!row.archived;
    }).length;
  }
```

Change the export line to:

```js
  const api={buildStream:buildStream, filterStream:filterStream, needsCount:needsCount, TYPE_GROUP:TYPE_GROUP};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test scripts/chat-core.test.mjs`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add js/chat-core.js scripts/chat-core.test.mjs
git commit -m "feat(admin): SQChat filtering by kid, kind and needs-Papa"
```

---

## Task 4: Register `chat-core.js` in the build guards

**Files:**
- Modify: `scripts/check.mjs:21` (`runtimeFiles`) and `scripts/check.mjs:231` (test runner block)
- Modify: `sw.js:1` and `sw.js:11`

- [ ] **Step 1: Add to `runtimeFiles`**

In `scripts/check.mjs`, find the `runtimeFiles` array and add `"js/chat-core.js"` after `"js/time-core.js"`:

```js
const runtimeFiles = ["index.html", "admin.html", "js/day.js", "js/day-data.js", "js/act-data.js", "js/time-core.js", "js/chat-core.js", "js/lock-core.js", "js/pinpad.js", "js/papa-tools.js", "js/drills.js", "js/brain-data.js", "js/brain-core.js", "js/brain-ui.js", "js/sync.js", "js/admin.js", "sw.js"];
```

- [ ] **Step 2: Run the new tests from check.mjs**

In `scripts/check.mjs`, find:

```js
const coreTest = spawnSync(process.execPath, ["--test", "scripts/core.test.mjs"], { cwd: root, encoding: "utf8" });
if (coreTest.status !== 0) {
  fail("core tests", (coreTest.stderr || coreTest.stdout || "node --test scripts/core.test.mjs failed").trim().split("\n").slice(-8).join("\n"));
}
```

Insert immediately after it:

```js
const chatTest = spawnSync(process.execPath, ["--test", "scripts/chat-core.test.mjs"], { cwd: root, encoding: "utf8" });
if (chatTest.status !== 0) {
  fail("chat tests", (chatTest.stderr || chatTest.stdout || "node --test scripts/chat-core.test.mjs failed").trim().split("\n").slice(-8).join("\n"));
}
```

- [ ] **Step 3: Add to the service worker precache**

In `sw.js`, change line 1:

```js
const CACHE_NAME = "summer-quest-v9";
```

and add `"./js/chat-core.js",` immediately after `"./js/time-core.js",` in `APP_SHELL`.

- [ ] **Step 4: Verify**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed`

- [ ] **Step 5: Commit**

```bash
git add scripts/check.mjs sw.js
git commit -m "chore(admin): register chat-core in check and service worker"
```

---

## Task 5: Schema — let Papa start a conversation

**Files:**
- Modify: `supabase/schema.sql` (append at end)

- [ ] **Step 1: Append the policy**

Add to the end of `supabase/schema.sql`:

```sql
-- ============================================================
-- v6 addition — Papa can start a conversation, not only answer one
-- (admin conversation rail, plan 2026-07-26, slice 13)
-- ============================================================
-- Before this, "admin answer" gave the authenticated admin UPDATE only, so
-- Papa could reply to a kid's ask but never send the first message. Papa-sent
-- rows use kind='papa' with the text in `answer` and `body` null; asks.kind is
-- plain text with no check constraint, so no migration is needed. RLS policies
-- are OR'd, so the kid-facing "kid ask" check (answer is null) does not block
-- this one.
do $$
begin
  execute 'drop policy if exists "admin ask" on public.asks';
  execute 'create policy "admin ask" on public.asks for insert to authenticated with check (true)';
end $$;
```

- [ ] **Step 2: Apply it**

Paste the new block into the Supabase SQL Editor and run it.
Expected: `Success. No rows returned`

- [ ] **Step 3: Verify the policy exists**

In the Supabase SQL Editor run:

```sql
select policyname, cmd from pg_policies where tablename = 'asks' order by policyname;
```

Expected: a row `admin ask | INSERT` alongside the existing `admin answer | UPDATE`, `kid ask | INSERT`, `read asks | SELECT`.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(admin): RLS policy letting Papa start a conversation"
```

---

## Task 6: Conversation panel markup

**Files:**
- Modify: `admin.html` — the `#railRight` block from slice 12, the `<script>` list, and the three centre panels to delete

- [ ] **Step 1: Replace the right rail**

Replace the whole `<aside class="rail rail--right hidden" id="railRight"> … </aside>` block with:

```html
  <aside class="rail rail--right hidden" id="railRight">
    <section class="panel chat-panel">
      <div class="section-head">
        <h2 class="section-title">💬 Conversation 對話</h2>
        <span class="pill gold" id="chatNeedsBadge">0</span>
        <button class="btn btn--secondary btn--icon" id="notifyEnableBtn" title="Windows notifications Windows通知">🔔</button>
        <button class="btn btn--secondary btn--icon" id="notifyClearBtn" title="Clear feed 清除">🧹</button>
      </div>
      <p class="pill" id="notifyStatus">Dashboard only 只在頁面內</p>

      <div class="chat-filters" id="chatKidFilter" role="group" aria-label="Filter by kid 依孩子篩選"></div>
      <div class="chat-filters" id="chatTypeFilter" role="group" aria-label="Filter by kind 依種類篩選"></div>

      <div class="chat-pin" id="chatPin"></div>

      <div class="chat-stream" id="chatStream" role="log" aria-live="polite"></div>
      <button class="btn chat-jump hidden" id="chatJump">New messages ↓ 新訊息</button>

      <p class="message message--error" id="helpClaimsStatus"></p>

      <div class="chat-send">
        <select class="input" id="chatTo" aria-label="Send to 傳給">
          <option value="all">All 全部</option>
          <option value="lucien">Lucien</option>
          <option value="lili">Lili</option>
          <option value="luis">Luis</option>
        </select>
        <textarea class="input textarea chat-input" id="chatBody" rows="2" placeholder="Message… 訊息…"></textarea>
        <button class="btn btn--icon" id="chatSend" title="Send 送出">↑</button>
      </div>
      <label class="toggle-line"><input type="checkbox" id="showArchivedAsks"> Show archived 顯示封存</label>
    </section>

    <details class="fold" data-fold="notify">
      <summary>🔔 Raw feed 原始通知<span class="fold__count" id="foldCountNotify"></span></summary>
      <div class="fold__body">
        <div class="notify-feed" id="notifyFeed" role="log" aria-live="polite"></div>
      </div>
    </details>
  </aside>
```

`#helpClaimsStatus` moves here because `setHelpClaim` at `js/admin.js:725` and `:730` writes to it. `#showArchivedAsks` moves here because `renderAsks` read it; `renderConversation` reads it now. `#notifyStatus`, `#notifyEnableBtn`, `#notifyClearBtn`, `#notifyFeed` all keep their ids so `renderNotifications` at `js/admin.js:60-76` needs no change.

- [ ] **Step 2: Delete the three superseded centre panels**

From inside `<section id="dash">`, delete these three whole blocks added in slice 12:
- `<section class="panel comms-panel"> … </section>` (Messages)
- `<section class="panel"> … id="helpClaims" … </section>` (Captain claims)
- `<section class="panel"> … id="passes" … </section>` (Pass requests)

Then add Papa's daily message back as a centre fold, because it is a compose-once-a-day job, not a conversation:

```html
      <details class="fold" data-fold="note">
        <summary>Papa's daily message 爸爸每日留言<span class="fold__count" id="foldCountNote"></span></summary>
        <div class="fold__body">
          <p class="compact-copy" id="noteDay"></p>
          <label class="field">
            <span>Message for today 給今天的留言</span>
            <textarea class="input textarea" id="noteBody" placeholder="Have a brave, kind day! 今天也要勇敢又溫柔！"></textarea>
          </label>
          <p class="message message--ok" id="noteStatus"></p>
          <button class="btn" id="saveNoteBtn">Save message 儲存留言</button>
        </div>
      </details>
```

Place it as the **first** fold, above `data-fold="acts"`.

- [ ] **Step 3: Load the new module**

In `admin.html`, add the script tag between `time-core.js` and `admin.js`:

```html
<script src="js/time-core.js"></script>
<script src="js/chat-core.js"></script>
<script src="js/admin.js"></script>
```

- [ ] **Step 4: Verify the `helpClaims` guard still passes**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed` — `helpClaimsStatus` in the rail satisfies the `adminHtml.includes("helpClaims")` assertion at `scripts/check.mjs:222`.

If it fails with `- captain: admin missing help claims queue`, you deleted `#helpClaimsStatus` — put it back; `setHelpClaim` writes to it.

- [ ] **Step 5: Commit**

```bash
git add admin.html
git commit -m "feat(admin): conversation panel markup replaces three queue panels"
```

---

## Task 7: `renderConversation` in `js/admin.js`

**Files:**
- Modify: `js/admin.js` — delete `renderAsks` (618-657), `renderHelpClaims` (706-721), `renderPasses` (741-752); add `renderConversation`

- [ ] **Step 1: Add the filter state**

In `js/admin.js`, immediately after the `const silentRealtime=new Map();` line (`js/admin.js:25`), add:

```js
  const CHAT_KEY="sq-admin-chat-filters";
  const CHAT_TYPES=[
    ["ask","💬 Ask 求助"],
    ["claim","🏅 Claim 隊長"],
    ["pass","🎟 Pass 券"],
    ["photo","📷 Photo 照片"],
    ["system","⚙ System 系統"]
  ];
  /* System and photo rows are noise on a screen Papa watches all day, so they
     start off. Ask/claim/pass are the ones that can need an answer. */
  let chatFilters=(function(){
    const fallback={kid:"all",types:["ask","claim","pass"],needs:false};
    try{
      const saved=JSON.parse(localStorage.getItem(CHAT_KEY)||"null");
      if(!saved||typeof saved!=="object")return fallback;
      return {
        kid:saved.kid||"all",
        types:Array.isArray(saved.types)?saved.types:fallback.types,
        needs:!!saved.needs
      };
    }catch(e){return fallback;}
  })();
  function saveChatFilters(){
    localStorage.setItem(CHAT_KEY,JSON.stringify(chatFilters));
  }
  let chatStuckToBottom=true, chatUnseen=0;
```

- [ ] **Step 2: Delete the three old render functions**

Delete these three functions entirely from `js/admin.js`:
- `function renderAsks(){ … }` (currently lines 618-657)
- `function renderHelpClaims(){ … }` (currently lines 706-721)
- `function renderPasses(){ … }` (currently lines 741-752)

**Keep** `startAnswerRecord`, `stopAnswerRecord`, `answerAsk`, `archiveAsk`, `setHelpClaim` and `setPass` — the conversation rail calls all six unchanged.

- [ ] **Step 3: Add `renderConversation`**

Insert where `renderAsks` used to be:

```js
  function chatStream(){
    return SQChat.buildStream(
      {asks:rows.asks,helpClaims:rows.helpClaims,passes:rows.passes,
       photos:rows.photos,ticks:rows.ticks,ledger:rows.ledger,redos:rows.redos},
      {today:today,archivedIds:archivedAskIds()}
    );
  }

  function chatFilterChips(){
    const kidBtns=[["all","All 全部"]].concat(Object.entries(KIDS).map(function(e){
      return [e[0],e[1].name];
    })).map(function(pair){
      const on=chatFilters.kid===pair[0];
      return `<button class="chip ${on?"is-on":""}" data-chatkid="${pair[0]}"
        style="--kid-color:${KIDS[pair[0]]?KIDS[pair[0]].color:"var(--blue)"}"
        aria-pressed="${on}">${esc(pair[1])}</button>`;
    }).join("");
    $("chatKidFilter").innerHTML=kidBtns;

    const needsOn=chatFilters.needs;
    const typeBtns=[`<button class="chip chip--needs ${needsOn?"is-on":""}"
      data-chatneeds="1" aria-pressed="${needsOn}">⚡ Needs you 待處理</button>`]
      .concat(CHAT_TYPES.map(function(pair){
        const on=chatFilters.types.indexOf(pair[0])>=0;
        return `<button class="chip ${on?"is-on":""} ${needsOn?"is-muted":""}"
          data-chattype="${pair[0]}" aria-pressed="${on}">${esc(pair[1])}</button>`;
      })).join("");
    $("chatTypeFilter").innerHTML=typeBtns;

    document.querySelectorAll("[data-chatkid]").forEach(function(b){
      b.onclick=function(){chatFilters.kid=b.dataset.chatkid;saveChatFilters();renderConversation();};
    });
    document.querySelectorAll("[data-chattype]").forEach(function(b){
      b.onclick=function(){
        const t=b.dataset.chattype, i=chatFilters.types.indexOf(t);
        if(i<0)chatFilters.types=chatFilters.types.concat([t]);
        else chatFilters.types=chatFilters.types.filter(function(x){return x!==t;});
        chatFilters.needs=false;
        saveChatFilters();renderConversation();
      };
    });
    $("chatTypeFilter").querySelector("[data-chatneeds]").onclick=function(){
      chatFilters.needs=!chatFilters.needs;saveChatFilters();renderConversation();
    };
  }

  function chatRowHtml(row){
    const k=KIDS[row.kidId]||{name:row.kidId,color:"var(--blue)"};
    const when=timeOnly(row.at);
    if(row.type==="system"){
      const label=row.meta.event==="tick"?`✓ ${blockTitle(row.meta.blockIdx)} ${blockTz(row.meta.blockIdx)}`
        :row.meta.event==="star"?`${row.meta.delta>0?"+":""}${row.meta.delta} ⭐ ${row.body}`
        :`↩ ${blockTitle(row.meta.blockIdx)} ${blockTz(row.meta.blockIdx)} — redo 再做一次`;
      return `<div class="chat-sys">${when} · ${esc(k.name)} ${esc(label)}</div>`;
    }
    if(row.type==="reply"){
      return `<article class="bubble bubble--papa">
        <div class="bubble__meta">Papa 爸爸 · ${when}</div>
        ${row.body?`<p>${esc(row.body)}</p>`:""}
        ${row.audio?`<audio class="audio" controls src="${publicUrl(row.audio)}"></audio>`:""}
      </article>`;
    }
    if(row.type==="photo"){
      return `<article class="bubble bubble--kid" style="--kid-color:${k.color}">
        <div class="bubble__meta">${esc(k.name)} · ${when} · 📷 ${esc(blockTitle(row.meta.blockIdx))}</div>
        <img class="thumb" src="${proofUrl(row.meta.path)}" alt="Photo proof 照片證明">
      </article>`;
    }
    if(row.type==="claim"){
      const done=row.meta.status!=="requested";
      return `<article class="bubble bubble--kid bubble--action" style="--kid-color:${k.color}">
        <div class="bubble__meta">${esc(k.name)} · captain 隊長 · ${when}</div>
        <p>Helped ${esc(kidName(row.meta.helped))} 幫忙${esc(kidName(row.meta.helped))} — ${esc(row.body)}</p>
        ${done
          ?`<p class="${row.meta.status==="approved"?"ok":"muted"}">${row.meta.status==="approved"?"Approved 已核准":"Denied 未核准"}</p>`
          :`<div class="row"><button class="btn" data-helpok="${row.srcId}">✓ Approve +1 核准</button>
             <button class="btn btn--danger" data-helpno="${row.srcId}">✕ Deny 拒絕</button></div>`}
      </article>`;
    }
    if(row.type==="pass"){
      const done=row.meta.status!=="requested";
      const kindLabel=row.meta.kind==="golden"?"Golden 黃金":"Excused 請假";
      return `<article class="bubble bubble--kid bubble--action" style="--kid-color:${k.color}">
        <div class="bubble__meta">${esc(k.name)} · 🎟 ${kindLabel} · ${when}</div>
        <p>${esc(blockTitle(row.meta.blockIdx))} ${esc(blockTz(row.meta.blockIdx))} — ${esc(row.body||"no reason 沒有原因")}</p>
        ${done
          ?`<p class="${row.meta.status==="granted"?"ok":"muted"}">${esc(row.meta.status)}</p>`
          :`<div class="row"><button class="btn" data-passok="${row.srcId}">✓ Approve 核准</button>
             <button class="btn btn--danger" data-passno="${row.srcId}">✕ Deny 拒絕</button></div>`}
      </article>`;
    }
    /* type === "ask" */
    return `<article class="bubble bubble--kid ${row.archived?"is-archived":""}" style="--kid-color:${k.color}">
      <div class="bubble__meta">${esc(k.name)} · ${esc(row.meta.kind)} · ${when}</div>
      <p>${esc(row.body||"Voice memo 語音訊息")}</p>
      ${row.audio?`<audio class="audio" controls src="${publicUrl(row.audio)}"></audio>`:""}
      ${row.needs?`<label class="field"><span>Answer 回覆</span>
        <textarea class="input textarea" id="answer-${row.srcId}" placeholder="I can help after lunch. 午餐後我可以幫你。"></textarea></label>
        <div class="row">
          <button class="btn" data-answer="${row.srcId}">Send 送出</button>
          <button class="btn btn--secondary" data-rec="${row.srcId}">🎤 Record 錄音</button>
          <button class="btn btn--secondary" data-stop="${row.srcId}" disabled>Stop 停止</button>
          <span class="message message--ok" id="recstatus-${row.srcId}"></span>
        </div>`:""}
      <div class="row inbox-actions">
        ${row.archived
          ?`<button class="btn btn--secondary" data-unarchiveask="${row.srcId}">Restore 還原</button>`
          :`<button class="btn btn--secondary" data-archiveask="${row.srcId}">Archive 封存</button>`}
      </div>
    </article>`;
  }

  function renderConversation(){
    const box=$("chatStream");
    const stream=chatStream();
    chatFilterChips();

    const badge=$("chatNeedsBadge");
    const needs=SQChat.needsCount(stream);
    badge.textContent=String(needs);
    badge.classList.toggle("gold",needs>0);

    const filters={
      kid:chatFilters.kid,
      types:chatFilters.types,
      needs:chatFilters.needs,
      archived:$("showArchivedAsks").checked
    };
    const visible=SQChat.filterStream(stream,filters);

    const note=$("noteBody").value.trim();
    $("chatPin").innerHTML=note
      ?`<b>📌 Today 今天</b> ${esc(note)}`
      :`<span class="muted">📌 No message for today yet 今天還沒有留言</span>`;

    box.innerHTML=visible.length
      ?visible.map(chatRowHtml).join("")
      :`<p class="chat-empty">Nothing here 沒有訊息
         <button class="btn btn--secondary" id="chatClearFilters">Clear filters 清除篩選</button></p>`;

    const clear=$("chatClearFilters");
    if(clear)clear.onclick=function(){
      chatFilters={kid:"all",types:["ask","claim","pass"],needs:false};
      saveChatFilters();renderConversation();
    };

    document.querySelectorAll("[data-answer]").forEach(function(b){b.onclick=function(){answerAsk(b.dataset.answer);};});
    document.querySelectorAll("[data-rec]").forEach(function(b){b.onclick=function(){startAnswerRecord(b.dataset.rec);};});
    document.querySelectorAll("[data-stop]").forEach(function(b){b.onclick=function(){stopAnswerRecord(b.dataset.stop);};});
    document.querySelectorAll("[data-archiveask]").forEach(function(b){b.onclick=function(){archiveAsk(b.dataset.archiveask,true);};});
    document.querySelectorAll("[data-unarchiveask]").forEach(function(b){b.onclick=function(){archiveAsk(b.dataset.unarchiveask,false);};});
    document.querySelectorAll("[data-helpok]").forEach(function(b){b.onclick=function(){setHelpClaim(b.dataset.helpok,"approved");};});
    document.querySelectorAll("[data-helpno]").forEach(function(b){b.onclick=function(){setHelpClaim(b.dataset.helpno,"denied");};});
    document.querySelectorAll("[data-passok]").forEach(function(b){b.onclick=function(){setPass(b.dataset.passok,"granted");};});
    document.querySelectorAll("[data-passno]").forEach(function(b){b.onclick=function(){setPass(b.dataset.passno,"denied");};});

    /* Never yank the viewport out from under Papa mid-read: only auto-scroll if
       he was already parked at the bottom. Otherwise offer a jump button. */
    if(chatStuckToBottom){
      box.scrollTop=box.scrollHeight;
      chatUnseen=0;
      show("chatJump",false);
    }else{
      chatUnseen=visible.length;
      show("chatJump",true);
    }
  }
```

- [ ] **Step 4: Swap it into `renderAll`**

Find:

```js
    renderAsks();
    renderHelpClaims();
    renderPasses();
```

Replace those three lines with:

```js
    renderConversation();
```

- [ ] **Step 5: Rewire the event handlers at the bottom of the file**

Find:

```js
  $("showArchivedAsks").onchange=renderAsks;
```

Replace with:

```js
  $("showArchivedAsks").onchange=renderConversation;
  $("chatStream").onscroll=function(){
    const box=$("chatStream");
    chatStuckToBottom=box.scrollHeight-box.scrollTop-box.clientHeight<40;
    if(chatStuckToBottom)show("chatJump",false);
  };
  $("chatJump").onclick=function(){
    const box=$("chatStream");
    box.scrollTop=box.scrollHeight;
    chatStuckToBottom=true;
    show("chatJump",false);
  };
  $("chatSend").onclick=sendChatMessage;
```

- [ ] **Step 6: Add `sendChatMessage`**

Insert immediately above `function subscribeRealtime(){`:

```js
  /* Papa-initiated message. kind='papa' with the text in `answer` so buildStream
     renders it as a right-side bubble; `body` stays null so it is never mistaken
     for a kid's question. Needs the "admin ask" INSERT policy (schema.sql v6). */
  async function sendChatMessage(){
    const body=$("chatBody").value.trim();
    if(!body){$("chatBody").focus();return;}
    const to=$("chatTo").value;
    const targets=to==="all"?Object.keys(KIDS):[to];
    const now=new Date().toISOString();
    const payload=targets.map(function(kid){
      return {kid_id:kid,kind:"papa",body:null,answer:body,answered_at:now};
    });
    const {error}=await client.from("asks").insert(payload);
    if(error){writeFailed(error);return;}
    $("chatBody").value="";
    chatStuckToBottom=true;
    toast("Message sent 訊息已送出",true);
    await loadAll();
  }
```

- [ ] **Step 7: Verify the syntax guard**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed`

If it fails with `android 8 syntax`, find the `?.` or `??` you introduced and rewrite it as `a && a.b` or `x || fallback`.

- [ ] **Step 8: Verify in the browser**

Serve the repo and sign in. Walk this list, checking each:

| Check | Expected |
|---|---|
| Right rail shows a stream | Kid bubbles left with kid colour, Papa bubbles right |
| Tap `⚡ Needs you` | Only unanswered asks + requested claims + requested passes remain; count equals the header badge |
| Tap a kid chip | Only that kid's rows; badge unchanged (badge counts the unfiltered stream) |
| Toggle `⚙ System` on | Tick and star chips appear as centred grey lines |
| Reload the page | Both filters are exactly as you left them |
| Answer an ask (text) | Bubble flips to answered, a Papa bubble appears |
| Answer an ask (🎤 Record → Stop → Send) | Papa bubble with an audio player |
| Approve a claim | Claim shows `Approved 已核准`, captain's star total rises by 1 |
| Deny a pass | Pass row shows `denied` |
| Archive an ask | It disappears; ticking `Show archived` brings it back greyed |
| Type into the send box, `To: Lucien`, `↑` | A Papa bubble appears in Lucien's thread |
| Scroll up, then trigger a new row from a tablet | The view does **not** jump; `New messages ↓` appears |

- [ ] **Step 9: Commit**

```bash
git add js/admin.js
git commit -m "feat(admin): one filterable conversation rail replaces three queues"
```

---

## Task 8: Conversation CSS

**Files:**
- Modify: `css/admin.css` (append before the `@media` blocks)

- [ ] **Step 1: Add the styles**

```css
/* Conversation rail — chat layout. Kid rows read left, Papa rows read right,
   system events are centred and quiet. */
.chat-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.chat-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  min-height: 40px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: #151127;
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.chip.is-on {
  color: var(--ink);
  border-color: var(--kid-color, var(--gold));
  box-shadow: inset 0 0 0 1px var(--kid-color, var(--gold));
}

.chip--needs.is-on {
  background: var(--gold);
  color: #201A40;
}

.chip.is-muted {
  opacity: .4;
}

.chat-pin {
  padding: 10px;
  border-radius: 8px;
  background: #151127;
  border-left: 3px solid var(--gold);
  font-size: 13px;
}

.chat-stream {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  min-height: 220px;
  max-height: 52vh;
  padding: 4px 2px;
}

.bubble {
  max-width: 88%;
  padding: 9px 11px;
  border-radius: 12px;
  background: #151127;
  border: 1px solid var(--line);
}

.bubble--kid {
  align-self: flex-start;
  border-left: 3px solid var(--kid-color, var(--blue));
  border-top-left-radius: 4px;
}

.bubble--papa {
  align-self: flex-end;
  border-right: 3px solid var(--gold);
  border-top-right-radius: 4px;
}

.bubble--action {
  max-width: 100%;
  width: 100%;
}

.bubble.is-archived {
  opacity: .55;
}

.bubble__meta {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 4px;
}

.bubble p {
  margin: 0 0 6px;
  color: var(--ink);
  font-weight: 400;
  overflow-wrap: anywhere;
}

.chat-sys {
  align-self: center;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}

.chat-empty {
  text-align: center;
  padding: 24px 8px;
}

.chat-jump {
  align-self: center;
}

.chat-send {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 6px;
  align-items: end;
}

.chat-input {
  min-height: 44px;
  resize: vertical;
}

.btn--icon {
  min-width: 44px;
  padding: 0 10px;
}
```

- [ ] **Step 2: Verify visually**

Reload. Expected: kid bubbles hug the left with a coloured left edge, Papa bubbles hug the right with a gold right edge, system lines centred and small. Chips wrap onto two or three rows and are finger-sized.

- [ ] **Step 3: Verify the narrow layout**

Narrow the window below 1080px. Expected: the conversation panel becomes full-width, bubbles still left/right, no horizontal scrollbar.

- [ ] **Step 4: Run the full check**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed`

- [ ] **Step 5: Commit**

```bash
git add css/admin.css
git commit -m "style(admin): chat bubbles, filter chips and send box"
```
