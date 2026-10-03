/* SQAgentTools — safe app capabilities exposed to Summer.
   No quest-complete or reward-mutation tool is registered here: the child/app
   owns completion, not the model. */
(function(){
  const registry=(typeof window!=="undefined"&&window.SQToolRegistry)?window.SQToolRegistry.create():null;
  let bound=false;
  function bind(host){
    if(!registry||bound)return registry;
    bound=true;
    registry.register("context.get","Read the current minimal child/session context.",function(){return host.context();});
    registry.register("quest.list_available","List only quests currently valid for this child.",function(args){return host.listQuests(args.preference||"surprise");});
    registry.register("quest.get_active","Read in-progress/waiting quest state without changing it.",function(){return host.activeQuest?host.activeQuest():null;});
    registry.register("quest.open","Open a valid quest card for the child.",function(args){return host.openQuest(args.questId);});
    registry.register("quest.resume","Resume an already-started quest.",function(args){return host.resumeQuest?host.resumeQuest(args.questId):host.openQuest(args.questId);});
    registry.register("activity.open","Open an allowed Summer Quest activity area.",function(args){return host.openActivity(args.area||args.id);});
    registry.register("activity.context","Read the current activity/surface context.",function(){return host.activityContext?host.activityContext():null;});
    registry.register("routine.open_today","Show the child today's routine view.",function(){return host.openToday();});
    registry.register("assistant.open","Open the persistent Summer companion.",function(){return host.openAssistant?host.openAssistant():{ok:false};});
    registry.register("reminder.request","Request a reminder through the platform bridge; unsupported platforms return supported:false.",function(args){return host.scheduleReminder(args);});
    return registry;
  }
  const api={registry:registry,bind:bind};
  if(typeof window!=="undefined")window.SQAgentTools=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
