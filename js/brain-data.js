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

  function directedCalcItem(rnd,skill,useChoices){
    let a=1,b=1,plus=true,max=20,answer,sign;
    let out=null;
    if(skill==="math.number_comparison.within_20"||skill==="math.number_comparison.within_100"){
      max=skill==="math.number_comparison.within_20"?20:100;
      a=intBetween(rnd,0,max);b=intBetween(rnd,0,max);
      if(a===b)b=a===max?Math.max(0,a-1):a+1;
      answer=Math.max(a,b);
      out={
        prompt:{type:"comparison",a:a,b:b,en:"Which is bigger?  "+a+"  or  "+b,zh:"哪個比較大？ "+a+" 還是 "+b},
        say:["Which number is bigger, "+a+" or "+b+"?",a+" 和 "+b+"，哪個比較大？"],
        answer:String(answer),
        corrective:["Look at which number is bigger.","看看哪個數字比較大。"]
      };
      if(useChoices)out.choices=shuffleWith(rnd,[String(a),String(b)]);
      return out;
    }
    if(skill==="math.number_bonds.to_10"||skill==="math.number_bonds.to_20"){
      max=skill==="math.number_bonds.to_10"?10:20;
      const minTarget=max===10?5:10;
      const target=intBetween(rnd,minTarget,max);
      a=intBetween(rnd,0,Math.max(0,target-1));
      b=target;
      answer=target-a;
      out={
        prompt:{type:"numberbond",a:a,b:b,en:a+" + ? = "+target,zh:a+" + ? = "+target},
        say:["What goes with "+a+" to make "+target+"?",a+" 加多少會變成 "+target+"？"],
        answer:String(answer),
        corrective:["Find the missing part.","找出少掉的那一部分。"]
      };
      if(useChoices)out.choices=numChoices(rnd,answer,4,Math.max(2,Math.ceil(max/5)));
      return out;
    }
    if(skill==="math.multiplication.tables_2_5_10"||skill==="math.multiplication.tables_2_to_9"){
      const tables=skill==="math.multiplication.tables_2_5_10"?[2,5,10]:[3,4,6,7,8,9];
      a=pick(rnd,tables);b=intBetween(rnd,1,10);answer=a*b;
      out={
        prompt:{type:"text",a:a,b:b,en:a+" × "+b+" = ?",zh:a+" × "+b+" = ?"},
        say:[a+" times "+b,a+" 乘 "+b],
        answer:String(answer),
        corrective:["Think in equal groups.","想成一樣大的幾組。"]
      };
      if(useChoices)out.choices=numChoices(rnd,answer,4,Math.max(3,a));
      return out;
    }
    if(skill==="math.addition.within_5"){
      max=5; a=intBetween(rnd,1,4); b=intBetween(rnd,1,Math.max(1,max-a));
    }else if(skill==="math.addition.within_20"){
      max=20; a=intBetween(rnd,2,19); b=intBetween(rnd,1,Math.max(1,max-a));
    }else if(skill==="math.subtraction.within_20"){
      plus=false; a=intBetween(rnd,2,20); b=intBetween(rnd,1,a);
    }else if(skill==="math.addition.within_100"){
      max=100; a=intBetween(rnd,11,89); b=intBetween(rnd,1,Math.max(1,max-a));
    }else if(skill==="math.subtraction.within_100"){
      plus=false; a=intBetween(rnd,11,99); b=intBetween(rnd,1,a);
    }else if(skill==="math.addition.within_200"){
      max=200; a=intBetween(rnd,40,149); b=intBetween(rnd,10,Math.max(10,max-a));
    }else return null;
    answer=plus?a+b:a-b; sign=plus?"+":"−";
    out={
      prompt:{type:"text",a:a,b:b,en:a+" "+sign+" "+b+" = ?",zh:a+" "+sign+" "+b+" = ?"},
      say:[a+(plus?" plus ":" minus ")+b,String(a)+(plus?"加":"減")+String(b)],
      answer:String(answer)
    };
    if(useChoices)out.choices=numChoices(rnd,answer,4,Math.max(3,Math.min(12,Math.ceil(max/10))));
    return out;
  }

  function genCalcTot(rnd,ctx){
    const directed=ctx&&ctx.mathSkill?directedCalcItem(rnd,ctx.mathSkill,true):null;
    if(directed)return directed;
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

  function genCalcMid(rnd,ctx){
    const directed=ctx&&ctx.mathSkill?directedCalcItem(rnd,ctx.mathSkill,false):null;
    if(directed)return directed;
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

  function genCalcHard(rnd,ctx){
    const directed=ctx&&ctx.mathSkill?directedCalcItem(rnd,ctx.mathSkill,false):null;
    if(directed)return directed;
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

  /* ---- 5. Number Bonds 數字好朋友 ----
     Keep the crunch id so existing daily completion/history stays attached.
     One valid pair per board keeps grading serializable across a saved round. */
  function bondsItem(rnd,count,minTarget,maxTarget){
    const target=intBetween(rnd,minTarget,maxTarget);
    const a=intBetween(rnd,0,Math.floor((target-1)/2)), b=target-a;
    const tiles=[a,b];
    shuffleWith(rnd,Array.from({length:target+1},function(_,i){return i;})).forEach(function(n){
      if(tiles.length<count&&tiles.indexOf(n)<0&&tiles.indexOf(target-n)<0)tiles.push(n);
    });
    const answer=a+" + "+b, wrong=[];
    for(let i=0;i<tiles.length;i++){
      for(let j=i+1;j<tiles.length;j++){
        if(tiles[i]+tiles[j]!==target)wrong.push(Math.min(tiles[i],tiles[j])+" + "+Math.max(tiles[i],tiles[j]));
      }
    }
    return {
      prompt:{type:"numberbonds",tiles:shuffleWith(rnd,tiles),target:target,
        en:"Which two make "+target+"?",zh:"哪兩個數字加起來是 "+target+"？"},
      say:["Tap two numbers that add up to "+target,"點兩個加起來是 "+target+" 的數字"],
      answer:answer,
      choices:shuffleWith(rnd,[answer].concat(shuffleWith(rnd,wrong).slice(0,3))),
      corrective:[answer+" = "+target,"數字好朋友："+answer+" = "+target]
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

  /* ---- 7. Change Maker 找零錢 (NT$) ----
     Bespoke Corner Shop scene (slice 35) reads the structured prompt fields
     below directly; moneyArt()/art stays so the generic fallback (js/brain/scenes/
     generic.js) keeps working unmodified until every client is migrated. */
  const COINS=[1,5,10,50];
  const NOTES=[100,500];
  const SHOP_PRODUCTS=[
    {id:"apple",   name:["Apple","蘋果"]},
    {id:"banana",  name:["Banana","香蕉"]},
    {id:"juice",   name:["Juice","果汁"]},
    {id:"milk",    name:["Milk","牛奶"]},
    {id:"bread",   name:["Bread","麵包"]},
    {id:"pencil",  name:["Pencil","鉛筆"]},
    {id:"notebook",name:["Notebook","筆記本"]},
    {id:"soap",    name:["Soap","肥皂"]},
    {id:"ball",    name:["Ball","球"]},
    {id:"flower",  name:["Flower","花"]}
  ];
  function moneyArt(n){
    /* a readable pile: notes then coins, biggest first */
    let left=n, out=[];
    NOTES.concat(COINS).sort(function(a,b){return b-a;}).forEach(function(v){
      while(left>=v){out.push(v>=100?"💵"+v:"🪙"+v);left-=v;}
    });
    return out.join(" ");
  }
  /* Greedy piece count for a denomination set; Infinity when the set cannot
     represent the amount exactly (change.js's generator retries below 14). */
  function greedyPieceCount(amount,denominations){
    let left=amount, count=0;
    denominations.slice().sort(function(a,b){return b-a;}).forEach(function(d){
      const n=Math.floor(left/d); count+=n; left-=n*d;
    });
    return left===0?count:Infinity;
  }
  function changeTot(rnd){
    let a=pick(rnd,COINS), b=pick(rnd,COINS);
    while(b===a)b=pick(rnd,COINS);
    const big=Math.max(a,b);
    return {
      prompt:{type:"money",mode:"compare",coins:[a,b],art:"🪙"+a+"   🪙"+b,
        en:"Which is worth more?",zh:"哪個比較多錢？"},
      say:["Which is worth more?","哪個比較多錢？"],
      answer:String(big), choices:shuffleWith(rnd,[String(a),String(b)])
    };
  }
  function changeItem(rnd,maxPrice,payOptions,denominations){
    let price,paid,change,guard=0;
    do{
      price=intBetween(rnd,3,maxPrice);
      paid=pick(rnd,payOptions.filter(function(p){return p>price;}));
      change=paid-price;
      guard++;
    }while(greedyPieceCount(change,denominations)>14&&guard<200);
    const product=pick(rnd,SHOP_PRODUCTS);
    return {
      prompt:{type:"money",mode:"make-change",
        productId:product.id,productName:product.name.slice(),
        price:price,paid:paid,change:change,denominations:denominations.slice(),
        art:moneyArt(paid),
        en:product.name[0]+" costs NT$"+price+". You pay NT$"+paid+".",
        zh:product.name[1]+" NT$"+price+"，你付 NT$"+paid+"。"},
      answer:String(change)
    };
  }

  /* ---- 8. Word Memory 記單字 ----
     Words are injected from index.html's VOCAB at boot; the fallback keeps
     this module standalone for node tests and for a config-less local run. */
  let WORD_POOL=["cat","dog","fish","bird","apple","water","house","book",
    "green","jump","friend","music","river","cloud","spoon","tiger"];
  const EMOJI_POOL=["🐱","🐶","🐟","🐦","🍎","💧","🏠","📚","🌳","⭐","🚗","🎈"];
  let BOPOMOFO_POOL=["ㄇㄠ","ㄍㄡˇ","ㄩˊ","ㄋㄧㄠˇ","ㄆㄧㄥˊㄍㄨㄛˇ","ㄕㄨㄟˇ","ㄕㄨ","ㄆㄥˊㄧㄡˇ"];
  let INPUT_SCRIPT="abc";
  function setWordPool(list){if(list&&list.length>=12)WORD_POOL=list.slice();}
  function setBopomofoPool(list){if(list&&list.length>=8)BOPOMOFO_POOL=list.slice();}
  function setInputScript(mode){INPUT_SCRIPT=mode==="bpmf"?"bpmf":"abc";}
  function cleanBopomofo(s){return String(s||"").replace(/[^\u3105-\u312f\u02ca\u02c7\u02cb\u02d9]+/g,"");}

  function wordMemItem(rnd,count,studyMs){
    const bpmf=INPUT_SCRIPT==="bpmf";
    const words=shuffleWith(rnd,(bpmf?BOPOMOFO_POOL:WORD_POOL).slice()).slice(0,count);
    const want={};
    words.forEach(function(w){want[bpmf?cleanBopomofo(w):w.toLowerCase()]=true;});
    return {
      prompt:{type:"wordlist",words:words,studyMs:studyMs,
        en:bpmf?"Remember these Bopomofo":"Remember these words",
        zh:bpmf?"記住這些注音":"記住這些單字"},
      worth:count,
      answer:words.join(" "),
      grade:function(given){
        const hit={};
        if(bpmf){
          String(given).split(/[^\u3105-\u312f\u02ca\u02c7\u02cb\u02d9]+/).forEach(function(w){
            w=cleanBopomofo(w); if(w&&want[w])hit[w]=true;
          });
        }else{
          String(given).toLowerCase().split(/[^a-z']+/).forEach(function(w){
            if(w&&want[w])hit[w]=true;
          });
        }
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

  /* ---- Brain Gym expansion: math generators ---- */
  function fractionItem(rnd,tier,ctx){
    const i=ctx&&ctx.i||0, previous=ctx&&ctx.items||[];
    const mode=tier==="tot"?(i<3?"share":"left"):(i%4<2?"share":"left");
    const equivalent=tier==="hard"||(tier==="mid"&&i>=4);
    const denominators=tier==="tot"?(i===0?[2]:[4]):tier==="mid"?(equivalent?[2,3,4]:[3,4,5,6]):i<4?[3,4]:[5,6];
    const candidates=[];
    denominators.forEach(function(d){
      const factors=equivalent?(d<=4?[2,3]:[2]):[1];
      factors.forEach(function(f){
        for(let n=1;n<d;n++){
          if(tier==="tot"&&n!==[1,1,2,1,2,3][i%6])continue;
          if(!previous.some(function(item){const p=item.prompt;return (p.mode||"share")===mode&&p.numerator===n&&p.denominator===d&&p.pieces===d*f;}))candidates.push([n,d,d*f]);
        }
      });
    });
    const chosen=pick(rnd,candidates), numerator=chosen[0], denominator=chosen[1], pieces=chosen[2];
    const shared=pieces*numerator/denominator, answer=mode==="left"?pieces-shared:shared;
    const fraction=numerator+"/"+denominator, remaining=(denominator-numerator)+"/"+denominator;
    const foods=[["sandwich","sandwich","三明治"],["waffle","waffle","格子鬆餅"],["melon","melon","西瓜"]];
    const food=pick(rnd,foods.filter(function(f){return !previous.length||f[0]!==previous[previous.length-1].prompt.food;}));
    const instruction=mode==="left"?
      ["After sharing "+fraction+" of the "+food[1]+", how many of its "+pieces+" equal pieces are left?","把"+food[2]+"切成 "+pieces+" 等份，分出 "+fraction+" 後，還剩幾塊？"]:
      ["Share "+fraction+" of a "+food[1]+" cut into "+pieces+" equal pieces. How many pieces?",food[2]+"切成 "+pieces+" 等份，分出其中的 "+fraction+"。需要幾塊？"];
    const worked=pieces+" ÷ "+denominator+" × "+numerator+" = "+shared;
    const explanation=mode==="left"?
      ["Shared: "+worked+" pieces. Left: "+pieces+" − "+shared+" = "+answer+" pieces; "+answer+"/"+pieces+" = "+remaining+".","先分出："+worked+" 塊。剩下："+pieces+" − "+shared+" = "+answer+" 塊；"+answer+"/"+pieces+" = "+remaining+"。"]:
      ["Split into "+denominator+" equal groups, then take "+numerator+": "+worked+" pieces. "+answer+"/"+pieces+" = "+fraction+".","先分成 "+denominator+" 組，再取 "+numerator+" 組："+worked+" 塊。"+answer+"/"+pieces+" = "+fraction+"。"];
    return {
      prompt:{type:"text",mode:mode,food:food[0],foodName:food.slice(1),numerator:numerator,denominator:denominator,pieces:pieces,
        columns:pieces%4===0?pick(rnd,pieces===4?[2,4]:[4]):pieces%3===0?3:pieces===5||pieces===10?5:2,
        en:instruction[0],zh:instruction[1]},
      say:instruction.slice(),
      answer:String(answer),
      choices:shuffleWith(rnd,[String(answer)].concat(shuffleWith(rnd,Array.from({length:pieces+1},function(_,i){return String(i);})).filter(function(n){return n!==String(answer);}).slice(0,3))),
      corrective:explanation,
      lesson:{topic:mode==="left"?["Fractions left over","剩下的分數"]:equivalent?["Equivalent fractions","等值分數"]:["Equal parts of a whole","整體的等份"],
        hint:mode==="left"?["Find the shared part first. Take those pieces away from the whole to find what is left.","先找出分出去的份量，再從全部扣掉，看看剩下多少。"]:
          ["The bottom number counts equal groups in one whole. Find one group, then take as many groups as the top number.","分母表示一個整體分成幾等份。先找到一等份，再依分子取出需要的份數。"],
        explanation:explanation}
    };
  }

  function balanceItem(rnd,tier,ctx){
    const i=ctx&&ctx.i||0, previous=ctx&&ctx.items||[];
    const op=(tier==="tot"?["+","+","+","+","−","−"]:tier==="mid"?["+","+","−","−","×","×","÷","÷"]:["×","×","÷","÷","+","−","×","÷"])[i%(tier==="tot"?6:8)];
    const missing=i%2?"left":"right", cap=tier==="tot"?10:tier==="mid"?20:50;
    const candidates=[];
    const limit=op==="×"?(tier==="mid"?5:12):op==="÷"?(tier==="mid"?24:144):cap;
    for(let left=op==="×"?2:1;left<=limit;left++){
      for(let right=op==="×"||op==="÷"?2:1;right<=(op==="÷"?12:limit);right++){
        if(op==="+"&&left+right>cap)continue;
        if(tier==="tot"&&op==="+"&&(missing==="left"?right:left)>6)continue;
        if(op==="−"&&left<=right)continue;
        if(op==="−"&&missing==="right"&&left<4)continue;
        if(op==="÷"&&(left%right!==0||left/right<2||left/right>(tier==="mid"?10:12)))continue;
        if(op==="÷"&&missing==="right"&&Array.from({length:left},function(_,n){return n+1;}).filter(function(n){return left%n===0;}).length<4)continue;
        const target=op==="+"?left+right:op==="−"?left-right:op==="×"?left*right:left/right;
        const known=missing==="left"?right:left;
        if(!previous.some(function(item){const p=item.prompt;return p.op===op&&(p.missing||"right")===missing&&p.a===known&&p.target===target;}))candidates.push([known,target,missing==="left"?left:right]);
      }
    }
    const chosen=pick(rnd,candidates), a=chosen[0], target=chosen[1], answer=chosen[2];
    let pool=null;
    if(op==="÷")pool=missing==="left"?Array.from({length:12},function(_,n){return (n+1)*a;}):Array.from({length:a},function(_,n){return n+1;}).filter(function(n){return a%n===0;});
    else if(op==="−")pool=Array.from({length:missing==="left"?cap:a},function(_,n){return missing==="left"?a+n:n;});
    else if(tier==="tot")pool=Array.from({length:cap-a+1},function(_,n){return n;});
    const choices=pool?shuffleWith(rnd,[String(answer)].concat(shuffleWith(rnd,pool.filter(function(n){return n!==answer;})).slice(0,3).map(String))):numChoices(rnd,answer,4,6);
    const equation=(missing==="left"?"?":a)+" "+op+" "+(missing==="left"?a:"?")+" = "+target;
    const solved=(missing==="left"?answer:a)+" "+op+" "+(missing==="left"?a:answer)+" = "+target;
    const inverse=op==="+"?target+" − "+a:op==="−"?(missing==="left"?target+" + "+a:a+" − "+target):op==="×"?target+" ÷ "+a:missing==="left"?target+" × "+a:a+" ÷ "+target;
    const hint=op==="+"?["Take the known part away from the total to find the missing part.","從總數扣掉已知的部分，就能找到少掉的部分。"]:
      op==="−"?(missing==="left"?["Put the removed part and the part left back together.","把拿走的部分和剩下的部分加回來。"]:["Compare the starting amount with the amount left to find what was removed.","比較原本和剩下的數量，找出拿走了多少。"]):
      op==="×"?["Split the total into equal groups using the known factor.","用已知的因數，把總數分成相同大小的組。"]:
      missing==="left"?["Multiply the size of each group by the number of groups to rebuild the total.","把每組的數量乘上組數，找回原本的總數。"]:["Divide the starting amount by the result to find the missing divisor.","把原本的數量除以答案，找出缺少的除數。"];
    const explanation=[inverse+" = "+answer+". Check: "+solved+".",inverse+" = "+answer+"。代回去檢查："+solved+"。"];
    return {
      prompt:{type:"text",a:a,op:op,missing:missing,target:target,blocks:choices.map(Number),
        en:equation+". Pick the missing number.",zh:equation+"。找出缺少的數字。"},
      say:["Find the missing number to make both sides equal.","找出缺少的數字，讓兩邊一樣大。"],
      answer:String(answer),choices:choices,
      corrective:explanation,
      lesson:{topic:op==="+"?["Find a missing part","找出缺少的部分"]:op==="−"?["Undo subtraction","倒推減法"]:op==="×"?["Equal groups","相同大小的組"]:["Division and multiplication","除法與乘法"],hint:hint,explanation:explanation}
    };
  }

  /* ---- Brain Gym expansion: science generators ---- */

  const CIRCUIT_MATERIALS=[
    {id:"copper",name:["Copper wire","銅線"],conducts:true},
    {id:"foil",name:["Aluminum foil","鋁箔"],conducts:true},
    {id:"steel",name:["Steel paper clip","鋼製迴紋針"],conducts:true},
    {id:"plastic",name:["Plastic spoon","塑膠湯匙"],conducts:false},
    {id:"rubber",name:["Rubber eraser","橡皮擦"],conducts:false},
    {id:"glass",name:["Glass bead","玻璃珠"],conducts:false}
  ];
  function circuitItem(rnd,tier,ctx){
    const index=ctx&&ctx.i||0, predict=index>=2;
    const count=tier==="tot"||tier==="hard"&&!predict?1:2, goalOn=tier!=="tot"||index===0;
    const layout=tier==="hard"&&index>=4?"parallel":"series";
    const materials=tier!=="hard"?[]:predict?[pick(rnd,CIRCUIT_MATERIALS.slice(index===6?3:0,index===6?6:3))]:shuffleWith(rnd,[pick(rnd,CIRCUIT_MATERIALS.slice(0,3))].concat(shuffleWith(rnd,CIRCUIT_MATERIALS.slice(3)).slice(0,2)));
    const patterns=[[true,true],[true,false],[false,true],[false,false]];
    const initial=predict?(count===1?[index%2===0]:shuffleWith(rnd,patterns[(index-2)%4])):(count===1?[!goalOn]:pick(rnd,[[false,false],[true,false],[false,true]]));
    const configurations=[];
    for(let m=0;m<Math.max(1,materials.length);m++){
      for(let bits=0;bits<Math.pow(2,count);bits++){
        const switches=Array.from({length:count},function(_,i){return !!(bits&(1<<i));});
        const labels=switches.map(function(closed,i){return (count>1?String.fromCharCode(65+i)+" ":"")+(closed?"closed / 閉合":"open / 斷開");});
        configurations.push({switches:switches,material:materials.length?m:-1,value:(materials.length?materials[m].name.join(" / ")+" + ":"")+labels.join(" + ")});
      }
    }
    const target=configurations.find(function(c){return c.switches.every(function(v){return v===goalOn;})&&(!materials.length||materials[c.material].conducts);});
    const instruction=predict?["Predict before testing: will the bulb light?","先預測，再測試：燈泡會亮嗎？"]:tier==="hard"?["Choose a material and set the switch to light the bulb.","選擇材料並調整開關，讓燈泡亮起來。"]:goalOn?["Set the switches to light the bulb.","調整開關，讓燈泡亮起來。"]:["Set the switch to turn the bulb off.","調整開關，讓燈泡熄滅。"];
    const stateEn=initial.map(function(closed,i){return String.fromCharCode(65+i)+(closed?" closed":" open");}).join(", ");
    const stateZh=initial.map(function(closed,i){return String.fromCharCode(65+i)+(closed?" 閉合":" 斷開");}).join("、");
    const setupEn=layout==="parallel"?"A and B are on separate parallel branches; the bulb and material are on the shared return path.":count===2?"A and B are in series on one path.":"One battery, one switch and one bulb form a loop.";
    const setupZh=layout==="parallel"?"A、B 在兩條並聯支路上；燈泡和材料都在共用的回路上。":count===2?"A、B 串聯在同一條路徑上。":"一個電池、一個開關和一個燈泡連成電路。";
    const materialText=materials.length?(predict?" Installed material: "+materials[0].name[0]+".":" Materials: "+materials.map(function(m){return m.name[0];}).join(", ")+"."):"";
    const materialZh=materials.length?(predict?" 已裝入材料："+materials[0].name[1]+"。":" 可用材料："+materials.map(function(m){return m.name[1];}).join("、")+"。"):"";
    const conducting=!materials.length||materials[0].conducts;
    const closed=layout==="parallel"?initial.some(Boolean):initial.every(Boolean), powered=closed&&conducting;
    const topic=layout==="parallel"?["Parallel paths","並聯路徑"]:tier==="hard"?["Conductors and complete circuits","導體與完整電路"]:count===2?["Switches in series","串聯開關"]:["Open and closed circuits","斷開與閉合電路"];
    const hint=layout==="parallel"?["Trace each branch from the battery through the bulb and back. Check the shared material too.","從電池出發，沿各條支路經過燈泡再回來。也要檢查共用的材料。"]:tier==="hard"?["Check two things: can current cross the material, and is there an unbroken loop?","想兩件事：電流能通過這個材料嗎？整條電路有沒有中斷？"]:["Trace the wire all the way around. A gap in the path stops the current.","沿著導線走完整圈。路徑有缺口時，電流就無法通過。"];
    let reason=predict?[powered?"The bulb lights. ":"The bulb stays off. ",powered?"燈泡會亮。":"燈泡不會亮。"]:[goalOn?"The bulb lights when the loop is complete. ":"Opening the switch breaks the loop. ",goalOn?"電路完整時，燈泡會亮。":"斷開開關會切斷回路。"];
    if(predict){
      const why=!conducting?[materials[0].name[0]+" is an insulator, so it interrupts the shared return path.",materials[0].name[1]+"是絕緣體，會阻斷共用回路。"]:layout==="parallel"?(closed?["At least one branch is closed, so current has a complete route through the bulb.","至少一條支路閉合，電流就有經過燈泡的完整路徑。"]:["Both branches are open, so neither gives current a complete route.","兩條支路都斷開，電流沒有完整路徑。"]):closed?["Every switch on the path is closed, leaving an unbroken loop.","路徑上的每個開關都閉合，形成完整電路。"]:["An open switch breaks the only path through the bulb.","有一個開關斷開，就會切斷經過燈泡的唯一路徑。"];
      reason=[reason[0]+stateEn+". "+why[0],reason[1]+stateZh+"。"+why[1]];
    }else if(materials.length){
      const good=materials[target.material];reason=[reason[0]+good.name[0]+" conducts electricity; the switch must also close.",reason[1]+good.name[1]+"可以導電；開關也必須閉合。"];
    }else reason=[reason[0]+"Electric current needs a complete route through the battery and bulb.",reason[1]+"電流需要經過電池和燈泡的完整路徑。"];
    return {
      prompt:{type:"circuit",mode:predict?"predict":"build",layout:layout,switches:initial,materials:materials,materialIndex:predict&&materials.length?0:-1,configurations:configurations,goalOn:goalOn,instruction:instruction,
        en:instruction[0]+" "+setupEn+" "+stateEn+"."+materialText,zh:instruction[1]+setupZh+stateZh+"。"+materialZh},
      say:instruction.slice(),answer:predict?(powered?"Bulb on / 燈泡會亮":"Bulb off / 燈泡不亮"):target.value,
      choices:predict?shuffleWith(rnd,["Bulb on / 燈泡會亮","Bulb off / 燈泡不亮"]):shuffleWith(rnd,[target.value].concat(shuffleWith(rnd,configurations.filter(function(c){return c!==target;}).map(function(c){return c.value;})).slice(0,3))),
      corrective:reason,lesson:{topic:topic,hint:hint,explanation:reason.slice()}
    };
  }

  const SCIENCE_CATEGORIES={animal:["Animal","動物"],plant:["Plant","植物"],solid:["Solid","固體"],liquid:["Liquid","液體"],gas:["Gas","氣體"],mammal:["Mammal","哺乳類"],bird:["Bird","鳥類"],fish:["Fish","魚類"],reptile:["Reptile","爬蟲類"],amphibian:["Amphibian","兩棲類"],living:["Living thing","生物"],neverliving:["Never alive","從未有生命"],root:["Roots","根"],stem:["Stem","莖"],leaf:["Leaves","葉子"],melting:["Melting","融化"],freezing:["Freezing","凝固"],evaporation:["Evaporation","蒸發"],condensation:["Condensation","凝結"],magnetic:["Magnet picks it up","磁鐵能吸起來"],nonmagnetic:["Magnet cannot pick it up","磁鐵無法吸起來"],conductor:["Conductor","導體"],insulator:["Insulator","絕緣體"]};
  const SCIENCE_SPECIMENS={
    tot:[
      ["cat","Cat","貓","animal","A cat eats food and grows. It is an animal.","貓會吃東西、長大，是動物。"],
      ["fish","Goldfish","金魚","animal","A goldfish is an animal that lives in water.","金魚是生活在水裡的動物。"],
      ["bird","Sparrow","麻雀","animal","A sparrow is an animal with feathers.","麻雀是有羽毛的動物。"],
      ["frog","Frog","青蛙","animal","A frog eats small animals such as insects.","青蛙會吃昆蟲等小動物，牠是動物。"],
      ["flower","Sunflower","向日葵","plant","A sunflower uses sunlight to make food.","向日葵利用陽光製造養分，是植物。"],
      ["tree","Oak tree","橡樹","plant","An oak tree has roots, a trunk and leaves.","橡樹有根、樹幹和葉子，是植物。"],
      ["cactus","Cactus","仙人掌","plant","A cactus is a plant that stores water in its stem.","仙人掌是會在莖裡儲存水分的植物。"],
      ["grass","Grass","草","plant","Grass has roots and uses sunlight to make food.","草有根，會利用陽光製造養分，是植物。"]
    ],
    mid:[
      ["stone","Pebble","小石頭","solid","A pebble keeps its shape when you move it.","小石頭移動後仍保有自己的形狀，是固體。"],
      ["book","Book","書本","solid","A book keeps its own shape.","書本保有自己的形狀，是固體。"],
      ["spoon","Steel spoon","鋼製湯匙","solid","A steel spoon keeps its shape at room temperature.","鋼製湯匙在室溫下保有自己的形狀，是固體。"],
      ["water","Water","水","liquid","Water flows and takes the shape of its container.","水會流動，形狀會隨著容器改變，是液體。"],
      ["milk","Milk","牛奶","liquid","Milk flows and takes the shape of its container.","牛奶會流動，形狀會隨著容器改變，是液體。"],
      ["oil","Olive oil","橄欖油","liquid","Olive oil flows at room temperature.","橄欖油在室溫下會流動，是液體。"],
      ["air","Air","空氣","gas","Air spreads out to fill the space available.","空氣會散開，充滿可以進入的空間，是氣體。"],
      ["oxygen","Oxygen","氧氣","gas","Oxygen is a gas at room temperature.","氧氣在室溫下是氣體。"],
      ["co2","Carbon dioxide","二氧化碳","gas","Carbon dioxide is a gas at room temperature.","二氧化碳在室溫下是氣體。"]
    ],
    hard:[
      ["dolphin","Dolphin","海豚","mammal","A dolphin breathes air and feeds its young milk.","海豚用肺呼吸空氣，並用乳汁哺育幼兒，是哺乳類。"],
      ["bat","Bat","蝙蝠","mammal","A bat has fur and feeds its young milk.","蝙蝠有毛，會用乳汁哺育幼兒，是哺乳類。"],
      ["penguin","Penguin","企鵝","bird","A penguin has feathers, even though it cannot fly.","企鵝雖然不會飛，仍有羽毛，是鳥類。"],
      ["bird","Sparrow","麻雀","bird","A sparrow has feathers and a beak.","麻雀有羽毛和鳥喙，是鳥類。"],
      ["fish","Salmon","鮭魚","fish","Salmon breathe through gills and have fins.","鮭魚用鰓呼吸，也有魚鰭，是魚類。"],
      ["shark","Shark","鯊魚","fish","Sharks are fish with gills and skeletons made of cartilage.","鯊魚有鰓，骨骼由軟骨組成，是魚類。"],
      ["turtle","Turtle","烏龜","reptile","A turtle breathes with lungs and has scaly skin.","烏龜用肺呼吸，皮膚有鱗片，是爬蟲類。"],
      ["snake","Snake","蛇","reptile","A snake has dry, scaly skin and breathes with lungs.","蛇的皮膚乾燥、有鱗片，並用肺呼吸，是爬蟲類。"],
      ["frog","Frog","青蛙","amphibian","A frog has moist skin. Its life usually begins as a tadpole.","青蛙的皮膚濕潤，多數從蝌蚪開始成長，是兩棲類。"],
      ["salamander","Salamander","蠑螈","amphibian","Salamanders have moist skin without scales.","蠑螈的皮膚濕潤、沒有鱗片，是兩棲類。"]
    ]
  };
  /* Phase changes: USGS Water Science School; plant parts: NPS Plant Adaptations.
     Magnet questions mean an ordinary classroom magnet, not laboratory fields. */
  const SCIENCE_TOPICS={
    animals:{topic:["Animals and plants","動物與植物"],keys:["animal","plant"],question:["Animal or plant?","動物還是植物？"],hint:["Think about how it gets food: does it eat, or make food using sunlight?","想想它如何獲得養分：吃食物，還是利用陽光製造養分？"],rows:SCIENCE_SPECIMENS.tot},
    living:{topic:["Living and never-living things","生物與從未有生命的物品"],keys:["living","neverliving"],question:["Living now, or never alive?","現在是生物，還是從未有生命？"],hint:["Living things use nourishment and grow as part of a life cycle. Moving alone does not mean something is alive.","生物需要養分，會在生命週期中生長。會動的物品不一定有生命。"],rows:[
      ["living-snail","A live snail","活著的蝸牛","living","A snail eats, grows and has young. It is a living animal.","蝸牛會吃東西、長大、繁殖，是有生命的動物。","snail"],
      ["living-seedling","A growing bean plant","正在生長的豆苗","living","A bean plant needs water and makes food using sunlight. Plants are alive too.","豆苗需要水，會利用陽光製造養分。植物也有生命。","grass"],
      ["living-butterfly","A live butterfly","活著的蝴蝶","living","A butterfly feeds and has a life cycle, so it is a living thing.","蝴蝶會進食，也有生命週期，是生物。","butterfly"],
      ["never-robot","A plastic toy robot","塑膠玩具機器人","neverliving","A toy robot can move using a battery, but it has never been alive.","玩具機器人可以靠電池移動，但它從來沒有生命。","robot"],
      ["never-pebble","A pebble","小石頭","neverliving","A pebble does not eat or have a life cycle. It has never been alive.","小石頭不會進食，也沒有生命週期，它從來沒有生命。","stone"],
      ["never-water","A cup of water","一杯水","neverliving","Living things need water, but water itself is not alive.","生物需要水，但水本身沒有生命。","water"]
    ]},
    plantparts:{topic:["Jobs of plant parts","植物各部位的工作"],keys:["root","stem","leaf"],question:["Which part of a bean plant does this job?","豆苗的哪個部位負責這項工作？"],hint:["Look at where the job happens: below the soil, along the stalk, or on the broad green parts.","想想工作在哪裡進行：土裡、枝幹上，還是寬寬綠綠的部位？"],rows:[
      ["plant-water","Take in water from the soil","從土壤吸收水分","root","Roots absorb water from the soil and send it into the plant.","根從土壤吸收水分，再送進植物裡。","flower"],
      ["plant-anchor","Hold the plant in the soil","把植物固定在土裡","root","Roots spread through the soil and anchor the plant.","根在土壤裡伸展，能固定植物。","flower"],
      ["plant-carry","Carry water up to the leaves","把水送到葉子","stem","The stem contains tubes that carry water from the roots toward the leaves.","莖裡有運送水分的管道，把根吸收的水送到葉子。","flower"],
      ["plant-support","Hold leaves up above the soil","把葉子支撐在土壤上方","stem","The stem supports the leaves, helping them reach light.","莖支撐葉子，幫助葉子接觸陽光。","flower"],
      ["plant-food","Use sunlight to make most of the food","利用陽光製造大部分養分","leaf","The green leaves of a bean plant use light to make sugars for the plant.","豆苗的綠色葉子利用光來製造植物需要的糖分。","flower"]
    ]},
    states:{topic:["States of matter","物質的狀態"],keys:["solid","liquid","gas"],question:["At room temperature (about 20°C), which state?","在室溫（約 20°C）下，是哪一種狀態？"],hint:["Does it keep its shape, flow to fit a container, or spread through all the available space?","它會保持形狀、流動並隨容器改變形狀，還是散開充滿空間？"],rows:SCIENCE_SPECIMENS.mid},
    changes:{topic:["Water changes state","水的狀態變化"],keys:["melting","freezing","evaporation","condensation"],question:["Which change is happening?","正在發生哪一種變化？"],hint:["Name the starting state and the ending state: solid, liquid or gas. Then match the change.","先找出開始和結束的狀態：固體、液體或氣體，再配對變化名稱。"],rows:[
      ["change-ice","An ice cube becomes liquid water","冰塊變成液態的水","melting","Ice starts as a solid and becomes liquid water when it gains enough heat: melting.","固態的冰吸收足夠熱量後變成液態水，這叫融化。","ice"],
      ["change-snow","Snow becomes liquid water in the sun","雪在陽光下變成液態水","melting","Snow is solid water. Solid water changing to liquid is melting.","雪是固態的水。固體變成液體，叫做融化。","ice"],
      ["change-freezer","Liquid water becomes ice in a freezer","液態水在冷凍庫裡結成冰","freezing","Liquid water loses heat and becomes solid ice: freezing.","液態水失去熱量，變成固態的冰，這叫凝固。","ice"],
      ["change-pond","The liquid surface of a pond turns to ice","池塘表面的液態水結成冰","freezing","The pond water changes from liquid to solid. That is freezing.","池塘的水由液態變成固態，這叫凝固。","ice"],
      ["change-puddle","A puddle dries into water vapor","水窪的水變成水蒸氣而乾掉","evaporation","Liquid water leaves the puddle as invisible water vapor: evaporation.","水窪中的液態水變成看不見的水蒸氣離開，這叫蒸發。","water"],
      ["change-towel","Water in a wet towel goes into the air","濕毛巾裡的水進入空氣中","evaporation","Water changes from liquid in the towel to water vapor in the air: evaporation.","毛巾中的液態水變成空氣中的水蒸氣，這叫蒸發。","water"],
      ["change-glass","Water vapor forms drops outside a cold glass","水蒸氣在冷杯子外面形成水滴","condensation","Water vapor in the air cools to form liquid drops on the outside: condensation.","空氣中的水蒸氣冷卻，在杯外形成液態水滴，這叫凝結。","drops"],
      ["change-mirror","Water vapor becomes drops on a cool mirror","水蒸氣在冷鏡面上變成水滴","condensation","Water changes from gas to liquid on the cool mirror: condensation.","水在冷鏡面上由氣態變成液態，這叫凝結。","drops"]
    ]},
    magnets:{topic:["What a magnet picks up","磁鐵能吸起什麼"],keys:["magnetic","nonmagnetic"],question:["Can an ordinary classroom magnet pick it up?","一般教室用的磁鐵能吸起它嗎？"],hint:["A shiny surface is not enough. Think about what material the object is made of.","表面亮亮的不代表能被吸起。想想物品是用什麼材料做的。"],rows:[
      ["magnet-nail","Small iron nail","小鐵釘","magnetic","Iron is strongly attracted to a magnet, so the small nail can be picked up.","鐵會被磁鐵強烈吸引，所以小鐵釘能被吸起。","nail"],
      ["magnet-ring","Small iron ring","小鐵環","magnetic","The ring is made of iron, which is strongly attracted to a magnet.","這個環是鐵製的，鐵會被磁鐵強烈吸引。","ring"],
      ["magnet-foil","Aluminum foil","鋁箔","nonmagnetic","An ordinary magnet cannot pick up aluminum foil. Being metal is not enough.","一般磁鐵無法吸起鋁箔。金屬不一定能被磁鐵吸起。","foil"],
      ["magnet-copper","Copper wire","銅線","nonmagnetic","An ordinary magnet cannot pick up copper wire, even though copper is a metal.","銅雖然是金屬，一般磁鐵仍無法吸起銅線。","wire"],
      ["magnet-plastic","Plastic spoon","塑膠湯匙","nonmagnetic","Plastic is not strongly attracted to a magnet, so the spoon stays put.","塑膠不會被磁鐵強烈吸引，所以湯匙不會被吸起。","spoon"],
      ["magnet-glass","Glass bead","玻璃珠","nonmagnetic","An ordinary magnet cannot pick up a glass bead.","一般磁鐵無法吸起玻璃珠。","ring"]
    ]},
    vertebrates:{topic:["Animal groups","動物分類"],keys:["mammal","bird","fish","reptile","amphibian"],question:["Which animal group?","屬於哪一類動物？"],hint:["Look for body clues such as feathers, fur, scales or gills. Where it lives is not enough.","想想羽毛、毛、鱗片、鰓等身體特徵，只看住在哪裡還不夠。"],rows:SCIENCE_SPECIMENS.hard},
    conductors:{topic:["Electrical conductors and insulators","電的導體與絕緣體"],keys:["conductor","insulator"],question:["In a small battery circuit, conductor or insulator?","在小電池電路裡，是導體還是絕緣體？"],hint:["The current needs a material it can pass through. Magnetism and electrical conduction are different properties.","電流需要能讓它通過的材料。磁性和導電性是不同的特性。"],rows:CIRCUIT_MATERIALS.map(function(m){return ["conduct-"+m.id,m.name[0],m.name[1],m.conducts?"conductor":"insulator",m.conducts?m.name[0]+" lets current pass through, so it can bridge a gap in the battery circuit.":m.name[0]+" blocks current in this small battery circuit, so the bulb stays off.",m.conducts?m.name[1]+"能讓電流通過，可以接通小電池電路的缺口。":m.name[1]+"會阻擋這個小電池電路的電流，所以燈泡不會亮。",m.id==="copper"?"wire":m.id==="foil"?"foil":m.id==="steel"?"clip":m.id==="plastic"?"spoon":m.id==="rubber"?"eraser":"ring"];})}
  };
  function scienceSorterItem(rnd,tier,ctx){
    const used=ctx&&ctx.items?ctx.items.map(function(item){return item.prompt.specimen.id;}):[];
    const order=tier==="tot"?["animals","animals","living","living","plantparts","plantparts"]:tier==="mid"?["states","states","states","changes","changes","changes","magnets","magnets"]:["vertebrates","vertebrates","changes","changes","magnets","magnets","conductors","conductors"];
    const topicId=order[(ctx&&ctx.i||0)%order.length], topic=SCIENCE_TOPICS[topicId];
    const available=topic.rows.filter(function(row){return used.indexOf(row[0])<0;});
    const row=pick(rnd,available.length?available:topic.rows), keys=topic.keys, instruction=topic.question;
    return {
      prompt:{type:"science-sort",topicId:topicId,question:instruction.slice(),specimen:{id:row[0],icon:row[6]||row[0],name:[row[1],row[2]]},categories:keys.map(function(key){return {id:key,name:SCIENCE_CATEGORIES[key].slice(),value:SCIENCE_CATEGORIES[key].join(" / ")};}),en:row[1]+" — "+instruction[0],zh:row[2]+"："+instruction[1]},
      say:[row[1]+". "+instruction[0],row[2]+"。"+instruction[1]],
      answer:SCIENCE_CATEGORIES[row[3]].join(" / "),choices:keys.map(function(key){return SCIENCE_CATEGORIES[key].join(" / ");}),corrective:[row[4],row[5]],
      lesson:{topic:topic.topic.slice(),hint:topic.hint.slice(),explanation:[row[4],row[5]]}
    };
  }

  /* ---- Brain Gym expansion: language generators ---- */
  const TRAIN_SENTENCES={
    tot:[
      ["I like apples.","我喜歡蘋果。","🍎","Tell us what you like.","action","I is the speaker; like is the action; apples is the food.","I 是說話的人，like 表示喜歡，apples 是喜歡的食物。"],
      ["I see cats.","我看見貓。","🐱","Tell us what you see.","action","I comes before see; cats tells us what is seen.","I 放在 see 前面，cats 說明看見什麼。"],
      ["Dogs can run.","狗會跑。","🐶","Tell us what dogs can do.","ability","Dogs names the animals. Put can before the action run.","Dogs 是動物，can 放在動作 run 前面。"],
      ["Birds can fly.","鳥會飛。","🐦","Tell us what birds can do.","ability","Can goes between Birds and fly to show an ability.","can 放在 Birds 和 fly 之間，表示會做的事。"],
      ["Fish can swim.","魚會游泳。","🐟","Tell us what fish can do.","ability","Fish names who can do the action; swim follows can.","Fish 說明誰會做這個動作，swim 放在 can 後面。"],
      ["I drink water.","我喝水。","💧","Tell us what you drink.","action","Start with I, then drink; water is what is drunk.","先說 I，再說動作 drink，water 是喝的東西。"],
      ["I eat rice.","我吃米飯。","🍚","Tell us what you eat.","action","I does the eating. Rice follows the action eat.","I 是吃的人，rice 放在動作 eat 後面。"],
      ["I see birds.","我看見鳥。","🐦","Describe seeing birds.","action","The order is who, action, then what: I, see, birds.","順序是誰、動作、看見什麼：I、see、birds。"],
      ["I love cats.","我喜愛貓。","🐱","Tell us which animals you love.","action","Love follows I; cats tells us which animals are loved.","love 接在 I 後面，cats 說明喜愛哪種動物。"],
      ["We play games.","我們玩遊戲。","🎲","Tell us what we play.","action","We means more than one person; games follows play.","We 表示我們這些人，games 接在 play 後面。"],
      ["We read books.","我們讀書。","📚","Tell us what we read.","action","We names the readers. Books is what they read.","We 是讀的人，books 是讀的東西。"],
      ["Birds have wings.","鳥有翅膀。","🐦","Describe what birds have.","have","Birds comes first, then have; wings tells us what they have.","先說 Birds，再說 have，wings 說明牠們有什麼。"],
      ["Cats have tails.","貓有尾巴。","🐱","Describe what cats have.","have","Have connects Cats with the body part tails.","have 把 Cats 和身體部位 tails 連起來。"],
      ["Dogs need water.","狗需要水。","🐶💧","Tell us what dogs need.","action","Dogs names the animals; water follows need.","Dogs 是動物，water 放在 need 後面，表示需要水。"],
      ["Flowers need sunlight.","花需要陽光。","🌸☀️","Tell us what helps flowers grow.","action","Flowers comes before need; sunlight is what they need.","Flowers 放在 need 前面，sunlight 是花需要的東西。"],
      ["Milk is white.","牛奶是白色的。","🥛","Describe the colour of milk.","describe","Is joins the thing Milk to its colour white.","is 把 Milk 和它的顏色 white 連起來。"],
      ["Grass is green.","草是綠色的。","🌱","Describe the colour of grass.","describe","Grass names the plant; is links it to the colour green.","Grass 是植物，is 把它和顏色 green 連起來。"],
      ["Snow is cold.","雪是冷的。","❄️","Describe how snow feels.","describe","Is joins Snow to the describing word cold.","is 把 Snow 和描述它的 cold 連起來。"]
    ],
    mid:[
      ["The cat is sleeping.","這隻貓正在睡覺。","🐱","Describe what the cat is doing.","ongoing","Is plus sleeping tells us what the cat is doing now.","is 加 sleeping 表示貓現在正在做的事。"],
      ["We read a book.","我們讀一本書。","📚","Tell us what we read.","article","A goes directly before book and means one book.","a 放在 book 前面，表示一本書。"],
      ["The bus is yellow.","這輛公車是黃色的。","🚌","Describe the bus.","describe","The bus names the thing; is connects it to yellow.","The bus 是要描述的東西，is 把它和 yellow 連起來。"],
      ["I have two apples.","我有兩顆蘋果。","🍎🍎","Tell us how many apples.","plural","Two comes before apples. The ending s shows more than one.","two 放在 apples 前面，字尾 s 表示不只一顆。"],
      ["The dog likes water.","這隻狗喜歡水。","🐶💧","Tell us what the dog likes.","agreement","One dog uses likes, with s. Water names what it likes.","一隻狗用 likes，要加 s；water 是牠喜歡的東西。"],
      ["Please close the door.","請關門。","🚪","Make a polite request.","request","Please makes the request polite; close is the action.","Please 讓請求更有禮貌，close 是要做的動作。"],
      ["I do not jump.","我不跳。","🧍","Make a negative sentence about jumping.","negative","Do not goes before the action jump to make it negative.","do not 放在動作 jump 前面，表示不做這個動作。"],
      ["We do not run.","我們不跑。","🚶","Make a negative sentence about running.","negative","Do not follows We and comes before run.","do not 接在 We 後面、run 前面，表示我們不跑。"],
      ["Can the bird fly?","這隻鳥會飛嗎？","🐦","Ask about the bird's ability.","question","Can moves to the front in this question. End with a question mark.","疑問句把 Can 放在前面，最後用問號。"],
      ["Is the cat sleepy?","這隻貓想睡了嗎？","🐱","Ask how the cat feels.","question","Start with Is to ask, then name the cat and describe it as sleepy.","用 Is 開頭發問，再說 the cat，最後說 sleepy。"],
      ["Where is my book?","我的書在哪裡？","📚","Ask for the location of your book.","question","Where asks about a place. Is comes before my book.","Where 用來問位置，is 放在 my book 前面。"],
      ["This is a red apple.","這是一顆紅蘋果。","🍎","Describe one red apple.","adjective","A marks one apple. Red goes before the noun apple.","a 表示一顆，red 放在名詞 apple 前面。"],
      ["These are my blue shoes.","這些是我的藍色鞋子。","👟","Describe your blue shoes.","plural","These and are match more than one shoe; blue comes before shoes.","These 和 are 搭配不只一隻鞋，blue 放在 shoes 前面。"],
      ["My sister has a bicycle.","我的姊妹有一輛腳踏車。","🚲","Tell us what your sister has.","agreement","One sister uses has. A comes before bicycle.","一位姊妹用 has，a 放在 bicycle 前面。"],
      ["There are three yellow birds.","那裡有三隻黃色的鳥。","🐦🐦🐦","Describe the three yellow birds.","plural","There are introduces several birds; three and yellow go before birds.","There are 用來說有好幾隻，three 和 yellow 放在 birds 前面。"],
      ["The dog is under the table.","狗在桌子下面。","🐶","Tell us where the dog is.","place","Under the table is the place. It follows is.","under the table 表示位置，接在 is 後面。"],
      ["Put the spoon beside the bowl.","把湯匙放在碗旁邊。","🥄🥣","Tell someone where to put the spoon.","place","Put names the action; beside the bowl says where the spoon goes.","Put 是動作，beside the bowl 說明湯匙要放在哪裡。"],
      ["Do you like bananas?","你喜歡香蕉嗎？","🍌","Ask someone about bananas.","question","Use Do before you to ask. Like stays in its base form.","用 Do 放在 you 前面發問，like 用原形。"]
    ],
    hard:[
      ["We fed the cat and the dog.","我們餵了貓和狗。","🐱🐶","Tell us about feeding both animals.","joining","And joins the cat with the dog. Each animal has its own the.","and 連接 the cat 和 the dog，兩個 the 都要保留。"],
      ["After lunch, we read a book.","午餐後，我們讀一本書。","📚","Tell us what happens after lunch.","sequence","After lunch sets the time first; the comma separates it from what we do.","After lunch 先說時間，逗號把時間和後面的活動分開。"],
      ["The little bird is in the tree.","小鳥在樹上。","🐦🌳","Tell us where the little bird is.","place","Little describes bird; in the tree gives its location.","little 描述 bird，in the tree 說明牠的位置。"],
      ["Can you pass me the water, please?","可以請你把水遞給我嗎？","💧","Ask politely for the water.","request","Can starts the question; me is the receiver; please makes it polite.","Can 引出問句，me 是收到水的人，please 表示禮貌。"],
      ["I put the book on the table.","我把書放在桌上。","📚","Tell us where you put the book.","place","The book is what moves; on the table tells its new place.","the book 是被移動的物品，on the table 是放置的位置。"],
      ["When it rains, we use an umbrella.","下雨時，我們會用雨傘。","🌧️☂️","Tell us what we use when it rains.","sequence","When it rains gives the situation. An goes before the vowel sound in umbrella.","When it rains 說明情況，umbrella 以母音開頭，前面用 an。"],
      ["The girl who wears blue is my sister.","穿藍色衣服的女孩是我的姊妹。","👧","Identify your sister by her clothes.","detail","Who wears blue adds information about the girl before is my sister.","who wears blue 補充說明是哪位女孩，再接 is my sister。"],
      ["We stayed inside because it was raining.","我們因為下雨而待在室內。","🌧️🏠","Explain why we stayed inside.","reason","Because introduces the reason: it was raining.","because 引出原因：it was raining，因為正在下雨。"],
      ["If you are hungry, eat an apple.","如果你餓了，就吃一顆蘋果。","🍎","Give advice for feeling hungry.","condition","If introduces the condition; the comma comes before the advice.","If 引出條件，逗號後面接建議的動作。"],
      ["I wanted to play, but it was late.","我想玩，但是時間晚了。","🌙🎲","Contrast wanting to play with the late hour.","joining","But joins two contrasting ideas: wanting to play and the late hour.","but 連接兩個相反的想法：想玩，卻已經晚了。"],
      ["She does not like cold milk.","她不喜歡冰牛奶。","🥛","Say what she does not like.","negative","She uses does not. Like has no s because does carries it.","She 搭配 does not，後面的 like 用原形，不再加 s。"],
      ["Did you put the spoon beside the bowl?","你把湯匙放在碗旁邊了嗎？","🥄🥣","Ask about where the spoon was put.","question","Did starts a question about the past; put stays in its base form.","Did 引出過去的疑問句，put 維持原形。"],
      ["Why does the moon look bright tonight?","今晚月亮為什麼看起來很亮？","🌙","Ask why the moon looks bright tonight.","question","Why asks for a reason; does comes before the moon and look stays in its base form.","Why 問原因，does 放在 the moon 前面，look 用原形。"],
      ["First, wash your hands; then eat your lunch.","先洗手，再吃午餐。","👐🍱","Give two actions in order.","sequence","First and then mark the order. The semicolon separates the two instructions.","First 和 then 表示先後順序，分號分開兩個指令。"],
      ["Before we leave, close the door and the window.","離開之前，關上門和窗戶。","🚪🪟","Give two things to do before leaving.","sequence","Before we leave sets the time; and joins the two things to close.","Before we leave 說明時間，and 連接要關上的門和窗。"],
      ["Although it was cold, we played outside.","雖然很冷，我們還是在外面玩。","❄️⚽","Explain playing outside despite the cold.","joining","Although introduces something surprising: playing outside despite the cold.","Although 表示雖然，引出天冷卻仍在外面玩的對比。"],
      ["The smaller box is lighter than the larger box.","較小的箱子比大箱子輕。","📦📦","Compare the weight of two boxes.","compare","Lighter than compares weight. Smaller and larger identify the two boxes.","lighter than 比較重量，smaller 和 larger 分別指出兩個箱子。"],
      ["Please bring apples, bananas, and a bottle of water.","請帶蘋果、香蕉和一瓶水。","🍎🍌💧","Make a polite request for three items.","list","Commas separate the list; and joins the last item. Apples and bananas can swap places.","逗號分開清單項目，and 接最後一項，蘋果和香蕉可以交換順序。",["Please bring bananas, apples, and a bottle of water."]]
    ]
  };
  const TRAIN_CONCEPTS={
    action:[["Who does what","誰做什麼"],["Find who comes first, then the action, then what it affects.","先找誰，再找動作，最後找動作的對象。"]],
    ability:[["Can + action","can 加動作"],["Keep the ability word beside the action word.","把表示能力的字和動作字放在一起。"]],
    have:[["Saying what we have","說明擁有什麼"],["Start with the owner, then the having word, then the thing.","先放擁有者，再放表示擁有的字，最後放物品。"]],
    describe:[["Describing things","描述事物"],["Name the thing before saying what it is like.","先說要描述的東西，再說它的特徵。"]],
    ongoing:[["Actions happening now","現在正在做的事"],["Look for a helping word and an action ending in -ing.","找出助動詞和以 -ing 結尾的動作字。"]],
    article:[["A, an and the","冠詞 a、an、the"],["Keep the little naming word with the noun it introduces.","把冠詞放在它介紹的名詞前面。"]],
    plural:[["One or more","單數和複數"],["Look for a number or a word that tells you there is more than one.","找出數量，注意是不是不只一個。"]],
    agreement:[["Matching the subject","主詞和動詞的搭配"],["Find who the sentence is about before choosing the verb position.","先找出句子在說誰，再決定動詞的位置。"]],
    request:[["Polite requests","有禮貌的請求"],["Look for the requested action and the word that makes it polite.","找出希望對方做的動作，以及表示禮貌的字。"]],
    negative:[["Making a negative","否定句"],["Keep the helping word and not together before the action.","把助動詞和 not 放在一起，排在動作前面。"]],
    question:[["Building a question","組成問句"],["Look for a question word or helping verb at the start and ? at the end.","開頭找疑問詞或助動詞，結尾找問號。"]],
    adjective:[["Describing a noun","形容詞和名詞"],["Put the describing word before the thing it describes.","把形容詞放在它描述的名詞前面。"]],
    place:[["Where things are","物品的位置"],["Keep each place phrase together and find what it describes.","把表示位置的詞組放在一起，找出它描述的對象。"]],
    joining:[["Joining ideas","連接想法"],["Find the joining word and the idea on each side.","找出連接詞，以及它前後的兩個想法。"]],
    sequence:[["Time and order","時間和順序"],["Use the time word and punctuation to separate what happens first and next.","用時間詞和標點，分出先發生和後發生的事。"]],
    detail:[["Adding details","補充說明"],["Keep the extra description beside the person or thing it explains.","把補充描述放在它說明的人或物旁邊。"]],
    reason:[["Giving a reason","說明原因"],["Find the joining word that answers why.","找出用來回答為什麼的連接詞。"]],
    condition:[["If and then","條件和結果"],["Find the condition first, then the advice or result.","先找條件，再找建議或結果。"]],
    compare:[["Comparing two things","比較兩樣東西"],["Find the comparison word and keep each description with its noun.","找出比較的字，把每個描述和它的名詞放在一起。"]],
    list:[["Lists and punctuation","清單和標點"],["Use commas to separate the items and a joining word before the last one.","用逗號分開項目，最後一項前面放連接詞。"]]
  };
  function sentenceItem(rnd,tier,ctx){
    const used=ctx&&ctx.items?ctx.items.map(function(item){return item.answer;}):[];
    const available=TRAIN_SENTENCES[tier].filter(function(row){return used.indexOf(row[0])<0;});
    const row=pick(rnd,available.length?available:TRAIN_SENTENCES[tier]), ordered=row[0].split(" ");
    const choices=[row[0]];
    for(let i=1;i<ordered.length&&choices.length<4;i++){
      const candidate=ordered.slice(i).concat(ordered.slice(0,i)).join(" ");
      if(choices.indexOf(candidate)<0)choices.push(candidate);
    }
    if(choices.length<4){
      const swapped=ordered.slice();[swapped[0],swapped[1]]=[swapped[1],swapped[0]];
      choices.push(swapped.join(" "));
    }
    let tokens=shuffleWith(rnd,ordered);
    if(tokens.join(" ")===row[0]||(row[7]&&row[7].indexOf(tokens.join(" "))>=0))tokens=tokens.slice(1).concat(tokens[0]);
    const concept=TRAIN_CONCEPTS[row[4]];
    return {prompt:{type:"sentence",sentenceId:tier+"-"+TRAIN_SENTENCES[tier].indexOf(row),concept:row[4],tokens:tokens,picture:row[2],meaning:[row[3],row[1]],
      en:"Build the sentence: "+row[3],zh:"排出句子："+row[1]},answer:row[0],acceptedAnswers:row[7]?row[7].slice():undefined,choices:shuffleWith(rnd,choices),
      lesson:{topic:concept[0].slice(),hint:concept[1].slice(),explanation:[row[0]+" "+row[5],row[1]+" "+row[6]]}};
  }

  /* An authored bilingual picture pack keeps listening rounds usable offline and
     gives Zhuyin speech real Chinese words, rather than reading symbol names. */
  const SOUND_WORDS=[
    ["cat","🐱","貓","ㄇㄠ"],["dog","🐶","狗","ㄍㄡˇ"],["fish","🐟","魚","ㄩˊ"],
    ["bird","🐦","鳥","ㄋㄧㄠˇ"],["horse","🐴","馬","ㄇㄚˇ"],["rabbit","🐰","兔","ㄊㄨˋ"],
    ["apple","🍎","蘋果","ㄆㄧㄥˊㄍㄨㄛˇ"],["banana","🍌","香蕉","ㄒㄧㄤㄐㄧㄠ"],
    ["water","💧","水","ㄕㄨㄟˇ"],["milk","🥛","牛奶","ㄋㄧㄡˊㄋㄞˇ"],
    ["book","📚","書","ㄕㄨ"],["bus","🚌","公車","ㄍㄨㄥㄔㄜ"],
    ["sun","☀️","太陽","ㄊㄞˋㄧㄤˊ"],["moon","🌙","月亮","ㄩㄝˋㄌㄧㄤˋ"],
    ["flower","🌸","花","ㄏㄨㄚ"],["rain","🌧️","雨","ㄩˇ"],
    ["bread","🍞","麵包","ㄇㄧㄢˋㄅㄠ"],["egg","🥚","蛋","ㄉㄢˋ"],["cheese","🧀","起司","ㄑㄧˇㄙ"],
    ["rice","🍚","米飯","ㄇㄧˇㄈㄢˋ"],["juice","🧃","果汁","ㄍㄨㄛˇㄓ"],["soup","🍲","湯","ㄊㄤ"],
    ["hand","✋","手","ㄕㄡˇ"],["foot","🦶","腳","ㄐㄧㄠˇ"],["eye","👁️","眼睛","ㄧㄢˇㄐㄧㄥ"],
    ["ear","👂","耳朵","ㄦˇㄉㄨㄛˇ"],["nose","👃","鼻子","ㄅㄧˊ˙ㄗ"],["mouth","👄","嘴巴","ㄗㄨㄟˇㄅㄚ"],
    ["door","🚪","門","ㄇㄣˊ"],["bed","🛏️","床","ㄔㄨㄤˊ"],["chair","🪑","椅子","ㄧˇ˙ㄗ"],
    ["school","🏫","學校","ㄒㄩㄝˊㄒㄧㄠˋ"],["teacher","🧑‍🏫","老師","ㄌㄠˇㄕ"],
    ["friend","🧑‍🤝‍🧑","朋友","ㄆㄥˊㄧㄡˇ"],["ball","⚽","球","ㄑㄧㄡˊ"],["star","⭐","星星","ㄒㄧㄥㄒㄧㄥ"]
  ];
  const SOUND_ONSETS=[
    ["k",["kite","風箏"],["cat"]],["d",["duck","鴨子"],["dog","door"]],
    ["f",["fan","電風扇"],["fish","flower","foot","friend"]],
    ["b",["boat","船"],["bird","banana","book","bus","bread","bed","ball"]],
    ["h",["hat","帽子"],["horse","hand"]],["r",["robot","機器人"],["rabbit","rain","rice"]],
    ["w",["web","蜘蛛網"],["water"]],["m",["map","地圖"],["milk","moon","mouth"]],
    ["s",["sock","襪子"],["sun","soup","school","star"]],
    ["tʃ",["chick","小雞"],["cheese","chair"]],["dʒ",["jam","果醬"],["juice"]],
    ["n",["nest","鳥巢"],["nose"]],["t",["top","陀螺"],["teacher"]]
  ];
  const SOUND_RHYMES=[
    ["at",["hat","帽子"],["cat"]],["og",["log","木頭"],["dog"]],
    ["ish",["dish","盤子"],["fish"]],["ird",["word","單字"],["bird"]],
    ["orse",["course","課程"],["horse"]],["ook",["look","看"],["book"]],
    ["un",["fun","樂趣"],["sun"]],["oon",["soon","很快"],["moon"]],
    ["ain",["train","火車"],["rain"]],["ed",["red","紅色"],["bed","bread"]],
    ["ice",["nice","友善的"],["rice"]],["air",["pear","梨子"],["chair"]],
    ["all",["tall","高的"],["ball"]],["ool",["pool","泳池"],["school"]],
    ["ar",["car","汽車"],["star"]]
  ];
  function soundMatchItem(rnd,tier,ctx){
    const bpmf=INPUT_SCRIPT==="bpmf", index=ctx&&ctx.i||0;
    const mode=tier==="tot"?"word":tier==="mid"?(index%2?"initial":"word"):(index%2?"spelling":bpmf?"initial":"rhyme");
    const groups=mode==="rhyme"?SOUND_RHYMES:SOUND_ONSETS;
    const soundKey=function(row){
      if(bpmf)return row[3][0];
      const group=groups.find(function(group){return group[2].indexOf(row[0])>=0;});
      return group?group[0]:"other:"+row[0];
    };
    const eligible=SOUND_WORDS.filter(function(row){return mode==="word"||mode==="spelling"||(!bpmf&&soundKey(row).indexOf("other:")!==0)||(bpmf&&SOUND_WORDS.some(function(other){return other!==row&&soundKey(other)===soundKey(row);}));});
    const used=ctx&&ctx.items?ctx.items.map(function(item){return item.prompt.word[0];}):[];
    const remaining=eligible.filter(function(row){return used.indexOf(row[0])<0;});
    const target=pick(rnd,remaining.length?remaining:eligible), value=function(row){return row[bpmf?3:0];};
    let cue=[target[0],target[2]], clue=value(target), instruction=["Listen, then find the word.","聽一聽，找出相同的單字。"], options;
    let topic=["Listen to whole words","聽完整的單字"], hint=["Listen from the beginning to the end, then compare the pictures.","從頭聽到尾，再比較每張圖片。"];
    let explanation=bpmf?[target[2]+" is written "+target[3]+". Match the whole spoken word, including its tone.","「"+target[2]+"」的注音是「"+target[3]+"」，要聽完整個詞，也要注意聲調。"]:["The English word "+target[0]+" means "+target[2]+". Its letters are "+target[0].split("").join(" · ")+".","英語單字 "+target[0]+" 是「"+target[2]+"」，字母順序是 "+target[0].split("").join(" · ")+"。"];
    let matchKey=value(target);
    if(mode==="initial"||mode==="rhyme"){
      matchKey=soundKey(target);
      if(bpmf){
        const row=pick(rnd,SOUND_WORDS.filter(function(row){return row!==target&&soundKey(row)===matchKey;}));
        cue=[row[0],row[2]];clue=row[3];
        instruction=["Choose another word with the same first Zhuyin symbol as "+row[2]+".","找出和「"+row[2]+"」第一個注音相同的詞。"];
        explanation=[row[2]+" ("+row[3]+") and "+target[2]+" ("+target[3]+") both begin with "+matchKey+".","「"+row[2]+"」（"+row[3]+"）和「"+target[2]+"」（"+target[3]+"）的第一個注音都是 "+matchKey+"。"];
      }else{
        const group=groups.find(function(group){return group[0]===matchKey;});cue=group[1].slice();clue=cue[0];
        instruction=mode==="rhyme"?["Which word rhymes with "+cue[0]+"?","哪個英語單字和 "+cue[0]+" 押韻？"]:["Which word starts with the same sound as "+cue[0]+"?","哪個英語單字和 "+cue[0]+" 的開頭聲音相同？"];
        explanation=mode==="rhyme"?[cue[0]+" and "+target[0]+" have the same ending sound, even when the spelling differs.",cue[0]+" 和 "+target[0]+" 的結尾聲音相同，所以押韻；拼法不一定相同。"]:[cue[0]+" and "+target[0]+" both start with the /"+matchKey+"/ sound.",cue[0]+" 和 "+target[0]+" 的第一個聲音都是 /"+matchKey+"/。"];
      }
      topic=mode==="rhyme"?["Rhyming endings","押韻的結尾"]:bpmf?["First Zhuyin symbol","第一個注音"]:["Beginning sounds","開頭的聲音"];
      hint=mode==="rhyme"?["Listen from the vowel to the end. The first sound may change.","從母音聽到結尾，開頭的聲音可以不同。"]:["Listen just to the beginning, then compare the beginning of each choice.","先注意開頭的聲音，再比較各選項的開頭。"];
    }else if(mode==="spelling"){
      instruction=[bpmf?"Listen and choose the matching Zhuyin.":"Listen and choose the correct spelling.",bpmf?"聽一聽，選出正確的注音。":"聽一聽，選出正確的英語拼法。"];
      topic=bpmf?["Zhuyin and tones","注音和聲調"]:["Check every letter","檢查每個字母"];
      hint=bpmf?["Compare the symbols in order and check the tone marks.","依序比較注音，也要注意聲調符號。"]:["Say the word slowly. Check for missing, extra or swapped letters.","慢慢念，檢查有沒有少字母、多字母或字母順序錯誤。"];
      explanation=bpmf?[target[2]+" is written "+target[3]+". Keep the symbols and tone marks in this order.","「"+target[2]+"」寫成「"+target[3]+"」，注音順序和聲調都要一致。"]:[target[0]+" is spelled "+target[0].split("").join(" · ")+". The other choices omit, add or swap a letter.",target[0]+" 的字母順序是 "+target[0].split("").join(" · ")+"，其他選項少了、多了或調換了字母。"];
    }
    if(mode==="spelling"&&!bpmf){
      const word=target[0], variants=[word,word.slice(1),word+word[word.length-1]];
      for(let i=0;i<word.length-1&&variants.length<4;i++){
        const letters=word.split("");[letters[i],letters[i+1]]=[letters[i+1],letters[i]];
        const changed=letters.join("");if(variants.indexOf(changed)<0)variants.push(changed);
      }
      options=shuffleWith(rnd,variants).map(function(option){return {value:option,picture:target[1],label:[option,target[2]],soundKey:option};});
    }else{
      const wrong=SOUND_WORDS.filter(function(row){return row!==target&&((mode!=="initial"&&mode!=="rhyme")||soundKey(row)!==matchKey);});
      options=shuffleWith(rnd,[target].concat(shuffleWith(rnd,wrong).slice(0,3))).map(function(row){return {value:value(row),picture:row[1],label:[row[0],row[2]],soundKey:mode==="initial"||mode==="rhyme"?soundKey(row):value(row)};});
    }
    return {prompt:{type:"soundmatch",script:bpmf?"bpmf":"abc",mode:mode,word:[target[0],target[2]],cue:cue,
      speech:bpmf?["",cue[1]]:[cue[0],""],instruction:instruction,matchKey:matchKey,picture:target[1],clue:clue,
      pictures:tier!=="hard",spelling:tier!=="tot",options:options,
      en:instruction[0]+" Visual clue: "+clue,zh:instruction[1]+" 文字提示："+clue},
      answer:value(target),choices:options.map(function(option){return option.value;}),lesson:{topic:topic,hint:hint,explanation:explanation}};
  }

  /* ---- Memory Match and Pattern Echo ---- */
  const MEMORY_SYMBOLS=[["Star","星星"],["Heart","愛心"],["Leaf","葉子"],["Moon","月亮"],["Sun","太陽"],["Drop","水滴"]];
  function memoryMatchItem(rnd,pairs,studyMs,mode){
    const symbols=shuffleWith(rnd,[0,1,2,3,4,5]).slice(0,pairs);
    const cards=shuffleWith(rnd,symbols.concat(symbols)),target=pick(rnd,symbols);
    const places=cards.map(function(card,i){return card===target?i+1:0;}).filter(Boolean);
    let answer=places.join(",");const wrong=[];
    for(let i=1;i<=cards.length;i++)for(let j=i+1;j<=cards.length;j++)if(i+","+j!==answer)wrong.push(i+","+j);
    if(mode==="all"){
      const matches=symbols.map(function(symbol){return cards.map(function(card,i){return card===symbol?i+1:0;}).filter(Boolean);});
      const serialize=function(list){return list.map(function(pair){return pair.slice().sort(function(a,b){return a-b;});}).sort(function(a,b){return a[0]-b[0];}).map(function(pair){return pair.join(",");}).join(";");};
      answer=serialize(matches);wrong.length=0;
      for(let n=1;n<matches.length;n++)for(let side=0;side<2;side++){
        const candidate=matches.map(function(pair){return pair.slice();});
        const save=candidate[0][side];candidate[0][side]=candidate[n][0];candidate[n][0]=save;
        const text=serialize(candidate);if(wrong.indexOf(text)<0)wrong.push(text);
      }
    }
    const names=cards.map(function(card,i){return (i+1)+": "+MEMORY_SYMBOLS[card][0];}).join("; ");
    const namesZh=cards.map(function(card,i){return (i+1)+"："+MEMORY_SYMBOLS[card][1];}).join("；");
    const explanation=mode==="all"?["The matching positions are "+answer.replace(/;/g," · ")+". Remember one pair at a time.","相同圖片的位置是 "+answer.replace(/;/g,"、")+"。一次記住一組。"]: ["The two "+MEMORY_SYMBOLS[target][0]+" pictures are at "+places.join(" and ")+". Link each picture to its position.","兩張"+MEMORY_SYMBOLS[target][1]+"在第 "+places.join(" 和 ")+" 張。把圖片和位置一起記住。"];
    return {prompt:{type:"memorymatch",mode:mode||"pair",cards:cards,target:target,symbols:MEMORY_SYMBOLS,studyMs:studyMs,
      en:(mode==="all"?"Find every matching pair. ":"Find both "+MEMORY_SYMBOLS[target][0]+" cards. ")+names,
      zh:(mode==="all"?"找出全部相同的圖片配對。":"找出兩張"+MEMORY_SYMBOLS[target][1]+"卡片。")+namesZh},
      answer:answer,choices:shuffleWith(rnd,[answer].concat(shuffleWith(rnd,wrong).slice(0,3))),
      lesson:{topic:mode==="all"?["Find every pair","找出全部配對"]:["Picture locations","圖片與位置"],hint:["Scan one row at a time. Remember a picture together with its card number.","一次看一排，把圖片和卡片號碼一起記住。"],explanation:explanation},corrective:explanation};
  }
  function patternEchoItem(rnd,length,stepMs,reverse){
    const sequence=Array.from({length:length},function(){return intBetween(rnd,1,4);});
    if(reverse && sequence.join(",")===sequence.slice().reverse().join(","))sequence[length-1]=sequence[0]%4+1;
    const expected=reverse?sequence.slice().reverse():sequence.slice(),answer=expected.join(","),wrong=[];
    expected.forEach(function(value,i){for(let n=1;n<=4;n++){if(n===value)continue;const variant=expected.slice();variant[i]=n;wrong.push(variant.join(","));}});
    const explanation=["You saw "+sequence.join(" → ")+". "+(reverse?"Start at the end: ":"Keep the same order: ")+expected.join(" → ")+".","剛才是 "+sequence.join(" → ")+"。"+(reverse?"從最後倒著點：":"照原來的順序：")+expected.join(" → ")+"。"];
    return {prompt:{type:"patternecho",sequence:sequence,stepMs:stepMs,reverse:!!reverse,confirm:true,
      en:(reverse?"Repeat backwards: ":"Repeat this pattern: ")+sequence.join(" → "),zh:(reverse?"倒著重複：":"照順序重複：")+sequence.join(" → ")},
      answer:answer,choices:shuffleWith(rnd,[answer].concat(shuffleWith(rnd,wrong).slice(0,3))),
      lesson:{topic:reverse?["Remember in reverse","倒序記憶"]:["Remember the order","順序記憶"],hint:reverse?["Picture the whole sequence, then take the last tap first. Undo can fix one tap.","先想完整的順序，再從最後一個開始點。上一步可以改一個按鈕。"]:["Group the taps into small chunks. Say the numbers quietly, then check your entry.","把順序分成小段，在心裡念數字，再檢查輸入的順序。"],explanation:explanation},corrective:explanation};
  }

  const GAMES={
    memorymatch:{id:"memorymatch",icon:"🃏",skill:"memory",title:["Memory Match","記憶配對"],blurb:["Remember where the pictures hide","記住圖片躲在哪裡"],tiers:{
      tot:{items:6,clock:false,pad:"choice",gen:function(r,c){c=c||{i:0};return memoryMatchItem(r,2,4000,c.i>=4?"all":"pair");}},
      mid:{items:6,clock:true,pad:"choice",gen:function(r,c){c=c||{i:0};return memoryMatchItem(r,c.i<2?3:4,4500,c.i>=2?"all":"pair");}},
      hard:{items:6,clock:true,pad:"choice",gen:function(r,c){c=c||{i:0};return memoryMatchItem(r,4+Math.floor(c.i/2),5000,c.i>=1?"all":"pair");}}
    }},
    patternecho:{id:"patternecho",icon:"🎵",skill:"memory",title:["Pattern Echo","節奏記憶"],blurb:["Watch, remember, repeat","看一看，記住，再點一次"],tiers:{
      tot:{items:6,clock:false,pad:"choice",gen:function(r,c){c=c||{i:0};return patternEchoItem(r,c.i<2?2:3,650,false);}},
      mid:{items:6,clock:true,pad:"choice",gen:function(r,c){c=c||{i:0};return patternEchoItem(r,3+Math.floor(c.i/2),600,false);}},
      hard:{items:6,clock:true,pad:"choice",gen:function(r,c){c=c||{i:0};return patternEchoItem(r,4+Math.floor(c.i/2),550,c.i%2===1);}}
    }},
    /* Brain Gym expansion: math entries */
    fractions:{
      id:"fractions",icon:"🥪",skill:"math",
      title:["Fraction Picnic","分數野餐"],blurb:["Share food and find the part left","分一分食物，找出剩下的份量"],
      tiers:{
        tot:{items:6,clock:false,pad:"choice",gen:function(r,c){return fractionItem(r,"tot",c);}},
        mid:{items:8,clock:true,pad:"choice",gen:function(r,c){return fractionItem(r,"mid",c);}},
        hard:{items:8,clock:true,pad:"choice",gen:function(r,c){return fractionItem(r,"hard",c);}}
      }
    },
    balance:{
      id:"balance",icon:"⚖️",skill:"math",
      title:["Balance Lab","天平實驗室"],blurb:["Make both sides equal","讓算式兩邊一樣大"],
      tiers:{
        tot:{items:6,clock:false,pad:"choice",gen:function(r,c){return balanceItem(r,"tot",c);}},
        mid:{items:8,clock:true,pad:"choice",gen:function(r,c){return balanceItem(r,"mid",c);}},
        hard:{items:8,clock:true,pad:"choice",gen:function(r,c){return balanceItem(r,"hard",c);}}
      }
    },
    /* Brain Gym expansion: science entries */
    circuit:{
      id:"circuit",icon:"💡",skill:"science",title:["Circuit Builder","電路小工匠"],blurb:["Connect a loop to light the bulb","接通電路，點亮燈泡"],
      tiers:{
        tot:{items:6,clock:false,pad:"choice",gen:function(r,c){return circuitItem(r,"tot",c);}},
        mid:{items:8,clock:true,pad:"choice",gen:function(r,c){return circuitItem(r,"mid",c);}},
        hard:{items:8,clock:true,pad:"choice",gen:function(r,c){return circuitItem(r,"hard",c);}}
      }
    },
    sorter:{
      id:"sorter",icon:"🔬",skill:"science",title:["Science Sorter","科學分類站"],blurb:["Sort plants, matter and animals","認識植物、物質和動物分類"],
      tiers:{
        tot:{items:6,clock:false,pad:"choice",gen:function(r,c){return scienceSorterItem(r,"tot",c);}},
        mid:{items:8,clock:true,pad:"choice",gen:function(r,c){return scienceSorterItem(r,"mid",c);}},
        hard:{items:8,clock:true,pad:"choice",gen:function(r,c){return scienceSorterItem(r,"hard",c);}}
      }
    },
    /* Brain Gym expansion: language entries */
    sentence:{
      id:"sentence",icon:"🚂",skill:"language",title:["Sentence Train","句子小火車"],
      blurb:["Put word carriages in order","把單字車廂排成句子"],
      tiers:{
        tot:{items:6,clock:false,pad:"choice",gen:function(r,c){return sentenceItem(r,"tot",c);}},
        mid:{items:8,clock:true,pad:"choice",gen:function(r,c){return sentenceItem(r,"mid",c);}},
        hard:{items:8,clock:true,pad:"choice",gen:function(r,c){return sentenceItem(r,"hard",c);}}
      }
    },
    soundmatch:{
      id:"soundmatch",icon:"🔊",skill:"language",title:["Sound Match","聽音找單字"],
      blurb:["Listen, look and find the word","聽一聽，找出單字"],
      tiers:{
        tot:{items:6,clock:false,pad:"choice",gen:function(r,c){return soundMatchItem(r,"tot",c);}},
        mid:{items:8,clock:true,pad:"choice",gen:function(r,c){return soundMatchItem(r,"mid",c);}},
        hard:{items:8,clock:true,pad:"choice",gen:function(r,c){return soundMatchItem(r,"hard",c);}}
      }
    },
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
      id:"crunch", icon:"🧩", skill:"math",
      title:["Number Bonds","數字好朋友"], blurb:["Pair numbers to make the target","配對數字，湊出目標"],
      tiers:{
        tot :{items:8, clock:false,pad:"choice",gen:function(r){return bondsItem(r,4,5,10);}},
        mid :{items:10,clock:true, pad:"choice",gen:function(r){return bondsItem(r,6,10,20);}},
        hard:{items:10,clock:true, pad:"choice",gen:function(r){return bondsItem(r,8,20,100);}}
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
        mid :{items:10,clock:true, pad:"keypad",gen:function(r){return changeItem(r,45,[50,100],[50,10,5,1]);}},
        hard:{items:10,clock:true, pad:"keypad",gen:function(r){return changeItem(r,480,[500,1000],[500,100,50,10,5,1]);}}
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

  const api={TIERS:TIERS,TIER_DEFAULT:TIER_DEFAULT,GAMES:GAMES,SHOP_PRODUCTS:SHOP_PRODUCTS,
    pick:pick,intBetween:intBetween,numChoices:numChoices,shuffleWith:shuffleWith,zhNum:zhNum,
    greedyPieceCount:greedyPieceCount,setWordPool:setWordPool,setBopomofoPool:setBopomofoPool,
    setInputScript:setInputScript};
  if(typeof window!=="undefined")window.SQBrainData=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
