/* SQSummerAgent — structured provider facade.
   Local mode is deterministic and always available. A future remote provider
   may improve phrasing/choice, but receives only pre-filtered quest ids/context. */
(function(){
  let remote=null;
  const ENERGY_CHOICES=[
    {id:"low",icon:"😴",label:["Easy please","輕鬆一點"]},
    {id:"medium",icon:"🙂",label:["I'm okay","我還不錯"]},
    {id:"high",icon:"🤩",label:["Lots of energy","很有精神"]},
    {id:"any",icon:"✨",label:["You choose","你幫我選"]}
  ];
  const INTENT_CHOICES=[
    {id:"quick",icon:"⚡",label:["Something quick","快一點"]},
    {id:"help",icon:"🏠",label:["Help at home","幫忙家裡"]},
    {id:"play",icon:"🎮",label:["Play & learn","玩和學"]},
    {id:"move",icon:"🤸",label:["Move around","動一動"]},
    {id:"care",icon:"🌱",label:["Take care","照顧一下"]},
    {id:"surprise",icon:"🎲",label:["Surprise me","給我驚喜"]}
  ];
  function companion(input){
    const c=input.context||{},q=c.quest||null,state=c.state||"general";
    if(state==="awaiting_verification"&&q)return {provider:"local",kind:"companion",speech:"You finished it. Papa just needs to check it.",speechZh:"你已經完成了，現在等爸爸確認。",emotion:"proud",animation:"small_hop",actions:["quest_board","close"]};
    if(state==="redo"&&q)return {provider:"local",kind:"companion",speech:"Papa wants one more try. We can do it together.",speechZh:"爸爸希望再試一次，我可以陪你一起做。",emotion:"encouraging",animation:"lean_in",actions:["resume_quest","quest_board"]};
    if((state==="in_progress"||state==="paused")&&q)return {provider:"local",kind:"companion",speech:"Your quest is still here. Want to keep going?",speechZh:"你的任務還在，要繼續嗎？",emotion:"happy",animation:"small_hop",actions:["resume_quest","quest_board"]};
    if(c.activity)return {provider:"local",kind:"companion",speech:"I'm right here if you need help with this activity.",speechZh:"做這個活動需要幫忙時，我就在這裡。",emotion:"happy",animation:"lean_in",actions:["activity_help","quest_board","close"]};
    return {provider:"local",kind:"companion",speech:"Want me to find something that fits right now?",speechZh:"要我幫你找一個現在適合的任務嗎？",emotion:"happy",animation:"small_hop",actions:["quest_board","today","close"]};
  }
  function local(input){
    const stage=input.stage||"recommend",bucket=input.timeBucket||"afternoon",q=input.quests||[];
    if(stage==="companion")return Promise.resolve(companion(input));
    if(stage==="energy")return Promise.resolve({provider:"local",kind:"question",questionId:"energy",speech:"How much energy do you have?",speechZh:"你現在有多少精神？",emotion:"thinking",animation:"lean_in",choices:ENERGY_CHOICES});
    if(stage==="intent")return Promise.resolve({provider:"local",kind:"question",questionId:"intent",speech:"What sounds good right now?",speechZh:"你現在想做哪一種？",emotion:"happy",animation:"small_hop",choices:INTENT_CHOICES});
    if(stage==="activity_help"){const h=input.localHelp||{};return Promise.resolve({provider:"local",kind:"companion",speech:h.speech||"Try the next visible step first. If that does not work, ask me again.",speechZh:h.speechZh||"先試試畫面上的下一步。如果還是不行，再來問我。",emotion:"encouraging",animation:"lean_in",actions:["close"]});}
    if(stage==="quest_started")return Promise.resolve({provider:"local",kind:"status",speech:"Quest started! I'll stay nearby if you need me.",speechZh:"任務開始！需要我的時候我會在旁邊。",emotion:"excited",animation:"small_hop"});
    if(stage==="verification_requested")return Promise.resolve({provider:"local",kind:"status",speech:"Nice work. I sent it to Papa to check.",speechZh:"做得好，我已經送給爸爸確認了。",emotion:"proud",animation:"small_hop"});
    /* Home-help guide (games-gate-ai-guide D5): tap-only questions and picks.
       The caller passes the choices and the already-ranked picks; this only words them. */
    if(stage==="help_done")return Promise.resolve({provider:"local",kind:"question",questionId:"help_done",speech:"What's already done today?",speechZh:"今天已經做了什麼？",emotion:"thinking",animation:"lean_in",choices:input.choices||[]});
    if(stage==="help_time")return Promise.resolve({provider:"local",kind:"question",questionId:"help_time",speech:"How much time do you have now?",speechZh:"你現在有多少時間？",emotion:"happy",animation:"small_hop",choices:input.choices||[]});
    if(stage==="help_pick"){
      const picks=input.picks||[];
      return Promise.resolve(picks.length
        ?{provider:"local",kind:"recommendation",questionId:"help_pick",speech:"These fit right now. Pick one!",speechZh:"這些現在很適合，選一個吧！",emotion:"happy",animation:"small_hop",picks:picks}
        :{provider:"local",kind:"recommendation",questionId:"help_pick",speech:"Rest time — helping starts again tomorrow.",speechZh:"休息時間，明天再來幫忙。",emotion:"sleepy",animation:"idle",picks:[]});
    }
    if(stage==="quest_completed")return Promise.resolve({provider:"local",kind:"status",speech:"Quest complete!",speechZh:"任務完成！",emotion:"celebrate",animation:"double_hop"});
    const lines={
      morning:["I found a few good morning quests.","我找到幾個適合早上的任務。"],
      midday:["Here are a few things that fit now.","這幾個現在很適合。"],
      afternoon:["I found some good choices for right now.","我找到幾個現在很適合的選擇。"],
      evening:["Let's pick something that fits the evening.","來選一個適合傍晚的任務。"],
      night:["I found a couple of calm things for tonight.","我找到幾個適合今晚的輕鬆任務。"]
    };
    const speech=lines[bucket]||lines.afternoon;
    return Promise.resolve({provider:"local",kind:"recommendation",speech:speech[0],speechZh:speech[1],emotion:"happy",animation:"small_hop",questIds:q.slice(0,input.maxSuggestions||3).map(function(x){return x.id;})});
  }
  function interact(input){
    /* help_* stages never reach the summer remote; the guide's AI is its own provider (slice 06) */
    if(remote&&!/^help_/.test(input.stage||"")){
      return Promise.resolve().then(function(){return remote(input);}).then(function(v){return v&&typeof v==="object"?v:local(input);}).catch(function(){return local(input);});
    }
    return local(input);
  }
  function recommend(input){return interact(Object.assign({},input,{stage:"recommend"}));}
  function setRemoteProvider(fn){remote=typeof fn==="function"?fn:null;}
  const api={interact:interact,recommend:recommend,setRemoteProvider:setRemoteProvider,ENERGY_CHOICES:ENERGY_CHOICES,INTENT_CHOICES:INTENT_CHOICES};
  if(typeof window!=="undefined")window.SQSummerAgent=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
