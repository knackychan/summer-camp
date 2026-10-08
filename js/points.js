/* Shared point policy. The database repeats the validation: browser previews
   are never permission to credit money-equivalent points. */
(function(){
  const rules={
    morning_teeth:{points:5,limit:1,category:"care",label:["Morning Teeth","早晨刷牙"]},
    evening_teeth:{points:5,limit:1,category:"care",label:["Evening Teeth","晚間刷牙"]},
    dressing:{points:5,limit:1,category:"care",label:["Dress and make the bed","穿衣和鋪床"]},
    shower:{points:5,limit:1,category:"care",label:["Shower Quest","洗澡任務"]},
    table_helper:{points:5,limit:3,category:"help",label:["Table Helper","餐桌小幫手"]},
    plant_patrol:{points:10,limit:1,category:"help",label:["Plant Patrol","植物巡邏"]},
    room_rescue:{points:10,limit:1,category:"help",parent:true,label:["Room Rescue","房間救援"]},
    laundry_helper:{points:15,limit:1,category:"help",parent:true,label:["Laundry Helper","洗衣小幫手"]},
    /* home-help kinds for the games points gate (2026-10-08-games-gate-ai-guide D3) */
    shoe_tidy:{points:5,limit:1,category:"help",label:["Tidy the shoes","整理鞋子"]},
    garden_tidy:{points:15,limit:1,category:"help",parent:true,label:["Tidy the garden","整理花園"]},
    living_tidy:{points:10,limit:1,category:"help",parent:true,label:["Tidy the living room","整理客廳"]},
    office_tidy:{points:10,limit:1,category:"help",parent:true,label:["Tidy the office","整理辦公室"]},
    housework:{points:20,limit:1,category:"help",parent:true,label:["Extra housework","額外家事"]},
    reading:{points:20,limit:1,category:"learn",parent:true,label:["Reading Nest","閱讀小窩"]},
    brain:{points:10,limit:3,category:"learn",label:["Assigned Brain Gym exercise","指定頭腦體操"]},
    homework:{points:30,limit:1,category:"learn",parent:true,label:["Homework","暑假作業"]},
    learning:{points:20,limit:2,category:"learn",parent:true,label:["Assigned learning or skill practice","指定學習或技能練習"]},
    movement:{points:20,limit:1,category:"move",parent:true,label:["Move Mission","動一動任務"]},
    creative:{points:20,limit:1,category:"create",parent:true,label:["Make Something","做點東西"]},
    photo:{points:15,limit:1,category:"create",parent:true,label:["Photo or video mission","照片或影片任務"]},
    music:{points:15,limit:1,category:"learn",parent:true,label:["Music practice","音樂練習"]},
    sibling_help:{points:10,limit:1,category:"help",parent:true,label:["Help a sibling","幫助兄弟姊妹"]},
    outing:{points:20,limit:1,category:"move",parent:true,label:["Family outing goal","家庭出遊目標"]},
    project:{points:50,limit:1,category:"create",parent:true,weekly:true,label:["Weekly project","每週專題"]},
    balanced_day:{points:20,limit:1,category:"bonus",label:["Balanced day","均衡的一天"]},
    balanced_week:{points:50,limit:1,category:"bonus",weekly:true,label:["Four balanced days","四個均衡日"]}
  };
  const aliases={reading_nest:"reading",move_break:"movement",creative_build:"creative",weekly_craft:"project",captain_help:"sibling_help",photo_mission:"photo",music_practice:"music",table_helper_breakfast:"table_helper",table_helper_dinner:"table_helper"};
  const blocks={0:["dressing","morning_teeth"],1:["table_helper:breakfast"],2:["learning:1"],3:["reading"],4:["homework"],6:["table_helper:lunch"],8:["creative"],10:["creative"],11:["movement"],12:["room_rescue"],13:["table_helper:dinner"],14:["shower","evening_teeth"],15:["photo"]};
  function parse(raw,fallback){try{return typeof raw==="string"?JSON.parse(raw):raw||fallback;}catch(e){return fallback;}}
  function amount(kind,settings){
    if(!rules[kind])return 0;
    const policy=parse(settings&&settings.points_policy_v1,{}), value=policy.awards&&policy.awards[kind];
    return Number.isInteger(value)&&value>=0&&value<=1000&&value%5===0?value:rules[kind].points;
  }
  function descriptor(value){const parts=value.split(":");return {kind:parts[0],slot:parts[1]||"default"};}
  function block(index){return (blocks[index]||[]).map(descriptor);}
  function quest(q,options){
    const id=typeof q==="string"?q:q&&q.id;
    const kind=q&&typeof q==="object"&&Object.prototype.hasOwnProperty.call(q,"awardKind")?q.awardKind:aliases[id]||id;
    if(!rules[kind]||rules[kind].category==="bonus"||kind==="brain")return null;
    const specified=options&&options.slot||q&&q.awardSlot;
    return {kind:kind,slot:kind==="table_helper"?(specified||options&&options.meal||(id==="table_helper_breakfast"?"breakfast":id==="table_helper_dinner"?"dinner":"lunch")):kind==="learning"?String(specified||"1"):"default"};
  }
  function activity(category,options){
    const map={roof:"movement",gym:"movement",boxing:"movement",outdoor:"movement",active:"movement",activescreen:"movement",sport:"movement",desk:"creative",creative:"creative",boredom:"creative",craft:"project",weekly:"project",photo:"photo",video:"photo",computer:"learning",ai:"learning",web:"learning",house:"room_rescue",music:"music",minecraft:"creative"};
    return quest(map[category]||category,options);
  }
  function week(day){const d=new Date(day+"T00:00:00Z");if(!Number.isFinite(+d))throw new Error("Invalid points day");d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
  function identity(claim){return [claim.kid_id,claim.day,claim.kind,claim.slot||"default"].join(":");}
  function claim(kid,day,kind,options,settings){
    options=options||{};
    if(!["lucien","lili","luis"].includes(kid)||!rules[kind])throw new Error("Unknown points task");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||new Date(day+"T00:00:00Z").toISOString().slice(0,10)!==day)throw new Error("Invalid points day");
    let slot=String(options.slot||"default");
    if(kind==="table_helper"&&!(["breakfast","lunch","dinner"].includes(slot)))throw new Error("Choose a meal");
    if(kind==="learning"&&!(["1","2"].includes(slot)))throw new Error("Choose an assigned session");
    if(kind==="brain"&&(slot==="default"||!/^[a-z][a-z0-9_]*$/.test(slot)))throw new Error("Choose an assigned Brain exercise");
    if(!["table_helper","learning","brain"].includes(kind))slot="default";
    return {kid_id:kid,day:rules[kind].weekly?week(day):day,kind:kind,slot:slot,work_id:String(options.workId||options.work_id||kind+":"+slot),amount:amount(kind,settings),status:"queued",policy_version:1,evidence:Object.assign({},options.evidence||{})};
  }
  function goal(kind,kid){
    if(kind==="reading")return kid==="lucien"?["Listen to a picture book and describe a favourite picture.","聽一本圖畫書，說說最喜歡的圖片。"]:kid==="lili"?["Read a short passage and share your favourite part.","讀一小段文章，分享最喜歡的部分。"]:["Read a chapter and share a short summary.","讀一章書，分享簡短摘要。"];
    return kid==="lucien"?["Choose a small goal with a grown-up. Help is welcome.","和大人一起選個小目標，可以請人幫忙。"]:["Agree on one goal and share what you did. Help and retries count.","先說好一個目標，再分享成果。幫助和重試都算數。"];
  }
  /* Used for previews/tests only. The server awards both bonuses atomically. */
  function bonuses(rows,kid,day,excused){
    const confirmed=(rows||[]).filter(r=>r.kid_id===kid&&r.status==="confirmed");
    const categories=new Set((excused||[]).concat(confirmed.filter(r=>r.day===day&&rules[r.kind]).map(r=>rules[r.kind].category)));
    const result=[], monday=week(day);
    if(["learn","help","move"].every(c=>categories.has(c))&&!confirmed.some(r=>r.day===day&&r.kind==="balanced_day"))result.push({kind:"balanced_day",day:day,amount:20});
    const days=new Set(confirmed.filter(r=>r.kind==="balanced_day"&&week(r.day)===monday).map(r=>r.day));
    if(result.length)days.add(day);
    if(days.size>=4&&!confirmed.some(r=>r.kind==="balanced_week"&&r.day===monday))result.push({kind:"balanced_week",day:monday,amount:50});
    return result;
  }
  function legacySpent(settings,kid){
    const raw=parse(settings&&settings["reward_spend_"+kid],0);
    return Math.max(0,Number(typeof raw==="object"?raw.total:raw)||0)*(raw&&raw.points_version===1||String(settings&&settings.points_unit_version)==="2"?1:10);
  }
  function migrateCache(storage,preview){
    function read(key,fallback){try{return parse(storage.getItem(key),fallback);}catch(e){return fallback;}}
    const existing=read("sq:points:v1",null);
    if(existing&&existing.version===1&&existing.totals&&typeof existing.totals==="object")return existing;
    const totals=read("sq:serverStars",{}),settings=read("sq:famSettings",{});
    const cache={version:1,totals:{},claims:[],migratedAt:new Date().toISOString()};
    ["lucien","lili","luis"].forEach(kid=>{const earned=Math.max(0,Number(totals[kid])||0)*10,spent=legacySpent(settings,kid);cache.totals[kid]={total_earned:earned,spent:spent,available:Math.max(0,earned-spent),pending:0};});
    if(!preview){
      if(!read("sq:points:legacy:v0",null))storage.setItem("sq:points:legacy:v0",JSON.stringify({totals:totals,settings:settings,queue:read("sq:queue",[])}));
      storage.setItem("sq:points:v1",JSON.stringify(cache));
    }
    return cache;
  }
  const api={VERSION:1,rules:rules,POLICY:rules,amount:amount,block:block,quest:quest,activity:activity,claim:claim,identity:identity,goal:goal,week:week,bonuses:bonuses,migrateCache:migrateCache};
  if(typeof window!=="undefined")window.SQPoints=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
