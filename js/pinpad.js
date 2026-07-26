/* SQPin — shared Papa PIN pad. SQPin.show({title,subtitle,onOk}). */
(function(){
  function adminPin(){
    try{return JSON.parse(localStorage.getItem("sq:adminPin"))||"";}catch(e){return "";}
  }
  function show(opts){
    const pin=adminPin();
    if(!pin){
      alert("Papa PIN not set yet — set it in the admin dashboard.\n還沒有設定爸爸密碼——請在管理頁設定。");
      return;
    }
    let entered="";
    const o=document.createElement("div");
    o.className="overlay";
    o.innerHTML=`<div class="card pincard">
      <h3>${opts.title||"Papa only 只限爸爸"}</h3>
      ${opts.subtitle?`<p>${opts.subtitle}</p>`:""}
      <div class="pindots" id="pinDots">○ ○ ○ ○</div>
      <div class="pingrid">
        ${[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map(d=>d===""
          ?`<span></span>`
          :`<button class="btn pinkey" data-k="${d}">${d}</button>`).join("")}
      </div>
      <button class="btn small" id="pinCancel">Cancel 取消</button>
    </div>`;
    document.body.appendChild(o);
    const dots=function(){
      o.querySelector("#pinDots").textContent=[0,1,2,3].map(function(n){return n<entered.length?"●":"○";}).join(" ");
    };
    o.querySelector("#pinCancel").onclick=function(){o.remove();};
    o.querySelectorAll(".pinkey").forEach(function(b){
      b.onclick=function(){
        const k=b.dataset.k;
        if(k==="⌫"){entered=entered.slice(0,-1);dots();return;}
        if(entered.length>=4)return;
        entered+=k;dots();
        if(entered.length===4){
          if(entered===pin){o.remove();if(opts.onOk)opts.onOk();}
          else{
            const card=o.querySelector(".pincard");
            card.classList.add("shake");
            setTimeout(function(){card.classList.remove("shake");entered="";dots();},450);
          }
        }
      };
    });
  }
  window.SQPin={show:show};
})();
