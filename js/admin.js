(function(){
  const CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  const KIDS={
    lucien:{name:"Lucien"},
    lili:{name:"Lili"},
    luis:{name:"Luis"}
  };
  const DAY=window.SQ_DAY_DATA||[];
  const BANK=window.SQ_ACT_DATA||[];
  /* Games default to free, same as every other category (Papa, 2026-08-03,
     reverses the 2026-07-27 "games default locked" decision): no catlock row
     = unlocked; Papa locks by setting any non-empty value. */
  const catIsLocked=function(fs,id,cat){
    return (fs['catlock_'+id+'_'+cat]||"")!=="";
  };
  const LOCK_CATS=[
    ["games","Games"],
    ["acts","Activities"],
    ["learn","Learn"],
    ["ask","Ask"],
    ["captain","Captain"]
  ];
  const BRAIN_TIERS=[["tot","Tot"],["mid","Mid"],["hard","Hard"]];
  const BRAIN_TIER_DEFAULT={lucien:"tot",lili:"mid",luis:"hard"}; /* keep in sync with js/brain-data.js TIER_DEFAULT */
  const brainIsEnabled=function(fs,id){return fs["brain_enabled_"+id]!=="0";};
  const brainTierValue=function(fs,id){
    var v=fs["brain_tier_"+id];
    return BRAIN_TIERS.some(function(t){return t[0]===v;})?v:(BRAIN_TIER_DEFAULT[id]||"mid");
  };

  let client=null, session=null, today="", realtimeChannel=null, realtimeStatus="";
  let rows={ticks:[],totals:[],stats:[],ledger:[],asks:[],passes:[],photos:[],kids:[],history:[],helpClaims:[],familySettings:[],redos:[],acts:[],ledger14:[],photos14:[],asks14:[]};
  let answerRecord=null, answerChunks=[], answerAskId=null;
  const pinFeedback={}, adminPinFeedback={};
  let overridesRaw={}, dragState=null;
  /* Day board time editing. boardScope says what a time change applies to:
     "all" = everyone today, a kid id = that kid today, "template" = every day
     from now on. timeDrag holds a live gutter drag so a realtime event cannot
     re-render the board out from under Papa's finger. */
  const TEMPLATE_KEY="day_template_times";
  const REPLACE_KEY_PREFIX="day_block_replacements_";
  const BOARD_SCOPES=[["all","Everyone"],["lucien","Lucien"],["lili","Lili"],["luis","Luis"]];
  /* Pixels of drag per 5-minute step. Tune to taste: lower = faster travel,
     higher = finer control. 4px puts a full hour at ~48px, roughly one board row. */
  const DRAG_PX=4;
  let boardScope="all", timeDrag=null, blockDrag=null;
  let browserNotifyEnabled=localStorage.getItem("sq-admin-notify")==="1";
  const silentRealtime=new Map();
  let currentRoute="today";
  let activeKidDetail=null;

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
  let chatStuckToBottom=true, chatUnseen=0, chatSeenCount=0, showArchived=false, queueKid="all";

  /* Which ask has its reply composer open. The prototype's rail shows one
     compact "Reply" button per bubble, not a permanently expanded textarea in
     every unanswered ask — the field appears only where Papa asked for it, and
     the id survives re-renders so a realtime event does not collapse it. */
  let openReplyId=null;
  /* Voice notes render as a "▶ 0:06" chip instead of the browser's native audio
     widget, which is ~54px of chrome and breaks the bubble rhythm. Durations are
     read once per URL and cached; playback runs through one shared element so
     two notes can never talk over each other. */
  const audioDur=Object.create(null);
  let chatAudio=null, chatAudioUrl="";

  /* Papa's note for today. Stored as one column joined by NOTE_SEP; split on
     read so a save/reload cycle cannot fold the 中文 half into the English one. */
  const NOTE_SEP="\n---\n";
  let papaNote={en:"",zh:""};
  function setNote(body){
    var text=String(body||"");
    var at=text.indexOf(NOTE_SEP);
    papaNote=at<0?{en:text,zh:""}:{en:text.slice(0,at),zh:text.slice(at+NOTE_SEP.length)};
  }
  const noteJoined=()=>papaNote.en+(papaNote.zh?NOTE_SEP+papaNote.zh:"");

  const $=id=>document.getElementById(id);
  const show=(id,on)=>{var el=$(id);if(el)el.classList.toggle("hidden",!on);};
  const kidName=id=>KIDS[id]?KIDS[id].name:id;
  const blockTitle=i=>(DAY[i]&&DAY[i].title)||"Block";
  const blockTz=i=>(DAY[i]&&DAY[i].tz)||"";
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const fmt=ts=>new Date(ts).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
  const clock=t=>`${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`;
  /* clock() takes minutes; DAY[i].t is a "8:00" string. Feeding the string
     straight in printed NaN:NaN across the whole day board. */
  const blockClock=t=>{var m=SQTime.parseMins(t);return m==null?esc(t||"--:--"):clock(m);};
  const timeOnly=ts=>new Date(ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  const todayTicks=kid=>rows.ticks.filter(t=>t.kid_id===kid&&t.day===today);
  const tickFor=(kid,i)=>rows.ticks.find(t=>t.kid_id===kid&&t.day===today&&t.block_idx===i);
  const passFor=(kid,i,kind)=>rows.passes.find(p=>p.kid_id===kid&&p.day===today&&p.block_idx===i&&p.status==="granted"&&(!kind||p.kind===kind));
  function replaceKey(){return REPLACE_KEY_PREFIX+today;}
  function replacementMapRaw(){
    var row=rows.familySettings.find(function(x){return x.key===replaceKey();});
    try{
      var map=JSON.parse(row&&row.value||"{}");
      return map&&typeof map==="object"?map:{};
    }catch(e){return {};}
  }
  function replacementMap(){
    return cleanReplacementMap(replacementMapRaw());
  }
  function cleanReplacementMap(map){
    return SQTime.repairReplacementMap(DAY,KIDS,map);
  }
  async function repairReplacementMap(){
    var key=replaceKey();
    var row=rows.familySettings.find(function(x){return x.key===key;});
    if(!row)return;
    var clean=cleanReplacementMap(replacementMapRaw());
    var value=JSON.stringify(clean);
    if(row.value===value)return;
    row.value=value;
    suppressRealtime("family_settings",{key:key});
    const {error}=await client.from("family_settings").upsert({key:key,value:value,updated_at:new Date().toISOString()});
    if(error)writeFailed(error);
  }
  function templateMapRaw(){
    var row=rows.familySettings.find(function(x){return x.key===TEMPLATE_KEY;});
    return SQTime.parseTemplate(row&&row.value);
  }
  function templateMap(){
    return SQTime.cleanTimeMap(DAY,templateMapRaw());
  }
  async function repairTemplateMap(){
    var row=rows.familySettings.find(function(x){return x.key===TEMPLATE_KEY;});
    if(!row)return;
    var clean=templateMap();
    var value=JSON.stringify(clean);
    if(row.value===value)return;
    row.value=value;
    suppressRealtime("family_settings",{key:TEMPLATE_KEY});
    const {error}=await client.from("family_settings").upsert({key:TEMPLATE_KEY,value:value,updated_at:new Date().toISOString()});
    if(error)writeFailed(error);
  }
  function replacementSource(kid,i){
    return SQTime.replacementSource(DAY,replacementMap(),kid,i);
  }
  function effectiveBlock(kid,i){
    var base=DAY[i]||{}, src=replacementSource(kid,i);
    if(src==null)return base;
    return Object.assign({},DAY[src],{t:base.t,t0:base.t0,replacedFrom:src});
  }
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
    show("login",false); show("view-locked",false);
    $("app").classList.remove("is-locked");
    $("navLogout").classList.remove("hidden");
    /* #navUser/#navStatus were hardcoded "Papa"/"Signed in" and never touched
       by any code — the rail could not tell you which account you were on. */
    var email=session&&session.user?session.user.email:"";
    var nu=$("navUser");
    if(nu)nu.textContent=email?email.split("@")[0]:"Papa";
    var ns=$("navStatus");
    if(ns){ns.textContent=email||"Signed in";ns.title=email;}
    /* Re-route now that the shell is reachable — go() refused to leave
       view-locked while is-locked was set. */
    if(window.sqGo)window.sqGo((location.hash||"#today").slice(1));
    today=dayISO(0);
    $("boardDate").textContent=new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",timeZone:"Asia/Taipei"})+" · Asia/Taipei";
    updateNotifyState();
    await loadAll();
    subscribeRealtime();
  }

  async function loadAll(skipRouteRender){
    const start=dayISO(-13);
    const [ticks,totals,stats,ledger,asks,note,passes,photos,kids,history,helpClaims,familySettings,overrides,redos,acts,ledger14,photos14,asks14]=await Promise.all([
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
      client.from("act_done").select("*").eq("day",today),
      /* Reports say "last 14 days" but were computed from rows.ledger (150
         rows), rows.photos (80) and rows.asks (80) — recency windows, not date
         windows. On a busy fortnight those caps land well inside 14 days and
         every figure silently under-reports. These are date-bounded. */
      client.from("stars_ledger").select("kid_id,delta,created_at").gte("created_at",start).limit(5000),
      client.from("photos").select("kid_id,day").gte("day",start).lte("day",today).limit(5000),
      client.from("asks").select("kid_id,created_at").gte("created_at",start).limit(5000)
    ]);
    rows={
      ticks:ticks.data||[],totals:totals.data||[],stats:stats.data||[],ledger:ledger.data||[],asks:asks.data||[],
      passes:passes.data||[],photos:photos.data||[],kids:kids.data||[],history:history.data||[],helpClaims:helpClaims.data||[],
      familySettings:familySettings.data||[],redos:redos.data||[],acts:acts.data||[],
      ledger14:ledger14.data||[],photos14:photos14.data||[],asks14:asks14.data||[]
    };
    overridesRaw={};
    (overrides.data||[]).forEach(function(r){
      (overridesRaw[r.kid_id]=overridesRaw[r.kid_id]||{})[r.block_idx]=r.t;
    });
    /* Stamp the everyday template onto DAY before anything renders, so DAY[i].t
       is the real base a today-override is measured against. */
    SQTime.applyTemplate(DAY,templateMap());
    await repairTemplateMap();
    await repairReplacementMap();
    /* The note lives in module state, not in the DOM. Seeding #noteBody here
       silently did nothing: renderNote() creates that textarea, so on load it
       does not exist yet and the saved message never reached the editor. */
    setNote(note.data&&note.data.body?note.data.body:"");
    if(skipRouteRender){updateNavCounts();renderDockConversation();return;}
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
    /* Every render replaces whole subtrees, so a realtime event landing while
       Papa types wiped the field under the caret. preserveFocus restores the
       focused control, its value and its scroll position around the render. */
    if(window.preserveFocus)window.preserveFocus(function(){renderRoute(route);});
    else renderRoute(route);
  }

  function renderRoute(route){
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
      renderStarTotals();
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
    var all=queueRows();
    /* The chip filters the table only. Nav counts and the band keep reporting
       every open item, or filtering would look like the queue had drained. */
    var q=queueKid==="all"?all:all.filter(function(r){return r.kidId===queueKid;});
    if(!all.length){
      el.innerHTML='<div class="sheet__head"><h2>Waiting on you</h2><span class="tag tag--done">clear</span></div>'+
        '<div class="sheet__pad"><p class="tbl__note">Nothing waiting</p></div>';
      return;
    }
    function waitingTime(at){
      var ms=new Date()-new Date(at);
      var mins=Math.floor(ms/60000);
      if(mins<1)return "just now";
      if(mins<60)return mins+"m";
      return Math.floor(mins/60)+"h "+(mins%60)+"m";
    }
    el.innerHTML='<div class="sheet__head"><h2>Waiting on you</h2><span class="tag tag--now">'+all.length+' open</span>'+
      (queueKid==="all"?"":'<span class="tbl__note">showing '+q.length+' for '+esc(kidName(queueKid))+'</span>')+
      '<div class="sheet__tools"><div class="chips" role="group" aria-label="Filter queue" id="queueKidFilter"></div></div></div>'+
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

    /* Kid filter chips. These rendered with a hardcoded aria-pressed="false"
       and no click handler at all — three chips that did nothing. */
    var kf=$("queueKidFilter");
    if(kf){
      kf.innerHTML='<button class="chip'+(queueKid==="all"?'" aria-pressed="true"':'')+'" data-queuekid="all">All</button>'+
        Object.entries(KIDS).map(function(e){
          var on=queueKid===e[0];
          return '<button class="chip'+(on?'" aria-pressed="true"':'')+'" data-queuekid="'+e[0]+'"><span class="chip__dot" style="background:var(--kid-'+e[0]+')"></span>'+esc(e[1].name)+'</button>';
        }).join("");
      kf.querySelectorAll("[data-queuekid]").forEach(function(b){
        b.onclick=function(){queueKid=b.dataset.queuekid;renderQueue();};
      });
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
  /* Times as the current scope sees them. In template scope there are no
     day-overrides to layer — DAY already carries the template. */
  function scopeEff(){
    if(boardScope==="template")return {};
    return SQTime.resolveOverrides(overridesRaw,boardScope==="all"?null:boardScope,DAY);
  }
  function scopeLabel(){
    if(boardScope==="template")return "every day";
    return boardScope==="all"?"everyone today":kidName(boardScope)+" today";
  }

  function renderOverview(){
    var el=$("overview");
    if(!el)return;
    if(timeDrag||blockDrag)return; /* a live drag owns the DOM until the finger lifts */
    renderBoardScope();
    var eff=scopeEff();
    var info=SQTime.timelineInfo(DAY,eff,SQ_DAY.nowMins());
    el.innerHTML='<div class="board">'+
      '<div class="board__h" data-kid="all"><span class="lbl">Time</span><span class="lbl board__scope">'+esc(scopeLabel())+'</span></div>'+
      Object.keys(KIDS).map(function(id){
        var k=KIDS[id];
        var stars=(rows.totals.find(function(t){return t.kid_id===id;})||{}).stars||0;
        return '<div class="board__h"><span class="who k-'+id+'"><span class="who__m">'+esc(k.name[0])+'</span><b>'+esc(k.name)+'</b></span><span class="star">'+stars+' ⭐</span></div>';
      }).join("")+
      SQTime.displayOrder(DAY,eff).map(function(i){
        var rowsHtml=boardTime(i,eff,info);
        Object.keys(KIDS).forEach(function(kid){
          rowsHtml+=boardCell(kid,i);
        });
        return rowsHtml;
      }).join("")+
    '</div>';
    bindScheduleBlocks();
    bindTimeEdit();
  }

  /* The time gutter is the schedule editor. The grip ripple-drags this block
     and every later one (running late moves the rest of the day, and no two
     blocks can ever collide); the field sets this one block alone. */
  function boardTime(i,eff,info){
    var mins=SQTime.effMins(DAY,eff,i);
    var moved=boardScope==="template"?(DAY[i].t0!==undefined&&DAY[i].t!==DAY[i].t0):eff[i]!=null;
    var label=blockTitle(i);
    var body=mins==null
      ? '<span class="board__fixed">'+esc(DAY[i].t||"--")+'</span>'
      : '<span class="board__grab" data-tdrag="'+i+'" tabindex="0" role="button" '+
          'aria-label="'+esc(label)+' starts '+clock(mins)+'. Drag or use arrow keys to move this and every later block."'+
          '><span class="board__grip" aria-hidden="true">⋮⋮</span><b data-tclock="'+i+'">'+clock(mins)+'</b></span>'+
        '<input class="board__time" type="time" step="300" value="'+clock(mins)+'" data-tset="'+i+'" aria-label="Set start time for '+esc(label)+'">';
    return '<div class="board__t'+(i===info.current?" is-now":"")+'">'+body+
      '<small>'+esc(label)+'</small>'+
      (moved?'<em class="board__moved">'+(boardScope==="template"?"changed":"moved")+'</em>':'')+
    '</div>';
  }

  function renderBoardScope(){
    var el=$("boardScope");
    if(!el)return;
    el.innerHTML='<span class="lbl">Change times for</span>'+
      BOARD_SCOPES.map(function(s){
        return '<button class="chip" data-bscope="'+s[0]+'" aria-pressed="'+(boardScope===s[0])+'">'+esc(s[1])+'</button>';
      }).join("")+
      '<span class="board__sep" aria-hidden="true"></span>'+
      '<button class="chip" data-bscope="template" aria-pressed="'+(boardScope==="template")+'" title="Edits the everyday plan, not just today">Every day</button>';
    el.querySelectorAll("[data-bscope]").forEach(function(b){
      b.onclick=function(){boardScope=b.dataset.bscope;renderOverview();};
    });
  }

  function scheduleOrder(kid){
    return SQTime.displayOrder(DAY,SQTime.resolveOverrides(overridesRaw,kid,DAY));
  }

  function boardCell(kid,i){
    var eff=SQTime.resolveOverrides(overridesRaw,kid,DAY);
    var timed=SQTime.effMins(DAY,eff,i)!=null;
    var removed=passFor(kid,i,"outing");
    return '<div class="cell '+cellStateClass(kid,i)+'" data-kid="'+kid+'" data-slot="'+i+'" data-block="'+i+'" data-movable="'+(timed&&!removed?"true":"false")+'" draggable="false">'+
      boardCellInner(kid,i,i)+
    '</div>';
  }

  function cellStateClass(kid,i){
    var eff=SQTime.resolveOverrides(overridesRaw,kid,DAY);
    var mins=SQTime.effMins(DAY,eff,i), timed=mins!=null;
    var info=SQTime.timelineInfo(DAY,eff,SQ_DAY.nowMins());
    var removed=passFor(kid,i,"outing");
    var done=tickFor(kid,i);
    return removed?"is-off":done?"is-done":timed&&i===info.current?"is-now":"";
  }

  function boardCellInner(kid,i,displayIdx){
    var b=effectiveBlock(kid,displayIdx), eff=SQTime.resolveOverrides(overridesRaw,kid,DAY);
    var mins=SQTime.effMins(DAY,eff,i), timed=mins!=null;
    var info=SQTime.timelineInfo(DAY,eff,SQ_DAY.nowMins());
    var moved=(overridesRaw[kid]||{})[i]!=null;
    var replaced=replacementSource(kid,displayIdx)!=null;
    var removed=passFor(kid,i,"outing");
    var done=tickFor(kid,i);
    var redo=rows.redos.some(function(r){return r.kid_id===kid&&r.block_idx===i;});
    var isNow=i===info.current;
    var isLate=timed&&mins<info.now&&!done&&!removed;
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
    actions+='<button class="btn btn--sm" data-replaceblock="'+kid+':'+i+'" title="Replace this block">Replace</button>';

    /* The kid chip is hidden on the wide grid (the column header names them) but
       shown once the board stacks to one column, where a bare cell is otherwise
       unattributable. Colour never carries the meaning alone. */
    return '<span class="cell__grab" aria-hidden="true">::</span>'+
      '<span class="who k-'+kid+' cell__who"><span class="who__m">'+esc(kidName(kid)[0])+'</span><b>'+esc(kidName(kid))+'</b></span>'+
      '<div class="cell__t">'+esc(b.title)+' <span>'+esc(b.tz)+'</span>'+(moved?' <span class="cell__moved">moved</span>':'')+(replaced?' <span class="cell__moved">replaced</span>':'')+'</div>'+
      '<div class="cell__b">'+statusTag+
      '<div class="cell__acts">'+actions+'</div></div>';
  }

  function bindScheduleBlocks(){
    document.querySelectorAll("[data-accept]").forEach(function(b){b.onclick=function(){
      var parts=b.dataset.accept.split(":");acceptBlock(parts[0],+parts[1]);
    };});
    document.querySelectorAll("[data-unaccept]").forEach(function(b){b.onclick=function(){
      var parts=b.dataset.unaccept.split(":");unacceptBlock(parts[0],+parts[1],null);
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
    document.querySelectorAll("[data-replaceblock]").forEach(function(b){b.onclick=function(e){
      e.stopPropagation();
      var parts=b.dataset.replaceblock.split(":");openBlockLibrary(parts[0],+parts[1]);
    };});
    /* Pointer reorder with live slot preview. HTML5 drag only changed after drop
       and is unreliable on tablets; pointer events cover mouse, pen and touch. */
    document.querySelectorAll(".cell").forEach(function(cell){
      cell.onpointerdown=function(e){
        if(e.button||inBoardControl(e.target))return;
        var canMove=cell.dataset.movable==="true";
        var startX=e.clientX,startY=e.clientY,kid=cell.dataset.kid,from=+cell.dataset.block,moved=false,to=from;
        dragState={kid:kid,block:from};
        cell.setPointerCapture(e.pointerId);
        cell.onpointermove=function(ev){
          if(!canMove)return;
          var dist=Math.abs(ev.clientX-startX)+Math.abs(ev.clientY-startY);
          if(dist<8)return;
          moved=true;
          ev.preventDefault();
          if(!blockDrag){
            blockDrag={kid:kid,from:from,to:from};
            cell.classList.add("is-dragging");
          }
          var target=document.elementFromPoint(ev.clientX,ev.clientY);
          target=target&&target.closest?target.closest(".cell[data-movable=true]"):null;
          if(!target||target.dataset.kid!==kid)return;
          var next=+target.dataset.block;
          if(next===to)return;
          to=next;
          blockDrag.to=to;
          previewDraggedOrder(kid,from,to);
        };
        cell.onpointerup=cell.onpointercancel=function(ev){
          cell.onpointermove=cell.onpointerup=cell.onpointercancel=null;
          cell.classList.remove("is-dragging");
          clearDropTargets();
          var finalTo=to;
          var didMove=moved&&finalTo!==from;
          blockDrag=null; dragState=null;
          if(ev&&ev.type==="pointercancel"){renderOverview();return;}
          if(didMove)saveDraggedOrder(kid,from,finalTo);
          else openBlockLibrary(kid,from);
        };
      };
      /* Keyboard reorder */
      cell.onkeydown=function(e){
        if(cell.dataset.movable!=="true")return;
        if(e.key==="ArrowUp"||e.key==="ArrowDown"){
          e.preventDefault();
          var kid=cell.dataset.kid, from=+cell.dataset.block;
          var order=scheduleOrder(kid).filter(function(i){return SQTime.effMins(DAY,SQTime.resolveOverrides(overridesRaw,kid,DAY),i)!=null&&!passFor(kid,i,"outing");});
          var idx=order.indexOf(from);
          if(e.key==="ArrowUp"&&idx>0)saveDraggedOrder(kid,from,order[idx-1]);
          if(e.key==="ArrowDown"&&idx<order.length-1)saveDraggedOrder(kid,from,order[idx+1]);
        }
      };
      cell.setAttribute("tabindex","0");
      cell.setAttribute("aria-label","Block: "+blockTitle(+cell.dataset.block)+" for "+kidName(cell.dataset.kid)+" - click to replace, drag or use Arrow keys to reorder");
    });
  }

  function inBoardControl(el){
    for(;el&&el.classList&&!el.classList.contains("cell");el=el.parentNode)
      if(/^(BUTTON|LABEL|INPUT|A|SELECT|TEXTAREA)$/.test(el.tagName))return true;
    return false;
  }

  function clearDropTargets(){
    document.querySelectorAll(".is-drop-target").forEach(function(x){x.classList.remove("is-drop-target");});
  }

  function movableOrder(kid){
    return scheduleOrder(kid).filter(function(i){
      return SQTime.effMins(DAY,SQTime.resolveOverrides(overridesRaw,kid,DAY),i)!=null&&!passFor(kid,i,"outing");
    });
  }

  function previewDraggedOrder(kid,fromBlock,toBlock){
    clearDropTargets();
    const cells=Array.from(document.querySelectorAll('.cell[data-kid="'+kid+'"][data-movable=true]'));
    const slots=cells.map(function(cell){return +cell.dataset.block;});
    const order=slots.slice();
    const from=order.indexOf(fromBlock), to=order.indexOf(toBlock);
    if(from<0||to<0)return;
    order.splice(to,0,order.splice(from,1)[0]);
    cells.forEach(function(cell,n){
      var slot=+cell.dataset.slot;
      cell.innerHTML=boardCellInner(kid,slot,order[n]);
      cell.classList.toggle("is-drop-target",+cell.dataset.block===toBlock);
    });
  }

  function closeBlockLibrary(){
    var el=document.getElementById("blockLibrary");
    if(el)el.remove();
  }

  function openBlockLibrary(kid,i){
    closeBlockLibrary();
    var current=effectiveBlock(kid,i);
    var currentSrc=replacementSource(kid,i);
    var dialog=document.createElement("div");
    dialog.className="block-picker";
    dialog.id="blockLibrary";
    dialog.setAttribute("role","dialog");
    dialog.setAttribute("aria-modal","true");
    dialog.setAttribute("aria-label","Replace block");
    dialog.innerHTML=
      '<div class="block-picker__panel">'+
        '<div class="sheet__head"><h2>Replace block</h2><span class="lbl">'+esc(kidName(kid))+' today</span>'+
          '<div class="sheet__tools"><button class="btn btn--sm" data-blockclose>Close</button></div></div>'+
        '<div class="block-picker__current">'+
          '<span class="block-picker__icon">'+esc(current.icon||"")+'</span>'+
          '<div><b>'+esc(current.title||"Block")+'</b><span>'+esc(current.tz||"")+'</span></div>'+
        '</div>'+
        '<div class="block-picker__grid">'+
          '<button class="block-choice'+(currentSrc==null?' is-selected':'')+'" data-blockpick="-1">'+
            '<span class="block-choice__icon">Reset</span><b>Original slot</b><small>'+esc(DAY[i].title)+' &middot; '+esc(DAY[i].tz||"")+'</small></button>'+
          DAY.map(function(b,idx){
            return '<button class="block-choice'+(currentSrc===idx?' is-selected':'')+'" data-blockpick="'+idx+'">'+
              '<span class="block-choice__icon">'+esc(b.icon||"")+'</span><b>'+esc(b.title)+'</b><small>'+esc(b.tz||"")+'</small></button>';
          }).join("")+
        '</div>'+
      '</div>';
    document.body.appendChild(dialog);
    dialog.querySelector("[data-blockclose]").onclick=closeBlockLibrary;
    dialog.onclick=function(e){if(e.target===dialog)closeBlockLibrary();};
    dialog.querySelectorAll("[data-blockpick]").forEach(function(b){
      b.onclick=function(){saveBlockReplacement(kid,i,+b.dataset.blockpick);};
    });
    var first=dialog.querySelector(".block-choice.is-selected")||dialog.querySelector(".block-choice");
    if(first)first.focus();
  }

  async function saveBlockReplacement(kid,i,src){
    var key=replaceKey();
    var map=replacementMap();
    var bucket=map[kid]=map[kid]||{};
    if(src<0||src===i)delete bucket[i];
    else bucket[i]=src;
    if(!Object.keys(bucket).length)delete map[kid];
    suppressRealtime("family_settings",{key:key});
    const {error}=await client.from("family_settings")
      .upsert({key:key,value:JSON.stringify(map),updated_at:new Date().toISOString()});
    if(error){writeFailed(error);return;}
    var row=rows.familySettings.find(function(x){return x.key===key;});
    if(row)row.value=JSON.stringify(map); else rows.familySettings.push({key:key,value:JSON.stringify(map)});
    closeBlockLibrary();
    toast(src<0||src===i?"Block restored":"Block replaced",true);
    renderOverview();
  }

  /* ---- Time gutter: ripple drag + precise field ---- */

  function rippleFrom(i,eff){return SQTime.ripple(DAY,eff,i);}

  function previewRipple(rip,delta){
    rip.group.forEach(function(x){
      var el=document.querySelector('[data-tclock="'+x.i+'"]');
      if(el)el.textContent=clock(x.t+delta);
    });
  }

  function bindTimeEdit(){
    document.querySelectorAll("[data-tdrag]").forEach(function(grab){
      grab.onpointerdown=function(e){
        if(e.button)return;
        var rip=rippleFrom(+grab.dataset.tdrag,scopeEff());
        if(!rip)return;
        e.preventDefault();
        timeDrag=rip;
        var y0=e.clientY, delta=0;
        grab.setPointerCapture(e.pointerId);
        grab.classList.add("is-dragging");
        grab.onpointermove=function(ev){
          delta=SQTime.clampDelta(rip,Math.round((ev.clientY-y0)/DRAG_PX/5)*5);
          previewRipple(rip,delta);
        };
        grab.onpointerup=grab.onpointercancel=function(){
          grab.onpointermove=grab.onpointerup=grab.onpointercancel=null;
          grab.classList.remove("is-dragging");
          timeDrag=null;
          if(delta)shiftRipple(rip,delta); else renderOverview();
        };
      };
      /* Same ripple, 5 minutes a press — the coarse-pointer and keyboard path. */
      grab.onkeydown=function(e){
        if(e.key!=="ArrowUp"&&e.key!=="ArrowDown")return;
        e.preventDefault();
        var rip=rippleFrom(+grab.dataset.tdrag,scopeEff());
        if(!rip)return;
        var delta=SQTime.clampDelta(rip,e.key==="ArrowUp"?-5:5);
        if(delta)shiftRipple(rip,delta);
      };
    });
    document.querySelectorAll("[data-tset]").forEach(function(inp){
      inp.onchange=function(){
        var mins=SQTime.parseMins(inp.value);
        if(mins==null){renderOverview();return;}
        saveTimes([{i:+inp.dataset.tset,t:mins}]);
      };
    });
  }

  function shiftRipple(rip,delta){
    saveTimes(rip.group.map(function(x){return {i:x.i,t:x.t+delta};}));
  }

  /* One write path for both scopes: today's day_overrides row per block, or a
     single template map covering every day from now on. */
  async function saveTimes(entries){
    if(!entries.length)return;
    if(boardScope==="template")return saveTemplateTimes(entries);
    var kid=boardScope;
    const results=await Promise.all(entries.map(function(e){
      return saveBlockTime(kid,e.i,clock(e.t),true);
    }));
    const err=results.find(function(r){return r&&r.error;});
    if(err){writeFailed(err.error);return;}
    toast(entries.length>1?`Day shifted — ${scopeLabel()}`:`Time saved — ${scopeLabel()}`,true);
    await loadAll();
  }

  async function saveTemplateTimes(entries){
    var map=templateMap();
    entries.forEach(function(e){
      var v=clock(e.t);
      if(SQTime.parseMins(v)===SQTime.parseMins(DAY[e.i].t0))delete map[e.i];
      else map[e.i]=v;
    });
    const {error}=await client.from("family_settings")
      .upsert({key:TEMPLATE_KEY,value:JSON.stringify(map),updated_at:new Date().toISOString()});
    if(error){writeFailed(error);return;}
    toast("Saved for every day from now on",true);
    await loadAll();
  }

  async function saveDraggedOrder(kid,fromBlock,toBlock){
    if(fromBlock===toBlock)return;
    const order=movableOrder(kid);
    const from=order.indexOf(fromBlock), to=order.indexOf(toBlock);
    if(from<0||to<0)return;
    order.splice(to,0,order.splice(from,1)[0]);
    const eff=SQTime.resolveOverrides(overridesRaw,kid,DAY);
    const slots=order.map(function(i){return SQTime.effMins(DAY,eff,i);}).sort(function(a,b){return a-b;});
    const jobs=order.map(function(i,n){return saveBlockTime(kid,i,clock(slots[n]),true);});
    const results=await Promise.all(jobs);
    const err=results.find(function(r){return r&&r.error;});
    if(err){writeFailed(err.error);renderOverview();return;}
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

  /* Revoking a block star is a delete of the one row that block can own, never a
     -1 insert. A -1 was wrong twice over: it fired whether or not a +1 had ever
     been granted (the kid's own tick grants directly from the tablet, so most
     blocks Papa sees were never granted here), and it matched on the block's
     CURRENT kind and title, so replacing a block between accept and undo
     refunded the wrong thing. Deleting the id is exact and a no-op when there is
     nothing to take back. See js/star-id.js. */
  async function dropStars(ids){
    var real=ids.filter(Boolean);
    if(!real.length)return null;
    const {error}=await client.from("stars_ledger").delete().in("id",real);
    return error||null;
  }

  /* 23505 means someone already granted this exact star — the kid's tablet on
     tick, or Papa a moment ago. Same star, not a second one. */
  async function grantStarRows(grants){
    var real=grants.filter(Boolean);
    if(!real.length)return null;
    const {error}=await client.from("stars_ledger").upsert(real,{onConflict:"id",ignoreDuplicates:true});
    return error||null;
  }

  function blockStarGrant(kid,i,reason){
    var b=effectiveBlock(kid,i);
    if(!SQStarId.blockDelta(b))return null;
    return {id:SQStarId.block(kid,today,i),kid_id:kid,delta:SQStarId.blockDelta(b),
      reason:reason||`Admin accepted: ${b.title}`,source:"admin",granted_by:session.user.id};
  }

  /* The day-complete bonus is a fact about the covered set, not an event. Every
     path that changes what is covered re-derives it here, so it can neither
     survive the day falling apart nor stay missing after the last block lands —
     and because it is keyed by id, re-deriving it twice is still one star. */
  async function syncDayBonus(kid,covered){
    return covered.size>=DAY.length
      ? grantStarRows([{id:SQStarId.bonus(kid,today),kid_id:kid,delta:SQStarId.BONUS_DELTA,
          reason:"Day-complete bonus",source:"admin",granted_by:session.user.id}])
      : dropStars([SQStarId.bonus(kid,today)]);
  }

  async function acceptBlock(kid,i){
    if(passFor(kid,i,"outing"))return;
    suppressRealtime("day_ticks",{kid_id:kid,day:today,block_idx:i});
    /* upsert, not insert: a tick the kid made a second ago is the same fact, and
       the 23505 it used to raise aborted the call here — block left accepted,
       star never granted. Accepting an already-ticked block now repairs it. */
    const {error}=await client.from("day_ticks").upsert({kid_id:kid,day:today,block_idx:i});
    if(error){writeFailed(error);return;}
    await client.from("day_redos").delete().eq("kid_id",kid).eq("day",today).eq("block_idx",i);
    var err=await grantStarRows([blockStarGrant(kid,i)]);
    if(err){writeFailed(err);return;}
    err=await syncDayBonus(kid,new Set([...coveredSet(kid),i]));
    if(err){writeFailed(err);return;}
    toast(`Accepted ✓ ${kidName(kid)} — ${effectiveBlock(kid,i).title}`,true);
    await loadAll();
  }

  /* redoNote is a string only for Send back. The Undo button passes false and
     the old `!= null` let it through, so every plain Undo also wrote a redo row
     — tagging the block "Sent back" and locking the kid's games (js/lock-core.js). */
  async function unacceptBlock(kid,i,redoNote){
    const sentBack=typeof redoNote==="string";
    suppressRealtime("day_ticks",{kid_id:kid,day:today,block_idx:i});
    const {error}=await client.from("day_ticks").delete().eq("kid_id",kid).eq("day",today).eq("block_idx",i);
    if(error){writeFailed(error);return;}
    var err=await dropStars([SQStarId.block(kid,today,i)]);
    if(err){writeFailed(err);return;}
    var after=coveredSet(kid);
    after.delete(i);
    if(rows.passes.some(function(p){return p.kid_id===kid&&p.day===today&&p.block_idx===i&&["granted","spent"].includes(p.status);}))after.add(i);
    err=await syncDayBonus(kid,after);
    if(err){writeFailed(err);return;}
    if(sentBack){
      const r=await client.from("day_redos").upsert({kid_id:kid,day:today,block_idx:i,note:redoNote});
      if(r.error){writeFailed(r.error);return;}
    }
    toast(`${sentBack?"Sent back":"Acceptance undone"} — ${kidName(kid)}`,true);
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
      /* Same id and same amount as the block's own star: "removed but still
         counts" is that block's one star, so removing twice — or removing a
         block the kid had already ticked — cannot stack a second one, and a
         routine block stays worth what Accept says it is worth. */
      const err=await grantStarRows([blockStarGrant(kid,i,`Removed block counts: ${effectiveBlock(kid,i).title}`)]);
      if(err){writeFailed(err);return;}
    }
    /* An outing pass covers the block whether or not it was credited, so the
       day can complete on a removal — reconcile either way. */
    const errB=await syncDayBonus(kid,new Set([...coveredSet(kid),i]));
    if(errB){writeFailed(errB);return;}
    toast(`Removed — ${kidName(kid)} ${effectiveBlock(kid,i).title}`,true);
    await loadAll();
  }

  async function addBackBlock(passId,kid,i,credited){
    const r1=await client.from("passes").delete().eq("id",passId);
    if(r1.error){writeFailed(r1.error);return;}
    /* Only take the star back if the pass is the only thing holding it. A kid
       who ticked the block while it was removed earned that same id honestly. */
    if(credited&&!tickFor(kid,i)){
      const err=await dropStars([SQStarId.block(kid,today,i)]);
      if(err){writeFailed(err);return;}
    }
    var after=coveredSet(kid);
    if(!tickFor(kid,i))after.delete(i);
    const errB=await syncDayBonus(kid,after);
    if(errB){writeFailed(errB);return;}
    toast(`Added back — ${kidName(kid)} ${effectiveBlock(kid,i).title}`,true);
    await loadAll();
  }

  async function resetAcceptedDay(){
    const ticks=rows.ticks.filter(function(t){return t.day===today;});
    var drop=[];
    Object.keys(KIDS).forEach(function(kid){
      ticks.filter(function(t){return t.kid_id===kid;})
        .forEach(function(t){drop.push(SQStarId.block(kid,today,t.block_idx));});
      var passOnly=new Set(rows.passes.filter(function(p){return p.kid_id===kid&&p.day===today&&["granted","spent"].includes(p.status);}).map(function(p){return p.block_idx;}));
      if(passOnly.size<DAY.length)drop.push(SQStarId.bonus(kid,today));
    });
    if(ticks.length){
      const r1=await client.from("day_ticks").delete().eq("day",today);
      if(r1.error){writeFailed(r1.error);return;}
    }
    const resetResults=await Promise.all([
      client.from("day_redos").delete().eq("day",today),
      client.from("day_overrides").delete().eq("day",today),
      client.from("family_settings").upsert({
        key:replaceKey(),
        value:JSON.stringify({_v:2}),
        updated_at:new Date().toISOString()
      })
    ]);
    const resetError=resetResults.find(function(r){return r.error;});
    if(resetError){writeFailed(resetError.error);return;}
    {
      const err=await dropStars(drop);
      if(err){writeFailed(err);return;}
    }
    toast("Day reset — original activities and times restored",true);
    await loadAll();
  }

  /* ---- Star totals band ---- */
  function renderStarTotals(){
    var el=$("starTotals");
    if(!el)return;
    var todayStr=today;
    el.innerHTML='<div class="band band--3">'+Object.entries(KIDS).map(function(e){
      var id=e[0], k=e[1];
      /* Still the sum of the ledger — read off the star_totals view, never a
         counter we keep ourselves. */
      var stars=(rows.totals.find(function(t){return t.kid_id===id;})||{}).stars||0;
      var todayRows=rows.ledger.filter(function(r){return r.kid_id===id&&String(r.created_at||"").slice(0,10)===todayStr;});
      var gained=todayRows.filter(function(r){return r.delta>0;}).reduce(function(s,r){return s+r.delta;},0);
      var lost=todayRows.filter(function(r){return r.delta<0;}).reduce(function(s,r){return s+r.delta;},0);
      return '<div class="k-'+id+'"><span class="lbl"><span class="who__m">'+esc(k.name[0])+'</span> '+esc(k.name)+'</span>'+
        '<span class="band__v"><b class="num star">'+stars+'</b><span>⭐ total</span></span>'+
        '<span class="band__sub">'+(gained?"+"+gained:"0")+' today'+(lost?" · "+lost+" revoked":"")+' · '+todayRows.length+' row'+(todayRows.length===1?"":"s")+'</span></div>';
    }).join("")+'</div>';
  }

  /* ---- Grants (per-kid reason) ---- */
  function renderGrants(){
    var el=$("grants");
    if(!el)return;
    el.innerHTML=Object.entries(KIDS).map(function(e){
      var id=e[0], k=e[1];
      var stars=(rows.totals.find(function(t){return t.kid_id===id;})||{}).stars||0;
      return '<div class="grant k-'+id+'">'+
        '<span class="grant__who"><span class="who k-'+id+'"><span class="who__m">'+esc(k.name[0])+'</span><b>'+esc(k.name)+'</b></span>'+
        '<b class="star num grant__total">'+stars+' ⭐</b></span>'+
        '<label><span class="lbl" style="display:block;margin-bottom:4px">Reason (goes in the ledger)</span>'+
        '<input class="inp" id="grantReason-'+id+'" placeholder="e.g. helped with the dishes"></label>'+
        '<span class="grant__n">'+
          '<button class="btn btn--danger btn--sm" data-grant="'+id+'" data-delta="-1">−1</button>'+
          '<button class="btn btn--sm btn--primary" data-grant="'+id+'" data-delta="1">+1</button>'+
          '<button class="btn btn--sm" data-grant="'+id+'" data-delta="2">+2</button>'+
          '<button class="btn btn--sm" data-grant="'+id+'" data-delta="3">+3</button>'+
          /* Custom amount is per-kid, like the reason. The old shared
             #grantAmount meant typing a number for one kid and tapping ±
             on another applied it to whoever you tapped. */
          '<input class="inp num grant__amt" id="grantAmount-'+id+'" type="number" min="-20" max="20" step="1" placeholder="±" aria-label="Custom amount for '+esc(k.name)+'">'+
          '<button class="btn btn--sm" data-grantcustom="'+id+'" title="Grant the custom amount">Apply</button>'+
        '</span></div>';
    }).join("");
    document.querySelectorAll("[data-grant]").forEach(function(b){
      b.onclick=function(){grantStars(b.dataset.grant,+b.dataset.delta);};
    });
    document.querySelectorAll("[data-grantcustom]").forEach(function(b){
      b.onclick=function(){
        var id=b.dataset.grantcustom;
        var field=$("grantAmount-"+id);
        var v=Math.round(+(field&&field.value)||0);
        if(!v){toast("Type a custom amount first",false);return;}
        if(v<-20||v>20){toast("Custom amount must be between −20 and 20",false);return;}
        grantStars(id,v);
      };
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
    var amt=$("grantAmount-"+kid);
    if(amt)amt.value="";
    await loadAll();
  }

  /* ---- Ledger ---- */
  var ledgerFilter={kid:"all",kind:"all",todayOnly:false};
  const STAR_KINDS=[
    {key:"unlabelled",label:"Unlabelled",test:function(r){return /^Unlabelled|^App progress/.test(r);}},
    {key:"revoked",   label:"Revoked",   test:function(r){return /^Revoked|^Star reset|^Day reset|^Day-complete bonus undone/.test(r);}},
    {key:"mission",   label:"Mission",   test:function(r){return /^Block |^Mission |^My Day mission|^Admin accepted:/.test(r);}},
    {key:"practice",  label:"Practice",  test:function(r){return /^Practice /.test(r);}},
    {key:"activity",  label:"Activity",  test:function(r){return /^Activity /.test(r);}},
    {key:"learn",     label:"Learn",     test:function(r){return /^Learn /.test(r);}},
    {key:"bonus",     label:"Bonus",     test:function(r){return /^Bonus |^Day complete|^Day-complete bonus/.test(r);}},
    {key:"outing",    label:"Outing",    test:function(r){return /^Outing |^Removed block/.test(r);}},
    {key:"captain",   label:"Captain",   test:function(r){return /^captain help/i.test(r);}}
  ];
  function starKind(r){
    var reason=String((r&&r.reason)||"");
    var hit=STAR_KINDS.find(function(k){return k.test(reason);});
    if(hit)return hit;
    return {key:r&&r.source==="admin"?"papa":"other",label:r&&r.source==="admin"?"Papa":"Other"};
  }

  function scheduleStarInfo(r){
    if(!r||r.delta<=0||!window.SQStarId||typeof SQStarId.parse!=="function")return null;
    var info=SQStarId.parse(r.id);
    return info&&info.kid===r.kid_id?info:null;
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
      '<th style="width:110px">When</th><th style="width:130px">Kid</th><th style="width:64px;text-align:right">Δ</th><th>Reason</th><th style="width:110px">Source</th><th style="width:86px"></th>'+
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
    if(scheduleStarInfo(r))return '<button class="btn btn--sm btn--danger" data-dropstar="'+r.id+'" title="Revoke schedule star">Undo</button>';
    if(r.source==="admin")return '<button class="btn btn--sm btn--danger" data-delstar="'+r.id+'" title="Undo">Undo</button>';
    return r.delta>0?'<button class="btn btn--sm btn--danger" data-revokestar="'+r.id+'" title="Revoke">Undo</button>':"";
  }

  function bindLedgerActions(){
    document.querySelectorAll("[data-dropstar]").forEach(function(b){
      b.onclick=async function(){
        /* A block's star and its tick are one fact. Deleting only the ledger row
           left the block still reading "Accepted" with nothing behind it, no way
           to re-earn it (Accept is not offered on an accepted block) and the
           block's own Undo standing by to take a second star. Same operation,
           whichever screen Papa reaches for. Only today's board is loaded, so an
           older day's star is still a plain delete. */
        var info=SQStarId.parse(b.dataset.dropstar);
        if(info&&info.kind==="block"&&info.day===today){
          await unacceptBlock(info.kid,info.slot,null);
          return;
        }
        const {error}=await client.from("stars_ledger").delete().eq("id",b.dataset.dropstar);
        if(error){writeFailed(error);return;}
        toast("Schedule star revoked",true);
        await loadAll();
      };
    });
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
    el.innerHTML=recent.length?'<table class="tbl"><thead><tr><th style="width:74px">Time</th><th style="width:130px">Kid</th><th style="width:64px;text-align:right">Δ</th><th>Reason</th><th style="width:110px">Source</th><th style="width:86px"></th></tr></thead><tbody>'+
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

  /* ---- Voice chips ---- */
  const fmtDur=sec=>isFinite(sec)&&sec>0?Math.floor(sec/60)+":"+String(Math.round(sec%60)).padStart(2,"0"):"";

  function primeDuration(url){
    if(!url||url in audioDur)return;
    audioDur[url]="";                       /* in flight — chip shows its fallback */
    const probe=new Audio();
    probe.preload="metadata";
    probe.onloadedmetadata=function(){audioDur[url]=fmtDur(probe.duration);paintVoiceChips();};
    probe.onerror=function(){audioDur[url]="";};
    probe.src=url;
  }

  function paintVoiceChips(){
    document.querySelectorAll("[data-play]").forEach(function(b){
      const d=audioDur[b.dataset.play], t=b.querySelector(".voice__t");
      if(d&&t)t.textContent=d;
    });
  }

  function paintVoiceState(){
    document.querySelectorAll("[data-play]").forEach(function(b){
      const on=chatAudioUrl===b.dataset.play&&!!chatAudio&&!chatAudio.paused;
      b.classList.toggle("is-playing",on);
      const i=b.querySelector(".voice__i");
      if(i)i.textContent=on?"❚❚":"▶";
      b.setAttribute("aria-label",(on?"Pause":"Play")+" voice note");
    });
  }

  function toggleVoice(url){
    if(chatAudio&&chatAudioUrl===url&&!chatAudio.paused){chatAudio.pause();paintVoiceState();return;}
    if(chatAudio)chatAudio.pause();
    chatAudio=new Audio(url);
    chatAudioUrl=url;
    chatAudio.onended=paintVoiceState;
    chatAudio.onpause=paintVoiceState;
    chatAudio.play().then(paintVoiceState).catch(function(){toast("Could not play that voice note",false);});
  }

  function voiceChipHtml(url,fallback){
    if(!url)return "";
    primeDuration(url);
    const on=chatAudioUrl===url&&!!chatAudio&&!chatAudio.paused;
    return '<button class="btn btn--sm voice'+(on?" is-playing":"")+'" data-play="'+esc(url)+'" aria-label="'+(on?"Pause":"Play")+' voice note">'+
      '<span class="voice__i" aria-hidden="true">'+(on?"❚❚":"▶")+'</span>'+
      '<span class="voice__t">'+esc(audioDur[url]||fallback||"Voice")+'</span></button>';
  }

  /* ---- Day dividers ---- */
  const dayOf=ts=>window.SQ_DAY?SQ_DAY.iso(new Date(ts)):String(ts).slice(0,10);
  function dayLabel(iso){
    const pretty=new Date(iso+"T12:00:00").toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
    return iso===today?"Today · "+pretty:pretty;
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

    var filters={
      kid:chatFilters.kid,
      types:chatFilters.types,
      needs:chatFilters.needs,
      archived:showArchived
    };
    var visible=SQChat.filterStream(stream,filters);

    var pin=$("chatPin");
    if(pin){
      /* Read module state, not #noteBody — that textarea only exists while the
         Content route is rendered, so the pin always read empty elsewhere. */
      var noteText=papaNote.en.trim()||papaNote.zh.trim();
      pin.innerHTML=noteText
        ?'<span class="lbl">Pinned</span><p>'+esc(noteText)+' <button class="btn btn--sm btn--quiet" data-goto="content" style="height:20px;padding:0 5px">Edit</button></p>'
        :'<span class="lbl">Pinned</span><p style="color:var(--text-3)">No message for today yet <button class="btn btn--sm btn--quiet" data-goto="content" style="height:20px;padding:0 5px">Write</button></p>';
    }

    /* A composer left open on a row the filters just hid would keep typing state
       for something Papa can no longer see. */
    if(openReplyId&&!visible.some(function(r){return r.srcId===openReplyId&&r.type==="ask";}))openReplyId=null;

    box.innerHTML=visible.length
      ?streamHtml(visible)
      :'<p class="chat-empty">Nothing here <button class="btn btn--sm" id="chatClearFilters">Clear filters</button></p>';

    var clear=$("chatClearFilters");
    if(clear)clear.onclick=function(){
      chatFilters={kid:"all",types:["ask","claim","pass"],needs:false};
      saveChatFilters();renderDockConversation();
    };

    document.querySelectorAll("[data-play]").forEach(function(b){b.onclick=function(){toggleVoice(b.dataset.play);};});
    document.querySelectorAll("[data-replytoggle]").forEach(function(b){
      b.onclick=function(){openReply(b.dataset.replytoggle||null);};
    });
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
      chatSeenCount=visible.length;
      show("chatJump",false);
    }else{
      /* Rows arrived since Papa scrolled up — not every row on screen, which
         is what made the jump button appear on any upward scroll. */
      chatUnseen=Math.max(0,visible.length-chatSeenCount);
      var jump=$("chatJump");
      if(jump)jump.textContent=chatUnseen>1?chatUnseen+" new messages ↓":"New message ↓";
      show("chatJump",chatUnseen>0);
    }

    var db=$("dockBadge");
    if(db){db.textContent=String(needs);db.classList.toggle("tag--now",needs>0);db.classList.toggle("tag--open",needs===0);}
  }

  /* One meta line per bubble: kid initial, name, then whatever qualifiers the
     row carries. Matches the prototype's "L Luis · captain claim · 09:32". */
  function msgMetaHtml(k,parts){
    return '<div class="msg__m"><span class="who__m">'+esc(k.name[0])+'</span>'+esc(k.name)+
      parts.filter(Boolean).map(function(p){return ' · '+esc(p);}).join("")+'</div>';
  }
  const actsHtml=inner=>inner?'<div class="msg__acts">'+inner+'</div>':"";
  const resolvedTag=(good,label)=>'<div class="msg__acts"><span class="tag tag--'+(good?"done":"off")+'">'+esc(label)+'</span></div>';

  function replyBoxHtml(row,k){
    if(openReplyId!==row.srcId)return "";
    return '<div class="msg__reply">'+
      '<label class="msg__reply-l" for="answer-'+row.srcId+'">Reply to '+esc(k.name)+'</label>'+
      '<textarea class="inp" id="answer-'+row.srcId+'" rows="2" placeholder="I can help after lunch."></textarea>'+
      '<div class="msg__acts">'+
        '<button class="btn btn--sm btn--primary" data-answer="'+row.srcId+'">Send</button>'+
        '<button class="btn btn--sm" data-rec="'+row.srcId+'">Record</button>'+
        '<button class="btn btn--sm" data-stop="'+row.srcId+'" disabled>Stop</button>'+
        '<button class="btn btn--sm btn--quiet" data-replytoggle="">Cancel</button>'+
        '<span class="msg__rec" id="recstatus-'+row.srcId+'" role="status"></span>'+
      '</div></div>';
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
        (row.body?'<p class="msg__t">'+esc(row.body)+'</p>':"")+
        actsHtml(voiceChipHtml(publicUrl(row.audio),"Voice reply"))+
        '</div></div>';
    }
    if(row.type==="photo"){
      return '<div class="msg msg--kid k-'+row.kidId+'">'+msgMetaHtml(k,["photo",when])+
        '<div class="msg__b msg__b--media"><img class="thumb" src="'+proofUrl(row.meta.path)+'" alt="Photo proof from '+esc(k.name)+'"></div></div>';
    }
    if(row.type==="claim"){
      var done=row.meta.status!=="requested";
      return '<div class="msg msg--task k-'+row.kidId+'">'+msgMetaHtml(k,["captain claim",when])+
        '<div class="msg__b"><p class="msg__t">Helped <b>'+esc(kidName(row.meta.helped))+'</b> — '+esc(row.body||"no note")+'</p>'+
        (done
          ?resolvedTag(row.meta.status==="approved",row.meta.status==="approved"?"Approved":"Declined")
          :actsHtml('<button class="btn btn--sm btn--primary" data-helpok="'+row.srcId+'">Approve +1</button>'+
                    '<button class="btn btn--sm btn--danger" data-helpno="'+row.srcId+'">Decline</button>'))+
        '</div></div>';
    }
    if(row.type==="pass"){
      var doneP=row.meta.status!=="requested";
      return '<div class="msg msg--task k-'+row.kidId+'">'+msgMetaHtml(k,["pass request",when])+
        '<div class="msg__b"><p class="msg__t">Skip <b>'+esc(blockTitle(row.meta.blockIdx))+'</b> '+esc(blockTz(row.meta.blockIdx))+
        (row.body?' — '+esc(row.body):"")+'</p>'+
        (doneP
          ?resolvedTag(row.meta.status==="granted",row.meta.status==="granted"?"Granted":"Denied")
          :actsHtml('<button class="btn btn--sm btn--primary" data-passok="'+row.srcId+'">Grant</button>'+
                    '<button class="btn btn--sm btn--danger" data-passno="'+row.srcId+'">Deny</button>'))+
        '</div></div>';
    }
    /* Ask. The prototype's bubble carries a compact action row, not a permanently
       open answer form — the composer unfolds under the message on Reply. */
    var kind=row.meta.kind&&row.meta.kind!=="question"?row.meta.kind:null;
    var acts=voiceChipHtml(publicUrl(row.audio),"Voice note")+
      (row.needs&&openReplyId!==row.srcId?'<button class="btn btn--sm btn--primary" data-replytoggle="'+row.srcId+'">Reply</button>':"")+
      (row.archived
        ?'<button class="btn btn--sm btn--quiet" data-unarchiveask="'+row.srcId+'">Restore</button>'
        :'<button class="btn btn--sm btn--quiet" data-archiveask="'+row.srcId+'">Archive</button>');
    return '<div class="msg msg--kid'+(row.archived?" is-archived":"")+' k-'+row.kidId+'">'+
      msgMetaHtml(k,[kind,when,row.archived?"archived":null])+
      '<div class="msg__b"><p class="msg__t">'+esc(row.body||"Voice memo")+'</p>'+
      actsHtml(acts)+replyBoxHtml(row,k)+
      '</div></div>';
  }

  /* Rows plus the date rules the prototype opens the stream with. */
  function streamHtml(list){
    var out=[], last="";
    list.forEach(function(row){
      var d=dayOf(row.at);
      if(d!==last){out.push('<p class="sys sys--day">'+esc(dayLabel(d))+'</p>');last=d;}
      out.push(chatRowHtml(row));
    });
    return out.join("");
  }

  /* Reply is reachable from the dock and from the Inbox table; both land on the
     same composer, so the dock opens itself when it is a drawer. */
  function openReply(id){
    var was=openReplyId;
    openReplyId=id;
    if(id&&window.sqSetDock&&matchMedia("(max-width: 1280px)").matches)window.sqSetDock(true);
    renderDockConversation();
    /* Focus follows the disclosure: into the field on open, back to the button
       that opened it on cancel. */
    var field=id?$("answer-"+id):null;
    if(field){
      field.focus();
      var bubble=field.closest(".msg");
      if(bubble)bubble.scrollIntoView({block:"nearest"});
    }else if(was){
      var back=document.querySelector('[data-replytoggle="'+was+'"]');
      if(back)back.focus();
    }
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
    /* Was a hardcoded `true` shadowing the module flag, so the Archived button
       that sits in this sheet's head could never hide anything. */
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
      /* Routes to the dock composer — this table has no field of its own, so a
         bare data-answer here posted an empty reply. */
      if(row.needs)actions='<button class="btn btn--sm btn--primary" data-replytoggle="'+row.srcId+'">Reply</button>';
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
    openReplyId=null;
    chatStuckToBottom=true;
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
      +'<p>'+esc(kidName(p.kid_id))+' · '+esc(p.day)+' · '+esc(blockTitle(p.block_idx))+'<br><span class="muted">'+esc(blockTz(p.block_idx))+'</span></p>'
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
    /* #reportMetrics was an empty <div class="chips" role="group" aria-label
       ="Metric"> that no code ever filled — an empty labelled group announced
       to screen readers. Replaced with the window this table actually covers. */
    var range=$("reportRange");
    if(range)range.textContent=daysList[0]+" → "+daysList[daysList.length-1];
    var counts=new Map();
    rows.history.forEach(function(r){counts.set(r.kid_id+":"+r.day,(counts.get(r.kid_id+":"+r.day)||0)+1);});
    /* Per-kid stats over the 14-day window */
    var kidRows=Object.entries(KIDS).map(function(e){
      var id=e[0], k=e[1];
      var totalBlocks=0, totalStars=0;
      daysList.forEach(function(d){
        totalBlocks+=counts.get(id+":"+d)||0;
      });
      var kidLedger=rows.ledger14.filter(function(r){return r.kid_id===id&&daysList.includes(String(r.created_at||"").slice(0,10));});
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
        '<td data-l="Photos" class="r num">'+rows.photos14.filter(function(p){return p.kid_id===id&&daysList.includes(p.day);}).length+'</td>'+
        '<td data-l="Asks" class="r num">'+rows.asks14.filter(function(a){return a.kid_id===id&&daysList.includes(String(a.created_at||"").slice(0,10));}).length+'</td>'+
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
      var lockedCount=cats.filter(function(c){return catIsLocked(fs,id,c[0]);}).length;
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
    if(activeKidDetail&&KIDS[activeKidDetail])renderKidDetail(activeKidDetail,{quiet:true});
  }

  function renderKidDetail(kid,opts){
    opts=opts||{};
    var el=$("kidDetail");
    if(!el)return;
    activeKidDetail=kid;
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
        var locked=catIsLocked(fs,kid,c[0]);
        var label=locked?" · locked":"";
        return '<button class="chip" aria-pressed="'+(locked?"true":"false")+'" data-catlock="'+kid+':'+c[0]+'" data-locked="'+(locked?1:0)+'">'+esc(c[1])+label+'</button>';
      }).join("")+'</div>'+
      '<p class="field__hint" style="margin-top:9px">My Day, guides, Learn and the ask channel stay open in every state except a full pause.</p>'+
      '<span class="lbl" style="display:block;margin:18px 0 8px">Brain Gym</span>'+
      '<div class="chips">'+
      BRAIN_TIERS.map(function(t){
        var on=brainTierValue(fs,kid)===t[0];
        return '<button class="chip" aria-pressed="'+(on?"true":"false")+'" data-braintier="'+kid+':'+t[0]+'">'+t[1]+'</button>';
      }).join("")+'</div>'+
      '<p class="field__hint" style="margin-top:9px">Off skips the daily-3 gate — games are free to play. Difficulty applies only while Brain Gym is required.</p>'+
      '<p class="field__hint" style="margin-top:9px"><b>Status:</b> '+(brainIsEnabled(fs,kid)?"Required daily":"Off")+' (stored '+esc(fs["brain_enabled_"+kid]||"default")+')</p>'+
      '<div class="vrow" style="margin-top:10px;justify-content:flex-start">'+
      '<button class="btn btn--sm '+(brainIsEnabled(fs,kid)?"":"btn--primary")+'" data-brainenabled="'+kid+'" data-enabled="'+(brainIsEnabled(fs,kid)?1:0)+'">'+(brainIsEnabled(fs,kid)?"Turn off Brain Gym":"Require Brain Gym")+'</button>'+
      '<button class="btn btn--sm btn--danger" data-resetbrain="'+kid+'">Reset today\'s Brain Gym</button></div>'+
      '<div class="grid-2" style="margin-top:18px">'+
      '<label class="field"><span class="lbl">Kid PIN</span><input class="inp num" id="pin-'+kid+'" inputmode="numeric" maxlength="4" value="'+esc(pin||"")+'" placeholder="optional" autocomplete="off"><span class="field__hint">4 digits · used to open profile on tablet.</span></label>'+
      '<label class="field"><span class="lbl">Last seen</span><input class="inp" value="'+lastSeen+'" readonly><span class="field__hint">Derived from day_ticks.</span></label></div>'+
      '<button class="btn btn--primary" data-savepin="'+kid+'">Save changes</button>'+
      '<p class="message pin-message '+(feedback.type==="ok"?"message--ok":feedback.type==="error"?"message--error":"")+'" id="pinmsg-'+kid+'" aria-live="polite">'+(feedback.text||"")+'</p>'+
    '</div>';
    if(!opts.quiet)el.scrollIntoView({behavior:"smooth"});
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
      var value=locked?"":"1";
      suppressRealtime("family_settings",{key:'catlock_'+id+'_'+cat});
      const {error}=await client.from("family_settings").upsert({key:'catlock_'+id+'_'+cat,value,updated_at:new Date().toISOString()});
      if(error){writeFailed(error);return;}
      toast(kidName(id)+" "+cat+" "+(locked?"unlocked":"locked"),true);
      await loadAll();
    };});
    document.querySelectorAll("[data-brainenabled]").forEach(function(b){b.onclick=async function(){
      var id=b.dataset.brainenabled, enabled=b.dataset.enabled==="1";
      var value=enabled?"0":"1";
      suppressRealtime("family_settings",{key:"brain_enabled_"+id});
      const {error}=await client.from("family_settings").upsert({key:"brain_enabled_"+id,value,updated_at:new Date().toISOString()});
      if(error){writeFailed(error);return;}
      toast(kidName(id)+" Brain Gym "+(enabled?"turned off":"required daily"),true);
      await loadAll();
    };});
    document.querySelectorAll("[data-braintier]").forEach(function(b){b.onclick=async function(){
      var parts=b.dataset.braintier.split(":"), id=parts[0], tier=parts[1];
      suppressRealtime("family_settings",{key:"brain_tier_"+id});
      const {error}=await client.from("family_settings").upsert({key:"brain_tier_"+id,value:tier,updated_at:new Date().toISOString()});
      if(error){writeFailed(error);return;}
      toast(kidName(id)+" Brain Gym difficulty: "+tier,true);
      await loadAll();
    };});
    document.querySelectorAll("[data-resetbrain]").forEach(function(b){b.onclick=function(){resetBrainDay(b.dataset.resetbrain);};});
    document.querySelectorAll("[data-savepin]").forEach(function(b){b.onclick=function(){savePin(b.dataset.savepin,false);};});
  }

  async function resetBrainDay(kid){
    if(!confirm("Reset today's Brain Gym for "+kidName(kid)+"?"))return;
    const ledger=await client.from("stars_ledger").select("delta,reason")
      .eq("kid_id",kid).ilike("reason","%Brain Gym%"+today+"%");
    if(ledger.error){writeFailed(ledger.error);return;}
    var net=(ledger.data||[]).reduce(function(s,r){return s+(r.delta||0);},0);
    suppressRealtime("family_settings",{key:"braingate_"+kid});
    const results=await Promise.all([
      client.from("brain_done").delete().eq("kid_id",kid).eq("day",today),
      client.from("family_settings").upsert({key:"braingate_"+kid,value:"",updated_at:new Date().toISOString()}),
      client.from("family_settings").upsert({key:"brain_enabled_"+kid,value:"1",updated_at:new Date().toISOString()}),
      net>0?client.from("stars_ledger").insert({kid_id:kid,delta:-net,reason:"Brain Gym day reset · "+today,source:"admin",granted_by:session.user.id}):Promise.resolve({error:null})
    ]);
    const failed=results.find(function(r){return r.error;});
    if(failed){writeFailed(failed.error);return;}
    toast(kidName(kid)+" Brain Gym reset and required today",true);
    await loadAll();
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
      '<label class="field"><span class="lbl">English</span><textarea class="inp" id="noteBody">'+esc(papaNote.en)+'</textarea></label>'+
      '<label class="field"><span class="lbl">繁體中文</span><textarea class="inp" id="noteBodyZh" lang="zh-Hant">'+esc(papaNote.zh)+'</textarea></label></div>'+
      '<div style="display:flex;gap:8px;align-items:center">'+
      '<button class="btn btn--primary" id="saveNoteBtn">Save message</button>'+
      '<span class="tbl__note" id="noteStatus"></span></div>';
    $("noteBody").oninput=function(){papaNote.en=this.value;};
    $("noteBodyZh").oninput=function(){papaNote.zh=this.value;};
    $("saveNoteBtn").onclick=async function(){
      papaNote.en=$("noteBody").value.trim();
      papaNote.zh=$("noteBodyZh").value.trim();
      var status=$("noteStatus");
      status.textContent="";
      if(!papaNote.en&&!papaNote.zh){status.textContent="Write a message first.";return;}
      const {error}=await client.from("papa_notes").upsert({day:today,body:noteJoined()});
      status.textContent=error?error.message:"Saved";
      if(!error){status.classList.add("message--ok");renderDockConversation();}
    };
  }

  function renderDayTemplate(){
    var el=$("dayTemplate");
    if(!el)return;
    el.innerHTML='<table class="tbl"><thead><tr><th style="width:60px">#</th><th style="width:90px">Time</th><th>Block</th><th style="width:160px">繁體中文</th><th style="width:100px" class="r">Kind</th></tr></thead><tbody>'+
      DAY.map(function(b,i){return '<tr><td data-l="#" class="num">'+(i+1)+'</td><td data-l="Time" class="num">'+blockClock(b.t)+'</td><td data-l="Block"><b>'+esc(b.title)+'</b></td><td data-l="中文" lang="zh-Hant">'+esc(b.tz||"")+'</td><td data-l="Kind" class="r">'+esc(b.kind||"")+'</td></tr>';}).join("")+'</tbody></table>';

  }

  /* ---- Settings route ---- */
  function renderSettings(){
    if($("accessPanel"))renderAccessPanel();
    if($("behaviourPanel"))renderBehaviourPanel();
    if($("dangerZone"))renderDangerZone();
    if($("seasonReset"))renderSeasonReset();
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
      '<div style="margin-top:12px"><span class="lbl" style="display:block;margin-bottom:6px">Theme</span>'+
      '<select class="inp" id="themeSelect" style="width:auto;height:30px;font-size:13px">'+
        '<option value="">Ops (default)</option>'+
        '<option value="graphite"'+(localStorage.getItem("sq-admin-theme")==="graphite"?" selected":"")+'>Graphite</option>'+
      '</select></div>'+
      '<p class="message pin-message '+(fb.type==="ok"?"message--ok":fb.type==="error"?"message--error":"")+'" id="adminPinStatus" aria-live="polite">'+(fb.text||"")+'</p>'+
      '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-hairline)">'+
      '<span class="lbl" style="display:block;margin-bottom:6px">Preview &amp; test</span>'+
      '<p class="field__hint" style="margin-bottom:8px">Open the kid app to try every function yourself: pick any kid profile, tap 🔧 Papa (enter the Papa PIN above), then 🧪 Test mode — every time-lock and app-pause is off for the rest of today. Turn it off from the same menu when done. Testing writes real stars/ticks like a normal play session; use Danger Zone below to reset a kid\'s day or stars afterward if needed.</p>'+
      '<a class="btn" href="index.html" target="_blank" rel="noopener">🧪 Open kid app ↗</a>'+
      '</div>';
    $("saveAdminPinBtn").onclick=saveAdminPin;
    $("settingsLogout").onclick=function(){client.auth.signOut().then(function(){location.reload();});};
    var ts=$("themeSelect");
    if(ts)ts.onchange=function(){
      var v=ts.value;
      if(v)document.documentElement.setAttribute("data-admin-theme",v);
      else document.documentElement.removeAttribute("data-admin-theme");
      localStorage.setItem("sq-admin-theme",v);
    };
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

  /* Whole-database reset. One RPC (supabase/migrations/20260802_season_reset.sql)
     so the wipe is atomic — sixteen chained deletes from here would leave a
     half-erased season on the first network blip. Typed confirmation because
     nothing on this page undoes it. The RPC checks auth.uid() against the
     `admins` table, so a signed-in stranger gets "not an admin", not a wipe. */
  function renderSeasonReset(){
    var el=$("seasonReset");
    if(!el)return;
    el.innerHTML='<div class="note note--error" style="margin-bottom:14px">'+
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true" style="flex:none;margin-top:1px"><path d="M8 2.2 14.6 13H1.4z"/><path d="M8 6.4v3M8 11.3v.1"/></svg>'+
      '<div><b>This erases every kid’s whole history</b>'+
      'Stars and the entire ledger, day ticks, missions, activities, Brain Gym, word mastery, game best scores, asks, passes, photo records, Papa’s notes and help claims. The Papa PIN and the three kid PINs are cleared, every app pause lifts, and the schedule goes back to the times in the day template. Tablets drop their local copy the next time they sync.</div></div>'+
      '<label class="field" style="max-width:260px;margin-bottom:0"><span class="lbl">Type RESET to confirm</span>'+
      '<input class="inp" id="seasonResetConfirm" autocomplete="off" placeholder="RESET" aria-describedby="seasonResetStatus"></label>'+
      '<div style="display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap">'+
      '<button class="btn btn--danger" id="seasonResetBtn" disabled>Reset the whole database</button>'+
      '<span class="tbl__note" id="seasonResetStatus" aria-live="polite"></span></div>'+
      '<p class="field__hint" style="margin-top:10px">Photo and voice files already uploaded to Storage are left in place — the rows pointing at them are gone, so nothing in the app shows them.</p>';
    var input=$("seasonResetConfirm"),btn=$("seasonResetBtn");
    input.oninput=function(){btn.disabled=input.value.trim().toUpperCase()!=="RESET";};
    btn.onclick=runSeasonReset;
  }

  async function runSeasonReset(){
    var btn=$("seasonResetBtn"),status=$("seasonResetStatus");
    btn.disabled=true;
    status.textContent="Resetting…";
    const {error}=await client.rpc("reset_season");
    if(error){
      status.textContent=error.message||"Could not reset";
      writeFailed(error);
      btn.disabled=false;
      return;
    }
    /* The PIN editor keeps its own copy of the old value; drop it or the field
       repaints last season's PIN over an empty table. */
    adminPinFeedback.type=""; adminPinFeedback.text=""; adminPinFeedback.value=undefined;
    toast("New season — database reset",true);
    await loadAll();
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
    /* The dot reports the realtime channel, not merely "a session exists" —
       it read Live with the socket down. */
    var on=realtimeStatus==="SUBSCRIBED";
    /* The dock's bell had no handler at all — it rendered and did nothing.
       Reflect state on it and on the Settings checkbox from one place. */
    var bell=$("notifyToggleBtn");
    if(bell){
      bell.setAttribute("aria-pressed",enabled?"true":"false");
      bell.classList.toggle("is-on",enabled);
      bell.title=!supported?"Notifications not supported"
        :permission==="denied"?"Notifications blocked in the browser"
        :enabled?"Desktop notifications on":"Desktop notifications off";
    }
    var check=$("notifyCheck");
    if(check)check.checked=enabled;

    var live=$("liveDot");
    if(live){live.classList.toggle("live--on",on);live.classList.toggle("live--off",!on);}
    var ll=$("liveLabel");
    if(ll)ll.textContent=on?"Live":session?"Reconnecting":"Offline";
  }

  function pushNotify(title,body,kind){
    if("Notification" in window&&browserNotifyEnabled&&Notification.permission==="granted"){
      try{new Notification("Summer Quest Admin",{body:title+" — "+(body||""),icon:"assets/icons/icon-192.png",tag:"sq-"+(kind||"info")+"-"+Date.now()});}catch(e){}
    }
  }

  function realtimeKey(table,row){
    if(!row)return "";
    if(table==="day_ticks")return row.kid_id+":"+row.day+":"+row.block_idx;
    if(table==="family_settings")return row.key||"";
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
        var n=notificationFor(table,payload);
        if(n)pushNotify(n.title,n.body,n.kind);
        /* Data always refreshes (nav counts and the dock read from it); the
           route render is what we skip. The old code re-rendered regardless —
           the TABLE_ROUTES check sat inside an empty .then and did nothing. */
        var routes=TABLE_ROUTES_MAP[table]||[];
        loadAll(routes.length&&routes.indexOf(currentRoute)<0);
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
      .subscribe(function(status){realtimeStatus=status;updateNotifyState();});
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
  /* Wrapped, not passed by reference: the click event would land in
     loadAll's skipRouteRender parameter and suppress the very re-render
     the Refresh button exists to trigger. */
  $("refreshBtn").onclick=function(){loadAll();};
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
  $("notifyToggleBtn").onclick=toggleBrowserNotifications;
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
    /* This used to only sqGo("inbox") — a route we are already on — so the
       Archived button rendered, clicked, and changed nothing. */
    var toggle=e.target.closest("[data-togglearchived]");
    if(toggle){
      showArchived=!showArchived;
      toggle.setAttribute("aria-pressed",showArchived?"true":"false");
      toggle.textContent=showArchived?"Hide archived":"Archived";
      renderInboxView();
      renderDockConversation();
    }
  });

  init().catch(function(e){show("configState",true);var cp=$("configState");if(cp){var p=cp.querySelector("p");if(p)p.textContent=e.message;}});
})();
