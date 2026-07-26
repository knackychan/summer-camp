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

  function buildStream(rows, ctx){
    const c=ctx||{};
    return askRows(rows&&rows.asks, c).sort(function(x,y){
      return new Date(x.at)-new Date(y.at);
    });
  }

  const api={buildStream:buildStream};
  if(typeof window!=="undefined")window.SQChat=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
