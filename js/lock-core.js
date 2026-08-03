/* SQLock — pure games-lock decision.
   Precedence: redo send-back > brain gate (games free all day otherwise, Papa,
   2026-08-03 — supersedes the activity-block rule in
   docs/plans/2026-07-26-homework-lock-drills-outing/03-activity-lock.md). */
(function(){
  const OPEN={locked:false,blockIdx:null,reason:null};
  function computeLock(ctx){
    const free=i=>!!(ctx.done&&ctx.done[i])||!!(ctx.passOk&&ctx.passOk(i));
    /* Papa send-back (design.md §8): an unticked redo block locks regardless of the clock */
    for(const k of Object.keys(ctx.redos||{})){
      if(!free(+k))return {locked:true,blockIdx:+k,reason:"redo"};
    }
    /* brainOpen defaults to true, so a caller that knows nothing about the gate
       behaves exactly as it did before the gate existed */
    const brainOpen=ctx.brainOpen===undefined?true:!!ctx.brainOpen;
    return brainOpen?OPEN:{locked:true,blockIdx:null,reason:"brain"};
  }
  const api={computeLock:computeLock};
  if(typeof window!=="undefined")window.SQLock=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
