/* SQPapa — tablet-side Papa menu behind the shared PIN pad. */
(function(){
  const KID_LABELS={all:"All 全部",lucien:"Lucien",lili:"Lili",luis:"Luis"};
  function open(){window.SQPin.show({title:"Papa tools 爸爸工具",onOk:menu});}
  function menu(){
    const o=document.createElement("div");
    o.className="overlay";
    o.innerHTML=`<div class="card" style="max-width:380px">
      <h3>🔧 Papa tools 爸爸工具</h3>
      <div class="vrow">
        <button class="btn" id="ptResched">⏰ Reschedule today 調整今天時間</button>
        <button class="btn small" id="ptClose">Close 關閉</button>
      </div>
      <div id="ptBody"></div>
    </div>`;
    document.body.appendChild(o);
    o.querySelector("#ptClose").onclick=function(){o.remove();};
    o.querySelector("#ptResched").onclick=function(){resched(o.querySelector("#ptBody"),"all");};
  }
  function resched(el,scope){
    const raw=window.sqOverridesRaw();
    const eff=scope==="all"?(raw.all||{}):window.SQTime.resolveOverrides(raw,scope);
    const own=raw[scope]||{};
    const kidRow=Object.keys(KID_LABELS).map(function(k){
      return `<button class="btn small ptkid ${k===scope?"on":""}" data-ptk="${k}">${KID_LABELS[k]}</button>`;
    }).join("");
    const rows=window.SQTime.timedOrder(window.SQ_DAY_DATA,eff).map(function(x){
      const b=window.SQ_DAY_DATA[x.i];
      const hh=String(Math.floor(x.t/60)).padStart(2,"0"), mm=String(x.t%60).padStart(2,"0");
      return `<div class="vrow">
        <span style="flex:1">${b.icon} ${b.title.split("—")[0].trim()} ${(b.tz||"").split("——")[0]}${own[x.i]!=null?" moved 已調整":""}</span>
        <input class="qinput" style="width:auto" type="time" data-pti="${x.i}" value="${hh}:${mm}">
      </div>`;
    }).join("");
    el.innerHTML=`<div class="vrow" style="flex-wrap:wrap">${kidRow}</div>`+rows+
      `<button class="btn" id="ptSave">Save 儲存</button><div class="tipline" id="ptMsg"></div>`;
    el.querySelectorAll(".ptkid").forEach(function(b){b.onclick=function(){resched(el,b.dataset.ptk);};});
    el.querySelector("#ptSave").onclick=async function(){
      for(const inp of el.querySelectorAll("[data-pti]")){
        const i=+inp.dataset.pti, v=inp.value;
        if(!v)continue;
        const parts=v.split(":").map(Number);
        const t=`${parts[0]}:${String(parts[1]).padStart(2,"0")}`;
        const base=scope==="all"?window.SQ_DAY_DATA[i].t
          :((raw.all||{})[i]!=null?(raw.all||{})[i]:window.SQ_DAY_DATA[i].t);
        const cur=own[i]!=null?own[i]:base;
        if(window.SQTime.parseMins(t)===window.SQTime.parseMins(cur))continue;
        const clear=window.SQTime.parseMins(t)===window.SQTime.parseMins(base);
        await window.sqSetOverride(i,clear?null:t,scope);
      }
      el.querySelector("#ptMsg").textContent="Saved — syncs when online 已儲存";
      window.sqAfterOverrideChange();
    };
  }
  window.SQPapa={open:open};
})();
