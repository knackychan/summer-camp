/* SQLock — pure games-lock decision. */
(function(){
  const SQT=typeof window!=="undefined"?window.SQTime:require("./time-core.js");
  function isScreenBlock(b){return String((b&&b.title)||"").includes("Screen");}
  function computeLock(ctx){
    const past=SQT.timedOrder(ctx.day,ctx.overrides||{}).filter(function(x){return x.t<=ctx.now;});
    const free=function(i){return !!(ctx.done&&ctx.done[i])||!!(ctx.passOk&&ctx.passOk(i));};
    const verdict=function(i){return free(i)?{locked:false,blockIdx:null}:{locked:true,blockIdx:i};};
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
