/* SQSchool — school mode, the after-school plan and the home chores
   (docs/plans/2026-10-19-school-mode-chores/ design.md D1–D6).
   Data plus pure helpers; no DOM, no storage, no clock: callers pass today's
   Taipei day (SQ_DAY.iso()) and the family settings. Points come from SQPoints;
   `kind` / `slot` here are only the claim identity each chore pays under. */
(function(){
  const KIDS=["lucien","lili","luis"];
  function k(lucien,lili,luis){return {lucien:lucien,lili:lili,luis:luis};}
  /* D2: informative only — no ticks, no missions, no points on these rows */
  const SCHEDULE=[
    {t:"16:00",icon:"🏠",title:["Home from school","放學回家"],
     txt:k(["Snack, then your bowl and shoes away","吃點心，再收碗、放好鞋子"],
           ["Snack, empty your bag, bowl and shoes away","吃點心、整理書包、收碗和鞋子"],
           ["Snack, empty your bag, bowl and shoes away","吃點心、整理書包、收碗和鞋子"])},
    {t:"16:20",icon:"🧠",title:["Brain Gym","頭腦體操"],gate:"brain",
     txt:k(["3 little games, about 3 minutes","三個小遊戲，大約三分鐘"],
           ["Your 3 games of the day","今天的三個遊戲"],
           ["Your 3 games of the day","今天的三個遊戲"])},
    {t:"16:35",icon:"🏡",title:["Help at home","幫忙做家事"],gate:"chores",
     txt:k(["Pick a job or two with a grown-up","和大人一起選一兩件事"],
           ["Pick a few jobs from your list","從清單裡選幾件事"],
           ["Pick a few jobs from your list","從清單裡選幾件事"])},
    {t:"17:00",icon:"✏️",title:["Homework","回家作業"],
     txt:k(["Draw or read with a grown-up","和大人一起畫畫或看書"],
           ["Homework at the table, then show Papa","在桌上寫作業，寫完給爸爸看"],
           ["Homework, then check it once","寫作業，再檢查一次"])},
    {t:"17:45",icon:"📱",title:["Screen time","螢幕時間"],gate:"screen",
     txt:k(["Opens after Brain Gym + home jobs","做完頭腦體操和家事就開"],
           ["Opens after Brain Gym + home jobs","做完頭腦體操和家事就開"],
           ["Opens after Brain Gym + home jobs","做完頭腦體操和家事就開"])},
    {t:"18:30",icon:"🍽",title:["Dinner","晚餐"],
     txt:k(["Carry your plate","端自己的盤子"],
           ["Help set the table","幫忙擺餐桌"],
           ["Help set the table and cook","幫忙擺餐桌和煮飯"])},
    {t:"19:15",icon:"🛁",title:["Bath + school bag ready","洗澡＋準備書包"],
     txt:k(["Bath, pajamas, brush your teeth","洗澡、穿睡衣、刷牙"],
           ["Bath, then pack tomorrow's bag","洗澡，再整理明天的書包"],
           ["Bath, then pack tomorrow's bag","洗澡，再整理明天的書包"])},
    {t:"20:00",icon:"🌙",title:["Story and bed","故事時間，睡覺"],
     txt:k(["Bed 20:30","8點30分睡覺"],["Lights out 21:00","9點熄燈"],["Lights out 21:15","9點15分熄燈"])}
  ];
  /* D3: the home chores Papa listed (2026-10-19). Three reuse an
     existing points kind, so the same work never pays twice. */
  const CHORES=[
    {id:"rice",kind:"rice_wash",icon:"🍚",label:["Wash the rice","洗米"]},
    {id:"dish_in",kind:"dishwasher_load",icon:"🍽️",label:["Fill the dishwasher","把碗盤放進洗碗機"]},
    {id:"dish_out",kind:"dishwasher_unload",icon:"🥣",label:["Empty the dishwasher","把洗碗機的碗盤拿出來"]},
    {id:"table",kind:"table_helper",slot:"dinner",icon:"🧽",label:["Clean the table and set it for dinner","擦桌子，準備晚餐"]},
    {id:"clothes",kind:"laundry_helper",icon:"👕",label:["Tidy up your clothes","整理衣服"]},
    {id:"desk",kind:"desk_tidy",icon:"📚",label:["Tidy up your desk","整理書桌"]},
    {id:"bed",kind:"bed_prepare",icon:"🛏️",label:["Get your bed ready","整理床鋪"]},
    {id:"toys",kind:"floor_toys",icon:"🧸",label:["Pick up toys from the floor","把地上的玩具撿起來"]},
    {id:"garden",kind:"garden_toys",icon:"🚲",label:["Put away garden toys and bikes","收好花園玩具和腳踏車"]},
    {id:"garlic",kind:"garlic_peel",icon:"🧄",label:["Peel the garlic","剝大蒜"]},
    {id:"bowls",kind:"bowls_tidy",icon:"🥢",label:["Put away your after-school bowl","收好放學後的碗"]},
    {id:"shoes",kind:"shoe_tidy",icon:"👟",label:["Tidy up the shoes","整理鞋子"]},
    {id:"vacuum",kind:"vacuum_floor",icon:"🧹",label:["Vacuum the floor","用吸塵器吸地"]},
    /* added by Papa 2026-10-19: the small water cup on the family prayer altar */
    {id:"altar",kind:"altar_water",icon:"💧",label:["Change the water for the Gohonzon","幫御本尊換水"]}
  ];
  /* D7: bonus tasks — extra points to exchange later, never needed for Games */
  const BONUS=[
    {id:"gym",kind:"gym_exercise",icon:"🏋️",label:["Gym exercise","健身運動"]},
    {id:"music",kind:"music_bonus",icon:"🎹",label:["Music practice","音樂練習"]}
  ];
  const TEXT={
    modeSchool:["School day","上學日"],
    modeHoliday:["Holiday","放假"],
    hero:["Welcome home, {name}! Here's what your afternoon could look like.","{name}，歡迎回家！這是你下午可以做的事。"],
    heroSub:["Just an idea of the afternoon — times can move.","只是下午的參考，時間可以調整。"],
    choresTitle:["Help at home","幫忙做家事"],
    choresSub:["Tap a job when it's done. Papa will check it.","做完就點一下，爸爸會確認。"],
    choresToday:["{t} / {m} points today","今天 {t} / {m} 點"],
    choresNoGate:["{t} points today","今天 {t} 點"],
    did:["Done","做完了"],
    waiting:["Papa will check","等爸爸確認"],
    confirmed:["Points in!","點數到手！"],
    again:["Try again","再試一次"],
    sureTitle:["All done?","做完了嗎？"],
    sureBody:["{job} — Papa will check it.","{job}——爸爸會確認。"],
    yes:["Yes, done!","對，做完了！"],
    notYet:["Not yet","還沒"],
    screenOpen:["Open now — enjoy!","現在開了，好好玩！"],
    screenBrain:["Brain Gym first: {d} / {n} done","先做頭腦體操：完成 {d} / {n}"],
    screenPoints:["{n} more points from home jobs","再做家事賺 {n} 點"],
    brainDone:["Done today","今天完成了"],
    brainTodo:["{d} / {n} done — tap to play","完成 {d} / {n}，點一下開始"],
    chooseJobs:["See my jobs","看我的家事"],
    bonusTitle:["Bonus points","加分任務"],
    bonusSub:["Extra points to save for a gift. Papa will check.","額外點數，可以存起來換禮物。爸爸會確認。"]
  };
  const MODES={holiday:true,school:true};
  function parseMode(raw){
    let v=raw;
    if(typeof v==="string"){try{v=JSON.parse(v);}catch(e){v={mode:v};}}
    const mode=v&&typeof v==="object"&&MODES[v.mode]?v.mode:"holiday";
    return {mode:mode};
  }
  /* D1: school mode covers Monday–Friday; Saturday and Sunday keep the holiday day */
  function isWeekend(day){
    const d=new Date(String(day)+"T00:00:00Z");
    if(!Number.isFinite(+d))return false;
    const w=d.getUTCDay();
    return w===0||w===6;
  }
  function modeFor(day,settings){
    const m=parseMode(settings&&settings.day_mode_v1).mode;
    return m==="school"&&!isWeekend(day)?"school":"holiday";
  }
  function mins(t){
    const p=String(t||"").split(":").map(Number);
    return p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])?p[0]*60+p[1]:null;
  }
  /* index of the row happening now (last row whose time has passed), else -1 */
  function currentRow(now){
    let at=-1;
    SCHEDULE.forEach(function(r,i){if(now>=mins(r.t))at=i;});
    return at;
  }
  function fill(pair,vars){
    return pair.map(function(s){return String(s).replace(/\{(\w+)\}/g,function(m,key){return vars&&vars[key]!=null?String(vars[key]):m;});});
  }
  /* D4: a chore's state from today's claims and queued ops for its identity.
     todo | waiting (queued or pending) | confirmed | denied */
  function choreState(kid,day,chore,src){
    src=src||{};
    const slot=chore.slot||"default";
    const match=function(c){return c&&c.kid_id===kid&&c.day===day&&c.kind===chore.kind&&(c.slot||"default")===slot;};
    const claims=(src.claims||[]).filter(match);
    if(claims.some(function(c){return c.status==="confirmed";}))return "confirmed";
    if(claims.some(function(c){return c.status==="pending"||c.status==="queued";}))return "waiting";
    if((src.queue||[]).some(function(op){return op&&op.type==="pointClaim"&&match(op.claim);}))return "waiting";
    if(claims.some(function(c){return c.status==="denied";}))return "denied";
    return "todo";
  }
  const api={KIDS:KIDS,SCHEDULE:SCHEDULE,CHORES:CHORES,BONUS:BONUS,TEXT:TEXT,parseMode:parseMode,isWeekend:isWeekend,modeFor:modeFor,mins:mins,currentRow:currentRow,fill:fill,choreState:choreState};
  if(typeof window!=="undefined")window.SQSchool=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
