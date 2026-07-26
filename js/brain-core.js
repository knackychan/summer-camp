/* SQBrainCore — pure Brain Gym logic (design.md §5, §6).
   No DOM, no globals. Every function takes what it needs as an argument. */
(function(){
  const D=typeof window!=="undefined"?window.SQBrainData:require("./brain-data.js");

  /* same hash as drills.js / mission seeding — keep them identical on purpose */
  function dseed(str){let h=7;for(const c of str)h=(h*31+c.charCodeAt(0))>>>0;return h;}

  /* small deterministic PRNG so tests and every tablet agree */
  function mulberry32(seed){
    let a=seed>>>0;
    return function(){
      a=(a+0x6D2B79F5)>>>0;
      let t=a;
      t=Math.imul(t^(t>>>15),t|1);
      t=(t^(t+Math.imul(t^(t>>>7),t|61)))^t;
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }

  function tierFor(kid,settings){
    const raw=settings&&settings["brain_tier_"+kid];
    if(raw&&D.TIERS.indexOf(raw)>=0)return raw;
    const def=D.TIER_DEFAULT[kid];
    return def?def:"mid";
  }

  const api={dseed:dseed,mulberry32:mulberry32,tierFor:tierFor};
  if(typeof window!=="undefined")window.SQBrainCore=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
