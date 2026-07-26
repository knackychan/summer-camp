/* SQBrainData — Brain Gym game definitions (design.md §4).
   Pure data + pure generators. No DOM, no globals, no side effects. */
(function(){
  const TIERS=["tot","mid","hard"];
  const TIER_DEFAULT={lucien:"tot",lili:"mid",luis:"hard"};

  /* ---- shared generator helpers ---- */
  function pick(rnd,list){return list[Math.floor(rnd()*list.length)];}
  function intBetween(rnd,lo,hi){return lo+Math.floor(rnd()*(hi-lo+1));}

  /* Distractors around a numeric answer: near misses, never negative,
     never a duplicate, always exactly `count` of them. */
  function numChoices(rnd,answer,count,spread){
    const out=[String(answer)];
    let guard=0;
    while(out.length<count&&guard<200){
      guard++;
      const delta=intBetween(rnd,1,spread)*(rnd()<0.5?-1:1);
      const cand=answer+delta;
      if(cand<0)continue;
      if(out.indexOf(String(cand))>=0)continue;
      out.push(String(cand));
    }
    while(out.length<count)out.push(String(answer+out.length*7+1));
    return shuffleWith(rnd,out);
  }

  function shuffleWith(rnd,list){
    const out=list.slice();
    for(let i=out.length-1;i>0;i--){
      const j=Math.floor(rnd()*(i+1));
      const tmp=out[i]; out[i]=out[j]; out[j]=tmp;
    }
    return out;
  }

  const NUM_ZH=["零","一","二","三","四","五","六","七","八","九","十"];
  function zhNum(n){return n>=0&&n<=10?NUM_ZH[n]:String(n);}

  /* ---- 1. Calculations 計算 ---- */
  const COUNT_EMOJI=["🍎","🍌","⭐","🐟","🚗","🎈"];

  function genCalcTot(rnd){
    const em=pick(rnd,COUNT_EMOJI);
    const a=intBetween(rnd,1,3), b=intBetween(rnd,1,2), sum=a+b;
    return {
      prompt:{type:"emoji",em:em,a:a,b:b,
        en:em.repeat(a)+" + "+em.repeat(b)+" = ?",
        zh:em.repeat(a)+" + "+em.repeat(b)+" = ?"},
      say:[String(a)+" plus "+String(b),zhNum(a)+"加"+zhNum(b)],
      answer:String(sum),
      choices:numChoices(rnd,sum,4,3)
    };
  }

  function genCalcMid(rnd){
    const plus=rnd()<0.5;
    let a=intBetween(rnd,2,20), b=intBetween(rnd,2,9);
    if(!plus&&b>a){const t=a;a=b;b=t;}
    const sum=plus?a+b:a-b, sign=plus?"+":"−";
    return {
      prompt:{type:"text",en:a+" "+sign+" "+b+" = ?",zh:a+" "+sign+" "+b+" = ?"},
      say:[a+(plus?" plus ":" minus ")+b,String(a)+(plus?"加":"減")+String(b)],
      answer:String(sum)
    };
  }

  function genCalcHard(rnd){
    const mode=intBetween(rnd,0,2);
    if(mode===2){
      const a=intBetween(rnd,2,9), b=intBetween(rnd,2,9);
      return {prompt:{type:"text",en:a+" × "+b+" = ?",zh:a+" × "+b+" = ?"},answer:String(a*b)};
    }
    let a=intBetween(rnd,11,99), b=intBetween(rnd,11,49);
    if(mode===1&&b>a){const t=a;a=b;b=t;}
    const sum=mode===0?a+b:a-b, sign=mode===0?"+":"−";
    return {prompt:{type:"text",en:a+" "+sign+" "+b+" = ?",zh:a+" "+sign+" "+b+" = ?"},answer:String(sum)};
  }

  const GAMES={
    calc:{
      id:"calc", icon:"➕", skill:"math",
      title:["Calculations","計算"],
      blurb:["Quick sums","快速計算"],
      tiers:{
        tot :{items:10,clock:false,pad:"choice",gen:genCalcTot},
        mid :{items:20,clock:true, pad:"keypad",gen:genCalcMid},
        hard:{items:20,clock:true, pad:"keypad",gen:genCalcHard}
      }
    }
  };

  const api={TIERS:TIERS,TIER_DEFAULT:TIER_DEFAULT,GAMES:GAMES,
    pick:pick,intBetween:intBetween,numChoices:numChoices,shuffleWith:shuffleWith,zhNum:zhNum};
  if(typeof window!=="undefined")window.SQBrainData=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
