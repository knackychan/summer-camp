/* SQLock — pure games-lock decision.
   - a redo-flagged block (Papa send-back) that is unticked/unpassed locks first, regardless of time */
(function(){
  const SQT=typeof window!=="undefined"?window.SQTime:require("./time-core.js");
  function isScreenBlock(b){return String((b&&b.title)||"").includes("Screen");}
  function computeLock(ctx){
    const free=i=>!!(ctx.done&&ctx.done[i])||!!(ctx.passOk&&ctx.passOk(i));
    const verdict=i=>free(i)?{locked:false,blockIdx:null}:{locked:true,blockIdx:i};
    /* Papa send-back (design.md §8): an unticked redo block locks regardless of the clock */
    for(const k of Object.keys(ctx.redos||{})){
      if(!free(+k))return {locked:true,blockIdx:+k};
    }
    const past=SQT.timedOrder(ctx.day,ctx.overrides||{}).filter(x=>x.t<=ctx.now);
    if(!past.length)return {locked:false,blockIdx:null};
    const cur=past[past.length-1];
    if(!isScreenBlock(ctx.day[cur.i]))return verdict(cur.i);
    for(let n=past.length-2;n>=0;n--){
      if(!isScreenBlock(ctx.day[past[n].i]))return verdict(past[n].i);
    }
    return {locked:false,blockIdx:null};
  }
  const api={computeLock:computeLock,isScreenBlock:isScreenBlock};
  if(typeof window!=="undefined")window.SQLock=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
