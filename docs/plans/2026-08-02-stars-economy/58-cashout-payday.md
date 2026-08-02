# Slice 58 — Cash-out and Sunday payday

**Goal:** A kid can turn coins into a promise of real money at a rate that cannot be devalued afterwards, and Papa settles all three in one action on Sunday.

**Implements:** design.md D3 (the NT$ freeze), D4, D7.

**Design:** `docs/plans/2026-08-02-stars-economy/design.md` §2 D3, D7.

**Depends on:** slice 54 (**hard** — `cashout` source + `admin settle` policy), 55 (**hard** — `SQShop.cashoutReason`), 57 (**hard** — `store.spend`).

**DONE WHEN:**
- A kid can request a cash-out from the Shop segment; coins leave the wallet **immediately**.
- The ledger row's reason is exactly `Cash out 換錢 · NT$<n>`, and `<n>` is computed at request time.
- Changing `coinNtd` in the admin afterwards does **not** change the NT$ owed on an already-requested cash-out.
- Admin → Stars shows a **Payday** sheet listing each kid's unpaid total; it is empty when nothing is pending.
- **Paid ✓** stamps `granted_by` on every one of that kid's unpaid rows and the sheet clears.
- A settled cash-out never reappears, including after a reload.
- ⭐ stays untouched by every step above.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **The NT$ is frozen at request time**, in the reason string, via `SQShop.cashoutReason` only. Never recompute a pending payout from the current `coinNtd` — that is precisely the devaluation this slice exists to prevent.
2. **`SQShop.ntdFromReason` is the only reader.** No `/NT\$/` regex, no `split("NT$")`, nowhere else. Not in `admin.js`, not in `index.html`.
3. **Unpaid means `granted_by is null`.** Do not add a `paid` column, a `status` column, or a `cashouts` table. The deduction row must exist regardless, and a parallel table would be a second write to keep in sync with it (design D7).
4. **Coins leave at request time, not at payday.** This is what makes double-spending impossible without locking. If your flow deducts on Sunday, it is wrong.
5. **Admin chrome is English-only** (D23). The kid-facing request flow is bilingual.
6. **Do not let a kid cash out more than they hold.** `store.spend` already guards this — route through it, do not write a second insert path.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `index.html` | Modify | cash-out control in the Shop segment |
| `admin.html` | Modify | Payday sheet markup |
| `js/admin.js` | Modify | `renderPayday()` + settle handler |
| `scripts/shop-core.test.mjs` | Modify | freeze test |
| `sw.js` | Modify | `CACHE_NAME` bump |

No `js/sync.js` change: `store.spend(kid, coins, reason, "cashout")` already does everything needed.

---

## Task 1: Prove the freeze before building on it

- [ ] **Step 1: Write the failing test.** Append to `scripts/shop-core.test.mjs`:

```js
test("a requested cash-out cannot be devalued by a later rate change", () => {
  const before = SQShop.parse('{"coinNtd":10}');
  const reason = SQShop.cashoutReason(SQShop.ntd(7, before));   // 7 coins @ NT$10 = NT$70
  assert.equal(SQShop.ntdFromReason(reason), 70);

  // Papa halves the rate afterwards.
  const after = SQShop.parse('{"coinNtd":5}');
  assert.equal(SQShop.ntd(7, after), 35, "new requests are re-priced…");
  assert.equal(SQShop.ntdFromReason(reason), 70, "…but the frozen one still owes NT$70");
});
```

- [ ] **Step 2: Run it.**

Run: `node --test scripts/shop-core.test.mjs`
Expected: **PASS immediately** — slice 55 already built both functions. This test does not drive new code; it pins the guarantee the rest of the slice depends on, so that a later "tidy-up" of `cashoutReason` fails loudly instead of silently re-pricing what Papa already owes.

- [ ] **Step 3: Commit.**

```bash
git add scripts/shop-core.test.mjs
git commit -m "test(shop): pin the cash-out rate freeze"
```

---

## Task 2: The kid's request

**File:** `index.html`.

- [ ] **Step 1:** Extend `shopHtml(id)` (added in slice 57). Insert this before the closing tip line, after `</div>` of `.shopgrid`:

```js
    ${have>0?`<div class="cashout">
      <b>💵 Cash out 換錢</b>
      <span>NT$${SQShop.ntd(1,cfg)} per coin 每個金幣</span>
      <div class="cashrow">
        <input class="qinput" id="cashAmt" inputmode="numeric" value="${have}" max="${have}">
        <button class="btn small" id="cashGo">Ask Papa 跟爸爸換</button>
      </div>
      <small>Papa pays on Sunday 星期天爸爸給你</small>
    </div>`:""}
```

- [ ] **Step 2:** Wire it in the `rwSeg==="shop"` branch of `renderRewards`, beside the existing `[data-buy]` wiring:

```js
    const go=body.querySelector("#cashGo");
    if(go)go.onclick=()=>cashOut();
```

- [ ] **Step 3:** Add the handler next to `buyItem`:

```js
async function cashOut(){
  const cfg=shopCfg(), have=coinsOf(hubKid);
  const want=Math.min(have,Math.max(0,parseInt(document.getElementById("cashAmt").value,10)||0));
  if(!want){sBad();return;}
  const amount=SQShop.ntd(want,cfg);
  if(!confirm(`Change ${want} 🪙 into NT$${amount}?\n把 ${want} 金幣換成 NT$${amount}？\n\nPapa pays on Sunday 星期天爸爸給你`))return;
  /* The NT$ is frozen into the reason here, at request time. If Papa lowers the
     rate next week, this payout still owes NT$<amount> (design D3). */
  const res=await store.spend(hubKid,want,SQShop.cashoutReason(amount),"cashout");
  if(res.error){sBad();return;}
  sGood(); bigFloat("💵");
  SQNotify.push(hubKid,hubKid,{kind:"shop",icon:"💵",tone:"ok",
    en:"NT$"+amount+" on Sunday",zh:"星期天拿 NT$"+amount,sub:want+" 🪙"});
  renderRewards(); renderHubHead();
}
```

- [ ] **Step 4:** Styles, next to the `.shopcard` rules:

```css
.cashout{margin-top:12px;padding:12px;border-radius:14px;background:rgba(255,255,255,.10);display:flex;flex-direction:column;gap:4px}
.cashout small{opacity:.75}
.cashrow{display:flex;gap:8px;align-items:center;margin-top:6px}
.cashrow .qinput{flex:1}
```

- [ ] **Step 5:** `sw.js` — bump `CACHE_NAME` to `summer-quest-v73`. Run `node scripts/check.mjs`. Commit.

```bash
git add index.html sw.js
git commit -m "feat(shop): kids can request a cash-out at a frozen rate"
```

---

## Task 3: Papa's payday sheet

- [ ] **Step 1:** `admin.html` — add inside `<section class="view" id="view-stars">`, immediately after the Economy sheet from slice 55:

```html
        <section class="sheet">
          <div class="sheet__head">
            <h2>Payday</h2>
            <span class="lbl">unpaid cash-outs · amounts frozen when asked</span>
          </div>
          <div class="tbl-wrap" id="paydayPanel"></div>
        </section>
```

- [ ] **Step 2:** `js/admin.js` — register it beside the other Stars-route renderers, wherever `renderEconomyPanel()` was registered in slice 55:

```js
    if($("paydayPanel"))renderPayday();
```

- [ ] **Step 3:** `js/admin.js` — add the renderer after `saveEconomy`:

```js
  /* Unpaid = granted_by is null. That column already means "the admin who
     settled this row", so this is its existing semantic, not an overload
     (design D7). rows.ledger is the last 150 rows; a cash-out older than that
     without payment would be a two-month-old debt, which is not a real case. */
  function pendingCashouts(){
    var out={};
    (rows.ledger||[]).forEach(function(r){
      if(r.source!=="cashout"||r.granted_by)return;
      var ntd=SQShop.ntdFromReason(r.reason);
      if(ntd===null)return;
      if(!out[r.kid_id])out[r.kid_id]={coins:0,ntd:0,ids:[]};
      out[r.kid_id].coins+=Math.abs(r.delta||0);
      out[r.kid_id].ntd+=ntd;
      out[r.kid_id].ids.push(r.id);
    });
    return out;
  }

  function renderPayday(){
    var el=$("paydayPanel");
    if(!el)return;
    var pending=pendingCashouts();
    var ids=Object.keys(pending);
    if(!ids.length){
      el.innerHTML='<p class="field__hint" style="padding:12px">Nothing to pay. Kids can ask for a cash-out any day; you settle on Sunday.</p>';
      return;
    }
    el.innerHTML='<table class="tbl"><tbody>'+ids.map(function(id){
      var p=pending[id];
      return '<tr><td data-l="Kid"><b>'+esc(kidName(id))+'</b>'+
        '<div class="tbl__note">'+p.coins+' coins · '+p.ids.length+' request'+(p.ids.length===1?"":"s")+'</div></td>'+
        '<td data-l="Owed" class="r" style="width:180px"><b>NT$'+p.ntd+'</b>'+
        '<div class="acts" style="margin-top:6px"><button class="btn btn--sm btn--primary" data-payday="'+esc(id)+'">Paid ✓</button></div></td></tr>';
    }).join("")+'</tbody></table>';
    el.querySelectorAll("[data-payday]").forEach(function(b){
      b.onclick=function(){settlePayday(b.dataset.payday);};
    });
  }

  async function settlePayday(kid){
    var p=pendingCashouts()[kid];
    if(!p||!p.ids.length)return;
    if(!confirm("Mark NT$"+p.ntd+" as handed to "+kidName(kid)+"?\n\nThis only records the payment. The coins already left their wallet when they asked."))return;
    const {error}=await client.from("stars_ledger")
      .update({granted_by:session.user.id}).in("id",p.ids);
    if(error){writeFailed(error);return;}
    toast("NT$"+p.ntd+" paid to "+kidName(kid),true);
    await loadAll();
  }
```

- [ ] **Step 4:** Confirm `rows.ledger` rows carry `id`, `source`, `granted_by` and `reason`. `js/admin.js:285` selects `"*"` from `stars_ledger`, so they do. Verify once in the console rather than assuming:

```js
console.log(rows.ledger.filter(r => r.source === "cashout")[0]);
```

- [ ] **Step 5:** `js/admin.js` — the realtime route map (line 331 area) already routes `stars_ledger` changes to `["today","stars"]`. Payday lives on the Stars route, so it re-renders with no change. **Verify, do not edit.**

- [ ] **Step 6: Commit.**

```bash
git add admin.html js/admin.js
git commit -m "feat(admin): Sunday payday — settle cash-outs in one tap"
```

---

## Task 4: Verify end to end

- [ ] **Step 1:** Luis has coins. Shop → Cash out shows `NT$10 per coin`, prefilled with his full balance.

- [ ] **Step 2:** Request 7 coins. Confirm reads `Change 7 🪙 into NT$70`. After: coins −7, **⭐ unchanged**, rank unchanged.

- [ ] **Step 3:** Admin → Stars → Payday: one row, `Luis · 7 coins · 1 request · NT$70`.

- [ ] **Step 4: the freeze.** In the Economy panel, drop the coin value 10 → 5 and save (accept the warning). Payday **still reads NT$70**. *If it reads NT$35, something is recomputing from the live rate — find it and route it through `ntdFromReason`.* Set the rate back to 10.

- [ ] **Step 5:** Have Luis request another 3 coins. Payday now shows `Luis · 10 coins · 2 requests · NT$100`.

- [ ] **Step 6:** Tap **Paid ✓**. The confirm names NT$100. Accept: the sheet empties and reads the "Nothing to pay" hint.

- [ ] **Step 7:** Reload the admin. Payday is still empty — the settled rows do not come back.

- [ ] **Step 8:** Admin → Ledger: both rows are visible with their `cashout` source and their frozen NT$ in the reason. Luis's totals show `coins` down by 10 and `stars` unchanged from where it started.

- [ ] **Step 9:** Kid's Rewards → ⭐ Stars segment shows the cash-out rows in their history with a readable reason.

---

## Notes for the implementer

`pendingCashouts` reads `rows.ledger`, which is the most recent 150 rows. That is a deliberate ceiling, not an oversight: for it to miss a payout, a request would have to survive 150 subsequent ledger rows — roughly two months at this family's rate — without Papa ever paying it. If that somehow happens, widen the query; do not add a table to work around it.

The confirm text in `settlePayday` says the coins already left the wallet. Keep that sentence. It is the one place Papa is reminded that Paid ✓ records reality rather than causing it, which is what stops him from "undoing" a payment by granting stars back.
