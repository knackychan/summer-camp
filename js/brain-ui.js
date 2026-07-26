/* SQBrain — Brain Gym round UI (design.md §8).
   Injected deps: {say, onFinish, kidColor}. No fail state, no cutoff, no red. */
(function(){
  const C=window.SQBrainCore, D=window.SQBrainData;

  function fmtMs(ms){
    const s=Math.floor(ms/1000);
    const m=Math.floor(s/60), r=s%60;
    return m+":"+(r<10?"0":"")+r;
  }

  function promptHtml(p){
    if(p.type==="emoji")
      return `<div class="bprompt bemoji">${p.en}</div>`;
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
          return `<button class="btn bkey" data-v="${c}">${c}</button>`;}).join("")}</div>`;
      }
      /* keypad */
      const keys=["1","2","3","4","5","6","7","8","9","⌫","0","✓"];
      return `<div class="bentry">${entry===""?"&nbsp;":entry}</div>
        <div class="bpad bkeypad">${keys.map(function(k){
          return `<button class="btn bkey" data-v="${k}">${k}</button>`;}).join("")}</div>`;
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

    render(); speak();
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
