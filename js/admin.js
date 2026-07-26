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
    ["games","Games 遊戲"],
    ["acts","Activities 活動"],
    ["learn","Learn 學習"],
    ["ask","Ask 求助"],
    ["captain","Captain 隊長"]
  ];

  let client=null, session=null, today="", realtimeChannel=null;
  let rows={ticks:[],totals:[],stats:[],ledger:[],asks:[],passes:[],photos:[],kids:[],history:[],helpClaims:[],familySettings:[],redos:[],acts:[]};
  let answerRecord=null, answerChunks=[], answerAskId=null;
  const pinFeedback={}, adminPinFeedback={};
  let overridesRaw={}, dragState=null;
  let notifyItems=[];
  let browserNotifyEnabled=localStorage.getItem("sq-admin-notify")==="1";
  const silentRealtime=new Map();

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
  const writeFailed=error=>toast(`Could not save 無法儲存 — ${error.message}`);

  function renderNotifications(){
    const supported="Notification" in window;
    const permission=supported?Notification.permission:"unsupported";
    const enabled=supported&&browserNotifyEnabled&&permission==="granted";
    const permissionLabel={granted:"allowed 已允許",denied:"blocked 已封鎖",default:"not enabled 未開啟"}[permission]||permission;
    const status=$("notifyStatus"), btn=$("notifyEnableBtn"), feed=$("notifyFeed");
    if(status)status.textContent=enabled?"Windows on Windows通知已開啟":supported?`Windows ${permissionLabel}`:"Windows unsupported 不支援";
    if(btn){
      btn.textContent=enabled?"Disable Windows notifications 關閉Windows通知":"Enable Windows notifications 開啟Windows通知";
      btn.disabled=!supported||permission==="denied";
    }
    if(feed)feed.innerHTML=notifyItems.map(n=>`
      <article class="notify-item notify-item--${n.kind}">
        <span class="notify-time">${timeOnly(n.at)}</span>
        <div><b>${esc(n.title)}</b><p>${esc(n.body)}</p></div>
      </article>`).join("")||`<p class="notify-empty">Waiting for live activity. 等待即時活動。</p>`;
  }

  async function toggleBrowserNotifications(){
    if(!("Notification" in window)){toast("Browser notifications are not supported 此瀏覽器不支援通知",false);return;}
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
    toast(browserNotifyEnabled?"Windows notifications enabled 已開啟Windows通知":"Windows notifications not allowed 未允許Windows通知",browserNotifyEnabled);
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
      title:`${kidName(row.kid_id)} asked for help 求助`,
      body:row.body||"Voice memo 語音訊息"
    };
    if(table==="passes"&&row.status==="requested")return {
      kind:"pass",
      title:`${kidName(row.kid_id)} requested a ${row.kind||"pass"} pass 申請券`,
      body:`${blockTitle(row.block_idx)} ${blockTz(row.block_idx)}`
    };
    if(table==="photos")return {
      kind:"photo",
      title:`${kidName(row.kid_id)} uploaded proof 上傳照片`,
      body:`${blockTitle(row.block_idx)} ${blockTz(row.block_idx)}`
    };
    if(table==="help_claims"&&row.status==="requested")return {
      kind:"claim",
      title:`${kidName(row.captain_id)} sent a captain claim 隊長申請`,
      body:`Helped ${kidName(row.helped_kid_id)} 幫忙${kidName(row.helped_kid_id)}`
    };
    if(table==="day_ticks"&&row.day===today)return {
      kind:"done",
      title:`${kidName(row.kid_id)} completed a block 完成格子`,
      body:`${blockTitle(row.block_idx)} ${blockTz(row.block_idx)}`
    };
    if(table==="stars_ledger"&&row.source==="app")return {
      kind:"star",
      title:`${kidName(row.kid_id)} earned ${row.delta} star${row.delta===1?"":"s"} 得到星星`,
      body:row.reason||"App activity app活動"
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
    $("todayLabel").textContent=`Today 今天 ${today}`;
    $("noteDay").textContent=`Today 今天 ${today}`;
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
      client.from("stars_ledger").select("*").order("created_at",{ascending:false}).limit(30),
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
      Acts:rows.acts.length,
      Proofs:rows.photos.length,
      History:rows.history.length,
      Ledger:rows.ledger.length,
      Settings:rows.kids.filter(function(k){return k.pin;}).length
    };
    Object.keys(counts).forEach(function(name){
      const el=$("foldCount"+name);
      if(!el)return;
      const n=counts[name];
      el.textContent=name==="Settings"?`${n} PIN${n===1?"":"s"} 密碼`:String(n);
    });
  }

  function renderAll(){
    renderFoldCounts();
    renderOverview();
    renderGrants();
    renderActsToday();
    renderLedger();
    renderAsks();
    renderHelpClaims();
    renderPasses();
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
            <p><span class="gold">${stars}</span> stars 星星 · ${missions} photo missions 照片任務</p>
          </div>
          <span class="pill">${covered.size}/${DAY.length} blocks 格子</span>
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
    const status=removed?"removed 已移除":accepted?"accepted 已接受":redo.has(i)?"redo 等待再做":"open 未完成";
    return `<div class="schedule-block ${state} ${accepted?"is-accepted":""} ${removed?"is-removed":""}" data-kid="${kid}" data-block="${i}" draggable="${timed&&!removed}">
      <button class="drag-handle" type="button" aria-label="Move block 移動格子" ${timed&&!removed?"":"disabled"}>↕</button>
      <label class="schedule-time">
        <span>Time 時間</span>
        <input class="input input--time" type="time" data-time="${kid}:${i}" value="${timed?clock(mins):""}" ${timed&&!removed?"":"disabled"}>
      </label>
      <div class="schedule-main">
        <b>${b.icon} ${b.title}</b>
        <span class="muted">${b.tz}</span>
        <span class="schedule-status ${accepted||removed?"ok":redo.has(i)?"gold":"muted"}">${status}${moved?" · moved 已調整":""}</span>
      </div>
      <div class="schedule-actions">
        ${accepted
          ?`<button class="btn btn--secondary" data-unaccept="${kid}:${i}">Undo 取消接受</button>
            <button class="btn btn--secondary" data-sendback="${kid}:${i}">Send back 退回</button>`
          :removed
            ?`<button class="btn" data-addback="${removed.id}:${kid}:${i}:${removed.credited?1:0}">Add back 加回</button>`
            :`<button class="btn" data-accept="${kid}:${i}">Accept 接受</button>
              <button class="btn btn--secondary" data-removeblock="${kid}:${i}">Remove 移除</button>`}
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
    toast(`Schedule moved for ${kidName(kid)} 行程已移動`,true);
    await loadAll();
  }

  function baseTimeFor(kid,i){
    return (overridesRaw.all||{})[i]!=null?(overridesRaw.all||{})[i]:DAY[i].t;
  }

  async function saveBlockTime(kid,i,value,silent){
    const mins=SQTime.parseMins(value);
    if(mins==null)return {error:new Error("Use a valid time 請輸入正確時間")};
    const base=baseTimeFor(kid,i);
    const q=SQTime.parseMins(value)===SQTime.parseMins(base)
      ?client.from("day_overrides").delete().eq("day",today).eq("block_idx",i).eq("kid_id",kid)
      :client.from("day_overrides").upsert({day:today,block_idx:i,kid_id:kid,t:value,updated_at:new Date().toISOString()});
    const result=await q;
    if(result.error){if(!silent)writeFailed(result.error);return result;}
    if(!silent){toast(`Time saved 已儲存時間 — ${kidName(kid)}`,true);await loadAll();}
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
    if(DAY[i].kind==="mission")grants.push({kid_id:kid,delta:1,reason:`Admin accepted 接受: ${DAY[i].title}`,source:"admin",granted_by:session.user.id});
    const after=new Set([...coveredSet(kid),i]);
    if(!beforeComplete&&after.size>=DAY.length)grants.push({kid_id:kid,delta:2,reason:"Day-complete bonus 全天完成獎勵",source:"admin",granted_by:session.user.id});
    if(grants.length){
      const r=await client.from("stars_ledger").insert(grants);
      if(r.error){writeFailed(r.error);return;}
    }
    toast(`Accepted 接受 ✓ ${kidName(kid)} — ${DAY[i].title}`,true);
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
    const refunds=starRefunds(kid,[i],redoNote?"Sent back 退回":"Admin undo 取消接受");
    if(beforeComplete&&after.size<DAY.length)refunds.push({kid_id:kid,delta:-2,reason:"Day-complete bonus undone 全天完成獎勵取消",source:"admin",granted_by:session.user.id});
    if(refunds.length){
      const r=await client.from("stars_ledger").insert(refunds);
      if(r.error){writeFailed(r.error);return;}
    }
    if(redoNote!=null){
      const r=await client.from("day_redos").upsert({kid_id:kid,day:today,block_idx:i,note:redoNote});
      if(r.error){writeFailed(r.error);return;}
    }
    toast(`${redoNote!=null?"Sent back 退回":"Acceptance undone 已取消"} — ${kidName(kid)}`,true);
    await loadAll();
  }

  async function sendBackBlock(kid,i){
    const titleZh=`${DAY[i].title} ${DAY[i].tz||""}`.trim();
    if(!confirm(`Send "${titleZh}" back to ${kidName(kid)} for a redo? 退回請${kidName(kid)}再做一次？`))return;
    const note=prompt("Note for the kid (optional) 給孩子的留言（可留空）","")||"";
    await unacceptBlock(kid,i,note);
  }

  async function removeBlock(kid,i){
    if(passFor(kid,i,"outing"))return;
    const credited=$("removedCredited").checked;
    const pass={kid_id:kid,kind:"outing",status:"granted",day:today,block_idx:i,reason:"Removed from today's schedule 從今天行程移除",credited,granted_by:session.user.id};
    const r1=await client.from("passes").insert(pass);
    if(r1.error){writeFailed(r1.error);return;}
    if(credited){
      const r2=await client.from("stars_ledger").insert({kid_id:kid,delta:1,reason:`Removed block counts 算完成: ${DAY[i].title}`,source:"admin",granted_by:session.user.id});
      if(r2.error){writeFailed(r2.error);return;}
    }
    toast(`Removed 移除 — ${kidName(kid)} ${DAY[i].title}`,true);
    await loadAll();
  }

  async function addBackBlock(passId,kid,i,credited){
    const r1=await client.from("passes").delete().eq("id",passId);
    if(r1.error){writeFailed(r1.error);return;}
    if(credited){
      const r2=await client.from("stars_ledger").insert({kid_id:kid,delta:-1,reason:`Removed block added back 加回: ${DAY[i].title}`,source:"admin",granted_by:session.user.id});
      if(r2.error){writeFailed(r2.error);return;}
    }
    toast(`Added back 加回 — ${kidName(kid)} ${DAY[i].title}`,true);
    await loadAll();
  }

  async function resetAcceptedDay(){
    const ticks=rows.ticks.filter(t=>t.day===today);
    if(!ticks.length){toast("No accepted blocks to reset 今天沒有已接受格子",true);return;}
    if(!confirm("Reset all accepted blocks for today? This keeps removed/outing blocks. 重設今天所有已接受格子？已移除/出遊格子會保留。"))return;
    const refunds=[];
    Object.keys(KIDS).forEach(kid=>{
      const kidTicks=ticks.filter(t=>t.kid_id===kid).map(t=>t.block_idx);
      refunds.push(...starRefunds(kid,kidTicks,"Day reset 重設今天"));
      const passOnly=new Set(rows.passes.filter(p=>p.kid_id===kid&&p.day===today&&["granted","spent"].includes(p.status)).map(p=>p.block_idx));
      if(dayComplete(kid)&&passOnly.size<DAY.length)
        refunds.push({kid_id:kid,delta:-2,reason:"Day reset bonus undo 重設全天完成獎勵",source:"admin",granted_by:session.user.id});
    });
    const r1=await client.from("day_ticks").delete().eq("day",today);
    if(r1.error){writeFailed(r1.error);return;}
    await client.from("day_redos").delete().eq("day",today);
    if(refunds.length){
      const r2=await client.from("stars_ledger").insert(refunds);
      if(r2.error){writeFailed(r2.error);return;}
    }
    toast("Accepted blocks reset 今天已接受格子已重設",true);
    await loadAll();
  }

  function renderGrants(){
    $("grants").innerHTML=Object.entries(KIDS).map(([id,k])=>`
      <article class="kid-card" style="--kid-color:${k.color}">
        <h3>${k.name}</h3>
        <p class="grant-total"><span class="gold">⭐ ${(rows.totals.find(t=>t.kid_id===id)||{}).stars||0}</span> stars 星星</p>
        <label class="field"><span>Reason 原因</span><input class="input" id="reason-${id}" placeholder="helped Lucien 幫Lucien"></label>
        <div class="grant-actions">
          <button class="btn btn--danger grant-big" data-grant="${id}" data-delta="-1">−<span>1 star<br>扣1顆</span></button>
          <button class="btn grant-big" data-grant="${id}" data-delta="1">+<span>1 star<br>加1顆</span></button>
        </div>
        <div class="row grant-more">
          <button class="btn btn--secondary" data-grant="${id}" data-delta="2">+2</button>
          <button class="btn btn--secondary" data-grant="${id}" data-delta="3">+3</button>
        </div>
        <div class="row">
          <input class="input" id="custom-${id}" type="number" min="-10" max="10" value="1">
          <button class="btn btn--secondary" data-custom="${id}">Custom 自訂</button>
        </div>
        <button class="btn btn--danger grant-reset" data-resetstars="${id}">Reset stars to 0 星星歸零</button>
      </article>`).join("");
    document.querySelectorAll("[data-grant]").forEach(b=>b.onclick=()=>grantStars(b.dataset.grant,+b.dataset.delta));
    document.querySelectorAll("[data-custom]").forEach(b=>b.onclick=()=>{
      const id=b.dataset.custom;
      const v=+$(`custom-${id}`).value||0;
      if(!v)return;
      grantStars(id,v);
    });
    document.querySelectorAll("[data-resetstars]").forEach(b=>b.onclick=()=>resetStars(b.dataset.resetstars));
  }

  async function grantStars(kid,delta){
    const input=$(`reason-${kid}`);
    const reason=input.value.trim()||(delta>0?"Admin grant 手動加星星":"Admin correction 手動扣星星");
    const {error}=await client.from("stars_ledger").insert({kid_id:kid,delta,reason,source:"admin",granted_by:session.user.id});
    if(error){writeFailed(error);return;}
    toast(`${delta>0?"+":""}${delta} ⭐ ${kidName(kid)} — saved 已儲存`,true);
    input.value="";
    await loadAll();
  }

  async function resetStars(kid){
    const total=(rows.totals.find(t=>t.kid_id===kid)||{}).stars||0;
    if(!total){toast(`${kidName(kid)} already has 0 stars 已經是0顆星`,true);return;}
    if(!confirm(`Reset ${kidName(kid)} stars to 0? This adds a ledger row of ${-total}. 星星歸零？會新增一筆 ${-total} 的星星紀錄。`))return;
    const {error}=await client.from("stars_ledger").insert({
      kid_id:kid,delta:-total,reason:"Star reset 星星歸零",source:"admin",granted_by:session.user.id
    });
    if(error){writeFailed(error);return;}
    toast(`${kidName(kid)} stars reset to 0 星星已歸零`,true);
    await loadAll();
  }

  /* Activities a kid ticked today. Each tick granted exactly 1 ⭐ (index.html actDone),
     so revoking is always −1 plus deleting the act_done row — the tablet re-hydrates
     actsDay.done from act_done, so the activity goes back to un-ticked and re-earnable. */
  const actLabel=i=>BANK[i]?`${BANK[i].icon} ${BANK[i].cat} ${BANK[i].catz}`:`Activity 活動 #${i}`;
  const actDetail=(i,kid)=>BANK[i]?`${BANK[i][kid]||""} ${(BANK[i].z&&BANK[i].z[kid])||""}`.trim():"";

  function renderActsToday(){
    $("actsToday").innerHTML=Object.entries(KIDS).map(([id,k])=>{
      const mine=rows.acts.filter(a=>a.kid_id===id).sort((a,b)=>a.act_idx-b.act_idx);
      const list=mine.length
        ? mine.map(a=>`<div class="row act-row">
            <div>
              <b>${esc(actLabel(a.act_idx))}</b>
              <p class="compact-copy">${esc(actDetail(a.act_idx,id))}</p>
            </div>
            <button class="btn btn--danger" data-revokeact="${id}" data-acti="${a.act_idx}">Revoke ⭐ 收回</button>
          </div>`).join("")
        : `<p class="compact-copy">Nothing ticked yet today 今天還沒有勾選活動</p>`;
      return `<article class="kid-card" style="--kid-color:${k.color}">
        <h3>${k.name}</h3>
        <p class="compact-copy">${mine.length} activity star${mine.length===1?"":"s"} today 今天的活動星星</p>
        ${list}
      </article>`;
    }).join("");
    document.querySelectorAll("[data-revokeact]").forEach(b=>b.onclick=()=>revokeAct(b.dataset.revokeact,+b.dataset.acti));
  }

  async function revokeAct(kid,i){
    if(!confirm(`Revoke ${kidName(kid)}'s star for "${actLabel(i)}"? It goes back to un-ticked so it can be done for real today.\n收回${kidName(kid)}這個活動的星星？活動會變回未完成，今天可以真的做完再拿一次。`))return;
    /* .select() so we can tell "deleted" from "RLS silently matched 0 rows" —
       without the "admin unact" policy the delete is a no-op with no error. */
    const del=await client.from("act_done").delete().eq("kid_id",kid).eq("day",today).eq("act_idx",i).select();
    if(del.error){writeFailed(del.error);return;}
    if(!del.data||!del.data.length){
      toast("Could not un-tick — re-run supabase/schema.sql 無法取消勾選——請重跑 schema.sql");
      return;
    }
    const {error}=await client.from("stars_ledger").insert({
      kid_id:kid,delta:-1,reason:`Activity revoked 收回活動星星: ${BANK[i]?BANK[i].cat:"#"+i}`,
      source:"admin",granted_by:session.user.id
    });
    if(error){writeFailed(error);await loadAll();return;}
    toast(`Revoked — ${kidName(kid)} can redo it today 已收回，今天可以重做`,true);
    await loadAll();
  }

  function renderLedger(){
    $("ledger").innerHTML=`<table class="table"><thead><tr>
      <th>Time 時間</th><th>Kid 孩子</th><th>Delta 星</th><th>Reason 原因</th><th>Source 來源</th><th></th>
    </tr></thead><tbody>${rows.ledger.map(r=>`<tr>
      <td>${fmt(r.created_at)}</td><td>${kidName(r.kid_id)}</td><td>${r.delta>0?"+":""}${r.delta}</td>
      <td>${esc(r.reason)}</td><td>${esc(r.source)}</td>
      <td>${r.source==="admin"
        ?`<button class="btn btn--danger" data-delstar="${r.id}">Undo 復原</button>`
        :(r.delta>0?`<button class="btn btn--danger" data-revokestar="${r.id}">Revoke 收回</button>`:"")}</td>
    </tr>`).join("")}</tbody></table>`;
    document.querySelectorAll("[data-delstar]").forEach(b=>b.onclick=async()=>{
      const {error}=await client.from("stars_ledger").delete().eq("id",b.dataset.delstar);
      if(error){writeFailed(error);return;}
      toast("Grant undone 已復原",true);
      await loadAll();
    });
    /* App-earned rows are the kid's own history — never deleted. Revoking adds a
       matching negative admin row, so the ledger still shows what happened and why. */
    document.querySelectorAll("[data-revokestar]").forEach(b=>b.onclick=async()=>{
      const r=rows.ledger.find(x=>x.id===b.dataset.revokestar);
      if(!r)return;
      if(!confirm(`Revoke ${r.delta} ⭐ from ${kidName(r.kid_id)} — "${r.reason}"?\n收回${kidName(r.kid_id)}的${r.delta}顆星星？`))return;
      const {error}=await client.from("stars_ledger").insert({
        kid_id:r.kid_id,delta:-r.delta,reason:`Revoked 收回: ${r.reason}`,
        source:"admin",granted_by:session.user.id
      });
      if(error){writeFailed(error);return;}
      toast(`−${r.delta} ⭐ ${kidName(r.kid_id)} — revoked 已收回`,true);
      await loadAll();
    });
  }

  function publicUrl(path){
    if(!path) return "";
    return client.storage.from("voices").getPublicUrl(path).data.publicUrl;
  }
  function proofUrl(path){
    if(!path) return "";
    return client.storage.from("proofs").getPublicUrl(path).data.publicUrl;
  }

  function renderAsks(){
    const showArchived=$("showArchivedAsks").checked;
    const archivedIds=archivedAskIds();
    const visible=rows.asks.filter(a=>showArchived||!archivedIds.has(a.id));
    const open=visible.filter(a=>!a.answered_at&&!archivedIds.has(a.id));
    const answered=visible.filter(a=>a.answered_at&&!archivedIds.has(a.id));
    const archived=visible.filter(a=>archivedIds.has(a.id));
    $("askInbox").innerHTML=[...open,...answered,...archived].map(a=>`
      <article class="ask-card ${archivedIds.has(a.id)?"is-archived":""}">
        <div class="row">
          <b>${kidName(a.kid_id)}</b>
          <span class="pill">${esc(a.kind)} 類型</span>
          <span class="pill">${fmt(a.created_at)}</span>
          ${archivedIds.has(a.id)?`<span class="pill">archived 已封存</span>`
            :a.answered_at?`<span class="pill ok">answered 已回覆</span>`:`<span class="pill gold">open 未回覆</span>`}
        </div>
        <p>${esc(a.body||"Voice memo 語音訊息")}</p>
        ${a.audio_path?`<audio class="audio" controls src="${publicUrl(a.audio_path)}"></audio>`:""}
        ${a.answer?`<p class="ok">Answer 回覆: ${esc(a.answer)}</p>`:""}
        ${a.answer_audio_path?`<audio class="audio" controls src="${publicUrl(a.answer_audio_path)}"></audio>`:""}
        ${!a.answered_at&&!archivedIds.has(a.id)?`<label class="field"><span>Answer 回覆</span>
          <textarea class="input textarea" id="answer-${a.id}" placeholder="I can help after lunch. 午餐後我可以幫你。"></textarea></label>
          <div class="row">
            <button class="btn" data-answer="${a.id}">Send answer 送出回覆</button>
            <button class="btn btn--secondary" data-rec="${a.id}">Record voice 錄語音</button>
            <button class="btn btn--secondary" data-stop="${a.id}" disabled>Stop 停止</button>
            <span class="message message--ok" id="recstatus-${a.id}"></span>
          </div>`:""}
        <div class="row inbox-actions">
          ${archivedIds.has(a.id)
            ?`<button class="btn btn--secondary" data-unarchiveask="${a.id}">Restore 還原</button>`
            :`<button class="btn btn--secondary" data-archiveask="${a.id}">Archive 封存</button>`}
        </div>
      </article>`).join("")||`<p>No active asks. 沒有需要處理的求助。</p>`;
    document.querySelectorAll("[data-answer]").forEach(b=>b.onclick=()=>answerAsk(b.dataset.answer));
    document.querySelectorAll("[data-rec]").forEach(b=>b.onclick=()=>startAnswerRecord(b.dataset.rec));
    document.querySelectorAll("[data-stop]").forEach(b=>b.onclick=()=>stopAnswerRecord(b.dataset.stop));
    document.querySelectorAll("[data-archiveask]").forEach(b=>b.onclick=()=>archiveAsk(b.dataset.archiveask,true));
    document.querySelectorAll("[data-unarchiveask]").forEach(b=>b.onclick=()=>archiveAsk(b.dataset.unarchiveask,false));
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
    $(`recstatus-${id}`).textContent="Recording 錄音中";
  }

  function stopAnswerRecord(id){
    if(answerRecord&&answerAskId===id){
      answerRecord.stop();
      $(`recstatus-${id}`).textContent="Ready 準備好了";
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
    toast("Answer sent 回覆已送出",true);
    await loadAll();
  }

  async function archiveAsk(id,archive){
    const ids=archivedAskIds();
    if(archive)ids.add(id); else ids.delete(id);
    const {error}=await client.from("family_settings").upsert({
      key:"archived_asks",value:JSON.stringify([...ids]),updated_at:new Date().toISOString()
    });
    if(error){writeFailed(error);return;}
    toast(archive?"Ask archived 已封存":"Ask restored 已還原",true);
    await loadAll();
  }

  function renderHelpClaims(){
    const sorted=[...rows.helpClaims].sort((a,b)=>
      (a.status==="requested"?0:1)-(b.status==="requested"?0:1) || new Date(b.created_at)-new Date(a.created_at)
    );
    $("helpClaims").innerHTML=sorted.length?`<table class="table"><thead><tr>
      <th>Time 時間</th><th>Captain 隊長</th><th>Helped 幫忙對象</th><th>Status 狀態</th><th>Claim 申請內容</th><th></th>
    </tr></thead><tbody>${sorted.map(c=>`<tr>
      <td>${fmt(c.created_at)}</td><td>${kidName(c.captain_id)}</td><td>${kidName(c.helped_kid_id)}</td>
      <td>${c.status==="approved"?"Approved 已核准":c.status==="denied"?"Denied 未核准":"Waiting 等待"}</td>
      <td>${esc(c.body)}</td>
      <td>${c.status==="requested"?`<button class="btn" data-helpok="${c.id}">Approve +1 核准 +1</button>
        <button class="btn btn--danger" data-helpno="${c.id}">Deny 拒絕</button>`:""}</td>
    </tr>`).join("")}</tbody></table>`:`<p>No captain claims. 還沒有隊長申請。</p>`;
    document.querySelectorAll("[data-helpok]").forEach(b=>b.onclick=()=>setHelpClaim(b.dataset.helpok,"approved"));
    document.querySelectorAll("[data-helpno]").forEach(b=>b.onclick=()=>setHelpClaim(b.dataset.helpno,"denied"));
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

  function renderPasses(){
    $("passes").innerHTML=rows.passes.length?`<table class="table"><thead><tr>
      <th>Time 時間</th><th>Kid 孩子</th><th>Block 格子</th><th>Kind 類型</th><th>Status 狀態</th><th>Reason 原因</th><th></th>
    </tr></thead><tbody>${rows.passes.map(p=>`<tr>
      <td>${fmt(p.created_at)}</td><td>${kidName(p.kid_id)}</td><td>${blockTitle(p.block_idx)}<br><span class="muted">${blockTz(p.block_idx)}</span></td>
      <td>${p.kind==="golden"?"Golden 黃金":"Excused 請假"}</td><td>${esc(p.status)}</td><td>${esc(p.reason||"")}</td>
      <td>${p.status==="requested"?`<button class="btn" data-passok="${p.id}">Approve 核准</button>
        <button class="btn btn--danger" data-passno="${p.id}">Deny 拒絕</button>`:""}</td>
    </tr>`).join("")}</tbody></table>`:`<p>No pass requests. 還沒有券申請。</p>`;
    document.querySelectorAll("[data-passok]").forEach(b=>b.onclick=()=>setPass(b.dataset.passok,"granted"));
    document.querySelectorAll("[data-passno]").forEach(b=>b.onclick=()=>setPass(b.dataset.passno,"denied"));
  }
  async function setPass(id,status){
    const {error}=await client.from("passes").update({status,granted_by:session.user.id}).eq("id",id);
    if(error){writeFailed(error);return;}
    toast(status==="granted"?"Pass approved 已核准":"Pass denied 已拒絕",true);
    await loadAll();
  }

  function renderProofs(){
    $("proofs").innerHTML=rows.photos.length?`<div class="thumb-grid">${rows.photos.map(p=>`
      <article class="ask-card">
        <img class="thumb" src="${proofUrl(p.path)}" alt="Photo proof 照片證明">
        <p>${kidName(p.kid_id)} · ${p.day} · ${blockTitle(p.block_idx)}<br><span class="muted">${blockTz(p.block_idx)}</span></p>
      </article>`).join("")}</div>`:`<p>No proof photos yet. 還沒有照片證明。</p>`;
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
    if(!galleryShots.length){toast("No photos today yet 今天還沒有照片",true);return;}
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
          <span class="status-pill ${isSet?"status-pill--ok":"status-pill--muted"}">${isSet?"PIN set 已設定":"No PIN 未設定"}</span>
        </div>
        <label class="field"><span>PIN 密碼</span><input class="input pin-input" id="pin-${id}" inputmode="numeric" maxlength="4" value="${esc(displayPin)}" placeholder="optional 選填" autocomplete="off" pattern="[0-9]*" data-pininput="${id}" data-current="${esc(row.pin||"")}"></label>
        <p class="pin-note">4 digits, or leave blank. 4個數字，或留空。</p>
        <div class="row pin-actions">
          <button class="btn" data-pin="${id}" ${pending?"disabled":""}>${pending?"Saving 儲存中":"Save 儲存"}</button>
          <button class="btn btn--secondary" data-clearpin="${id}" ${pending||!isSet?"disabled":""}>Clear 清除</button>
        </div>
        <p class="message pin-message ${feedback.type==="ok"?"message--ok":feedback.type==="error"?"message--error":""}" id="pinmsg-${id}" aria-live="polite">${feedback.text||""}</p>
      </article>`;
    }).join("");
    document.querySelectorAll("[data-pin]").forEach(b=>b.onclick=()=>savePin(b.dataset.pin,false));
    document.querySelectorAll("[data-clearpin]").forEach(b=>b.onclick=()=>savePin(b.dataset.clearpin,true));
    document.querySelectorAll("[data-pininput]").forEach(inp=>inp.oninput=()=>{
      const id=inp.dataset.pininput;
      if(inp.value!==inp.dataset.current){
        pinFeedback[id]={type:"dirty",text:"Not saved 尚未儲存"};
        const msg=$(`pinmsg-${id}`);
        if(msg){msg.className="message pin-message";msg.textContent=pinFeedback[id].text;}
      }
    });
  }
  async function savePin(id,clear){
    const value=clear?null:$(`pin-${id}`).value.trim();
    if(value&&!/^[0-9]{4}$/.test(value)){
      pinFeedback[id]={type:"error",text:"Use 4 digits 使用4個數字",value};
      renderPins(); $(`pin-${id}`).focus(); $(`pin-${id}`).select(); return;
    }
    pinFeedback[id]={type:"pending",text:"Saving 儲存中",value:value||""};
    renderPins();
    const {error}=await client.from("kids").update({pin:value||null}).eq("id",id);
    if(error){
      pinFeedback[id]={type:"error",text:"Could not save 無法儲存",value:value||""};
      renderPins(); return;
    }
    const existing=rows.kids.find(x=>x.id===id);
    if(existing) existing.pin=value||null; else rows.kids.push({id,pin:value||null});
    const time=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    pinFeedback[id]={type:"ok",text:`Saved ${time} 已儲存`};
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
        <h3>Papa PIN 爸爸密碼</h3>
        <span class="status-pill ${adminPinValue()?"status-pill--ok":"status-pill--muted"}">${adminPinValue()?"PIN set 已設定":"No PIN 未設定"}</span>
      </div>
      <label class="field"><span>Papa PIN (lock override) 爸爸密碼</span><input class="input pin-input" id="adminPin" inputmode="numeric" maxlength="4" value="${esc(displayPin)}" placeholder="4 digits 四位數" autocomplete="off" pattern="[0-9]*"></label>
      <p class="pin-note">Used on tablets to unlock games for the current block. 平板上用來解鎖目前時段的遊戲。</p>
      <div class="row pin-actions">
        <button class="btn" id="saveAdminPinBtn" ${feedback.type==="pending"?"disabled":""}>${feedback.type==="pending"?"Saving 儲存中":"Save Papa PIN 儲存爸爸密碼"}</button>
      </div>
      <p class="message pin-message ${feedback.type==="ok"?"message--ok":feedback.type==="error"?"message--error":""}" id="adminPinStatus" aria-live="polite">${feedback.text||""}</p>`;
    $("saveAdminPinBtn").onclick=saveAdminPin;
  }
  async function saveAdminPin(){
    const value=$("adminPin").value.trim();
    if(!/^[0-9]{4}$/.test(value)){
      adminPinFeedback.type="error"; adminPinFeedback.text="4 digits please 請輸入四位數"; adminPinFeedback.value=value;
      renderAdminPin(); $("adminPin").focus(); $("adminPin").select(); return;
    }
    adminPinFeedback.type="pending"; adminPinFeedback.text="Saving 儲存中"; adminPinFeedback.value=value;
    renderAdminPin();
    const {error}=await client.from("family_settings").upsert({key:"admin_pin",value:value,updated_at:new Date().toISOString()});
    if(error){
      adminPinFeedback.type="error"; adminPinFeedback.text="Could not save 無法儲存"; adminPinFeedback.value=value;
      renderAdminPin(); return;
    }
    const row=rows.familySettings.find(function(x){return x.key==="admin_pin";});
    if(row)row.value=value; else rows.familySettings.push({key:"admin_pin",value:value});
    const time=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    adminPinFeedback.type="ok"; adminPinFeedback.text=`Saved ${time} 已儲存`; adminPinFeedback.value=value;
    renderAdminPin();
  }

  function renderAppLocks(){
    const fs=Object.fromEntries(rows.familySettings.map(r=>[r.key,r.value]));
    $("applocks").innerHTML=Object.entries(KIDS).map(([id,k])=>{
      const paused=(fs["applock_"+id]||"")!=="";
      return `<article class="kid-card" style="--kid-color:${k.color}">
        <h3>${k.name} ${paused?"⏸ paused 已暫停":""}</h3>
        <button class="btn ${paused?"":"btn--danger"}" data-applock="${id}" data-paused="${paused?1:0}">
          ${paused?"Resume app 恢復app":"Pause whole app 暫停整個app"}</button>
        <div class="cat-locks">
          ${LOCK_CATS.filter(([cat])=>cat!=="captain"||id==="luis").map(([cat,label])=>{
            const locked=(fs[`catlock_${id}_${cat}`]||"")!=="";
            return `<button class="btn ${locked?"btn--danger":"btn--secondary"}" data-catlock="${id}:${cat}" data-locked="${locked?1:0}">
              ${locked?"Unlock 解鎖":"Lock 鎖定"} ${label}</button>`;
          }).join("")}
        </div>
      </article>`;
    }).join("");
    document.querySelectorAll("[data-applock]").forEach(b=>b.onclick=async()=>{
      const id=b.dataset.applock, paused=b.dataset.paused==="1";
      const value=paused?"":(prompt("Reason (optional) 原因（可留空）","")||"1");
      const {error}=await client.from("family_settings").upsert({key:"applock_"+id,value,updated_at:new Date().toISOString()});
      if(error){writeFailed(error);return;}
      toast(paused?"Resumed 已恢復 ▶":"Paused 已暫停 ⏸",true);
      await loadAll();
    });
    document.querySelectorAll("[data-catlock]").forEach(b=>b.onclick=async()=>{
      const [id,cat]=b.dataset.catlock.split(":"), locked=b.dataset.locked==="1";
      const {error}=await client.from("family_settings").upsert({
        key:`catlock_${id}_${cat}`,value:locked?"":"1",updated_at:new Date().toISOString()
      });
      if(error){writeFailed(error);return;}
      toast(`${kidName(id)} ${cat} ${locked?"unlocked 已解鎖":"locked 已鎖定"}`,true);
      await loadAll();
    });
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
  $("showArchivedAsks").onchange=renderAsks;
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
    if(!body){status.textContent="Write a bilingual message first. 請先寫雙語留言。";return;}
    const {error}=await client.from("papa_notes").upsert({day:today,body});
    status.textContent=error?error.message:"Saved 儲存好了";
  };
  bindFolds();
  init().catch(e=>{show("configState",true);$("configState").querySelector("p").textContent=e.message;});
})();
