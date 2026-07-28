/* SQBrain — thin compatibility facade over js/brain/host.js (brain slice 34 task 8).
   Stays a classic script (index.html loads it with <script src>, no type="module"),
   but the dynamic import() expression works from a classic script same as a module —
   only the static import/export declarations need type="module". This is the one
   seam index.html and js/main.js still know about; no game-specific DOM lives here
   any more, that all moved into js/brain/scenes/*.js. */
(function(){
  var hostPromise;
  function host(){
    if(!hostPromise) hostPromise=import("./brain/host.js");
    return hostPromise;
  }

  function fmtMs(ms){
    var s=Math.floor(ms/1000), m=Math.floor(s/60), r=s%60;
    return m+":"+(r<10?"0":"")+r;
  }

  function openRound(opts){
    host().then(function(h){ h.openRound(opts); })
      .catch(function(err){ console.error("brain host failed to load",err); });
  }

  function closeActive(){
    host().then(function(h){ h.closeActive(); }).catch(function(){});
  }

  var api={openRound:openRound,fmtMs:fmtMs,closeActive:closeActive};
  window.SQBrain=Object.assign(window.SQBrain||{},api);
})();
