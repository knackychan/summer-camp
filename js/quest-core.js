/* SQQuestCore — deterministic eligibility + ranking.
   Invalid/locked actions are removed before an agent ever sees the candidate set. */
(function(){
  function isoDateUtc(s){
    const p=String(s||"").split("-").map(Number);
    if(p.length!==3||p.some(Number.isNaN))return null;
    return Date.UTC(p[0],p[1]-1,p[2]);
  }
  function daysBetween(a,b){const aa=isoDateUtc(a),bb=isoDateUtc(b);return aa==null||bb==null?0:Math.floor((aa-bb)/86400000);}
  function weekday(day){
    const ms=isoDateUtc(day); if(ms==null)return 0; return new Date(ms).getUTCDay();
  }
  function scheduledToday(q,ctx){
    if(q.enabled===false)return false;
    if(Array.isArray(q.allowedKids)&&q.allowedKids.length&&q.allowedKids.indexOf(ctx.kid)<0)return false;
    const f=q.frequency||{type:"daily"};
    if(f.type==="weekdays")return [1,2,3,4,5].indexOf(weekday(ctx.day))>=0;
    if(f.type==="weekends")return [0,6].indexOf(weekday(ctx.day))>=0;
    if(f.type==="days")return Array.isArray(f.days)?f.days.map(Number).indexOf(weekday(ctx.day))>=0:true;
    if(f.type==="interval_days"){
      const every=Math.max(1,Number(f.every)||1),anchor=f.anchor||ctx.day;
      const d=daysBetween(ctx.day,anchor); return d>=0&&d%every===0;
    }
    return true;
  }
  function inWindow(q,mins){
    if(typeof q.after==="number"&&mins<q.after)return false;
    if(typeof q.before==="number"&&mins>q.before)return false;
    return true;
  }
  function energyScore(want,has){
    if(!want||want==="any")return 0;
    if(want===has)return 30;
    if(want==="low"&&has==="high")return -42;
    if(want==="high"&&has==="low")return -12;
    return -4;
  }
  function categoryBoost(pref,cat){
    if(pref==="help")return (cat==="help"||cat==="family")?78:-18;
    if(pref==="care")return cat==="care"?86:-22;
    if(pref==="move")return cat==="move"?92:-26;
    if(pref==="play")return (cat==="play"||cat==="learn")?74:-14;
    return 0;
  }
  function hash(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function score(q,ctx){
    let s=Number(q.priority)||0;
    if(ctx.preference==="quick")s+=q.duration<=5?100:q.duration<=10?70:q.duration<=15?15:-35;
    else s+=categoryBoost(ctx.preference,q.category);
    s+=energyScore(ctx.energy,q.energy);
    if(q.required){
      s+=16;
      if(q.before&&q.before-ctx.minutes<=90)s+=55;
    }
    if(ctx.preference==="surprise"||!ctx.preference)s+=(hash(ctx.day+ctx.kid+q.id)%39);
    if(Array.isArray(ctx.inProgress)&&ctx.inProgress.indexOf(q.id)>=0)s+=125;
    if(Array.isArray(ctx.redo)&&ctx.redo.indexOf(q.id)>=0)s+=145;
    if(Array.isArray(ctx.recent)&&ctx.recent.indexOf(q.id)>=0)s-=30;
    return s;
  }
  function baseEligible(q,ctx){
    if(!scheduledToday(q,ctx))return false;
    if(q.oncePerDay&&(ctx.completed||[]).indexOf(q.id)>=0)return false;
    if((ctx.waiting||[]).indexOf(q.id)>=0)return false;
    if(q.minAge&&ctx.age<q.minAge)return false;
    if(q.maxAge&&ctx.age>q.maxAge)return false;
    return true;
  }
  function listAvailable(catalog,ctx){
    return (catalog||[]).filter(function(q){return baseEligible(q,ctx)&&inWindow(q,ctx.minutes);})
      .map(function(q){return {quest:q,score:score(q,ctx)};})
      .sort(function(a,b){return b.score-a.score||a.quest.duration-b.quest.duration||a.quest.id.localeCompare(b.quest.id);})
      .map(function(x){return x.quest;});
  }
  function listUpcoming(catalog,ctx,horizon){
    horizon=Number(horizon)||360;
    return (catalog||[]).filter(function(q){
      if(!baseEligible(q,ctx))return false;
      return typeof q.after==="number"&&q.after>ctx.minutes&&q.after-ctx.minutes<=horizon;
    }).sort(function(a,b){return a.after-b.after||b.priority-a.priority;});
  }
  function dailyRequired(catalog,ctx){return (catalog||[]).filter(function(q){return q.required&&scheduledToday(q,ctx);});}
  function timeBucket(mins){
    if(mins<10*60)return "morning";
    if(mins<13*60)return "midday";
    if(mins<17*60)return "afternoon";
    if(mins<19*60+30)return "evening";
    return "night";
  }
  const api={listAvailable:listAvailable,listUpcoming:listUpcoming,dailyRequired:dailyRequired,scheduledToday:scheduledToday,inWindow:inWindow,timeBucket:timeBucket,score:score};
  if(typeof window!=="undefined")window.SQQuestCore=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
