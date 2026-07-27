(function(){
  const CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  const KIDS={
    lucien:{name:"Lucien",color:"#3DDC97"},
    lili:{name:"Lili",color:"#FF6FB5"},
    luis:{name:"Luis",color:"#4EA8FF"}
  };
  const DAY=window.SQ_DAY_DATA||[];
  const BANK=window.SQ_ACT_DATA||[];
  const LOCK_CATS=[
    ["games","Games"],
    ["acts","Activities"],
    ["learn","Learn"],
    ["ask","Ask"],
    ["captain","Captain"]
  ];

  let client=null, session=null, today="", realtimeChannel=null;
  let rows={ticks:[],totals:[],stats:[],ledger:[],asks:[],passes:[],photos:[],kids:[],history:[],helpClaims:[],familySettings:[],redos:[],acts:[]};
  let answerRecord=null, answerChunks=[], answerAskId=null;
  const pinFeedback={}, adminPinFeedback={};
  let overridesRaw={}, dragState=null;
  let notifyItems=[];
  let browserNotifyEnabled=localStorage.getItem("sq-admin-notify")==="1";
  const silentRealtime=new Map();

  const CHAT_KEY="sq-admin-chat-filters";
  const CHAT_TYPES=[
    ["ask","💬 Ask"],
    ["claim","🏅 Claim"],
    ["pass","🎟 Pass"],
    ["photo","📷 Photo"],
    ["system","⚙ System"]
  ];
  /* System and photo rows are noise on a screen Papa watches all day, so they
     start off. Ask/claim/pass are the ones that can need an answer. */
  let chatFilters=(function(){
    const fallback={kid:"all",types:["ask","claim","pass"],needs:false};
    try{
      const saved=JSON.parse(localStorage.getItem(CHAT_KEY)||"null");
      if(!saved||typeof saved!=="object")return fallback;
      return {
        kid:saved.kid||"all",
        types:Array.isArray(saved.types)?saved.types:fallback.types,
        needs:!!saved.needs
      };
    }catch(e){return fallback;}
  })();
  function saveChatFilters(){
    localStorage.setItem(CHAT_KEY,JSON.stringify(chatFilters));
  }
  let chatStuckToBottom=true, chatUnseen=0;

  const $=id=>document.getElementById(id);
  const show=(id,on)=>$(id).classList.toggle("hidden",!on);
  const kidName=id=>KIDS[id]?KIDS[id].name:id;
  const blockTitle=i=>(DAY[i]&&DAY[i].title)||"Block";
  const blockTz=i=>(DAY[i]&&DAY[i].tz)||"";
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const fmt=ts=>new Date(ts).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
  const clock=t=>`${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`;
  const timeOnly=ts=>new Date(ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  const todayTicks=kid=>rows.ticks.filter(t=>t.kid_id===kid&&t.day===today);
  const tickFor=(kid,i)=>rows.ticks.find(t=>t.kid_id===kid&&t.day===today&&t.block_idx===i);
  const passFor=(kid,i,kind)=>rows.passes.find(p=>p.kid_id===kid&&p.day===today&&p.block_idx===i&&p.status==="granted"&&(!kind||p.kind===kind));
  function archivedAskIds(){
    const row=rows.familySettings.find(r=>r.key==="archived_asks");
    try{return new Set(JSON.parse(row&&row.value||"[]"));}catch(e){return new Set();}
  }
  const coveredSet=kid=>new Set([
    ...todayTicks(kid).map(t=>t.block_idx),
    ...rows.passes.filter(p=>p.kid_id===kid&&p.day===today&&["granted","spent"].includes(p.status)).map(p=>p.block_idx)
  ]);
  const dayComplete=kid=>coveredSet(kid).size>=DAY.length;

  function toast(msg,ok){
    const t=$("toast");
    if(!t)return;
    t.textContent=msg;
    t.classList.remove("hidden","toast--ok","toast--error");
    t.classList.add(ok?"toast--ok":"toast--error");
    clearTimeout(toast._t);
    toast._t=setTimeout(()=>t.classList.add("hidden"),4000);
  }
  const writeFailed=error=>toast(`Could not save — ${error.message}`);

  function renderNotifications(){
    const supported="Notification" in window;
    const permission=supported?Notification.permission:"unsupported";
    const enabled=supported&&browserNotifyEnabled&&permission==="granted";
    const permissionLabel={granted:"allowed",denied:"blocked",default:"not enabled"}[permission]||permission;
    const status=$("notifyStatus"), btn=$("notifyEnableBtn"), feed=$("notifyFeed");
    if(status)status.textContent=enabled?"Windows on":supported?`Windows ${permissionLabel}`:"Windows unsupported";
    if(btn){
      btn.textContent=enabled?"Disable Windows notifications":"Enable Windows notifications";
      btn.disabled=!supported||permission==="denied";
    }
    if(feed)feed.innerHTML=notifyItems.map(n=>`
      <article class="notify-item notify-item--${n.kind}">
        <span class="notify-time">${timeOnly(n.at)}</span>
        <div><b>${esc(n.title)}</b><p>${esc(n.body)}</p></div>
      </article>`).join("")||`<p class="notify-empty">Waiting for live activity.</p>`;
  }

  async function toggleBrowserNotifications(){
    if(!("Notification" in window)){toast("Browser notifications are not supported",false);return;}
    if(browserNotifyEnabled&&Notification.permission==="granted"){
      browserNotifyEnabled=false;
      localStorage.setItem("sq-admin-notify","0");
      renderNotifications();
      return;
    }
    const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
    browserNotifyEnabled=permission==="granted";
    localStorage.setItem("sq-admin-notify",browserNotifyEnabled?"1":"0");
    renderNotifications();
    toast(browserNotifyEnabled?"Windows notifications enabled":"Windows notifications not allowed",browserNotifyEnabled);
  }

  function pushNotify(title,body,kind){
    const item={title,body:body||"",kind:kind||"info",at:new Date().toISOString()};
    notifyItems=[item,...notifyItems].slice(0,30);
    renderNotifications();
    if("Notification" in window&&browserNotifyEnabled&&Notification.permission==="granted"){
      try{new Notification("Summer Quest Admin",{body:`${title} — ${body||""}`,icon:"assets/icons/icon-192.png",tag:`sq-${kind||"info"}-${Date.now()}`});}catch(e){}
    }
  }

  function realtimeKey(table,row){
    if(!row)return "";
    if(table==="day_ticks")return `${row.kid_id}:${row.day}:${row.block_idx}`;
    return row.id||"";
  }
  function suppressRealtime(table,row){
    const key=realtimeKey(table,row);
    if(key)silentRealtime.set(`${table}:${key}`,Date.now()+5000);
  }
  function shouldSuppressRealtime(table,row){
    const key=realtimeKey(table,row);
    if(!key)return false;
    const full=`${table}:${key}`, until=silentRealtime.get(full)||0;
    if(until>Date.now())return true;
    silentRealtime.delete(full);
    return false;
  }

  function notificationFor(table,payload){
    const row=payload.new||{};
    if(payload.eventType!=="INSERT"||shouldSuppressRealtime(table,row))return null;
    if(table==="asks")return {
      kind:row.kind==="urgent"?"urgent":"ask",
      title:`${kidName(row.kid_id)} asked for help`,
      body:row.body||"Voice memo"
    };
    if(table==="passes"&&row.status==="requested")return {
      kind:"pass",
      title:`${kidName(row.kid_id)} requested a ${row.kind||"pass"} pass`,
      body:`${blockTitle(row.block_idx)} ${blockTz(row.block_idx)}`
    };
    if(table==="photos")return {
      kind:"photo",
      title:`${kidName(row.kid_id)} uploaded proof`,
      body:`${blockTitle(row.block_idx)} ${blockTz(row.block_idx)}`
    };
    if(table==="help_claims"&&row.status==="requested")return {
      kind:"claim",
      title:`${kidName(row.captain_id)} sent a captain claim`,
      body:`Helped ${kidName(row.helped_kid_id)}`
    };
    if(table==="day_ticks"&&row.day===today)return {
      kind:"done",
      title:`${kidName(row.kid_id)} completed a block`,
      body:`${blockTitle(row.block_idx)} ${blockTz(row.block_idx)}`
    };
    if(table==="stars_ledger"&&row.source==="app")return {
      kind:"star",
      title:`${kidName(row.kid_id)} earned ${row.delta} star${row.delta===1?"":"s"}`,
      body:row.reason||"App activity"
    };
    return null;
  }

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      s.src=src; s.onload=resolve; s.onerror=reject;
      document.head.appendChild(s);
    });
  }

  const dayISO=(offset=0)=>SQ_DAY.isoOffset(offset);

  async function init(){
    if(!window.SQ_CONFIG||!SQ_CONFIG.SUPABASE_URL||!SQ_CONFIG.SUPABASE_ANON_KEY) return;
    show("configState",false);
    await loadScript(CDN);
    client=supabase.createClient(SQ_CONFIG.SUPABASE_URL,SQ_CONFIG.SUPABASE_ANON_KEY);
    const res=await client.auth.getSession();
    session=res.data.session;
    if(session) openDashboard(); else show("login",true);
  }

  async function openDashboard(){
    show("login",false); show("dash",true); show("logoutBtn",true);
    show("railLeft",true); show("railRight",true);
    $("shell").classList.remove("is-locked");
    today=dayISO(0);
    $("todayLabel").textContent=`Today ${today}`;
    $("noteDay").textContent=`Today ${today}`;
    renderNotifications();
    await loadAll();
    subscribeRealtime();
  }

  async function loadAll(){
    const start=dayISO(-13);
    const [ticks,totals,stats,ledger,asks,note,passes,photos,kids,history,helpClaims,familySettings,overrides,redos,acts]=await Promise.all([
      client.from("day_ticks").select("*").eq("day",today),
      client.from("star_totals").select("*"),
      client.from("game_stats").select("*").eq("stat","missions"),
      client.from("stars_ledger").select("*").order("created_at",{ascending:false}).limit(150),
      client.from("asks").select("*").order("created_at",{ascending:false}).limit(80),
      client.from("papa_notes").select("body").eq("day",today).maybeSingle(),
      client.from("passes").select("*").order("created_at",{ascending:false}).limit(80),
      client.from("photos").select("*").order("created_at",{ascending:false}).limit(80),
      client.from("kids").select("id,pin").order("id"),
      client.from("day_ticks").select("kid_id,day,block_idx").gte("day",start).lte("day",today),
      client.from("help_claims").select("*").order("created_at",{ascending:false}).limit(80),
      client.from("family_settings").select("key,value"),
      client.from("day_overrides").select("kid_id,block_idx,t").eq("day",today),
      client.from("day_redos").select("*").eq("day",today),
      client.from("act_done").select("*").eq("day",today)
    ]);
    rows={
      ticks:ticks.data||[],totals:totals.data||[],stats:stats.data||[],ledger:ledger.data||[],asks:asks.data||[],
      passes:passes.data||[],photos:photos.data||[],kids:kids.data||[],history:history.data||[],helpClaims:helpClaims.data||[],
      familySettings:familySettings.data||[],redos:redos.data||[],acts:acts.data||[]
    };
    overridesRaw={};
    (overrides.data||[]).forEach(function(r){
      (overridesRaw[r.kid_id]=overridesRaw[r.kid_id]||{})[r.block_idx]=r.t;
    });
    $("noteBody").value=note.data&&note.data.body?note.data.body:"";
    renderAll();
  }

  /* Cold panels remember whether Papa left them open. One localStorage key holds
     an array of the open fold names, so adding a fold later needs no migration. */
  const FOLD_KEY="sq-admin-folds";
  function openFolds(){
    try{
      const raw=JSON.parse(localStorage.getItem(FOLD_KEY)||"[]");
      return new Set(Array.isArray(raw)?raw:[]);
    }catch(e){return new Set();}
  }
  function bindFolds(){
    const open=openFolds();
    document.querySelectorAll("[data-fold]").forEach(function(el){
      el.open=open.has(el.dataset.fold);
      el.ontoggle=function(){
        const set=openFolds();
        if(el.open)set.add(el.dataset.fold); else set.delete(el.dataset.fold);
        localStorage.setItem(FOLD_KEY,JSON.stringify([...set]));
      };
    });
  }
  function renderFoldCounts(){
    const counts={
      Note:$("noteBody").value.trim()?1:0,
      Acts:rows.acts.length,
      Proofs:rows.photos.length,
      History:rows.history.length,
      Ledger:rows.ledger.length,
      Notify:notifyItems.length,
      Settings:rows.kids.filter(function(k){return k.pin;}).length
    };
    Object.keys(counts).forEach(function(name){
      const el=$("foldCount"+name);
      if(!el)return;
      const n=counts[name];
      el.textContent=name==="Settings"?`${n} PIN${n===1?"":"s"}`
        :name==="Note"?(n?"written":"empty")
        :String(n);
    });
  }

  function renderAll(){
    renderFoldCounts();
    renderOverview();
    renderGrants();
    renderActsToday();
    renderLedger();
    renderLedgerRecent();
    bindLedgerActions();
    renderConversation();
    renderProofs();
    renderHistory();
    renderPins();
    renderAdminPin();
    renderAppLocks();
  }

  function renderOverview(){
    $("overview").innerHTML=Object.entries(KIDS).map(([id,k])=>{
      const done=new Set(todayTicks(id).map(t=>t.block_idx));
      const redo=new Set(rows.redos.filter(r=>r.kid_id===id).map(r=>r.block_idx));
      const covered=coveredSet(id);
      const stars=(rows.totals.find(t=>t.kid_id===id)||{}).stars||0;
      const missions=(rows.stats.find(s=>s.kid_id===id)||{}).value||0;
      return `<article class="kid-card" style="--kid-color:${k.color}">
        <div class="schedule-head">
          <div>
            <h2 class="card-title">${k.name}</h2>
            <p><span class="gold">${stars}</span> stars · ${missions} photo missions</p>
          </div>
          <span class="pill">${covered.size}/${DAY.length} blocks</span>
        </div>
        <div class="progress"><div class="progress__fill" style="width:${covered.size/DAY.length*100}%;background:${k.color}"></div></div>
        <div class="schedule-list" data-schedule="${id}">
          ${scheduleOrder(id).map(i=>scheduleBlock(id,i,done,redo)).join("")}
        </div>
      </article>`;
    }).join("");
    bindScheduleBlocks();
  }

  function scheduleOrder(kid){
    return SQTime.displayOrder(DAY,SQTime.resolveOverrides(overridesRaw,kid));
  }

  function scheduleBlock(kid,i,done,redo){
    const b=DAY[i], eff=SQTime.resolveOverrides(overridesRaw,kid);
    const mins=SQTime.effMins(DAY,eff,i), timed=mins!=null;
    const info=SQTime.timelineInfo(DAY,eff,SQ_DAY.nowMins());
    const moved=(overridesRaw[kid]||{})[i]!=null;
    const removed=passFor(kid,i,"outing");
    const accepted=done.has(i);
    const state=accepted||removed?"is-done":i===info.current?"is-current":timed&&mins<info.now?"is-overdue":"is-upcoming";
    const status=removed?"removed":accepted?"accepted":redo.has(i)?"redo":"open";
    return `<div class="schedule-block ${state} ${accepted?"is-accepted":""} ${removed?"is-removed":""}" data-kid="${kid}" data-block="${i}" draggable="${timed&&!removed}">
      <button class="drag-handle" type="button" aria-label="Move block" ${timed&&!removed?"":"disabled"}>↕</button>
      <label class="schedule-time">
        <span>Time</span>
        <input class="input input--time" type="time" data-time="${kid}:${i}" value="${timed?clock(mins):""}" ${timed&&!removed?"":"disabled"}>
      </label>
      <div class="schedule-main">
        <b>${b.icon} ${b.title}</b>
        <span class="muted">${b.tz}</span>
        <span class="schedule-status ${accepted||removed?"ok":redo.has(i)?"gold":"muted"}">${status}${moved?" · moved":""}</span>
      </div>
      <div class="schedule-actions">
        ${accepted
          ?`<button class="btn btn--secondary" data-unaccept="${kid}:${i}">Undo</button>
            <button class="btn btn--secondary" data-sendback="${kid}:${i}">Send back</button>`
          :removed
            ?`<button class="btn" data-addback="${removed.id}:${kid}:${i}:${removed.credited?1:0}">Add back</button>`
            :`<button class="btn" data-accept="${kid}:${i}">Accept</button>
              <button class="btn btn--secondary" data-removeblock="${kid}:${i}">Remove</button>`}
      </div>
    </div>`;
  }

  function bindScheduleBlocks(){
    document.querySelectorAll(".schedule-block").forEach(row=>{
      row.ondragstart=e=>{
        if(row.getAttribute("draggable")!=="true"){e.preventDefault();return;}
        dragState={kid:row.dataset.kid,block:+row.dataset.block};
        row.classList.add("is-dragging");
        e.dataTransfer.effectAllowed="move";
      };
      row.ondragend=()=>{dragState=null;row.classList.remove("is-dragging");clearDropTargets();};
      row.ondragover=e=>{
        if(dragState&&dragState.kid===row.dataset.kid&&row.getAttribute("draggable")==="true"){
          e.preventDefault(); row.classList.add("is-drop-target");
        }
      };
      row.ondragleave=()=>row.classList.remove("is-drop-target");
      row.ondrop=e=>{
        e.preventDefault(); clearDropTargets();
        if(!dragState||dragState.kid!==row.dataset.kid)return;
        saveDraggedOrder(row.dataset.kid,dragState.block,+row.dataset.block);
      };
    });
    document.querySelectorAll("[data-time]").forEach(inp=>inp.onchange=()=>{
      const [kid,i]=inp.dataset.time.split(":");
      saveBlockTime(kid,+i,inp.value);
    });
    document.querySelectorAll("[data-accept]").forEach(b=>b.onclick=()=>{
      const [kid,i]=b.dataset.accept.split(":");
      acceptBlock(kid,+i);
    });
    document.querySelectorAll("[data-unaccept]").forEach(b=>b.onclick=()=>{
      const [kid,i]=b.dataset.unaccept.split(":");
      unacceptBlock(kid,+i,false);
    });
    document.querySelectorAll("[data-sendback]").forEach(b=>b.onclick=()=>{
      const [kid,i]=b.dataset.sendback.split(":");
      sendBackBlock(kid,+i);
    });
    document.querySelectorAll("[data-removeblock]").forEach(b=>b.onclick=()=>{
      const [kid,i]=b.dataset.removeblock.split(":");
      removeBlock(kid,+i);
    });
    document.querySelectorAll("[data-addback]").forEach(b=>b.onclick=()=>{
      const [passId,kid,i,credited]=b.dataset.addback.split(":");
      addBackBlock(passId,kid,+i,credited==="1");
    });
  }

  function clearDropTargets(){
    document.querySelectorAll(".is-drop-target").forEach(x=>x.classList.remove("is-drop-target"));
  }

  async function saveDraggedOrder(kid,fromBlock,toBlock){
    if(fromBlock===toBlock)return;
    const order=scheduleOrder(kid).filter(i=>SQTime.effMins(DAY,SQTime.resolveOverrides(overridesRaw,kid),i)!=null&&!passFor(kid,i,"outing"));
    const from=order.indexOf(fromBlock), to=order.indexOf(toBlock);
    if(from<0||to<0)return;
    order.splice(to,0,order.splice(from,1)[0]);
    const eff=SQTime.resolveOverrides(overridesRaw,kid);
    const slots=order.map(i=>SQTime.effMins(DAY,eff,i)).sort((a,b)=>a-b);
    const jobs=order.map((i,n)=>saveBlockTime(kid,i,clock(slots[n]),true));
    const results=await Promise.all(jobs);
    const err=results.find(r=>r&&r.error);
    if(err){writeFailed(err.error);return;}
    toast(`Schedule moved for ${kidName(kid)}`,true);
    await loadAll();
  }

  function baseTimeFor(kid,i){
    return (overridesRaw.all||{})[i]!=null?(overridesRaw.all||{})[i]:DAY[i].t;
  }

  async function saveBlockTime(kid,i,value,silent){
    const mins=SQTime.parseMins(value);
    if(mins==null)return {error:new Error("Use a valid time")};
    const base=baseTimeFor(kid,i);
    const q=SQTime.parseMins(value)===SQTime.parseMins(base)
      ?client.from("day_overrides").delete().eq("day",today).eq("block_idx",i).eq("kid_id",kid)
      :client.from("day_overrides").upsert({day:today,block_idx:i,kid_id:kid,t:value,updated_at:new Date().toISOString()});
    const result=await q;
    if(result.error){if(!silent)writeFailed(result.error);return result;}
    if(!silent){toast(`Time saved — ${kidName(kid)}`,true);await loadAll();}
    return result;
  }

  function starRefunds(kid,blocks,reason){
    return blocks.filter(i=>DAY[i]&&DAY[i].kind==="mission").map(i=>({
      kid_id:kid,delta:-1,reason:`${reason}: ${DAY[i].title}`,source:"admin",granted_by:session.user.id
    }));
  }

  async function acceptBlock(kid,i){
    if(tickFor(kid,i)||passFor(kid,i,"outing"))return;
    const beforeComplete=dayComplete(kid);
    suppressRealtime("day_ticks",{kid_id:kid,day:today,block_idx:i});
    const {error}=await client.from("day_ticks").insert({kid_id:kid,day:today,block_idx:i});
    if(error){writeFailed(error);return;}
    await client.from("day_redos").delete().eq("kid_id",kid).eq("day",today).eq("block_idx",i);
    const grants=[];
    if(DAY[i].kind==="mission")grants.push({kid_id:kid,delta:1,reason:`Admin accepted: ${DAY[i].title}`,source:"admin",granted_by:session.user.id});
    const after=new Set([...coveredSet(kid),i]);
    if(!beforeComplete&&after.size>=DAY.length)grants.push({kid_id:kid,delta:2,reason:"Day-complete bonus",source:"admin",granted_by:session.user.id});
    if(grants.length){
      const r=await client.from("stars_ledger").insert(grants);
      if(r.error){writeFailed(r.error);return;}
    }
    toast(`Accepted ✓ ${kidName(kid)} — ${DAY[i].title}`,true);
    await loadAll();
  }

  async function unacceptBlock(kid,i,redoNote){
    if(!tickFor(kid,i))return;
    const beforeComplete=dayComplete(kid);
    const {error}=await client.from("day_ticks").delete().eq("kid_id",kid).eq("day",today).eq("block_idx",i);
    if(error){writeFailed(error);return;}
    const after=coveredSet(kid);
    after.delete(i);
    if(rows.passes.some(p=>p.kid_id===kid&&p.day===today&&p.block_idx===i&&["granted","spent"].includes(p.status)))after.add(i);
    const refunds=starRefunds(kid,[i],redoNote?"Sent back":"Admin undo");
    if(beforeComplete&&after.size<DAY.length)refunds.push({kid_id:kid,delta:-2,reason:"Day-complete bonus undone",source:"admin",granted_by:session.user.id});
    if(refunds.length){
      const r=await client.from("stars_ledger").insert(refunds);
      if(r.error){writeFailed(r.error);return;}
    }
    if(redoNote!=null){
      const r=await client.from("day_redos").upsert({kid_id:kid,day:today,block_idx:i,note:redoNote});
      if(r.error){writeFailed(r.error);return;}
    }
    toast(`${redoNote!=null?"Sent back":"Acceptance undone"} — ${kidName(kid)}`,true);
    await loadAll();
  }

  async function sendBackBlock(kid,i){
    const titleZh=`${DAY[i].title} ${DAY[i].tz||""}`.trim();
    if(!confirm(`Send "${titleZh}" back to ${kidName(kid)} for a redo?`))return;
    const note=prompt("Note for the kid (optional)","")||"";
    await unacceptBlock(kid,i,note);
  }

  async function removeBlock(kid,i){
    if(passFor(kid,i,"outing"))return;
    const credited=$("removedCredited").checked;
    const pass={kid_id:kid,kind:"outing",status:"granted",day:today,block_idx:i,reason:"Removed from today's schedule",credited,granted_by:session.user.id};
    const r1=await client.from("passes").insert(pass);
    if(r1.error){writeFailed(r1.error);return;}
    if(credited){
      const r2=await client.from("stars_ledger").insert({kid_id:kid,delta:1,reason:`Removed block counts: ${DAY[i].title}`,source:"admin",granted_by:session.user.id});
      if(r2.error){writeFailed(r2.error);return;}
    }
    toast(`Removed — ${kidName(kid)} ${DAY[i].title}`,true);
    await loadAll();
  }

  async function addBackBlock(passId,kid,i,credited){
    const r1=await client.from("passes").delete().eq("id",passId);
    if(r1.error){writeFailed(r1.error);return;}
    if(credited){
      const r2=await client.from("stars_ledger").insert({kid_id:kid,delta:-1,reason:`Removed block added back: ${DAY[i].title}`,source:"admin",granted_by:session.user.id});
      if(r2.error){writeFailed(r2.error);return;}
    }
    toast(`Added back — ${kidName(kid)} ${DAY[i].title}`,true);
    await loadAll();
  }

  async function resetAcceptedDay(){
    const ticks=rows.ticks.filter(t=>t.day===today);
    if(!ticks.length){toast("No accepted blocks to reset",true);return;}
    if(!confirm("Reset all accepted blocks for today? This keeps removed/outing blocks."))return;
    const refunds=[];
    Object.keys(KIDS).forEach(kid=>{
      const kidTicks=ticks.filter(t=>t.kid_id===kid).map(t=>t.block_idx);
      refunds.push(...starRefunds(kid,kidTicks,"Day reset"));
      const passOnly=new Set(rows.passes.filter(p=>p.kid_id===kid&&p.day===today&&["granted","spent"].includes(p.status)).map(p=>p.block_idx));
      if(dayComplete(kid)&&passOnly.size<DAY.length)
        refunds.push({kid_id:kid,delta:-2,reason:"Day reset bonus undo",source:"admin",granted_by:session.user.id});
    });
    const r1=await client.from("day_ticks").delete().eq("day",today);
    if(r1.error){writeFailed(r1.error);return;}
    await client.from("day_redos").delete().eq("day",today);
    if(refunds.length){
      const r2=await client.from("stars_ledger").insert(refunds);
      if(r2.error){writeFailed(r2.error);return;}
    }
    toast("Accepted blocks reset",true);
    await loadAll();
  }

  /* Rail-shaped: one row per kid instead of three 260px cards. The reason field
     is shared — Papa types once, then taps whichever kid it applies to. */
  function renderGrants(){
    $("grants").innerHTML=Object.entries(KIDS).map(function(e){
      const id=e[0], k=e[1];
      const stars=(rows.totals.find(function(t){return t.kid_id===id;})||{}).stars||0;
      return `<div class="grant-row" style="--kid-color:${k.color}">
        <div class="grant-row__who">
          <b>${esc(k.name)}</b>
          <span class="gold">⭐ ${stars}</span>
        </div>
        <div class="grant-row__btns">
          <button class="btn btn--danger" data-grant="${id}" data-delta="-1" title="Minus one star">−1</button>
          <button class="btn" data-grant="${id}" data-delta="1" title="Plus one star">+1</button>
          <button class="btn btn--secondary" data-grant="${id}" data-delta="2">+2</button>
          <button class="btn btn--secondary" data-grant="${id}" data-delta="3">+3</button>
          <button class="btn btn--secondary" data-grantcustom="${id}" title="Grant the custom amount below">±</button>
        </div>
      </div>`;
    }).join("")+`
      <label class="field"><span>Reason</span>
        <input class="input" id="grantReason" placeholder="helped Lucien"></label>
      <label class="field"><span>Custom amount (the ± button)</span>
        <input class="input" id="grantAmount" type="number" min="-20" max="20" step="1" value="5"></label>
      <details class="grant-danger">
        <summary>More</summary>
        <div class="row">
          ${Object.entries(KIDS).map(function(e){
            return `<button class="btn btn--danger" data-resetstars="${e[0]}">Reset ${esc(e[1].name)} to 0</button>`;
          }).join("")}
        </div>
      </details>`;
    document.querySelectorAll("[data-grant]").forEach(function(b){
      b.onclick=function(){grantStars(b.dataset.grant,+b.dataset.delta);};
    });
    /* Custom amount is shared like the reason: type once, tap the kid it fits. */
    document.querySelectorAll("[data-grantcustom]").forEach(function(b){
      b.onclick=function(){
        const v=Math.round(+$("grantAmount").value||0);
        if(!v){toast("Type a custom amount first",false);return;}
        if(v<-20||v>20){toast("Custom amount must be between −20 and 20",false);return;}
        grantStars(b.dataset.grantcustom,v);
      };
    });
    document.querySelectorAll("[data-resetstars]").forEach(function(b){
      b.onclick=function(){resetStars(b.dataset.resetstars);};
    });
  }

  async function grantStars(kid,delta){
    const input=$("grantReason");
    const reason=input.value.trim()||(delta>0?"Admin grant":"Admin correction");
    const {error}=await client.from("stars_ledger").insert({kid_id:kid,delta,reason,source:"admin",granted_by:session.user.id});
    if(error){writeFailed(error);return;}
    toast(`${delta>0?"+":""}${delta} ⭐ ${kidName(kid)} — saved`,true);
    input.value="";
    await loadAll();
  }

  async function resetStars(kid){
    const total=(rows.totals.find(t=>t.kid_id===kid)||{}).stars||0;
    if(!total){toast(`${kidName(kid)} already has 0 stars`,true);return;}
    if(!confirm(`Reset ${kidName(kid)} stars to 0? This adds a ledger row of ${-total}.`))return;
    const {error}=await client.from("stars_ledger").insert({
      kid_id:kid,delta:-total,reason:"Star reset",source:"admin",granted_by:session.user.id
    });
    if(error){writeFailed(error);return;}
    toast(`${kidName(kid)} stars reset to 0`,true);
    await loadAll();
  }

  /* Activities a kid ticked today. Each tick granted exactly 1 ⭐ (index.html actDone),
     so revoking is always −1 plus deleting the act_done row — the tablet re-hydrates
     actsDay.done from act_done, so the activity goes back to un-ticked and re-earnable. */
  const actLabel=i=>{
    const lg=i>=LEARN_BASE?learnGuideAt(i):null;
    if(lg)return `${lg.icon} ${lg.title} ${lg.tz}`;
    return BANK[i]?`${BANK[i].icon} ${BANK[i].cat} ${BANK[i].catz}`:`Activity #${i}`;
  };
  const actDetail=(i,kid)=>{
    const lg=i>=LEARN_BASE?learnGuideAt(i):null;
    if(lg)return `Learn guide — ${(lg[kid]||[]).length} steps, self-claimed`;
    return BANK[i]?`${BANK[i][kid]||""} ${(BANK[i].z&&BANK[i].z[kid])||""}`.trim():"";
  };

  function renderActsToday(){
    $("actsToday").innerHTML=Object.entries(KIDS).map(([id,k])=>{
      const mine=rows.acts.filter(a=>a.kid_id===id).sort((a,b)=>a.act_idx-b.act_idx);
      const list=mine.length
        ? mine.map(a=>`<div class="row act-row">
            <div>
              <b>${esc(actLabel(a.act_idx))}</b>
              <p class="compact-copy">${esc(actDetail(a.act_idx,id))}</p>
            </div>
            <button class="btn btn--danger" data-revokeact="${id}" data-acti="${a.act_idx}">Revoke ⭐</button>
          </div>`).join("")
        : `<p class="compact-copy">Nothing ticked yet today</p>`;
      return `<article class="kid-card" style="--kid-color:${k.color}">
        <h3>${k.name}</h3>
        <p class="compact-copy">${mine.length} activity star${mine.length===1?"":"s"} today</p>
        ${list}
      </article>`;
    }).join("");
    document.querySelectorAll("[data-revokeact]").forEach(b=>b.onclick=()=>revokeAct(b.dataset.revokeact,+b.dataset.acti));
  }

  async function revokeAct(kid,i){
    if(!confirm(`Revoke ${kidName(kid)}'s star for "${actLabel(i)}"? It goes back to un-ticked so it can be done for real today.`))return;
    /* .select() so we can tell "deleted" from "RLS silently matched 0 rows" —
       without the "admin unact" policy the delete is a no-op with no error. */
    const del=await client.from("act_done").delete().eq("kid_id",kid).eq("day",today).eq("act_idx",i).select();
    if(del.error){writeFailed(del.error);return;}
    if(!del.data||!del.data.length){
      toast("Could not un-tick — re-run supabase/schema.sql");
      return;
    }
    const {error}=await client.from("stars_ledger").insert({
      kid_id:kid,delta:-1,reason:`Revoked · ${actLabel(i)}`,
      source:"admin",granted_by:session.user.id
    });
    if(error){writeFailed(error);await loadAll();return;}
    toast(`Revoked — ${kidName(kid)} can redo it today`,true);
    await loadAll();
  }

  function ledgerActionsHtml(r){
    /* Admin grants are Papa's own rows: hard-delete is honest. App-earned rows
       are the kid's history — revoking inserts a matching negative row instead,
       so the ledger still shows what happened and why. */
    if(r.source==="admin")return `<button class="btn btn--danger" data-delstar="${r.id}" title="Undo">⟲</button>`;
    return r.delta>0?`<button class="btn btn--danger" data-revokestar="${r.id}" title="Revoke">⟲</button>`:"";
  }

  function bindLedgerActions(){
    document.querySelectorAll("[data-delstar]").forEach(function(b){
      b.onclick=async function(){
        const {error}=await client.from("stars_ledger").delete().eq("id",b.dataset.delstar);
        if(error){writeFailed(error);return;}
        toast("Grant undone",true);
        await loadAll();
      };
    });
    document.querySelectorAll("[data-revokestar]").forEach(function(b){
      b.onclick=async function(){
        const r=rows.ledger.find(function(x){return x.id===b.dataset.revokestar;});
        if(!r)return;
        if(!confirm(`Revoke ${r.delta} ⭐ from ${kidName(r.kid_id)} — "${r.reason}"?`))return;
        const {error}=await client.from("stars_ledger").insert({
          kid_id:r.kid_id,delta:-r.delta,reason:`Revoked · ${r.reason}`,
          source:"admin",granted_by:session.user.id
        });
        if(error){writeFailed(error);return;}
        toast(`−${r.delta} ⭐ ${kidName(r.kid_id)} — revoked`,true);
        await loadAll();
      };
    });
  }

  /* Star kinds. Matched on the reason prefix the kid app writes
     (`Kind 中文 · where · what`), longest/most specific first. Rows written by
     older builds fall through to "other", which is exactly the bucket Papa
     wants to see shrink to zero. */
  const STAR_KINDS=[
    {key:"unlabelled",label:"⚠️ Unlabelled",test:r=>/^Unlabelled|^App progress/.test(r)},
    {key:"revoked",   label:"↩️ Revoked",   test:r=>/^Revoked|^Star reset|^Day reset/.test(r)},
    {key:"mission",   label:"🎯 Mission",   test:r=>/^Mission |^My Day mission/.test(r)},
    {key:"practice",  label:"🥋 Practice",  test:r=>/^Practice /.test(r)},
    {key:"activity",  label:"🧹 Activity",  test:r=>/^Activity /.test(r)},
    {key:"learn",     label:"🧭 Learn",     test:r=>/^Learn /.test(r)},
    {key:"bonus",     label:"🌟 Bonus",     test:r=>/^Bonus |^Day complete/.test(r)},
    {key:"outing",    label:"🚶 Outing",    test:r=>/^Outing |^Removed block/.test(r)},
    {key:"captain",   label:"🤝 Captain",   test:r=>/^captain help/i.test(r)}
  ];
  function starKind(r){
    const reason=String((r&&r.reason)||"");
    const hit=STAR_KINDS.find(function(k){return k.test(reason);});
    if(hit)return hit;
    return {key:r&&r.source==="admin"?"papa":"other",
            label:r&&r.source==="admin"?"👨 Papa":"❓ Other"};
  }

  /* Ledger filters live in memory only — Papa opens the fold to answer one
     question, not to keep a saved view. */
  let ledgerFilter={kid:"all",kind:"all",todayOnly:false};

  function ledgerVisible(){
    return rows.ledger.filter(function(r){
      if(ledgerFilter.kid!=="all"&&r.kid_id!==ledgerFilter.kid)return false;
      if(ledgerFilter.kind!=="all"&&starKind(r).key!==ledgerFilter.kind)return false;
      if(ledgerFilter.todayOnly&&String(r.created_at||"").slice(0,10)!==today)return false;
      return true;
    });
  }

  /* One row per kid: where today's stars actually came from. This is the
     "what are they doing to earn these" answer, before the raw table. */
  function ledgerSummaryHtml(){
    const todays=rows.ledger.filter(function(r){
      return String(r.created_at||"").slice(0,10)===today&&r.delta>0;
    });
    return `<div class="ledger-summary">${Object.entries(KIDS).map(function(e){
      const id=e[0], k=e[1];
      const mine=todays.filter(function(r){return r.kid_id===id;});
      const byKind=new Map();
      mine.forEach(function(r){
        const kind=starKind(r);
        const cur=byKind.get(kind.key)||{label:kind.label,stars:0,n:0};
        cur.stars+=r.delta; cur.n++;
        byKind.set(kind.key,cur);
      });
      const total=mine.reduce(function(s,r){return s+r.delta;},0);
      const chips=[...byKind.values()].sort(function(a,b){return b.stars-a.stars;})
        .map(function(c){return `<span class="pill">${esc(c.label)} ${c.stars}⭐ ×${c.n}</span>`;}).join("");
      return `<div class="ledger-summary__kid" style="--kid-color:${k.color}">
        <b>${esc(k.name)}</b> <span class="gold">+${total}⭐ today</span>
        <div class="chat-filters">${chips||`<span class="pill">nothing yet</span>`}</div>
      </div>`;
    }).join("")}</div>`;
  }

  function ledgerFiltersHtml(){
    const kinds=[{key:"all",label:"All kinds"}].concat(STAR_KINDS.map(function(k){
      return {key:k.key,label:k.label};
    })).concat([{key:"papa",label:"👨 Papa"},{key:"other",label:"❓ Other"}]);
    const kidChips=[{key:"all",label:"All kids"}].concat(Object.entries(KIDS).map(function(e){
      return {key:e[0],label:e[1].name};
    }));
    const chip=(on,val,attr,label)=>
      `<button class="chip${on?" is-on":""}" data-${attr}="${val}">${esc(label)}</button>`;
    return `<div class="chat-filters">${kidChips.map(function(c){
        return chip(ledgerFilter.kid===c.key,c.key,"ledkid",c.label);
      }).join("")}
      ${chip(ledgerFilter.todayOnly,"1","ledtoday","Today only")}</div>
      <div class="chat-filters">${kinds.map(function(c){
        return chip(ledgerFilter.kind===c.key,c.key,"ledkind",c.label);
      }).join("")}</div>`;
  }

  function renderLedger(){
    const visible=ledgerVisible();
    $("ledger").innerHTML=ledgerSummaryHtml()+ledgerFiltersHtml()+
      `<p class="compact-copy">${visible.length} of ${rows.ledger.length} rows</p>`+
      `<div class="table-scroll"><table class="table"><thead><tr>
      <th>Time</th><th>Kid</th><th>Delta</th><th>Kind</th><th>What earned it</th><th>Source</th><th></th>
    </tr></thead><tbody>${visible.map(function(r){return `<tr>
      <td>${fmt(r.created_at)}</td><td>${kidName(r.kid_id)}</td><td>${r.delta>0?"+":""}${r.delta}</td>
      <td>${esc(starKind(r).label)}</td>
      <td>${esc(r.reason)}</td><td>${esc(r.source)}</td>
      <td>${ledgerActionsHtml(r)}</td>
    </tr>`;}).join("")}</tbody></table></div>`;
    bindLedgerFilters();
    bindLedgerActions();
  }

  function bindLedgerFilters(){
    document.querySelectorAll("[data-ledkid]").forEach(function(b){
      b.onclick=function(){ledgerFilter.kid=b.dataset.ledkid;renderLedger();};
    });
    document.querySelectorAll("[data-ledkind]").forEach(function(b){
      b.onclick=function(){ledgerFilter.kind=b.dataset.ledkind;renderLedger();};
    });
    document.querySelectorAll("[data-ledtoday]").forEach(function(b){
      b.onclick=function(){ledgerFilter.todayOnly=!ledgerFilter.todayOnly;renderLedger();};
    });
  }

  /* Rail view: confirmation, not audit. Last 8 rows so Papa can see a grant land
     and undo a mis-tap without leaving the rail. Full history lives in the
     centre Ledger fold. */
  function renderLedgerRecent(){
    const recent=rows.ledger.slice(0,8);
    $("ledgerRecent").innerHTML=recent.length?recent.map(function(r){
      const k=KIDS[r.kid_id]||{name:r.kid_id,color:"var(--blue)"};
      return `<div class="ledger-row" style="--kid-color:${k.color}">
        <span class="muted">${timeOnly(r.created_at)}</span>
        <span class="ledger-row__delta ${r.delta>0?"gold":"bad"}">${r.delta>0?"+":""}${r.delta}</span>
        <span class="ledger-row__why"><b>${esc(k.name)}</b> ${esc(starKind(r).label)} ${esc(r.reason)}</span>
        ${ledgerActionsHtml(r)}
      </div>`;
    }).join(""):`<p class="compact-copy">No stars yet today</p>`;
  }

  function publicUrl(path){
    if(!path) return "";
    return client.storage.from("voices").getPublicUrl(path).data.publicUrl;
  }
  function proofUrl(path){
    if(!path) return "";
    return client.storage.from("proofs").getPublicUrl(path).data.publicUrl;
  }

  function chatStream(){
    return SQChat.buildStream(
      {asks:rows.asks,helpClaims:rows.helpClaims,passes:rows.passes,
       photos:rows.photos,ticks:rows.ticks,ledger:rows.ledger,redos:rows.redos},
      {today:today,archivedIds:archivedAskIds()}
    );
  }

  function chatFilterChips(){
    const kidBtns=[["all","All"]].concat(Object.entries(KIDS).map(function(e){
      return [e[0],e[1].name];
    })).map(function(pair){
      const on=chatFilters.kid===pair[0];
      return `<button class="chip ${on?"is-on":""}" data-chatkid="${pair[0]}"
        style="--kid-color:${KIDS[pair[0]]?KIDS[pair[0]].color:"var(--blue)"}"
        aria-pressed="${on}">${esc(pair[1])}</button>`;
    }).join("");
    $("chatKidFilter").innerHTML=kidBtns;

    const needsOn=chatFilters.needs;
    const typeBtns=[`<button class="chip chip--needs ${needsOn?"is-on":""}"
      data-chatneeds="1" aria-pressed="${needsOn}">⚡ Needs you</button>`]
      .concat(CHAT_TYPES.map(function(pair){
        const on=chatFilters.types.indexOf(pair[0])>=0;
        return `<button class="chip ${on?"is-on":""} ${needsOn?"is-muted":""}"
          data-chattype="${pair[0]}" aria-pressed="${on}">${esc(pair[1])}</button>`;
      })).join("");
    $("chatTypeFilter").innerHTML=typeBtns;

    document.querySelectorAll("[data-chatkid]").forEach(function(b){
      b.onclick=function(){chatFilters.kid=b.dataset.chatkid;saveChatFilters();renderConversation();};
    });
    document.querySelectorAll("[data-chattype]").forEach(function(b){
      b.onclick=function(){
        const t=b.dataset.chattype, i=chatFilters.types.indexOf(t);
        if(i<0)chatFilters.types=chatFilters.types.concat([t]);
        else chatFilters.types=chatFilters.types.filter(function(x){return x!==t;});
        chatFilters.needs=false;
        saveChatFilters();renderConversation();
      };
    });
    $("chatTypeFilter").querySelector("[data-chatneeds]").onclick=function(){
      chatFilters.needs=!chatFilters.needs;saveChatFilters();renderConversation();
    };
  }

  function chatRowHtml(row){
    const k=KIDS[row.kidId]||{name:row.kidId,color:"var(--blue)"};
    const when=timeOnly(row.at);
    if(row.type==="system"){
      const label=row.meta.event==="tick"?`✓ ${blockTitle(row.meta.blockIdx)} ${blockTz(row.meta.blockIdx)}`
        :row.meta.event==="star"?`${row.meta.delta>0?"+":""}${row.meta.delta} ⭐ ${row.body}`
        :`↩ ${blockTitle(row.meta.blockIdx)} ${blockTz(row.meta.blockIdx)} — redo`;
      return `<div class="chat-sys">${when} · ${esc(k.name)} ${esc(label)}</div>`;
    }
    if(row.type==="reply"){
      return `<article class="bubble bubble--papa">
        <div class="bubble__meta">Papa · ${when}</div>
        ${row.body?`<p>${esc(row.body)}</p>`:""}
        ${row.audio?`<audio class="audio" controls src="${publicUrl(row.audio)}"></audio>`:""}
      </article>`;
    }
    if(row.type==="photo"){
      return `<article class="bubble bubble--kid" style="--kid-color:${k.color}">
        <div class="bubble__meta">${esc(k.name)} · ${when} · 📷 ${esc(blockTitle(row.meta.blockIdx))}</div>
        <img class="thumb" src="${proofUrl(row.meta.path)}" alt="Photo proof">
      </article>`;
    }
    if(row.type==="claim"){
      const done=row.meta.status!=="requested";
      return `<article class="bubble bubble--kid bubble--action" style="--kid-color:${k.color}">
        <div class="bubble__meta">${esc(k.name)} · captain · ${when}</div>
        <p>Helped ${esc(kidName(row.meta.helped))} — ${esc(row.body)}</p>
        ${done
          ?`<p class="${row.meta.status==="approved"?"ok":"muted"}">${row.meta.status==="approved"?"Approved":"Denied"}</p>`
          :`<div class="row"><button class="btn" data-helpok="${row.srcId}">✓ Approve +1</button>
             <button class="btn btn--danger" data-helpno="${row.srcId}">✕ Deny</button></div>`}
      </article>`;
    }
    if(row.type==="pass"){
      const done=row.meta.status!=="requested";
      const kindLabel=row.meta.kind==="golden"?"Golden":"Excused";
      return `<article class="bubble bubble--kid bubble--action" style="--kid-color:${k.color}">
        <div class="bubble__meta">${esc(k.name)} · 🎟 ${kindLabel} · ${when}</div>
        <p>${esc(blockTitle(row.meta.blockIdx))} ${esc(blockTz(row.meta.blockIdx))} — ${esc(row.body||"no reason")}</p>
        ${done
          ?`<p class="${row.meta.status==="granted"?"ok":"muted"}">${esc(row.meta.status)}</p>`
          :`<div class="row"><button class="btn" data-passok="${row.srcId}">✓ Approve</button>
             <button class="btn btn--danger" data-passno="${row.srcId}">✕ Deny</button></div>`}
      </article>`;
    }
    /* type === "ask" */
    return `<article class="bubble bubble--kid ${row.archived?"is-archived":""}" style="--kid-color:${k.color}">
      <div class="bubble__meta">${esc(k.name)} · ${esc(row.meta.kind)} · ${when}</div>
      <p>${esc(row.body||"Voice memo")}</p>
      ${row.audio?`<audio class="audio" controls src="${publicUrl(row.audio)}"></audio>`:""}
      ${row.needs?`<label class="field"><span>Answer</span>
        <textarea class="input textarea" id="answer-${row.srcId}" placeholder="I can help after lunch."></textarea></label>
        <div class="row">
          <button class="btn" data-answer="${row.srcId}">Send</button>
          <button class="btn btn--secondary" data-rec="${row.srcId}">🎤 Record</button>
          <button class="btn btn--secondary" data-stop="${row.srcId}" disabled>Stop</button>
          <span class="message message--ok" id="recstatus-${row.srcId}"></span>
        </div>`:""}
      <div class="row inbox-actions">
        ${row.archived
          ?`<button class="btn btn--secondary" data-unarchiveask="${row.srcId}">Restore</button>`
          :`<button class="btn btn--secondary" data-archiveask="${row.srcId}">Archive</button>`}
      </div>
    </article>`;
  }

  function renderConversation(){
    const box=$("chatStream");
    const stream=chatStream();
    chatFilterChips();

    const badge=$("chatNeedsBadge");
    const needs=SQChat.needsCount(stream);
    badge.textContent=String(needs);
    badge.classList.toggle("gold",needs>0);

    const filters={
      kid:chatFilters.kid,
      types:chatFilters.types,
      needs:chatFilters.needs,
      archived:$("showArchivedAsks").checked
    };
    const visible=SQChat.filterStream(stream,filters);

    const note=$("noteBody").value.trim();
    $("chatPin").innerHTML=note
      ?`<b>📌 Today</b> ${esc(note)}`
      :`<span class="muted">📌 No message for today yet</span>`;

    box.innerHTML=visible.length
      ?visible.map(chatRowHtml).join("")
      :`<p class="chat-empty">Nothing here
         <button class="btn btn--secondary" id="chatClearFilters">Clear filters</button></p>`;

    const clear=$("chatClearFilters");
    if(clear)clear.onclick=function(){
      chatFilters={kid:"all",types:["ask","claim","pass"],needs:false};
      saveChatFilters();renderConversation();
    };

    document.querySelectorAll("[data-answer]").forEach(function(b){b.onclick=function(){answerAsk(b.dataset.answer);};});
    document.querySelectorAll("[data-rec]").forEach(function(b){b.onclick=function(){startAnswerRecord(b.dataset.rec);};});
    document.querySelectorAll("[data-stop]").forEach(function(b){b.onclick=function(){stopAnswerRecord(b.dataset.stop);};});
    document.querySelectorAll("[data-archiveask]").forEach(function(b){b.onclick=function(){archiveAsk(b.dataset.archiveask,true);};});
    document.querySelectorAll("[data-unarchiveask]").forEach(function(b){b.onclick=function(){archiveAsk(b.dataset.unarchiveask,false);};});
    document.querySelectorAll("[data-helpok]").forEach(function(b){b.onclick=function(){setHelpClaim(b.dataset.helpok,"approved");};});
    document.querySelectorAll("[data-helpno]").forEach(function(b){b.onclick=function(){setHelpClaim(b.dataset.helpno,"denied");};});
    document.querySelectorAll("[data-passok]").forEach(function(b){b.onclick=function(){setPass(b.dataset.passok,"granted");};});
    document.querySelectorAll("[data-passno]").forEach(function(b){b.onclick=function(){setPass(b.dataset.passno,"denied");};});

    /* Never yank the viewport out from under Papa mid-read: only auto-scroll if
       he was already parked at the bottom. Otherwise offer a jump button. */
    if(chatStuckToBottom){
      box.scrollTop=box.scrollHeight;
      chatUnseen=0;
      show("chatJump",false);
    }else{
      chatUnseen=visible.length;
      show("chatJump",true);
    }
  }

  async function startAnswerRecord(id){
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    answerAskId=id; answerChunks=[];
    answerRecord=new MediaRecorder(stream);
    answerRecord.ondataavailable=e=>{if(e.data.size) answerChunks.push(e.data);};
    answerRecord.onstop=()=>stream.getTracks().forEach(t=>t.stop());
    answerRecord.start();
    document.querySelector(`[data-rec="${id}"]`).disabled=true;
    document.querySelector(`[data-stop="${id}"]`).disabled=false;
    $(`recstatus-${id}`).textContent="Recording";
  }

  function stopAnswerRecord(id){
    if(answerRecord&&answerAskId===id){
      answerRecord.stop();
      $(`recstatus-${id}`).textContent="Ready";
    }
  }

  async function answerAsk(id){
    const body=$(`answer-${id}`).value.trim();
    let answer_audio_path=null;
    if(answerAskId===id&&answerChunks.length){
      const blob=new Blob(answerChunks,{type:"audio/webm"});
      answer_audio_path=`answers/${id}-${Date.now()}.webm`;
      const up=await client.storage.from("voices").upload(answer_audio_path,blob,{contentType:"audio/webm",upsert:false});
      if(up.error){writeFailed(up.error);return;}
      answerAskId=null; answerChunks=[];
    }
    if(!body&&!answer_audio_path){$(`answer-${id}`).focus();return;}
    const {error}=await client.from("asks").update({answer:body||null,answer_audio_path,answered_at:new Date().toISOString()}).eq("id",id);
    if(error){writeFailed(error);return;}
    toast("Answer sent",true);
    await loadAll();
  }

  async function archiveAsk(id,archive){
    const ids=archivedAskIds();
    if(archive)ids.add(id); else ids.delete(id);
    const {error}=await client.from("family_settings").upsert({
      key:"archived_asks",value:JSON.stringify([...ids]),updated_at:new Date().toISOString()
    });
    if(error){writeFailed(error);return;}
    toast(archive?"Ask archived":"Ask restored",true);
    await loadAll();
  }

  async function setHelpClaim(id,status){
    const claim=rows.helpClaims.find(c=>c.id===id);
    if(!claim)return;
    $("helpClaimsStatus").textContent="";
    const reviewed_at=new Date().toISOString();
    const {error}=await client.from("help_claims").update({
      status,reviewed_by:session.user.id,reviewed_at
    }).eq("id",id);
    if(error){$("helpClaimsStatus").textContent=error.message;return;}
    if(status==="approved"){
      const reason=`captain help: ${kidName(claim.helped_kid_id)} — ${claim.body}`;
      const grant=await client.from("stars_ledger").insert({
        kid_id:claim.captain_id,delta:1,reason,source:"admin",granted_by:session.user.id
      });
      if(grant.error){$("helpClaimsStatus").textContent=grant.error.message;return;}
    }
    await loadAll();
  }

  async function setPass(id,status){
    const {error}=await client.from("passes").update({status,granted_by:session.user.id}).eq("id",id);
    if(error){writeFailed(error);return;}
    toast(status==="granted"?"Pass approved":"Pass denied",true);
    await loadAll();
  }

  function renderProofs(){
    $("proofs").innerHTML=rows.photos.length?`<div class="thumb-grid">${rows.photos.map(p=>`
      <article class="ask-card">
        <img class="thumb" src="${proofUrl(p.path)}" alt="Photo proof">
        <p>${kidName(p.kid_id)} · ${p.day} · ${blockTitle(p.block_idx)}<br><span class="muted">${blockTz(p.block_idx)}</span></p>
      </article>`).join("")}</div>`:`<p>No proof photos yet.</p>`;
  }

  /* Dinner gallery — full-screen slideshow of today's photos */
  let galleryTimer=null,galleryIdx=0,galleryShots=[];
  function drawGallery(){
    const p=galleryShots[galleryIdx];
    if(!p)return;
    $("galleryImg").src=proofUrl(p.path);
    $("galleryCap").innerHTML=`<b>${kidName(p.kid_id)}</b> · ${blockTitle(p.block_idx)} <span class="muted">${blockTz(p.block_idx)}</span> · ${galleryIdx+1}/${galleryShots.length}`;
  }
  function galleryStep(dir){
    galleryIdx=(galleryIdx+dir+galleryShots.length)%galleryShots.length;
    drawGallery(); startGalleryTimer();
  }
  function startGalleryTimer(){
    stopGalleryTimer();
    galleryTimer=setInterval(()=>{galleryIdx=(galleryIdx+1)%galleryShots.length;drawGallery();},6000);
  }
  function stopGalleryTimer(){if(galleryTimer){clearInterval(galleryTimer);galleryTimer=null;}}
  function openGallery(){
    galleryShots=rows.photos.filter(p=>p.day===today);
    if(!galleryShots.length){toast("No photos today yet",true);return;}
    galleryIdx=0; show("gallery",true); drawGallery(); startGalleryTimer();
  }
  function closeGallery(){stopGalleryTimer();show("gallery",false);}

  function renderHistory(){
    const days=Array.from({length:14},(_,i)=>dayISO(i-13));
    const counts=new Map();
    rows.history.forEach(r=>counts.set(`${r.kid_id}:${r.day}`,(counts.get(`${r.kid_id}:${r.day}`)||0)+1));
    $("history").innerHTML=`<div class="heatmap">
      <span></span>${days.map(d=>`<span class="muted">${d.slice(5)}</span>`).join("")}
      ${Object.entries(KIDS).map(([id,k])=>`<b>${k.name}</b>${days.map(d=>{
        const c=counts.get(`${id}:${d}`)||0, pct=c/DAY.length;
        return `<span class="heat-cell" style="background:rgba(61,220,151,${Math.max(.08,pct)})">${c}</span>`;
      }).join("")}`).join("")}
    </div>`;
  }

  function renderPins(){
    $("pinSettings").innerHTML=Object.entries(KIDS).map(([id,k])=>{
      const row=rows.kids.find(x=>x.id===id)||{};
      const feedback=pinFeedback[id]||{};
      const isSet=!!row.pin, pending=feedback.type==="pending";
      const displayPin=feedback.value!==undefined?feedback.value:(row.pin||"");
      return `<article class="kid-card pin-card ${isSet?"is-set":""}" style="--kid-color:${k.color}">
        <div class="pin-card__head">
          <h3>${k.name}</h3>
          <span class="status-pill ${isSet?"status-pill--ok":"status-pill--muted"}">${isSet?"PIN set":"No PIN"}</span>
        </div>
        <label class="field"><span>PIN</span><input class="input pin-input" id="pin-${id}" inputmode="numeric" maxlength="4" value="${esc(displayPin)}" placeholder="optional" autocomplete="off" pattern="[0-9]*" data-pininput="${id}" data-current="${esc(row.pin||"")}"></label>
        <p class="pin-note">4 digits, or leave blank.</p>
        <div class="row pin-actions">
          <button class="btn" data-pin="${id}" ${pending?"disabled":""}>${pending?"Saving":"Save"}</button>
          <button class="btn btn--secondary" data-clearpin="${id}" ${pending||!isSet?"disabled":""}>Clear</button>
        </div>
        <p class="message pin-message ${feedback.type==="ok"?"message--ok":feedback.type==="error"?"message--error":""}" id="pinmsg-${id}" aria-live="polite">${feedback.text||""}</p>
      </article>`;
    }).join("");
    document.querySelectorAll("[data-pin]").forEach(b=>b.onclick=()=>savePin(b.dataset.pin,false));
    document.querySelectorAll("[data-clearpin]").forEach(b=>b.onclick=()=>savePin(b.dataset.clearpin,true));
    document.querySelectorAll("[data-pininput]").forEach(inp=>inp.oninput=()=>{
      const id=inp.dataset.pininput;
      if(inp.value!==inp.dataset.current){
        pinFeedback[id]={type:"dirty",text:"Not saved"};
        const msg=$(`pinmsg-${id}`);
        if(msg){msg.className="message pin-message";msg.textContent=pinFeedback[id].text;}
      }
    });
  }
  async function savePin(id,clear){
    const value=clear?null:$(`pin-${id}`).value.trim();
    if(value&&!/^[0-9]{4}$/.test(value)){
      pinFeedback[id]={type:"error",text:"Use 4 digits",value};
      renderPins(); $(`pin-${id}`).focus(); $(`pin-${id}`).select(); return;
    }
    pinFeedback[id]={type:"pending",text:"Saving",value:value||""};
    renderPins();
    const {error}=await client.from("kids").update({pin:value||null}).eq("id",id);
    if(error){
      pinFeedback[id]={type:"error",text:"Could not save",value:value||""};
      renderPins(); return;
    }
    const existing=rows.kids.find(x=>x.id===id);
    if(existing) existing.pin=value||null; else rows.kids.push({id,pin:value||null});
    const time=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    pinFeedback[id]={type:"ok",text:`Saved ${time}`};
    renderPins();
  }

  function adminPinValue(){
    const row=rows.familySettings.find(function(x){return x.key==="admin_pin";})||{};
    return row.value||"";
  }
  function renderAdminPin(){
    const feedback=adminPinFeedback.type?adminPinFeedback:{};
    const displayPin=feedback.value!==undefined?feedback.value:adminPinValue();
    $("adminPinSettings").innerHTML=`<div class="pin-card__head">
        <h3>Papa PIN</h3>
        <span class="status-pill ${adminPinValue()?"status-pill--ok":"status-pill--muted"}">${adminPinValue()?"PIN set":"No PIN"}</span>
      </div>
      <label class="field"><span>Papa PIN (lock override)</span><input class="input pin-input" id="adminPin" inputmode="numeric" maxlength="4" value="${esc(displayPin)}" placeholder="4 digits" autocomplete="off" pattern="[0-9]*"></label>
      <p class="pin-note">Used on tablets to unlock games for the current block.</p>
      <div class="row pin-actions">
        <button class="btn" id="saveAdminPinBtn" ${feedback.type==="pending"?"disabled":""}>${feedback.type==="pending"?"Saving":"Save Papa PIN"}</button>
      </div>
      <p class="message pin-message ${feedback.type==="ok"?"message--ok":feedback.type==="error"?"message--error":""}" id="adminPinStatus" aria-live="polite">${feedback.text||""}</p>`;
    $("saveAdminPinBtn").onclick=saveAdminPin;
  }
  async function saveAdminPin(){
    const value=$("adminPin").value.trim();
    if(!/^[0-9]{4}$/.test(value)){
      adminPinFeedback.type="error"; adminPinFeedback.text="4 digits please"; adminPinFeedback.value=value;
      renderAdminPin(); $("adminPin").focus(); $("adminPin").select(); return;
    }
    adminPinFeedback.type="pending"; adminPinFeedback.text="Saving"; adminPinFeedback.value=value;
    renderAdminPin();
    const {error}=await client.from("family_settings").upsert({key:"admin_pin",value:value,updated_at:new Date().toISOString()});
    if(error){
      adminPinFeedback.type="error"; adminPinFeedback.text="Could not save"; adminPinFeedback.value=value;
      renderAdminPin(); return;
    }
    const row=rows.familySettings.find(function(x){return x.key==="admin_pin";});
    if(row)row.value=value; else rows.familySettings.push({key:"admin_pin",value:value});
    const time=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    adminPinFeedback.type="ok"; adminPinFeedback.text=`Saved ${time}`; adminPinFeedback.value=value;
    renderAdminPin();
  }

  function renderAppLocks(){
    const fs=Object.fromEntries(rows.familySettings.map(r=>[r.key,r.value]));
    $("applocks").innerHTML=Object.entries(KIDS).map(function(e){
      const id=e[0], k=e[1];
      const paused=(fs["applock_"+id]||"")!=="";
      const cats=LOCK_CATS.filter(function(c){return c[0]!=="captain"||id==="luis";});
      const lockedCount=cats.filter(function(c){return (fs[`catlock_${id}_${c[0]}`]||"")!=="";}).length;
      const summary=paused?"⏸ paused":lockedCount?`🔒 ${lockedCount} locked`:"free";
      return `<details class="lock-row ${paused?"is-paused":""}" style="--kid-color:${k.color}">
        <summary><b>${esc(k.name)}</b> <span class="muted">${summary}</span></summary>
        <div class="lock-row__body">
          <button class="btn ${paused?"":"btn--danger"}" data-applock="${id}" data-paused="${paused?1:0}">
            ${paused?"Resume app":"Pause whole app"}</button>
          <div class="cat-locks">
            ${cats.map(function(c){
              const locked=(fs[`catlock_${id}_${c[0]}`]||"")!=="";
              return `<button class="btn ${locked?"btn--danger":"btn--secondary"}" data-catlock="${id}:${c[0]}" data-locked="${locked?1:0}">
                ${locked?"Unlock":"Lock"} ${c[1]}</button>`;
            }).join("")}
          </div>
        </div>
      </details>`;
    }).join("");
    document.querySelectorAll("[data-applock]").forEach(b=>b.onclick=async()=>{
      const id=b.dataset.applock, paused=b.dataset.paused==="1";
      const value=paused?"":(prompt("Reason (optional)","")||"1");
      const {error}=await client.from("family_settings").upsert({key:"applock_"+id,value,updated_at:new Date().toISOString()});
      if(error){writeFailed(error);return;}
      toast(paused?"Resumed ▶":"Paused ⏸",true);
      await loadAll();
    });
    document.querySelectorAll("[data-catlock]").forEach(b=>b.onclick=async()=>{
      const [id,cat]=b.dataset.catlock.split(":"), locked=b.dataset.locked==="1";
      const {error}=await client.from("family_settings").upsert({
        key:`catlock_${id}_${cat}`,value:locked?"":"1",updated_at:new Date().toISOString()
      });
      if(error){writeFailed(error);return;}
      toast(`${kidName(id)} ${cat} ${locked?"unlocked":"locked"}`,true);
      await loadAll();
    });
  }

  /* Papa-initiated message. kind='papa' with the text in `answer` so buildStream
     renders it as a right-side bubble; `body` stays null so it is never mistaken
     for a kid's question. Needs the "admin ask" INSERT policy (schema.sql v6). */
  async function sendChatMessage(){
    const body=$("chatBody").value.trim();
    if(!body){$("chatBody").focus();return;}
    const to=$("chatTo").value;
    const targets=to==="all"?Object.keys(KIDS):[to];
    const now=new Date().toISOString();
    const payload=targets.map(function(kid){
      return {kid_id:kid,kind:"papa",body:null,answer:body,answered_at:now};
    });
    const {error}=await client.from("asks").insert(payload);
    if(error){writeFailed(error);return;}
    $("chatBody").value="";
    chatStuckToBottom=true;
    toast("Message sent",true);
    await loadAll();
  }

  function subscribeRealtime(){
    if(realtimeChannel)return;
    const live=table=>payload=>{
      const note=notificationFor(table,payload);
      if(note)pushNotify(note.title,note.body,note.kind);
      loadAll();
    };
    realtimeChannel=client.channel("p1-admin")
      .on("postgres_changes",{event:"*",schema:"public",table:"day_ticks"},live("day_ticks"))
      .on("postgres_changes",{event:"*",schema:"public",table:"stars_ledger"},live("stars_ledger"))
      .on("postgres_changes",{event:"*",schema:"public",table:"asks"},live("asks"))
      .on("postgres_changes",{event:"*",schema:"public",table:"passes"},live("passes"))
      .on("postgres_changes",{event:"*",schema:"public",table:"photos"},live("photos"))
      .on("postgres_changes",{event:"*",schema:"public",table:"help_claims"},live("help_claims"))
      .on("postgres_changes",{event:"*",schema:"public",table:"family_settings"},live("family_settings"))
      .on("postgres_changes",{event:"*",schema:"public",table:"day_overrides"},live("day_overrides"))
      .on("postgres_changes",{event:"*",schema:"public",table:"day_redos"},live("day_redos"))
      .on("postgres_changes",{event:"*",schema:"public",table:"act_done"},live("act_done"))
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"kids"},live("kids"))
      .subscribe();
  }

  $("loginBtn").onclick=async()=>{
    $("loginErr").textContent="";
    const email=$("email").value.trim();
    const password=$("password").value;
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error){$("loginErr").textContent=error.message;return;}
    session=data.session;
    openDashboard();
  };
  $("logoutBtn").onclick=async()=>{await client.auth.signOut();location.reload();};
  $("refreshBtn").onclick=loadAll;
  $("resetAcceptedBtn").onclick=resetAcceptedDay;
  $("notifyEnableBtn").onclick=toggleBrowserNotifications;
  $("notifyClearBtn").onclick=()=>{notifyItems=[];renderNotifications();};
  $("showArchivedAsks").onchange=renderConversation;
  $("chatStream").onscroll=function(){
    const box=$("chatStream");
    chatStuckToBottom=box.scrollHeight-box.scrollTop-box.clientHeight<40;
    if(chatStuckToBottom)show("chatJump",false);
  };
  $("chatJump").onclick=function(){
    const box=$("chatStream");
    box.scrollTop=box.scrollHeight;
    chatStuckToBottom=true;
    show("chatJump",false);
  };
  $("chatSend").onclick=sendChatMessage;
  $("ledgerAllBtn").onclick=function(){
    const fold=document.querySelector('[data-fold="ledger"]');
    if(!fold)return;
    fold.open=true;
    fold.scrollIntoView({behavior:"smooth",block:"start"});
  };
  $("galleryBtn").onclick=openGallery;
  $("galleryPrev").onclick=()=>galleryStep(-1);
  $("galleryNext").onclick=()=>galleryStep(1);
  $("galleryClose").onclick=closeGallery;
  addEventListener("keydown",e=>{
    if($("gallery").classList.contains("hidden"))return;
    if(e.key==="Escape")closeGallery();
    if(e.key==="ArrowLeft")galleryStep(-1);
    if(e.key==="ArrowRight")galleryStep(1);
  });
  $("saveNoteBtn").onclick=async()=>{
    const body=$("noteBody").value.trim();
    const status=$("noteStatus");
    status.textContent="";
    if(!body){status.textContent="Write a message first.";return;}
    const {error}=await client.from("papa_notes").upsert({day:today,body});
    status.textContent=error?error.message:"Saved";
  };
  bindFolds();
  init().catch(e=>{show("configState",true);$("configState").querySelector("p").textContent=e.message;});
})();
