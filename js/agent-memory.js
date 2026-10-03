/* SQAgentMemory — deliberately small, session-scoped assistant memory.
   Stores only interaction preferences and recent semantic events. No free-form
   child chat transcript is retained here. Session storage keeps this memory on
   the device and naturally clears with the browser/app session. */
(function(){
  const PREFIX="sq:agent-memory:v1:";
  const TTL_MS=12*60*60*1000;
  const MAX_EVENTS=12;
  const fallback=new Map();
  function storage(){
    try{if(typeof sessionStorage!=="undefined")return sessionStorage;}catch(e){}
    return {getItem:function(k){return fallback.has(k)?fallback.get(k):null;},setItem:function(k,v){fallback.set(k,String(v));},removeItem:function(k){fallback.delete(k);}};
  }
  function key(kid){return PREFIX+String(kid||"guest");}
  function fresh(kid){return {version:1,kid:String(kid||"guest"),updatedAt:new Date().toISOString(),energy:null,preference:null,lastAssistantEvent:null,helpCounts:{},events:[]};}
  function load(kid){
    const s=storage();let v=null;
    try{v=JSON.parse(s.getItem(key(kid))||"null");}catch(e){}
    if(!v||typeof v!=="object")return fresh(kid);
    const age=Date.now()-Date.parse(v.updatedAt||0);
    if(!Number.isFinite(age)||age>TTL_MS){s.removeItem(key(kid));return fresh(kid);}
    v.energy=["low","medium","high","any"].includes(v.energy)?v.energy:null;
    v.preference=["quick","help","play","move","care","surprise"].includes(v.preference)?v.preference:null;
    v.helpCounts=v.helpCounts&&typeof v.helpCounts==="object"?v.helpCounts:{};
    v.events=Array.isArray(v.events)?v.events.slice(-MAX_EVENTS):[];
    return v;
  }
  function save(kid,v){v=Object.assign(fresh(kid),v||{});v.updatedAt=new Date().toISOString();v.events=Array.isArray(v.events)?v.events.slice(-MAX_EVENTS):[];try{storage().setItem(key(kid),JSON.stringify(v));}catch(e){}return v;}
  function setPreference(kid,kind,value){const v=load(kid);if(kind==="energy")v.energy=value;if(kind==="preference")v.preference=value;return save(kid,v);}
  function remember(kid,type,payload){const v=load(kid);v.events.push({type:String(type||"event"),at:new Date().toISOString(),data:sanitize(payload)});v.lastAssistantEvent=String(type||"event");return save(kid,v);}
  function bumpHelp(kid,activityId){const v=load(kid),id=String(activityId||"general");v.helpCounts[id]=Math.min(9,(Number(v.helpCounts[id])||0)+1);save(kid,v);return v.helpCounts[id];}
  function resetHelp(kid,activityId){const v=load(kid),id=String(activityId||"general");delete v.helpCounts[id];return save(kid,v);}
  function clear(kid){try{storage().removeItem(key(kid));}catch(e){}}
  function sanitize(value,depth){
    depth=depth||0;if(depth>2)return undefined;
    if(value==null||typeof value==="number"||typeof value==="boolean")return value;
    if(typeof value==="string")return value.slice(0,160);
    if(Array.isArray(value))return value.slice(0,8).map(function(x){return sanitize(x,depth+1);}).filter(function(x){return x!==undefined;});
    if(typeof value==="object"){
      const out={};Object.keys(value).slice(0,10).forEach(function(k){if(/name|address|email|phone|audio|photo|body|transcript/i.test(k))return;const x=sanitize(value[k],depth+1);if(x!==undefined)out[k]=x;});return out;
    }
  }
  const api={load:load,setPreference:setPreference,remember:remember,bumpHelp:bumpHelp,resetHelp:resetHelp,clear:clear};
  if(typeof window!=="undefined")window.SQAgentMemory=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
