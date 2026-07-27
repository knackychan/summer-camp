(function(){
  const CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  const KIDS={
    lucien:{name:"Lucien"},
    lili:{name:"Lili"},
    luis:{name:"Luis"}
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
  let browserNotifyEnabled=localStorage.getItem("sq-admin-notify")==="1";
  const silentRealtime=new Map();
  let currentRoute="today";

  const CHAT_KEY="sq-admin-chat-filters";
  const CHAT_TYPES=[
    ["ask","Ask"],
    ["claim","Claim"],
    ["pass","Pass"],
    ["photo","Photo"],
    ["system","System"]
  ];
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
  const show=(id,on)=>{var el=$(id);if(el)el.classList.toggle("hidden",!on);};
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
    var t=$("toast");
    if(!t)return;
    var span=$("toastMsg");
    if(span)span.textContent=msg;
    t.classList.remove("hidden","toast--ok","toast--error");
    t.classList.add("is-on",ok?"toast--ok":"toast--error");
    clearTimeout(toast._t);
    toast._t=setTimeout(function(){t.classList.remove("is-on");},4000);
    /* Add undo/confirm button */
    var existing=t.querySelector(".btn");
    if(!existing){
      var b=document.createElement("button");
      b.className="btn btn--sm";
      b.onclick=function(){t.classList.remove("is-on");};
      t.appendChild(b);
    }
  }
  const writeFailed=error=>toast(`Could not save — ${error.message}`);

  /* ---- queueRows: pure function, no query ---- */
  function queueRows(){
    var q=[];
    var archived=archivedAskIds();
    rows.asks.forEach(function(a){
      if(a.created_at&&a.answer===null&&!archived.has(a.id)){
        q.push({id:a.id,type:"ask",kidId:a.kid_id,at:a.created_at,body:a.body||"Voice memo",actions:["answer","archive"]});
      }
    });
    rows.helpClaims.forEach(function(c){
      if(c.status==="requested"){
        q.push({id:c.id,type:"claim",kidId:c.captain_id,at:c.created_at,body:"Helped "+kidName(c.helped_kid_id)+" — "+(c.body||""),actions:["approve","deny"]});
      }
    });
    rows.passes.forEach(function(p){
      if(p.status==="requested"){
        q.push({id:p.id,type:"pass",kidId:p.kid_id,at:p.created_at,body:blockTitle(p.block_idx)+" "+blockTz(p.block_idx),actions:["grant","deny"]});
      }
    });
    q.sort(function(a,b){return (a.at||"").localeCompare(b.at||"");});
    return q;
  }

  function needsCount(){
    return queueRows().length;
  }

  function updateNavCounts(){
    var n=needsCount();
    var el=$("navCountInbox");
    if(el){
      el.textContent=String(n);
      el.setAttribute("data-zero",n===0?"1":"0");
    }
    var dc=$("dockCount");
    if(dc)dc.textContent=String(n);
    var db=$("dockBadge");
    if(db){db.textContent=String(n);db.classList.toggle("hidden",n===0);}
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
    show("login",false); show("view-locked",false); show("logoutBtn",true);
    $("app").classList.remove("is-locked");
    $("navLogout").classList.remove("hidden");
    today=dayISO(0);
    $("boardDate").textContent=new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",timeZone:"Asia/Taipei"})+" · Asia/Taipei";
    updateNotifyState();
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
    var noteEl=$("noteBody");
    if(noteEl)noteEl.value=note.data&&note.data.body?note.data.body:"";
    renderForRoute(currentRoute);
  }

  /* RENDER_BY_TABLE: maps tables to routes to avoid full re-render */
  var TABLE_ROUTES={
    day_ticks:["today"],
    stars_ledger:["today","stars"],
    asks:["today","inbox"],
    passes:["today"],
    photos:["inbox"],
    help_claims:["today","inbox"],
    family_settings:["today","kids","settings","inbox"],
    day_overrides:["today"],
    day_redos:["today"],
    act_done:["reports"],
    kids:["kids"],
    star_totals:["today","stars","kids"],
    game_stats:["today"]
  };

  function renderForRoute(route){
    currentRoute=route;
    updateNavCounts();
    if(route==="today"||!route){
      renderBand();
      renderQueue();
      renderOverview();
      renderLedgerRecent();
    }
    if(route==="inbox"){
      renderConversation();
      renderInboxView();
      renderProofs();
    }
    if(route==="stars"){
      renderGrants();
      renderLedger();
    }
    if(route==="kids"){
      renderKids();
    }
    if(route==="content"){
      renderNote();
      renderDayTemplate();
    }
    if(route==="reports"){
      renderReports();
    }
    if(route==="settings"){
      renderSettings();
    }
    /* Always render dock conversation and update counts */
    renderDockConversation();
    updateNavCounts();
  }

  /* ---- Band ---- */
  function renderBand(){
    var el=$("band");
    if(!el)return;
    var q=queueRows();
    var covered=0, total=DAY.length*3;
    Object.keys(KIDS).forEach(function(kid){covered+=coveredSet(kid).size;});
    var starsToday=rows.ledger.filter(function(r){return String(r.created_at||"").slice(0,10)===today&&r.delta>0;}).reduce(function(s,r){return s+r.delta;},0);
    var revoked=rows.ledger.filter(function(r){return String(r.created_at||"").slice(0,10)===today&&r.delta<0;}).reduce(function(s,r){return s+r.delta;},0);
    var fs=Object.fromEntries(rows.familySettings.map(function(r){return [r.key,r.value];}));
    var locksActive=Object.keys(KIDS).filter(function(id){return (fs["applock_"+id]||"")!=="";}).length;
    var lockDetail=Object.keys(KIDS).filter(function(id){return (fs["applock_"+id]||"")!=="";}).map(function(id){return kidName(id);}).join(" · ");
    var byKid=Object.keys(KIDS).map(function(id){return kidName(id)+" "+coveredSet(id).size;}).join(" · ");
    el.innerHTML='<div class="band">'+
      '<button data-goto="inbox"><span class="lbl">Needs you</span><span class="band__v"><b class="is-alert num">'+q.length+'</b><span>open</span></span><span class="band__sub">'+(q.length?q.map(function(r){return r.type;}).join(" · "):"None")+'</span></button>'+
      '<button data-goto="today"><span class="lbl">Blocks accepted</span><span class="band__v"><b class="num">'+covered+'</b><span>/ '+total+'</span></span><span class="band__sub">'+byKid+'</span></button>'+
      '<button data-goto="stars"><span class="lbl">Stars today</span><span class="band__v"><b class="num">+'+(starsToday+revoked)+'</b><span>granted</span></span><span class="band__sub">'+Math.abs(revoked)+' revoked · net +'+starsToday+'</span></button>'+
      '<button data-goto="kids"><span class="lbl">Locks active</span><span class="band__v"><b class="num">'+locksActive+'</b><span>kid'+(locksActive!==1?"s":"")+'</span></span><span class="band__sub">'+(lockDetail||"None")+'</span></button>'+
    '</div>';
  }

  /* ---- Queue ---- */
  function renderQueue(){
    var el=$("queue");
    if(!el)return;
    var q=queueRows();
    if(!q.length){
      el.innerHTML='<div class="sheet__pad"><p class="tbl__note">Nothing waiting</p></div>';
      return;
    }
    function waitingTime(at){
      var ms=new Date()-new Date(at);
      var mins=Math.floor(ms/60000);
      if(mins<1)return "just now";
      if(mins<60)return mins+"m";
      return Math.floor(mins/60)+"h "+(mins%60)+"m";
    }
    el.innerHTML='<div class="sheet__head"><h2>Waiting on you</h2><span class="tag tag--now">'+q.length+' open</span><div class="sheet__tools"><div class="chips" role="group" aria-label="Filter queue" id="queueKidFilter"></div></div></div>'+
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:130px">Kid</th><th style="width:96px">Type</th><th>What</th><th style="width:74px">Waiting</th><th style="width:190px"><span style="display:block;text-align:right">Action</span></th></tr></thead><tbody>'+
      q.map(function(r){return '<tr>'+
        '<td data-l="Kid"><span class="who k-'+r.kidId+'"><span class="who__m">'+esc(kidName(r.kidId)[0])+'</span><b>'+esc(kidName(r.kidId))+'</b></span></td>'+
        '<td data-l="Type"><span class="tag '+({ask:"tag--open",claim:"tag--redo",pass:"tag--open"}[r.type]||"tag--open")+'">'+r.type+'</span></td>'+
        '<td data-l="What">'+esc(r.body)+'</td>'+
        '<td data-l="Waiting" class="num">'+waitingTime(r.at)+'</td>'+
        '<td data-l="" style="text-align:right">'+queueActions(r)+'</td>'+
      '</tr>';}).join("")+
      '</tbody></table></div><div class="sheet__foot">Cleared items move to Inbox history · nothing is deleted.</div>';
    bindQueueActions();

    /* Kid filter chips */
    var kf=$("queueKidFilter");
    if(kf){
      kf.innerHTML=Object.entries(KIDS).map(function(e){return '<button class="chip" aria-pressed="false" data-queuekid="'+e[0]+'"><span class="chip__dot" style="background:var(--kid-'+e[0]+')"></span>'+esc(e[1].name)+'</button>';}).join("");
    }
  }

  function queueActions(r){
    if(r.type==="ask")return '<div class="acts"><button class="btn btn--sm" data-answerask="'+r.id+'">Answer</button></div>';
    if(r.type==="claim")return '<div class="acts"><button class="btn btn--sm btn--danger" data-denyclaim="'+r.id+'">Decline</button><button class="btn btn--sm btn--primary" data-approveclaim="'+r.id+'">Approve +1</button></div>';
    if(r.type==="pass")return '<div class="acts"><button class="btn btn--sm btn--danger" data-denypass="'+r.id+'">Deny</button><button class="btn btn--sm btn--primary" data-grantpass="'+r.id+'">Grant</button></div>';
    return "";
  }

  function bindQueueActions(){
    document.querySelectorAll("[data-answerask]").forEach(function(b){b.onclick=function(){goToInbox();};});
    document.querySelectorAll("[data-approveclaim]").forEach(function(b){b.onclick=function(){setHelpClaim(b.dataset.approveclaim,"approved");};});
    document.querySelectorAll("[data-denyclaim]").forEach(function(b){b.onclick=function(){setHelpClaim(b.dataset.denyclaim,"denied");};});
    document.querySelectorAll("[data-grantpass]").forEach(function(b){b.onclick=function(){setPass(b.dataset.grantpass,"granted");};});
    document.querySelectorAll("[data-denypass]").forEach(function(b){b.onclick=function(){setPass(b.dataset.denypass,"denied");};});
  }

  function goToInbox(){
    if(window.sqGo)window.sqGo("inbox");
  }

  /* ---- Overview / Day board ---- */
  function renderOverview(){
    var el=$("overview");
    if(!el)return;
    el.innerHTML='<div class="board">'+
      '<div class="board__h" data-kid="all"><span class="lbl">Time</span></div>'+
      Object.keys(KIDS).map(function(id){
        var k=KIDS[id];
        var stars=(rows.totals.find(function(t){return t.kid_id===id;})||{}).stars||0;
        return '<div class="board__h"><span class="who k-'+id+'"><span class="who__m">'+esc(k.name[0])+'</span><b>'+esc(k.name)+'</b></span><span class="star">'+stars+' ⭐</span></div>';
      }).join("")+
      Object.keys(KIDS).length?scheduleOrder("lucien").map(function(i){
        var rowsHtml='<div class="board__t">'+clock(i<DAY.length?DAY[i].t||0:0)+'<small>'+blockTitle(i)+'</small></div>';
        Object.keys(KIDS).forEach(function(kid){
          rowsHtml+=boardCell(kid,i);
        });
        return rowsHtml;
      }).join(""):""+
    '</div>';
    bindScheduleBlocks();
  }

  function scheduleOrder(kid){
    return SQTime.displayOrder(DAY,SQTime.resolveOverrides(overridesRaw,kid));
  }

  function boardCell(kid,i){
    var b=DAY[i], eff=SQTime.resolveOverrides(overridesRaw,kid);
    var mins=SQTime.effMins(DAY,eff,i), timed=mins!=null;
    var info=SQTime.timelineInfo(DAY,eff,SQ_DAY.nowMins());
    var moved=(overridesRaw[kid]||{})[i]!=null;
    var removed=passFor(kid,i,"outing");
    var done=tickFor(kid,i);
    var redo=rows.redos.some(function(r){return r.kid_id===kid&&r.block_idx===i;});
    var isNow=i===info.current;
    var isLate=timed&&mins<info.now&&!done&&!removed;
    var stateClass=removed?"is-off":done?"is-done":isNow?"is-now":"";
    var statusTag="";
    if(done)statusTag='<span class="tag tag--done">Accepted</span>';
    else if(removed)statusTag='<span class="tag tag--off">Removed</span>';
    else if(redo)statusTag='<span class="tag tag--redo">Sent back</span>';
    else if(isLate)statusTag='<span class="tag tag--late">Overdue</span>';
    else if(isNow)statusTag='<span class="tag tag--now">In progress</span>';
    else statusTag='<span class="tag tag--open">Open</span>';

    var actions="";
    if(done){
      actions='<button class="btn btn--sm" data-unaccept="'+kid+':'+i+'">Undo</button><button class="btn btn--sm btn--danger" data-sendback="'+kid+':'+i+'">Send back</button>';
    }else if(removed){
      var pass=rows.passes.find(function(p){return p.kid_id===kid&&p.day===today&&p.block_idx===i&&p.status==="granted";});
      if(pass)actions='<button class="btn btn--sm" data-addback="'+pass.id+':'+kid+':'+i+':'+(pass.credited?1:0)+'">Add back</button>';
    }else{
      actions='<button class="btn btn--sm btn--primary" data-accept="'+kid+':'+i+'">Accept</button><button class="btn btn--sm" data-removeblock="'+kid+':'+i+'">Remove</button>';
    }

    return '<div class="cell '+stateClass+'" data-kid="'+kid+'" data-block="'+i+'" draggable="'+(timed&&!removed?"true":"false")+'">'+
      '<div class="cell__t">'+b.title+' <span>'+b.tz+'</span>'+(moved?' <span style="color:var(--text-3)">moved</span>':'')+'</div>'+
      '<div class="cell__b">'+statusTag+
      '<div class="cell__acts">'+actions+'</div></div>'+
    '</div>';
  }

  function bindScheduleBlocks(){
    document.querySelectorAll("[data-accept]").forEach(function(b){b.onclick=function(){
      var parts=b.dataset.accept.split(":");acceptBlock(parts[0],+parts[1]);
    };});
    document.querySelectorAll("[data-unaccept]").forEach(function(b){b.onclick=function(){
      var parts=b.dataset.unaccept.split(":");unacceptBlock(parts[0],+parts[1],false);
    };});
    document.querySelectorAll("[data-sendback]").forEach(function(b){b.onclick=function(){
      var parts=b.dataset.sendback.split(":");sendBackBlock(parts[0],+parts[1]);
    };});
    document.querySelectorAll("[data-removeblock]").forEach(function(b){b.onclick=function(){
      var parts=b.dataset.removeblock.split(":");removeBlock(parts[0],+parts[1]);
    };});
    document.querySelectorAll("[data-addback]").forEach(function(b){b.onclick=function(){
      var parts=b.dataset.addback.split(":");
      addBackBlock(parts[0],parts[1],+parts[2],parts[3]==="1");
    };});
    /* Drag */
    document.querySelectorAll(".cell[draggable=true]").forEach(function(cell){
      cell.ondragstart=function(e){
        dragState={kid:cell.dataset.kid,block:+cell.dataset.block};
        cell.classList.add("is-dragging");
        e.dataTransfer.effectAllowed="move";
      };
      cell.ondragend=function(){dragState=null;cell.classList.remove("is-dragging");clearDropTargets();};
      cell.ondragover=function(e){
        if(dragState&&dragState.kid===cell.dataset.kid&&cell.getAttribute("draggable")==="true"){
          e.preventDefault();cell.classList.add("is-drop-target");
        }
      };
      cell.ondragleave=function(){cell.classList.remove("is-drop-target");};
      cell.ondrop=function(e){
        e.preventDefault();clearDropTargets();
        if(!dragState||dragState.kid!==cell.dataset.kid)return;
        saveDraggedOrder(cell.dataset.kid,dragState.block,+cell.dataset.block);
      };
      /* Keyboard reorder */
      cell.onkeydown=function(e){
        if(e.key==="ArrowUp"||e.key==="ArrowDown"){
          e.preventDefault();
          var kid=cell.dataset.kid, from=+cell.dataset.block;
          var order=scheduleOrder(kid).filter(function(i){return SQTime.effMins(DAY,SQTime.resolveOverrides(overridesRaw,kid),i)!=null&&!passFor(kid,i,"outing");});
          var idx=order.indexOf(from);
          if(e.key==="ArrowUp"&&idx>0)saveDraggedOrder(kid,from,order[idx-1]);
          if(e.key==="ArrowDown"&&idx<order.length-1)saveDraggedOrder(kid,from,order[idx+1]);
        }
      };
      cell.setAttribute("tabindex","0");
      cell.setAttribute("aria-label","Block: "+blockTitle(+cell.dataset.block)+" for "+kidName(cell.dataset.kid)+" - use Arrow keys to reorder");
    });
  }

  function clearDropTargets(){
    document.querySelectorAll(".is-drop-target").forEach(function(x){x.classList.remove("is-drop-target");});
  }

  async function saveDraggedOrder(kid,fromBlock,toBlock){
    if(fromBlock===toBlock)return;
    const order=scheduleOrder(kid).filter(function(i){return SQTime.effMins(DAY,SQTime.resolveOverrides(overridesRaw,kid),i)!=null&&!passFor(kid,i,"outing");});
    const from=order.indexOf(fromBlock), to=order.indexOf(toBlock);
    if(from<0||to<0)return;
    order.splice(to,0,order.splice(from,1)[0]);
    const eff=SQTime.resolveOverrides(overridesRaw,kid);
    const slots=order.map(function(i){return SQTime.effMins(DAY,eff,i);}).sort(function(a,b){return a-b;});
    const jobs=order.map(function(i,n){return saveBlockTime(kid,i,clock(slots[n]),true);});
    const results=await Promise.all(jobs);
    const err=results.find(function(r){return r&&r.error;});
    if(err){writeFailed(err.error);return;}
    toast(`Schedule moved for ${kidName(kid)}`,true);
    await loadAll();
  }

  async function saveBlockTime(kid,i,value,silent){
    const mins=SQTime.parseMins(value);
    if(mins==null)return {error:new Error("Use a valid time")};
    const base=DAY[i].t;
    const q=SQTime.parseMins(value)===SQTime.parseMins(base)
      ?client.from("day_overrides").delete().eq("day",today).eq("block_idx",i).eq("kid_id",kid)
      :client.from("day_overrides").upsert({day:today,block_idx:i,kid_id:kid,t:value,updated_at:new Date().toISOString()});
    const result=await q;
    if(result.error){if(!silent)writeFailed(result.error);return result;}
    if(!silent){toast(`Time saved — ${kidName(kid)}`,true);await loadAll();}
    return result;
  }

  function starRefunds(kid,blocks,reason){
    return blocks.filter(function(i){return DAY[i]&&DAY[i].kind==="mission";}).map(function(i){return {
      kid_id:kid,delta:-1,reason:`${reason}: ${DAY[i].title}`,source:"admin",granted_by:session.user.id
    };});
  }

  async function acceptBlock(kid,i){
    if(tickFor(kid,i)||passFor(kid,i,"outing"))return;
    var beforeComplete=dayComplete(kid);
    suppressRealtime("day_ticks",{kid_id:kid,day:today,block_idx:i});
    const {error}=await client.from("day_ticks").insert({kid_id:kid,day:today,block_idx:i});
    if(error){writeFailed(error);return;}
    await client.from("day_redos").delete().eq("kid_id",kid).eq("day",today).eq("block_idx",i);
    var grants=[];
    if(DAY[i].kind==="mission")grants.push({kid_id:kid,delta:1,reason:`Admin accepted: ${DAY[i].title}`,source:"admin",granted_by:session.user.id});
    var after=new Set([...coveredSet(kid),i]);
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
    var beforeComplete=dayComplete(kid);
    const {error}=await client.from("day_ticks").delete().eq("kid_id",kid).eq("day",today).eq("block_idx",i);
    if(error){writeFailed(error);return;}
    var after=coveredSet(kid);
    after.delete(i);
    if(rows.passes.some(function(p){return p.kid_id===kid&&p.day===today&&p.block_idx===i&&["granted","spent"].includes(p.status);}))after.add(i);
    var refunds=starRefunds(kid,[i],redoNote?"Sent back":"Admin undo");
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
    var note=prompt("Note for the kid (optional)","")||"";
    await unacceptBlock(kid,i,note);
  }

  async function removeBlock(kid,i){
    if(passFor(kid,i,"outing"))return;
    var credited=localStorage.getItem("sq-removed-credited")!=="0";
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
    const ticks=rows.ticks.filter(function(t){return t.day===today;});
    if(!ticks.length){toast("No accepted blocks to reset",true);return;}
    var refunds=[];
    Object.keys(KIDS).forEach(function(kid){
      const kidTicks=ticks.filter(function(t){return t.kid_id===kid;}).map(function(t){return t.block_idx;});
      refunds.push.apply(refunds,starRefunds(kid,kidTicks,"Day reset"));
      var passOnly=new Set(rows.passes.filter(function(p){return p.kid_id===kid&&p.day===today&&["granted","spent"].includes(p.status);}).map(function(p){return p.block_idx;}));
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

  /* ---- Grants (per-kid reason) ---- */
  function renderGrants(){
    var el=$("grants");
    if(!el)return;
    el.innerHTML=Object.entries(KIDS).map(function(e){
      var id=e[0], k=e[1];
      var stars=(rows.totals.find(function(t){return t.kid_id===id;})||{}).stars||0;
      return '<div class="grant k-'+id+'">'+
        '<span class="who k-'+id+'"><span class="who__m">'+esc(k.name[0])+'</span><b>'+esc(k.name)+'</b></span>'+
        '<label><span class="lbl" style="display:block;margin-bottom:4px">Reason (goes in the ledger)</span>'+
        '<input class="inp" id="grantReason-'+id+'" placeholder="e.g. helped with the dishes"></label>'+
        '<span class="grant__n">'+
          '<button class="btn btn--danger btn--sm" data-grant="'+id+'" data-delta="-1">−1</button>'+
          '<button class="btn btn--sm btn--primary" data-grant="'+id+'" data-delta="1">+1</button>'+
          '<button class="btn btn--sm" data-grant="'+id+'" data-delta="2">+2</button>'+
          '<button class="btn btn--sm" data-grant="'+id+'" data-delta="3">+3</button>'+
        '</span></div>';
    }).join("");
    document.querySelectorAll("[data-grant]").forEach(function(b){
      b.onclick=function(){grantStars(b.dataset.grant,+b.dataset.delta);};
    });
  }

  async function grantStars(kid,delta){
    var input=$("grantReason-"+kid);
    var reason=input?input.value.trim():"";
    if(!reason)reason=delta>0?"Admin grant":"Admin correction";
    const {error}=await client.from("stars_ledger").insert({kid_id:kid,delta,reason,source:"admin",granted_by:session.user.id});
    if(error){writeFailed(error);return;}
    toast(`${delta>0?"+":""}${delta} ⭐ ${kidName(kid)} — saved`,true);
    if(input)input.value="";
    await loadAll();
  }

  /* ---- Ledger ---- */
  var ledgerFilter={kid:"all",kind:"all",todayOnly:false};
  const STAR_KINDS=[
    {key:"unlabelled",label:"Unlabelled",test:function(r){return /^Unlabelled|^App progress/.test(r);}},
    {key:"revoked",   label:"Revoked",   test:function(r){return /^Revoked|^Star reset|^Day reset/.test(r);}},
    {key:"mission",   label:"Mission",   test:function(r){return /^Mission |^My Day mission/.test(r);}},
    {key:"practice",  label:"Practice",  test:function(r){return /^Practice /.test(r);}},
    {key:"activity",  label:"Activity",  test:function(r){return /^Activity /.test(r);}},
    {key:"learn",     label:"Learn",     test:function(r){return /^Learn /.test(r);}},
    {key:"bonus",     label:"Bonus",     test:function(r){return /^Bonus |^Day complete/.test(r);}},
    {key:"outing",    label:"Outing",    test:function(r){return /^Outing |^Removed block/.test(r);}},
    {key:"captain",   label:"Captain",   test:function(r){return /^captain help/i.test(r);}}
  ];
  function starKind(r){
    var reason=String((r&&r.reason)||"");
    var hit=STAR_KINDS.find(function(k){return k.test(reason);});
    if(hit)return hit;
    return {key:r&&r.source==="admin"?"papa":"other",label:r&&r.source==="admin"?"Papa":"Other"};
  }

  function ledgerVisible(){
    return rows.ledger.filter(function(r){
      if(ledgerFilter.kid!=="all"&&r.kid_id!==ledgerFilter.kid)return false;
      if(ledgerFilter.kind!=="all"&&starKind(r).key!==ledgerFilter.kind)return false;
      if(ledgerFilter.todayOnly&&String(r.created_at||"").slice(0,10)!==today)return false;
      return true;
    });
  }

  function renderLedger(){
    var el=$("ledger");
    if(!el)return;
    var visible=ledgerVisible();
    /* Filters */
    var filters=$("ledgerFilters");
    if(filters){
      var kidChips=[{key:"all",label:"All kids"}].concat(Object.entries(KIDS).map(function(e){return {key:e[0],label:e[1].name};}));
      var kinds=[{key:"all",label:"All kinds"}].concat(STAR_KINDS.map(function(k){return {key:k.key,label:k.label};}));
      filters.innerHTML='<div class="chips" role="group" aria-label="Filter ledger">'+
        kidChips.map(function(c){return '<button class="chip'+(ledgerFilter.kid===c.key?'" aria-pressed="true"':'')+'" data-ledkid="'+c.key+'">'+esc(c.label)+'</button>';}).join("")+
        '</div>'+
        '<select class="inp" style="width:auto;height:26px;font-size:12px" aria-label="Range" id="ledgerRange">'+
          '<option value="all">All time</option><option value="today"'+(ledgerFilter.todayOnly?" selected":"")+'>Today</option>'+
          '<option value="7">Last 7 days</option><option value="14">Last 14 days</option>'+
        '</select>'+
        '<button class="btn btn--sm" id="exportCsv">Export CSV</button>'+
        '<div class="chips" role="group" aria-label="Filter kind" style="margin-top:4px">'+
        kinds.map(function(c){return '<button class="chip'+(ledgerFilter.kind===c.key?'" aria-pressed="true"':'')+'" data-ledkind="'+c.key+'">'+esc(c.label)+'</button>';}).join("")+'</div>';
    }
    el.innerHTML='<div class="tbl-wrap"><table class="tbl"><thead><tr>'+
      '<th style="width:110px">When</th><th style="width:130px">Kid</th><th style="width:64px" style="text-align:right">Δ</th><th>Reason</th><th style="width:110px">Source</th><th style="width:86px"></th>'+
    '</tr></thead><tbody>'+
    visible.map(function(r){return '<tr>'+
      '<td data-l="When" class="num">'+fmt(r.created_at)+'</td>'+
      '<td data-l="Kid"><span class="who k-'+r.kid_id+'"><span class="who__m">'+esc(kidName(r.kid_id)[0])+'</span><b>'+esc(kidName(r.kid_id))+'</b></span></td>'+
      '<td data-l="Delta" style="text-align:right"><span class="delta '+(r.delta>0?"delta--up":"delta--down")+'">'+(r.delta>0?"+":"")+r.delta+'</span></td>'+
      '<td data-l="Reason">'+esc(r.reason)+'</td>'+
      '<td data-l="Source"><span class="tag tag--off">'+esc(r.source)+'</span></td>'+
      '<td data-l="" style="text-align:right"><div class="acts">'+ledgerActionsHtml(r)+'</div></td>'+
    '</tr>';}).join("")+'</tbody></table></div>';
    var foot=$("ledgerFoot");
    if(foot){
      var totals=Object.keys(KIDS).map(function(id){
        return kidName(id)+" "+((rows.totals.find(function(t){return t.kid_id===id;})||{}).stars||0)+" ⭐";
      }).join(" · ");
      foot.textContent=visible.length+" of "+rows.ledger.length+" rows · "+totals;
    }
    bindLedgerFilters();
    bindLedgerActions();
  }

  function ledgerActionsHtml(r){
    if(r.source==="admin")return '<button class="btn btn--sm btn--danger" data-delstar="'+r.id+'" title="Undo">Undo</button>';
    return r.delta>0?'<button class="btn btn--sm btn--danger" data-revokestar="'+r.id+'" title="Revoke">Undo</button>':"";
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
        var r=rows.ledger.find(function(x){return x.id===b.dataset.revokestar;});
        if(!r)return;
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

  function bindLedgerFilters(){
    document.querySelectorAll("[data-ledkid]").forEach(function(b){
      b.onclick=function(){ledgerFilter.kid=b.dataset.ledkid;renderLedger();};
    });
    document.querySelectorAll("[data-ledkind]").forEach(function(b){
      b.onclick=function(){ledgerFilter.kind=b.dataset.ledkind;renderLedger();};
    });
    var range=$("ledgerRange");
    if(range)range.onchange=function(){
      ledgerFilter.todayOnly=range.value==="today";
      renderLedger();
    };
    var exportBtn=$("exportCsv");
    if(exportBtn)exportBtn.onclick=function(){
      var visible=ledgerVisible();
      var csv="When,Kid,Delta,Reason,Source\n"+visible.map(function(r){
        return [r.created_at,kidName(r.kid_id),r.delta,'"'+String(r.reason||"").replace(/"/g,'""')+'"',r.source].join(",");
      }).join("\n");
      var blob=new Blob([csv],{type:"text/csv"});
      var a=document.createElement("a");
      a.href=URL.createObjectURL(blob);
      a.download="stars-ledger-"+today+".csv";
      a.click();
      toast("Exported ledger.csv",true);
    };
  }

  /* Recent ledger strip */
  function renderLedgerRecent(){
    var el=$("ledgerRecent");
    if(!el)return;
    var recent=rows.ledger.slice(0,8);
    el.innerHTML=recent.length?'<table class="tbl"><thead><tr><th style="width:74px">Time</th><th style="width:130px">Kid</th><th style="width:64px" style="text-align:right">Δ</th><th>Reason</th><th style="width:110px">Source</th><th style="width:86px"></th></tr></thead><tbody>'+
      recent.map(function(r){
        return '<tr><td data-l="Time" class="num">'+timeOnly(r.created_at)+'</td>'+
          '<td data-l="Kid"><span class="who k-'+r.kid_id+'"><span class="who__m">'+esc(kidName(r.kid_id)[0])+'</span><b>'+esc(kidName(r.kid_id))+'</b></span></td>'+
          '<td data-l="Delta" style="text-align:right"><span class="delta '+(r.delta>0?"delta--up":"delta--down")+'">'+(r.delta>0?"+":"")+r.delta+'</span></td>'+
          '<td data-l="Reason">'+esc(r.reason)+'</td>'+
          '<td data-l="Source"><span class="tag tag--off">'+esc(r.source)+'</span></td>'+
          '<td data-l="" style="text-align:right"><div class="acts">'+ledgerActionsHtml(r)+'</div></td></tr>';
      }).join("")+'</tbody></table>':"<p>No stars yet today</p>";
    bindLedgerActions();
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

  /* ---- Dock conversation ---- */
  function renderDockConversation(){
    var box=$("chatStream");
    if(!box)return;
    var stream=chatStream();
    var needs=SQChat.needsCount(stream);

    /* Kid filter chips */
    var kf=$("chatKidFilter");
    if(kf){
      kf.innerHTML=[{key:"all",label:"All"}].concat(Object.entries(KIDS).map(function(e){return {key:e[0],label:e[1].name};})).map(function(c){
        var on=chatFilters.kid===c.key;
        return '<button class="chip'+(on?'" aria-pressed="true"':'')+'" data-chatkid="'+c.key+'">'+(c.key!=="all"?'<span class="chip__dot" style="background:var(--kid-'+c.key+')"></span>':'')+esc(c.label)+'</button>';
      }).join("");
    }

    /* Type filter */
    var tf=$("dockTypeFilter");
    if(tf){
      var needsOn=chatFilters.needs;
      tf.innerHTML='<button class="chip'+(needsOn?'" aria-pressed="true"':'')+'" data-chatneeds="1">Needs you</button>'+
        CHAT_TYPES.map(function(pair){
          var on=chatFilters.types.indexOf(pair[0])>=0;
          return '<button class="chip'+(on?'" aria-pressed="true"':'')+(needsOn?" is-muted":"")+'" data-chattype="'+pair[0]+'">'+esc(pair[1])+'</button>';
        }).join("");
    }

    var showArchived=false; /* ponytail: default off, toggle via inbox route */
    var filters={
      kid:chatFilters.kid,
      types:chatFilters.types,
      needs:chatFilters.needs,
      archived:showArchived
    };
    var visible=SQChat.filterStream(stream,filters);

    var pin=$("chatPin");
    if(pin){
      var noteEl=$("noteBody");
      var noteText=noteEl?noteEl.value.trim():"";
      pin.innerHTML=noteText
        ?'<span class="lbl">Pinned</span><p>'+esc(noteText)+' <button class="btn btn--sm btn--quiet" data-goto="content" style="height:20px;padding:0 5px">Edit</button></p>'
        :'<span class="lbl">Pinned</span><p style="color:var(--text-3)">No message for today yet <button class="btn btn--sm btn--quiet" data-goto="content" style="height:20px;padding:0 5px">Write</button></p>';
    }

    box.innerHTML=visible.length
      ?visible.map(chatRowHtml).join("")
      :'<p class="chat-empty">Nothing here <button class="btn btn--sm" id="chatClearFilters">Clear filters</button></p>';

    var clear=$("chatClearFilters");
    if(clear)clear.onclick=function(){
      chatFilters={kid:"all",types:["ask","claim","pass"],needs:false};
      saveChatFilters();renderDockConversation();
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

    bindChatFilters();

    if(chatStuckToBottom){
      box.scrollTop=box.scrollHeight;
      chatUnseen=0;
      show("chatJump",false);
    }else{
      chatUnseen=visible.length;
      show("chatJump",true);
    }

    var db=$("dockBadge");
    if(db){db.textContent=String(needs);db.classList.toggle("tag--now",needs>0);db.classList.toggle("tag--open",needs===0);}
  }

  function chatRowHtml(row){
    var k=KIDS[row.kidId]||{name:row.kidId};
    var when=timeOnly(row.at);
    if(row.type==="system"){
      var label=row.meta.event==="tick"?"✓ "+blockTitle(row.meta.blockIdx)+" "+blockTz(row.meta.blockIdx)
        :row.meta.event==="star"?(row.meta.delta>0?"+":"")+row.meta.delta+" ⭐ "+row.body
        :"↩ "+blockTitle(row.meta.blockIdx)+" "+blockTz(row.meta.blockIdx)+" — redo";
      return '<p class="sys">'+when+' · '+esc(k.name)+' '+esc(label)+'</p>';
    }
    if(row.type==="reply"){
      return '<div class="msg msg--papa"><div class="msg__m">Papa · '+when+'</div><div class="msg__b">'+
        (row.body?esc(row.body):"")+(row.audio?'<audio class="audio" controls src="'+publicUrl(row.audio)+'"></audio>':"")+
        '</div></div>';
    }
    if(row.type==="photo"){
      return '<div class="msg msg--kid k-'+row.kidId+'"><div class="msg__m"><span class="who__m" style="width:15px;height:15px;font-size:9px">'+esc(k.name[0])+'</span> '+esc(k.name)+' · '+when+' · Photo</div>'+
        '<div class="msg__b"><img class="thumb" src="'+proofUrl(row.meta.path)+'" alt="Photo proof"></div></div>';
    }
    if(row.type==="claim"){
      var done=row.meta.status!=="requested";
      return '<div class="msg msg--task k-'+row.kidId+'"><div class="msg__m"><span class="who__m" style="width:15px;height:15px;font-size:9px">'+esc(k.name[0])+'</span> '+esc(k.name)+' · captain · '+when+'</div>'+
        '<div class="msg__b">Helped '+esc(kidName(row.meta.helped))+' — '+esc(row.body)+
        (done
          ?'<p class="'+(row.meta.status==="approved"?"ok":"muted")+'">'+(row.meta.status==="approved"?"Approved":"Denied")+'</p>'
          :'<div class="msg__acts"><button class="btn btn--sm btn--primary" data-helpok="'+row.srcId+'">Approve +1</button><button class="btn btn--sm btn--danger" data-helpno="'+row.srcId+'">Decline</button></div>')+
        '</div></div>';
    }
    if(row.type==="pass"){
      var doneP=row.meta.status!=="requested";
      return '<div class="msg msg--task k-'+row.kidId+'"><div class="msg__m"><span class="who__m" style="width:15px;height:15px;font-size:9px">'+esc(k.name[0])+'</span> '+esc(k.name)+' · pass · '+when+'</div>'+
        '<div class="msg__b">'+esc(blockTitle(row.meta.blockIdx))+' '+esc(blockTz(row.meta.blockIdx))+' — '+(row.body||"no reason")+
        (doneP
          ?'<p class="'+(row.meta.status==="granted"?"ok":"muted")+'">'+row.meta.status+'</p>'
          :'<div class="msg__acts"><button class="btn btn--sm btn--primary" data-passok="'+row.srcId+'">Grant</button><button class="btn btn--sm btn--danger" data-passno="'+row.srcId+'">Deny</button></div>')+
        '</div></div>';
    }
    return '<div class="msg msg--kid'+(row.archived?" is-archived":"")+' k-'+row.kidId+'"><div class="msg__m"><span class="who__m" style="width:15px;height:15px;font-size:9px">'+esc(k.name[0])+'</span> '+esc(k.name)+' · '+esc(row.meta.kind)+' · '+when+'</div>'+
      '<div class="msg__b">'+esc(row.body||"Voice memo")+
      (row.audio?'<audio class="audio" controls src="'+publicUrl(row.audio)+'"></audio>':'')+
      (row.needs?'<label class="field"><span>Answer</span><textarea class="inp" id="answer-'+row.srcId+'" placeholder="I can help after lunch."></textarea></label>'+
        '<div class="row"><button class="btn btn--sm" data-answer="'+row.srcId+'">Send</button>'+
        '<button class="btn btn--sm btn--secondary" data-rec="'+row.srcId+'">Record</button>'+
        '<button class="btn btn--sm btn--secondary" data-stop="'+row.srcId+'" disabled>Stop</button>'+
        '<span class="message message--ok" id="recstatus-'+row.srcId+'"></span></div>':'')+
      '<div class="msg__acts">'+(row.archived
        ?'<button class="btn btn--sm btn--secondary" data-unarchiveask="'+row.srcId+'">Restore</button>'
        :'<button class="btn btn--sm btn--secondary" data-archiveask="'+row.srcId+'">Archive</button>')+
      '</div></div></div>';
  }

  function bindChatFilters(){
    document.querySelectorAll("[data-chatkid]").forEach(function(b){
      b.onclick=function(){chatFilters.kid=b.dataset.chatkid;saveChatFilters();renderDockConversation();};
    });
    document.querySelectorAll("[data-chattype]").forEach(function(b){
      b.onclick=function(){
        var t=b.dataset.chattype, i=chatFilters.types.indexOf(t);
        if(i<0)chatFilters.types=chatFilters.types.concat([t]);
        else chatFilters.types=chatFilters.types.filter(function(x){return x!==t;});
        chatFilters.needs=false;
        saveChatFilters();renderDockConversation();
      };
    });
    var dockTf=$("dockTypeFilter");
    if(dockTf){
      var needsBtn=dockTf.querySelector("[data-chatneeds]");
      if(needsBtn)needsBtn.onclick=function(){
        chatFilters.needs=!chatFilters.needs;saveChatFilters();renderDockConversation();
      };
    }
  }

  /* ---- Inbox view (full-width version of conversation) ---- */
  function renderInboxView(){
    var el=$("inboxStream");
    if(!el)return;
    var stream=chatStream();
    var showArchived=true;
    var filters={
      kid:chatFilters.kid,
      types:chatFilters.types,
      needs:chatFilters.needs,
      archived:showArchived
    };
    var visible=SQChat.filterStream(stream,filters);
    el.innerHTML='<table class="tbl"><thead><tr>'+
      '<th style="width:74px">Time</th><th style="width:130px">Kid</th><th style="width:90px">Type</th><th>Message</th><th style="width:96px">Status</th><th style="width:150px"></th>'+
    '</tr></thead><tbody>'+
    visible.map(function(row){
      var k=KIDS[row.kidId]||{name:row.kidId};
      if(row.type==="system")return "";
      var typeLabel=row.type==="claim"?"Claim":row.type==="pass"?"Pass":row.type==="photo"?"Photo":row.type==="reply"?"Reply":"Ask";
      var status=row.type==="reply"?"Sent":row.meta&&row.meta.status==="requested"?"Open":row.meta&&row.meta.status==="approved"?"Approved":row.meta&&row.meta.status==="granted"?"Granted":row.archived?"Archived":"Answered";
      var statusTag=status==="Open"?'<span class="tag tag--now">Open</span>':status==="Approved"||status==="Granted"?'<span class="tag tag--done">'+status+'</span>':'<span class="tag tag--off">'+status+'</span>';
      var actions="";
      if(row.needs)actions='<button class="btn btn--sm btn--primary" data-answer="'+row.srcId+'">Reply</button>';
      else if(!row.archived&&row.type==="ask")actions='<button class="btn btn--sm" data-archiveask="'+row.srcId+'">Archive</button>';
      return '<tr><td data-l="Time" class="num">'+timeOnly(row.at)+'</td>'+
        '<td data-l="Kid"><span class="who k-'+row.kidId+'"><span class="who__m">'+esc(k.name[0])+'</span><b>'+esc(k.name)+'</b></span></td>'+
        '<td data-l="Type"><span class="tag tag--open">'+typeLabel+'</span></td>'+
        '<td data-l="Message">'+esc(row.body||(row.type==="reply"?"Papa reply":"Voice memo"))+'</td>'+
        '<td data-l="Status">'+statusTag+'</td>'+
        '<td data-l="" style="text-align:right"><div class="acts">'+actions+'</div></td></tr>';
    }).filter(Boolean).join("")+'</tbody></table>';
    var tf=$("chatTypeFilter");
    if(tf){
      var needsOn=chatFilters.needs;
      tf.innerHTML='<button class="chip'+(needsOn?'" aria-pressed="true"':'')+'" data-chatneeds="1">Needs you</button>'+
        CHAT_TYPES.map(function(pair){
          var on=chatFilters.types.indexOf(pair[0])>=0;
          return '<button class="chip'+(on?'" aria-pressed="true"':'')+'" data-chattype="'+pair[0]+'">'+esc(pair[1])+'</button>';
        }).join("");
      tf.querySelector("[data-chatneeds]").onclick=function(){chatFilters.needs=!chatFilters.needs;saveChatFilters();renderInboxView();};
      tf.querySelectorAll("[data-chattype]").forEach(function(b){
        b.onclick=function(){
          var t=b.dataset.chattype, i=chatFilters.types.indexOf(t);
          if(i<0)chatFilters.types=chatFilters.types.concat([t]);
          else chatFilters.types=chatFilters.types.filter(function(x){return x!==t;});
          chatFilters.needs=false;
          saveChatFilters();renderInboxView();
        };
      });
    }
    /* Also render conversation in dock */
    renderConversation();
  }

  /* Legacy conversation render (used by dock + inline actions) */
  function renderConversation(){
    renderDockConversation();
  }

  async function startAnswerRecord(id){
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    answerAskId=id; answerChunks=[];
    answerRecord=new MediaRecorder(stream);
    answerRecord.ondataavailable=function(e){if(e.data.size) answerChunks.push(e.data);};
    answerRecord.onstop=function(){stream.getTracks().forEach(function(t){t.stop();});};
    answerRecord.start();
    document.querySelector('[data-rec="'+id+'"]').disabled=true;
    document.querySelector('[data-stop="'+id+'"]').disabled=false;
    var st=$("recstatus-"+id);
    if(st)st.textContent="Recording";
  }

  function stopAnswerRecord(id){
    if(answerRecord&&answerAskId===id){
      answerRecord.stop();
      var st=$("recstatus-"+id);
      if(st)st.textContent="Ready";
    }
  }

  async function answerAsk(id){
    var bodyEl=$("answer-"+id);
    var body=bodyEl?bodyEl.value.trim():"";
    let answer_audio_path=null;
    if(answerAskId===id&&answerChunks.length){
      const blob=new Blob(answerChunks,{type:"audio/webm"});
      answer_audio_path=`answers/${id}-${Date.now()}.webm`;
      const up=await client.storage.from("voices").upload(answer_audio_path,blob,{contentType:"audio/webm",upsert:false});
      if(up.error){writeFailed(up.error);return;}
      answerAskId=null; answerChunks=[];
    }
    if(!body&&!answer_audio_path){if(bodyEl)bodyEl.focus();return;}
    suppressRealtime("asks",{id:id});
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
    var claim=rows.helpClaims.find(function(c){return c.id===id;});
    if(!claim)return;
    suppressRealtime("help_claims",{id:id});
    const reviewed_at=new Date().toISOString();
    const {error}=await client.from("help_claims").update({
      status,reviewed_by:session.user.id,reviewed_at
    }).eq("id",id);
    if(error){writeFailed(error);return;}
    if(status==="approved"){
      const reason=`captain help: ${kidName(claim.helped_kid_id)} — ${claim.body}`;
      const grant=await client.from("stars_ledger").insert({
        kid_id:claim.captain_id,delta:1,reason,source:"admin",granted_by:session.user.id
      });
      if(grant.error){writeFailed(grant.error);return;}
    }
    await loadAll();
  }

  async function setPass(id,status){
    suppressRealtime("passes",{id:id});
    const {error}=await client.from("passes").update({status,granted_by:session.user.id}).eq("id",id);
    if(error){writeFailed(error);return;}
    toast(status==="granted"?"Pass approved":"Pass denied",true);
    await loadAll();
  }

  function renderProofs(){
    var el=$("proofs");
    if(!el)return;
    el.innerHTML=rows.photos.length?'<div class="thumb-grid">'+rows.photos.map(function(p){return ''
      +'<article class="ask-card">'
      +'<img class="thumb" src="'+proofUrl(p.path)+'" alt="Photo proof">'
      +'<p>'+kidName(p.kid_id)+' · '+p.day+' · '+blockTitle(p.block_idx)+'<br><span class="muted">'+blockTz(p.block_idx)+'</span></p>'
      +'</article>';}).join("")+'</div>':'<p>No proof photos yet.</p>';
  }

  /* ---- Gallery ---- */
  let galleryTimer=null,galleryIdx=0,galleryShots=[];
  function drawGallery(){
    const p=galleryShots[galleryIdx];
    if(!p)return;
    $("galleryImg").src=proofUrl(p.path);
    $("galleryCap").innerHTML='<b>'+kidName(p.kid_id)+'</b> · '+blockTitle(p.block_idx)+' <span class="muted">'+blockTz(p.block_idx)+'</span> · '+(galleryIdx+1)+'/'+galleryShots.length;
  }
  function galleryStep(dir){
    galleryIdx=(galleryIdx+dir+galleryShots.length)%galleryShots.length;
    drawGallery(); startGalleryTimer();
  }
  function startGalleryTimer(){
    stopGalleryTimer();
    galleryTimer=setInterval(function(){galleryIdx=(galleryIdx+1)%galleryShots.length;drawGallery();},6000);
  }
  function stopGalleryTimer(){if(galleryTimer){clearInterval(galleryTimer);galleryTimer=null;}}
  function openGallery(){
    galleryShots=rows.photos.filter(function(p){return p.day===today;});
    if(!galleryShots.length){toast("No photos today yet",true);return;}
    galleryIdx=0; show("gallery",true); drawGallery(); startGalleryTimer();
  }
  function closeGallery(){stopGalleryTimer();show("gallery",false);}

  /* ---- Reports ---- */
  function renderReports(){
    var el=$("history");
    if(!el)return;
    var daysList=Array.from({length:14},function(_,i){return dayISO(i-13);});
    var counts=new Map();
    rows.history.forEach(function(r){counts.set(r.kid_id+":"+r.day,(counts.get(r.kid_id+":"+r.day)||0)+1);});
    /* Per-kid stats over the 14-day window */
    var kidRows=Object.entries(KIDS).map(function(e){
      var id=e[0], k=e[1];
      var totalBlocks=0, totalStars=0;
      daysList.forEach(function(d){
        totalBlocks+=counts.get(id+":"+d)||0;
      });
      var kidLedger=rows.ledger.filter(function(r){return r.kid_id===id&&daysList.includes(String(r.created_at||"").slice(0,10));});
      totalStars=kidLedger.reduce(function(s,r){return s+r.delta;},0);
      var bestDay="", bestCount=0;
      daysList.forEach(function(d){
        var c=counts.get(id+":"+d)||0;
        if(c>bestCount){bestCount=c;bestDay=d.slice(5);}
      });
      var streak=0;
      for(var i=daysList.length-1;i>=0;i--){
        if((counts.get(id+":"+daysList[i])||0)>0)streak++;else break;
      }
      return '<tr><td data-l="Kid"><span class="who k-'+id+'"><span class="who__m">'+esc(k.name[0])+'</span><b>'+esc(k.name)+'</b></span></td>'+
        '<td data-l="Blocks" class="r num">'+totalBlocks+' / '+(14*DAY.length)+'</td>'+
        '<td data-l="Stars" class="r num">'+totalStars+'</td>'+
        '<td data-l="Photos" class="r num">'+rows.photos.filter(function(p){return p.kid_id===id&&daysList.includes(p.day);}).length+'</td>'+
        '<td data-l="Asks" class="r num">'+rows.asks.filter(function(a){return a.kid_id===id&&daysList.includes(String(a.created_at||"").slice(0,10));}).length+'</td>'+
        '<td data-l="Best" class="r num">'+bestDay+'</td>'+
        '<td data-l="Streak" class="r num">'+streak+' d</td></tr>';
    }).join("");
    el.innerHTML='<table class="tbl"><thead><tr>'+
      '<th style="width:150px">Kid</th><th class="r">Blocks</th><th class="r">Stars</th><th class="r">Photos</th><th class="r">Asks</th><th class="r">Best day</th><th class="r">Streak</th>'+
    '</tr></thead><tbody>'+kidRows+'</tbody></table>';
  }

  /* ---- Kids route ---- */
  function renderKids(){
    var el=$("kidsTable");
    if(!el)return;
    var fs=Object.fromEntries(rows.familySettings.map(function(r){return [r.key,r.value];}));
    el.innerHTML='<table class="tbl"><thead><tr>'+
      '<th style="width:150px">Kid</th><th style="width:90px" class="r">Stars</th><th style="width:110px">Day</th><th style="width:130px">App</th><th>Category locks</th><th style="width:96px">PIN</th><th style="width:110px"></th>'+
    '</tr></thead><tbody>'+
    Object.entries(KIDS).map(function(e){
      var id=e[0], k=e[1];
      var stars=(rows.totals.find(function(t){return t.kid_id===id;})||{}).stars||0;
      var covered=coveredSet(id).size;
      var paused=(fs["applock_"+id]||"")!=="";
      var cats=LOCK_CATS.filter(function(c){return c[0]!=="captain"||id==="luis";});
      var lockedCount=cats.filter(function(c){return (fs['catlock_'+id+'_'+c[0]]||"")!=="";}).length;
      var lockSummary=lockedCount?'<span class="tag tag--late">'+lockedCount+' locked</span>':'<span class="tbl__note">None</span>';
      var pinRow=rows.kids.find(function(x){return x.id===id;});
      var hasPin=pinRow&&pinRow.pin;
      return '<tr>'+
        '<td data-l="Kid"><span class="who k-'+id+'"><span class="who__m">'+esc(k.name[0])+'</span><b>'+esc(k.name)+'</b></span></td>'+
        '<td data-l="Stars" class="r"><span class="star num">'+stars+'</span></td>'+
        '<td data-l="Day" class="num">'+covered+' / '+DAY.length+'</td>'+
        '<td data-l="App"><span class="tag '+(paused?"tag--late":"tag--done")+'">'+(paused?"Paused":"Running")+'</span></td>'+
        '<td data-l="Locks">'+lockSummary+'</td>'+
        '<td data-l="PIN"><span class="tag '+(hasPin?"tag--done":"tag--off")+'">'+(hasPin?"Set":"Not set")+'</span></td>'+
        '<td data-l="" class="r"><div class="acts"><button class="btn btn--sm" data-kiddetail="'+id+'">Manage</button></div></td></tr>';
    }).join("")+'</tbody></table>';

    document.querySelectorAll("[data-kiddetail]").forEach(function(b){
      b.onclick=function(){renderKidDetail(b.dataset.kiddetail);};
    });
  }

  function renderKidDetail(kid){
    var el=$("kidDetail");
    if(!el)return;
    var k=KIDS[kid];
    var fs=Object.fromEntries(rows.familySettings.map(function(r){return [r.key,r.value];}));
    var paused=(fs["applock_"+kid]||"")!=="";
    var pinRow=rows.kids.find(function(x){return x.id===kid;});
    var pin=pinRow&&pinRow.pin;
    var cats=LOCK_CATS.filter(function(c){return c[0]!=="captain"||kid==="luis";});
    var lastSeen="--";
    var lastTick=rows.ticks.filter(function(t){return t.kid_id===kid;}).sort(function(a,b){return (b.created_at||"").localeCompare(a.created_at||"");})[0];
    if(lastTick&&lastTick.created_at)lastSeen=timeOnly(lastTick.created_at);
    var feedback=pinFeedback[kid]||{};

    el.hidden=false;
    el.innerHTML='<div class="sheet__head"><h2>'+esc(k.name)+'</h2><span class="lbl">detail panel</span>'+
      '<div class="sheet__tools"><button class="btn btn--sm btn--danger" data-applock="'+kid+'" data-paused="'+(paused?1:0)+'">'+(paused?"Resume app":"Pause app")+'</button></div></div>'+
      '<div class="sheet__pad">'+
      '<span class="lbl" style="display:block;margin-bottom:8px">Category locks</span>'+
      '<div class="chips">'+cats.map(function(c){
        var locked=(fs['catlock_'+kid+'_'+c[0]]||"")!=="";
        return '<button class="chip" aria-pressed="'+(locked?"true":"false")+'" data-catlock="'+kid+':'+c[0]+'" data-locked="'+(locked?1:0)+'">'+esc(c[1])+(locked?" · locked":"")+'</button>';
      }).join("")+'</div>'+
      '<p class="field__hint" style="margin-top:9px">My Day, guides, Learn and the ask channel stay open in every state except a full pause.</p>'+
      '<div class="grid-2" style="margin-top:18px">'+
      '<label class="field"><span class="lbl">Kid PIN</span><input class="inp num" id="pin-'+kid+'" inputmode="numeric" maxlength="4" value="'+esc(pin||"")+'" placeholder="optional" autocomplete="off"><span class="field__hint">4 digits · used to open profile on tablet.</span></label>'+
      '<label class="field"><span class="lbl">Last seen</span><input class="inp" value="'+lastSeen+'" readonly><span class="field__hint">Derived from day_ticks.</span></label></div>'+
      '<button class="btn btn--primary" data-savepin="'+kid+'">Save changes</button>'+
      '<p class="message pin-message '+(feedback.type==="ok"?"message--ok":feedback.type==="error"?"message--error":"")+'" id="pinmsg-'+kid+'" aria-live="polite">'+(feedback.text||"")+'</p>'+
    '</div>';
    el.scrollIntoView({behavior:"smooth"});
    bindKidDetailActions();
  }

  function bindKidDetailActions(){
    document.querySelectorAll("[data-applock]").forEach(function(b){b.onclick=async function(){
      var id=b.dataset.applock, paused=b.dataset.paused==="1";
      var value=paused?"":"1";
      suppressRealtime("family_settings",{key:"applock_"+id});
      const {error}=await client.from("family_settings").upsert({key:"applock_"+id,value,updated_at:new Date().toISOString()});
      if(error){writeFailed(error);return;}
      toast(paused?"Resumed ▶":"Paused ⏸",true);
      await loadAll();
    };});
    document.querySelectorAll("[data-catlock]").forEach(function(b){b.onclick=async function(){
      var parts=b.dataset.catlock.split(":"), id=parts[0], cat=parts[1], locked=b.dataset.locked==="1";
      suppressRealtime("family_settings",{key:'catlock_'+id+'_'+cat});
      const {error}=await client.from("family_settings").upsert({key:'catlock_'+id+'_'+cat,value:locked?"":"1",updated_at:new Date().toISOString()});
      if(error){writeFailed(error);return;}
      toast(kidName(id)+" "+cat+" "+(locked?"unlocked":"locked"),true);
      await loadAll();
    };});
    document.querySelectorAll("[data-savepin]").forEach(function(b){b.onclick=function(){savePin(b.dataset.savepin,false);};});
  }

  async function savePin(id,clear){
    var value=clear?null:$("pin-"+id).value.trim();
    if(value&&!/^[0-9]{4}$/.test(value)){
      pinFeedback[id]={type:"error",text:"Use 4 digits",value};
      renderKidDetail(id); $("pin-"+id).focus(); $("pin-"+id).select(); return;
    }
    pinFeedback[id]={type:"pending",text:"Saving",value:value||""};
    renderKidDetail(id);
    const {error}=await client.from("kids").update({pin:value||null}).eq("id",id);
    if(error){
      pinFeedback[id]={type:"error",text:"Could not save",value:value||""};
      renderKidDetail(id); return;
    }
    var existing=rows.kids.find(function(x){return x.id===id;});
    if(existing)existing.pin=value||null; else rows.kids.push({id,pin:value||null});
    var time=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    pinFeedback[id]={type:"ok",text:`Saved ${time}`};
    renderKidDetail(id);
  }

  /* ---- Content route ---- */
  function renderNote(){
    var el=$("notePanel");
    if(!el)return;
    el.innerHTML='<div class="grid-2">'+
      '<label class="field"><span class="lbl">English</span><textarea class="inp" id="noteBody">'+esc(($("noteBody")&&$("noteBody").value)||"")+'</textarea></label>'+
      '<label class="field"><span class="lbl">繁體中文</span><textarea class="inp" id="noteBodyZh" lang="zh-Hant">'+esc(($("noteBodyZh")&&$("noteBodyZh").value)||"")+'</textarea></label></div>'+
      '<div style="display:flex;gap:8px;align-items:center">'+
      '<button class="btn btn--primary" id="saveNoteBtn">Save message</button>'+
      '<span class="tbl__note" id="noteStatus"></span></div>';
    $("saveNoteBtn").onclick=async function(){
      var body=$("noteBody").value.trim();
      var bodyZh=$("noteBodyZh").value.trim();
      var fullBody=body+(bodyZh?"\n---\n"+bodyZh:"");
      var status=$("noteStatus");
      status.textContent="";
      if(!body&&!bodyZh){status.textContent="Write a message first.";return;}
      const {error}=await client.from("papa_notes").upsert({day:today,body:fullBody});
      status.textContent=error?error.message:"Saved";
      if(!error){status.classList.add("message--ok");}
    };
  }

  function renderDayTemplate(){
    var el=$("dayTemplate");
    if(!el)return;
    el.innerHTML='<table class="tbl"><thead><tr><th style="width:60px">#</th><th style="width:90px">Time</th><th>Block</th><th style="width:160px">繁體中文</th><th style="width:100px" class="r">Kind</th></tr></thead><tbody>'+
      DAY.map(function(b,i){return '<tr><td data-l="#" class="num">'+(i+1)+'</td><td data-l="Time" class="num">'+clock(b.t)+'</td><td data-l="Block"><b>'+esc(b.title)+'</b></td><td data-l="中文" lang="zh-Hant">'+esc(b.tz||"")+'</td><td data-l="Kind" class="r">'+esc(b.kind||"")+'</td></tr>';}).join("")+'</tbody></table>';

  }

  /* ---- Settings route ---- */
  function renderSettings(){
    if($("accessPanel"))renderAccessPanel();
    if($("behaviourPanel"))renderBehaviourPanel();
    if($("dangerZone"))renderDangerZone();
    updateNotifyState();
  }

  function adminPinValue(){
    var row=rows.familySettings.find(function(x){return x.key==="admin_pin";})||{};
    return row.value||"";
  }

  function renderAccessPanel(){
    var el=$("accessPanel");
    if(!el)return;
    var fb=adminPinFeedback.type?adminPinFeedback:{};
    var displayPin=fb.value!==undefined?fb.value:adminPinValue();
    el.innerHTML='<div class="grid-2">'+
      '<label class="field"><span class="lbl">Papa PIN</span><input class="inp num" id="adminPin" inputmode="numeric" maxlength="4" value="'+esc(displayPin)+'" placeholder="4 digits" autocomplete="off" pattern="[0-9]*"><span class="field__hint">Unlocks games for the current block on any tablet. 4 digits.</span></label>'+
      '<label class="field"><span class="lbl">Signed in as</span><input class="inp" value="'+(session?session.user.email:"")+'" readonly><span class="field__hint">Supabase auth · session refreshes automatically.</span></label></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'+
      '<button class="btn btn--primary" id="saveAdminPinBtn">Save</button>'+
      '<button class="btn" id="settingsLogout">Sign out</button></div>'+
      '<p class="message pin-message '+(fb.type==="ok"?"message--ok":fb.type==="error"?"message--error":"")+'" id="adminPinStatus" aria-live="polite">'+(fb.text||"")+'</p>';
    $("saveAdminPinBtn").onclick=saveAdminPin;
    $("settingsLogout").onclick=function(){client.auth.signOut().then(function(){location.reload();});};
  }

  async function saveAdminPin(){
    var value=$("adminPin").value.trim();
    if(!/^[0-9]{4}$/.test(value)){
      adminPinFeedback.type="error"; adminPinFeedback.text="4 digits please"; adminPinFeedback.value=value;
      renderSettings(); $("adminPin").focus(); $("adminPin").select(); return;
    }
    adminPinFeedback.type="pending"; adminPinFeedback.text="Saving"; adminPinFeedback.value=value;
    renderSettings();
    const {error}=await client.from("family_settings").upsert({key:"admin_pin",value:value,updated_at:new Date().toISOString()});
    if(error){
      adminPinFeedback.type="error"; adminPinFeedback.text="Could not save"; adminPinFeedback.value=value;
      renderSettings(); return;
    }
    var row=rows.familySettings.find(function(x){return x.key==="admin_pin";});
    if(row)row.value=value; else rows.familySettings.push({key:"admin_pin",value:value});
    var time=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    adminPinFeedback.type="ok"; adminPinFeedback.text=`Saved ${time}`; adminPinFeedback.value=value;
    renderSettings();
  }

  function renderBehaviourPanel(){
    var el=$("behaviourPanel");
    if(!el)return;
    var credited=(localStorage.getItem("sq-removed-credited")||"1")==="1";
    el.innerHTML='<label class="field" style="display:flex;gap:10px;align-items:flex-start;margin-bottom:14px">'+
      '<input type="checkbox" id="removedCredited" '+(credited?"checked":"")+' style="margin-top:2px;width:16px;height:16px">'+
      '<span><b style="font-weight:650">Removed blocks still earn stars</b>'+
      '<span class="field__hint" style="margin-top:2px">When you remove a block for an outing, the kid keeps the star for it.</span></span></label>'+
      '<label class="field" style="display:flex;gap:10px;align-items:flex-start;margin-bottom:0">'+
      '<input type="checkbox" id="notifyCheck" '+(browserNotifyEnabled?"checked":"")+' style="margin-top:2px;width:16px;height:16px">'+
      '<span><b style="font-weight:650">Desktop notifications for asks and claims</b>'+
      '<span class="field__hint" style="margin-top:2px">Only things waiting on you. System events never notify.</span></span></label>';
    $("removedCredited").onchange=function(){localStorage.setItem("sq-removed-credited",$("removedCredited").checked?"1":"0");};
    $("notifyCheck").onchange=function(){toggleBrowserNotifications();};
  }

  function renderDangerZone(){
    var el=$("dangerZone");
    if(!el)return;
    el.innerHTML='<table class="tbl"><tbody>'+
      '<tr><td data-l="Action"><b>Reset today\'s day</b><div class="tbl__note">Un-accepts every block for all three kids and refunds the stars.</div></td>'+
      '<td data-l="" class="r" style="width:170px"><div class="acts"><button class="btn btn--sm btn--danger" id="dangerResetDay">Reset day</button></div></td></tr>'+
      '<tr><td data-l="Action"><b>Reset a kid\'s stars to zero</b><div class="tbl__note">Adds one negative ledger row. The history stays readable.</div></td>'+
      '<td data-l="" class="r"><div class="acts">'+Object.entries(KIDS).map(function(e){
        return '<button class="btn btn--sm btn--danger" data-resetstars="'+e[0]+'">Reset '+esc(e[1].name)+'</button>';
      }).join("")+'</div></td></tr>'+
      '<tr><td data-l="Action"><b>Pause every app</b><div class="tbl__note">All three tablets keep My Day, guides, Learn and Ask. Everything else stops.</div></td>'+
      '<td data-l="" class="r"><div class="acts"><button class="btn btn--sm btn--danger" id="dangerPauseAll">Pause all</button></div></td></tr>'+
    '</tbody></table>';
    $("dangerResetDay").onclick=resetAcceptedDay;
    document.querySelectorAll("[data-resetstars]").forEach(function(b){b.onclick=function(){resetStars(b.dataset.resetstars);};});
    $("dangerPauseAll").onclick=async function(){
      var jobs=Object.keys(KIDS).map(function(id){
        return client.from("family_settings").upsert({key:"applock_"+id,value:"1",updated_at:new Date().toISOString()});
      });
      var results=await Promise.all(jobs);
      var err=results.find(function(r){return r.error;});
      if(err){writeFailed(err.error);return;}
      toast("All apps paused",true);
      await loadAll();
    };
  }

  async function resetStars(kid){
    var total=(rows.totals.find(function(t){return t.kid_id===kid;})||{}).stars||0;
    if(!total){toast(kidName(kid)+" already has 0 stars",true);return;}
    const {error}=await client.from("stars_ledger").insert({
      kid_id:kid,delta:-total,reason:"Star reset",source:"admin",granted_by:session.user.id
    });
    if(error){writeFailed(error);return;}
    toast(kidName(kid)+" stars reset to 0",true);
    await loadAll();
  }

  /* ---- Notifications ---- */
  async function toggleBrowserNotifications(){
    if(!("Notification" in window)){toast("Browser notifications are not supported",false);return;}
    if(browserNotifyEnabled&&Notification.permission==="granted"){
      browserNotifyEnabled=false;
      localStorage.setItem("sq-admin-notify","0");
      updateNotifyState();
      return;
    }
    const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
    browserNotifyEnabled=permission==="granted";
    localStorage.setItem("sq-admin-notify",browserNotifyEnabled?"1":"0");
    updateNotifyState();
    toast(browserNotifyEnabled?"Windows notifications enabled":"Windows notifications not allowed",browserNotifyEnabled);
  }

  function updateNotifyState(){
    var supported="Notification" in window;
    var permission=supported?Notification.permission:"unsupported";
    var enabled=supported&&browserNotifyEnabled&&permission==="granted";
    /* Update notification banner in settings */
    if(permission==="denied"){
      var banner=$("notifyBanner");
      if(banner)banner.classList.remove("hidden");
    }
    /* Update live dot */
    var live=$("liveDot");
    if(live){live.classList.toggle("live--on",!!session);live.classList.toggle("live--off",!session);}
    var ll=$("liveLabel");
    if(ll)ll.textContent=!!session?"Live":"Offline";
  }

  function pushNotify(title,body,kind){
    if("Notification" in window&&browserNotifyEnabled&&Notification.permission==="granted"){
      try{new Notification("Summer Quest Admin",{body:title+" — "+(body||""),icon:"assets/icons/icon-192.png",tag:"sq-"+(kind||"info")+"-"+Date.now()});}catch(e){}
    }
  }

  function realtimeKey(table,row){
    if(!row)return "";
    if(table==="day_ticks")return row.kid_id+":"+row.day+":"+row.block_idx;
    return row.id||"";
  }
  function suppressRealtime(table,row){
    var key=realtimeKey(table,row);
    if(key)silentRealtime.set(table+":"+key,Date.now()+5000);
  }
  function shouldSuppressRealtime(table,row){
    var key=realtimeKey(table,row);
    if(!key)return false;
    var full=table+":"+key, until=silentRealtime.get(full)||0;
    if(until>Date.now())return true;
    silentRealtime.delete(full);
    return false;
  }

  function notificationFor(table,payload){
    var row=payload.new||{};
    if(payload.eventType!=="INSERT"||shouldSuppressRealtime(table,row))return null;
    if(table==="asks")return {kind:row.kind==="urgent"?"urgent":"ask",title:kidName(row.kid_id)+" asked for help",body:row.body||"Voice memo"};
    if(table==="passes"&&row.status==="requested")return {kind:"pass",title:kidName(row.kid_id)+" requested a "+row.kind+" pass",body:blockTitle(row.block_idx)+" "+blockTz(row.block_idx)};
    if(table==="photos")return {kind:"photo",title:kidName(row.kid_id)+" uploaded proof",body:blockTitle(row.block_idx)+" "+blockTz(row.block_idx)};
    if(table==="help_claims"&&row.status==="requested")return {kind:"claim",title:kidName(row.captain_id)+" sent a captain claim",body:"Helped "+kidName(row.helped_kid_id)};
    if(table==="day_ticks"&&row.day===today)return {kind:"done",title:kidName(row.kid_id)+" completed a block",body:blockTitle(row.block_idx)+" "+blockTz(row.block_idx)};
    if(table==="stars_ledger"&&row.source==="app")return {kind:"star",title:kidName(row.kid_id)+" earned "+row.delta+" star"+(row.delta===1?"":"s"),body:row.reason||"App activity"};
    return null;
  }

  /* Chat send */
  async function sendChatMessage(){
    var body=$("chatBody").value.trim();
    if(!body){$("chatBody").focus();return;}
    var to=$("chatTo").value;
    var targets=to==="all"?Object.keys(KIDS):[to];
    var now=new Date().toISOString();
    var payload=targets.map(function(kid){
      return {kid_id:kid,kind:"papa",body:null,answer:body,answered_at:now};
    });
    const {error}=await client.from("asks").insert(payload);
    if(error){writeFailed(error);return;}
    $("chatBody").value="";
    chatStuckToBottom=true;
    toast("Message sent",true);
    await loadAll();
  }

  /* Realtime subscription with route-scoped re-render */
  var TABLE_ROUTES_MAP=TABLE_ROUTES;

  function subscribeRealtime(){
    if(realtimeChannel)return;
    var live=function(table){
      return function(payload){
        var note=notificationFor(table,payload);
        if(note)pushNotify(note.title,note.body,note.kind);
        loadAll().then(function(){
          /* Determine which routes to refresh */
          var routes=TABLE_ROUTES_MAP[table]||[];
          if(routes.length&&routes.indexOf(currentRoute)<0)return;
        });
      };
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

  /* ---- Event wiring ---- */
  $("loginBtn").onclick=async function(){
    $("loginErr").textContent="";
    var email=$("email").value.trim();
    var password=$("password").value;
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error){$("loginErr").textContent=error.message;return;}
    session=data.session;
    openDashboard();
  };
  $("navLogout").onclick=async function(){await client.auth.signOut();location.reload();};
  $("refreshBtn").onclick=loadAll;
  $("resetAcceptedBtn").onclick=resetAcceptedDay;
  $("chatStream").onscroll=function(){
    var box=$("chatStream");
    chatStuckToBottom=box.scrollHeight-box.scrollTop-box.clientHeight<40;
    if(chatStuckToBottom)show("chatJump",false);
  };
  $("chatJump").onclick=function(){
    var box=$("chatStream");
    box.scrollTop=box.scrollHeight;
    chatStuckToBottom=true;
    show("chatJump",false);
  };
  $("chatSend").onclick=sendChatMessage;
  $("galleryBtn").onclick=openGallery;
  $("galleryPrev").onclick=function(){galleryStep(-1);};
  $("galleryNext").onclick=function(){galleryStep(1);};
  $("galleryClose").onclick=closeGallery;
  addEventListener("keydown",function(e){
    if($("gallery").classList.contains("hidden"))return;
    if(e.key==="Escape")closeGallery();
    if(e.key==="ArrowLeft")galleryStep(-1);
    if(e.key==="ArrowRight")galleryStep(1);
  });

  /* Route change event */
  addEventListener("sq-route",function(e){
    var route=e.detail&&e.detail.route;
    renderForRoute(route);
  });

  /* dismiss */
  document.addEventListener("click",function(e){
    var dis=e.target.closest("[data-dismiss]");
    if(dis){var note=dis.closest(".note");if(note)note.classList.add("hidden");}
    var toggle=e.target.closest("[data-togglearchived]");
    if(toggle){window.sqGo&&window.sqGo("inbox");}
  });

  init().catch(function(e){show("configState",true);var cp=$("configState");if(cp){var p=cp.querySelector("p");if(p)p.textContent=e.message;}});
})();
