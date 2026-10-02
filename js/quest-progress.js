/* SQQuestProgress — local-first quest lifecycle state.
   v3 adds pause/resume, per-step progress and parent-verification state while
   preserving the v2 completion history. A future synced quest-history service
   can replace this adapter without changing the Quest Engine or child UI. */
(function(){
  const KEY="sq:quest-progress:v3", LEGACY_KEY="sq:quest-progress:v2";
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function read(key){try{return JSON.parse(localStorage.getItem(key)||"null");}catch(e){return null;}}
  function load(){
    const v3=read(KEY); if(v3&&typeof v3==="object")return v3;
    const old=read(LEGACY_KEY); if(old&&typeof old==="object"){save(old);return old;}
    return {};
  }
  function save(v){try{localStorage.setItem(KEY,JSON.stringify(v));}catch(e){}}
  function bucket(kid,day,create){
    const root=load();
    if(!root[kid]&&create)root[kid]={};
    if(root[kid]&&!root[kid][day]&&create)root[kid][day]={};
    return {root:root,day:(root[kid]&&root[kid][day])||{}};
  }
  function normalize(v){
    if(!v||typeof v!=="object")return null;
    const out=Object.assign({},v);
    out.currentStep=Math.max(0,Number(out.currentStep)||0);
    if(out.verification&&typeof out.verification!=="object")out.verification=null;
    return out;
  }
  function put(kid,day,id,mutate){
    const b=bucket(kid,day,true),v=normalize(b.day[id])||{};
    mutate(v);v.updatedAt=new Date().toISOString();
    b.day[id]=v;b.root[kid][day]=b.day;save(b.root);return clone(v);
  }
  function get(kid,day,id){return clone(normalize(bucket(kid,day,false).day[id]||null));}
  function status(kid,day,id){
    const v=get(kid,day,id); if(!v)return "not_started";
    if(v.completedAt)return "completed";
    if(v.verification&&v.verification.status==="pending")return "awaiting_verification";
    if(v.verification&&v.verification.status==="denied")return "redo";
    if(v.pausedAt)return "paused";
    if(v.startedAt)return "in_progress";
    return "not_started";
  }
  function done(kid,day,id){return status(kid,day,id)==="completed";}
  function start(kid,day,id){return put(kid,day,id,function(v){
    if(v.completedAt)return;
    if(v.verification&&v.verification.status==="denied"){
      v.verification=null;v.currentStep=0;v.startedAt=new Date().toISOString();v.redoAt=null;
    }
    if(!v.startedAt)v.startedAt=new Date().toISOString();
    v.pausedAt=null;
  });}
  function pause(kid,day,id){return put(kid,day,id,function(v){if(v.startedAt&&!v.completedAt)v.pausedAt=new Date().toISOString();});}
  function resume(kid,day,id){return put(kid,day,id,function(v){if(!v.startedAt)v.startedAt=new Date().toISOString();if(!v.completedAt)v.pausedAt=null;});}
  function setStep(kid,day,id,index,total){return put(kid,day,id,function(v){
    if(!v.startedAt)v.startedAt=new Date().toISOString();
    v.pausedAt=null;v.currentStep=Math.max(0,Math.min(Math.max(0,(Number(total)||1)-1),Number(index)||0));
  });}
  function complete(kid,day,id){return put(kid,day,id,function(v){
    if(!v.startedAt)v.startedAt=new Date().toISOString();
    if(!v.completedAt)v.completedAt=new Date().toISOString();
    v.pausedAt=null;
    if(v.verification)v.verification.status="approved";
  });}
  function requestVerification(kid,day,id,requestId){return put(kid,day,id,function(v){
    if(!v.startedAt)v.startedAt=new Date().toISOString();
    v.pausedAt=null;
    v.verification={requestId:String(requestId||""),status:"pending",requestedAt:new Date().toISOString(),answer:""};
  });}
  function resolveVerification(kid,day,id,approved,answer,answeredAt,requestId){return put(kid,day,id,function(v){
    const prior=v.verification||{};
    if(requestId&&prior.requestId&&String(prior.requestId)!==String(requestId))return;
    v.verification=Object.assign({},prior,{requestId:String(requestId||prior.requestId||""),status:approved?"approved":"denied",answer:String(answer||""),answeredAt:answeredAt||new Date().toISOString()});
    v.pausedAt=null;
    if(approved){if(!v.completedAt)v.completedAt=v.verification.answeredAt;}
    else{v.completedAt=null;v.redoAt=v.verification.answeredAt;}
  });}
  function cancel(kid,day,id){const b=bucket(kid,day,false);if(!b.root[kid]||!b.day[id])return;delete b.day[id];save(b.root);}
  function list(kid,day){return Object.keys(bucket(kid,day,false).day).filter(function(id){return done(kid,day,id);});}
  function states(kid,day){
    const d=bucket(kid,day,false).day,out={};
    Object.keys(d).forEach(function(id){out[id]=status(kid,day,id);});return out;
  }
  function active(kid,day){
    const d=bucket(kid,day,false).day;
    return Object.keys(d).map(function(id){return {id:id,state:status(kid,day,id),record:get(kid,day,id)};})
      .filter(function(x){return ["in_progress","paused","awaiting_verification","redo"].indexOf(x.state)>=0;})
      .sort(function(a,b){return String(b.record.updatedAt||b.record.startedAt||"").localeCompare(String(a.record.updatedAt||a.record.startedAt||""));});
  }
  function recent(kid,days){
    const root=load(),byDay=root[kid]||{},out=[];
    Object.keys(byDay).sort().reverse().slice(0,Math.max(1,days||3)).forEach(function(d){Object.keys(byDay[d]||{}).forEach(function(id){if(byDay[d][id]&&byDay[d][id].completedAt)out.push(id);});});
    return out;
  }
  function resetDay(kid,day){const b=bucket(kid,day,false);if(!b.root[kid])return;delete b.root[kid][day];save(b.root);}
  function parseKind(kind){
    const p=String(kind||"").split(":");
    if(p[0]!=="quest_verify"||!p[1]||!/^\d{4}-\d{2}-\d{2}$/.test(p[2]||""))return null;
    return {questId:p[1],day:p[2]};
  }
  function applyVerificationRow(row){
    if(!row||!row.kid_id)return null;
    const info=parseKind(row.kind); if(!info)return null;
    const current=get(row.kid_id,info.day,info.questId);
    if(!current)return null;
    if(!row.answered_at){
      if(status(row.kid_id,info.day,info.questId)!=="awaiting_verification")requestVerification(row.kid_id,info.day,info.questId,row.id);
      return {kid:row.kid_id,questId:info.questId,day:info.day,state:"awaiting_verification"};
    }
    /* An answered request is only authoritative for the attempt that created it.
       After Papa sends a quest back, starting a new attempt clears verification;
       a later reconciliation must not let the old denied row put that fresh
       attempt back into redo. */
    if(!current.verification||!current.verification.requestId||String(current.verification.requestId)!==String(row.id))return null;
    const approved=/^Approved\b/i.test(String(row.answer||""));
    resolveVerification(row.kid_id,info.day,info.questId,approved,row.answer,row.answered_at,row.id);
    return {kid:row.kid_id,questId:info.questId,day:info.day,state:approved?"completed":"redo",approved:approved};
  }
  const api={get:get,status:status,done:done,start:start,pause:pause,resume:resume,setStep:setStep,complete:complete,requestVerification:requestVerification,resolveVerification:resolveVerification,cancel:cancel,list:list,states:states,active:active,recent:recent,resetDay:resetDay,parseVerificationKind:parseKind,applyVerificationRow:applyVerificationRow};
  if(typeof window!=="undefined")window.SQQuestProgress=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
