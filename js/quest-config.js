/* SQQuestConfig — one shared parser for child + admin configuration.
   Synced configuration lives in family_settings. Versioned unit markers keep
   legacy catalogs and spending repeat-safe when read before/after migration. */
(function(){
  const KEYS={
    catalog:"quest_catalog_v1",
    rewards:"reward_catalog_v1",
    assistant:"quest_assistant_v1",
    policy:"points_policy_v1",
    economy:"points_economy_v1",
    spendPrefix:"reward_spend_"
  };
  const ASSISTANT_DEFAULT={askEnergy:true,maxSuggestions:3,showUpcoming:true,questionMode:"guided",companionEnabled:true};
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function parse(value,fallback){
    if(value==null||value==="")return clone(fallback);
    try{const v=typeof value==="string"?JSON.parse(value):value;return v==null?clone(fallback):v;}catch(e){return clone(fallback);}
  }
  function familyMap(source){
    if(!source)return {};
    if(Array.isArray(source))return Object.fromEntries(source.map(function(r){return [r.key,r.value];}));
    return source;
  }
  function cleanPair(v,fallback){
    if(!Array.isArray(v))return fallback.slice();
    return [String(v[0]||fallback[0]),String(v[1]||fallback[1])];
  }
  function points(){return typeof window!=="undefined"?window.SQPoints:require("./points.js");}
  function normalizeQuest(q,i){
    const base={
      id:"quest_"+(i+1),enabled:true,type:"quest",required:false,icon:"✨",category:"help",priority:50,
      title:["Quest","任務"],blurb:["A Summer Quest activity.","一個 Summer Quest 任務。"],duration:10,energy:"medium",
      after:0,before:24*60-1,oncePerDay:true,frequency:{type:"daily"},allowedKids:["lucien","lili","luis"],rewardPoints:0,verification:"self",steps:[]
    };
    const out=Object.assign({},base,q||{});
    out.id=String(out.id||base.id).trim().replace(/[^a-z0-9_-]+/gi,"_").toLowerCase();
    out.enabled=out.enabled!==false;
    out.required=!!out.required;
    out.title=cleanPair(out.title,base.title);
    out.blurb=cleanPair(out.blurb,base.blurb);
    out.duration=Math.max(1,Math.min(240,Number(out.duration)||10));
    out.priority=Math.max(0,Math.min(200,Number(out.priority)||50));
    const policy=points(), award=policy&&policy.quest(out);
    out.awardKind=award?award.kind:"";
    out.rewardPoints=award?policy.amount(award.kind):0;
    out.rewardStars=out.rewardPoints; // legacy renderer alias; always points
    out.points_version=1;
    out.after=Number.isFinite(Number(out.after))?Math.max(0,Math.min(1439,Number(out.after))):0;
    out.before=Number.isFinite(Number(out.before))?Math.max(out.after,Math.min(1439,Number(out.before))):1439;
    out.energy=["low","medium","high"].includes(out.energy)?out.energy:"medium";
    out.type=["routine","quest","activity"].includes(out.type)?out.type:"quest";
    out.category=["care","help","learn","move","play","family"].includes(out.category)?out.category:"help";
    out.verification=award&&policy.rules[award.kind].parent?"parent":out.verification==="parent"?"parent":"self";
    out.allowedKids=Array.isArray(out.allowedKids)&&out.allowedKids.length?out.allowedKids.filter(Boolean):["lucien","lili","luis"];
    out.frequency=out.frequency&&typeof out.frequency==="object"?out.frequency:{type:"daily"};
    out.steps=Array.isArray(out.steps)?out.steps.map(function(s){return cleanPair(s,["Do the next step.","完成下一個步驟。"]);}):[];
    return out;
  }
  function catalog(source){
    const fs=familyMap(source), fallback=(typeof window!=="undefined"&&window.SQQuestData&&window.SQQuestData.all)?window.SQQuestData.all():[];
    const parsed=parse(fs[KEYS.catalog],fallback);
    if(!Array.isArray(parsed)||!parsed.length)return fallback.map(normalizeQuest);
    /* A seed quest marked `since` was added after families could save their own
       catalog; a saved catalog that predates it still gets it (Papa can pause it
       like any other — the editor has no delete, so absence means "never saw it"). */
    const known=new Set(parsed.map(function(q){return q&&q.id;}));
    const added=fallback.filter(function(q){return q.since&&!known.has(q.id);});
    return parsed.concat(added).map(function(q,i){const out=normalizeQuest(q,i), policy=points(); if(out.awardKind){out.rewardPoints=policy.amount(out.awardKind,fs);out.rewardStars=out.rewardPoints;}return out;});
  }
  function normalizeReward(r,i){
    const base={id:"reward_"+(i+1),enabled:true,icon:"🎁",cost:10,title:["Reward","獎勵"],blurb:["A parent-approved reward.","爸爸核准的獎勵。"]};
    const out=Object.assign({},base,r||{});
    out.id=String(out.id||base.id).trim().replace(/[^a-z0-9_-]+/gi,"_").toLowerCase();
    out.enabled=out.enabled!==false;
    const factor=r&&r.points_version===1?1:10;
    out.cost=Math.max(1,Math.min(1000000,Math.ceil((Number(out.cost)||10)*factor)));
    out.points_version=1;
    out.kind=["experience","gift","cash"].includes(out.kind)?out.kind:"experience";
    out.title=cleanPair(out.title,base.title); out.blurb=cleanPair(out.blurb,base.blurb);
    return out;
  }
  function rewards(source){
    const fs=familyMap(source), fallback=(typeof window!=="undefined"&&window.SQRewardData&&window.SQRewardData.all)?window.SQRewardData.all():[];
    const parsed=parse(fs[KEYS.rewards],fallback);
    if(!Array.isArray(parsed))return fallback.map(normalizeReward);
    return parsed.map(normalizeReward);
  }
  function assistant(source){
    const fs=familyMap(source), v=parse(fs[KEYS.assistant],ASSISTANT_DEFAULT);
    return Object.assign({},ASSISTANT_DEFAULT,v||{}, {maxSuggestions:Math.max(1,Math.min(6,Number(v&&v.maxSuggestions)||3))});
  }
  function spendState(source,kid){
    const fs=familyMap(source), raw=fs[KEYS.spendPrefix+kid];
    if(raw==null||raw==="")return {total:0,requests:[],points_version:1};
    const numeric=Number(raw);
    if(Number.isFinite(numeric))return {total:Math.max(0,Math.floor(numeric))*10,requests:[],points_version:1};
    try{
      const v=typeof raw==="string"?JSON.parse(raw):raw;
      return {total:Math.max(0,Math.floor(Number(v&&v.total)||0))*(v&&v.points_version===1?1:10),requests:Array.isArray(v&&v.requests)?v.requests.map(String):[],points_version:1};
    }catch(e){return {total:0,requests:[],points_version:1};}
  }
  function economy(source){
    const v=parse(familyMap(source)[KEYS.economy],{});
    const change=v.rateChange;
    const rateChange=change&&Number.isFinite(Number(change.from))&&Number(change.from)>0&&Number.isFinite(Number(change.to))&&Number(change.to)>0&&/^[A-Z]{3}$/.test(change.currency||"")&&Number.isFinite(Date.parse(change.at))
      ?{from:Number(change.from),to:Number(change.to),currency:change.currency,fromCurrency:/^[A-Z]{3}$/.test(change.fromCurrency||"")?change.fromCurrency:change.currency,at:change.at}:null;
    return {currency:/^[A-Z]{3}$/.test(String(v.currency||""))?v.currency:"",pointsPerUnit:Number.isFinite(Number(v.pointsPerUnit))&&Number(v.pointsPerUnit)>0?Number(v.pointsPerUnit):null,monthlyBudget:Number.isFinite(Number(v.monthlyBudget))&&Number(v.monthlyBudget)>0?Number(v.monthlyBudget):null,cashEnabled:v.cashEnabled===true,rateChange:rateChange};
  }
  function conversionReady(source){const e=economy(source);return !!(e.currency&&e.pointsPerUnit&&e.monthlyBudget);}
  function cashReady(source){return economy(source).cashEnabled&&conversionReady(source);}
  function giftPoints(value,source){
    if(!conversionReady(source)||!Number.isFinite(Number(value))||Number(value)<=0)return null;
    const price=Number(value)*economy(source).pointsPerUnit;
    if(!Number.isFinite(price))return null;
    // Ignore binary floating-point noise at an exact five-point boundary.
    return Math.max(5,Math.ceil((price-Number.EPSILON*Math.max(1,price))/5)*5);
  }
  function questVerificationKind(questId,day){return "quest_verify:"+String(questId||"")+":"+String(day||"");}
  function parseQuestVerificationKind(kind){const p=String(kind||"").split(":");return p[0]==="quest_verify"&&p[1]&&/^\d{4}-\d{2}-\d{2}$/.test(p[2]||"")?{questId:p[1],day:p[2]}:null;}
  function spent(source,kid){return spendState(source,kid).total;}
  function wallet(totalStars,source,kid){return Math.max(0,Math.floor(Number(totalStars)||0)-spent(source,kid));}
  const api={KEYS:KEYS,ASSISTANT_DEFAULT:ASSISTANT_DEFAULT,catalog:catalog,rewards:rewards,assistant:assistant,spendState:spendState,spent:spent,wallet:wallet,normalizeQuest:normalizeQuest,normalizeReward:normalizeReward,familyMap:familyMap,economy:economy,conversionReady:conversionReady,cashReady:cashReady,giftPoints:giftPoints,questVerificationKind:questVerificationKind,parseQuestVerificationKind:parseQuestVerificationKind};
  if(typeof window!=="undefined")window.SQQuestConfig=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
