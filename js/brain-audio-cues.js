/* SQBrainCues — placeholder sound pack for Brain Gym (guidelines §9).

   These are synthesized stand-ins, not the final pack. Every cue in §9.3 has a recipe
   here so scenes can be built and reviewed with real audio behaviour today; when Papa
   approves recorded cues, assets/audio/brain/*.mp3 replace the recipes and this file
   goes away. assets/audio/brain/README.md holds the cue table and provenance rules.

   This file is a cue TABLE, not the audio service. It does not own an AudioContext,
   does not know about mute, and schedules nothing on its own — the shared service from
   slice 34 owns all of that and calls renderCue() with its own context and gain node.

   A recipe is a flat list of layers so there is exactly one render path:
     {t:"tone",  wave, f0, f1, at, dur, gain}   oscillator gliding f0 -> f1
     {t:"noise", hz, q, at, dur, gain}          white noise through a bandpass
   Nothing loops, nothing runs longer than 640ms, and no cue is a buzzer. */
(function(){

  var CUES = {
    /* wooden click */
    "ui-tap": [
      {t:"tone", wave:"triangle", f0:520, f1:330, at:0, dur:0.045, gain:0.10},
      {t:"noise", hz:2200, q:1.0, at:0, dur:0.02, gain:0.05}
    ],
    /* rising = lifting off the slot */
    "token-pick": [
      {t:"tone", wave:"sine", f0:660, f1:880, at:0, dur:0.05, gain:0.07}
    ],
    /* falling = settling into the tray */
    "token-place": [
      {t:"tone", wave:"sine", f0:700, f1:440, at:0, dur:0.06, gain:0.08},
      {t:"noise", hz:1600, q:1.0, at:0, dur:0.025, gain:0.04}
    ],
    /* also the corrective-feedback cue: paper, never a negative buzz */
    "paper-slide": [
      {t:"noise", hz:1200, q:0.8, at:0, dur:0.18, gain:0.05}
    ],
    "drawer-open": [
      {t:"noise", hz:700, q:1.2, at:0, dur:0.22, gain:0.07},
      {t:"tone", wave:"sine", f0:180, f1:120, at:0, dur:0.20, gain:0.05}
    ],
    "drawer-close": [
      {t:"noise", hz:700, q:1.2, at:0, dur:0.16, gain:0.07},
      {t:"tone", wave:"sine", f0:130, f1:95, at:0, dur:0.14, gain:0.06},
      {t:"tone", wave:"sine", f0:90, f1:70, at:0.12, dur:0.07, gain:0.07}
    ],
    /* heavier denomination = lower ring. Two partials only; a real coin is metallic
       but a metallic placeholder reads as a slot machine, which §2.3 rules out. */
    "coin-1":  [{t:"tone", wave:"triangle", f0:1250, f1:1180, at:0, dur:0.09, gain:0.06},
                {t:"tone", wave:"sine", f0:1870, f1:1800, at:0, dur:0.06, gain:0.03}],
    "coin-5":  [{t:"tone", wave:"triangle", f0:1100, f1:1040, at:0, dur:0.09, gain:0.06},
                {t:"tone", wave:"sine", f0:1650, f1:1580, at:0, dur:0.06, gain:0.03}],
    "coin-10": [{t:"tone", wave:"triangle", f0:980, f1:930, at:0, dur:0.10, gain:0.06},
                {t:"tone", wave:"sine", f0:1470, f1:1410, at:0, dur:0.07, gain:0.03}],
    "coin-50": [{t:"tone", wave:"triangle", f0:860, f1:810, at:0, dur:0.11, gain:0.06},
                {t:"tone", wave:"sine", f0:1290, f1:1230, at:0, dur:0.08, gain:0.03}],
    "note-place": [
      {t:"noise", hz:900, q:0.7, at:0, dur:0.12, gain:0.045}
    ],
    "stamp": [
      {t:"noise", hz:400, q:0.9, at:0, dur:0.07, gain:0.10},
      {t:"tone", wave:"sine", f0:150, f1:70, at:0, dur:0.08, gain:0.08}
    ],
    "lift-ding": [
      {t:"tone", wave:"sine", f0:1320, f1:1300, at:0, dur:0.50, gain:0.07},
      {t:"tone", wave:"sine", f0:1980, f1:1950, at:0, dur:0.35, gain:0.025}
    ],
    "train-arrive": [
      {t:"noise", hz:300, q:0.5, at:0, dur:0.45, gain:0.06},
      {t:"tone", wave:"sine", f0:220, f1:150, at:0, dur:0.45, gain:0.04}
    ],
    "brush-swish": [
      {t:"noise", hz:3000, q:0.6, at:0, dur:0.16, gain:0.045}
    ],
    "scanner-tick": [
      {t:"tone", wave:"triangle", f0:1000, f1:980, at:0, dur:0.025, gain:0.035}
    ],
    /* marimba-like, deliberately quieter than speech */
    "success": [
      {t:"tone", wave:"triangle", f0:523, f1:523, at:0, dur:0.18, gain:0.07},
      {t:"tone", wave:"triangle", f0:659, f1:659, at:0.09, dur:0.18, gain:0.07},
      {t:"tone", wave:"triangle", f0:784, f1:784, at:0.18, dur:0.20, gain:0.07}
    ],
    "round-complete": [
      {t:"tone", wave:"triangle", f0:523, f1:523, at:0, dur:0.20, gain:0.07},
      {t:"tone", wave:"triangle", f0:659, f1:659, at:0.10, dur:0.20, gain:0.07},
      {t:"tone", wave:"triangle", f0:784, f1:784, at:0.20, dur:0.20, gain:0.07},
      {t:"tone", wave:"triangle", f0:1047, f1:1047, at:0.30, dur:0.26, gain:0.06}
    ]
  };

  var CUE_NAMES = Object.keys(CUES);

  /* Longest cue, in seconds. The service uses this to know when a cue has finished
     without holding a timer per node. */
  function cueDuration(name){
    var layers = CUES[name];
    if(!layers) return 0;
    var end = 0;
    for(var i=0;i<layers.length;i++){
      var stop = layers[i].at + layers[i].dur;
      if(stop > end) end = stop;
    }
    return end;
  }

  /* One 0.5s white-noise buffer per AudioContext, built on first use. */
  var noiseFor = (function(){
    var cache = [];
    return function(ctx){
      for(var i=0;i<cache.length;i++){ if(cache[i].ctx === ctx) return cache[i].buffer; }
      var frames = Math.floor(ctx.sampleRate * 0.5);
      var buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for(var n=0;n<frames;n++) data[n] = Math.random() * 2 - 1;
      cache.push({ctx:ctx, buffer:buffer});
      return buffer;
    };
  })();

  /* Play one cue. Returns {stop} so the service can cut everything on mute/destroy,
     or null for an unknown cue so the caller decides how to report it.
     opts.rate scales pitch (the service passes deterministic +/-3% variation),
     opts.volume scales gain, opts.when delays the start. */
  function renderCue(ctx, destination, name, opts){
    var layers = CUES[name];
    if(!layers) return null;
    var o = opts || {};
    var rate = o.rate || 1;
    var volume = o.volume === undefined ? 1 : o.volume;
    var t0 = ctx.currentTime + (o.when || 0);
    var nodes = [];

    for(var i=0;i<layers.length;i++){
      var layer = layers[i];
      var start = t0 + layer.at;
      var stop = start + layer.dur;
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(Math.max(layer.gain * volume, 0.0001), start);
      gain.gain.exponentialRampToValueAtTime(0.0001, stop);

      var source;
      if(layer.t === "noise"){
        source = ctx.createBufferSource();
        source.buffer = noiseFor(ctx);
        var band = ctx.createBiquadFilter();
        band.type = "bandpass";
        band.frequency.setValueAtTime(layer.hz * rate, start);
        band.Q.setValueAtTime(layer.q, start);
        source.connect(band);
        band.connect(gain);
      } else {
        source = ctx.createOscillator();
        source.type = layer.wave;
        source.frequency.setValueAtTime(layer.f0 * rate, start);
        source.frequency.exponentialRampToValueAtTime(layer.f1 * rate, stop);
        source.connect(gain);
      }
      gain.connect(destination || ctx.destination);
      source.start(start);
      source.stop(stop);
      nodes.push(source);
    }

    return {
      stop: function(){
        for(var n=0;n<nodes.length;n++){
          try { nodes[n].stop(); } catch(e) {}
        }
        nodes.length = 0;
      }
    };
  }

  var api = {CUES:CUES, CUE_NAMES:CUE_NAMES, cueDuration:cueDuration, renderCue:renderCue};
  if(typeof window!=="undefined") window.SQBrainCues = api;
  if(typeof module!=="undefined"&&module.exports) module.exports = api;
})();
