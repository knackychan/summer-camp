/* SQLock — pure games-lock decision.
   Two gates lock games: the Brain Gym trio, then the daily points gate
   (docs/plans/2026-10-08-games-gate-ai-guide/, CLAUDE.md exception 5).
   My Day/redo blocks are guidelines only (Papa, 2026-10-03 — supersedes the
   redo-lock rule this file had, which itself superseded the activity-block rule
   in docs/plans/2026-07-26-homework-lock-drills-outing/03-activity-lock.md). */
(function(){
  const OPEN={locked:false,blockIdx:null,reason:null};
  function computeLock(ctx){
    /* both default to true, so a caller that knows nothing about a gate
       behaves exactly as it did before that gate existed. Brain Gym comes
       first: it is the shortest way to points (30 a day). */
    const brainOpen=ctx.brainOpen===undefined?true:!!ctx.brainOpen;
    if(!brainOpen)return {locked:true,blockIdx:null,reason:"brain"};
    const pointsOpen=ctx.pointsOpen===undefined?true:!!ctx.pointsOpen;
    return pointsOpen?OPEN:{locked:true,blockIdx:null,reason:"points"};
  }
  const api={computeLock:computeLock};
  if(typeof window!=="undefined")window.SQLock=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
