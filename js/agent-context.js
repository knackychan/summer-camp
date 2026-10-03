/* SQAgentContext — builds the compact structured context sent to Summer.
   This is the privacy boundary: the remote provider gets a small age-band/
   state summary, not the full local database or arbitrary app objects. */
(function(){
  const SCHEMA_VERSION="summer-quest.agent-context.v1";
  function ageBand(age){age=Number(age)||0;if(age<=6)return "5-6";if(age<=9)return "7-9";if(age<=12)return "10-12";return "13+";}
  function pairTitle(v){if(Array.isArray(v))return [String(v[0]||"").slice(0,80),String(v[1]||"").slice(0,80)];return [String(v||"").slice(0,80),""];}
  function quest(q){return q?{id:String(q.id||""),title:pairTitle(q.title),category:String(q.category||""),duration:Math.max(0,Number(q.duration)||0),energy:String(q.energy||""),required:!!q.required,verification:q.verification==="parent"?"parent":"self"}:null;}
  function activity(a){
    if(!a)return null;
    const out={scope:String(a.scope||""),id:String(a.id||""),title:String((a.meta&&a.meta.title)||a.title||"").slice(0,80),phase:String(a.phase||a.state||"").slice(0,40)};
    if(Number.isFinite(Number(a.index)))out.index=Number(a.index);
    if(Number.isFinite(Number(a.total)))out.total=Number(a.total);
    if(a.objective)out.objective=String(a.objective).slice(0,140);
    if(a.hintLevel!=null)out.hintLevel=Math.max(0,Math.min(4,Number(a.hintLevel)||0));
    return out;
  }
  function eventSummary(events){return (events||[]).slice(-6).map(function(e){return {type:String(e.type||""),at:String(e.at||"")};});}
  function build(input){
    input=input||{};const child=input.kid||{},mem=input.memory||{};
    return {
      schemaVersion:SCHEMA_VERSION,
      locale:"en+zh-Hant",
      child:{ageBand:ageBand(child.age)},
      time:{day:String(input.day||""),bucket:String(input.timeBucket||""),minutes:Number.isFinite(Number(input.minutes))?Number(input.minutes):null},
      session:{energy:input.energy||mem.energy||"any",preference:input.preference||mem.preference||"surprise",helpCount:Math.max(0,Number(input.helpCount)||0)},
      progress:{coins:Math.max(0,Number(input.coins)||0),requiredDone:Math.max(0,Number(input.requiredDone)||0),requiredTotal:Math.max(0,Number(input.requiredTotal)||0)},
      activeQuest:quest(input.activeQuest),
      availableQuests:(input.availableQuests||[]).slice(0,6).map(quest).filter(Boolean),
      activity:activity(input.activity),
      recentEvents:eventSummary(input.events||mem.events)
    };
  }
  const api={SCHEMA_VERSION:SCHEMA_VERSION,build:build,quest:quest,activity:activity,ageBand:ageBand};
  if(typeof window!=="undefined")window.SQAgentContext=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
