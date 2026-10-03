/* SQAgentProvider — protected remote-provider contract.
   The browser/app never contains an OpenAI secret. If configured, it POSTs the
   structured Summer request to a same-origin/backend endpoint which owns model
   credentials, moderation and server-side policy. Invalid/slow responses fall
   back to SQSummerAgent's deterministic local provider. */
(function(){
  const ALLOWED_KINDS=["question","recommendation","companion","status"];
  const ALLOWED_EMOTIONS=["neutral","thinking","happy","excited","proud","encouraging","surprised","celebrate","sleepy","attention"];
  const ALLOWED_ANIMATIONS=["idle","blink","lean_in","small_hop","double_hop","thinking_loop","celebrate","wave"];
  const ALLOWED_ACTIONS=["resume_quest","quest_board","activity_help","today","close"];
  function cleanText(v,max){return typeof v==="string"?v.replace(/[<>]/g,"").replace(/[\u0000-\u001f\u007f]/g," ").slice(0,max||220):"";}
  function validate(raw,request){
    if(!raw||typeof raw!=="object")throw new Error("Summer provider returned no object");
    const ctx=(request&&request.agentContext)||(request&&request.context)||{};
    const validQuestIds=new Set(((ctx&&ctx.availableQuests)||[]).map(function(q){return q.id;}));
    const stage=String(request&&request.stage||"");
    const defaultKind=(stage==="companion"||stage==="activity_help")?"companion":(stage==="energy"||stage==="intent")?"question":"recommendation";
    const out={provider:"remote",kind:ALLOWED_KINDS.includes(raw.kind)?raw.kind:defaultKind,speech:cleanText(raw.speech,220),speechZh:cleanText(raw.speechZh,220)};
    if(raw.usage&&typeof raw.usage==="object"){const u=raw.usage;out.usage={provider:cleanText(u.provider,30),model:cleanText(u.model,80),profileId:cleanText(u.profileId,80)};if(Number.isFinite(Number(u.inputTokens)))out.usage.inputTokens=Number(u.inputTokens);if(Number.isFinite(Number(u.outputTokens)))out.usage.outputTokens=Number(u.outputTokens);if(Number.isFinite(Number(u.estimatedCostUsd)))out.usage.estimatedCostUsd=Number(u.estimatedCostUsd);}
    if(!out.speech||!out.speechZh)throw new Error("Summer provider requires bilingual speech");
    out.emotion=ALLOWED_EMOTIONS.includes(raw.emotion)?raw.emotion:"happy";
    out.animation=ALLOWED_ANIMATIONS.includes(raw.animation)?raw.animation:"small_hop";
    if(Array.isArray(raw.questIds))out.questIds=raw.questIds.map(String).filter(function(id){return validQuestIds.has(id);}).slice(0,4);
    if(Array.isArray(raw.actions))out.actions=raw.actions.map(String).filter(function(id){return ALLOWED_ACTIONS.includes(id);}).slice(0,4);
    if(stage==="energy"||stage==="intent"){
      const allowed=stage==="energy"?["low","medium","high","any"]:["quick","help","play","move","care","surprise"];
      out.questionId=stage;
      if(Array.isArray(raw.choices))out.choices=raw.choices.slice(0,6).map(function(c){return {id:cleanText(c&&c.id,40),icon:cleanText(c&&c.icon,8),label:Array.isArray(c&&c.label)?[cleanText(c.label[0],60),cleanText(c.label[1],60)]:[cleanText(c&&c.label,60),""]};}).filter(function(c){return allowed.includes(c.id);});
      if(!out.choices||!out.choices.length)throw new Error("Summer provider returned no valid choices");
    }
    return out;
  }
  function create(opts){
    opts=opts||{};const root=typeof window!=="undefined"?window:(typeof self!=="undefined"?self:null),endpoint=String(opts.endpoint||"").trim(),fetcher=opts.fetch||(root&&typeof root.fetch==="function"?root.fetch.bind(root):null),timeoutMs=Math.max(1500,Math.min(12000,Number(opts.timeoutMs)||6500));
    if(!endpoint||!fetcher)return null;
    return async function(request){
      const controller=typeof AbortController!=="undefined"?new AbortController():null;
      const timer=controller?setTimeout(function(){controller.abort();},timeoutMs):null;
      try{
        const res=await fetcher(endpoint,{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({version:1,stage:String(request.stage||"recommend"),task:request.task||undefined,context:request.agentContext||request.context||{},routing:{mode:"manual",profileId:cleanText(opts.profileId,80)||undefined}}),signal:controller?controller.signal:undefined});
        if(!res||!res.ok)throw new Error("Summer provider HTTP "+(res&&res.status));
        return validate(await res.json(),request);
      }finally{if(timer)clearTimeout(timer);}
    };
  }
  function fromConfig(cfg,fetcher){cfg=cfg||((typeof window!=="undefined"&&window.SQ_CONFIG)||{});const endpoint=cfg&&cfg.SUMMER_AGENT_ENDPOINT;return create({endpoint:endpoint,fetch:fetcher,timeoutMs:cfg&&cfg.SUMMER_AGENT_TIMEOUT_MS,profileId:cfg&&cfg.SUMMER_AGENT_PROFILE});}
  const api={create:create,fromConfig:fromConfig,validate:validate};
  if(typeof window!=="undefined")window.SQAgentProvider=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
