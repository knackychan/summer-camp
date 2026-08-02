# Slice 57 — The shop: kids spend coins

**Goal:** A kid can buy a privilege, instantly, online or offline, and cannot buy what they cannot afford.

**Implements:** design.md D2 (client half), D5, D6, D11 (shop segment).

**Design:** `docs/plans/2026-08-02-stars-economy/design.md` §2 D5, D6, D11.

**Depends on:** slice 54 (**hard** — the `kid buy` policy), 55 (**hard** — `SQShop`), 56 (**hard** — `coinsFor`).

**DONE WHEN:**
- `node --test scripts/sync.test.mjs` — green, including the new spend block.
- Rewards → 🪙 Shop lists four privileges with live prices from `SQShop`, each showing its NT$ equivalent.
- Buying deducts immediately, with no Papa approval, and shows a confirmation.
- A kid with 9 coins cannot buy a 10-coin item: the button is disabled and states what is still needed, bilingually.
- Buying with wifi off deducts immediately, survives a reload, and lands in the ledger on reconnect **exactly once**.
- Golden Pass is bought from the existing per-block 🎟️ overlay in My Day, appears as an approved pass on that block, and the existing **Use 使用** button spends it.
- Papa sees every purchase in the admin ledger with a readable reason.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **Spending queues `type:"spend"`, never `type:"stars"`.** This is what keeps `starsFor` meaning ⭐ (design D1). A negative `type:"stars"` op would silently reduce the kid's achievement, their rank, and the family goal.
2. **`store.spend` must deduct synchronously before its first `await`,** exactly like `addStars`. `enqueue()` is synchronous; call `spend` without `await` from the UI so the balance is already correct on the next line for the re-render.
3. **The balance guard is client-side only** and that is deliberate (design §3). Add a `ponytail:` comment at the guard naming the ceiling. **Do not** add a database check, an RPC, or a locking scheme.
4. **Never write `.stars` in `index.html`** — `scripts/check.mjs:539` fails the build. Use `starsOf()` / `coinsOf()`.
5. **All five item names, prices and the NT$ conversion come from `SQShop`.** No hardcoded `15`, no hardcoded `"Golden Pass"`, no hardcoded `"NT$"` in `index.html`. If you type a price literal, you have created the drift this plan exists to prevent.
6. **Every kid-facing string ships EN + 中文** (CLAUDE.md invariant), including the insufficient-funds message, the confirm dialog and the success toast.
7. **No approval gate.** A privilege purchase is granted the moment it is bought (design D6, and the standing auto-grant policy). If your flow contains a `status:'requested'` for a bought item, it is wrong.
8. **Cash-out is slice 58.** Do not build it here.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/sync.js` | Modify | `spend()`, `applyOp` spend branch, flush refresh |
| `supabase/schema.sql` + new migration | Modify/Create | `kid buy pass` policy |
| `index.html` | Modify | shop segment, purchase flow, Golden Pass in the pass overlay |
| `scripts/sync.test.mjs` | Modify | spend tests |
| `sw.js` | Modify | `CACHE_NAME` bump |

---

## Task 1: `spend()` in the store

- [ ] **Step 1: Write the failing test.** Append to `scripts/sync.test.mjs`, in the file's bare-block style (**not** `node:test` — see slice 56 Task 1), using the `makeStore` helper slice 56 added. A bare block cannot `await` at top level in this file's shape, so wrap the async part in an IIFE exactly as below:

```js
// --- Test 9: spending pays from the wallet, never from the achievement (slice 57) ---
await (async () => {
  const store = makeStore();
  store.applyStarTotals([{ kid_id: "lili", stars: 40, coins: 40 }]);

  const ok = await store.spend("lili", 15, "Shop 商店 · Golden Pass 黃金券", "shop");
  assert.equal(ok.error, null);
  assert.equal(store.coinsFor("lili"), 25, "the wallet paid");
  assert.equal(store.starsFor("lili"), 40, "the achievement did NOT move — this is the whole point of two numbers");

  const op = store.queue.filter((o) => o.type === "spend")[0];
  assert.equal(op.delta, -15, "spend queues a negative delta");
  assert.equal(op.source, "shop");
  assert.ok(op.id, "an id makes the insert idempotent on replay");
  assert.equal(store.queue.filter((o) => o.type === "stars").length, 0,
    "spending must never queue a star op — it would reduce the kid's rank");

  const broke = await store.spend("lili", 999, "too much", "shop");
  assert.ok(broke.error, "overdrawing is refused");
  assert.equal(store.coinsFor("lili"), 25, "a refused purchase changes nothing");

  const zero = await store.spend("lili", 0, "nothing", "shop");
  assert.ok(zero.error, "a zero purchase is refused — RLS requires delta < 0");
})();
```

If top-level `await` is rejected, the file is not being treated as an ES module — check that the extension is `.mjs` before changing the test.

- [ ] **Step 2: Run it, confirm it fails.**

Run: `node --test scripts/sync.test.mjs`
Expected: FAIL — `store.spend is not a function`.

- [ ] **Step 3:** Add `spend` to `js/sync.js`, directly after `addStars` (line 494 area):

```js
    /* Buying is the mirror of earning: one negative ledger row, queued the same
       way, so it works offline and replays exactly once (the op id makes the
       insert idempotent — applyOp swallows 23505).
       ponytail: the balance check is client-side only. An offline queue replayed
       from two tablets could in principle overdraw. Three kids, one tablet each,
       and Papa sees every row in the ledger — add a database check only if a
       wallet actually goes negative. */
    async spend(kid,coins,reason,source){
      const cost=Math.abs(coins||0);
      if(!cost) return {error:new Error("Nothing to buy 沒有東西可買")};
      if(this.coinsFor(kid)<cost) return {error:new Error("Not enough coins 金幣不夠")};
      this.enqueue({type:"spend",kid:kid,delta:-cost,reason:reason,source:source||"shop"});
      await this.flush();
      return {error:null};
    }
