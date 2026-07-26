(function(){
  const STORAGE_KEY="keyquest:v2";
  const QUEUE_KEY="sq:queue";
  const SUPABASE_CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  const KIDS=["lucien","lili","luis"];

  const clone=value=>JSON.parse(JSON.stringify(value));
  const uuid=()=>crypto.randomUUID?crypto.randomUUID():
    "10000000-1000-4000-8000-100000000000".replace(/[018]/g,c=>
      (c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));

  function todayISO(){
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

      const [{data:ticks},{data:rolls},{data:acts},{data:totals},{data:vocab},{data:stats},{data:note}]=await Promise.all([
        this.supabase.from("day_ticks").select("kid_id,block_idx").eq("day",day),
        this.supabase.from("day_rolls").select("kid_id,block_idx,count").eq("day",day),
        this.supabase.from("act_done").select("kid_id,act_idx").eq("day",day),
        this.supabase.from("star_totals").select("kid_id,stars"),
        this.supabase.from("vocab_mastery").select("kid_id,word_key,box"),
        this.supabase.from("game_stats").select("kid_id,stat,value"),
        this.supabase.from("papa_notes").select("body").eq("day",day).maybeSingle(),
      ]);

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
        if(["balloon","race","orc","shop"].includes(r.stat)) p[r.kid_id].best[r.stat]=r.value||0;
        if(r.stat==="missions") p[r.kid_id].missions=r.value||0;
      });
      this.papaNote=note&&note.body?note.body:"";

      await this.flush();
    }

    async save(progress,settings){
      this.progress=normalize(progress);
      this.settings=settings;
      this.persistLocal();
      if(this.supabase) this.enqueueDiff(this.last,this.progress);
      this.last=clone(this.progress);
      await this.flush();
    }

    enqueue(op){
      this.queue.push(Object.assign({id:uuid()},op));
      saveJson(QUEUE_KEY,this.queue);
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
          if(!!aActs[i]&&!bActs[i]) this.enqueue({type:"actDone",kid,day:ad,actIdx:+i});
        });

        let delta=(a.stars||0)-(b.stars||0);
        while(delta>0){
          const chunk=Math.min(delta,3);
          this.enqueue({type:"stars",kid,delta:chunk,reason:"app progress"});
          delta-=chunk;
        }

        const av=a.vocab||{}, bv=b.vocab||{};
        Object.keys(av).forEach(wordKey=>{
          if((av[wordKey]||0)!==(bv[wordKey]||0)) this.enqueue({type:"vocab",kid,wordKey,box:av[wordKey]||0});
        });

        const ab=a.best||{}, bb=b.best||{};
        ["balloon","race","orc","shop"].forEach(stat=>{
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
    onStars(){ return ()=>{}; }
  }

  window.SyncStore=SyncStore;
})();
