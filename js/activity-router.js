/* SQActivityRouter — application-level activity seam.
   Existing games still own their implementation. This registry gives Summer one
   stable way to route into them and to ask what surface is currently active. */
(function(){
  const adapters=new Map();
  let host=null,current=null;
  function register(id,adapter){if(!id||!adapter)return false;adapters.set(String(id),adapter);return true;}
  function unregister(id){adapters.delete(String(id));}
  function bindHost(next){host=next||null;return api;}
  function setCurrent(scope,id,meta){current={scope:String(scope||"activity"),id:String(id||""),meta:meta||{},startedAt:new Date().toISOString()};return current;}
  function clearCurrent(scope){if(!scope||!current||current.scope===scope)current=null;}
  function context(){
    const base=host&&typeof host.getSurface==="function"?host.getSurface():{};
    if(!current)return Object.assign({activity:null},base||{});
    const adapter=adapters.get(current.id);
    let extra={};
    if(adapter&&typeof adapter.getContext==="function")try{extra=adapter.getContext()||{};}catch(e){}
    return Object.assign({},base||{},{activity:Object.assign({},current,extra)});
  }
  function open(action){
    action=action||{};
    if(action.id&&adapters.has(String(action.id))){
      const a=adapters.get(String(action.id));
      if(typeof a.open==="function")return Promise.resolve(a.open(action));
    }
    if(!host||typeof host.openAction!=="function")return Promise.resolve({ok:false,reason:"no_host"});
    return Promise.resolve(host.openAction(action));
  }
  function help(){
    if(current){
      const a=adapters.get(current.id);
      if(a&&typeof a.getHelpContext==="function")try{return a.getHelpContext()||null;}catch(e){}
    }
    return host&&typeof host.getHelpContext==="function"?host.getHelpContext():null;
  }
  function backToQuests(){return host&&typeof host.backToQuests==="function"?host.backToQuests():{ok:false};}
  const api={register:register,unregister:unregister,bindHost:bindHost,setCurrent:setCurrent,clearCurrent:clearCurrent,context:context,open:open,help:help,backToQuests:backToQuests};
  if(typeof window!=="undefined")window.SQActivityRouter=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