```

- [ ] **Step 4:** Add the `applyOp` branch immediately after the `stars` branch (line 426-431):

```js
      }else if(op.type==="spend"){
        const {error}=await this.supabase.from("stars_ledger").insert({
          id:op.id,kid_id:op.kid,delta:op.delta,reason:op.reason,source:op.source||"shop"
        });
        if(error&&error.code!=="23505") throw error;
```

- [ ] **Step 5:** In `_flush` (line 393), the totals refresh must fire for spends too, or the wallet dips by the amount just successfully saved. Change:

```js
          if(op.type==="stars") sentStars=true;
```
to:
```js
          if(op.type==="stars"||op.type==="spend") sentStars=true;
```

- [ ] **Step 6: Run the tests, confirm green.**

Run: `node --test scripts/sync.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add js/sync.js scripts/sync.test.mjs
git commit -m "feat(shop): store.spend — queued, offline-safe, idempotent"
```

---

## Task 2: Let a kid own a bought Golden Pass

A kid can currently only insert a pass with `status='requested'` (`supabase/schema.sql:278`). A *bought* pass is granted on the spot, so it needs its own policy.

- [ ] **Step 1:** `supabase/schema.sql` — add to the `passes` policy block (drop half, around line 262):

```sql
  execute 'drop policy if exists "kid buy pass" on public.passes';
```

and to the create half (around line 279):

```sql
  -- A bought Golden Pass is granted on the spot: it was paid for, so there is
  -- nothing for Papa to approve (design D6). Same trust level as "kid tick" —
  -- a kid with devtools could already mark a block done they did not do.
  execute 'create policy "kid buy pass" on public.passes for insert with check (kind = ''golden'' and status = ''granted'')';
```

- [ ] **Step 2:** Create `supabase/migrations/20260802_stars_economy_passes.sql`:

```sql
-- Bought Golden Passes are granted immediately (plan 2026-08-02 slice 57, D6).
do $$
begin
  execute 'drop policy if exists "kid buy pass" on public.passes';
  execute 'create policy "kid buy pass" on public.passes for insert with check (kind = ''golden'' and status = ''granted'')';
end $$;
```

- [ ] **Step 3:** Apply it to the live project.

- [ ] **Step 4:** Add the store method to `js/sync.js`, next to `requestPass`:

```js
    /* Bought, not requested: status 'granted' so the existing "Use 使用" button
       in My Day picks it up with no change to passFor(). day + block_idx are
       required — passFor matches on both (index.html:2057), so a floating pass
       would be invisible on every block. */
    async buyGoldenPass(kid,day,blockIdx,reason){
      if(!this.supabase) return {error:new Error("Sync is offline 離線中")};
      return this.supabase.from("passes").insert({
        kid_id:kid,kind:"golden",status:"granted",day:day,block_idx:blockIdx,reason:reason
      });
    }
```

- [ ] **Step 5: Commit.**

```bash
git add supabase/schema.sql supabase/migrations/20260802_stars_economy_passes.sql js/sync.js
git commit -m "feat(shop): kids may own a Golden Pass they paid for"
```

---

## Task 3: The Shop segment

**File:** `index.html`.

- [ ] **Step 1:** Add the segment to `RW_SEGS` (line 3109), first so it is the tab a kid lands on when they have coins to spend:

```js
const RW_SEGS=[["shop","🪙 Shop 商店"],["badges","🏆 Badges 徽章"],["stars","⭐ Stars 星星"],["news","🔔 News 通知"],["msgs","💬 Papa 爸爸"]];
```

Leave `let rwSeg="badges";` (line 3110) as it is — the default landing segment does not change.

- [ ] **Step 2:** Add the config reader next to `starsOf`/`coinsOf` (line 1258 area):

```js
const shopCfg=()=>SQShop.parse(store&&store.familySettings&&store.familySettings.shop);
```

- [ ] **Step 3:** Add the shop renderer next to `badgesHtml` (line 3157):

```js
/* Golden Pass is absent from this list on purpose: it is bought per block from
   the 🎟️ button in My Day, because passFor() matches on day AND block_idx and a
   pass with neither would have no "Use" button anywhere (design D5, slice 57). */
function shopHtml(id){
  const cfg=shopCfg(), have=coinsOf(id);
  const cards=cfg.items.filter(it=>it.id!=="golden").map(it=>{
    const afford=have>=it.price;
    const short=it.price-have;
    return `<div class="shopcard ${afford?"on":"off"}">
      <span class="e">${escHtml(it.icon)}</span>
      <div class="tx"><b>${escHtml(it.en)}</b><span>${escHtml(it.zh)}</span>
        <small>${it.price} 🪙 · NT$${SQShop.ntd(it.price,cfg)}</small></div>
      ${afford
        ? `<button class="btn small" data-buy="${escHtml(it.id)}">Buy 買</button>`
        : `<span class="shortfall">${short} 🪙 more 還差</span>`}
    </div>`;
  }).join("");
  return `<div class="walletline">🪙 <b>${have}</b> coins 金幣 · NT$${SQShop.ntd(have,cfg)}</div>
    <div class="shopgrid">${cards}</div>
    <div class="tipline">🎟️ Golden Pass: tap 🎟️ on a block in My Day 在「我的一天」的格子上按 🎟️</div>`;
}
```

- [ ] **Step 4:** In `renderRewards` (line 3195), add the branch beside the `badges` one, and wire the buttons:

```js
  if(rwSeg==="shop"){
    body.innerHTML=shopHtml(hubKid);
    body.querySelectorAll("[data-buy]").forEach(b=>b.onclick=()=>buyItem(b.dataset.buy));
    return;
  }
```

- [ ] **Step 5:** Add the purchase handler next to `renderRewards`:

```js
async function buyItem(itemId){
  const cfg=shopCfg(), it=SQShop.itemById(cfg,itemId);
  if(!it||!store)return;
  if(coinsOf(hubKid)<it.price){sBad();return;}
  if(!confirm(`Buy ${it.en} for ${it.price} 🪙?\n買「${it.zh}」要 ${it.price} 金幣？`))return;
  /* Awaited only for the guard's error, not for the network: spend() enqueues
     synchronously before its first await, so the balance is already correct by
     the time this resolves — the flush behind it is what may still be pending. */
  const res=await store.spend(hubKid,it.price,`Shop 商店 · ${it.en} ${it.zh}`,"shop");
  if(res.error){sBad();return;}
  sGood(); bigFloat(it.icon);
  SQNotify.push(hubKid,hubKid,{kind:"shop",icon:it.icon,tone:"ok",
    en:"Bought "+it.en+" for "+it.price+" 🪙",zh:"買了「"+it.zh+"」花了 "+it.price+" 金幣",sub:""});
  renderRewards(); renderHubHead();
}
```

- [ ] **Step 6:** Add the styles next to the existing `.achv` / `.achvgrid` rules in the `<style>` block:

```css
.shopgrid{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.shopcard{display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;background:rgba(255,255,255,.10)}
.shopcard.off{opacity:.55}
.shopcard .e{font-size:30px;flex:none}
.shopcard .tx{flex:1;display:flex;flex-direction:column;line-height:1.25}
.shopcard .tx small{opacity:.75;margin-top:2px}
.shortfall{font-size:13px;opacity:.8;flex:none}
.walletline{font-size:17px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.12)}
```

- [ ] **Step 7:** `sw.js` — bump `CACHE_NAME` to `summer-quest-v71`.

- [ ] **Step 8:** `node scripts/check.mjs` — green. Then commit.

```bash
git add index.html sw.js
git commit -m "feat(shop): kids can buy privileges with coins"
```

---

## Task 4: Golden Pass in the per-block overlay

**File:** `index.html`, `requestPass(i)` (the overlay built around line 2228).

- [ ] **Step 1:** In the overlay markup, replace the Golden button so it carries its price:

```js
      <button class="btn small" data-kind="golden">Golden 黃金 · ${shopCfg().items.filter(x=>x.id==="golden")[0].price} 🪙</button>
```

Read the price through `SQShop`; do not inline a number.

- [ ] **Step 2:** In the overlay's send handler, branch before the existing `requestPass` call. Excused keeps its request-and-approve flow untouched; golden is bought:

```js
    if(kind==="golden"){
      const cfg=shopCfg(), gp=SQShop.itemById(cfg,"golden");
      if(coinsOf(hubKid)<gp.price){
        o.querySelector("#passMsg").textContent=`Not enough coins 金幣不夠 — ${gp.price} 🪙 needed 需要`;
        sBad();return;
      }
      const paid=await store.spend(hubKid,gp.price,`Shop 商店 · ${gp.en} ${gp.zh} · block ${i}`,"shop");
      if(paid.error){sBad();o.querySelector("#passMsg").textContent=paid.error.message;return;}
      const made=await store.buyGoldenPass(hubKid,todayStr(),i,reason||"Bought with coins 用金幣購買");
      if(made.error){sBad();o.querySelector("#passMsg").textContent=made.error.message;return;}
      o.remove(); sGood(); bigFloat("🎟️");
      await store.hydrate(); renderMyDay(); renderHubHead();
      return;
    }
```

- [ ] **Step 3:** Make the reason optional for golden only. The existing guard is:

```js
    if(!reason){o.querySelector("#passReason").focus();return;}
```

Change it to `if(!reason&&kind!=="golden"){…}` — a kid who has *paid* for a skip does not owe an explanation. Excused still requires one, because Papa is being asked for something.

- [ ] **Step 4:** `sw.js` — bump `CACHE_NAME` to `summer-quest-v72`. Run `node scripts/check.mjs`. Commit.

```bash
git add index.html sw.js
git commit -m "feat(shop): buy a Golden Pass per block from My Day"
```

---

## Task 5: Verify on a real tablet

- [ ] **Step 1:** Luis's Rewards → 🪙 Shop. Four cards, prices 10/15/20/40, each with the right NT$ under it. Golden Pass is **not** in the list; the tip line points to My Day.

- [ ] **Step 2:** Buy "+30 min screen time" (10 🪙). Confirm dialog is bilingual. After: `🪙 39`, **`⭐ 49` unchanged**, rank still 🥉. *If ⭐ moved, Task 1 Step 3 queued the wrong op type — stop and fix.*

- [ ] **Step 3:** Admin → Stars → Ledger. One new row: `-10`, source `shop`, reason `Shop 商店 · +30 min screen time 多 30 分鐘螢幕時間`. Admin totals show Luis `stars 49, coins 39`.

- [ ] **Step 4:** Spend down to 9 coins. The 10-coin card is dimmed, has no Buy button, and reads `1 🪙 more 還差`.

- [ ] **Step 5: offline purchase.** Wifi off. Buy something affordable. Balance drops immediately. Reload with wifi still off — the new balance persists. Wifi on, wait for flush: the balance **stays put** (no dip, no double-deduct) and exactly **one** row appears in the ledger.

- [ ] **Step 6: Golden Pass.** In My Day, tap 🎟️ on a mission block. The overlay shows `Golden 黃金 · 15 🪙`. Buy it: coins drop 15, the block shows `🎟️ Golden pass 黃金券 approved 已核准`, and a **Use 使用** button appears. Tap Use: the block completes and the pass turns spent.

- [ ] **Step 7:** Try to buy a Golden Pass with fewer than 15 coins: refused in the overlay with a bilingual message, and **no** pass row is created. Check the admin ledger — no orphan `-15`.

- [ ] **Step 8:** Repeat Step 2 on a second tablet for the same kid. Both tablets converge on the same balance within 15s.

---

## Notes for the implementer

Step 7 is the one that catches the real bug in this slice: pay-then-create is two writes, and if the pass insert fails the kid has paid for nothing. The guard above the payment is what prevents it in the common case. A failed insert *after* a successful payment leaves a `-15` row Papa can refund from the admin — acceptable for a family of five, and far cheaper than a transaction. If it ever happens twice, that is the moment to reach for an RPC, not before.

If you catch yourself adding a `purchases` table so the shop has "proper" records: the ledger row **is** the record, it has a reason, and Papa reads it in the same list as everything else.
