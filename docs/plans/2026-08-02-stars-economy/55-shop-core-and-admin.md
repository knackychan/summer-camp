# Slice 55 — `SQShop`: one module for every number, plus Papa's editor

**Goal:** Every price, rank threshold, streak rule and NT$ conversion lives in exactly one file, tested in plain Node. Papa can change all of them from the admin without a deploy.

**Implements:** design.md D3, D4, D5 (prices only), D8 (rules only), D9 (thresholds only), D12.

**Design:** `docs/plans/2026-08-02-stars-economy/design.md` §2 D3, D9, D12.

**Depends on:** slice 54 (**soft** — the `shop` settings row is seeded by 54's migration; without it the editor writes a row that does not exist yet and the upsert creates it, so this slice is testable alone but should not ship first).

**DONE WHEN:**
- `node --test scripts/shop-core.test.mjs` — all green.
- `js/shop-core.js` is loaded by `index.html` **and** `admin.html`, and is present in `sw.js` `APP_SHELL`.
- Admin → Stars shows an **Economy** sheet: coin value, goal target, goal prize (EN + 中文), and a price box per item.
- Changing the coin value to 5 shows a warning naming the current total coins at risk, **before** the save lands.
- Saving writes one `family_settings` row with key `shop`; reloading the admin shows the saved values.
- Saving an item with an empty 中文 field is **refused** with a visible message.
- `node scripts/check.mjs` passes, including a new gate that fails if any `SQShop.DEFAULTS.items` entry is missing `en` or `zh`.

---

## Constraints you must not violate

1. **`js/shop-core.js` must be a plain global IIFE**, exporting via `window.SQShop` *and* `module.exports`, exactly like `js/notify.js` and `js/time-core.js`. No `import`, no `export`. The Node test loads it with `createRequire`.
2. **No `?.`, no `??`, no `.flatMap` anywhere in it.** `scripts/check.mjs:61-63` scans every runtime file for these and fails the build. This is a stale guard, not a device requirement — but it is live, and this slice does not get to be the one that relaxes it.
3. **`parse()` must never throw and never return a partial object.** A corrupt `shop` row is the difference between a kid's shop rendering with defaults and a kid's tablet showing a blank tab. Every field falls back independently.
4. **Never read or write `family_settings.shop` outside `SQShop.parse`.** Hand-rolled `JSON.parse` of that key anywhere else is the drift this module exists to prevent.
5. **`cashoutReason` / `ntdFromReason` are the only NT$ string formatter and parser** (design D3). No `"NT$"` string literal in any other file.
6. **Admin chrome stays English-only** (decision D23, 2026-07-27). The `en`/`zh` *item* fields are kid-facing and both required; the labels around them are not.
7. **Do not build the kid-facing shop in this slice.** No edits to the `index.html` inline script beyond the one `<script src>` line.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/shop-core.js` | Create | prices, ranks, streak rules, NT$ contract — the single source |
| `scripts/shop-core.test.mjs` | Create | unit tests for all of the above |
| `admin.html` | Modify | `<script src>` + Economy sheet markup in `view-stars` |
| `js/admin.js` | Modify | `renderEconomyPanel()` + save handler |
| `index.html` | Modify | `<script src>` only (one line) |
| `sw.js` | Modify | `APP_SHELL` entry + `CACHE_NAME` bump |
| `scripts/check.mjs` | Modify | bilingual gate on the default catalogue |

---

## Task 1: The module, test-first

- [ ] **Step 1: Write the failing test.** Create `scripts/shop-core.test.mjs`:

```js
/* js/shop-core.js — the numbers the kid app and the admin must agree on.
   Pure functions, no DOM, no storage: everything here is testable in plain Node. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const SQShop = createRequire(import.meta.url)("../js/shop-core.js");

test("parse falls back field by field, never throws", () => {
  assert.equal(SQShop.parse(null).coinNtd, 10);
  assert.equal(SQShop.parse("").coinNtd, 10);
  assert.equal(SQShop.parse("{not json").coinNtd, 10, "a corrupt blob must not take the shop down");
  assert.equal(SQShop.parse('{"coinNtd":25}').coinNtd, 25);
  assert.equal(SQShop.parse('{"coinNtd":25}').goalTarget, 600, "one bad/absent field must not lose the others");
  assert.equal(SQShop.parse('{"coinNtd":"abc"}').coinNtd, 10, "non-numeric falls back");
  assert.equal(SQShop.parse('{"coinNtd":0}').coinNtd, 1, "a zero rate would make every coin worthless");
  assert.equal(SQShop.parse('{"items":[]}').items.length, 5, "an empty catalogue falls back to the defaults");
});

test("parse repairs items against the defaults", () => {
  const cfg = SQShop.parse('{"items":[{"id":"golden","price":22}]}');
  assert.equal(cfg.items.length, 1);
  assert.equal(cfg.items[0].price, 22);
  assert.equal(cfg.items[0].zh, "黃金券", "a known id keeps its bilingual text when only the price is edited");
});

test("every default item ships EN and 中文", () => {
  SQShop.DEFAULTS.items.forEach((it) => {
    assert.ok(it.en && it.en.length, `${it.id} missing en`);
    assert.ok(it.zh && it.zh.length, `${it.id} missing zh — kid-facing strings are bilingual`);
  });
});

test("rank is a pure function of stars", () => {
  assert.equal(SQShop.rank(0).id, "sprout");
  assert.equal(SQShop.rank(49).id, "sprout");
  assert.equal(SQShop.rank(50).id, "bronze", "threshold is inclusive");
  assert.equal(SQShop.rank(299).id, "silver");
  assert.equal(SQShop.rank(500).id, "legend");
  assert.equal(SQShop.rank(99999).id, "legend");
  assert.equal(SQShop.nextRank(49).need, 1);
  assert.equal(SQShop.nextRank(500), null, "nothing beyond legend");
});

test("streak bonus pays at 3 and every 7", () => {
  assert.equal(SQShop.streakBonus(1), 0);
  assert.equal(SQShop.streakBonus(3), 2);
  assert.equal(SQShop.streakBonus(4), 0);
  assert.equal(SQShop.streakBonus(7), 5);
  assert.equal(SQShop.streakBonus(14), 5);
  assert.equal(SQShop.streakBonus(21), 5);
  assert.equal(SQShop.streakBonus(8), 0);
});

test("an unfinished today does not break the streak", () => {
  const covered = { "2026-08-01": 16, "2026-07-31": 16, "2026-07-30": 16 };
  assert.equal(SQShop.streakFrom(covered, 16, "2026-08-02"), 3,
    "at 9am today is naturally incomplete — the streak counts back from yesterday");
  covered["2026-08-02"] = 16;
  assert.equal(SQShop.streakFrom(covered, 16, "2026-08-02"), 4, "finishing today extends it");
});

test("a missed whole day ends the streak", () => {
  const covered = { "2026-07-31": 16, "2026-07-30": 16 }; // 08-01 missed entirely
  assert.equal(SQShop.streakFrom(covered, 16, "2026-08-02"), 0);
  assert.equal(SQShop.streakFrom({ "2026-08-01": 9 }, 16, "2026-08-02"), 0, "a partial day is not a day");
  assert.equal(SQShop.streakFrom({}, 16, "2026-08-02"), 0);
});

test("NT$ round trip is a contract", () => {
  const cfg = SQShop.parse('{"coinNtd":10}');
  assert.equal(SQShop.ntd(7, cfg), 70);
  assert.equal(SQShop.ntd(0, cfg), 0);
  const reason = SQShop.cashoutReason(70);
  assert.match(reason, /換錢/, "the reason is kid-facing and bilingual");
  assert.equal(SQShop.ntdFromReason(reason), 70, "what the payday screen reads back must equal what was frozen in");
  assert.equal(SQShop.ntdFromReason("no amount here"), null);
});

test("streak reason matches the database unique index", () => {
  const r = SQShop.streakReason(3, "2026-08-02");
  assert.ok(r.startsWith("Streak"), "uniq_streak_bonus is `where reason like 'Streak%'` — this prefix is load-bearing");
  assert.ok(r.includes("2026-08-02"), "the date makes a later streak of the same length a different row");
});
```

- [ ] **Step 2: Run it, confirm it fails.**

Run: `node --test scripts/shop-core.test.mjs`
Expected: FAIL — `Cannot find module '../js/shop-core.js'`.

- [ ] **Step 3: Write the module.** Create `js/shop-core.js`:

```js
/* Shop, ranks and streaks — every number the kid app and the admin panel must
   agree on. One module, because a price that means two things in two files is
   how this design drifts (plan 2026-08-02-stars-economy D3). Plain global, no
   module system, loaded by both index.html and admin.html. */
(function(){
  "use strict";

  /* Papa edits all of this from the admin. These are the fallbacks used before
     he ever saves, and the shape parse() repairs a bad blob back to. */
  var DEFAULTS={
    coinNtd:10,
    goalTarget:600,
    goalRewardEn:"A day out we choose together",
    goalRewardZh:"我們一起選的一日遊",
    items:[
      {id:"golden", price:15, icon:"🎟️", en:"Golden Pass",         zh:"黃金券"},
      {id:"screen", price:10, icon:"📺", en:"+30 min screen time", zh:"多 30 分鐘螢幕時間"},
      {id:"stayup", price:15, icon:"🌙", en:"Stay up 30 min",      zh:"晚睡 30 分鐘"},
      {id:"dinner", price:20, icon:"🍽️", en:"Pick dinner",         zh:"決定晚餐"},
      {id:"outing", price:40, icon:"🚗", en:"Choose the outing",   zh:"選週末去哪"}
    ]
  };

  var RANKS=[
    {id:"sprout", at:0,   icon:"🌱", en:"Sprout", zh:"小苗"},
    {id:"bronze", at:50,  icon:"🥉", en:"Bronze", zh:"銅星"},
    {id:"silver", at:150, icon:"🥈", en:"Silver", zh:"銀星"},
    {id:"gold",   at:300, icon:"🥇", en:"Gold",   zh:"金星"},
    {id:"legend", at:500, icon:"💎", en:"Legend", zh:"傳奇"}
  ];

  function clone(v){return JSON.parse(JSON.stringify(v));}
  function int(v,fallback){
    var n=parseInt(v,10);
    return isFinite(n)?n:fallback;
  }

  /* A corrupt row must never blank a kid's shop, so every field falls back on
     its own rather than the whole object being rejected. */
  function parse(raw){
    var obj={};
    if(raw&&typeof raw==="object")obj=raw;
    else if(typeof raw==="string"&&raw.trim()){
      try{obj=JSON.parse(raw)||{};}catch(e){obj={};}
    }
    var cfg=clone(DEFAULTS);
    cfg.coinNtd=Math.max(1,int(obj.coinNtd,DEFAULTS.coinNtd));
    cfg.goalTarget=Math.max(1,int(obj.goalTarget,DEFAULTS.goalTarget));
    if(typeof obj.goalRewardEn==="string")cfg.goalRewardEn=obj.goalRewardEn;
    if(typeof obj.goalRewardZh==="string")cfg.goalRewardZh=obj.goalRewardZh;
    if(Array.isArray(obj.items)&&obj.items.length){
      var items=[];
      obj.items.forEach(function(it){
        if(!it||!it.id)return;
        var base=DEFAULTS.items.filter(function(d){return d.id===it.id;})[0]||{};
        items.push({
          id:String(it.id),
          price:Math.max(1,int(it.price,base.price||10)),
          icon:it.icon||base.icon||"🎁",
          en:it.en||base.en||String(it.id),
          zh:it.zh||base.zh||""
        });
      });
      if(items.length)cfg.items=items;
    }
    return cfg;
  }

  function itemById(cfg,id){
    return cfg.items.filter(function(i){return i.id===id;})[0]||null;
  }

  function rank(stars){
    var out=RANKS[0];
    RANKS.forEach(function(r){if((stars||0)>=r.at)out=r;});
    return out;
  }
  function nextRank(stars){
    var rest=RANKS.filter(function(r){return r.at>(stars||0);});
    if(!rest.length)return null;
    return {rank:rest[0],need:rest[0].at-(stars||0)};
  }

  /* +2 at 3 days, +5 at 7 and every 7 after. Everything else pays nothing. */
  function streakBonus(n){
    if(n===3)return 2;
    if(n>=7&&n%7===0)return 5;
    return 0;
  }

  function shiftDay(iso,delta){
    var d=new Date(iso+"T00:00:00Z");
    d.setUTCDate(d.getUTCDate()+delta);
    return d.toISOString().slice(0,10);
  }

  /* covered: {"2026-08-01":16, …} — blocks covered that day (ticks ∪ passes).
     An unfinished TODAY does not break the streak; at 9am nobody has finished
     yet. The streak ends only once a whole day has gone by uncompleted. Coach,
     not cop — the same reason late blocks go amber and not red. */
  function streakFrom(covered,dayLength,todayISO){
    var need=dayLength||1;
    var done=function(iso){return ((covered&&covered[iso])||0)>=need;};
    var cursor=done(todayISO)?todayISO:shiftDay(todayISO,-1);
    var n=0;
    while(done(cursor)&&n<400){n++;cursor=shiftDay(cursor,-1);}
    return n;
  }

  function ntd(coins,cfg){
    return Math.max(0,Math.round((coins||0)*((cfg&&cfg.coinNtd)||DEFAULTS.coinNtd)));
  }

  /* The NT$ figure is frozen into the reason at request time so a later cut to
     coinNtd cannot devalue a payout Papa has already been asked for. This string
     is a contract between the kid app and the payday screen: write it only with
     cashoutReason, read it only with ntdFromReason (design D3). */
  function cashoutReason(amount){return "Cash out 換錢 · NT$"+Math.max(0,Math.round(amount||0));}
  function ntdFromReason(reason){
    var m=/NT\$(\d+)/.exec(reason||"");
    return m?parseInt(m[1],10):null;
  }
  /* 'Streak' prefix is load-bearing: uniq_streak_bonus is a partial index on
     `reason like 'Streak%'`, and that index is what stops a double award. */
  function streakReason(n,dayISO){return "Streak 🔥 "+n+" days 連續 "+n+" 天 · "+dayISO;}

  var api={DEFAULTS:DEFAULTS,RANKS:RANKS,parse:parse,itemById:itemById,rank:rank,
    nextRank:nextRank,streakBonus:streakBonus,streakFrom:streakFrom,ntd:ntd,
    cashoutReason:cashoutReason,ntdFromReason:ntdFromReason,streakReason:streakReason};
  if(typeof window!=="undefined")window.SQShop=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
```

- [ ] **Step 4: Run the tests, confirm green.**

Run: `node --test scripts/shop-core.test.mjs`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit.**

```bash
git add js/shop-core.js scripts/shop-core.test.mjs
git commit -m "feat(shop): SQShop — prices, ranks, streak rules, NT$ contract"
```

---

## Task 2: Wire the module in

- [ ] **Step 1:** `index.html` — add after the `js/lock-core.js` line (currently line 917):

```html
<script src="js/shop-core.js"></script>
```

- [ ] **Step 2:** `admin.html` — add the same line next to the other `js/` script tags (after `js/day-data.js`, around line 345). Order does not matter; it must load before `js/admin.js`.

- [ ] **Step 3:** `sw.js` — add `"./js/shop-core.js",` to `APP_SHELL`, next to `"./js/lock-core.js",`. **This is not optional:** `scripts/check.mjs:86` fails the build for any file loaded by a page but missing from `APP_SHELL`.

- [ ] **Step 4:** `sw.js` — bump `CACHE_NAME` from `summer-quest-v68` to `summer-quest-v69`.

- [ ] **Step 5:** Run `node scripts/check.mjs`.
Expected: PASS. If it reports `android 8 syntax`, you used `?.` or `??` in the module — remove it, do not relax the scan.

---

## Task 3: The check.mjs gate

**File:** `scripts/check.mjs`. Add next to the existing "stars are a ledger" block (around line 557).

- [ ] **Step 1:** Add:

```js
// The shop catalogue is kid-facing, so it is bilingual like everything else
// (CLAUDE.md invariant). Papa's edits live in the database and cannot be gated
// from here — the admin editor refuses a blank 中文 field (slice 55 Task 4).
// What IS in the repo is the default catalogue every kid sees before he saves,
// and the rank names, so those are gated here.
{
  const SQShop = createRequire(import.meta.url)("../js/shop-core.js");
  SQShop.DEFAULTS.items.forEach((item) => {
    if (!item.en) fail("shop bilingual", `default item ${item.id} has no English name`);
    if (!item.zh) fail("shop bilingual", `default item ${item.id} has no 中文 name`);
  });
  SQShop.RANKS.forEach((r) => {
    if (!r.en || !r.zh) fail("shop bilingual", `rank ${r.id} must ship EN + 中文`);
  });
  if (SQShop.ntdFromReason(SQShop.cashoutReason(70)) !== 70) {
    fail("shop contract", "cashoutReason/ntdFromReason no longer round-trip — the payday screen would misread every amount");
  }
  const shopSrc = readFileSync(new URL("js/shop-core.js", root), "utf8");
  if (!/reason like 'Streak%'|'Streak'/.test(shopSrc) && !/"Streak /.test(shopSrc)) {
    fail("shop contract", "streakReason no longer starts with 'Streak' — uniq_streak_bonus would stop deduplicating");
  }
}
```

- [ ] **Step 2:** `createRequire` must be imported at the top of `check.mjs` if it is not already. Check the existing imports first; add `import { createRequire } from "node:module";` only if absent.

- [ ] **Step 3: Prove the gate fails.** Temporarily blank the `zh` of the `golden` item in `js/shop-core.js`, run `node scripts/check.mjs`, confirm **red** with `default item golden has no 中文 name`, then revert. A gate you have not seen fail is a gate you have not tested.

- [ ] **Step 4: Commit.**

```bash
git add index.html admin.html sw.js scripts/check.mjs
git commit -m "feat(shop): load SQShop in both apps, gate the catalogue bilingually"
```

---

## Task 4: Papa's Economy editor

**Files:** `admin.html`, `js/admin.js`.

- [ ] **Step 1:** `admin.html` — inside `<section class="view" id="view-stars">` (line 200), insert this sheet **immediately after** `<div id="starTotals"></div>` and before the "Grant stars" sheet:

```html
        <section class="sheet">
          <div class="sheet__head">
            <h2>Economy</h2>
            <span class="lbl">what a star is worth · live to the tablets</span>
          </div>
          <div class="sheet__pad" id="economyPanel"></div>
        </section>
```

- [ ] **Step 2:** `js/admin.js` — register the renderer next to the other settings panels (line 1933-1934 area):

```js
    if($("economyPanel"))renderEconomyPanel();
```

- [ ] **Step 3:** `js/admin.js` — add the reader, next to `adminPinValue()` (around line 1940):

```js
  function shopCfg(){
    var row=rows.familySettings.find(function(x){return x.key==="shop";});
    return SQShop.parse(row&&row.value);
  }
```

- [ ] **Step 4:** `js/admin.js` — add the panel. Place it after `renderBehaviourPanel` (around line 2012):

```js
  var economyFeedback={};

  function renderEconomyPanel(){
    var el=$("economyPanel");
    if(!el)return;
    var cfg=shopCfg();
    var totalCoins=Object.keys(KIDS).reduce(function(sum,id){
      var t=(rows.totals||[]).find(function(r){return r.kid_id===id;});
      return sum+((t&&t.coins)||0);
    },0);
    var fb=economyFeedback;
    el.innerHTML='<div class="grid-2">'+
      '<label class="field"><span class="lbl">One coin is worth</span>'+
        '<input class="inp num" id="ecoCoinNtd" inputmode="numeric" value="'+esc(String(cfg.coinNtd))+'">'+
        '<span class="field__hint">NT$ per coin. Kids currently hold '+totalCoins+' coins = NT$'+SQShop.ntd(totalCoins,cfg)+' across all three.</span></label>'+
      '<label class="field"><span class="lbl">Family goal</span>'+
        '<input class="inp num" id="ecoGoal" inputmode="numeric" value="'+esc(String(cfg.goalTarget))+'">'+
        '<span class="field__hint">Combined ⭐ stars, not coins — spending never sets the family back.</span></label></div>'+
      '<div class="grid-2" style="margin-top:10px">'+
      '<label class="field"><span class="lbl">Goal prize (English)</span>'+
        '<input class="inp" id="ecoRewardEn" value="'+esc(cfg.goalRewardEn)+'"></label>'+
      '<label class="field"><span class="lbl">Goal prize (中文)</span>'+
        '<input class="inp" id="ecoRewardZh" value="'+esc(cfg.goalRewardZh)+'">'+
        '<span class="field__hint">Both required — the kids read this one.</span></label></div>'+
      '<div style="margin-top:14px"><span class="lbl" style="display:block;margin-bottom:6px">Prices</span>'+
      '<table class="tbl"><tbody>'+cfg.items.map(function(it){
        return '<tr><td data-l="Item"><b>'+esc(it.icon+" "+it.en)+'</b>'+
          '<div class="tbl__note">'+esc(it.zh)+'</div></td>'+
          '<td data-l="Coins" class="r" style="width:150px">'+
          '<input class="inp num" data-price="'+esc(it.id)+'" inputmode="numeric" value="'+esc(String(it.price))+'" style="width:80px">'+
          '<div class="tbl__note">NT$'+SQShop.ntd(it.price,cfg)+'</div></td></tr>';
      }).join("")+'</tbody></table></div>'+
      '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn--primary" id="ecoSave">Save</button></div>'+
      '<p class="message '+(fb.type==="ok"?"message--ok":fb.type==="error"?"message--error":"")+'" aria-live="polite">'+esc(fb.text||"")+'</p>';
    $("ecoSave").onclick=saveEconomy;
  }
```

- [ ] **Step 5:** `js/admin.js` — the save handler, immediately after `renderEconomyPanel`:

```js
  async function saveEconomy(){
    var cfg=shopCfg();
    var nextNtd=parseInt($("ecoCoinNtd").value,10);
    var rewardZh=$("ecoRewardZh").value.trim();
    var rewardEn=$("ecoRewardEn").value.trim();

    /* Kid-facing string with no 中文 is a bug, not a preference (CLAUDE.md). */
    if(rewardEn&&!rewardZh){
      economyFeedback={type:"error",text:"The goal prize needs 中文 too — the kids read it."};
      renderEconomyPanel();return;
    }
    /* Cutting the rate devalues every coin already saved. Requested cash-outs are
       safe (the NT$ is frozen in the row); unspent balances are not. */
    if(isFinite(nextNtd)&&nextNtd<cfg.coinNtd){
      var held=Object.keys(KIDS).reduce(function(sum,id){
        var t=(rows.totals||[]).find(function(r){return r.kid_id===id;});
        return sum+((t&&t.coins)||0);
      },0);
      var before=SQShop.ntd(held,cfg), after=SQShop.ntd(held,{coinNtd:nextNtd});
      if(!confirm("Lowering the rate re-prices coins the kids have already saved.\n\n"+
        held+" coins held: NT$"+before+" → NT$"+after+"\n\nCash-outs already requested keep their frozen amount. Continue?"))return;
    }

    var next={
      coinNtd:nextNtd,
      goalTarget:parseInt($("ecoGoal").value,10),
      goalRewardEn:rewardEn,
      goalRewardZh:rewardZh,
      items:cfg.items.map(function(it){
        var input=document.querySelector('[data-price="'+it.id+'"]');
        return Object.assign({},it,{price:input?parseInt(input.value,10):it.price});
      })
    };
    /* Round-trip through parse so a typo is repaired to a valid shape before it
       reaches a tablet, not after. */
    var value=JSON.stringify(SQShop.parse(next));
    suppressRealtime("family_settings",{key:"shop"});
    const {error}=await client.from("family_settings")
      .upsert({key:"shop",value:value,updated_at:new Date().toISOString()});
    if(error){writeFailed(error);return;}
    economyFeedback={type:"ok",text:"Saved — tablets update within seconds."};
    toast("Economy saved",true);
    await loadAll();
  }
```

- [ ] **Step 6: No change needed — verify only.** `js/admin.js:283` is `client.from("star_totals").select("*")`, landing in `rows.totals` (declared line 33). Slice 54's `coins` column therefore arrives with no edit. Confirm with one console line in the signed-in admin:

```js
// expect: {kid_id:"lili", name:…, stars:38, coins:38}
console.log(rows.totals[0]);
```

If `coins` is `undefined`, slice 54 was not applied to this project. Stop and apply it.

- [ ] **Step 7: Verify by hand.** Serve the admin, sign in, go to **Stars**:
  - Change coin value 10 → 12, Save. Reload the page: it still reads 12.
  - Change 12 → 5, Save: the confirm names the real held-coin total and both NT$ figures. Cancel: nothing is written.
  - Clear the 中文 prize, Save: refused with a visible message, nothing written.
  - Set Golden Pass to 22, Save, reload: still 22, and the NT$ note under it updated.
  - `select value from family_settings where key='shop';` returns one row of valid JSON.
  - Restore the values to the design defaults (10 / 600 / 15-10-15-20-40) before committing.

- [ ] **Step 8: Commit.**

```bash
git add admin.html js/admin.js
git commit -m "feat(admin): Economy panel — coin value, family goal, prices"
```

---

## Notes for the implementer

The `zh` fields on items are edited only through the defaults for now: the panel shows 中文 read-only under each item name and lets Papa change the *price*. That is deliberate — he asked to change what a star is worth, not to rename the catalogue. If he later wants to rename items, the fields are already in the JSON and the panel gains two inputs; no schema or module change.

`suppressRealtime` before the write matters. Without it the admin's own realtime hook fires and re-renders the panel mid-edit, wiping fields Papa has typed but not saved. Every other settings write in this file already does it — follow the pattern.
