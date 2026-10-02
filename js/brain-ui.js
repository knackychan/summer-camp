/* SQBrain — thin compatibility facade over js/brain/host.js (brain slice 34 task 8).
   Stays a classic script (index.html loads it with <script src>, no type="module"),
   but the dynamic import() expression works from a classic script same as a module —
   only the static import/export declarations need type="module". This is the one
   seam index.html and js/main.js still know about; no game-specific DOM lives here
   any more, that all moved into js/brain/scenes/*.js. */
(function(){
  var hostPromise,hostModule,openToken=0;
  function host(){
    if(!hostPromise) hostPromise=import("./brain/host.js").then(function(h){hostModule=h;return h;}).catch(function(error){hostPromise=null;throw error;});
    return hostPromise;
  }

  function fmtMs(ms){
    var s=Math.floor(ms/1000), m=Math.floor(s/60), r=s%60;
    return m+":"+(r<10?"0":"")+r;
  }

  function openRound(opts){
    var token=++openToken;
    return host().then(async function(h){
      if(token!==openToken)return null;
      var round=h.openRound(opts);
      await round.ready;
      return token===openToken?round:null;
    });
  }

  function closeActive(){
    openToken++;
    if(hostModule)hostModule.closeActive();
  }

  var api={openRound:openRound,fmtMs:fmtMs,closeActive:closeActive};
  window.SQBrain=Object.assign(window.SQBrain||{},api);
})();
