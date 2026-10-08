/* SQGamesGate — pure daily points gate (docs/plans/2026-10-08-games-gate-ai-guide/
   design.md D1, D2, D4, D7). No DOM, no storage, no clock: callers pass today's
   Taipei day and what they know. Shared by index.html, admin.html and tests. */
(function(){
  const KIDS=["luis","lili","lucien"];
  const DEFAULTS={
    enabled:false,
    threshold:{luis:50,lili:50,lucien:40},
    rerollsPerSlot:3,
    ai:{enabled:false,callsPerKidPerDay:8,familyCallsPerDay:24,dailyUsdCap:0.05,monthlyUsdCap:1}
  };
  /* a claim counts while it is waiting or confirmed; denied and merely
     started attempts never do (D1) */
  const COUNTED={queued:true,pending:true,confirmed:true};
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function step5(v,fallback){
    const n=Number(v);
    if(v===null||v===""||!Number.isFinite(n))return fallback;
    return Math.max(0,Math.min(300,Math.round(n/5)*5));
  }
  function capNumber(v,fallback){const n=Number(v);return v!==null&&v!==""&&Number.isFinite(n)&&n>=0?n:fallback;}
  function parseSettings(raw){
    let v=raw;
    if(typeof v==="string"){try{v=JSON.parse(v);}catch(e){v=null;}}
    const out=clone(DEFAULTS);
    if(!v||typeof v!=="object")return out;
    out.enabled=v.enabled===true;
    const t=v.threshold&&typeof v.threshold==="object"?v.threshold:{};
    KIDS.forEach(function(k){out.threshold[k]=step5(t[k],DEFAULTS.threshold[k]);});
    out.rerollsPerSlot=Math.max(0,Math.min(10,Math.round(capNumber(v.rerollsPerSlot,DEFAULTS.rerollsPerSlot))));
    const ai=v.ai&&typeof v.ai==="object"?v.ai:{};
    out.ai.enabled=ai.enabled===true;
    ["callsPerKidPerDay","familyCallsPerDay","dailyUsdCap","monthlyUsdCap"].forEach(function(key){out.ai[key]=capNumber(ai[key],DEFAULTS.ai[key]);});
    return out;
  }
  function identity(c){return [c.kid_id,c.day,c.kind,c.slot||"default"].join(":");}
  /* D1: today's points = today's counted claims + queued claims the tablet has
     not yet seen come back + any manual awards the caller knows of. A queued
     op and its claim are the same task, so each identity counts once. */
  function todayPoints(kid,day,src){
    src=src||{};
    const seen=new Set();let total=0;
    function add(c){
      if(!c||c.kid_id!==kid||c.day!==day)return;
      const key=identity(c);
      if(seen.has(key))return;
      seen.add(key);
      total+=Math.max(0,Number(c.amount)||0);
    }
    (src.claims||[]).forEach(function(c){if(c&&COUNTED[c.status])add(c);});
    (src.queue||[]).forEach(function(op){if(op&&op.type==="pointClaim")add(op.claim);});
    (src.manual||[]).forEach(function(r){if(r&&r.kid_id===kid&&r.day===day)total+=Math.max(0,Number(r.delta)||0);});
    return total;
  }
  /* reason: off (gate not in force for this kid) | papa (Papa opened today) |
     reached (threshold met now or earlier today, D2) | points (still closed) */
  function state(kid,ctx){
    ctx=ctx||{};
    const s=parseSettings(ctx.settings);
    const threshold=KIDS.indexOf(kid)>=0?s.threshold[kid]:0;
    const today=Math.max(0,Number(ctx.today)||0);
    const base={threshold:threshold,today:today,need:Math.max(0,threshold-today)};
    function out(open,reason){return Object.assign({open:open,reason:reason},base);}
    if(!s.enabled||threshold<=0)return out(true,"off");
    if(ctx.papaOpen)return out(true,"papa");
    if(today>=threshold||ctx.remembered)return out(true,"reached");
    return out(false,"points");
  }
  /* D4 gift reminder from the existing reward catalog (no second reward
     system). Cash is not a gift. Prefer the next reward to save for; if all
     are affordable, the dearest one the kid can already ask for. */
  function giftReminder(available,catalog){
    const a=Math.max(0,Number(available)||0);
    const items=(catalog||[]).filter(function(r){return r&&r.enabled!==false&&r.kind!=="cash"&&Number(r.cost)>0&&Array.isArray(r.title);});
    if(!items.length)return {kind:"generic",available:a};
    const goals=items.filter(function(r){return Number(r.cost)>a;}).sort(function(x,y){return x.cost-y.cost;});
    if(goals.length)return {kind:"saving",available:a,reward:goals[0],cost:Number(goals[0].cost),need:Number(goals[0].cost)-a};
    const best=items.slice().sort(function(x,y){return y.cost-x.cost;})[0];
    return {kind:"can",available:a,reward:best,cost:Number(best.cost),need:0};
  }
  const api={KIDS:KIDS,DEFAULTS:DEFAULTS,parseSettings:parseSettings,todayPoints:todayPoints,state:state,giftReminder:giftReminder};
  if(typeof window!=="undefined")window.SQGamesGate=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
