import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require=createRequire(import.meta.url);
const points=require("../js/points.js"), config=require("../js/quest-config.js");
const rewards=require("../js/reward-data.js"), quests=require("../js/quest-data.js");
const gate=require("../js/games-gate-core.js");

// Catalog migration preserves value and identities, including repeated saves.
const old={id:"movie_pick",cost:12,title:["Movie","電影"]};
const converted=config.normalizeReward(old,0);
assert.equal(converted.cost,120);
assert.deepEqual(config.normalizeReward(converted,0),converted);
assert.equal(config.normalizeReward({...converted,title:["New name","新名稱"]},0).id,old.id);
const settings={reward_spend_lili:JSON.stringify({total:20,requests:["request-1"]})};
assert.equal(config.wallet(800,settings,"lili"),600);
const spent=config.spendState(settings,"lili");
assert.deepEqual(spent.requests,["request-1"]);
assert.deepEqual(config.spendState({reward_spend_lili:JSON.stringify(spent)},"lili"),spent);
assert.equal(config.cashReady({}),false);
assert.equal(config.cashReady({points_economy_v1:JSON.stringify({currency:"TWD",pointsPerUnit:10,cashEnabled:true})}),false);
assert.equal(config.cashReady({points_economy_v1:JSON.stringify({currency:"TWD",pointsPerUnit:10,monthlyBudget:500,cashEnabled:true})}),true);
assert.equal(config.conversionReady({points_economy_v1:JSON.stringify({currency:"TWD",pointsPerUnit:10,monthlyBudget:500,cashEnabled:false})}),true,"paid gifts do not require enabling cash");
assert.equal(config.giftPoints(1.01,{points_economy_v1:{currency:"TWD",pointsPerUnit:10,monthlyBudget:500}}),15,"fractional gift costs round up to five points");
assert.equal(config.giftPoints(2.2,{points_economy_v1:{currency:"TWD",pointsPerUnit:25,monthlyBudget:500}}),55,"floating-point noise does not reprice an exact boundary");
assert.equal(config.giftPoints(10,{}),null);
assert.equal(config.economy({}).rateChange,null);
const rateChange={from:10,to:20,fromCurrency:"TWD",currency:"TWD",at:"2026-10-03T04:00:00.000Z"};
assert.deepEqual(config.economy({points_economy_v1:{...rateChange,currency:"TWD",pointsPerUnit:20,rateChange}}).rateChange,rateChange);
assert.deepEqual(rewards.all().map(r=>config.normalizeReward(r,0).cost),[120,200,250,500]);
assert.equal(config.normalizeQuest({id:"reading_nest",rewardStars:999},0).rewardPoints,20);
assert.equal(config.normalizeQuest({id:"reading_nest"},0).verification,"parent");
assert.deepEqual(quests.all().filter(q=>/^table_helper/.test(q.id)).map(q=>points.quest(q).slot).sort(),["breakfast","dinner","lunch"]);
assert.ok(quests.all().some(q=>q.id==="dressing"));

// Run the real admin functions with only DOM/network edges stubbed.
const elements=new Map(), calls=[], writes=[];
const node=id=>{
  if(!elements.has(id))elements.set(id,{value:"",checked:false,dataset:{},innerHTML:"",textContent:"",focus(){},querySelector(){return null;},querySelectorAll(){return [];},classList:{add(){},remove(){},toggle(){}}});
  return elements.get(id);
};
const context={window:{SQPoints:points,SQQuestConfig:config,SQRewardData:rewards,SQQuestData:quests,SQGamesGate:gate},
  SQPoints:points,SQQuestConfig:config,SQGamesGate:gate,SQ_DAY:{isoOffset:()=>"2026-10-03"},
  document:{getElementById:node,querySelectorAll:()=>[]},localStorage:{getItem:()=>null},
  crypto:{randomUUID:()=>"manual-fixed-id"},SQStarId:{random:()=>"manual-fixed-id"},setTimeout:()=>0,clearTimeout(){},console,
  prompt:()=>"Unable to deliver",Date,Set,Map};
vm.createContext(context);
global.window=context.window;
const source=readFileSync(new URL("../js/admin.js",import.meta.url),"utf8");
vm.runInContext(source.slice(0,source.indexOf("  /* ---- Event wiring ---- */"))+`
  window.test={renderPointsSettings,renderPointsReviews,renderQuestRewardEditor,saveQuestReward,
    approveRewardRequest,denyRewardRequest,grantStars,acceptBlock,removeBlock,resetAcceptedDay,
    set(clientValue){client=clientValue;session={user:{id:'parent'}};today='2026-10-03';pointsReady=true;
      rows.pointTotals=[{kid_id:'lili',total_earned:800,available:600,pending:20}];
      rows.familySettings=[];rewardEditId='movie_pick';loadAll=async function(){};toast=function(){};},
    offline(){pointsReady=false;},
    gate(fs,claims,guide){rows.familySettings=fs;rows.pointClaimsToday=claims;rows.guideDecisions=guide||[];}};
})();`,context);
const api=context.window.test;
api.set({rpc:async(name,args)=>{calls.push({name,args});return {data:{id:"claim-1",status:"confirmed"},error:null};},
  from:table=>({upsert:async(row)=>{writes.push({table,row});return {error:null};}})});
