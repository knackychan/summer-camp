// Shared family-day helper — the ONE place "what day/time is it" is computed.
// Pinned to FAMILY_TZ (Asia/Taipei default) so a tablet set to UTC can't split the day.
(function(){
  function tz(){
    return (window.SQ_CONFIG&&window.SQ_CONFIG.FAMILY_TZ)||"Asia/Taipei";
  }
  function parts(date){
    return new Intl.DateTimeFormat("en-CA",{
      timeZone:tz(),year:"numeric",month:"2-digit",day:"2-digit",
      hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false
    }).formatToParts(date||new Date()).reduce((a,p)=>(a[p.type]=p.value,a),{});
  }
  window.SQ_DAY={
    parts,
    iso(date){const p=parts(date);return `${p.year}-${p.month}-${p.day}`;},
    isoOffset(days){return this.iso(new Date(Date.now()+(days||0)*86400000));},
    nowMins(){const p=parts();return (+p.hour%24)*60+(+p.minute);},
    clock(){const p=parts();return {h:("0"+(+p.hour%24)).slice(-2),m:p.minute,s:p.second};}
  };
})();
