/* SQAgentOrchestrator — deterministic coordinator around Summer.
   It reacts to semantic app events, maintains tiny session memory and prepares
   native reminder intents. It never completes quests or changes rewards. */
(function(){
  let host=null,unsubs=[];
  const scheduled=new Set(),scheduling=new Set();
  function storageKey(kid,day,id){return "sq:agent-reminder:v1:"+[kid,day,id].join(":");}
  function alreadyScheduled(kid,day,id){
    const key=storageKey(kid,day,id);if(scheduled.has(key)||scheduling.has(key))return true;
    try{if(localStorage.getItem(key)==="1"){scheduled.add(key);return true;}}catch(e){}
    return false;
  }
  function markScheduled(kid,day,id){const key=storageKey(kid,day,id);scheduled.add(key);try{localStorage.setItem(key,"1");}catch(e){}}
  function remember(evt){
    if(!host||!window.SQAgentMemory)return;
    const kid=host.kid&&host.kid();if(!kid)return;
    SQAgentMemory.remember(kid,evt.type,evt.payload||{});
  }
  function currentAttention(){
    if(!host)return null;
    const s=host.state?host.state():null;if(!s||!s.kid)return null;
    const active=s.active||[];
    const redo=active.find(function(x){return x.state==="redo";});
    if(redo)return {kind:"redo",level:"high",questId:redo.id,label:"↻"};
    const due=(s.required||[]).find(function(q){return (s.completed||[]).indexOf(q.id)<0&&(!s.waiting||s.waiting.indexOf(q.id)<0)&&(!q.after||q.after<=s.minutes)&&(!q.before||q.before>=s.minutes);});
    if(due)return {kind:"routine_due",level:"medium",questId:due.id,label:"!"};
    return null;
  }
  async function scheduleRequired(){
    if(!host||!window.SQPlatform)return [];
    const s=host.state?host.state():null;if(!s||!s.kid||!s.day)return [];
    const out=[];
    for(const q of (s.required||[])){
      if((s.completed||[]).indexOf(q.id)>=0||!Number.isFinite(Number(q.after)))continue;
      if(Number(q.after)<=s.minutes)continue;
      if(alreadyScheduled(s.kid,s.day,q.id))continue;
      const scheduleKey=storageKey(s.kid,s.day,q.id);
      scheduling.add(scheduleKey);
      const hh=String(Math.floor(Number(q.after)/60)).padStart(2,"0"),mm=String(Number(q.after)%60).padStart(2,"0");
      const at=s.day+"T"+hh+":"+mm+":00";
      try{
        const titleEn=q.title&&q.title[0]?q.title[0]:"Summer Quest",titleZh=q.title&&q.title[1]?q.title[1]:"夏日任務";
        const bodyEn=q.blurb&&q.blurb[0]?q.blurb[0]:"A quest is ready.",bodyZh=q.blurb&&q.blurb[1]?q.blurb[1]:"有新的任務可以做了。";
        const r=await SQPlatform.scheduleNotification({id:"quest:"+s.kid+":"+s.day+":"+q.id,at:at,title:titleEn+" · "+titleZh,body:bodyEn+" · "+bodyZh,questId:q.id,kid:s.kid});
        if(r&&r.supported!==false){markScheduled(s.kid,s.day,q.id);out.push(q.id);}
      }catch(e){}finally{scheduling.delete(scheduleKey);}
    }
    return out;
  }
  function refresh(){
    if(!host)return null;
    const attention=currentAttention();
    if(typeof host.onAttention==="function")host.onAttention(attention);
    scheduleRequired();
    return attention;
  }
  function signal(type,payload){
    const evt=window.SQEvents?SQEvents.emit(type,payload||{}):{type:type,payload:payload||{}};
    if(!window.SQEvents)remember(evt);
    refresh();return evt;
  }
  function bind(next){
    host=next||null;unsubs.forEach(function(fn){try{fn();}catch(e){}});unsubs=[];
    if(typeof window!=="undefined"&&window.SQEvents){
      unsubs.push(SQEvents.on("*",remember));
      ["QUEST_STARTED","QUEST_PAUSED","QUEST_COMPLETED","QUEST_VERIFICATION_REQUESTED","QUEST_VERIFICATION_RESOLVED","ACTIVITY_OPENED","ACTIVITY_CLOSED","APP_OPENED"].forEach(function(t){unsubs.push(SQEvents.on(t,refresh));});
    }
    refresh();return api;
  }
  function unbind(){unsubs.forEach(function(fn){try{fn();}catch(e){}});unsubs=[];host=null;}
  const api={bind:bind,unbind:unbind,signal:signal,refresh:refresh,currentAttention:currentAttention,scheduleRequired:scheduleRequired};
  if(typeof window!=="undefined")window.SQAgentOrchestrator=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
