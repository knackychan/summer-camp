/* SQEventBus — tiny synchronous app event bus used by the quest/agent layer.
   The bus carries semantic events, never raw DOM events. Event history is kept
   in memory only so an Android/native shell can replace the transport later. */
(function(){
  const listeners=new Map();
  const recent=[];
  const MAX_RECENT=40;
  function nowIso(){return new Date().toISOString();}
  function on(type,fn){
    if(!type||typeof fn!=="function")return function(){};
    const key=String(type),set=listeners.get(key)||new Set();
    set.add(fn);listeners.set(key,set);
    return function(){set.delete(fn);if(!set.size)listeners.delete(key);};
  }
  function emit(type,payload){
    if(!type)return null;
    const evt={type:String(type),at:nowIso(),payload:payload&&typeof payload==="object"?payload:{}};
    recent.push(evt);while(recent.length>MAX_RECENT)recent.shift();
    const call=function(set){if(!set)return;Array.from(set).forEach(function(fn){try{fn(evt);}catch(e){setTimeout(function(){throw e;},0);}});};
    call(listeners.get(evt.type));call(listeners.get("*"));
    return evt;
  }
  function history(limit){return recent.slice(-Math.max(1,Math.min(MAX_RECENT,Number(limit)||10))).map(function(e){return {type:e.type,at:e.at,payload:Object.assign({},e.payload)};});}
  function clear(){recent.length=0;listeners.clear();}
  const api={on:on,emit:emit,history:history,clear:clear};
  if(typeof window!=="undefined")window.SQEvents=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
