/* SQStarId — one star per (kid, day, block), keyed by the ledger's own primary key.

   The same block always maps to the same uuid, whoever writes the row: the kid's
   tablet on tick, or Papa's Accept. That makes granting idempotent (a re-tick or
   a double-click hits 23505 instead of minting a second star) and, more
   importantly, makes revoking exact: undo/send-back/reset delete THAT id, which
   removes the star when one exists and does nothing when it doesn't. Before this,
   the revoke paths inserted a -1 for every ticked mission block whether or not a
   +1 had ever been granted, so a block the kid ticked themselves could only ever
   lose stars.

   Deleting is also what lets a sent-back block be re-earned: the row is gone, so
   the kid's next tick inserts it again cleanly.

   The id is the fields written out, not a hash — every segment is decimal digits,
   which are already valid hex, so a row's origin is readable straight off the
   ledger. The prefix keeps these clear of gen_random_uuid() rows. */
(function(){
  /* Fixed: this is an id encoding, not a display order. Never reorder — doing so
     silently re-points every historical id at a different kid. */
  const KID_SLOT={lucien:1,lili:2,luis:3};
  const SLOT_KID={1:"lucien",2:"lili",3:"luis"};
  /* The day-complete bonus is not a block, so it gets a slot no block index can
     reach (DAY is 16 long). */
  const BONUS_SLOT=999;

  function starId(kid,dayISO,slot){
    const k=KID_SLOT[kid];
    if(!k)return null;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dayISO||"")))return null;
    if(!(slot>=0&&slot<1e12))return null;
    return "b10c57a2-"+dayISO.slice(0,4)+"-"+dayISO.slice(5,7)+dayISO.slice(8,10)+
      "-"+String(k).padStart(4,"0")+"-"+String(slot).padStart(12,"0");
  }

  /* What covering a block is worth. Papa's Accept, the kid's tick and a credited
     Remove all ask this one function: three inline copies of `kind==="mission"`
     is what let Remove mint a star on a routine block that Accept never grants,
     so Remove → Add back → Accept lost a star nothing could give back. The
     amount lives beside the id because the id is what the amount is keyed to. */
  const BONUS_DELTA=2;

  const api={
    block:function(kid,dayISO,blockIdx){return starId(kid,dayISO,blockIdx);},
    bonus:function(kid,dayISO){return starId(kid,dayISO,BONUS_SLOT);},
    blockDelta:function(block){return block&&block.kind==="mission"?1:0;},
    BONUS_DELTA:BONUS_DELTA,
    parse:function(id){
      const m=String(id||"").match(/^b10c57a2-(\d{4})-(\d{2})(\d{2})-(\d{4})-(\d{12})$/);
      if(!m)return null;
      const kid=SLOT_KID[+m[4]], day=m[1]+"-"+m[2]+"-"+m[3], slot=+m[5];
      if(!kid)return null;
      if(starId(kid,day,slot)!==id)return null;
      return {kid:kid,day:day,slot:slot,kind:slot===BONUS_SLOT?"bonus":"block"};
    }
  };
  if(typeof window!=="undefined")window.SQStarId=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
