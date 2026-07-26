(function(){
  const STORAGE_KEY="keyquest:v2";

  const clone=value=>JSON.parse(JSON.stringify(value));

  class LocalSyncStore{
    constructor(seed){
      this.mode="local-only";
      this.progress=seed.progress;
      this.settings=seed.settings;
    }

    static async init(seed){
      const store=new LocalSyncStore({
        progress:clone(seed.progress),
        settings:clone(seed.settings),
      });
      try{
        const raw=localStorage.getItem(STORAGE_KEY);
        if(raw){
          const data=JSON.parse(raw);
          if(data.progress) store.progress=data.progress;
          if(data.settings) store.settings=Object.assign(store.settings,data.settings);
        }
      }catch(e){}
      if(seed.normalizeProgressShape) seed.normalizeProgressShape.call({progress:store.progress});
      return store;
    }

    async save(progress,settings){
      this.progress=progress;
      this.settings=settings;
      try{ localStorage.setItem(STORAGE_KEY,JSON.stringify({progress,settings})); }catch(e){}
    }

    async tick(){ await this.save(this.progress,this.settings); }
    async roll(){ await this.save(this.progress,this.settings); }
    async addStars(){ await this.save(this.progress,this.settings); }
    async actDone(){ await this.save(this.progress,this.settings); }
    async setVocab(){ await this.save(this.progress,this.settings); }
    async setStat(){ await this.save(this.progress,this.settings); }
    onStars(){ return ()=>{}; }
  }

  window.SyncStore=LocalSyncStore;
})();
