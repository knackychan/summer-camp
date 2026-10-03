// Run: node scripts/points.test.mjs. No server credentials or dependencies.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require=createRequire(import.meta.url);
const Points=require("../js/points.js");
const source=readFileSync(new URL("../js/sync.js",import.meta.url),"utf8");
const day="2026-10-03";
function storage(seed={}){
  const map=new Map(Object.entries(seed).map(([k,v])=>[k,JSON.stringify(v)]));
  return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),map};
}
function load(ls,client=null,online=false){
  const window={SQPoints:Points,SQ_DAY:{iso:()=>day},SQ_CONFIG:{SUPABASE_URL:"https://test",SUPABASE_ANON_KEY:"public"}};
  new Function("window","localStorage","navigator","addEventListener","document",source)(window,ls,{onLine:online},()=>{},{});
  return new window.SyncStore({progress:{},settings:{}},client);
}
function fakeClient({rows=[],totals=[],settings=[],assignments=[],failTotals=false}={}){
  const claims=new Map(rows.map(c=>[Points.identity(c),c]));
  const calls=[];
  return {calls,claims,from(table){
    const b={};
    for(const method of ["select","eq","or","order","gte","lte","limit","delete","maybeSingle"])b[method]=()=>b;
    for(const method of ["upsert","insert","update"])b[method]=()=>Promise.resolve({data:null,error:null});
    b.then=(ok,bad)=>Promise.resolve(table==="point_totals"&&failTotals?{error:new Error("offline snapshot")}:({error:null,data:table==="points_claims"?Array.from(claims.values()):table==="point_totals"?totals:table==="family_settings"?settings:table==="points_assignments"?assignments:[]})).then(ok,bad);
    return b;
  },async rpc(name,args){
    calls.push({name,args});
    if(name==="points_legacy_award"){
      const old=args.p_row;
      const row={id:old.id,kid_id:old.kid_id,day,kind:"legacy",slot:old.id,amount:old.delta*10,status:"pending",legacy_id:old.id};
      claims.set(Points.identity(row),row);return {data:row,error:null};
    }
    const c=args.p_claim,key=Points.identity(c);
    if(name==="points_begin_attempt"){
      if(!claims.has(key))claims.set(key,{...c,status:"started"});
    }else if(!claims.has(key)||["started","denied"].includes(claims.get(key).status))claims.set(key,{...c,status:"pending"});
    return {data:claims.get(key),error:null};
  }};
}

// Migration keeps the original cache/queue as recovery data and does not add
// coins to stars: coins were a display of the very same ledger.
{
  const ls=storage({"sq:serverStars":{lili:80},"sq:famSettings":{reward_spend_lili:JSON.stringify({total:20,requests:["old-request"]})},"sq:queue":[{id:"legacy-offline",type:"stars",kid:"lili",delta:2,reason:"Reading"}]});
  const store=load(ls);
  assert.deepEqual(store.pointsFor("lili"),{totalEarned:800,spent:200,available:600,pending:20});
  assert.equal(store.starsFor("lili"),800,"achievement progress is confirmed lifetime earnings, independent of spending");
  const backup=ls.getItem("sq:points:legacy:v0");
  assert.equal(JSON.parse(backup).queue[0].id,"legacy-offline");
  assert.equal(JSON.parse(ls.getItem("sq:serverStars")).lili,80,"legacy cache retains its own units");
  const again=load(ls);
  assert.deepEqual(again.pointsFor("lili"),store.pointsFor("lili"));
  assert.equal(ls.getItem("sq:points:legacy:v0"),backup,"repeat migration cannot overwrite recovery snapshot");
  const client=fakeClient({totals:[{kid_id:"lili",total_earned:800,spent:200,available:600,pending:20}]});
  const connected=load(ls,client,true);
  await connected.flush();
  assert.equal(client.calls[0].name,"points_legacy_award");
  assert.equal(client.calls[0].args.p_row.delta,2,"send ORIGINAL units, exactly once at server boundary");
  assert.equal(connected.queue.length,0);
  assert.equal(connected.pointsFor("lili").pending,20,"accepted legacy import remains parent-pending");
  await connected.flush();
  assert.equal(client.calls.length,1,"offline operation leaves queue once receipt is durable");
}

