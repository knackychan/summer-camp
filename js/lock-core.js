/* SQLock — pure games-lock decision.
   Only the brain gate locks games now (Papa, 2026-10-03 — My Day/redo blocks
   are guidelines only, no longer a games gate; supersedes the redo-lock rule
   this file had, which itself superseded the activity-block rule in
   docs/plans/2026-07-26-homework-lock-drills-outing/03-activity-lock.md). */
(function(){
  const OPEN={locked:false,blockIdx:null,reason:null};
  function computeLock(ctx){
    /* brainOpen defaults to true, so a caller that knows nothing about the gate
       behaves exactly as it did before the gate existed */
    const brainOpen=ctx.brainOpen===undefined?true:!!ctx.brainOpen;
    return brainOpen?OPEN:{locked:true,blockIdx:null,reason:"brain"};
  }
  const api={computeLock:computeLock};
  if(typeof window!=="undefined")window.SQLock=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
