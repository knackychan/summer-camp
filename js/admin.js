(function(){
  const CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  const KIDS={
    lucien:{name:"Lucien",color:"#3DDC97"},
    lili:{name:"Lili",color:"#FF6FB5"},
    luis:{name:"Luis",color:"#4EA8FF"}
  };
  const DAY=window.SQ_DAY_DATA||[];

  let client=null, session=null, today="", tomorrow="";
  let rows={ticks:[],totals:[],stats:[],ledger:[],asks:[],passes:[],photos:[],kids:[],history:[],helpClaims:[],familySettings:[]};
  let answerRecord=null, answerChunks=[], answerAskId=null;
  const pinFeedback={}, adminPinFeedback={};
  let overridesRaw={}, reschedKid="all";
  const outingSel=new Set();

  const $=id=>document.getElementById(id);
  const show=(id,on)=>$(id).classList.toggle("hidden",!on);
  const kidName=id=>KIDS[id]?KIDS[id].name:id;
  const blockTitle=i=>(DAY[i]&&DAY[i].title)||"Block";
  const blockTz=i=>(DAY[i]&&DAY[i].tz)||"";
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const fmt=ts=>new Date(ts).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});

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
    today=dayISO(0); tomorrow=dayISO(1);
    $("todayLabel").textContent=`Today 今天 ${today}`;
    $("noteDay").textContent=`Tomorrow 明天 ${tomorrow}`;
    await loadAll();
    subscribeRealtime();
  }

  async function loadAll(){
    const start=dayISO(-13);
    const [ticks,totals,stats,ledger,asks,note,passes,photos,kids,history,helpClaims,familySettings,overrides]=await Promise.all([
      client.from("day_ticks").select("*").eq("day",today),
      client.from("star_totals").select("*"),
      client.from("game_stats").select("*").eq("stat","missions"),
      client.from("stars_ledger").select("*").order("created_at",{ascending:false}).limit(30),
      client.from("asks").select("*").order("created_at",{ascending:false}).limit(40),
      client.from("papa_notes").select("body").eq("day",tomorrow).maybeSingle(),
      client.from("passes").select("*").order("created_at",{ascending:false}).limit(80),
      client.from("photos").select("*").order("created_at",{ascending:false}).limit(80),
      client.from("kids").select("id,pin").order("id"),
      client.from("day_ticks").select("kid_id,day,block_idx").gte("day",start).lte("day",today),
      client.from("help_claims").select("*").order("created_at",{ascending:false}).limit(80),
      client.from("family_settings").select("key,value"),
      client.from("day_overrides").select("kid_id,block_idx,t").eq("day",today)
    ]);
    rows={
      ticks:ticks.data||[],totals:totals.data||[],stats:stats.data||[],ledger:ledger.data||[],asks:asks.data||[],
      passes:passes.data||[],photos:photos.data||[],kids:kids.data||[],history:history.data||[],helpClaims:helpClaims.data||[],
      familySettings:familySettings.data||[]
    };
    overridesRaw={};
    (overrides.data||[]).forEach(function(r){
      (overridesRaw[r.kid_id]=overridesRaw[r.kid_id]||{})[r.block_idx]=r.t;
    });
    $("noteBody").value=note.data&&note.data.body?note.data.body:"";
    renderAll();
  }

  function renderAll(){
    renderOverview();
    renderGrants();
    renderLedger();
    renderAsks();
    renderHelpClaims();
    renderPasses();
    renderProofs();
    renderHistory();
    renderPins();
    renderAdminPin();
    renderResched();
    renderOutingBlocks();
  }

  function renderOverview(){
    $("overview").innerHTML=Object.entries(KIDS).map(([id,k])=>{
      const done=new Set(rows.ticks.filter(t=>t.kid_id===id).map(t=>t.block_idx));
      const stars=(rows.totals.find(t=>t.kid_id===id)||{}).stars||0;
      const missions=(rows.stats.find(s=>s.kid_id===id)||{}).value||0;
      return `<article class="kid-card" style="--kid-color:${k.color}">
        <h2 class="card-title">${k.name}</h2>
        <p><span class="gold">${stars}</span> stars 星星 · ${missions} photo missions 照片任務</p>
        <div class="progress"><div class="progress__fill" style="width:${done.size/DAY.length*100}%;background:${k.color}"></div></div>
        <h3>${done.size}/${DAY.length} blocks 格子</h3>
        <div class="blocks">${DAY.map((b,i)=>`<div class="block-row">
          <span>${b.t}</span><b class="${done.has(i)?"ok":"muted"}">${done.has(i)?"✓":"-"}</b>
          <span>${b.title}<br><span class="muted">${b.tz}</span></span>
        </div>`).join("")}</div>
      </article>`;
    }).join("");
  }

  function renderGrants(){
    $("grants").innerHTML=Object.entries(KIDS).map(([id,k])=>`
      <article class="kid-card" style="--kid-color:${k.color}">
        <h3>${k.name}</h3>
        <label class="field"><span>Reason 原因</span><input class="input" id="reason-${id}" placeholder="helped Lucien 幫Lucien"></label>
        <div class="row">
          <button class="btn" data-grant="${id}" data-delta="1">+1</button>
          <button class="btn" data-grant="${id}" data-delta="2">+2</button>
          <button class="btn" data-grant="${id}" data-delta="3">+3</button>
        </div>
        <div class="row">
          <input class="input" id="custom-${id}" type="number" min="1" max="10" value="1">
          <button class="btn btn--secondary" data-custom="${id}">Custom 自訂</button>
        </div>
      </article>`).join("");
    document.querySelectorAll("[data-grant]").forEach(b=>b.onclick=()=>grantStars(b.dataset.grant,+b.dataset.delta));
    document.querySelectorAll("[data-custom]").forEach(b=>b.onclick=()=>{
      const id=b.dataset.custom;
      grantStars(id,+$(`custom-${id}`).value||1);
    });
  }

  async function grantStars(kid,delta){
    const input=$(`reason-${kid}`);
    const reason=input.value.trim();
    if(!reason){input.focus();return;}
    const {error}=await client.from("stars_ledger").insert({kid_id:kid,delta,reason,source:"admin",granted_by:session.user.id});
    if(error){writeFailed(error);return;}
    toast(`+${delta} ⭐ ${kidName(kid)} — saved 已儲存`,true);
    input.value="";
    await loadAll();
  }

  function renderLedger(){
    $("ledger").innerHTML=`<table class="table"><thead><tr>
      <th>Time 時間</th><th>Kid 孩子</th><th>Delta 星</th><th>Reason 原因</th><th>Source 來源</th><th></th>
    </tr></thead><tbody>${rows.ledger.map(r=>`<tr>
      <td>${fmt(r.created_at)}</td><td>${kidName(r.kid_id)}</td><td>${r.delta>0?"+":""}${r.delta}</td>
      <td>${esc(r.reason)}</td><td>${esc(r.source)}</td>
      <td>${r.source==="admin"?`<button class="btn btn--danger" data-delstar="${r.id}">Undo 復原</button>`:""}</td>
    </tr>`).join("")}</tbody></table>`;
    document.querySelectorAll("[data-delstar]").forEach(b=>b.onclick=async()=>{
      const {error}=await client.from("stars_ledger").delete().eq("id",b.dataset.delstar);
      if(error){writeFailed(error);return;}
      toast("Grant undone 已復原",true);
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
    const open=rows.asks.filter(a=>!a.answered_at);
    const answered=rows.asks.filter(a=>a.answered_at);
    $("askInbox").innerHTML=[...open,...answered].map(a=>`
      <article class="ask-card">
        <div class="row">
          <b>${kidName(a.kid_id)}</b>
          <span class="pill">${esc(a.kind)} 類型</span>
          <span class="pill">${fmt(a.created_at)}</span>
          ${a.answered_at?`<span class="pill ok">answered 已回覆</span>`:`<span class="pill gold">open 未回覆</span>`}
        </div>
        <p>${esc(a.body||"Voice memo 語音訊息")}</p>
        ${a.audio_path?`<audio class="audio" controls src="${publicUrl(a.audio_path)}"></audio>`:""}
        ${a.answer?`<p class="ok">Answer 回覆: ${esc(a.answer)}</p>`:""}
        ${a.answer_audio_path?`<audio class="audio" controls src="${publicUrl(a.answer_audio_path)}"></audio>`:""}
        ${!a.answered_at?`<label class="field"><span>Answer 回覆</span>
          <textarea class="input textarea" id="answer-${a.id}" placeholder="I can help after lunch. 午餐後我可以幫你。"></textarea></label>
          <div class="row">
            <button class="btn" data-answer="${a.id}">Send answer 送出回覆</button>
            <button class="btn btn--secondary" data-rec="${a.id}">Record voice 錄語音</button>
            <button class="btn btn--secondary" data-stop="${a.id}" disabled>Stop 停止</button>
            <span class="message message--ok" id="recstatus-${a.id}"></span>
          </div>`:""}
      </article>`).join("")||`<p>No asks yet. 還沒有求助。</p>`;
    document.querySelectorAll("[data-answer]").forEach(b=>b.onclick=()=>answerAsk(b.dataset.answer));
    document.querySelectorAll("[data-rec]").forEach(b=>b.onclick=()=>startAnswerRecord(b.dataset.rec));
    document.querySelectorAll("[data-stop]").forEach(b=>b.onclick=()=>stopAnswerRecord(b.dataset.stop));
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

  function reschedEffective(){
    return reschedKid==="all"?(overridesRaw.all||{}):SQTime.resolveOverrides(overridesRaw,reschedKid);
  }
  function renderResched(){
    const kids=document.querySelectorAll("#reschedKids .reschedkid");
    kids.forEach(function(b){
      b.classList.toggle("on",b.dataset.rk===reschedKid);
      b.onclick=function(){reschedKid=b.dataset.rk;renderResched();};
    });
    const eff=reschedEffective(), own=overridesRaw[reschedKid]||{};
    $("reschedList").innerHTML=SQTime.timedOrder(DAY,eff).map(function(x){
      const b=DAY[x.i];
      const tag=own[x.i]!=null?(reschedKid==="all"?"moved 已調整":"own move 個人調整")
        :(reschedKid!=="all"&&(overridesRaw.all||{})[x.i]!=null?"family move 全家調整":"");
      const hh=String(Math.floor(x.t/60)).padStart(2,"0"), mm=String(x.t%60).padStart(2,"0");
      return `<div class="row resched-row">
        <span class="pill">${b.icon} ${b.title} ${b.tz}</span>
        <input class="input input--time" type="time" data-ri="${x.i}" value="${hh}:${mm}">
        ${tag?`<span class="pill pill--ok">${tag}</span>`:""}
      </div>`;
    }).join("");
  }
  async function saveResched(){
    const jobs=[], own=overridesRaw[reschedKid]||{};
    document.querySelectorAll("#reschedList [data-ri]").forEach(function(inp){
      const i=+inp.dataset.ri, v=inp.value;
      if(!v)return;
      const parts=v.split(":").map(Number), t=`${parts[0]}:${String(parts[1]).padStart(2,"0")}`;
      const base=reschedKid==="all"?DAY[i].t:((overridesRaw.all||{})[i]!=null?(overridesRaw.all||{})[i]:DAY[i].t);
      const cur=own[i]!=null?own[i]:base;
      if(SQTime.parseMins(t)===SQTime.parseMins(cur))return;
      if(SQTime.parseMins(t)===SQTime.parseMins(base)){
        jobs.push(client.from("day_overrides").delete()
          .eq("day",today).eq("block_idx",i).eq("kid_id",reschedKid));
      }else{
        jobs.push(client.from("day_overrides").upsert({day:today,block_idx:i,kid_id:reschedKid,t:t,updated_at:new Date().toISOString()}));
      }
    });
    const results=await Promise.all(jobs);
    const err=results.find(function(r){return r.error;});
    $("reschedStatus").textContent=err?err.error.message:"Saved — tablets update live 已儲存 ✓";
    await loadAll();
  }
  async function resetResched(){
    const {error}=await client.from("day_overrides").delete().eq("day",today).eq("kid_id",reschedKid);
    $("reschedStatus").textContent=error?error.message:"Back to normal 已恢復 ✓";
    await loadAll();
  }

  function renderOutingBlocks(){
    $("outingBlocks").innerHTML=SQTime.timedOrder(DAY,SQTime.resolveOverrides(overridesRaw,null)).map(function(x){
      const b=DAY[x.i];
      return `<button class="btn btn--secondary outblk ${outingSel.has(x.i)?"on":""}" data-oi="${x.i}">${b.icon} ${b.t} ${b.title}</button>`;
    }).join("");
    document.querySelectorAll(".outblk").forEach(function(btn){
      btn.onclick=function(){
        const i=+btn.dataset.oi;
        if(outingSel.has(i))outingSel.delete(i); else outingSel.add(i);
        renderOutingBlocks();
      };
    });
  }
  async function markOuting(){
    if(!outingSel.size){$("outingStatus").textContent="Pick blocks first 先選時段";return;}
    const credited=$("outingCredited").checked, kids=["lucien","lili","luis"], passRows=[], stars=[];
    kids.forEach(function(k){
      outingSel.forEach(function(i){
        passRows.push({kid_id:k,kind:"outing",status:"granted",day:today,block_idx:i,reason:"Family outing 家庭出遊",credited:credited,granted_by:session.user.id});
        if(credited)stars.push({kid_id:k,delta:1,reason:"Outing 出遊",source:"admin",granted_by:session.user.id});
      });
    });
    const r1=await client.from("passes").insert(passRows);
    const r2=stars.length?await client.from("stars_ledger").insert(stars):{error:null};
    const err=r1.error||r2.error;
    $("outingStatus").textContent=err?err.message:"Marked 已標記 ✓";
    if(!err){outingSel.clear();await loadAll();}
  }
  async function clearOuting(){
    const {error}=await client.from("passes").delete().eq("day",today).eq("kind","outing");
    $("outingStatus").textContent=error?error.message:"Cleared 已取消 ✓";
    if(!error)await loadAll();
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

  function subscribeRealtime(){
    client.channel("p1-admin")
      .on("postgres_changes",{event:"*",schema:"public",table:"day_ticks"},loadAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"stars_ledger"},loadAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"asks"},loadAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"passes"},loadAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"photos"},loadAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"help_claims"},loadAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"family_settings"},loadAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"day_overrides"},loadAll)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"kids"},loadAll)
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
  $("reschedSaveBtn").onclick=saveResched;
  $("reschedResetBtn").onclick=resetResched;
  $("outingGoBtn").onclick=markOuting;
  $("outingClearBtn").onclick=clearOuting;
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
    const {error}=await client.from("papa_notes").upsert({day:tomorrow,body});
    status.textContent=error?error.message:"Saved 儲存好了";
  };
  init().catch(e=>{show("configState",true);$("configState").querySelector("p").textContent=e.message;});
})();
