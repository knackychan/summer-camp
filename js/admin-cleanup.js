/* SQAdminCleanup — pure helpers for Admin → Settings → Clean up
   (docs/plans/2026-10-09-admin-cleanup/ design D5, D6). No DOM, no network:
   admin.js passes the rows it already loaded and wires the result to the page.
   Admin chrome is English-only (D23). Shared by admin.html and tests. */
(function(){
  const KIDS=[["luis","Luis"],["lili","Lili"],["lucien","Lucien"]];
  const CATEGORIES=[
    {id:"asks",label:"Messages",noun:["message","messages"],bucket:"voices"},
    {id:"kid_chats",label:"Summer chats",noun:["chat message","chat messages"],bucket:null},
    {id:"photos",label:"Photos",noun:["photo","photos"],bucket:"proofs"},
    {id:"passes",label:"Passes",noun:["pass","passes"],bucket:null}
  ];
  function category(id){return CATEGORIES.find(function(c){return c.id===id;})||CATEGORIES[0];}
  function kidName(id){const k=KIDS.find(function(x){return x[0]===id;});return k?k[1]:String(id||"");}
  function plural(n,noun){return n+" "+(n===1?noun[0]:noun[1]);}
  function asSet(v){return v instanceof Set?v:new Set(v||[]);}
  function when(iso){
    if(!iso)return "";
    const d=new Date(iso);
    if(isNaN(d))return "";
    return d.toLocaleString("en-GB",{timeZone:"Asia/Taipei",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
  }
  function firstLine(s){return String(s||"").split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean)[0]||"";}

  /* One row per deletable database row, newest first, filtered by kid.
     data: {asks, archivedIds, rewardIds, kidChats, photos, passes, blockTitle(i)} */
  function buildRows(cat,data,filters){
    data=data||{};
    const kid=filters&&filters.kid&&filters.kid!=="all"?filters.kid:null;
    let out=[];
    if(cat==="asks"){
      const archived=asSet(data.archivedIds), reward=asSet(data.rewardIds);
      out=(data.asks||[]).map(function(a){
        const lines=[];
        if(a.answer)lines.push("Papa: "+firstLine(a.answer));
        else if(a.answer_audio_path)lines.push("Papa: voice reply");
        const tags=[];
        if(archived.has(a.id))tags.push("Archived");
        const isReward=reward.has(a.id)||String(a.kind||"").indexOf("reward:")===0;
        if(isReward)tags.push("Reward");
        return {id:a.id,kid:a.kid_id,at:a.created_at,text:firstLine(a.body)||(a.audio_path?"Voice memo":"(empty)"),lines:lines,tags:tags,archived:archived.has(a.id),reward:isReward};
      });
    }else if(cat==="kid_chats"){
      out=(data.kidChats||[]).map(function(c){
        return {id:String(c.id),kid:c.kid_id,at:c.created_at,group:c.session_id||"",text:firstLine(c.kid_text),lines:["Summer: "+firstLine(c.reply_en)],tags:c.flagged?["Flagged"]:[]};
      });
    }else if(cat==="photos"){
      const title=typeof data.blockTitle==="function"?data.blockTitle:null;
      out=(data.photos||[]).map(function(p){
        const block=p.block_idx==null?"Dinner gallery":(title&&title(p.block_idx))||("Block "+(Number(p.block_idx)+1));
        return {id:p.id,kid:p.kid_id,at:p.created_at,text:String(p.day||"")+" · "+block,lines:[],tags:[],path:p.path};
      });
    }else if(cat==="passes"){
      out=(data.passes||[]).map(function(p){
        const kind=p.kind==="excused"?"Excused pass":p.kind==="golden"?"Golden pass":String(p.kind||"Pass");
        return {id:p.id,kid:p.kid_id,at:p.created_at,text:kind+" · "+String(p.status||""),lines:p.reason?[firstLine(p.reason)]:[],tags:p.status==="spent"?["Spent"]:[]};
      });
    }
    if(kid)out=out.filter(function(r){return r.kid===kid;});
    out.sort(function(a,b){return String(b.at||"").localeCompare(String(a.at||""));});
    /* chats read as conversations: a row starts a group when its session changes */
    if(cat==="kid_chats")out.forEach(function(r,i){r.groupStart=i===0||out[i-1].group!==r.group;});
    return out;
  }

  /* Selection is a Set of ids; every helper returns a new Set. */
  function toggle(sel,id){const s=new Set(sel);if(s.has(id))s.delete(id);else s.add(id);return s;}
  function allSelected(rows,sel){return rows.length>0&&rows.every(function(r){return sel.has(r.id);});}
  function toggleAll(rows,sel){return allSelected(rows,sel)?new Set():new Set(rows.map(function(r){return r.id;}));}
  /* drop ids no longer shown (kid filter changed, rows deleted elsewhere) */
  function prune(rows,sel){const shown=new Set(rows.map(function(r){return r.id;}));return new Set([].concat(Array.from(sel)).filter(function(id){return shown.has(id);}));}

  /* Confirm card wording. action: "selected" | "clear" | "archived". */
  function confirmText(o){
    const c=category(o.category), who=o.kid&&o.kid!=="all"?kidName(o.kid):"every kid";
    let head;
    if(o.action==="selected")head="Delete "+plural(o.count,c.noun)+".";
    else if(o.action==="archived")head="Delete every archived message for "+who+", including older ones not listed here.";
    else head="Delete every "+c.noun[0]+" for "+who+", including older ones not listed here.";
    const notes=[];
    if(c.id==="asks"&&o.rewardCount>0)notes.push(plural(o.rewardCount,["reward request","reward requests"])+" will be kept — reset points first to remove "+(o.rewardCount===1?"it":"them")+".");
    else if(c.id==="asks"&&o.action!=="selected")notes.push("Reward requests are kept — reset points first to remove them.");
    if(c.id==="passes")notes.push("A spent pass is removed as a row only — the day it excused is not recomputed.");
    if(c.bucket)notes.push("Their files are removed from Storage too.");
    notes.push("This cannot be undone.");
    return {head:head,notes:notes};
  }
  /* Result line after the function answered {deleted, skipped, paths}. */
  function resultText(cat,res){
    const c=category(cat), r=res||{};
    let msg=plural(Number(r.deleted)||0,c.noun)+" deleted";
    if(Number(r.skipped)>0)msg+=", "+plural(Number(r.skipped),["reward request","reward requests"])+" kept — reset points first to remove them";
    return msg;
  }
  /* Points reset card: what the chosen kid (or everyone) holds now. */
  function balanceText(totals,kid){
    const list=(totals||[]).filter(function(t){return kid==="all"||t.kid_id===kid;});
    if(!list.length)return "No points recorded";
    return list.map(function(t){
      const avail=Number(t.available)||0, pend=Number(t.pending)||0;
      return (kid==="all"?kidName(t.kid_id)+": ":"")+avail+" points available"+(pend?" · "+pend+" pending":"")+" · "+(Number(t.total_earned)||0)+" earned";
    }).join(" · ");
  }
  function resetText(res){
    const n=Number(res&&res.kids)||0;
    return "Points reset to 0 for "+n+(n===1?" kid":" kids");
  }

  const api={KIDS:KIDS,CATEGORIES:CATEGORIES,category:category,when:when,buildRows:buildRows,toggle:toggle,allSelected:allSelected,toggleAll:toggleAll,prune:prune,confirmText:confirmText,resultText:resultText,balanceText:balanceText,resetText:resetText};
  if(typeof window!=="undefined")window.SQAdminCleanup=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
