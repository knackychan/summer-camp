/* SQCheck — pure helpers for the parents' phone screens in admin
   (docs/plans/2026-10-19-parent-app-layout/). What a waiting task card shows,
   the Awaiting list, and one kid's games day in the same order as the tablets'
   lock (js/lock-core.js): Brain Gym first, then the points bar for today's mode.
   Operator chrome is English (D23); task and reward names keep EN + 中文. */
(function(){
  const NAMES={lucien:"Lucien",lili:"Lili",luis:"Luis"};
  function pair(v){
    if(Array.isArray(v))return [String(v[0]||""),String(v[1]||"")];
    return [String(v||""),""];
  }
  /* A claim card: the chore's own icon and label when the kid sent one
     (school-mode D4 evidence.label), else the points rule's. */
  function claimView(c,deps){
    deps=deps||{};
    const rules=deps.rules||{}, items=(deps.chores||[]).concat(deps.bonus||[]), extra=deps.extra||[];
    const ev=c.evidence||{};
    const item=items.find(function(x){return x.kind===c.kind&&(!x.slot||x.slot===(c.slot||"default"));})||null;
    const rule=rules[c.kind];
    const label=Array.isArray(ev.label)&&ev.label[0]?pair(ev.label):item?pair(item.label):rule?pair(rule.label):[String(c.kind||"Task").replace(/[_:]+/g," "),""];
    const goal=ev.goal?(Array.isArray(ev.goal)?ev.goal.join(" · "):String(ev.goal)):"";
    return {type:"claim",id:c.id,kid:c.kid_id,at:c.created_at||"",icon:item&&item.icon||"✅",label:label,
      points:Number(c.amount)||0,bonus:extra.indexOf(c.kind)>=0,detail:[goal,ev.reason||""].filter(Boolean).join(" · ")};
  }
  function requestView(r){
    return {type:"request",id:r.id,kid:r.kid_id,at:r.created_at||"",icon:"🎁",label:pair(r.label||r.reward_id||"Reward"),points:Number(r.points)||0,bonus:false,detail:""};
  }
  /* Awaiting: pending task claims and reward asks, newest first. */
  function items(rows,deps){
    const claims=(rows.pointClaims||[]).filter(function(c){return c.status==="pending";}).map(function(c){return claimView(c,deps);});
    const asks=(rows.pointRequests||[]).filter(function(r){return r.status==="requested";}).map(requestView);
    return claims.concat(asks).sort(function(a,b){return String(b.at).localeCompare(String(a.at));});
  }
  function kidDay(kid,ctx){
    const fs=ctx.settings||{}, gate=ctx.gate, day=ctx.today, exclude=ctx.exclude||[];
    const claims=(ctx.claimsToday||[]).filter(function(c){return c.kid_id===kid;});
    const points=gate.todayPoints(kid,day,{claims:claims,exclude:exclude});
    const waiting=claims.filter(function(c){return c.status==="pending"&&c.day===day&&exclude.indexOf(c.kind)<0;}).reduce(function(a,c){return a+(Number(c.amount)||0);},0);
    const papaOpen=fs["braingate_"+kid]===day;
    const st=gate.state(kid,{settings:fs.games_gate_v1,mode:ctx.mode,today:points,papaOpen:papaOpen});
    const brainOn=fs["brain_enabled_"+kid]!=="0";
    const brainDone=Math.min(3,Number((ctx.brain||{})[kid])||0);
    const brainOpen=!brainOn||brainDone>=3||papaOpen;
    let games;
    if((fs["applock_"+kid]||"")!=="")games={open:false,key:"paused",text:"App paused by you"};
    else if((fs["catlock_"+kid+"_games"]||"")!=="")games={open:false,key:"locked",text:"Games locked by you"};
    else if(st.reason==="papa")games={open:true,key:"papa",text:"Open · you opened Games today"};
    else if(!brainOpen)games={open:false,key:"brain",text:"Brain Gym first · "+brainDone+" of 3 done"};
    else if(st.reason==="off")games={open:true,key:"off",text:st.threshold?"Open · the games gate is off":"Open · no bar for "+(NAMES[kid]||kid)};
    else if(st.open)games={open:true,key:"reached",text:"Open · bar reached"};
    else games={open:false,key:"points",text:st.need+" more points to open Games"};
    return {kid:kid,points:points,waiting:waiting,threshold:st.threshold,need:st.need,
      pct:st.threshold?Math.min(100,Math.round(points/st.threshold*100)):100,
      brainOn:brainOn,brainDone:brainDone,papaOpen:papaOpen,games:games};
  }
  function step(n,delta){return Math.max(0,Math.min(300,Math.round((Number(n)||0)/5)*5+delta));}
  const api={claimView:claimView,requestView:requestView,items:items,kidDay:kidDay,step:step};
  if(typeof window!=="undefined")window.SQCheck=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
