/* Notifications, history feed and achievements.
   No new table and no new sync: the feed is per-tablet localStorage and every
   achievement is derived from numbers the app already has (star total, vocab
   boxes, game bests, today's ticks). index.html owns the triggers; this file
   only stores, dedupes and paints.
   ponytail: local feed, so a kid's history is per-device. Move it to a
   notifications table if the same kid starts using two tablets. */
(function(){
  const CAP=60;                       /* newest 60 entries per kid, then it rolls */
  const feedKey=kid=>"sq:feed:"+kid;
  const seenKey=kid=>"sq:feedSeen:"+kid;
  const achvKey=kid=>"sq:achv:"+kid;

  function load(key,fallback){
    try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}
    catch(e){return fallback;}
  }
  function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(e){}}

  /* ---- feed ---- */
  function feed(kid){const rows=load(feedKey(kid),[]);return Array.isArray(rows)?rows:[];}
  function unread(kid){
    const seen=localStorage.getItem(seenKey(kid))||"";
    return feed(kid).filter(r=>r.t>seen).length;
  }
  function markSeen(kid){localStorage.setItem(seenKey(kid),new Date().toISOString());}

  /* ---- toast ---- */
  function host(){
    let el=document.getElementById("sqToasts");
    if(!el){el=document.createElement("div");el.id="sqToasts";document.body.appendChild(el);}
    return el;
  }
  /* textContent everywhere: star reasons and Papa's message text are free text. */
  function toast(entry){
    const box=host();
    const el=document.createElement("div");
    el.className="sqtoast"+(entry.tone?" sqtoast--"+entry.tone:"");
    el.innerHTML='<span class="e"></span><span class="tx"><b></b><i></i><small></small></span>';
    el.querySelector(".e").textContent=entry.icon||"🔔";
    el.querySelector("b").textContent=entry.en||"";
    el.querySelector("i").textContent=entry.zh||"";
    el.querySelector("small").textContent=entry.sub||"";
    box.appendChild(el);
    while(box.children.length>3)box.firstChild.remove();
    const kill=function(){el.classList.add("out");setTimeout(function(){el.remove();},300);};
    el.onclick=kill;
    setTimeout(kill,4500);
  }

  /* Remember it for the history tab, and show it only to the kid it belongs to.
     `ref` makes a repeat harmless: realtime fires the same row on reconnect. */
  function push(kid,activeKid,entry){
    if(!kid)return;
    const rows=feed(kid);
    if(entry.ref&&rows.slice(0,20).some(r=>r.ref===entry.ref))return;
    rows.unshift(Object.assign({t:new Date().toISOString()},entry));
    save(feedKey(kid),rows.slice(0,CAP));
    if(kid===activeKid)toast(entry);
  }

  /* ---- achievements ---- */
  const ACHIEVEMENTS=[
    {id:"star1", icon:"⭐", en:"First star", zh:"第一顆星", test:s=>s.stars>=1},
    {id:"star10", icon:"🌟", en:"10 stars", zh:"10 顆星", test:s=>s.stars>=10},
    {id:"star25", icon:"✨", en:"25 stars", zh:"25 顆星", test:s=>s.stars>=25},
    {id:"star50", icon:"💫", en:"50 stars", zh:"50 顆星", test:s=>s.stars>=50},
    {id:"star100", icon:"🏆", en:"100 stars", zh:"100 顆星", test:s=>s.stars>=100},
    {id:"day", icon:"📅", en:"A whole day finished", zh:"完成一整天", test:s=>s.fullDay},
    {id:"brain", icon:"🧠", en:"Brain Gym trio done", zh:"完成頭腦體操三項", test:s=>s.brain},
    {id:"acts3", icon:"🏕", en:"3 activities in one day", zh:"一天完成 3 個活動", test:s=>s.acts>=3},
    {id:"words10", icon:"🔤", en:"10 words mastered", zh:"精通 10 個單字", test:s=>s.words>=10},
    {id:"words50", icon:"🧙", en:"50 words mastered", zh:"精通 50 個單字", test:s=>s.words>=50},
    {id:"games3", icon:"🎮", en:"3 games played", zh:"玩過 3 種遊戲", test:s=>s.games>=3}
  ];

  function earned(kid){const ids=load(achvKey(kid),[]);return Array.isArray(ids)?ids:[];}

  /* Returns only the ones that just unlocked, so the caller can celebrate them
     once. Already-earned badges never re-fire, and nothing is ever taken away —
     a badge is a memory, not a status. */
  function check(kid,stats){
    const have=earned(kid), fresh=[];
    ACHIEVEMENTS.forEach(function(a){
      if(have.indexOf(a.id)>=0)return;
      let ok=false;
      try{ok=!!a.test(stats);}catch(e){}
      if(ok){have.push(a.id);fresh.push(a);}
    });
    if(fresh.length)save(achvKey(kid),have);
    return fresh;
  }

  const api={ACHIEVEMENTS,feed,unread,markSeen,push,toast,earned,check};
  if(typeof window!=="undefined")window.SQNotify=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
