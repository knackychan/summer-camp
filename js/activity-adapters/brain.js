/* SQBrainActivityAdapter — first real Summer activity adapter.
   Reads semantic Brain Gym state through supplied host functions; it never
   reaches into Brain Gym DOM or mutates the round. */
(function(){
  function create(opts){
    opts=opts||{};
    function game(){return typeof opts.getGame==="function"?opts.getGame():null;}
    function state(){return typeof opts.getState==="function"?(opts.getState()||{}):{};}
    function context(){
      const g=game()||{},s=state(),items=Array.isArray(s.items)?s.items:[];
      return {
        title:g.title&&g.title[0]||"Brain Gym",
        phase:s.completed?"completed":s.idx>0?"active":"ready",
        index:Math.max(0,Number(s.idx)||0),
        total:items.length||Number(s.total)||0,
        objective:g.blurb&&g.blurb[0]||"Complete the Brain Gym round",
        skill:g.skill||"brain",
        hintLevel:Math.max(0,Number(s.hintLevel)||0)
      };
    }
    function getHelpContext(){
      const c=context(),n=c.total?Math.min(c.total,c.index+1):null;
      const intro=c.skill==="math"||c.skill==="money"
        ?["Work out only the current problem. Try a smaller step before guessing.","只看現在這一題。先拆成一個小步驟，再試答案。"]
        :c.skill==="memory"
          ?["Pause, look for a pattern, then recall one piece at a time.","先停一下找規律，再一小部分一小部分回想。"]
          :["Focus on the one thing the question is asking for, not everything on screen.","只注意題目要你找的那一件事，不用同時看全部。"];
      return {speech:intro[0]+(n?" You're on task "+n+" of "+c.total+".":""),speechZh:intro[1]+(n?" 現在是第 "+n+" 題，共 "+c.total+" 題。":""),activity:c};
    }
    return {getContext:context,getHelpContext:getHelpContext};
  }
  const api={create:create};
  if(typeof window!=="undefined")window.SQBrainActivityAdapter=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
