// v0.2.2 — agent orchestration / privacy / provider / activity-adapter contract.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
function memStore(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()};}
global.localStorage=memStore();
global.sessionStorage=memStore();
global.window=global;

const events=require("../js/event-bus.js");
const memory=require("../js/agent-memory.js");
const context=require("../js/agent-context.js");
const provider=require("../js/agent-provider.js");
const summer=require("../js/summer-agent.js");
const brainAdapter=require("../js/activity-adapters/brain.js");

// Session memory is small and strips obvious free-form personal fields.
{
  memory.clear("kid-a");
  memory.setPreference("kid-a","energy","low");
  memory.setPreference("kid-a","preference","quick");
  memory.remember("kid-a","CHILD_REQUESTED_HELP",{activityId:"calc",body:"private sentence",name:"Child Name"});
  const m=memory.load("kid-a");
  assert.equal(m.energy,"low");
  assert.equal(m.preference,"quick");
  assert.equal(m.events.length,1);
  assert.equal(m.events[0].data.activityId,"calc");
  assert.equal("body" in m.events[0].data,false);
  assert.equal("name" in m.events[0].data,false);
}

// Remote context deliberately uses an age band, not a child name or exact age.
{
  events.clear();
  events.emit("QUEST_STARTED",{questId:"plant_patrol",body:"not forwarded"});
  const ctx=context.build({
    kid:{id:"lili",name:"Lili",age:7},day:"2026-09-23",minutes:1020,timeBucket:"evening",coins:12,
    energy:"low",preference:"care",requiredDone:1,requiredTotal:3,
    availableQuests:[{id:"plant_patrol",title:["Plant Patrol","植物巡邏"],category:"care",duration:5,energy:"low"}],
    activity:{scope:"game",id:"calc",meta:{title:"Calculations"},phase:"active",index:2,total:10},events:events.history(6)
  });
  assert.deepEqual(ctx.child,{ageBand:"7-9"});
  assert.equal(JSON.stringify(ctx).includes("Lili"),false);
  assert.equal(JSON.stringify(ctx).includes('"age":7'),false);
  assert.equal(ctx.availableQuests[0].id,"plant_patrol");
  assert.equal(ctx.activity.id,"calc");
  assert.equal(ctx.recentEvents[0].type,"QUEST_STARTED");
}

// Provider accepts only prefiltered quest ids / companion actions and strips markup.
{
  const request={stage:"recommend",agentContext:{availableQuests:[{id:"plant_patrol"},{id:"reading_nest"}]}};
  const out=provider.validate({
    kind:"recommendation",speech:"Try <b>this</b>",speechZh:"試試 <b>這個</b>",emotion:"happy",animation:"small_hop",
    questIds:["plant_patrol","invented_quest"],actions:["quest_board","delete_everything"]
  },request);
  assert.deepEqual(out.questIds,["plant_patrol"]);
  assert.deepEqual(out.actions,["quest_board"]);
  assert.equal(out.speech.includes("<"),false);

  assert.throws(()=>provider.validate({speech:"Hi",speechZh:"嗨",choices:[{id:"made_up",label:["x","x"]}]},{stage:"energy",agentContext:{availableQuests:[]}}),/no valid choices/i);
}

// Remote provider posts only the structured context to the configured backend.
{
  let posted=null;
  const remote=provider.create({endpoint:"/api/summer-agent",fetch:async (url,opts)=>{
    posted={url,opts,body:JSON.parse(opts.body)};
    return {ok:true,status:200,json:async()=>({kind:"recommendation",speech:"Plant Patrol?",speechZh:"要植物巡邏嗎？",questIds:["plant_patrol"]})};
  }});
  const response=await remote({stage:"recommend",agentContext:{schemaVersion:"test",availableQuests:[{id:"plant_patrol"}]},kid:{name:"Should not leave client"}});
  assert.equal(posted.url,"/api/summer-agent");
  assert.equal(posted.body.context.schemaVersion,"test");
  assert.equal(JSON.stringify(posted.body).includes("Should not leave client"),false);
  assert.deepEqual(response.questIds,["plant_patrol"]);
}


// A broken remote provider never breaks the child experience.
{
  summer.setRemoteProvider(async()=>{throw new Error("offline");});
  const r=await summer.interact({stage:"energy"});
  assert.equal(r.provider,"local");
  assert.equal(r.questionId,"energy");
  summer.setRemoteProvider(null);
}

// Brain Gym is a semantic adapter, not a DOM scrape.
{
  const adapter=brainAdapter.create({
    getGame:()=>({title:["Calculations","計算"],blurb:["Quick sums","快速計算"],skill:"math"}),
    getState:()=>({idx:2,items:new Array(10),hintLevel:1})
  });
  const c=adapter.getContext();
  assert.equal(c.title,"Calculations");
  assert.equal(c.phase,"active");
  assert.equal(c.index,2);
  assert.equal(c.total,10);
  const h=adapter.getHelpContext();
  assert.match(h.speech,/task 3 of 10/i);
  assert.ok(h.speechZh.length>0);
}

// Orchestrator: redo outranks routine due; future required quest becomes a native reminder intent.
{
  const scheduled=[];
  global.SQAgentMemory=memory;
  global.SQEvents=events;
  global.SQPlatform={scheduleNotification:async req=>{scheduled.push(req);return {supported:true};}};
  delete require.cache[require.resolve("../js/agent-orchestrator.js")];
  const orchestrator=require("../js/agent-orchestrator.js");
  let attention=null;
  orchestrator.bind({
    kid:()=>"kid-a",
    state:()=>({
      kid:"kid-a",day:"2026-09-23",minutes:17*60,
      completed:[],waiting:[],
      active:[{id:"room_rescue",state:"redo"}],
      required:[
        {id:"shower",title:["Shower Quest","洗澡任務"],blurb:["Take a shower","洗澡"],after:16*60,before:21*60},
        {id:"evening_teeth",title:["Evening Teeth","晚間刷牙"],blurb:["Brush teeth","刷牙"],after:19*60+15,before:22*60}
      ]
    }),
    onAttention:a=>{attention=a;}
  });
  assert.equal(attention.kind,"redo");
  await orchestrator.scheduleRequired();
  assert.equal(scheduled.length,1);
  assert.equal(scheduled[0].questId,"evening_teeth");
  orchestrator.unbind();
}

console.log("ok - v0.2.2 agent orchestration, privacy, provider and Brain adapter");