// Every entrance resolves to the same real task; meal/session slots enforce caps.
{
  assert.deepEqual(Points.block(3),[Points.quest("reading_nest")]);
  assert.deepEqual(Points.block(11),[Points.activity("roof")]);
  assert.deepEqual(Points.activity("boxing"),Points.activity("activescreen"));
  assert.deepEqual(Points.block(8),[Points.activity("creative")]);
  assert.deepEqual(Points.block(10),Points.block(8));
  assert.equal(Points.quest("game_adventure"),null);
  assert.equal(Points.activity("kitchen"),null);
  assert.equal(Points.quest({id:"reading_nest",awardKind:""}),null,"explicit no-points admin policy is respected");
  assert.deepEqual(Points.block(5),[],"screen time does not pay");
  assert.deepEqual(Points.block(7),[],"rest does not pay");
  assert.deepEqual(Points.block(14).map(t=>t.kind),["shower","evening_teeth"]);
  assert.equal(Points.quest({id:"table_helper_dinner",awardKind:"table_helper",awardSlot:"dinner"}).slot,"dinner");
  assert.throws(()=>Points.claim("lili",day,"table_helper",{slot:"snack"}),/meal/);
  assert.throws(()=>Points.claim("lili",day,"learning",{slot:"3"}),/session/);
  assert.equal(Points.goal("reading","lucien")[0].includes("Listen"),true);
  assert.equal(Points.amount("reading",{}),20);
  assert.equal(Points.amount("reading",{points_policy_v1:'{"awards":{"reading":25}}'}),25);
  assert.equal(Points.amount("reading",{points_policy_v1:'{"awards":{"reading":21}}'}),20,"only valid whole 5-point settings apply");
}

// Four care routines + three helper jobs + trio + reading + movement + bonus = 125.
{
  const claims=["morning_teeth","evening_teeth","dressing","shower","reading","movement"].map(k=>Points.claim("lili",day,k));
  for(const slot of ["breakfast","lunch","dinner"])claims.push(Points.claim("lili",day,"table_helper",{slot}));
  for(const slot of ["calc","sign","crunch"])claims.push(Points.claim("lili",day,"brain",{slot}));
  claims.forEach(c=>c.status="confirmed");
  const bonus=Points.bonuses(claims,"lili",day);
  assert.equal(claims.reduce((n,c)=>n+c.amount,0)+bonus.reduce((n,c)=>n+c.amount,0),125);
  assert.equal(claims.filter(c=>c.kind==="brain").reduce((n,c)=>n+c.amount,0),30,"no trio bonus");
  const history=["2026-09-28","2026-09-30","2026-10-02"].map(day=>({kid_id:"lili",day,kind:"balanced_day",amount:20,status:"confirmed"}));
  const fourth=Points.bonuses([...history,...claims],"lili",day);
  assert.deepEqual(fourth.map(b=>b.kind),["balanced_day","balanced_week"]);
  const all=[...history,...claims,...fourth.map(c=>({...c,kid_id:"lili",status:"confirmed"}))];
  assert.deepEqual(Points.bonuses(all,"lili",day),[],"both bonuses pay once");
  assert.equal(Points.week("2026-10-04"),"2026-09-28","Sunday stays in the old family week");
  assert.equal(Points.week("2026-10-05"),"2026-10-05","Monday starts the next family week");
  assert.equal(Points.bonuses(claims.filter(c=>c.kind!=="movement"),"lili",day,["move"])[0].amount,20,"parent-excused category qualifies");
}

