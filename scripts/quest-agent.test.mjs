// Quest/agent lifecycle contract — keeps the child-facing state machine and the
// MCP-like activity seam deterministic before a remote model is introduced.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function memoryStorage(){
  const m=new Map();
  return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()};
}
global.localStorage=memoryStorage();

const progress=require("../js/quest-progress.js");
const config=require("../js/quest-config.js");
const core=require("../js/quest-core.js");
const router=require("../js/activity-router.js");
const summer=require("../js/summer-agent.js");

const KID="lili", DAY="2026-09-23", QUEST="room_rescue";

// --- lifecycle: start -> pause -> resume -> verify -> redo -> verify -> complete
{
  progress.resetDay(KID,DAY);
  assert.equal(progress.status(KID,DAY,QUEST),"not_started");
  progress.start(KID,DAY,QUEST);
  assert.equal(progress.status(KID,DAY,QUEST),"in_progress");
  progress.setStep(KID,DAY,QUEST,1,3);
  assert.equal(progress.get(KID,DAY,QUEST).currentStep,1);
  progress.pause(KID,DAY,QUEST);
  assert.equal(progress.status(KID,DAY,QUEST),"paused");
  progress.resume(KID,DAY,QUEST);
  assert.equal(progress.status(KID,DAY,QUEST),"in_progress");

  progress.requestVerification(KID,DAY,QUEST,"verify-1");
  assert.equal(progress.status(KID,DAY,QUEST),"awaiting_verification");
  progress.applyVerificationRow({id:"verify-1",kid_id:KID,kind:`quest_verify:${QUEST}:${DAY}`,answer:"Redo · try again",answered_at:"2026-09-23T08:00:00Z"});
  assert.equal(progress.status(KID,DAY,QUEST),"redo");

  progress.start(KID,DAY,QUEST);
  assert.equal(progress.status(KID,DAY,QUEST),"in_progress","a redo starts a fresh attempt");
  // Old answered rows are history, not authority over a new attempt.
  progress.applyVerificationRow({id:"verify-1",kid_id:KID,kind:`quest_verify:${QUEST}:${DAY}`,answer:"Redo · stale",answered_at:"2026-09-23T08:00:00Z"});
  assert.equal(progress.status(KID,DAY,QUEST),"in_progress","stale verification must not revive redo");

  progress.requestVerification(KID,DAY,QUEST,"verify-2");
  progress.applyVerificationRow({id:"verify-2",kid_id:KID,kind:`quest_verify:${QUEST}:${DAY}`,answer:"Approved · Quest verified",answered_at:"2026-09-23T08:10:00Z"});
  assert.equal(progress.status(KID,DAY,QUEST),"completed");
  assert.equal(progress.done(KID,DAY,QUEST),true);
}

// --- quest config: parent verification and companion policy survive normalization
{
  const q=config.normalizeQuest({id:"Clean Room!",verification:"parent",rewardStars:99},0);
  assert.equal(q.id,"clean_room_");
  assert.equal(q.verification,"parent");
  assert.equal(q.rewardPoints,0,"unknown tasks cannot invent a paid award kind");
  assert.equal(config.normalizeQuest({id:"room_rescue",rewardStars:99},0).rewardPoints,10,"known work uses the shared point policy, not a client amount");
  const kind=config.questVerificationKind(q.id,DAY);
  assert.deepEqual(config.parseQuestVerificationKind(kind),{questId:q.id,day:DAY});
  assert.equal(config.assistant({}).companionEnabled,true);
}

// --- ranking: active/redo quests are surfaced; waiting quests are withheld
{
  const catalog=[
    config.normalizeQuest({id:"fresh",priority:20,title:["Fresh","新"]},0),
    config.normalizeQuest({id:"active",priority:20,title:["Active","進行"]},1),
    config.normalizeQuest({id:"redo",priority:20,title:["Redo","重做"]},2),
    config.normalizeQuest({id:"waiting",priority:200,title:["Waiting","等待"]},3)
  ];
  const ctx={kid:KID,age:7,day:DAY,minutes:16*60,preference:"surprise",energy:"any",completed:[],recent:[],inProgress:["active"],redo:["redo"],waiting:["waiting"]};
  const ids=core.listAvailable(catalog,ctx).map(q=>q.id);
  assert.ok(ids.indexOf("waiting")<0,"waiting quests stay out of the actionable list");
  assert.ok(ids.indexOf("redo")<ids.indexOf("fresh"),"redo is deliberately surfaced");
  assert.ok(ids.indexOf("active")<ids.indexOf("fresh"),"an in-progress quest is easy to resume");
}

// --- activity router: host is the stable seam; adapters can enrich later
{
  let opened=null;
  router.clearCurrent();
  router.bindHost({
    getSurface:()=>({surface:"hub",tab:"quests"}),
    openAction:a=>{opened=a;return {ok:true};},
    getHelpContext:()=>({speech:"host help",speechZh:"幫助"}),
    backToQuests:()=>({ok:true})
  });
  await router.open({type:"tab",tab:"games"});
  assert.deepEqual(opened,{type:"tab",tab:"games"});
  router.setCurrent("game","demo",{title:"Demo"});
  assert.equal(router.context().activity.id,"demo");
  assert.equal(router.help().speech,"host help");
}

// --- local Summer companion always has a useful offline response
{
  const r=await summer.interact({stage:"companion",context:{state:"paused",quest:{id:"x",title:["Plant Patrol","植物巡邏"]}}});
  assert.equal(r.provider,"local");
  assert.ok(r.actions.includes("resume_quest"));
  assert.ok(r.speech.length>0&&r.speechZh.length>0);
}

console.log("ok - quest lifecycle, verification, routing and local companion");
