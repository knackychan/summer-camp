(function(){
  const STORAGE_KEY="keyquest:v2";
  const QUEUE_KEY="sq:queue";
  const POINT_QUEUE_KEY="sq:points:queue:v1";
  const SUPABASE_SCRIPT=typeof document!=="undefined"&&document.currentScript?new URL("vendor/supabase.js",document.currentScript.src).href:"js/vendor/supabase.js";
  const KIDS=["lucien","lili","luis"];

  /* Which game_stats keys are best scores.

     sync.js is a plain global script and cannot import the game registry
     (design.md §5), so main.js injects the registry's predicate at boot via
     setBestStatCheck. Until it does, the original six-name whitelist applies,
     which keeps this file correct on its own and keeps its tests honest.

     brain_* is checked unconditionally: the Brain Gym does not go through the
     arcade registry, and its keys must survive whatever is injected. */
  var bestStatCheck=null;
  function defaultBestStat(key){
    return key==="balloon"||key==="race"||key==="orc"||
      key==="shop"||key==="city"||key==="dig";
  }
  function isBestStat(key){
    if(!key)return false;
    if(key.indexOf("brain_")===0)return true;
    return bestStatCheck?!!bestStatCheck(key):defaultBestStat(key);
  }

  const clone=value=>JSON.parse(JSON.stringify(value));
  const uuid=()=>window.SQStarId?window.SQStarId.random():crypto.randomUUID?crypto.randomUUID():
    "10000000-1000-4000-8000-100000000000".replace(/[018]/g,c=>
      (c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));

  // Single shared day helper (js/day.js) with an inline fallback for non-browser tests.
  function todayISO(){
    if(window.SQ_DAY) return window.SQ_DAY.iso();
    const parts=new Intl.DateTimeFormat("en-CA",{
      timeZone:(window.SQ_CONFIG&&window.SQ_CONFIG.FAMILY_TZ)||"Asia/Taipei",
      year:"numeric",month:"2-digit",day:"2-digit"
    }).formatToParts(new Date()).reduce((a,p)=>(a[p.type]=p.value,a),{});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function loadJson(key,fallback){
    try{
      const raw=localStorage.getItem(key);
      return raw?JSON.parse(raw):fallback;
    }catch(e){return fallback;}
  }

  function saveJson(key,value){
    try{localStorage.setItem(key,JSON.stringify(value));}catch(e){}
  }

  /* Guide ops: a server answer with an error code is dropped (the queue never
     waits on the guide); a failed fetch has no code, so it stays queued. */
  function guideSyncError(error,what){
    if(!error)return;
    if(!error.code)throw error;
    console.warn(what,error.message);
  }

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      if(window.supabase) return resolve();
      let script=document.querySelector(`script[src="${src}"]`);
      const failed=()=>{
        clearTimeout(timer);
        if(script&&script.remove)script.remove();
        reject(new Error("Sync library unavailable"));
      };
      const timer=setTimeout(failed,8000);
      const loaded=()=>{clearTimeout(timer);resolve();};
      if(script){
        script.addEventListener("load",loaded,{once:true});
        script.addEventListener("error",failed,{once:true});
        return;
      }
      script=document.createElement("script");
      script.src=src; script.onload=loaded; script.onerror=failed;
      document.head.appendChild(script);
    });
  }

  async function createSupabaseClient(){
    const cfg=window.SQ_CONFIG;
    if(!cfg||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY) return null;
    try{
      await loadScript(SUPABASE_SCRIPT);
      return window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{
        db:{timeout:10000}
      });
    }catch(e){
      return null;
    }
  }

  function ensureKid(progress,kid){
    progress[kid]=progress[kid]||{best:{},vocab:{},missions:0,day:{d:"",done:{},rr:{}}};
    const p=progress[kid];
    p.best=p.best&&typeof p.best==="object"?p.best:{};
    p.vocab=p.vocab||{};
    p.missions=p.missions||0;
    p.day=p.day||{d:"",done:{},rr:{}};
    p.day.done=p.day.done||{};
    p.day.rr=p.day.rr||{};
    p.actsDay=p.actsDay||{d:"",done:{}};
    p.actsDay.done=p.actsDay.done||{};
    /* Brain Gym daily set: {d, done:{gameId:{score,ms}}, starred} */
    p.brain=p.brain&&typeof p.brain==="object"?p.brain:{d:"",done:{},starred:false};
    p.brain.done=p.brain.done&&typeof p.brain.done==="object"?p.brain.done:{};
  }

  function normalize(progress){
    KIDS.forEach(kid=>ensureKid(progress,kid));
    return progress;
  }

  class SyncStore{
    constructor(seed,supabaseClient){
      this.mode=supabaseClient?"supabase":"local-only";
      this.supabase=supabaseClient;
      this.progress=normalize(seed.progress);
      this.settings=seed.settings;
      /* Drop ops no build can ever apply. Learn guides used to enqueue
         actIdx:NaN (serialised to null); act_done.act_idx is not-null, so the
         insert failed forever and flush() stopped there — every star queued
         behind it stayed stuck on the tablet. */
      this.queue=loadJson(QUEUE_KEY,[]).filter(function(op){
        // isFinite(null) is true — the op serialised NaN to null, so check the type
        return !(op&&op.type==="actDone"&&!(typeof op.actIdx==="number"&&isFinite(op.actIdx)));
      });
      saveJson(QUEUE_KEY,this.queue);
      this.kidPins=loadJson("sq:kidPins",{});
      this.pinsReady=loadJson("sq:kidPins",null)!==null;
      this.hydrated=false;
      this.adminPin=loadJson("sq:adminPin","");
      this.familySettings=loadJson("sq:famSettings",{});
      const cachedRedos=loadJson("sq:redos",{d:null,map:{}});
      this.redos=cachedRedos.d===todayISO()?cachedRedos.map:{};
      const ov=loadJson("sq:dayOverrides",null);
      this.dayOverridesRaw=ov&&ov.d===todayISO()?ov.map:{};
      this.passes=[];
      this.photos=[];
      this.helpClaims=[];
      this.last=clone(this.progress);
      this.flushTimer=null;
      this.busy=null;
      /* "Do we have a server at all?" — a different question from "can we reach it
         right now?". Branching on the client object conflated the two, and an
         offline boot silently discarded every star the kid earned. */
      const cfg=(typeof window!=="undefined"&&window.SQ_CONFIG)||null;
      this.configured=!!(cfg&&cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY);
      /* The last star_totals we successfully read. Cached so an offline boot shows
         the kid's real number instead of zero. Only applyStarTotals writes it. */
      this.serverStars=loadJson("sq:serverStars",{});
      /* Local-only mode has no primary key to dedup against — see addStars. */
      this.localStarIds=loadJson("sq:localStarIds",[]);
      /* A new cache key is the unit marker. Never multiply the old cache in
         place: an older tablet/build still interprets it as legacy units. */
      this.points=window.SQPoints||null;
      this.pointCache=null;
      if(this.points){
        try{this.pointCache=this.points.migrateCache(localStorage);}
        catch(e){this.pointsStorageError=e.message;this.pointCache=this.points.migrateCache(localStorage,true);}
      }
      this.pointClaims=this.pointCache?this.pointCache.claims||[]:[];
      this.pointAttempts=this.pointCache?this.pointCache.attempts||{}:{};
      this.pointAssignments=this.pointCache?this.pointCache.assignments||[]:[];
      this.pointsReady=false;
      if(this.points){
        this.queue=Array.from(new Map(this.queue.concat(loadJson(POINT_QUEUE_KEY,[])).map(op=>[op.id,op])).values());
        try{this.persistQueue(this.queue,true);}catch(e){this.pointsStorageError=e.message;}
      }
    }

    static init(seed){
      const local=loadJson(STORAGE_KEY,null);
      const progress=local&&local.progress?local.progress:clone(seed.progress);
      const settings=local&&local.settings?Object.assign(clone(seed.settings),local.settings):clone(seed.settings);
      const store=new SyncStore({progress,settings},null);
      store.persistLocal();
      /* Render the cached app now. Keep the first snapshot ahead of queued
         writes, so a season reset can discard last season's offline queue. */
      store.ready=store.connect().then(()=>{store.startFlush();return store;});
      return store;
    }

    connect(){
      if(this.connecting)return this.connecting;
      let connected=false;
      this.connecting=this.run(async()=>{
        if(!this.supabase){
          this.supabase=await createSupabaseClient();
          connected=!!this.supabase;
        }
        if(this.supabase){
          this.mode="supabase";
          if(navigator.onLine)await this._hydrate(false);
        }
      }).catch(()=>{}).then(()=>{
        this.connecting=null;
        if(connected&&typeof this.onConnected==="function")this.onConnected();
        return this;
      });
      return this.connecting;
    }

    /* One row of game_stats -> one field of progress. Pulled out of hydrate()
       so it can be tested on its own (slice 16). */
    applyStatRows(progress,rows){
      (rows||[]).forEach(function(r){
        if(!r||!r.kid_id)return;
        ensureKid(progress,r.kid_id);
        if(isBestStat(r.stat)) progress[r.kid_id].best[r.stat]=r.value||0;
        if(r.stat==="missions") progress[r.kid_id].missions=r.value||0;
      });
    }

    queuedStarDelta(kid){
      return this.queue.reduce(function(sum,op){
        return sum+(op&&op.type==="stars"&&op.kid===kid?(op.delta||0):0);
      },0);
    }

    /* The ONLY star number on a tablet. Server truth plus whatever this device
       has earned and not yet sent — a star is in exactly one of the two terms at
       any moment, so the count never moves when the queue drains. */
    starsFor(kid){
      if(this.points)return this.pointsFor(kid).totalEarned;
      return (this.serverStars[kid]||0)+this.queuedStarDelta(kid);
    }

    pointsFor(kid){
      if(!this.points)return {totalEarned:this.starsFor(kid),available:this.starsFor(kid),pending:0,spent:0};
      const row=this.pointCache.totals[kid]||{};
      const known=new Set(this.pointClaims.filter(c=>c.kid_id===kid&&c.status!=="started").map(c=>this.points.identity(c)));
      const pendingClaims=this.pointClaims.filter(c=>c.kid_id===kid&&c.status==="pending");
      let pending=Math.max(Number(row.pending)||0,pendingClaims.reduce((n,c)=>n+(c.amount||0),0));
      pending+=this.pointClaims.filter(c=>c.kid_id===kid&&(c.status==="queued"||c.status==="confirmed"&&c.awaiting_totals)).reduce((n,c)=>n+(c.amount||0),0);
      this.queue.forEach(op=>{
        if(op.kid!==kid)return;
        if(op.type==="stars"&&!this.pointClaims.some(c=>c.legacy_id===op.id))pending+=(op.delta||0)*10;
        if(op.type==="pointClaim"&&!known.has(this.points.identity(op.claim)))pending+=op.claim.amount||0;
      });
      return {totalEarned:Number(row.total_earned)||0,available:Math.max(0,Number(row.available)||0),pending:pending,spent:Number(row.spent)||0};
    }

    persistPoints(){
      this.pointCache.claims=this.pointClaims;
      this.pointCache.attempts=this.pointAttempts;
      this.pointCache.assignments=this.pointAssignments;
      // Unlike cosmetic caches, losing an award intent must surface to caller.
      localStorage.setItem("sq:points:v1",JSON.stringify(this.pointCache));
    }

    applyPointTotals(rows){
      (rows||[]).forEach(row=>{if(row&&KIDS.includes(row.kid_id))this.pointCache.totals[row.kid_id]=row;});
      this.pointClaims.forEach(c=>{delete c.awaiting_totals;});
      this.persistPoints();
      this.pointsReady=true;
      this.pointsError="";
    }

    applyPointClaims(rows){
      const rowsByKey=new Map(this.pointClaims.map(c=>[this.points.identity(c),c]));
      (rows||[]).forEach(c=>{
        const key=this.points.identity(c),previous=rowsByKey.get(key);
        if(c.status==="started"&&previous&&previous.status==="queued")return;
        rowsByKey.set(key,c);
      });
      this.pointClaims=Array.from(rowsByKey.values());
      this.persistPoints();
    }

    beginPointAttempt(kid,kind,options){
      if(!this.points)throw new Error("Points policy unavailable");
      options=options||{};
      const claim=this.points.claim(kid,options.day||todayISO(),kind,options,this.familySettings);
      const assignment=this.pointAssignments.find(a=>a.kid_id===kid&&a.day===claim.day&&a.kind===kind&&(a.slot||"default")===claim.slot&&a.active!==false);
      if(assignment){
        claim.work_id=assignment.work_id||claim.work_id;
        claim.evidence.assignment_id=assignment.id;
        if(Number.isInteger(assignment.amount))claim.amount=assignment.amount;
      }
      claim.evidence.policy_snapshot={updated_at:this.familySettings.points_policy_updated_at||null,amount:claim.amount};
      const key=this.points.identity(claim);
      if(!this.pointAttempts[key]){
        claim.id=uuid();
        claim.started_at=new Date().toISOString();
        this.pointAttempts[key]=claim;
        this.persistPoints();
      }
      if(!this.pointClaims.some(c=>this.points.identity(c)===key)&&!this.queue.some(op=>op.type==="pointBegin"&&this.points.identity(op.claim)===key)){
        const saved=this.pointAttempts[key];
        this.enqueue({type:"pointBegin",id:saved.id+":begin",kid:kid,claim:saved});
        this.flush().catch(()=>{});
      }
      return clone(this.pointAttempts[key]);
    }

    async awardPoints(kid,kind,options){
      options=options||{};
      const attempt=options.attempt||this.beginPointAttempt(kid,kind,options);
      if(attempt.kid_id!==kid||attempt.kind!==kind)throw new Error("Points attempt does not match task");
      const claim=Object.assign({},attempt,{evidence:Object.assign({},attempt.evidence,options.evidence||{})});
      const key=this.points.identity(claim);
      const existing=this.pointClaims.find(c=>this.points.identity(c)===key||c.kid_id===kid&&c.day===claim.day&&c.work_id===claim.work_id&&kind!=="project");
      if(existing&&!["denied","rejected","started"].includes(existing.status))return existing;
      const queued=this.queue.find(op=>op.type==="pointClaim"&&this.points.identity(op.claim)===key);
      if(queued)return queued.claim;
      /* Keep the same intent across reloads even in local-only installations.
         Parent-verified earnings cannot become spendable without the server. */
      this.enqueue({type:"pointClaim",id:claim.id,kid:kid,claim:claim});
      this.pointClaims=this.pointClaims.filter(c=>this.points.identity(c)!==key);
      claim.status="queued";
      this.pointClaims.push(claim);
      this.persistPoints();
      this.announceStars(kid,claim.amount,this.points.rules[kind].label.join(" · "));
      this.flush().catch(()=>{});
      return claim;
    }

    applyStarTotals(rows,kid){
      if(this.points)return;
      (rows||[]).forEach(r=>{
        if(!r||!r.kid_id)return;
        if(kid&&r.kid_id!==kid)return;
        this.serverStars[r.kid_id]=r.stars||0;
      });
      saveJson("sq:serverStars",this.serverStars);
    }

    async refreshStarTotals(kid){
      return this.run(()=>this._refreshStarTotals(kid));
    }
    async _refreshStarTotals(kid){
      if(!this.supabase) return;
      if(this.points){
        const results=await Promise.all([
          this.supabase.from("point_totals").select("kid_id,total_earned,spent,available,pending"),
          this.supabase.from("points_claims").select("*").order("created_at",{ascending:false}).limit(1000),
          this.supabase.from("points_assignments").select("*")
        ]);
        const failed=results.find(r=>r.error);
        if(failed){this.pointsReady=false;this.pointsError=failed.error.message;throw failed.error;}
        this.applyPointClaims(results[1].data||[]);
        this.pointAssignments=results[2].data||[];
        this.applyPointTotals(results[0].data||[]);
        return;
      }
      const {data,error}=await this.supabase.from("star_totals").select("kid_id,stars");
      if(error) throw error;
      this.applyStarTotals(data||[],kid);
    }

    startFlush(){
      if(!this.configured) return;
      /* flush first: the queue is the only copy of anything earned offline, and
         hydrate() re-baselines `last` against the server. Hydrating first would
         re-baseline over ops that had not been sent yet. */
      addEventListener("online",()=>{
        const ready=this.supabase?this.flush().then(()=>this.hydrate()):this.connect().then(()=>this.flush());
        ready.catch(()=>{});
      });
      this.flushTimer=setInterval(()=>this.flush().catch(()=>{}),30000);
      if(this.flushTimer&&this.flushTimer.unref)this.flushTimer.unref();
      this.flush().catch(()=>{});
    }

    persistLocal(){
      saveJson(STORAGE_KEY,{progress:this.progress,settings:this.settings});
    }

    hydrate(){
      /* A burst of realtime events shares the next read. Events arriving during
         a read get one trailing snapshot, so a late admin edit is not missed. */
      if(!this.hydratePending){
        this.hydratePending=this.run(()=>{
          this.hydratePending=null;
          return this._hydrate();
        });
      }
      return this.hydratePending;
    }

    async _hydrate(flush=true){
      if(!this.supabase)return;
      const day=todayISO();

      const results=await Promise.all([
        this.supabase.from("kids").select("id,pin"),
        this.supabase.from("day_ticks").select("kid_id,block_idx").eq("day",day),
        this.supabase.from("day_rolls").select("kid_id,block_idx,count").eq("day",day),
        this.supabase.from("act_done").select("kid_id,act_idx").eq("day",day),
        this.supabase.from("star_totals").select("kid_id,stars"),
        this.supabase.from("vocab_mastery").select("kid_id,word_key,box"),
        this.supabase.from("game_stats").select("kid_id,stat,value"),
        this.supabase.from("papa_notes").select("body").eq("day",day).maybeSingle(),
        this.supabase.from("passes").select("*").or(`day.is.null,day.eq.${day}`).order("created_at",{ascending:false}),
        this.supabase.from("photos").select("*").eq("day",day).order("created_at",{ascending:false}),
        this.supabase.from("help_claims").select("*").eq("day",day).order("created_at",{ascending:false}),
        this.supabase.from("family_settings").select("key,value,updated_at"),
        this.supabase.from("day_overrides").select("kid_id,block_idx,t").eq("day",day),
        this.supabase.from("day_redos").select("kid_id,block_idx,note").eq("day",day),
        this.supabase.from("brain_done").select("kid_id,day,game_id,score,ms").eq("day",day),
        ...(this.points?[
          this.supabase.from("point_totals").select("kid_id,total_earned,spent,available,pending"),
          this.supabase.from("points_claims").select("*").order("created_at",{ascending:false}).limit(1000),
          this.supabase.from("points_assignments").select("*")
        ]:[]),
        /* home-help guide decisions of today (games-gate-ai-guide D8); always last */
        this.supabase.from("guide_decisions").select("*").eq("day",day)
      ]);
      const [{data:kids},{data:ticks},{data:rolls},{data:acts},{data:totals},{data:vocab},{data:stats},{data:note},{data:passes},{data:photos},{data:helpClaims},{data:famSettings},{data:overrides},{data:redos},{data:brain}]=results;
      if(!results[0].error&&Array.isArray(kids)){
        this.kidPins={};
        kids.forEach(r=>{if(r.pin)this.kidPins[r.id]=r.pin;});
        saveJson("sq:kidPins",this.kidPins);
        this.pinsReady=true;
      }
      const failed=results.slice(0,15).find(result=>result.error);
      if(failed)throw failed.error;
      const pointsFailure=this.points&&results.slice(15,-1).find(result=>result.error);
      if(pointsFailure){this.pointsReady=false;this.pointsError=pointsFailure.error.message;}
      const p=normalize(this.progress);
      this.passes=passes||[];
      this.photos=photos||[];
      this.helpClaims=helpClaims||[];
      /* an absent guide table just means no shared decisions yet */
      const guide=results[results.length-1];
      this.guideDecisions=!guide.error&&Array.isArray(guide.data)?guide.data:[];
      if(Array.isArray(famSettings)){
        this.familySettings={};
        famSettings.forEach(r=>{this.familySettings[r.key]=r.value;if(r.key==="points_policy_v1")this.familySettings.points_policy_updated_at=r.updated_at;});
        saveJson("sq:famSettings",this.familySettings);
      }
      this.adminPin=this.familySettings.admin_pin||"";
      saveJson("sq:adminPin",this.adminPin);

      /* Papa started a new season (admin Settings → Start a new season). The
         server is empty; this tablet still holds last season's progress, and
         hydrate only ever ADDS server rows — vocab boxes, best scores and a
         pending queue would all survive it and get pushed straight back. Drop
         every local key and reload into a clean boot. The stamp is written
         first, so the reload cannot loop. */
      const resetStamp=this.familySettings.season_reset_at||"";
      if(resetStamp&&loadJson("sq:seasonReset","")!==resetStamp){
        saveJson("sq:seasonReset",resetStamp);
        if(this.points){
          /* A season clears learning state, never wallet history or unsent
             earning evidence. Retain all money-related operations. */
          this.queue=this.queue.filter(op=>["pointBegin","pointClaim","stars","questVerify"].includes(op.type)||op.type==="brainDone"&&this.queue.some(p=>p.type==="pointClaim"&&p.kid===op.kid&&p.claim.kind==="brain"&&p.claim.day===op.day&&p.claim.slot===op.gameId));
          this.persistQueue(this.queue,true);
          [STORAGE_KEY,"sq:redos","sq:dayOverrides"].forEach(k=>localStorage.removeItem(k));
          this.progress=normalize({});
          this.last=clone(this.progress);
          if(typeof location!=="undefined"&&location.reload)location.reload();
          return;
        }
        [STORAGE_KEY,QUEUE_KEY,"sq:kidPins","sq:adminPin","sq:famSettings",
         "sq:redos","sq:dayOverrides","sq:serverStars","sq:localStarIds"]
          .forEach(k=>{try{localStorage.removeItem(k);}catch(e){}});
        this.queue=[];
        if(typeof location!=="undefined"&&location.reload)location.reload();
        return;
      }
      if(Array.isArray(redos)){
        this.redos={};
        redos.forEach(r=>{(this.redos[r.kid_id]=this.redos[r.kid_id]||{})[r.block_idx]=r.note||"";});
        saveJson("sq:redos",{d:day,map:this.redos});
      }
      this.dayOverridesRaw={};
      (overrides||[]).forEach(r=>{
        (this.dayOverridesRaw[r.kid_id]=this.dayOverridesRaw[r.kid_id]||{})[r.block_idx]=r.t;
      });
      saveJson("sq:dayOverrides",{d:day,map:this.dayOverridesRaw});
      KIDS.forEach(kid=>{
        p[kid].day={d:day,done:{},rr:{}};
        p[kid].actsDay={d:day,done:{}};
        /* keep `starred` across a same-day hydrate — it is the only guard against
           awarding the daily ⭐ twice when a kid replays a trio game */
        p[kid].brain={d:day,done:{},starred:p[kid].brain.d===day&&!!p[kid].brain.starred};
      });
      (ticks||[]).forEach(r=>{ensureKid(p,r.kid_id); p[r.kid_id].day.done[r.block_idx]=true;});
      (rolls||[]).forEach(r=>{ensureKid(p,r.kid_id); p[r.kid_id].day.rr[r.block_idx]=r.count||0;});
      (acts||[]).forEach(r=>{ensureKid(p,r.kid_id); p[r.kid_id].actsDay.done[r.act_idx]=true;});
      (totals||[]).forEach(r=>{ensureKid(p,r.kid_id);});
      this.applyStarTotals(totals||[]);
      if(this.points&&!pointsFailure){this.pointAssignments=results[17].data||[];this.applyPointClaims(results[16].data||[]);this.applyPointTotals(results[15].data||[]);}
      (vocab||[]).forEach(r=>{ensureKid(p,r.kid_id); p[r.kid_id].vocab[r.word_key]=r.box||0;});
      (brain||[]).forEach(r=>{ensureKid(p,r.kid_id); p[r.kid_id].brain.done[r.game_id]={score:r.score||0,ms:r.ms||0};});
      this.applyStatRows(p,stats||[]);
      this.papaNote=note&&note.body?note.body:"";

      // spec: hydration merges server rows, then the local queue replays anything pending
      this.queue.forEach(op=>{
        if(!op)return;
        if(op.type==="famset")this.familySettings[op.key]=op.value;
        if(op.type==="override"&&op.day===day){
          const bucket=this.dayOverridesRaw[op.kidId]=this.dayOverridesRaw[op.kidId]||{};
          if(op.t!=null)bucket[op.blockIdx]=op.t; else delete bucket[op.blockIdx];
        }
        if(!op.kid) return;
        ensureKid(p,op.kid);
        const P=p[op.kid];
        if(op.type==="tick"&&op.day===day){
          if(op.ticked) P.day.done[op.blockIdx]=true; else delete P.day.done[op.blockIdx];
        }else if(op.type==="roll"&&op.day===day){
          P.day.rr[op.blockIdx]=Math.max(P.day.rr[op.blockIdx]||0,op.count||0);
        }else if(op.type==="actDone"&&op.day===day){
          P.actsDay.done[op.actIdx]=true;
        }else if(op.type==="vocab"){
          P.vocab[op.wordKey]=op.box||0;
        }else if(op.type==="stat"){
          if(op.stat==="missions") P.missions=op.value||0; else P.best[op.stat]=op.value||0;
        }else if(op.type==="brainDone"&&op.day===day){
          P.brain.done[op.gameId]={score:op.score||0,ms:op.ms||0};
        }
      });

      /* Server is now the truth for this device: re-baseline the diff. Without this,
         an admin correction (revoked star, un-ticked activity) leaves `last` holding
         the pre-correction values, so redoing the activity looks like "no change" and
         never syncs — and an admin star grant gets counted a second time. */
      this.last=clone(this.progress);
      this.persistLocal();
      saveJson("sq:famSettings",this.familySettings);
      saveJson("sq:dayOverrides",{d:day,map:this.dayOverridesRaw});
      this.hydrated=true;

      if(flush)await this._flush();
    }

    async save(progress,settings){
      this.progress=normalize(progress);
      this.settings=settings;
      this.persistLocal();
      if(this.configured) this.enqueueDiff(this.last,this.progress);
      this.last=clone(this.progress);
      this.flush().catch(()=>{});
    }

    persistQueue(next,strict){
      const write=strict?(key,value)=>localStorage.setItem(key,JSON.stringify(value)):saveJson;
      if(this.points){
        /* Older sync builds discard unknown operation types. Keep point intents
           in a separate durable key so an old cached build cannot drain them. */
        const isPoint=op=>op.type==="pointBegin"||op.type==="pointClaim";
        write(POINT_QUEUE_KEY,next.filter(isPoint));
        write(QUEUE_KEY,next.filter(op=>!isPoint(op)));
      }else write(QUEUE_KEY,next);
    }

    enqueue(op){
      const next=this.queue.concat(Object.assign({id:uuid()},op));
      this.persistQueue(next,this.points&&["pointBegin","pointClaim","stars","questVerify"].includes(op.type));
      this.queue=next;
    }

    enqueueDiff(before,after){
      const day=todayISO();
      KIDS.forEach(kid=>{
        const a=after[kid], b=before[kid]||{};
        const ad=a.day&&a.day.d?a.day.d:day;
        const bd=b.day&&b.day.d?b.day.d:ad;
        const aDone=(a.day&&a.day.done)||{}, bDone=(b.day&&b.day.done)||{};
        const aRolls=(a.day&&a.day.rr)||{}, bRolls=(b.day&&b.day.rr)||{};
        const aActs=(a.actsDay&&a.actsDay.done)||{}, bActs=(b.actsDay&&b.actsDay.done)||{};

        new Set([...Object.keys(aDone),...Object.keys(bDone)]).forEach(i=>{
          if(!!aDone[i]!==!!bDone[i]) this.enqueue({type:"tick",kid,day:ad,blockIdx:+i,ticked:!!aDone[i]});
        });
        if(ad!==bd){
          Object.keys(aDone).forEach(i=>this.enqueue({type:"tick",kid,day:ad,blockIdx:+i,ticked:true}));
        }
        new Set([...Object.keys(aRolls),...Object.keys(bRolls)]).forEach(i=>{
          if((aRolls[i]||0)!==(bRolls[i]||0)) this.enqueue({type:"roll",kid,day:ad,blockIdx:+i,count:aRolls[i]||0});
        });
        new Set([...Object.keys(aActs),...Object.keys(bActs)]).forEach(i=>{
          if(!isFinite(+i)) return;   // never enqueue a key act_done cannot store
          if(!!aActs[i]&&!bActs[i]) this.enqueue({type:"actDone",kid,day:ad,actIdx:+i});
        });

        const av=a.vocab||{}, bv=b.vocab||{};
        Object.keys(av).forEach(wordKey=>{
          if((av[wordKey]||0)!==(bv[wordKey]||0)) this.enqueue({type:"vocab",kid,wordKey,box:av[wordKey]||0});
        });

        const ab=a.best||{}, bb=b.best||{};
        const bestKeys=Object.keys(ab).concat(Object.keys(bb)).filter(function(k,i,arr){return arr.indexOf(k)===i;});
        bestKeys.forEach(stat=>{
          if(!isBestStat(stat))return;
          if((ab[stat]||0)!==(bb[stat]||0)) this.enqueue({type:"stat",kid,stat,value:ab[stat]||0});
        });
        if((a.missions||0)!==(b.missions||0)) this.enqueue({type:"stat",kid,stat:"missions",value:a.missions||0});
      });
    }

    /* Server reads and server writes take turns, so a totals read can never
       return from before a flush that has already emptied the queue.
       ponytail: one chain for the whole store — fine for 3 kids and a 30s timer.
       Split per-kid only if this ever becomes chatty. */
    run(task){
      const next=(this.busy||Promise.resolve()).then(task,task);
      this.busy=next.then(null,function(){});   // a failure must not poison the chain
      return next;
    }

    async flush(){
      return this.run(()=>this._flush());
    }
    async _flush(){
      if(!this.supabase||!navigator.onLine||!this.queue.length) return;
      const pending=[...this.queue];
      let sentStars=false;
      for(const op of pending){
        try{
          await this.applyOp(op);
          if(op.type==="stars"||op.type==="pointClaim") sentStars=true;
          this.queue=this.queue.filter(q=>q.id!==op.id);
          this.persistQueue(this.queue,!!this.points);
        }catch(e){
          if(this.points&&["pointBegin","pointClaim","stars"].includes(op.type)&&["PGRST202","PGRST205","42P01","42883"].includes(e.code)){
            /* App files can arrive before the database migration. Keep points
               durable while unrelated ticks, bests and learning still sync. */
            this.pointsReady=false;this.pointsError=e.message;
            continue;
          }
          if(this.points&&["pointBegin","pointClaim"].includes(op.type)&&["22023","P0001","23514"].includes(e.code)){
            const claim=this.pointClaims.find(c=>this.points.identity(c)===this.points.identity(op.claim));
            if(claim){claim.sync_error=e.message||"Points task needs parent review";this.persistPoints();}
            continue;
          }
          break;
        }
      }
      /* The op has left the queue; the server total must catch up in the same turn,
         or the displayed count (server + queued) dips by exactly the stars we just
         successfully saved. */
      if(sentStars&&this.supabase) await this._refreshStarTotals();
    }

    async applyOp(op){
      if(op.type==="tick"){
        if(op.ticked){
          const {error}=await this.supabase.from("day_ticks").upsert({
            kid_id:op.kid,day:op.day,block_idx:op.blockIdx
          });
          if(error) throw error;
        }else{
          const {error}=await this.supabase.from("day_ticks")
            .delete().eq("kid_id",op.kid).eq("day",op.day).eq("block_idx",op.blockIdx);
          if(error) throw error;
        }
      }else if(op.type==="roll"){
        const {error}=await this.supabase.from("day_rolls").upsert({
          kid_id:op.kid,day:op.day,block_idx:op.blockIdx,count:op.count
        });
        if(error) throw error;
      }else if(op.type==="pointBegin"){
        const {data,error}=await this.supabase.rpc("points_begin_attempt",{p_claim:op.claim});
        if(error)throw error;
        const row=Array.isArray(data)?data[0]:data;
        if(!row||!row.status)throw new Error("Points attempt unavailable");
        if(this.points.identity(row)!==this.points.identity(op.claim))this.applyPointClaims([Object.assign({},op.claim,{id:row.id,status:row.status,amount:0,duplicate_of:row.id})]);
        this.applyPointClaims([row]);
      }else if(op.type==="pointClaim"){
        const {data,error}=await this.supabase.rpc("points_claim",{p_claim:op.claim});
        if(error)throw error;
        const row=Array.isArray(data)?data[0]:data;
        if(!row||!row.status)throw new Error("Points confirmation unavailable");
        if(this.points.identity(row)!==this.points.identity(op.claim)){
          /* A project/outing can intentionally reuse another task's work ID.
             Retain a zero-value alias so this entrance stops showing a queued
             payment after the server returns the already-paid activity. */
          this.applyPointClaims([Object.assign({},op.claim,{id:row.id,status:row.status,amount:0,duplicate_of:row.id})]);
        }
        this.applyPointClaims([Object.assign({},row,{awaiting_totals:row.status==="confirmed"||row.status==="pending"})]);
      }else if(op.type==="stars"&&this.points){
        const {data,error}=await this.supabase.rpc("points_legacy_award",{p_row:{id:op.id,kid_id:op.kid,delta:op.delta,reason:op.reason,unit_version:1}});
        if(error)throw error;
        const row=Array.isArray(data)?data[0]:data;
        if(row&&row.status)this.applyPointClaims([Object.assign({kid_id:op.kid,day:op.day||todayISO(),kind:"legacy",slot:op.id,work_id:"legacy:"+op.id},row,{legacy_id:op.id,awaiting_totals:row.status==="confirmed"||row.status==="pending"})]);
      }else if(op.type==="stars"){
        const {error}=await this.supabase.from("stars_ledger").insert({
          id:op.id,kid_id:op.kid,delta:op.delta,reason:op.reason,source:"app"
        });
        if(error&&error.code!=="23505") throw error;
      }else if(op.type==="questVerify"){
        const {error}=await this.supabase.from("asks").insert({
          id:op.id,kid_id:op.kid,kind:op.kind,body:op.body||null
        });
        if(error&&error.code!=="23505") throw error;
      }else if(op.type==="actDone"){
        const {error}=await this.supabase.from("act_done").upsert({
          kid_id:op.kid,day:op.day,act_idx:op.actIdx
        });
        if(error) throw error;
      }else if(op.type==="vocab"){
        const {error}=await this.supabase.from("vocab_mastery").upsert({
          kid_id:op.kid,word_key:op.wordKey,box:op.box,updated_at:new Date().toISOString()
        });
        if(error) throw error;
      }else if(op.type==="stat"){
        const {error}=await this.supabase.from("game_stats").upsert({
          kid_id:op.kid,stat:op.stat,value:op.value
        });
        if(error) throw error;
      }else if(op.type==="override"){
        if(op.t!=null){
          const {error}=await this.supabase.from("day_overrides").upsert({
            day:op.day,block_idx:op.blockIdx,kid_id:op.kidId||"all",t:op.t,
            updated_at:new Date().toISOString()
          });
          if(error) throw error;
        }else{
          const {error}=await this.supabase.from("day_overrides")
            .delete().eq("day",op.day).eq("block_idx",op.blockIdx).eq("kid_id",op.kidId||"all");
          if(error) throw error;
        }
      }else if(op.type==="outingBlock"){
        const {error}=await this.supabase.from("passes").insert({
          id:op.id,kid_id:op.kid,kind:"outing",status:"granted",
          day:op.day,block_idx:op.blockIdx,reason:op.reason||"Family outing 家庭出遊",
          credited:!!op.credited
        });
        if(error&&error.code!=="23505") throw error;
      }else if(op.type==="brainDone"){
        const {error}=await this.supabase.from("brain_done").upsert({
          kid_id:op.kid,day:op.day,game_id:op.gameId,score:op.score||0,ms:op.ms||null
        },{onConflict:"kid_id,day,game_id"});
        if(error) throw error;
      }else if(op.type==="guideDecision"){
        /* Home-help guide decisions are a shared cache (games-gate-ai-guide D8).
           They must never hold up ticks or points: when the server refuses one
           (e.g. the table is not deployed yet) the op is dropped and the tablet
           keeps its copy. A lost connection (no error code) retries later. */
        const {error}=await this.supabase.from("guide_decisions").upsert(op.row,{onConflict:"kid_id,day,slot,reroll",ignoreDuplicates:true});
        guideSyncError(error,"Guide decision not synced");
      }else if(op.type==="guideStarted"){
        const {error}=await this.supabase.from("guide_decisions").update({started_id:op.startedId})
          .eq("kid_id",op.key.kid_id).eq("day",op.key.day).eq("slot",op.key.slot).eq("reroll",op.key.reroll);
        guideSyncError(error,"Guide start not synced");
      }else if(op.type==="famset"){
        /* update, not upsert — anon RLS only allows clearing applock_* keys */
        const {error}=await this.supabase.from("family_settings")
          .update({value:op.value,updated_at:new Date().toISOString()}).eq("key",op.key);
        if(error) throw error;
      }
    }

    async tick(kid,dayISO,blockIdx,ticked){
      this.enqueue({type:"tick",kid,day:dayISO,blockIdx,ticked});
      this.flush().catch(()=>{});
    }
    async roll(kid,dayISO,blockIdx){
      this.enqueue({type:"roll",kid,day:dayISO,blockIdx,count:1});
      this.flush().catch(()=>{});
    }
    async setOverride(dayISO,blockIdx,t,kidId){
      kidId=kidId||"all";
      const bucket=this.dayOverridesRaw[kidId]=this.dayOverridesRaw[kidId]||{};
      if(t!=null)bucket[blockIdx]=t; else delete bucket[blockIdx];
      saveJson("sq:dayOverrides",{d:dayISO,map:this.dayOverridesRaw});
      this.enqueue({type:"override",day:dayISO,blockIdx:blockIdx,t:t,kidId:kidId});
      this.flush().catch(()=>{});
    }
    async setFamilySetting(key,value){
      this.familySettings[key]=value;
      saveJson("sq:famSettings",this.familySettings);
      this.enqueue({type:"famset",key,value});
      this.flush().catch(()=>{});
    }
    /* Only a configured tablet queues these: local-only mode keeps the guide's
       own localStorage copy and has nowhere to send them. */
    saveGuideDecision(dec,started){
      if(!this.configured)return;
      if(started){
        this.enqueue({type:"guideStarted",key:{kid_id:dec.kid_id,day:dec.day,slot:dec.slot,reroll:dec.reroll},startedId:dec.started_id});
      }else{
        this.enqueue({type:"guideDecision",row:{kid_id:dec.kid_id,day:dec.day,slot:dec.slot,reroll:dec.reroll,answers:dec.answers,picks:dec.picks,source:"local",started_id:null}});
      }
      this.flush().catch(()=>{});
    }
    async markBrainDone(kid,dayISO,gameId,score,ms){
      this.enqueue({type:"brainDone",kid,day:dayISO,gameId,score,ms});
      this.flush().catch(()=>{});
    }
    /* Papa's "open games today" (Brain Gym and points gates both, games-gate D7) — the anon RLS policy only lets the tablet write
       braingate_* keys, and setFamilySetting already updates locally first, so
       the gate opens instantly with wifi off. */
    async clearBrainGate(kid,dayISO){
      await this.setFamilySetting("braingate_"+kid,dayISO);
    }
    /* `id` is optional and only passed for stars that must happen at most once —
       see js/star-id.js. It becomes the stars_ledger primary key, so a repeat is
       a 23505 the server rejects rather than a second star. */
    async addStars(kid,delta,reason,id){
      if(this.points){
        /* Compatibility for already loaded legacy callers. New actions use the
           canonical task, so the old flat-block/full-day payouts cannot stack. */
        const parsed=window.SQStarId&&window.SQStarId.parse(id);
        if(parsed&&parsed.kind==="block"){
          return Promise.all(this.points.block(parsed.slot).map(task=>this.awardPoints(kid,task.kind,{day:parsed.day,slot:task.slot,evidence:{source:"schedule",block_idx:parsed.slot}})));
        }
        if(parsed&&(parsed.kind==="brain"||parsed.kind==="bonus"))return;
        throw new Error("Use a defined points task; legacy balances migrate through the saved queue");
      }
      if(!this.configured){
        /* No server exists and never will. The local cache is the ledger, so the
           kid still earns stars in a clean local-only deploy — including the PK
           dedup, which there is nothing else to enforce. */
        if(id){
          if(this.localStarIds.indexOf(id)>=0)return;
          this.localStarIds.push(id);
          saveJson("sq:localStarIds",this.localStarIds);
        }
        this.serverStars[kid]=(this.serverStars[kid]||0)+delta;
        saveJson("sq:serverStars",this.serverStars);
        this.announceStars(kid,delta,reason);
        return;
      }
      /* Two pending inserts of one id can only ever become one row, so counting
         both in starsFor() would just show a number that later drops. */
      if(id&&this.queue.some(function(op){return op&&op.type==="stars"&&op.id===id;}))return;
      const op={type:"stars",kid,delta,reason};
      if(id)op.id=id;
      this.enqueue(op);
      /* after enqueue, before flush: starsFor() already counts it, so the
         notification and the number a kid sees can never disagree */
      this.announceStars(kid,delta,reason);
      this.flush().catch(()=>{});
    }
    /* The one place every self-earned star passes through. index.html sets
       onLocalStars to raise the toast — admin grants arrive over realtime
       instead and are announced there. */
    announceStars(kid,delta,reason){
      if(typeof this.onLocalStars!=="function")return;
      try{this.onLocalStars(kid,delta,reason);}catch(e){}
    }
    async actDone(kid,dayISO,actIdx){
      this.enqueue({type:"actDone",kid,day:dayISO,actIdx});
      this.flush().catch(()=>{});
    }
    async setVocab(kid,wordKey,box){
      this.enqueue({type:"vocab",kid,wordKey,box});
      this.flush().catch(()=>{});
    }
    async setStat(kid,stat,value){
      this.enqueue({type:"stat",kid,stat,value});
      this.flush().catch(()=>{});
    }
    async createAsk(kid,kind,body,audioBlob){
      if(!this.supabase) return {error:new Error("Sync is offline")};
      let audio_path=null;
      if(audioBlob){
        audio_path=`asks/${kid}-${Date.now()}.webm`;
        const up=await this.supabase.storage.from("voices").upload(audio_path,audioBlob,{contentType:"audio/webm",upsert:false});
        if(up.error) return up;
      }
      return this.supabase.from("asks").insert({kid_id:kid,kind,body:body||null,audio_path});
    }
    async requestQuestVerification(kid,questId,day,body){
      const id=uuid();
      const kind=`quest_verify:${questId}:${day}`;
      /* Verification is an offline-safe intent. When Supabase is configured but
         unreachable it sits in the same durable queue as stars/ticks and is sent
         when connectivity returns. In a permanently local-only installation it
         remains a local waiting state until sync is configured. */
      if(this.configured){
        this.enqueue({type:"questVerify",id:id,kid:kid,kind:kind,body:body||null});
        this.flush().catch(()=>{});
      }
      return {data:{id:id,kind:kind},error:null,queued:!!this.configured,localOnly:!this.configured};
    }
    async fetchQuestVerifications(kid,day){
      if(!this.supabase)return [];
      const pattern=`quest_verify:%:${day}`;
      const {data,error}=await this.supabase.from("asks").select("id,kid_id,kind,body,answer,answered_at,created_at").eq("kid_id",kid).like("kind",pattern).order("created_at",{ascending:false});
      if(error)throw error;
      return data||[];
    }
    async requestPass(kid,kind,day,blockIdx,reason){
      if(!this.supabase) return {error:new Error("Sync is offline")};
      return this.supabase.from("passes").insert({kid_id:kid,kind,status:"requested",day,block_idx:blockIdx,reason});
    }
    async setOuting(kids,dayISO,blockIdxs,credited,reason){
      kids.forEach(kid=>blockIdxs.forEach(blockIdx=>{
        this.enqueue({type:"outingBlock",kid:kid,day:dayISO,blockIdx:blockIdx,credited:credited,reason:reason});
        this.passes.unshift({kid_id:kid,kind:"outing",status:"granted",day:dayISO,block_idx:blockIdx,credited:!!credited,reason:reason});
        if(credited&&!this.points)this.enqueue({type:"stars",kid:kid,delta:1,
          reason:"Outing 出遊 · "+(reason||"Family outing 家庭出遊")});
      }));
      this.flush().catch(()=>{});
    }
    async spendPass(id,day,blockIdx){
      if(!this.supabase) return {error:new Error("Sync is offline")};
      return this.supabase.from("passes").update({status:"spent",day,block_idx:blockIdx}).eq("id",id);
    }
    async uploadProof(kid,day,blockIdx,file){
      if(!this.supabase) return {error:new Error("Sync is offline")};
      const ext=(file.name&&file.name.split(".").pop())||"jpg";
      const path=`${kid}/${day}-${blockIdx}-${Date.now()}.${ext}`;
      const up=await this.supabase.storage.from("proofs").upload(path,file,{contentType:file.type||"image/jpeg",upsert:false});
      if(up.error) return up;
      return this.supabase.from("photos").insert({kid_id:kid,day,block_idx:blockIdx,path});
    }
    async logSearch(kid,query,engine){
      if(!this.supabase||!query) return;
      await this.supabase.from("search_log").insert({kid_id:kid,query,engine});
    }
    async createHelpClaim(captainId,helpedKidId,day,body){
      if(!this.supabase) return {error:new Error("Sync is offline")};
      return this.supabase.from("help_claims").insert({
        captain_id:captainId,helped_kid_id:helpedKidId,day,body,status:"requested"
      });
    }
    onStars(cb){
      if(!this.supabase) return ()=>{};
      const ch=this.supabase.channel(`stars-${Date.now()}`)
        .on("postgres_changes",{event:"*",schema:"public",table:"stars_ledger"},p=>cb(p.new||p.old,p.eventType))
        .subscribe();
      return ()=>this.supabase.removeChannel(ch);
    }
    onPoints(cb){
      if(!this.supabase||!this.points)return ()=>{};
      const ch=this.supabase.channel(`points-${Date.now()}`);
      ["points_claims","points_assignments","points_requests"].forEach(table=>ch.on("postgres_changes",{event:"*",schema:"public",table:table},p=>cb(p.new||p.old,p.eventType)));
      ch.subscribe();
      return ()=>this.supabase.removeChannel(ch);
    }
    onAsks(cb){
      if(!this.supabase) return ()=>{};
      const ch=this.supabase.channel(`asks-${Date.now()}`)
        .on("postgres_changes",{event:"*",schema:"public",table:"asks"},p=>cb(p.new||p.old))
        .subscribe();
      return ()=>this.supabase.removeChannel(ch);
    }
    onPasses(cb){
      if(!this.supabase) return ()=>{};
      const ch=this.supabase.channel(`passes-${Date.now()}`)
        .on("postgres_changes",{event:"*",schema:"public",table:"passes"},p=>cb(p.new||p.old))
        .subscribe();
      return ()=>this.supabase.removeChannel(ch);
    }
    onOverrides(cb){
      if(!this.supabase) return ()=>{};
      const ch=this.supabase.channel(`overrides-${Date.now()}`)
        .on("postgres_changes",{event:"*",schema:"public",table:"day_overrides"},p=>cb(p.new||p.old))
        .subscribe();
      return ()=>this.supabase.removeChannel(ch);
    }
    /* Papa accepting or undoing a block in the admin panel is a day_ticks write
       and nothing else. Without this channel the tablet only learned about it on
       the next hydrate — so an accepted block stayed open (games still locked)
       and an undone one stayed ticked, sometimes for hours. Send back appeared
       to work only because it also writes day_redos, which does have a channel. */
    onTicks(cb){
      if(!this.supabase) return ()=>{};
      const ch=this.supabase.channel(`ticks-${Date.now()}`)
        .on("postgres_changes",{event:"*",schema:"public",table:"day_ticks"},p=>cb(p.new||p.old,p.eventType))
        .subscribe();
      return ()=>this.supabase.removeChannel(ch);
    }
    onRedos(cb){
      if(!this.supabase) return ()=>{};
      const ch=this.supabase.channel(`redos-${Date.now()}`)
        .on("postgres_changes",{event:"*",schema:"public",table:"day_redos"},p=>cb(p.new||p.old))
        .subscribe();
      return ()=>this.supabase.removeChannel(ch);
    }
    onFamilySettings(cb){
      if(!this.supabase) return ()=>{};
      const ch=this.supabase.channel(`famset-${Date.now()}`)
        .on("postgres_changes",{event:"*",schema:"public",table:"family_settings"},p=>{
          const row=p.new||p.old;
          if(this.points&&row.key==="points_policy_v1"){
            this.familySettings[row.key]=row.value;
            this.familySettings.points_policy_updated_at=row.updated_at;
            saveJson("sq:famSettings",this.familySettings);
          }
          cb(row);
        })
        .subscribe();
      return ()=>this.supabase.removeChannel(ch);
    }
    onBrainDone(cb){
      if(!this.supabase) return ()=>{};
      const ch=this.supabase.channel(`brain-${Date.now()}`)
        .on("postgres_changes",{event:"*",schema:"public",table:"brain_done"},p=>cb(p.new||p.old,p.eventType))
        .subscribe();
      return ()=>this.supabase.removeChannel(ch);
    }
    onKids(cb){
      if(!this.supabase) return ()=>{};
      const ch=this.supabase.channel(`kids-${Date.now()}`)
        .on("postgres_changes",{event:"UPDATE",schema:"public",table:"kids"},p=>cb(p.new))
        .subscribe();
      return ()=>this.supabase.removeChannel(ch);
    }
    onHelpClaims(cb){
      if(!this.supabase) return ()=>{};
      const ch=this.supabase.channel(`help-claims-${Date.now()}`)
        .on("postgres_changes",{event:"*",schema:"public",table:"help_claims"},p=>cb(p.new||p.old))
        .subscribe();
      return ()=>this.supabase.removeChannel(ch);
    }
  }

  SyncStore.setBestStatCheck=function(fn){
    bestStatCheck=typeof fn==="function"?fn:null;
  };

  if(typeof window!=="undefined")window.SyncStore=SyncStore;
  if(typeof module!=="undefined"&&module.exports)module.exports=SyncStore;
})();