// Offline, reload, duplicate entrances, assignment binding, price snapshot.
{
  const ls=storage(),store=load(ls);
  store.familySettings.points_policy_v1='{"awards":{"reading":20}}';
  store.pointAssignments=[{id:"assigned",kid_id:"lili",day,kind:"reading",slot:"default",work_id:"book-chapter",amount:20}];
  const attempt=store.beginPointAttempt("lili","reading",{day});
  store.familySettings.points_policy_v1='{"awards":{"reading":40}}';
  const first=await store.awardPoints("lili","reading",{day,evidence:{source:"quests"}});
  assert.equal(JSON.parse(ls.getItem("sq:queue")).length,0,"older app builds cannot discard unknown points operations");
  assert.equal(JSON.parse(ls.getItem("sq:points:queue:v1")).length,2,"attempt and completion are isolated from the old queue");
  assert.equal(first.amount,20,"starting amount survives changes before completion");
  assert.equal(first.work_id,"book-chapter");
  assert.equal(first.evidence.assignment_id,"assigned");
  assert.equal(first.id,attempt.id);
  await store.awardPoints("lili",Points.block(3)[0].kind,{day,evidence:{source:"schedule"}});
  assert.equal(store.queue.filter(op=>op.type==="pointClaim").length,1);
  assert.deepEqual(store.pointsFor("lili"),{totalEarned:0,available:0,pending:20,spent:0});
  store.pointCache.totals.lili.pending=100;
  assert.equal(store.pointsFor("lili").pending,120,"another device's aggregate pending does not hide this device's queued work");
  store.pointCache.totals.lili.pending=0;
  const reloaded=load(ls);
  await reloaded.awardPoints("lili","reading",{day});
  assert.equal(reloaded.queue.filter(op=>op.type==="pointClaim").length,1,"retry after reload pays once");
  const client=fakeClient({totals:[{kid_id:"lili",total_earned:0,available:0,spent:0,pending:20}]});
  const connected=load(ls,client,true);
  await connected.flush();
  assert.equal(connected.queue.length,0);
  assert.equal(connected.pointClaims[0].status,"pending");
  assert.equal(connected.pointsFor("lili").pending,20);
  const secondDevice=load(storage(),client,true);
  await secondDevice.hydrate();
  await secondDevice.awardPoints("lili","reading",{day});
  assert.equal(secondDevice.queue.filter(op=>op.type==="pointClaim").length,0,"synced second tablet sees the same claimed task");
  const confirmed={...connected.pointClaims[0],status:"confirmed"};
  connected.applyPointClaims([confirmed]);
  connected.applyPointTotals([{kid_id:"lili",total_earned:20,available:5,spent:15,pending:0}]);
  assert.equal(connected.starsFor("lili"),20);
  assert.equal(connected.pointsFor("lili").available,5,"spending never lowers earned achievement progress");
}

// A receipt followed by a failed total read remains visibly pending and durable.
{
  const ls=storage(),offline=load(ls);
  await offline.awardPoints("lili","morning_teeth",{day});
  const client=fakeClient({failTotals:true});
  const connected=load(ls,client,true);
  await assert.rejects(connected.flush(),/offline snapshot/);
  assert.equal(connected.queue.length,0,"receipt persisted before queue removal");
  assert.equal(load(ls).pointsFor("lili").pending,5);
  assert.equal(JSON.parse(ls.getItem("sq:points:v1")).claims.length,1);
}

// Storage failure cannot claim that an undurable award was successfully saved.
{
  const ls=storage(),store=load(ls);
  store.beginPointAttempt("lili","morning_teeth",{day});
  const write=ls.setItem;
  ls.setItem=(key,value)=>{if(key==="sq:points:queue:v1")throw new Error("storage full");write(key,value);};
  await assert.rejects(store.awardPoints("lili","morning_teeth",{day}),/storage full/);
  assert.equal(store.queue.filter(op=>op.type==="pointClaim").length,0);
  assert.equal(store.pointClaims.length,0);
}

// A full device can still open games; it cannot claim new points were saved.
{
  const ls=storage({"sq:serverStars":{lili:80},"sq:queue":[{id:"unsent",type:"stars",kid:"lili",delta:1}]});
  ls.setItem=()=>{throw new Error("storage full");};
  const store=load(ls);
  assert.equal(store.pointsFor("lili").totalEarned,800);
  assert.equal(store.pointsFor("lili").pending,10);
  assert.equal(store.queue.length,1);
  assert.equal(store.pointsStorageError,"storage full");
  assert.throws(()=>store.beginPointAttempt("lili","shower",{day}),/storage full/);
}

