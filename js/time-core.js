/* SQTime — pure schedule time math. No DOM, no globals. */
(function(){
  function parseMins(t){
    if(t==null||!String(t).includes(":"))return null;
    const parts=String(t).split(":").map(Number);
    if(Number.isNaN(parts[0])||Number.isNaN(parts[1]))return null;
    return parts[0]*60+parts[1];
  }
  function effMins(day,overrides,i){
    const o=overrides&&overrides[i];
    return parseMins(o!=null?o:day[i]&&day[i].t);
  }
  function timedOrder(day,overrides){
    return day.map(function(b,i){return {i:i,t:effMins(day,overrides,i)};})
      .filter(function(x){return x.t!=null;})
      .sort(function(a,b){return a.t-b.t||a.i-b.i;});
  }
  function timelineInfo(day,overrides,now){
    const timed=timedOrder(day,overrides);
    let current=timed.length?timed[0].i:0, next=null;
    for(const x of timed){
      if(x.t<=now)current=x.i;
      else{next=x.i;break;}
    }
    return {now:now,current:current,next:next};
  }
  function neededBefore(day,overrides,i){
    const st=effMins(day,overrides,i);
    if(st==null)return [];
    return timedOrder(day,overrides).filter(function(x){return x.i!==i&&x.t<st;}).map(function(x){return x.i;});
  }
  function displayOrder(day,overrides){
    const timed=timedOrder(day,overrides).map(function(x){return x.i;});
    const untimed=day.map(function(b,i){return i;}).filter(function(i){return effMins(day,overrides,i)==null;});
    return timed.concat(untimed);
  }
  function resolveOverrides(raw,kid){
    if(!raw)return {};
    return Object.assign({},raw.all||{},(kid&&raw[kid])||{});
  }
  const api={parseMins:parseMins,effMins:effMins,timedOrder:timedOrder,timelineInfo:timelineInfo,neededBefore:neededBefore,displayOrder:displayOrder,resolveOverrides:resolveOverrides};
  if(typeof window!=="undefined")window.SQTime=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
