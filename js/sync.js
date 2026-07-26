(function(){
  const STORAGE_KEY="keyquest:v2";
  const QUEUE_KEY="sq:queue";
  const SUPABASE_CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  const KIDS=["lucien","lili","luis"];

  /* A "best score" stat: the six existing games, or any brain-gym key.
     Prefix rule on purpose — adding a brain game must not require editing sync.js. */
  function isBestStat(key){
    return key==="balloon"||key==="race"||key==="orc"||key==="shop"||
      key==="city"||key==="dig"||key.indexOf("brain_")===0;
  }

  const clone=value=>JSON.parse(JSON.stringify(value));
  const uuid=()=>crypto.randomUUID?crypto.randomUUID():
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

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      if(window.supabase) return resolve();
      const existing=document.querySelector(`script[src="${src}"]`);
      if(existing){
        existing.addEventListener("load",resolve,{once:true});
        existing.addEventListener("error",reject,{once:true});
        return;
      }
      const s=document.createElement("script");
      s.src=src; s.onload=resolve; s.onerror=reject;
      document.head.appendChild(s);
    });
  }

  async function createSupabaseClient(){
    const cfg=window.SQ_CONFIG;
    if(!cfg||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY) return null;
    try{
      await loadScript(SUPABASE_CDN);
      return window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    }catch(e){
      return null;
    }
  }

  function ensureKid(progress,kid){
    progress[kid]=progress[kid]||{stars:0,best:{},vocab:{},missions:0,day:{d:"",done:{},rr:{}}};
    const p=progress[kid];
    p.best=p.best&&typeof p.best==="object"?p.best:{};
    p.best.balloon=p.best.balloon||0;
    p.best.race=p.best.race||0;
    p.best.orc=p.best.orc||0;
    p.best.shop=p.best.shop||0;
    p.best.city=p.best.city||0;
    p.best.dig=p.best.dig||0;
    p.vocab=p.vocab||{};
    p.missions=p.missions||0;
    p.day=p.day||{d:"",done:{},rr:{}};
    p.day.done=p.day.done||{};
    p.day.rr=p.day.rr||{};
    p.actsDay=p.actsDay||{d:"",done:{}};
    p.actsDay.done=p.actsDay.done||{};
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
      this.queue=loadJson(QUEUE_KEY,[]);
      this.kidPins=loadJson("sq:kidPins",{});
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
    }

    static async init(seed){
      const local=loadJson(STORAGE_KEY,null);
      const progress=local&&local.progress?local.progress:clone(seed.progress);
      const settings=local&&local.settings?Object.assign(clone(seed.settings),local.settings):clone(seed.settings);
      const client=await createSupabaseClient();
      const store=new SyncStore({progress,settings},client);
      if(client) await store.hydrate();
      store.persistLocal();
      store.last=clone(store.progress);
      store.startFlush();
      return store;
    }

    startFlush(){
      if(!this.supabase) return;
      addEventListener("online",()=>this.flush());
      this.flushTimer=setInterval(()=>this.flush(),30000);
      this.flush();
    }

    persistLocal(){
      saveJson(STORAGE_KEY,{progress:this.progress,settings:this.settings});
    }

    async hydrate(){
      const day=todayISO();
      const p=normalize(this.progress);

      const [{data:kids},{data:ticks},{data:rolls},{data:acts},{data:totals},{data:vocab},{data:stats},{data:note},{data:passes},{data:photos},{data:helpClaims},{data:famSettings},{data:overrides},{data:redos}]=await Promise.all([
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
        this.supabase.from("family_settings").select("key,value"),
        this.supabase.from("day_overrides").select("kid_id,block_idx,t").eq("day",day),
        this.supabase.from("day_redos").select("kid_id,block_idx,note").eq("day",day),
      ]);

      this.kidPins={};
      (kids||[]).forEach(r=>{if(r.pin)this.kidPins[r.id]=r.pin;});
      saveJson("sq:kidPins",this.kidPins);
      this.passes=passes||[];
      this.photos=photos||[];
      this.helpClaims=helpClaims||[];
      if(Array.isArray(famSettings)){
        this.familySettings={};
        famSettings.forEach(r=>{this.familySettings[r.key]=r.value;});
        saveJson("sq:famSettings",this.familySettings);
      }
      this.adminPin=this.familySettings.admin_pin||"";
      saveJson("sq:adminPin",this.adminPin);
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
      });
      (ticks||[]).forEach(r=>{ensureKid(p,r.kid_id); p[r.kid_id].day.done[r.block_idx]=true;});
      (rolls||[]).forEach(r=>{ensureKid(p,r.kid_id); p[r.kid_id].day.rr[r.block_idx]=r.count||0;});
      (acts||[]).forEach(r=>{ensureKid(p,r.kid_id); p[r.kid_id].actsDay.done[r.act_idx]=true;});
      (totals||[]).forEach(r=>{ensureKid(p,r.kid_id); p[r.kid_id].stars=r.stars||0;});
      (vocab||[]).forEach(r=>{ensureKid(p,r.kid_id); p[r.kid_id].vocab[r.word_key]=r.box||0;});
      (stats||[]).forEach(r=>{
        ensureKid(p,r.kid_id);
        if(isBestStat(r.stat)) p[r.kid_id].best[r.stat]=r.value||0;
        if(r.stat==="missions") p[r.kid_id].missions=r.value||0;
      });
      this.papaNote=note&&note.body?note.body:"";

      // spec: hydration merges server rows, then the local queue replays anything pending
      this.queue.forEach(op=>{
        if(!op||!op.kid) return;
        ensureKid(p,op.kid);
        const P=p[op.kid];
        if(op.type==="tick"&&op.day===day){
          if(op.ticked) P.day.done[op.blockIdx]=true; else delete P.day.done[op.blockIdx];
        }else if(op.type==="roll"&&op.day===day){
          P.day.rr[op.blockIdx]=Math.max(P.day.rr[op.blockIdx]||0,op.count||0);
        }else if(op.type==="actDone"&&op.day===day){
          P.actsDay.done[op.actIdx]=true;
        }else if(op.type==="stars"){
          P.stars=(P.stars||0)+(op.delta||0);
        }else if(op.type==="vocab"){
          P.vocab[op.wordKey]=op.box||0;
        }else if(op.type==="stat"){
          if(op.stat==="missions") P.missions=op.value||0; else P.best[op.stat]=op.value||0;
        }
      });

      /* Server is now the truth for this device: re-baseline the diff. Without this,
         an admin correction (revoked star, un-ticked activity) leaves `last` holding
         the pre-correction values, so redoing the activity looks like "no change" and
         never syncs — and an admin star grant gets counted a second time. */
      this.last=clone(this.progress);
      this.persistLocal();

      await this.flush();
    }

    async save(progress,settings,starReasons){
      this.progress=normalize(progress);
      this.settings=settings;
      this.persistLocal();
      if(this.supabase) this.enqueueDiff(this.last,this.progress,starReasons);
      this.last=clone(this.progress);
      await this.flush();
    }

    enqueue(op){
      this.queue.push(Object.assign({id:uuid()},op));
      saveJson(QUEUE_KEY,this.queue);
    }

    enqueueDiff(before,after,starReasons){
      const day=todayISO();
      const reasonsByKid={};
      (starReasons||[]).forEach(r=>{
        if(!r||!r.kid||!r.delta)return;
        const list=reasonsByKid[r.kid]=reasonsByKid[r.kid]||[];
        for(let i=0;i<r.delta;i++)list.push(r.reason||"App progress app進度");
      });
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
          if(!!aActs[i]&&!bActs[i]) this.enqueue({type:"actDone",kid,day:ad,actIdx:+i});
        });

        let delta=(a.stars||0)-(b.stars||0);
        const starReasonsForKid=reasonsByKid[kid]||[];
        while(delta>0){
          if(!starReasonsForKid.length){
            const chunk=Math.min(delta,3);
            this.enqueue({type:"stars",kid,delta:chunk,reason:"App progress app進度"});
            delta-=chunk;
            continue;
          }
          const reason=starReasonsForKid.shift()||"App progress app進度";
          let chunk=1;
          while(chunk<delta&&starReasonsForKid[0]===reason){
            starReasonsForKid.shift();
            chunk++;
          }
          this.enqueue({type:"stars",kid,delta:chunk,reason});
          delta-=chunk;
        }

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

    async flush(){
      if(!this.supabase||!navigator.onLine||!this.queue.length) return;
      const pending=[...this.queue];
      for(const op of pending){
        try{
          await this.applyOp(op);
          this.queue=this.queue.filter(q=>q.id!==op.id);
          saveJson(QUEUE_KEY,this.queue);
        }catch(e){
          return;
        }
      }
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
      }else if(op.type==="stars"){
        const {error}=await this.supabase.from("stars_ledger").insert({
          id:op.id,kid_id:op.kid,delta:op.delta,reason:op.reason,source:"app"
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
      }else if(op.type==="famset"){
        /* update, not upsert — anon RLS only allows clearing applock_* keys */
        const {error}=await this.supabase.from("family_settings")
          .update({value:op.value,updated_at:new Date().toISOString()}).eq("key",op.key);
        if(error) throw error;
      }
    }

    async tick(kid,dayISO,blockIdx,ticked){
      this.enqueue({type:"tick",kid,day:dayISO,blockIdx,ticked});
      await this.flush();
    }
    async roll(kid,dayISO,blockIdx){
      this.enqueue({type:"roll",kid,day:dayISO,blockIdx,count:1});
      await this.flush();
    }
    async setOverride(dayISO,blockIdx,t,kidId){
      kidId=kidId||"all";
      const bucket=this.dayOverridesRaw[kidId]=this.dayOverridesRaw[kidId]||{};
      if(t!=null)bucket[blockIdx]=t; else delete bucket[blockIdx];
      saveJson("sq:dayOverrides",{d:dayISO,map:this.dayOverridesRaw});
      this.enqueue({type:"override",day:dayISO,blockIdx:blockIdx,t:t,kidId:kidId});
      await this.flush();
    }
    async setFamilySetting(key,value){
      this.familySettings[key]=value;
      saveJson("sq:famSettings",this.familySettings);
      this.enqueue({type:"famset",key,value});
      await this.flush();
    }
    async addStars(kid,delta,reason){
      this.enqueue({type:"stars",kid,delta,reason});
      await this.flush();
    }
    async actDone(kid,dayISO,actIdx){
      this.enqueue({type:"actDone",kid,day:dayISO,actIdx});
      await this.flush();
    }
    async setVocab(kid,wordKey,box){
      this.enqueue({type:"vocab",kid,wordKey,box});
      await this.flush();
    }
    async setStat(kid,stat,value){
      this.enqueue({type:"stat",kid,stat,value});
      await this.flush();
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
    async requestPass(kid,kind,day,blockIdx,reason){
      if(!this.supabase) return {error:new Error("Sync is offline")};
      return this.supabase.from("passes").insert({kid_id:kid,kind,status:"requested",day,block_idx:blockIdx,reason});
    }
    async setOuting(kids,dayISO,blockIdxs,credited,reason){
      kids.forEach(kid=>blockIdxs.forEach(blockIdx=>{
        this.enqueue({type:"outingBlock",kid:kid,day:dayISO,blockIdx:blockIdx,credited:credited,reason:reason});
        this.passes.unshift({kid_id:kid,kind:"outing",status:"granted",day:dayISO,block_idx:blockIdx,credited:!!credited,reason:reason});
        if(credited)this.enqueue({type:"stars",kid:kid,delta:1,reason:"Outing 出遊"});
      }));
      await this.flush();
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
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"stars_ledger"},p=>cb(p.new))
        .subscribe();
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
        .on("postgres_changes",{event:"*",schema:"public",table:"family_settings"},p=>cb(p.new||p.old))
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

  window.SyncStore=SyncStore;
})();