// Starting online never hides a completion still waiting in the offline queue.
{
  const ls=storage(),offline=load(ls);
  const claim=await offline.awardPoints("lili","reading",{day});
  const client=fakeClient(),rpc=client.rpc.bind(client);
  client.rpc=(name,args)=>name==="points_claim"?Promise.reject(new Error("completion connection lost")):rpc(name,args);
  const online=load(ls,client,true);
  await online.flush();
  assert.equal(online.queue.filter(op=>op.type==="pointBegin").length,0);
  assert.equal(online.queue.filter(op=>op.type==="pointClaim").length,1);
  assert.equal(online.pointsFor("lili").pending,20);
  assert.equal(load(ls).pointsFor("lili").pending,20);
  online.pointClaims=[{...claim,status:"started"}];
  assert.equal(online.pointsFor("lili").pending,20,"server started row cannot mask queued completion evidence");
  online.applyPointClaims([{...claim,status:"denied"}]);
  online.queue=[];online.persistQueue([],true);
  const retry=await online.awardPoints("lili","reading",{day,evidence:{completed:true,retry:true}});
  assert.equal(retry.id,claim.id,"denied task can be resubmitted without minting another identity");
  assert.equal(retry.status,"queued");
}

// New app + old database still sync learning; currency intents wait for rollout.
{
  const ls=storage(),offline=load(ls);
  await offline.awardPoints("lili","shower",{day});
  const client=fakeClient(),from=client.from.bind(client);
  let savedStats=0;
  client.from=table=>{
    const b=from(table);
    if(table.startsWith("point"))b.then=(ok,bad)=>Promise.resolve({data:null,error:{code:"42P01",message:"Points migration not installed"}}).then(ok,bad);
    if(table==="game_stats"){
      b.then=(ok,bad)=>Promise.resolve({data:[{kid_id:"lili",stat:"race",value:42}],error:null}).then(ok,bad);
      b.upsert=()=>{savedStats++;return Promise.resolve({error:null});};
    }
    return b;
  };
  client.rpc=async()=>({error:{code:"PGRST202",message:"Points migration not installed"}});
  const online=load(ls,client,true);
  online.enqueue({type:"stat",kid:"lili",stat:"race",value:50});
  await online.hydrate();
  assert.equal(online.pointsReady,false);
  assert.equal(online.progress.lili.best.race,50,"pending best score survives core hydration");
  assert.equal(savedStats,1,"missing points RPC cannot block unrelated learning writes");
  assert.equal(online.queue.filter(op=>op.type==="pointClaim").length,1);
  assert.equal(load(ls).pointsFor("lili").pending,5);
}

// An outing replacing the same movement work never leaves a second pending sum.
{
  const ls=storage(),offline=load(ls);
  await offline.awardPoints("lili","outing",{day,workId:"family-walk"});
  const paid={...Points.claim("lili",day,"movement",{workId:"family-walk"}),id:"paid-move",status:"confirmed"};
  const client=fakeClient();
  client.rpc=async name=>name==="points_begin_attempt"?{data:paid,error:null}:Promise.reject(new Error("offline after duplicate receipt"));
  const store=load(ls,client,true);
  store.applyPointTotals([{kid_id:"lili",total_earned:20,spent:0,available:20,pending:0}]);
  await store.flush();
  assert.equal(store.pointsFor("lili").pending,0);
  assert.equal(store.pointClaims.find(c=>c.kind==="outing").amount,0);
  assert.equal(store.pointsFor("lili").totalEarned,20);
}

// Season resets retain every earning intent and balance while clearing learning.
{
  const ls=storage({"sq:serverStars":{lili:80},"sq:queue":[{id:"legacy",type:"stars",kid:"lili",delta:1},{id:"learning",type:"stat",kid:"lili",stat:"missions",value:2}]});
  const initial=load(ls);
  await initial.awardPoints("lili","shower",{day});
  const client=fakeClient({settings:[{key:"season_reset_at",value:"2026-10-03"}]});
  const store=load(ls,client,true);
  await store.hydrate();
  assert.equal(store.pointsFor("lili").totalEarned,800);
  assert.equal(store.pointsFor("lili").pending,15);
  assert.deepEqual(store.queue.map(op=>op.type),["stars","pointBegin","pointClaim"]);
  assert.ok(ls.getItem("sq:points:v1"));
  assert.equal(ls.getItem("keyquest:v2"),null);
}
console.log("points tests passed: migration, shared identities, caps, 125-point example, bonuses, durable replay, snapshots, season preservation");
