/* SQToolRegistry — tiny MCP-like internal capability registry.
   Agent providers receive named, typed-ish app capabilities instead of direct
   access to DOM/state. Completion/mutation tools are intentionally opt-in. */
(function(){
  function create(){
    const tools={};
    return {
      register:function(name,description,handler){
        if(!name||typeof handler!=="function")throw new Error("tool requires name + handler");
        tools[name]={name:name,description:description||"",handler:handler};
        return this;
      },
      has:function(name){return !!tools[name];},
      list:function(){return Object.keys(tools).map(function(k){return {name:k,description:tools[k].description};});},
      call:function(name,args){
        const t=tools[name];
        if(!t)return Promise.reject(new Error("Unknown Summer Quest tool: "+name));
        return Promise.resolve().then(function(){return t.handler(args||{});});
      }
    };
  }
  const api={create:create};
  if(typeof window!=="undefined")window.SQToolRegistry=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
