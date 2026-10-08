/* SQHomeHelp — the 8 home-help activities and every kid-facing line of the
   games points gate (docs/plans/2026-10-08-games-gate-ai-guide/ design.md D3–D6).
   Data plus pure helpers; no DOM, no clock. Points come from SQPoints, never
   from here: `kind` is the award identity, `quest` the existing quest that
   pays it (null + route for homework, which My Day pays). */
(function(){
  function g(lucien,lili,luis){return {lucien:lucien,lili:lili,luis:luis};}
  const ITEMS=[
    {id:"homework",kind:"homework",quest:null,route:"day",icon:"✏️",minutes:30,verify:"parent",
      label:["Homework practice","作業練習"],windows:[["9:00","17:30"]],
      goal:g(["Do one small practice page with a grown-up.","和大人一起做一小頁練習。"],
             ["Finish today's homework page and check it once.","完成今天的作業，再檢查一次。"],
             ["Finish today's homework and fix any mistakes.","完成今天的作業，把錯的地方改好。"])},
    {id:"room",kind:"room_rescue",quest:"room_rescue",icon:"🧸",minutes:10,verify:"parent",
      label:["Clean my room","整理房間"],windows:[["8:00","20:30"]],
      goal:g(["Put five toys back in their home.","把五個玩具放回它們的家。"],
             ["Clear the floor and make your desk neat.","把地板清乾淨，書桌排整齊。"],
             ["Floor, desk and bed all tidy.","地板、書桌和床都整理好。"])},
    {id:"clothes",kind:"laundry_helper",quest:"laundry_helper",icon:"👕",minutes:10,verify:"parent",
      label:["Tidy my clothes","整理衣服"],windows:[["8:00","20:30"]],
      goal:g(["Put your socks in pairs.","把襪子一雙一雙配好。"],
             ["Fold your clean clothes and put them away.","把乾淨的衣服摺好收起來。"],
             ["Sort, fold and put away one pile of clothes.","把一堆衣服分類、摺好、收好。"])},
    /* the table fits only around a meal; its quest and award slot follow the meal */
    {id:"table",kind:"table_helper",quest:{breakfast:"table_helper_breakfast",lunch:"table_helper",dinner:"table_helper_dinner"},meal:true,icon:"🍽️",minutes:5,verify:"self",
      label:["Help clean the table","幫忙清理餐桌"],windows:[],
      goal:g(["Carry your plate and napkin.","收自己的盤子和餐巾。"],
             ["Clear the plates and wipe your spot.","收盤子，擦自己的位置。"],
             ["Clear the table and wipe it clean.","收拾餐桌，把桌子擦乾淨。"])},
    {id:"shoes",kind:"shoe_tidy",quest:"shoe_tidy",icon:"👟",minutes:5,verify:"self",
      label:["Tidy the shoes","整理鞋子"],windows:[["8:00","20:30"]],
      goal:g(["Put your shoes side by side.","把你的鞋子並排放好。"],
             ["Line up the family's shoes in pairs.","把家裡的鞋子一雙雙排好。"],
             ["Pair and line up all the shoes at the door.","把門口所有鞋子配對排整齊。"])},
    {id:"garden",kind:"garden_tidy",quest:"garden_tidy",icon:"🌿",minutes:15,verify:"parent",
      label:["Tidy the garden","整理花園"],windows:[["8:00","18:00"]],
      goal:g(["Pick up leaves with a grown-up.","和大人一起撿落葉。"],
             ["Pick up leaves and put the tools back.","撿落葉，把工具放回去。"],
             ["Sweep the path and tidy the garden tools.","掃步道，整理園藝工具。"])},
    {id:"living",kind:"living_tidy",quest:"living_tidy",icon:"🛋️",minutes:10,verify:"parent",
      label:["Tidy the living room","整理客廳"],windows:[["8:00","20:30"]],
      goal:g(["Put the cushions back on the sofa.","把抱枕放回沙發上。"],
             ["Put toys and books back where they live.","把玩具和書放回原位。"],
             ["Clear the table and put everything away.","清好桌面，把東西都收好。"])},
    {id:"office",kind:"office_tidy",quest:"office_tidy",icon:"🗂️",minutes:10,verify:"parent",
      label:["Tidy the office","整理辦公室"],windows:[["8:00","20:30"]],
      goal:g(["Put the pens back in the cup.","把筆放回筆筒。"],
             ["Stack the papers and put the pens away.","把紙疊好，把筆收好。"],
             ["Clear the desk and put things where Papa likes them.","清好桌面，把東西放回爸爸習慣的位置。"])}
  ];
  /* a meal block's table window: from 30 min before it starts to 75 min after */
  const MEAL_WINDOW={before:30,after:75};
  const SLOTS=[{id:"morning",from:"0:00"},{id:"afternoon",from:"12:00"},{id:"evening",from:"17:00"}];
  /* invite lines (D4): name the gap as a small positive step, never blame */
  const LINES=[
    ["{n} more points and Games open — you've got this!","再 {n} 點遊戲就開了，你可以的！"],
    ["A little helping and Games open! {n} points to go.","幫忙一下，遊戲就開了！還差 {n} 點。"],
    ["Every job counts — {n} more points!","每件事都算數，再 {n} 點！"],
    ["Pick one helping job, then play! {n} points to go.","選一件幫忙的事，然後就能玩！還差 {n} 點。"]
  ];
  const TEXT={
    title:["Helping time first!","先幫忙一下！"],
    today:["{t} / {m} points today","今天 {t} / {m} 點"],
    help:["Help me choose","幫我選"],
    myDay:["My Day","我的一天"],
    papa:["Papa","爸爸"],
    papaOpen:["Open games today","今天開放遊戲"],
    papaOpenSub:["Skip today's points goal","今天不用達到點數目標"],
    brainToo:["Brain Gym gives {n} points too","頭腦體操也有 {n} 點"],
    brainDone:["Brain Gym done! {n} more points for games.","頭腦體操完成！再 {n} 點就能玩遊戲。"],
    pickTitle:["Pick a way to help","選一個幫忙的方式"],
    pointsWord:["points","點"],
    papaChecks:["Papa will check","爸爸會確認"],
    soon:["Coming soon — ask Papa","即將推出，問問爸爸"],
    rest:["Rest time — helping starts again tomorrow","休息時間，明天再來幫忙"],
    open:["Games open","遊戲已開"],
    world:["Helping first: {t} / {m} points today","先幫忙：今天 {t} / {m} 點"],
    practice:["Brain Gym is open and gives points too!","頭腦體操開著，也能賺點數！"],
    back:["Back","返回"],
    giftCan:["🎁 You have {a} points to spend. “{r}” is {c} — ask Papa!","🎁 你有 {a} 點可以用，「{rz}」只要 {c} 點，問問爸爸！"],
    giftSaving:["🎁 You have {a} points to spend. “{r}” is {c} — {n} more to go!","🎁 你有 {a} 點可以用，「{rz}」要 {c} 點，再 {n} 點就到了！"],
    giftStart:["🎁 “{r}” is {c} points — every job gets you closer!","🎁 「{rz}」要 {c} 點，每件事都讓你更接近！"],
    giftGeneric:["🎁 Points can become a gift — ask Papa!","🎁 點數可以換禮物，問問爸爸！"]
  };
  function mins(t){
    const p=String(t||"").split(":").map(Number);
    return p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])?p[0]*60+p[1]:null;
  }
  function fill(pair,vars){
    return pair.map(function(s){return String(s).replace(/\{(\w+)\}/g,function(m,k){return vars&&vars[k]!=null?String(vars[k]):m;});});
  }
  function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function slotOf(minutes){
    let id=SLOTS[0].id;
    SLOTS.forEach(function(s){if(minutes>=mins(s.from))id=s.id;});
    return id;
  }
  /* meals: [{slot:"breakfast"|"lunch"|"dinner", start:minutes}] from today's DAY */
  function mealSlot(minutes,meals){
    const hit=(meals||[]).find(function(m){return Number.isFinite(m.start)&&minutes>=m.start-MEAL_WINDOW.before&&minutes<=m.start+MEAL_WINDOW.after;});
    return hit?hit.slot:null;
  }
  function inWindow(item,minutes){
    return item.windows.some(function(w){const a=mins(w[0]),b=mins(w[1]);return minutes>=a&&minutes<=b;});
  }
  /* D6 drop rules (ranking arrives with slice 04). ctx: {minutes, meals,
     known(kind, quest), claimed(kind,slot), atLimit(kind), amount(kind)}.
     Items the app cannot start yet (points kind or quest missing) stay listed
     as "soon", last. */
  function available(ctx){
    const out=[];
    ITEMS.forEach(function(item){
      let slot="default";
      if(item.meal){slot=mealSlot(ctx.minutes,ctx.meals);if(!slot)return;}
      else if(!inWindow(item,ctx.minutes))return;
      const quest=item.meal?item.quest[slot]:item.quest;
      if(!ctx.known(item.kind,quest)){out.push({item:item,slot:slot,ready:false,points:0,quest:quest});return;}
      if(ctx.claimed(item.kind,slot)||ctx.atLimit(item.kind))return;
      out.push({item:item,slot:slot,ready:true,points:ctx.amount(item.kind),quest:quest});
    });
    return out.filter(function(x){return x.ready;}).concat(out.filter(function(x){return !x.ready;}));
  }
  function line(kid,day,need){
    return fill(LINES[hash(kid+":"+day)%LINES.length],{n:need});
  }
  function giftLine(rem){
    if(!rem||rem.kind==="generic")return TEXT.giftGeneric.slice();
    const vars={a:rem.available,r:rem.reward.title[0],rz:rem.reward.title[1]||rem.reward.title[0],c:rem.cost,n:rem.need};
    /* nothing saved yet: name the reward, not the zero */
    return fill(rem.kind==="can"?TEXT.giftCan:rem.available>0?TEXT.giftSaving:TEXT.giftStart,vars);
  }
  const api={ITEMS:ITEMS,SLOTS:SLOTS,MEAL_WINDOW:MEAL_WINDOW,LINES:LINES,TEXT:TEXT,
    mins:mins,fill:fill,slotOf:slotOf,mealSlot:mealSlot,available:available,line:line,giftLine:giftLine};
  if(typeof window!=="undefined")window.SQHomeHelp=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
