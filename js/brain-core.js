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

  function cat(override){return override?override:D;}

  function tierForIn(kid,settings,data){
    const raw=settings&&settings["brain_tier_"+kid];
    if(raw&&data.TIERS.indexOf(raw)>=0)return raw;
    const def=data.TIER_DEFAULT[kid];
    return def?def:"mid";
  }
  function tierFor(kid,settings,override){return tierForIn(kid,settings,cat(override));}

  function eligibleGames(kid,settings,override){
    const data=cat(override), tier=tierForIn(kid,settings,data);
    return Object.keys(data.GAMES).filter(function(id){
      const g=data.GAMES[id];
      return !!(g&&g.tiers&&g.tiers[tier]);
    });
  }

  /* shuffle a copy with the seeded PRNG — never mutates the input */
  function seededShuffle(list,rnd){
    const out=list.slice();
    for(let i=out.length-1;i>0;i--){
      const j=Math.floor(rnd()*(i+1));
      const tmp=out[i]; out[i]=out[j]; out[j]=tmp;
    }
    return out;
  }

  /* Three distinct games, same on every tablet, offline (design.md §6).
     Pass one: take a game only if its skill tag is new, so a day is never
     three arithmetic games. Pass two: fill any shortfall, tags may repeat. */
  function dailyThree(kid,dateStr,settings,override){
    const data=cat(override);
    const pool=eligibleGames(kid,settings,override);
    if(pool.length<=3)return pool;
    const order=seededShuffle(pool,mulberry32(dseed("brain"+dateStr+kid)));
    const picked=[], seen={};
    for(const id of order){
      if(picked.length===3)break;
      const skill=data.GAMES[id].skill;
      if(seen[skill])continue;
      seen[skill]=true; picked.push(id);
    }
    for(const id of order){
      if(picked.length===3)break;
      if(picked.indexOf(id)<0)picked.push(id);
    }
    return picked;
  }

  /* The daily-3 door (design.md §6). Only today's trio counts — replaying a
     favourite game three times must never open the gate. */
  function gateState(ctx){
    const trio=ctx.trio||[], done=ctx.done||{};
    const remaining=trio.filter(function(id){return !done[id];});
    return {
      open:!!ctx.bypass||remaining.length===0,
      doneCount:trio.length-remaining.length,
      remaining:remaining
    };
  }

  function buildRound(gameId,tier,rnd,override){
    const data=cat(override);
    const g=data.GAMES[gameId];
    if(!g)throw new Error("unknown brain game: "+gameId);
    const cfg=g.tiers[tier];
    if(!cfg)throw new Error("game "+gameId+" has no tier "+tier);
    let items;
    if(typeof cfg.build==="function"){
      items=cfg.build(rnd,cfg);
    }else{
      items=[];
      for(let i=0;i<cfg.items;i++)items.push(cfg.gen(rnd,{i:i,items:items}));
    }
    return {gameId:gameId,tier:tier,pad:cfg.pad,clock:!!cfg.clock,items:items};
  }

  /* An item is worth 1 point unless it says otherwise, and grades itself as
     all-or-nothing unless it supplies grade(given) -> 0..worth. */
  function scoreRound(ctx){
    const items=ctx.items||[], answers=ctx.answers||[];
    let score=0, total=0;
    const correct=items.map(function(item,i){
      const worth=item.worth==null?1:item.worth;
      const given=answers[i]==null?"":String(answers[i]).trim();
      let got;
      if(typeof item.grade==="function"){
        got=item.grade(given);
        if(!(got>0))got=0;
        if(got>worth)got=worth;
      }else{
        got=given===String(item.answer).trim()?worth:0;
      }
      score+=got; total+=worth;
      return worth>0&&got===worth;
    });
    return {score:score,total:total,ms:ctx.clock?(ctx.ms||0):0,correct:correct};
  }

  const api={dseed:dseed,mulberry32:mulberry32,tierFor:tierFor,
    eligibleGames:eligibleGames,dailyThree:dailyThree,seededShuffle:seededShuffle,
    buildRound:buildRound,scoreRound:scoreRound,gateState:gateState};
  if(typeof window!=="undefined")window.SQBrainCore=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
