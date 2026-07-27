/* SQLock — pure games-lock decision.
   Precedence (brain-gym design.md §6): redo send-back > current activity > brain gate.
   A redo and a live activity are time-sensitive; the daily brain set can be done at
   any hour, so it never masks a more urgent reason.
   - a redo-flagged block (Papa send-back) that is unticked/unpassed locks first, regardless of time */
(function(){
  const SQT=typeof window!=="undefined"?window.SQTime:require("./time-core.js");
  function isScreenBlock(b){return String((b&&b.title)||"").includes("Screen");}
  const OPEN={locked:false,blockIdx:null,reason:null};
  function computeLock(ctx){
    const free=i=>!!(ctx.done&&ctx.done[i])||!!(ctx.passOk&&ctx.passOk(i));
    /* brainOpen defaults to true, so a caller that knows nothing about the gate
       behaves exactly as it did before the gate existed */
    const brainOpen=ctx.brainOpen===undefined?true:!!ctx.brainOpen;
    const gate=()=>brainOpen?OPEN:{locked:true,blockIdx:null,reason:"brain"};
    const verdict=i=>free(i)?gate():{locked:true,blockIdx:i,reason:"activity"};
    /* Papa send-back (design.md §8): an unticked redo block locks regardless of the clock */
    for(const k of Object.keys(ctx.redos||{})){
      if(!free(+k))return {locked:true,blockIdx:+k,reason:"redo"};
    }
    const past=SQT.timedOrder(ctx.day,ctx.overrides||{}).filter(x=>x.t<=ctx.now);
    if(!past.length)return gate();
    const cur=past[past.length-1];
    if(!isScreenBlock(ctx.day[cur.i]))return verdict(cur.i);
    for(let n=past.length-2;n>=0;n--){
      if(!isScreenBlock(ctx.day[past[n].i]))return verdict(past[n].i);
    }
    return gate();
  }
  const api={computeLock:computeLock,isScreenBlock:isScreenBlock};
  if(typeof window!=="undefined")window.SQLock=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