api.renderPointsSettings(node("studio"));
assert.match(node("studio").innerHTML,/Agreed goal \(Traditional Chinese\)/);
assert.match(node("studio").innerHTML,/monthly budget/i);
assert.match(node("studio").innerHTML,/pointsCash/);
// Games points gate card (games-gate-ai-guide slice 03): same SQGamesGate as the tablets.
assert.match(node("studio").innerHTML,/<h3>Games gate<\/h3>/);
assert.match(node("studio").innerHTML,/id="ggEnabled">/,"ships switched off");
api.gate([{key:"games_gate_v1",value:JSON.stringify({enabled:true,threshold:{luis:50,lili:50,lucien:40}})},{key:"braingate_luis",value:"2026-10-03"}],
  [{kid_id:"lili",day:"2026-10-03",kind:"room_rescue",slot:"default",amount:10,status:"pending"},
   {kid_id:"lili",day:"2026-10-03",kind:"homework",slot:"default",amount:30,status:"denied"},
   {kid_id:"lucien",day:"2026-10-03",kind:"brain",slot:"calc",amount:10,status:"confirmed"},
   {kid_id:"lucien",day:"2026-10-03",kind:"homework",slot:"default",amount:30,status:"pending"}]);
api.renderPointsSettings(node("studio"));
const ggHtml=node("studio").innerHTML;
assert.match(ggHtml,/id="ggEnabled" checked>/);
assert.match(ggHtml,/Lili · 10 \/ 50 points today/);assert.match(ggHtml,/Waiting · 40 to go/);
assert.match(ggHtml,/Lucien · 40 \/ 40 points today/);
assert.match(ggHtml,/Open — Papa today/);assert.match(ggHtml,/data-ggopen="luis:undo"/);
assert.match(ggHtml,/data-ggthreshold="lucien" value="40"/);
assert.match(ggHtml,/No guide decisions yet/);
api.gate([],[],[{kid_id:"lili",day:"2026-10-03",slot:"morning",reroll:1,source:"local",answers:{done:["room"],time:"some"},picks:[{id:"shoes"},{id:"garden"}],started_id:"garden"}]);
api.renderPointsSettings(node("studio"));
assert.match(node("studio").innerHTML,/Lili · 2026-10-03 morning · reroll 1 · local/);
assert.match(node("studio").innerHTML,/shoes · ▶ garden/);assert.match(node("studio").innerHTML,/Done: room · Time: some/);
api.renderQuestRewardEditor();
assert.match(node("qsRewardEditor").innerHTML,/<label for="rwTitleEn">Exchange label \(English\)/);
assert.match(node("qsRewardEditor").innerHTML,/<label for="rwTitleZh">Exchange label \(Traditional Chinese\)/);
node("rwTitleEn").value='<img src=x onerror="bad">';node("rwTitleZh").value="新名稱";
node("rwCost").value="200";node("rwKind").value="experience";node("rwIcon").value="🎬";node("rwEnabled").checked=true;
await api.saveQuestReward(config.normalizeReward(rewards.byId("movie_pick"),0),false);
const saved=JSON.parse(writes.at(-1).row.value).find(r=>r.id==="movie_pick");
assert.equal(saved.title[0],'<img src=x onerror="bad">');
assert.equal(saved.cost,200);assert.equal(saved.points_version,1);
// Rendering performs escaping while the catalog retains plain original text.
api.renderQuestRewardEditor();
// Closing after save means no editor is selected; source invariant covers both labels.
assert.match(source,/esc\(r\.title\[0\]\)/);
await api.grantStars("lili",10);
assert.equal(calls.length,0,"manual awards require a reason");
node("grantReason-lili").value="A distinct helpful contribution";
await api.grantStars("lili",10);
assert.equal(calls[0].name,"points_manual_award");
assert.equal(calls[0].args.p_amount,10);
assert.equal(calls[0].args.p_id,"manual-fixed-id");
await api.approveRewardRequest("request-1");await api.denyRewardRequest("request-2");
assert.deepEqual(calls.slice(1).map(c=>[c.name,c.args.p_id]),[["points_approve_redemption","request-1"],["points_deny_redemption","request-2"]]);
assert.equal(writes.length,1,"redemptions never write a client spending total");
api.offline();await api.approveRewardRequest("blocked");
assert.equal(calls.length,3,"an undeployed database cannot approve redemption");
assert.doesNotMatch(source,/from\("stars_ledger"\)\.(insert|upsert|delete)/,"ledger mutation uses validated transactional RPCs");
assert.doesNotMatch(source,/data-resetstars|syncDayBonus|grantStarRows/);
api.set({from:table=>({upsert:async(row)=>{writes.push({table,row});return {error:null};}})});
async function saveRate(rate,budget=500){
  api.renderPointsSettings(node("studio"));
  node("pointsCurrency").value="TWD";node("pointsRate").value=String(rate);node("pointsBudget").value=String(budget);
  await node("pointsEconomyForm").onsubmit({preventDefault(){}});
  return JSON.parse(writes.at(-1).row.value);
}
assert.equal((await saveRate(10)).rateChange,undefined,"initial configuration needs no rate-change announcement");
const changed=await saveRate(20);
assert.equal(changed.rateChange.from,10);assert.equal(changed.rateChange.to,20);
assert.equal(changed.rateChange.currency,"TWD");assert.ok(Number.isFinite(Date.parse(changed.rateChange.at)));
assert.deepEqual((await saveRate(20,600)).rateChange,changed.rateChange,"budget-only edits retain the announcement");
console.log("ok - points admin, catalog migration, preserved labels, required reasons and transactional exchanges");
