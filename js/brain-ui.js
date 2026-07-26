/* SQBrain — Brain Gym round UI (design.md §8).
   Injected deps: {say, onFinish, kidColor}. No fail state, no cutoff, no red. */
(function(){
  const C=window.SQBrainCore, D=window.SQBrainData;

  function fmtMs(ms){
    const s=Math.floor(ms/1000);
    const m=Math.floor(s/60), r=s%60;
    return m+":"+(r<10?"0":"")+r;
  }

  const COLORS={red:["#e5484d","Red","紅色"],blue:["#3b82f6","Blue","藍色"],
    green:["#22c55e","Green","綠色"],yellow:["#eab308","Yellow","黃色"],
    purple:["#a855f7","Purple","紫色"],black:["#111827","Black","黑色"]};

  function clockSvg(h,m){
    const ha=(h%12)*30+m*0.5-90, ma=m*6-90, R=Math.PI/180;
    const hx=50+26*Math.cos(ha*R), hy=50+26*Math.sin(ha*R);
    const mx=50+38*Math.cos(ma*R), my=50+38*Math.sin(ma*R);
    let ticks="";
    for(let i=0;i<12;i++){
      const a=i*30-90;
      ticks+=`<circle cx="${50+42*Math.cos(a*R)}" cy="${50+42*Math.sin(a*R)}" r="2" fill="currentColor"/>`;
    }
    return `<svg viewBox="0 0 100 100" class="bclockface" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="3"/>
      ${ticks}
      <line x1="50" y1="50" x2="${hx}" y2="${hy}" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
      <line x1="50" y1="50" x2="${mx}" y2="${my}" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="3" fill="currentColor"/></svg>`;
  }

  function promptHtml(p){
    if(p.type==="emoji")     return `<div class="bprompt bemoji">${p.en}</div>`;
    if(p.type==="swatch")    return `<div class="bswatch" style="background:${COLORS[p.ink][0]}"></div>`;
    if(p.type==="colorword") return `<div class="bprompt bcolorword" style="color:${COLORS[p.ink][0]}">${p.word}</div>`;
    if(p.type==="countfield")return `<div class="bfield">${p.glyphs.join("")}</div>
      <div class="bsub">${p.en}<span class="zhs">${p.zh}</span></div>`;
    if(p.type==="clockface") return `${clockSvg(p.h,p.m)}
      <div class="bsub">${p.en}<span class="zhs">${p.zh}</span></div>`;
    if(p.type==="money")     return `<div class="bmoney">${p.art}</div>
      <div class="bsub">${p.en}<span class="zhs">${p.zh}</span></div>`;
    if(p.type==="gridflash") return `<div class="bgrid" id="bGrid"></div>
      <div class="bsub">${p.en}<span class="zhs">${p.zh}</span></div>`;
    if(p.type==="wordlist")  return `<div class="bwords" id="bWords"></div>
      <div class="bsub">${p.en}<span class="zhs">${p.zh}</span></div>`;
    return `<div class="bprompt">${p.en}</div>`;
  }

  function openRound(opts){
    /* opts: {gameId, tier, kid, say, onFinish} */
    const game=D.GAMES[opts.gameId];
    const round=C.buildRound(opts.gameId,opts.tier,C.mulberry32(Date.now()>>>0));
    const answers=[]; let idx=0, entry="", startTs=0, tickInt=null, shaking=false;

    const o=document.createElement("div");
    o.className="overlay"; o.id="brainOverlay";
    document.body.appendChild(o);

    function stopClock(){if(tickInt){clearInterval(tickInt);tickInt=null;}}
    function close(){stopClock();o.remove();}
    function elapsed(){return startTs?Date.now()-startTs:0;}

    function speak(){
      const item=round.items[idx];
      if(opts.say&&item.say)opts.say(item.say);
    }

    function padHtml(item){
      if(round.pad==="choice"){
        return `<div class="bpad bchoice">${item.choices.map(function(c){
          if(item.choiceStyle==="swatch")
            return `<button class="btn bkey bswatchkey" data-v="${c}"
              style="background:${COLORS[c][0]}" aria-label="${COLORS[c][1]}"></button>`;
          const label=COLORS[c]?COLORS[c][1]+" "+COLORS[c][2]:c;
          return `<button class="btn bkey" data-v="${c}">${label}</button>`;}).join("")}</div>`;
      }
      if(round.pad==="grid"){
        return `<div class="bpad bgridpad" id="bGridPad"></div>
          <div class="bentry">${entry===""?"&nbsp;":entry.split(",").join(" · ")}</div>`;
      }
      if(round.pad==="type"){
        return `<textarea class="btype" id="bType" rows="3"
            placeholder="Type the words 打出單字"></textarea>
          <button class="btn bkey" data-v="✓">Done 完成</button>`;
      }
      /* keypad */
      const keys=["1","2","3","4","5","6","7","8","9","⌫","0","✓"];
      return `<div class="bentry">${entry===""?"&nbsp;":entry}</div>
        <div class="bpad bkeypad">${keys.map(function(k){
          return `<button class="btn bkey" data-v="${k}">${k}</button>`;}).join("")}</div>`;
    }

    function mount(){
      const item=round.items[idx];
      if(item.prompt.type==="gridflash")mountGrid(item);
      if(item.prompt.type==="wordlist")mountWords(item);
      if(round.pad==="type"){
        const ta=o.querySelector("#bType");
        if(ta)ta.oninput=function(){entry=ta.value;};
      }
    }

    /* Low to High: show the numbers, hide them, then tap ascending. */
    function mountGrid(item){
      const host=o.querySelector("#bGrid"), pad=o.querySelector("#bGridPad");
      if(!host||!pad)return;
      const cells=item.prompt.cells;
      host.innerHTML=cells.map(function(c){return `<span class="bcell">${c.n}</span>`;}).join("");
      pad.innerHTML="";
      setTimeout(function(){
        host.innerHTML=cells.map(function(){return `<span class="bcell bhidden">?</span>`;}).join("");
        pad.innerHTML=C.seededShuffle(cells,Math.random).map(function(c){
          return `<button class="btn bkey" data-v="${c.n}">${c.n}</button>`;}).join("");
        pad.querySelectorAll(".bkey").forEach(function(b){
          b.onclick=function(){
            b.disabled=true; b.classList.add("bused");
            entry=entry===""?b.dataset.v:entry+","+b.dataset.v;
            const box=o.querySelector(".bentry");
            if(box)box.textContent=entry.split(",").join(" · ");
            if(entry.split(",").length===cells.length)advance(entry);
          };
        });
      },item.prompt.flashMs);
    }

    /* Word Memory: study the list, it disappears, then type what you remember. */
    function mountWords(item){
      const host=o.querySelector("#bWords");
      if(!host)return;
      host.innerHTML=item.prompt.words.map(function(w){return `<span class="bword">${w}</span>`;}).join("");
      const ta=o.querySelector("#bType");
      if(ta)ta.disabled=true;
      setTimeout(function(){
        if(item.choices){
          host.innerHTML=item.prompt.words
            .filter(function(w){return w!==item.answer;})
            .map(function(w){return `<span class="bword">${w}</span>`;}).join("")
            +`<span class="bword bhidden">？</span>`;
          return;
        }
        host.innerHTML=`<span class="bsub">Now type what you remember 現在打出你記得的</span>`;
        const ta=o.querySelector("#bType");
        if(ta){ta.disabled=false;ta.focus();}
      },item.prompt.studyMs);
    }

    function render(){
      const item=round.items[idx];
      o.innerHTML=`<div class="card braincard${shaking?" bshake":""}">
        <h3>${game.icon} ${game.title[0]}<span class="zht">${game.title[1]}</span></h3>
        <div class="bhud">
          <span>${idx+1} / ${round.items.length}</span>
          ${round.clock?`<span id="bclock">⏱ ${fmtMs(elapsed())}</span>`:""}
        </div>
        ${promptHtml(item.prompt)}
        ${padHtml(item)}
        <button class="btn small" id="bQuit">Later 待會再玩</button>
      </div>`;
      o.querySelectorAll(".bkey").forEach(function(b){b.onclick=function(){press(b.dataset.v);};});
      o.querySelector("#bQuit").onclick=close;
      mount();
    }

    function advance(given){
      answers[idx]=given;
      const item=round.items[idx];
      if(String(given).trim()!==String(item.answer).trim()){
        /* no fail state: shake, show the answer, then carry on */
        shaking=true; render();
        const box=o.querySelector(".bprompt");
        if(box)box.innerHTML=item.prompt.en+' <b class="bans">'+item.answer+"</b>";
        setTimeout(function(){shaking=false;step();},900);
        return;
      }
      step();
    }

    function step(){
      idx++; entry="";
      if(idx>=round.items.length){finish();return;}
      render(); speak();
    }

    function press(v){
      if(round.pad==="choice"){advance(v);return;}
      if(v==="⌫"){entry=entry.slice(0,-1);render();return;}
      if(v==="✓"){if(entry==="")return;advance(entry);return;}
      if(entry.length>=4)return;
      entry+=v; render();
    }

    function finish(){
      stopClock();
      const res=C.scoreRound({items:round.items,answers:answers,ms:elapsed(),clock:round.clock});
      close();
      if(opts.onFinish)opts.onFinish(Object.assign({gameId:opts.gameId,tier:opts.tier},res));
    }

    entry=""; render(); speak();
    startTs=Date.now();
    if(round.clock){
      tickInt=setInterval(function(){
        const el=o.querySelector("#bclock");
        if(el)el.textContent="⏱ "+fmtMs(elapsed());
      },1000);
    }
  }

  const api={openRound:openRound,fmtMs:fmtMs};
  window.SQBrain=Object.assign(window.SQBrain||{},api);
})();
