/* Minecraft book — magazine furniture shared by the two readers.
   books/minecraft.html and index.html's in-app reader both draw the same
   floating tip/fact cards, stat badge, era tag, key chips, gallery strip and
   pixel-item decorations, so the markup lives here once instead of twice.
   The CSS still lives in each page (two stylesheets, one class prefix: mcx-).

   Classic global script — no imports. See js/CLAUDE.md. */
(function(){
  "use strict";

  function esc(s){
    return String(s==null?"":s).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }
  /* Bilingual pair. Every kid-facing string ships EN + 中文; the page CSS hides
     whichever half the reader is not in. */
  function pair(cls,en,zh){
    if(!en&&!zh)return "";
    return '<span class="'+cls+' mcx-en">'+esc(en)+'</span>'+
           '<span class="'+cls+' mcx-zh">'+esc(zh)+'</span>';
  }

  /* ── Pixel items, drawn as 16×16 SVG so they stay sharp and work offline ── */
  var ITEMS={
    pickaxe:'<rect x="2" y="4" width="4" height="2" fill="#C6C6C6"/><rect x="5" y="3" width="6" height="2" fill="#DADADA"/><rect x="10" y="4" width="4" height="2" fill="#A0A0A0"/><rect x="7" y="5" width="2" height="3" fill="#9A9A9A"/><rect x="7" y="8" width="2" height="6" fill="#8B5A2B"/>',
    grass:'<rect x="2" y="4" width="12" height="3" fill="#6BBE3E"/><rect x="2" y="4" width="12" height="1" fill="#93DC63"/><rect x="2" y="7" width="12" height="7" fill="#8B5A2B"/><rect x="4" y="9" width="2" height="2" fill="#74441A"/><rect x="9" y="10" width="2" height="2" fill="#74441A"/>',
    torch:'<rect x="7" y="6" width="2" height="8" fill="#8B5A2B"/><rect x="6" y="3" width="4" height="3" fill="#F2A32C"/><rect x="7" y="1" width="2" height="2" fill="#FFE07A"/>',
    crafting:'<rect x="2" y="2" width="12" height="12" fill="#8B5A2B"/><rect x="2" y="2" width="12" height="3" fill="#AC7440"/><rect x="4" y="6" width="3" height="3" fill="#6B4119"/><rect x="9" y="6" width="3" height="3" fill="#6B4119"/><rect x="4" y="10" width="3" height="3" fill="#6B4119"/><rect x="9" y="10" width="3" height="3" fill="#6B4119"/>',
    iron:'<rect x="3" y="6" width="10" height="5" fill="#D8D8D8"/><rect x="4" y="5" width="8" height="1" fill="#F1F1F1"/><rect x="3" y="11" width="10" height="1" fill="#A6A6A6"/>',
    gold:'<rect x="3" y="6" width="10" height="5" fill="#F2C94C"/><rect x="4" y="5" width="8" height="1" fill="#FFE383"/><rect x="3" y="11" width="10" height="1" fill="#C79A24"/>',
    copper:'<rect x="2" y="3" width="12" height="11" fill="#C9744B"/><rect x="2" y="3" width="12" height="2" fill="#E08B5E"/><rect x="4" y="7" width="3" height="3" fill="#79C2A6"/><rect x="9" y="9" width="3" height="2" fill="#79C2A6"/>',
    compass:'<rect x="3" y="3" width="10" height="10" fill="#B0B0B0"/><rect x="4" y="4" width="8" height="8" fill="#2E3B4E"/><rect x="7" y="5" width="2" height="3" fill="#E14B3B"/><rect x="7" y="8" width="2" height="3" fill="#F2F2F2"/>',
    chest:'<rect x="2" y="4" width="12" height="10" fill="#9C6B33"/><rect x="2" y="4" width="12" height="3" fill="#B88140"/><rect x="2" y="7" width="12" height="1" fill="#6B4119"/><rect x="7" y="6" width="2" height="3" fill="#F2C94C"/>',
    heart:'<rect x="3" y="4" width="4" height="2" fill="#E23A3A"/><rect x="9" y="4" width="4" height="2" fill="#E23A3A"/><rect x="2" y="6" width="12" height="3" fill="#E23A3A"/><rect x="4" y="9" width="8" height="2" fill="#E23A3A"/><rect x="6" y="11" width="4" height="2" fill="#E23A3A"/><rect x="4" y="5" width="2" height="2" fill="#FF8F8F"/>',
    sword:'<rect x="10" y="2" width="3" height="3" fill="#BFE4FA"/><rect x="8" y="4" width="3" height="3" fill="#9FD3F2"/><rect x="6" y="6" width="3" height="3" fill="#BFE4FA"/><rect x="4" y="8" width="4" height="2" fill="#F2C94C"/><rect x="6" y="10" width="2" height="2" fill="#F2C94C"/><rect x="2" y="10" width="4" height="4" fill="#8B5A2B"/>',
    tnt:'<rect x="2" y="3" width="12" height="11" fill="#C8402F"/><rect x="2" y="6" width="12" height="4" fill="#F4F1E4"/><rect x="4" y="7" width="2" height="2" fill="#2B2B2B"/><rect x="7" y="7" width="2" height="2" fill="#2B2B2B"/><rect x="10" y="7" width="2" height="2" fill="#2B2B2B"/><rect x="7" y="1" width="2" height="2" fill="#8B5A2B"/>',
    bread:'<rect x="2" y="6" width="12" height="6" fill="#C98F45"/><rect x="3" y="5" width="10" height="2" fill="#E0AE68"/><rect x="5" y="8" width="2" height="1" fill="#A8712F"/><rect x="9" y="9" width="2" height="1" fill="#A8712F"/>',
    redstone:'<rect x="6" y="2" width="3" height="3" fill="#E03A2F"/><rect x="3" y="6" width="3" height="3" fill="#C42A22"/><rect x="10" y="6" width="3" height="3" fill="#C42A22"/><rect x="6" y="9" width="3" height="3" fill="#FF5A4A"/><rect x="7" y="6" width="2" height="2" fill="#FF7A6A"/>',
    potion:'<rect x="6" y="1" width="4" height="3" fill="#D6D6D6"/><rect x="4" y="4" width="8" height="3" fill="#EDEDED"/><rect x="3" y="7" width="10" height="7" fill="#E86AB0"/><rect x="4" y="6" width="8" height="2" fill="#F58FC6"/>',
    book:'<rect x="3" y="2" width="10" height="12" fill="#8B3A2E"/><rect x="5" y="3" width="8" height="10" fill="#F0E6C8"/><rect x="3" y="2" width="2" height="12" fill="#B0503E"/><rect x="6" y="5" width="5" height="1" fill="#C9BE9A"/><rect x="6" y="8" width="5" height="1" fill="#C9BE9A"/>',
    emerald:'<rect x="6" y="2" width="4" height="2" fill="#3FD07A"/><rect x="4" y="4" width="8" height="7" fill="#2FA95F"/><rect x="6" y="11" width="4" height="2" fill="#1F7A45"/><rect x="5" y="5" width="2" height="3" fill="#84EDAE"/>',
    diamond:'<rect x="6" y="2" width="4" height="2" fill="#6FE6E0"/><rect x="4" y="4" width="8" height="7" fill="#43C9C4"/><rect x="6" y="11" width="4" height="2" fill="#2C9490"/><rect x="5" y="5" width="2" height="3" fill="#B4F7F4"/>',
    amethyst:'<rect x="6" y="2" width="3" height="5" fill="#A96BD6"/><rect x="3" y="6" width="3" height="6" fill="#8A4EBE"/><rect x="9" y="5" width="3" height="7" fill="#C08BE8"/><rect x="6" y="7" width="3" height="6" fill="#9A5BCC"/>',
    ender:'<rect x="5" y="3" width="6" height="2" fill="#2C7F6E"/><rect x="3" y="5" width="10" height="6" fill="#39A18B"/><rect x="5" y="11" width="6" height="2" fill="#2C7F6E"/><rect x="6" y="6" width="3" height="2" fill="#86E4CD"/>',
    star:'<rect x="7" y="1" width="2" height="14" fill="#F4F1E4"/><rect x="1" y="7" width="14" height="2" fill="#F4F1E4"/><rect x="4" y="4" width="2" height="2" fill="#EDE6C8"/><rect x="10" y="4" width="2" height="2" fill="#EDE6C8"/><rect x="4" y="10" width="2" height="2" fill="#EDE6C8"/><rect x="10" y="10" width="2" height="2" fill="#EDE6C8"/><rect x="5" y="5" width="6" height="6" fill="#FFFFFF"/>',
    bucket:'<rect x="3" y="5" width="10" height="2" fill="#BEBEBE"/><rect x="4" y="7" width="8" height="7" fill="#D8D8D8"/><rect x="5" y="8" width="6" height="4" fill="#3B7FD6"/>',
    sulfur:'<rect x="2" y="3" width="12" height="11" fill="#E3C13A"/><rect x="2" y="3" width="12" height="2" fill="#F2D95E"/><rect x="5" y="7" width="2" height="2" fill="#3A2E12"/><rect x="9" y="7" width="2" height="2" fill="#3A2E12"/><rect x="6" y="11" width="4" height="1" fill="#3A2E12"/>'
  };
  function itemSVG(name,size){
    var body=ITEMS[name];
    if(!body)return "";
    return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 16 16" aria-hidden="true" '+
      'shape-rendering="crispEdges" focusable="false">'+body+'</svg>';
  }

  /* ── Furniture markup (all optional — a spread without the field prints nothing) ── */
  function eraTag(s){
    if(!s||!s.era)return "";
    return '<span class="mcx-era">'+pair("",s.era.en,s.era.zh)+'</span>';
  }
  function statBadge(s){
    if(!s||!s.stat)return "";
    return '<div class="mcx-stat"><b>'+esc(s.stat.value)+'</b>'+pair("mcx-stat-label",s.stat.en,s.stat.zh)+'</div>';
  }
  /* Text and quote mini-pages used to be pure text, which read as empty. Each one
     now carries its own image as a band across the top of the page, faded into the
     page colour so the copy underneath stays readable. `page` is 2, 3 or 4 and
     picks images[1..3]; a topic that only authored a hero image gets nothing. */
  function imageBand(s,page,pathFn){
    var src=((s&&s.images)||[])[page-1];
    if(!src)return "";
    var p=pathFn||function(x){return x;};
    var url=esc(p(src)),cap=esc((s.titleEN||"")+" · "+(s.titleZH||""));
    return '<button type="button" class="mcx-band mcx-thumb" data-photo="'+url+'" data-caption="'+cap+'" '+
      'aria-label="Open image 開啟圖片"><img src="'+url+'" alt="" loading="lazy" '+
      'onerror="this.parentNode.style.display=\'none\'"></button>';
  }
  function card(kind,labelEN,labelZH,text){
    if(!text||(!text.en&&!text.zh))return "";
    return '<aside class="mcx-card '+kind+'">'+
      '<span class="mcx-card-label">'+pair("",labelEN,labelZH)+'</span>'+
      pair("mcx-card-text",text.en,text.zh)+
    '</aside>';
  }
  /* Text and quote pages bottom- or centre-align their copy, which left the top of
     the page bare. A running head plus a ghosted item watermark fills it the way a
     magazine feature spread does, without pushing the body text around. */
  function runningHead(s,spreadIndex){
    if(!s)return "";
    return '<div class="mcx-rhead"><b>'+String(spreadIndex+1).padStart(2,"0")+'</b>'+
      pair("",s.titleEN,s.titleZH)+'</div>';
  }
  function tipCard(s){return card("tip","Pro tip","高手技巧",s&&s.tip);}
  function factCard(s){return card("fact","Did you know?","你知道嗎？",s&&s.fact);}
  function keyChips(s){
    var list=(s&&s.keys)||[];
    if(!list.length)return "";
    return '<ul class="mcx-keys">'+list.slice(0,4).map(function(k){
      return '<li>'+pair("",k.en,k.zh)+'</li>';
    }).join("")+'</ul>';
  }

  /* ── Floating decorations ──
     Item slots are fixed positions in the spread's corners so they never land on
     top of the body copy. Mob renders only appear on the milestone spreads. */
  var SLOTS=[
    {x:"46.5%",y:"2%", s:40,r:-8},
    {x:"46.5%",y:"85%",s:46,r:9},
    {x:"92.5%",y:"44%",s:34,r:13},
    {x:"1%",   y:"42%",s:34,r:-13}
  ];
  var MOBS={
    creeper:"assets/books/minecraft/overlays/creeper.png",
    warden:"assets/books/minecraft/overlays/warden.png",
    sniffer:"assets/books/minecraft/overlays/sniffer.png"
  };
  /* spreadIndex → mob renders. Opening, milestones and closing only. */
  var MOB_PLAN={0:["creeper"],4:["creeper","sniffer"],10:["creeper"],16:["sniffer"],18:["warden"],22:["warden"],24:["creeper"]};
  var DECO_COLORS=["#79C64A","#65A9DC","#F2C94C","#F3A8BD","#DD5C4D","#D8894D"];

  function decorate(el,spread,spreadIndex,within,pathFn){
    if(!el)return;
    el.querySelectorAll(".ovl,.ovl-deco").forEach(function(o){o.remove();});
    var p=pathFn||function(x){return x;};
    /* Every item shows on both turns, but the slot assignment rotates with `within`
       so a topic's two turns do not look like the same page twice. */
    var items=(spread&&spread.items)||[];
    items.forEach(function(name,i){
      var slot=SLOTS[(i+within)%SLOTS.length];
      var svg=itemSVG(name,slot.s);
      if(!svg)return;
      var d=document.createElement("div");
      d.className="ovl";
      d.style.cssText="left:"+slot.x+";top:"+slot.y+";--ovl-rot:"+slot.r+"deg;--ovl-op:.34;animation-delay:"+(i*.18)+"s";
      d.innerHTML=svg;
      el.appendChild(d);
    });
    (MOB_PLAN[spreadIndex]||[]).forEach(function(name,i){
      var slot=SLOTS[(i+items.length+within)%SLOTS.length],d=document.createElement("div");
      d.className="ovl";
      d.style.cssText="left:"+slot.x+";top:"+slot.y+";--ovl-s:"+(slot.s+14)+"px;--ovl-rot:"+(-slot.r)+"deg;animation-delay:"+(.3+i*.2)+"s";
      var img=document.createElement("img");
      img.src=p("../"+MOBS[name]);img.alt="";img.loading="lazy";
      img.onerror=function(){if(this.parentNode)this.parentNode.remove();};
      d.appendChild(img);
      el.appendChild(d);
    });
    var deco=document.createElement("div");
    deco.className="ovl-deco";
    deco.style.cssText="left:"+(within?"93%":"4%")+";top:"+(spreadIndex%2?84:12)+"%;animation-delay:"+(spreadIndex*.7)+"s";
    deco.innerHTML='<svg width="30" height="30" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">'+
      '<rect width="16" height="16" fill="'+DECO_COLORS[spreadIndex%6]+'"/>'+
      '<rect width="8" height="8" fill="rgba(255,255,255,.28)"/>'+
      '<rect x="8" y="8" width="8" height="8" fill="rgba(0,0,0,.18)"/></svg>';
    el.appendChild(deco);
  }

  /* Gallery thumbs zoom their own image without also firing the photo page's zoom. */
  function wireThumbs(root,zoomFn){
    if(!root||!zoomFn)return;
    root.querySelectorAll(".mcx-thumb").forEach(function(btn){
      btn.onclick=function(e){
        e.stopPropagation();
        zoomFn(btn.dataset.photo,btn.dataset.caption);
      };
    });
  }

  var api={
    escape:esc,itemSVG:itemSVG,eraTag:eraTag,statBadge:statBadge,imageBand:imageBand,
    runningHead:runningHead,tipCard:tipCard,factCard:factCard,keyChips:keyChips,
    decorate:decorate,wireThumbs:wireThumbs,
    items:ITEMS
  };
  if(typeof window!=="undefined")window.SQMcraftMag=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
