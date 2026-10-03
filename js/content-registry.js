/* SQContentRegistry — one normalized catalog over the real Summer Quest runtime.
   It does not own game/content implementations. The root app binds its existing
   game, book, learning, music and activity sources here so future surfaces
   (including the planned 3D world) can discover and open content without
   creating another navigation shell. */
(function(){
  let host=null;

  function cloneEntry(entry){
    return entry ? {
      id:String(entry.id||""),
      kind:String(entry.kind||"activity"),
      zone:String(entry.zone||"world"),
      icon:String(entry.icon||"✨"),
      title:Array.isArray(entry.title)?entry.title.slice(0,2):[String(entry.title||""),""],
      blurb:Array.isArray(entry.blurb)?entry.blurb.slice(0,2):[String(entry.blurb||""),""],
      available:entry.available!==false,
      reason:entry.reason||null,
      capabilities:Array.isArray(entry.capabilities)?entry.capabilities.slice():[],
      meta:entry.meta&&typeof entry.meta==="object"?Object.assign({},entry.meta):{}
    } : null;
  }

  function bind(next){
    host=next&&typeof next==="object"?next:null;
    return api;
  }

  function list(options){
    options=options||{};
    if(!host||typeof host.list!=="function")return [];
    let entries=[];
    try{entries=host.list(options)||[];}catch(e){entries=[];}
    return entries.map(cloneEntry).filter(function(entry){
      if(!entry||!entry.id)return false;
      if(options.kind&&entry.kind!==options.kind)return false;
      if(options.zone&&entry.zone!==options.zone)return false;
      if(options.availableOnly&&entry.available===false)return false;
      return true;
    });
  }

  function get(id){
    const key=String(id||"");
    return list().find(function(entry){return entry.id===key;})||null;
  }

  async function ready(){
    if(host&&typeof host.ready==="function")await host.ready();
    return list();
  }

  async function open(id,options){
    if(!host||typeof host.open!=="function")return {ok:false,reason:"registry_unbound"};
    try{
      const launchHost=host,context=typeof host.context==="function"?host.context():null;
      await ready();
      if(host!==launchHost||(typeof host.context==="function"&&host.context()!==context))return {ok:false,reason:"launch_cancelled"};
      const entry=get(id);
      if(!entry)return {ok:false,reason:"content_not_found"};
      /* The runtime evaluates contextual access (including directed learning)
         and supplies the result. Generic hosts retain the availability guard. */
      if(entry.available===false&&typeof host.access!=="function")return {ok:false,reason:entry.reason||"not_available"};
      if(typeof host.access==="function"){
        const access=host.access(entry,options||{});
        if(!access.ok)return access;
      }
      const result=await host.open(entry,options||{});
      return result&&typeof result.ok==="boolean"?result:{ok:false,reason:"launch_incomplete"};
    }catch(error){return {ok:false,reason:"launch_failed",error:String(error&&error.message||error)};}
  }

  function zones(){
    const seen=new Map();
    list().forEach(function(entry){
      if(!seen.has(entry.zone))seen.set(entry.zone,{id:entry.zone,count:0});
      seen.get(entry.zone).count++;
    });
    return Array.from(seen.values());
  }

  const api={bind:bind,list:list,get:get,open:open,ready:ready,zones:zones};
  if(typeof window!=="undefined")window.SQContentRegistry=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
