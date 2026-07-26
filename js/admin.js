(function(){
  const CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  const KIDS={
    lucien:{name:"Lucien",color:"#3DDC97"},
    lili:{name:"Lili",color:"#FF6FB5"},
    luis:{name:"Luis",color:"#4EA8FF"}
  };
  const DAY=[
    ["8:00","Wake up","起床"],["8:15","Breakfast","早餐"],["8:45","Skill block","技能時間"],
    ["9:30","Reading","閱讀"],["10:00","Homework","暑假作業"],["11:15","Screen #1","螢幕#1"],
    ["12:00","Lunch","午餐"],["12:45","Quiet hour","安靜時間"],["14:00","Project time","專題時間"],
    ["15:45","Screen #2","螢幕#2"],["16:30","Free invent game","自由發明遊戲"],["17:15","Sport & move","運動時間"],
    ["18:00","Tidy patrol","整理巡邏"],["18:30","Dinner","晚餐"],["19:30","Bath and bed","洗澡睡覺"],["✨","Photo mission","照片任務"]
  ];

  let client=null, session=null, today="", tomorrow="";
  let rows={ticks:[],totals:[],stats:[],ledger:[],asks:[],passes:[],photos:[],kids:[],history:[]};
  let answerRecord=null, answerChunks=[], answerAskId=null;
  const pinFeedback={};

  const $=id=>document.getElementById(id);
  const show=(id,on)=>$(id).classList.toggle("hidden",!on);
  const kidName=id=>KIDS[id]?KIDS[id].name:id;
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const fmt=ts=>new Date(ts).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      s.src=src; s.onload=resolve; s.onerror=reject;
      document.head.appendChild(s);
    });
  }

  function dayISO(offset=0){
    const d=new Date(Date.now()+offset*86400000);
    const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"})
      .formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
    return `${p.year}-${p.month}-${p.day}`;
  }

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
    const [ticks,totals,stats,ledger,asks,note,passes,photos,kids,history]=await Promise.all([
      client.from("day_ticks").select("*").eq("day",today),
      client.from("star_totals").select("*"),
      client.from("game_stats").select("*").eq("stat","missions"),
      client.from("stars_ledger").select("*").order("created_at",{ascending:false}).limit(30),
      client.from("asks").select("*").order("created_at",{ascending:false}).limit(40),
      client.from("papa_notes").select("body").eq("day",tomorrow).maybeSingle(),
      client.from("passes").select("*").order("created_at",{ascending:false}).limit(80),
      client.from("photos").select("*").order("created_at",{ascending:false}).limit(80),
      client.from("kids").select("id,pin").order("id"),
      client.from("day_ticks").select("kid_id,day,block_idx").gte("day",start).lte("day",today)
    ]);
    rows={
      ticks:ticks.data||[],totals:totals.data||[],stats:stats.data||[],ledger:ledger.data||[],asks:asks.data||[],
      passes:passes.data||[],photos:photos.data||[],kids:kids.data||[],history:history.data||[]
    };
    $("noteBody").value=note.data&&note.data.body?note.data.body:"";
    renderAll();
  }

  function renderAll(){
    renderOverview();
    renderGrants();
    renderLedger();
    renderAsks();
    renderPasses();
    renderProofs();
    renderHistory();
    renderPins();
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
          <span>${b[0]}</span><b class="${done.has(i)?"ok":"muted"}">${done.has(i)?"✓":"-"}</b>
          <span>${b[1]}<br><span class="muted">${b[2]}</span></span>
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
    await client.from("stars_ledger").insert({kid_id:kid,delta,reason,source:"admin",granted_by:session.user.id});
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
      await client.from("stars_ledger").delete().eq("id",b.dataset.delstar);
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
      await client.storage.from("voices").upload(answer_audio_path,blob,{contentType:"audio/webm",upsert:false});
      answerAskId=null; answerChunks=[];
    }
    if(!body&&!answer_audio_path){$(`answer-${id}`).focus();return;}
    await client.from("asks").update({answer:body||null,answer_audio_path,answered_at:new Date().toISOString()}).eq("id",id);
    await loadAll();
  }

  function renderPasses(){
    $("passes").innerHTML=rows.passes.length?`<table class="table"><thead><tr>
      <th>Time 時間</th><th>Kid 孩子</th><th>Block 格子</th><th>Kind 類型</th><th>Status 狀態</th><th>Reason 原因</th><th></th>
    </tr></thead><tbody>${rows.passes.map(p=>`<tr>
      <td>${fmt(p.created_at)}</td><td>${kidName(p.kid_id)}</td><td>${DAY[p.block_idx]?.[1]||"-"}<br><span class="muted">${DAY[p.block_idx]?.[2]||""}</span></td>
      <td>${p.kind==="golden"?"Golden 黃金":"Excused 請假"}</td><td>${esc(p.status)}</td><td>${esc(p.reason||"")}</td>
      <td>${p.status==="requested"?`<button class="btn" data-passok="${p.id}">Approve 核准</button>
        <button class="btn btn--danger" data-passno="${p.id}">Deny 拒絕</button>`:""}</td>
    </tr>`).join("")}</tbody></table>`:`<p>No pass requests. 還沒有券申請。</p>`;
    document.querySelectorAll("[data-passok]").forEach(b=>b.onclick=()=>setPass(b.dataset.passok,"granted"));
    document.querySelectorAll("[data-passno]").forEach(b=>b.onclick=()=>setPass(b.dataset.passno,"denied"));
  }
  async function setPass(id,status){
    await client.from("passes").update({status,granted_by:session.user.id}).eq("id",id);
    await loadAll();
  }

  function renderProofs(){
    $("proofs").innerHTML=rows.photos.length?`<div class="thumb-grid">${rows.photos.map(p=>`
      <article class="ask-card">
        <img class="thumb" src="${proofUrl(p.path)}" alt="Photo proof 照片證明">
        <p>${kidName(p.kid_id)} · ${p.day} · ${DAY[p.block_idx]?.[1]||"Block"}<br><span class="muted">${DAY[p.block_idx]?.[2]||""}</span></p>
      </article>`).join("")}</div>`:`<p>No proof photos yet. 還沒有照片證明。</p>`;
  }

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

  function subscribeRealtime(){
    client.channel("p1-admin")
      .on("postgres_changes",{event:"*",schema:"public",table:"day_ticks"},loadAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"stars_ledger"},loadAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"asks"},loadAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"passes"},loadAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"photos"},loadAll)
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
  $("saveNoteBtn").onclick=async()=>{
    const body=$("noteBody").value.trim();
    const status=$("noteStatus");
    status.textContent="";
    if(!body){status.textContent="Write a bilingual message first. 請先寫雙語留言。";return;}
    const {error}=await client.from("papa_notes").upsert({day:tomorrow,body});
    status.textContent=error?error.message:"Saved 儲存好了";
  };
  init().catch(e=>{$("configState").querySelector("p").textContent=e.message;});
})();
