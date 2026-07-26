/* SQChat — pure merge/filter for the admin conversation rail.
   No DOM, no network: it takes the rows admin.js already fetched and returns
   one sorted stream. Same dual-export shape as js/time-core.js so node --test
   can require it. */
(function(){
  function askRows(asks, ctx){
    const out=[];
    (asks||[]).forEach(function(a){
      const archived=ctx.archivedIds && ctx.archivedIds.has(a.id);
      if(a.kind!=="papa"){
        out.push({
          id:"ask:"+a.id, srcId:a.id, type:"ask", side:"kid", kidId:a.kid_id,
          at:a.created_at, body:a.body||"", audio:a.audio_path||null,
          needs:!a.answered_at && !archived, archived:!!archived,
          meta:{kind:a.kind||"question"}
        });
      }
      if(a.answer||a.answer_audio_path){
        out.push({
          id:"reply:"+a.id, srcId:a.id, type:"reply", side:"papa", kidId:a.kid_id,
          at:a.answered_at||a.created_at, body:a.answer||"",
          audio:a.answer_audio_path||null, needs:false, archived:!!archived, meta:{}
        });
      }
    });
    return out;
  }

  function claimRows(claims){
    return (claims||[]).map(function(c){
      return {
        id:"claim:"+c.id, srcId:c.id, type:"claim", side:"kid", kidId:c.captain_id,
        at:c.created_at, body:c.body||"", audio:null,
        needs:c.status==="requested", archived:false,
        meta:{helped:c.helped_kid_id, status:c.status||"requested"}
      };
    });
  }

  /* 'outing' passes are Papa's own bulk removals from the Today panel, not a kid
     asking for anything — they would flood the rail with noise. */
  function passRows(passes){
    return (passes||[]).filter(function(p){return p.kind!=="outing";}).map(function(p){
      return {
        id:"pass:"+p.id, srcId:p.id, type:"pass", side:"kid", kidId:p.kid_id,
        at:p.created_at, body:p.reason||"", audio:null,
        needs:p.status==="requested", archived:false,
        meta:{kind:p.kind||"golden", status:p.status||"requested", blockIdx:p.block_idx}
      };
    });
  }

  function photoRows(photos, today){
    return (photos||[]).filter(function(p){return p.day===today;}).map(function(p){
      return {
        id:"photo:"+p.id, srcId:p.id, type:"photo", side:"kid", kidId:p.kid_id,
        at:p.created_at, body:"", audio:null, needs:false, archived:false,
        meta:{path:p.path, blockIdx:p.block_idx}
      };
    });
  }

  function systemRows(rows, today){
    const out=[];
    (rows.ticks||[]).filter(function(t){return t.day===today;}).forEach(function(t){
      out.push({
        id:"tick:"+t.kid_id+":"+t.day+":"+t.block_idx, srcId:null, type:"system",
        side:"system", kidId:t.kid_id, at:t.created_at, body:"", audio:null,
        needs:false, archived:false, meta:{event:"tick", blockIdx:t.block_idx}
      });
    });
    (rows.ledger||[]).forEach(function(l){
      out.push({
        id:"star:"+l.id, srcId:l.id, type:"system", side:"system", kidId:l.kid_id,
        at:l.created_at, body:l.reason||"", audio:null, needs:false, archived:false,
        meta:{event:"star", delta:l.delta, source:l.source}
      });
    });
    (rows.redos||[]).filter(function(r){return r.day===today;}).forEach(function(r){
      out.push({
        id:"redo:"+r.kid_id+":"+r.day+":"+r.block_idx, srcId:null, type:"system",
        side:"system", kidId:r.kid_id, at:r.created_at, body:r.note||"", audio:null,
        needs:false, archived:false, meta:{event:"redo", blockIdx:r.block_idx}
      });
    });
    return out;
  }

  function buildStream(rows, ctx){
    const c=ctx||{}, r=rows||{};
    return []
      .concat(askRows(r.asks, c))
      .concat(claimRows(r.helpClaims))
      .concat(passRows(r.passes))
      .concat(photoRows(r.photos, c.today))
      .concat(systemRows(r, c.today))
      .sort(function(x,y){return new Date(x.at)-new Date(y.at);});
  }

  const api={buildStream:buildStream};
  if(typeof window!=="undefined")window.SQChat=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
