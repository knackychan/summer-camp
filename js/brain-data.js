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

  /* ---- 2. Sign Finder 找符號 ---- */
  function applyOp(op,a,b){
    if(op==="+")return a+b;
    if(op==="−")return a-b;
    if(op==="×")return a*b;
    return a/b;
  }
  function signItem(rnd,ops,lo,hi){
    const op=pick(rnd,ops);
    let a,b;
    if(op==="÷"){b=intBetween(rnd,2,9);a=b*intBetween(rnd,2,9);}
    else{
      a=intBetween(rnd,lo,hi); b=intBetween(rnd,lo,hi);
      if(op==="−"&&b>a){const t=a;a=b;b=t;}
    }
    const r=applyOp(op,a,b);
    return {
      prompt:{type:"text",a:a,b:b,r:r,en:a+" ? "+b+" = "+r,zh:a+" ? "+b+" = "+r},
      say:["What sign is missing?","缺哪個符號？"],
      answer:op, choices:ops.slice()
    };
  }

  /* ---- 3. Low to High 由小到大 ---- */
  function lowHighItem(rnd,count,max,flashMs){
    const seen={}, cells=[];
    while(cells.length<count){
      const n=intBetween(rnd,1,max);
      if(seen[n])continue;
      seen[n]=true; cells.push({n:n});
    }
    const sorted=cells.map(function(c){return c.n;}).sort(function(a,b){return a-b;});
    return {
      prompt:{type:"gridflash",cells:cells,flashMs:flashMs,
        en:"Remember, then tap smallest first",zh:"記住，然後從最小開始點"},
      say:["Remember these numbers","記住這些數字"],
      answer:sorted.join(",")
    };
  }

  /* ---- 4. Color Words 顏色字 (Stroop) ---- */
  const STROOP_KEYS=["red","blue","green","yellow"];
  const COLOR_EN={red:"Red",blue:"Blue",green:"Green",yellow:"Yellow",purple:"Purple",black:"Black"};
  const COLOR_ZH={red:"紅色",blue:"藍色",green:"綠色",yellow:"黃色",purple:"紫色",black:"黑色"};

  function stroopTot(rnd){
    const ink=pick(rnd,STROOP_KEYS);
    return {
      prompt:{type:"swatch",ink:ink,en:"Which colour? 哪個顏色？",zh:"哪個顏色？"},
      say:["Which colour is this?","這是什麼顏色？"],
      answer:ink, choices:shuffleWith(rnd,STROOP_KEYS.slice()), choiceStyle:"swatch"
    };
  }
  function stroopWord(rnd,zh){
    const ink=pick(rnd,STROOP_KEYS);
    let word=pick(rnd,STROOP_KEYS);
    if(word===ink)word=pick(rnd,STROOP_KEYS.filter(function(k){return k!==ink;}));
    return {
      prompt:{type:"colorword",ink:ink,word:zh?COLOR_ZH[word]:COLOR_EN[word],
        en:"Say the INK colour",zh:"說出「顏色」不是字"},
      answer:ink, choices:shuffleWith(rnd,STROOP_KEYS.slice())
    };
  }

  /* ---- 5. Number Cruncher 數一數 ---- */
  const CRUNCH_ANIMALS=["🐶","🐱","🐟","🐦","🐸","🐝"];
  function crunchItem(rnd,total,digits){
    const set=digits?["0","1","2","3","4","5","6","7","8","9"]:CRUNCH_ANIMALS;
    const target=pick(rnd,set);
    const count=intBetween(rnd,2,Math.max(3,Math.floor(total/4)));
    const others=set.filter(function(g){return g!==target;});
    const glyphs=[];
    for(let i=0;i<count;i++)glyphs.push(target);
    while(glyphs.length<total)glyphs.push(pick(rnd,others));
    return {
      prompt:{type:"countfield",glyphs:shuffleWith(rnd,glyphs),target:target,
        en:"How many "+target+" ?",zh:"有幾個 "+target+" ？"},
      say:["How many do you count?","數數看有幾個？"],
      answer:String(count),
      choices:numChoices(rnd,count,4,2)
    };
  }

  /* ---- 6. Time Lapse 時鐘 ---- */
  function hhmm(h,m){h=((h-1)%12+12)%12+1;return h+":"+(m<10?"0":"")+m;}
  function clockItem(rnd,step,addMin){
    const h=intBetween(rnd,1,12), m=step===0?0:intBetween(rnd,0,Math.floor(59/step))*step;
    const total=h*60+m+addMin;
    const ah=Math.floor(total/60), am=total%60;
    const answer=hhmm(ah,am);
    const wrong=[hhmm(ah+1,am),hhmm(ah,(am+15)%60),hhmm(ah-1,am),hhmm(ah,(am+30)%60)]
      .filter(function(v){return v!==answer;});
    return {
      prompt:{type:"clockface",h:h,m:m,
        en:addMin?"What time in "+addMin+" minutes?":"What time is it?",
        zh:addMin?addMin+"分鐘後是幾點？":"現在幾點？"},
      say:[addMin?"What time in "+addMin+" minutes?":"What time is it?",
        addMin?addMin+"分鐘後是幾點？":"現在幾點？"],
      answer:answer,
      choices:shuffleWith(rnd,[answer].concat(shuffleWith(rnd,wrong).slice(0,3)))
    };
  }

  /* ---- 7. Change Maker 找零錢 (NT$) ---- */
  const COINS=[1,5,10,50];
  const NOTES=[100,500];
  function moneyArt(n){
    /* a readable pile: notes then coins, biggest first */
    let left=n, out=[];
    NOTES.concat(COINS).sort(function(a,b){return b-a;}).forEach(function(v){
      while(left>=v){out.push(v>=100?"💵"+v:"🪙"+v);left-=v;}
    });
    return out.join(" ");
  }
  function changeTot(rnd){
    let a=pick(rnd,COINS), b=pick(rnd,COINS);
    while(b===a)b=pick(rnd,COINS);
    const big=Math.max(a,b);
    return {
      prompt:{type:"money",art:"🪙"+a+"   🪙"+b,
        en:"Which is worth more?",zh:"哪個比較多錢？"},
      say:["Which is worth more?","哪個比較多錢？"],
      answer:String(big), choices:shuffleWith(rnd,[String(a),String(b)])
    };
  }
  function changeItem(rnd,maxPrice,payOptions){
    const price=intBetween(rnd,3,maxPrice);
    const paid=pick(rnd,payOptions.filter(function(p){return p>price;}));
    return {
      prompt:{type:"money",price:price,paid:paid,art:moneyArt(paid),
        en:"It costs NT$"+price+". You pay NT$"+paid+". Change?",
        zh:"東西 NT$"+price+"，你付 NT$"+paid+"，找多少？"},
      answer:String(paid-price)
    };
  }

  /* ---- 8. Word Memory 記單字 ----
     Words are injected from index.html's VOCAB at boot; the fallback keeps
     this module standalone for node tests and for a config-less local run. */
  let WORD_POOL=["cat","dog","fish","bird","apple","water","house","book",
    "green","jump","friend","music","river","cloud","spoon","tiger"];
  const EMOJI_POOL=["🐱","🐶","🐟","🐦","🍎","💧","🏠","📚","🌳","⭐","🚗","🎈"];
  function setWordPool(list){if(list&&list.length>=12)WORD_POOL=list.slice();}

  function wordMemItem(rnd,count,studyMs){
    const words=shuffleWith(rnd,WORD_POOL.slice()).slice(0,count);
    const want={};
    words.forEach(function(w){want[w.toLowerCase()]=true;});
    return {
      prompt:{type:"wordlist",words:words,studyMs:studyMs,
        en:"Remember these words",zh:"記住這些單字"},
      worth:count,
      answer:words.join(" "),
      grade:function(given){
        const hit={};
        String(given).toLowerCase().split(/[^a-z']+/).forEach(function(w){
          if(w&&want[w])hit[w]=true;
        });
        return Object.keys(hit).length;
      }
    };
  }

  function wordMemTot(rnd){
    const shown=shuffleWith(rnd,EMOJI_POOL.slice()).slice(0,4);
    const missing=pick(rnd,shown);
    return {
      prompt:{type:"wordlist",words:shown,studyMs:4000,
        en:"Which one disappeared?",zh:"哪一個不見了？"},
      say:["Remember these pictures","記住這些圖片"],
      answer:missing,
      choices:shuffleWith(rnd,shown.slice())
    };
  }

  /* ---- 9. Math Recall 記憶計算 ----
     Each screen shows a new sum but asks for the PREVIOUS one's value.
     Items depend on each other, so this tier builds the whole array. */
  function recallBuild(rnd,cfg){
    const out=[];
    for(let i=0;i<cfg.items;i++){
      let shown, en, zh;
      if(cfg.mode==="number"){
        shown=String(intBetween(rnd,1,9));
        en="Remember: "+shown; zh="記住："+shown;
      }else{
        const big=cfg.mode==="big";
        const a=intBetween(rnd,big?11:2,big?49:9), b=intBetween(rnd,big?11:2,big?49:9);
        shown=String(a+b); en=a+" + "+b+" = ?"; zh=a+" + "+b+" = ?";
      }
      const first=i===0;
      const item={
        shown:shown,
        prompt:{type:"text",
          en:first?en+"  (just remember it)":en+"  ← now answer the PREVIOUS one",
          zh:first?en+"（先記住）":en+"  ← 回答「上一題」"},
        say:first?["Just remember this one","先記住這一題"]:["Answer the one before","回答上一題"],
        answer:first?"":out[i-1].shown,
        worth:first?0:1
      };
      if(cfg.pad==="choice")item.choices=numChoices(rnd,Number(item.answer||shown),4,3);
      if(first)item.grade=function(){return 0;};
      out.push(item);
    }
    return out;
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
    },
    signs:{
      id:"signs", icon:"❓", skill:"math",
      title:["Sign Finder","找符號"], blurb:["Find the missing sign","找出缺的符號"],
      tiers:{
        tot :{items:10,clock:false,pad:"choice",gen:function(r){return signItem(r,["+","−"],1,5);}},
        mid :{items:15,clock:true, pad:"choice",gen:function(r){return signItem(r,["+","−","×"],2,9);}},
        hard:{items:15,clock:true, pad:"choice",gen:function(r){return signItem(r,["+","−","×","÷"],2,12);}}
      }
    },
    lowhigh:{
      id:"lowhigh", icon:"🔢", skill:"memory",
      title:["Low to High","由小到大"], blurb:["Remember and order","記住再排序"],
      tiers:{
        tot :{items:5,clock:false,pad:"grid",gen:function(r){return lowHighItem(r,3,5,4000);}},
        mid :{items:5,clock:true, pad:"grid",gen:function(r){return lowHighItem(r,5,20,3000);}},
        hard:{items:5,clock:true, pad:"grid",gen:function(r){return lowHighItem(r,7,50,2500);}}
      }
    },
    stroop:{
      id:"stroop", icon:"🎨", skill:"attention",
      title:["Color Words","顏色字"], blurb:["Say the ink, not the word","看顏色不看字"],
      tiers:{
        tot :{items:10,clock:false,pad:"choice",gen:stroopTot},
        mid :{items:20,clock:true, pad:"choice",gen:function(r){return stroopWord(r,false);}},
        hard:{items:20,clock:true, pad:"choice",gen:function(r){return stroopWord(r,r()<0.5);}}
      }
    },
    crunch:{
      id:"crunch", icon:"🔍", skill:"attention",
      title:["Number Cruncher","數一數"], blurb:["Count them fast","快快數一數"],
      tiers:{
        tot :{items:8, clock:false,pad:"choice",gen:function(r){return crunchItem(r,8,false);}},
        mid :{items:10,clock:true, pad:"keypad",gen:function(r){return crunchItem(r,30,true);}},
        hard:{items:10,clock:true, pad:"keypad",gen:function(r){return crunchItem(r,60,true);}}
      }
    },
    clock:{
      id:"clock", icon:"🕐", skill:"logic",
      title:["Time Lapse","時鐘"], blurb:["Read the clock","看時鐘"],
      tiers:{
        tot :{items:8, clock:false,pad:"choice",gen:function(r){return clockItem(r,0,0);}},
        mid :{items:10,clock:true, pad:"choice",gen:function(r){return clockItem(r,5,0);}},
        hard:{items:10,clock:true, pad:"choice",gen:function(r){return clockItem(r,5,pick(r,[20,40,45,90]));}}
      }
    },
    change:{
      id:"change", icon:"💱", skill:"money",
      title:["Change Maker","找零錢"], blurb:["Count the change","算找零"],
      tiers:{
        tot :{items:8, clock:false,pad:"choice",gen:changeTot},
        mid :{items:10,clock:true, pad:"keypad",gen:function(r){return changeItem(r,45,[50,100]);}},
        hard:{items:10,clock:true, pad:"keypad",gen:function(r){return changeItem(r,480,[500,1000]);}}
      }
    },
    wordmem:{
      id:"wordmem", icon:"🧠", skill:"memory",
      title:["Word Memory","記單字"], blurb:["Remember the words","記住單字"],
      tiers:{
        tot :{items:5,clock:false,pad:"choice",gen:wordMemTot},
        mid :{items:1,clock:true, pad:"type",gen:function(r){return wordMemItem(r,8,45000);}},
        hard:{items:1,clock:true, pad:"type",gen:function(r){return wordMemItem(r,12,60000);}}
      }
    },
    recall:{
      id:"recall", icon:"🔁", skill:"memory",
      title:["Math Recall","記憶計算"], blurb:["Answer the one before","回答上一題"],
      tiers:{
        tot :{items:6, clock:false,pad:"choice",mode:"number",build:recallBuild},
        mid :{items:10,clock:true, pad:"keypad",mode:"small", build:recallBuild},
        hard:{items:10,clock:true, pad:"keypad",mode:"big",   build:recallBuild}
      }
    }
  };

  const api={TIERS:TIERS,TIER_DEFAULT:TIER_DEFAULT,GAMES:GAMES,
    pick:pick,intBetween:intBetween,numChoices:numChoices,shuffleWith:shuffleWith,zhNum:zhNum,
    setWordPool:setWordPool};
  if(typeof window!=="undefined")window.SQBrainData=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
