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
  /* Ripple edit: moving a block moves every later block with it. Running late
     shifts the rest of the day, and because the whole tail travels together two
     blocks can never collide — which is why there is no overlap handling here
     or anywhere else. min/max are how far the group may travel before it would
     cross the block above it or run off the end of the day. */
  function ripple(day,overrides,i){
    const start=effMins(day,overrides,i);
    if(start==null)return null;
    const timed=timedOrder(day,overrides);
    const group=timed.filter(function(x){return x.t>=start;});
    const before=timed.filter(function(x){return x.t<start;});
    const prev=before.length?before[before.length-1].t:null;
    return {
      start:start,group:group,
      min:(prev==null?0:prev+5)-start,
      max:(23*60+55)-group[group.length-1].t
    };
  }
  function clampDelta(rip,delta){
    return Math.max(rip.min,Math.min(rip.max,delta));
  }
  function resolveOverrides(raw,kid,day){
    if(!raw)return {};
    return Object.assign({},cleanTimeMap(day,raw.all||{}),cleanTimeMap(day,(kid&&raw[kid])||{}));
  }
  function cleanTimeMap(day,map){
    if(!map||typeof map!=="object")return {};
    const out={}, rawCounts={};
    Object.keys(map).forEach(function(k){
      const mins=parseMins(map[k]);
      if(mins!=null)rawCounts[mins]=(rawCounts[mins]||0)+1;
    });
    Object.keys(map).forEach(function(k){
      const i=+k, mins=parseMins(map[k]);
      if(!Number.isInteger(i)||mins==null||mins<0||mins>23*60+55)return;
      if(day&&!day[i])return;
      const base=day&&day[i]&&parseMins(day[i].t0===undefined?day[i].t:day[i].t0);
      if(day&&base==null)return;
      if(base!=null&&mins===base)return;
      out[i]=String(map[k]);
    });
    const keys=Object.keys(out);
    const hasDenseRaw=Object.keys(rawCounts).some(function(mins){return rawCounts[mins]>=3;});
    if(keys.length<3&&!hasDenseRaw)return out;
    const counts={};
    keys.forEach(function(k){
      const mins=parseMins(out[k]);
      counts[mins]=(counts[mins]||0)+1;
    });
    Object.keys(counts).forEach(function(mins){
      if(counts[mins]>=3||rawCounts[mins]>=3){
        keys.forEach(function(k){if(parseMins(out[k])===+mins)delete out[k];});
      }
    });
    return out;
  }
  function cleanReplacementMap(day,kids,map){
    const clean={};
    Object.keys(kids||{}).forEach(function(kid){
      const bucket=map&&map[kid];
      if(!bucket||typeof bucket!=="object")return;
      const out={};
      Object.keys(bucket).forEach(function(slot){
        const i=+slot, src=+bucket[slot];
        if(Number.isInteger(i)&&Number.isInteger(src)&&day[i]&&day[src]&&i!==src)out[i]=src;
      });
      if(Object.keys(out).length)clean[kid]=out;
    });
    return clean;
  }
  /* A slot with no replacement must stay unreplaced. +null is 0 and 0 is a real
     block ("Wake up"), so coercing the missing case silently rewrote the whole
     schedule to the first block of the day. Read the entry, then coerce. */
  function replacementSource(day,map,kid,i){
    const bucket=(map||{})[kid];
    if(!bucket||bucket[i]==null)return null;
    const v=+bucket[i];
    return Number.isInteger(v)&&day[v]?v:null;
  }
  function repairReplacementMap(day,kids,map){
    const clean=cleanReplacementMap(day,kids,map);
    if(map&&map._v===2){
      clean._v=2;
      return clean;
    }
    return {_v:2};
  }
  /* Two ways a start time moves. day_overrides = "today only" (above).
     The template = "every day from now on", stored as one JSON map in
     family_settings.day_template_times and stamped onto DAY itself, so every
     consumer — lock math, My Day, the admin board — reads one set of times and
     nobody needs a third precedence rule. b.t0 keeps the day-data.js value so a
     template entry can always be cleared back to it. Idempotent. */
  function parseTemplate(json){
    try{const m=JSON.parse(json||"{}");return m&&typeof m==="object"?m:{};}
    catch(e){return {};}
  }
  function applyTemplate(day,map){
    map=cleanTimeMap(day,map);
    day.forEach(function(b,i){
      if(b.t0===undefined)b.t0=b.t;
      b.t=(map&&map[i])||b.t0;
    });
    return day;
  }
  const api={parseMins:parseMins,effMins:effMins,timedOrder:timedOrder,timelineInfo:timelineInfo,neededBefore:neededBefore,displayOrder:displayOrder,resolveOverrides:resolveOverrides,cleanTimeMap:cleanTimeMap,cleanReplacementMap:cleanReplacementMap,repairReplacementMap:repairReplacementMap,replacementSource:replacementSource,parseTemplate:parseTemplate,applyTemplate:applyTemplate,ripple:ripple,clampDelta:clampDelta};
  if(typeof window!=="undefined")window.SQTime=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
