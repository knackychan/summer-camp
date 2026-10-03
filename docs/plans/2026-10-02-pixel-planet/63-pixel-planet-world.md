# Slice 63 — Pixel Planet world (rewrite + wiring)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Three.js low-poly island in `js/world/world-explorer.js` with the Pixel Planet:
- a free-spinning globe
- 12 places that open real content
- 27 toys
- sky toys
- mini-games
- ambient life

Wire it into `index.html`, `css/world-explorer.css` and `sw.js`.

**Architecture:** `world-explorer.js` keeps the exact public contract (design §"Public contract"). It owns lifecycle, input, selection card, saved view and `snapshot()`, and composes the slice 60–62 modules.

Per frame:
- motion: easing → momentum → zoom spring → upright correction → idle spin
- `drawGlobe` only when the view or clouds changed
- composite: stars → moon (if behind) → globe → depth-sorted sprites → particles → moon (if in front) → mini-game over a dimmed planet

The canvas is created with `data-sq-world="planet"`; slice 64's failure harness targets that attribute.

**Tech Stack:** ES modules, Canvas 2D, Pointer Events, `node:test`. No `?.` / `??` / `.flatMap(`.

**Depends on:** slices 60, 61, 62.

**DONE WHEN:**
- `node scripts/check.mjs` is green, including the rewritten `scripts/world-explorer.test.mjs` (7 tests).
- `npm run test:world` passes.
- Manual desktop pass (step 9) is done.
- Everything is committed.

*Expected at this point:* the browser harnesses are not gates yet.
- `scripts/check-architecture-recovery.py` still fails its WebGL context-loss step.
- `scripts/check-world-explorer-ui.py` has a pre-existing single-threaded-server bug.

Slice 64 fixes both.

---

### Task 1: Rewrite the world test first

**Files:**
- Modify (full replace): `scripts/world-explorer.test.mjs`

- [ ] **Step 1: Replace `scripts/world-explorer.test.mjs` with:**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const WORLD_MODULES = ["world-explorer", "planet-palette", "planet-map", "planet-globe", "planet-sprites", "planet-toys", "planet-minigames"];

test("miniature world is a real root-runtime surface, not a wrapper", () => {
  const html = read("index.html");
  assert.match(html, /<section id="world" class="hidden"/);
  assert.match(html, /id="worldMount"/);
  assert.match(html, /function openWorld\(id\)/);
  assert.match(html, /resetQuestSession\(id\);openWorld\(id\)/);
  assert.match(html, /\["home","world","game","hub","act","book","music"\]/);
  assert.doesNotMatch(html, /<iframe[^>]+world/i);
});

test("world is a pixel planet on a 2D canvas and launches content through the registry only", () => {
  const source = read("js/world/world-explorer.js");
  assert.match(source, /from "\.\/planet-globe\.js"/);
  assert.match(source, /getContext\("2d"\)/);
  assert.match(source, /dataset\.sqWorld="planet"/);
  assert.match(source, /registry\.open\(selected\.id,\{origin:"world"\}\)/);
  assert.doesNotMatch(source, /three\.module|OrbitControls|WebGLRenderer|Raycaster/);
  assert.doesNotMatch(source, /iframe|legacy\.html|apps\/kid/);
  assert.doesNotMatch(source, /window\.location|location\.href/);
  for (const name of WORLD_MODULES.slice(1)) {
    assert.doesNotMatch(read(`js/world/${name}.js`), /document\.cookie|localStorage|addStars|stars_ledger|registry\.open/, `${name} stays out of family state`);
  }
});

test("world exposes physical destinations and featured real content", () => {
  const map = read("js/world/planet-map.js");
  for (const id of ["section:quests","section:games","section:acts","section:learn","section:books","section:music","section:day","section:rewards",
    "game:monster-truck","game:solar","book:space","game:paint"]) {
    assert.match(map, new RegExp(`"${id.replace(":", "\\:")}"`));
  }
});

test("content opened from the world can return to that same surface", () => {
  const html = read("index.html");
  assert.match(html, /function rememberContentReturn\(\)/);
  assert.match(html, /contentReturnSurface=worldVisible\(\)\?"world":"hub"/);
  assert.match(html, /if\(contentReturnSurface==="world"\).*openWorld\(id\)/s);
  assert.match(html, /returnAfterContent\("books"\)/);
  assert.match(html, /returnAfterContent\("music"\)/);
  assert.match(html, /returnAfterContent\(String\(actIdx\).*"learn":"acts"/);
  assert.match(html, /hubReturnSurface==="world"/);
});

test("native Back ends a planet mini-game before leaving the world, and toys use the app's muted-aware beep", () => {
  const html = read("index.html");
  assert.match(html, /worldExplorerModule&&worldExplorerModule\.back&&worldExplorerModule\.back\(\)/);
  assert.match(html, /beep:beep/);
  assert.match(html, /Tap a place 點一個地方/);
});

test("world runtime is packaged offline for PWA and Android", () => {
  const sw = read("sw.js");
  assert.match(sw, /const CACHE_NAME\s*=\s*["']summer-quest-/);
  assert.match(sw, /\.\/css\/world-explorer\.css/);
  for (const name of WORLD_MODULES) {
    assert.match(sw, new RegExp(`\\./js/world/${name}\\.js`), `${name} precached`);
    assert.equal(existsSync(resolve(root, `js/world/${name}.js`)), true);
  }
  assert.match(sw, /\.\/js\/vendor\/three\.module\.min\.js/, "Solar still needs Three.js offline");
  assert.equal(existsSync(resolve(root, "css/world-explorer.css")), true);
  assert.match(read("css/world-explorer.css"), /image-rendering:pixelated/);
});

test("world persistence accepts a unit quaternion + zoom and rejects corrupt or old saved views", () => {
  const source = read("js/world/world-explorer.js");
  let stored = null;
  const context = { savedViews: new Map(), window: { localStorage: { getItem: () => stored } } };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("function readView("), source.indexOf("function clamp(")), context);
  stored = JSON.stringify({ rotation: [0, 0.2, 0, 0.98], zoom: 1.4, selected: "section:books" });
  const view = context.readView("lucien");
  assert.equal(view.selected, "section:books");
  assert.equal(view.zoom, 1.4);
  assert.ok(Math.abs(Math.hypot(...view.rotation) - 1) < 1e-9, "rotation re-normalised");
  for (const value of [
    "broken JSON", "null",
    JSON.stringify({ camera: [9, 7, 10], target: [0, 1, 0], selected: "section:books" }),
    JSON.stringify({ rotation: [0, 0, 0], zoom: 1 }),
    JSON.stringify({ rotation: [0, 0, 0, 2], zoom: 1 }),
    JSON.stringify({ rotation: [0, 0, 0, 0.5], zoom: 1 }),
    JSON.stringify({ rotation: [0, 0, 0, "1"], zoom: 1 }),
    JSON.stringify({ rotation: [0, 0, 0, 1], zoom: 3 }),
    JSON.stringify({ rotation: [0, 0, 0, 1] })
  ]) {
    stored = value;
    assert.equal(context.readView("lucien"), null, value);
  }
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test scripts/world-explorer.test.mjs`
Expected: FAIL in "world is a pixel planet on a 2D canvas", "native Back ends a planet mini-game", "packaged offline" and "world persistence". The old source still imports Three.js.

### Task 2: The new world explorer

**Files:**
- Modify (full replace): `js/world/world-explorer.js`

- [ ] **Step 3: Replace `js/world/world-explorer.js` with:**

```js
/* Summer Quest Pixel Planet — the child's world home (docs/plans/2026-10-02-pixel-planet).
   A software-rendered pixel globe on a 2D canvas: places open real content through the
   registry, toys react, sparkly toys start tiny in-place games. No stars, no navigation of its own. */
import { HEX, C, nearestIndex } from "./planet-palette.js";
import { buildPlanetMap, buildCloudMap, SITES, MAP_W, MAP_H, DEFAULT_SEED } from "./planet-map.js";
import { facingQuat, project, unproject, drawGlobe, quatMul, quatAxisAngle, quatNormalize, quatRotate, quatConj, quatSlerp } from "./planet-globe.js";
import { buildAtlas, LANDMARK_SPRITE } from "./planet-sprites.js";
import { TOYS, SOUNDS, GAMES, SKY } from "./planet-toys.js";
import { createMinigame } from "./planet-minigames.js";

var current = null;
var savedViews = new Map();

function readView(kidId){
  var view=savedViews.get(kidId);
  try{if(!view)view=JSON.parse(window.localStorage.getItem("sq:world-view:"+kidId)||"null");}catch(error){}
  if(!view||!Array.isArray(view.rotation)||view.rotation.length!==4)return null;
  if(!view.rotation.every(function(value){return Number.isFinite(value)&&Math.abs(value)<=1.0001;}))return null;
  var length=Math.sqrt(view.rotation.reduce(function(sum,value){return sum+value*value;},0));
  if(Math.abs(length-1)>0.01||!Number.isFinite(view.zoom)||view.zoom<1||view.zoom>2)return null;
  return {rotation:view.rotation.map(function(value){return value/length;}),zoom:view.zoom,selected:typeof view.selected==="string"?view.selected:null};
}

function clamp(value,min,max){return Math.max(min,Math.min(max,value));}

var MIN_ZOOM=1, MAX_ZOOM=2, BASE_DISTANCE=16.4;
var DEFAULT_VIEW=facingQuat(18,0);
var HERO_SITE={lat:0,lon:-6};
var FX={
  apple:{sprite:"pApple",vx:[-18,18],vy:[-30,-15],g:120,life:1.4},
  egg:{sprite:"pEgg",vx:[-6,6],vy:[-20,-10],g:90,life:1.2},
  heart:{sprite:"pHeart",vx:[-6,6],vy:[-22,-14],g:0,life:1.3,wobble:true},
  note:{sprite:"pNote",vx:[-8,8],vy:[-20,-12],g:0,life:1.4,wobble:true},
  gumball:{sprite:"pGumball",vx:[-20,20],vy:[-35,-20],g:120,life:1.2},
  lava:{sprite:"pLava",vx:[-14,14],vy:[-50,-30],g:110,life:1.3},
  smoke:{sprite:"pSmoke",vx:[-4,4],vy:[-14,-8],g:0,life:1.6},
  snow:{sprite:"pSnow",vx:[-12,12],vy:[-24,-10],g:40,life:1.5},
  bunny:{sprite:"pBunny",vx:[0,0],vy:[-30,-30],g:80,life:1.0},
  sparkle:{sprite:"pSparkle",vx:[-14,14],vy:[-20,-6],g:0,life:0.9,blink:true},
  bee:{sprite:"pBee",vx:[0,0],vy:[0,0],g:0,life:1.8,orbit:true},
  coconut:{sprite:"pCoconut",vx:[4,8],vy:[-4,0],g:140,life:1.0},
  drop:{sprite:"pDrop",vx:[-14,14],vy:[-40,-26],g:120,life:1.0},
  rain:{sprite:"pRain",vx:[0,0],vy:[30,40],g:60,life:0.8},
  shootingStar:{sprite:"pShooting",vx:[-90,-90],vy:[30,30],g:0,life:1.0},
  zzz:{sprite:"pZ",vx:[2,4],vy:[-8,-6],g:0,life:1.6}
};
var AMBIENT={"section:acts":"smoke","section:music":"note","section:rewards":"sparkle"};
var CONFETTI=[C.pink,C.yellow,C.cyan,C.lime,C.purple,C.white,C.lava];

function easeOut(t){return 1-Math.pow(1-t,3);}

function createWorld(options){
  var mount=options.mount, registry=options.registry;
  var selectionEl=options.selectionEl,titleEl=options.titleEl,subtitleEl=options.subtitleEl,iconEl=options.iconEl,goEl=options.goEl;
  var goText=goEl.textContent;
  var reduced=!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var coarse=!!(window.matchMedia&&window.matchMedia("(pointer: coarse)").matches);
  var heroIndex=nearestIndex((options.kid&&options.kid.color)||"#4EA8FF");

  var canvas=document.createElement("canvas");
  canvas.dataset.sqWorld="planet";
  mount.innerHTML="";mount.appendChild(canvas);
  var ctx=canvas.getContext("2d");
  if(!ctx){mount.innerHTML="";throw new Error("2D canvas unavailable for the planet world");}
  var globeCanvas=document.createElement("canvas"),gctx=globeCanvas.getContext("2d");
  var map=buildPlanetMap(DEFAULT_SEED),clouds=buildCloudMap(DEFAULT_SEED),atlas=buildAtlas(heroIndex);

  var seed=11;
  function rand(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646;}
  function between(range){return range[0]+(range[1]-range[0])*rand();}
  var starField=[];
  for(var s=0;s<150;s++)starField.push({x:rand(),y:rand(),layer:rand()<0.35?1:0,twinkle:rand()<0.3,color:rand()<0.2?C.yellow:C.white});

  var scale=4,bw=1,bh=1,cx=0,cy=0,globeImage=null,globeData=null;
  var rotation=DEFAULT_VIEW.slice(),zoom=1,dirty=true,viewDirty=false;
  var cloudOffset=0,cloudDrawn=0,starShift=[0,0],clock=0,tick=0;
  var pointers=new Map(),gesture=null,pinch=null,momentum=null,easing=null,lastInput=performance.now();
  var particles=[],confetti=[],selected=null,minigame=null,hudTimer=0;
  var active=false,destroyed=false,nativePaused=false,frames=0,raf=0,last=performance.now(),lastError=null;

  var places=SITES.map(function(site){
    return {kind:"place",id:site.id,lat:site.lat,lon:site.lon,sprite:LANDMARK_SPRITE[site.id],entry:registry.get?registry.get(site.id):null,react:null,ambient:rand()*2};
  });
  var toys=TOYS.map(function(toy){
    return {kind:"toy",id:toy.id,lat:toy.lat,lon:toy.lon,sprite:toy.sprite,toy:toy,react:null};
  });
  var hero={kind:"hero",id:"hero",lat:HERO_SITE.lat,lon:HERO_SITE.lon,sprite:"hero",react:null,flip:false};
  var moon={kind:"moon",id:"sky:moon",sprite:"moon",react:null,x:0,y:0,z:0,toy:SKY.moon};
  var surface=places.concat(toys,[hero]);

  function playSound(name){
    var notes=SOUNDS[name];
    if(!notes||typeof options.beep!=="function")return;
    notes.forEach(function(note){setTimeout(function(){if(!destroyed)options.beep(note[0],note[1],note[2],note[4]);},note[3]);});
  }
  function haptic(kind){if(options.haptic)options.haptic(kind);}
  function radius(){return Math.max(8,Math.round(Math.min(bw,bh)*0.3*zoom));}
  function view(){return {rotation:rotation,radius:radius(),cx:cx,cy:cy};}

  /* ---------- selection card ---------- */
  function cardFor(item){
    if(item.kind==="place")return item.entry;
    var game=GAMES[item.toy.game];
    return {icon:game.icon,title:game.title,blurb:game.blurb,available:true};
  }
  function showSelection(item,quiet){
    selected=item||null;
    if(!item){selectionEl.classList.add("hidden");return;}
    var entry=cardFor(item);
    iconEl.textContent=entry.icon||"✨";titleEl.textContent=(entry.title&&entry.title[0])||item.id;
    subtitleEl.textContent=entry.available===false?"Not available right now · 現在暫時無法開啟":(entry.title&&entry.title[1]?entry.title[1]+" · ":"")+((entry.blurb&&entry.blurb[0])||"");
    goEl.textContent=goText;goEl.disabled=entry.available===false;selectionEl.classList.remove("hidden");
    if(!quiet)haptic("tap");
  }
  function refreshRegistry(){
    places.forEach(function(mark){mark.entry=registry.get(mark.id);});
    if(selected&&selected.kind==="place")showSelection(selected.entry?selected:null,true);
  }

  /* ---------- view persistence ---------- */
  function saveView(){
    var saved={rotation:rotation.slice(),zoom:zoom,selected:selected&&selected.kind==="place"?selected.id:null};
    savedViews.set(options.kidId,saved);
    try{window.localStorage.setItem("sq:world-view:"+options.kidId,JSON.stringify(saved));}catch(error){}
    viewDirty=false;
  }

  /* ---------- motion ---------- */
  function rotateBy(dx,dy){
    var length=Math.sqrt(dx*dx+dy*dy);
    if(!length)return;
    rotation=quatNormalize(quatMul(quatAxisAngle([dy/length,dx/length,0],length/radius()),rotation));
    starShift[0]+=dx;starShift[1]+=dy;dirty=true;viewDirty=true;
  }
  function settleZoom(dt){
    var target=clamp(zoom,MIN_ZOOM,MAX_ZOOM);
    if(Math.abs(target-zoom)<0.0005){if(zoom!==target){zoom=target;dirty=true;}return;}
    zoom+=(target-zoom)*Math.min(1,dt*12);dirty=true;viewDirty=true;
  }
  function rubber(raw){
    if(raw>MAX_ZOOM)return MAX_ZOOM+(raw-MAX_ZOOM)*0.15;
    if(raw<MIN_ZOOM)return MIN_ZOOM-(MIN_ZOOM-raw)*0.15;
    return raw;
  }
  function uprightError(){
    var north=quatRotate(rotation,[0,1,0]);
    if(Math.abs(north[2])>0.98)return 0;
    return Math.atan2(north[0],north[1]);
  }
  function updateMotion(dt){
    if(easing){
      easing.t=easing.dur>0?Math.min(1,easing.t+dt/easing.dur):1;
      rotation=quatSlerp(easing.from,easing.to,easeOut(easing.t));dirty=true;viewDirty=true;
      if(easing.t>=1)easing=null;
      return;
    }
    if(pointers.size)return;
    if(momentum){
      rotateBy(momentum.x*dt,momentum.y*dt);
      var decay=Math.exp(-dt*3.2);momentum.x*=decay;momentum.y*=decay;
      if(Math.abs(momentum.x)+Math.abs(momentum.y)<4)momentum=null;
    }
    settleZoom(dt);
    var error=uprightError();
    if(Math.abs(error)>0.002){rotation=quatNormalize(quatMul(quatAxisAngle([0,0,1],error*Math.min(1,dt*2.5)),rotation));dirty=true;viewDirty=true;}
    if(!reduced&&!selected&&!minigame&&!momentum&&performance.now()-lastInput>6000){
      rotation=quatNormalize(quatMul(quatAxisAngle(quatRotate(rotation,[0,1,0]),dt*Math.PI*2/90),rotation));
      starShift[0]+=dt*radius()*Math.PI*2/90;dirty=true;
    }
    if(viewDirty&&!momentum&&Math.abs(error)<=0.002&&zoom>=MIN_ZOOM&&zoom<=MAX_ZOOM)saveView();
  }
  function focusOn(item){
    var to=facingQuat(clamp(item.lat+8,-80,80),item.lon);
    easing={from:rotation.slice(),to:to,t:0,dur:reduced?0:0.45};
  }

  /* ---------- reactions + particles ---------- */
  function react(item,kind){item.react={kind:kind,t:0,dur:kind==="spin"?1.2:0.9};}
  function spawn(kind,x,y,count){
    var fx=FX[kind];
    if(!fx)return;
    for(var i=0;i<count;i++)particles.push({fx:fx,x:x,y:y,vx:between(fx.vx),vy:between(fx.vy),age:0,phase:rand()*6,ox:x,oy:y});
  }
  function reactionPose(item){
    var pose={dx:0,dy:0,sx:1,sy:1,frame:0,glow:0};
    var r=item.react;
    if(!r)return pose;
    var t=r.t;
    if(r.kind==="shake")pose.dx=Math.round(Math.sin(t*Math.PI*8)*1.5*(1-t));
    else if(r.kind==="hop")pose.dy=-Math.round(Math.sin(t*Math.PI)*6);
    else if(r.kind==="jump")pose.dy=-Math.round(Math.sin(t*Math.PI)*12);
    else if(r.kind==="squash"){pose.sy=1-0.35*Math.sin(t*Math.PI*2)*(1-t);pose.sx=1+(1-pose.sy)*0.6;}
    else if(r.kind==="grow"){pose.sy=pose.sx=1+0.4*Math.sin(t*Math.PI);}
    else if(r.kind==="spin")pose.frame=Math.floor(t*14)%2;
    else if(r.kind==="alt")pose.frame=1;
    else if(r.kind==="slide")pose.dx=Math.round(Math.sin(t*Math.PI)*8);
    else if(r.kind==="glow")pose.glow=Math.sin(t*Math.PI);
    if(item.kind==="hero"&&r.kind==="hop")pose.frame=1;
    return pose;
  }
  function stepReactions(dt){
    surface.concat([moon]).forEach(function(item){if(item.react){item.react.t+=dt/item.react.dur;if(item.react.t>=1)item.react=null;}});
    particles=particles.filter(function(p){
      p.age+=dt;
      if(p.fx.orbit){p.x=p.ox+Math.cos(p.phase+p.age*6)*7;p.y=p.oy-4+Math.sin(p.phase+p.age*6)*3;}
      else{p.vy+=p.fx.g*dt;p.x+=p.vx*dt+(p.fx.wobble?Math.sin(p.age*8+p.phase)*0.3:0);p.y+=p.vy*dt;}
      return p.age<p.fx.life;
    });
    confetti=confetti.filter(function(p){p.vy+=60*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.age+=dt;return p.age<2.5&&p.y<bh+2;});
  }

  /* ---------- layout of surface sprites (buffer pixels) ---------- */
  function layout(){
    var v=view();
    surface.forEach(function(item){
      var p=project(item.lat,item.lon,v);
      var hidden=item.kind==="place"&&!item.entry;
      item.z=hidden?-1:p.z;
      var img=atlas[item.sprite].normal[0];
      item.w=img.width;item.h=img.height;
      item.x=Math.round(p.x);item.y=Math.round(p.y);
      item.left=item.x-Math.floor(img.width/2);item.top=item.y-(img.height-2);
    });
    var angle=reduced?0.9:clock*Math.PI*2/40,R=radius();
    moon.z=Math.sin(angle);
    moon.x=Math.round(cx+Math.cos(angle)*R*1.55);moon.y=Math.round(cy-R*0.85+Math.sin(angle)*R*0.3);
    var mimg=atlas.moon.normal[0];
    moon.w=mimg.width;moon.h=mimg.height;moon.left=moon.x-Math.floor(mimg.width/2);moon.top=moon.y-Math.floor(mimg.height/2);
  }
  function variantOf(item){
    if(item.kind==="place"&&item.entry&&item.entry.available===false)return "sleep";
    return item.z<0.3?"dark":"normal";
  }
  function drawItem(item){
    var pose=reactionPose(item),frames=atlas[item.sprite][variantOf(item)];
    var idle=item.kind==="place"&&frames.length>1&&!reduced?(Math.floor(clock*2)%2):0;
    var img=frames[Math.min(frames.length-1,pose.frame||idle)];
    var w=Math.round(img.width*pose.sx),h=Math.round(img.height*pose.sy);
    var x=item.x+pose.dx-Math.floor(w/2),y=item.y+pose.dy-Math.round((img.height-2)*pose.sy);
    if(item.kind!=="moon"){
      ctx.globalAlpha=0.35;ctx.fillStyle=HEX[C.outline];
      var half=Math.max(2,Math.floor(img.width*0.35));
      ctx.fillRect(item.x-half,item.y,half*2,1);ctx.fillRect(item.x-half+1,item.y+1,half*2-2,1);
      ctx.globalAlpha=1;
    }else{y=item.top;x=item.left;}
    if(item.flip){ctx.save();ctx.translate(x+w,y);ctx.scale(-1,1);ctx.drawImage(img,0,0,w,h);ctx.restore();}
    else ctx.drawImage(img,x,y,w,h);
    if(pose.glow>0){ctx.globalCompositeOperation="lighter";ctx.globalAlpha=pose.glow*0.7;ctx.drawImage(img,x,y,w,h);ctx.globalCompositeOperation="source-over";ctx.globalAlpha=1;}
  }

  /* ---------- hit testing ---------- */
  function toBuffer(clientX,clientY){
    var rect=canvas.getBoundingClientRect();
    return {x:(clientX-rect.left)/scale,y:(clientY-rect.top)/scale};
  }
  function inRect(item,x,y){
    var minSize=coarse?44/scale:0;
    var w=Math.max(item.w-2,minSize),h=Math.max(item.h-2,minSize);
    var midX=item.left+item.w/2,midY=item.top+(item.h-2)/2;
    return Math.abs(x-midX)<=w/2&&Math.abs(y-midY)<=h/2;
  }
  function hitAt(clientX,clientY){
    var p=toBuffer(clientX,clientY);
    var R=radius(),dx=p.x-cx,dy=p.y-cy,onDisc=dx*dx+dy*dy<=R*R;
    if(moon.z>0&&inRect(moon,p.x,p.y))return moon;
    var front=surface.filter(function(item){return item.z>0.15;}).sort(function(a,b){return b.z-a.z;});
    for(var i=0;i<front.length;i++)if(inRect(front[i],p.x,p.y))return front[i];
    if(moon.z<=0&&!onDisc&&inRect(moon,p.x,p.y))return moon;
    return onDisc?{kind:"surface",x:p.x,y:p.y}:{kind:"space",x:p.x,y:p.y};
  }
  function cloudAt(x,y){
    var ll=unproject(x,y,view());
    if(!ll)return false;
    var row=Math.min(MAP_H-1,Math.floor((90-ll.lat)/180*MAP_H));
    var col=Math.floor(((ll.lon*Math.PI/180)+cloudDrawn+Math.PI)/(Math.PI*2)*MAP_W)%MAP_W;
    return !!clouds[row*MAP_W+(col+MAP_W)%MAP_W];
  }
  function tap(clientX,clientY){
    var hit=hitAt(clientX,clientY);
    if(hit.kind==="place"){
      showSelection(hit);react(hit,"hop");focusOn(hit);
      hero.react=null;react(hero,"hop");hero.flip=hit.x<hero.x;playSound("pop");
      return;
    }
    if(hit.kind==="toy"||hit.kind==="moon"){
      var toy=hit.toy;
      react(hit,toy.react);playSound(toy.sound);haptic("tap");
      if(toy.fx)spawn(toy.fx,hit.x,hit.kind==="moon"?hit.y:hit.top+2,toy.count);
      if(toy.game)showSelection(hit,true);
      return;
    }
    if(hit.kind==="hero"){react(hero,"hop");spawn("heart",hero.x,hero.top,2);playSound("whee");haptic("tap");return;}
    showSelection(null);
    if(hit.kind==="surface"&&cloudAt(hit.x,hit.y)){spawn("rain",hit.x,hit.y,SKY.cloud.count);playSound(SKY.cloud.sound);}
    else if(hit.kind==="space"){spawn("shootingStar",hit.x+20,hit.y-10,1);playSound(SKY.stars.sound);}
    viewDirty=true;
  }

  /* ---------- mini-games ---------- */
  var gameEnv={width:1,height:1,top:0,floor:1,coarse:coarse,atlas:atlas,sound:playSound,rand:rand};
  function updateGameEnv(){
    gameEnv.width=bw;gameEnv.height=bh;gameEnv.top=Math.ceil(84/scale);
    var cardTop=selectionEl.getBoundingClientRect().top,canvasTop=canvas.getBoundingClientRect().top;
    gameEnv.floor=cardTop>canvasTop?Math.min(bh-4,Math.floor((cardTop-canvasTop)/scale)-4):bh-28;
  }
  function startMinigame(kind){
    updateGameEnv();
    minigame=createMinigame(kind,gameEnv);momentum=null;easing=null;
    goEl.textContent="Done 完成";goEl.disabled=false;hudTimer=0;updateGameHud();
    haptic("tap");
  }
  function updateGameHud(){
    if(!minigame)return;
    var info=minigame.info;
    iconEl.textContent=info.icon;titleEl.textContent=info.title[0]+" · "+info.title[1];
    subtitleEl.textContent=minigame.finished?"Yay! 好棒！ "+info.unit+" × "+minigame.score:"⏱ "+minigame.timeLeft()+" · "+info.unit+" × "+minigame.score;
    if(minigame.finished)goEl.textContent="OK 好";
  }
  function endMinigame(){
    minigame=null;goEl.textContent=goText;showSelection(null);
  }
  function stepMinigame(dt){
    if(!minigame)return;
    var was=minigame.finished;
    minigame.step(dt);
    if(!was&&minigame.finished){
      for(var i=0;i<46;i++)confetti.push({x:rand()*bw,y:-rand()*bh*0.4,vx:(rand()-0.5)*24,vy:rand()*20,age:0,color:CONFETTI[Math.floor(rand()*CONFETTI.length)]});
      haptic("success");updateGameHud();
    }
    hudTimer-=dt;
    if(hudTimer<=0){hudTimer=0.25;updateGameHud();}
  }

  /* ---------- input ---------- */
  function pinchDistance(){
    var pts=Array.from(pointers.values());
    return Math.max(1,Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y));
  }
  function onPointerDown(e){
    if(!active)return;
    lastInput=performance.now();
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    try{canvas.setPointerCapture(e.pointerId);}catch(error){}
    if(minigame){var b=toBuffer(e.clientX,e.clientY);minigame.pointer("down",b.x,b.y);return;}
    if(pointers.size===1){gesture={x0:e.clientX,y0:e.clientY,t0:performance.now(),lastX:e.clientX,lastY:e.clientY,lastT:performance.now(),vx:0,vy:0,multi:false};momentum=null;easing=null;}
    else if(pointers.size===2&&gesture){gesture.multi=true;pinch={distance:pinchDistance(),zoom:zoom};}
  }
  function onPointerMove(e){
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(minigame){var b=toBuffer(e.clientX,e.clientY);minigame.pointer("move",b.x,b.y);return;}
    if(!gesture)return;
    if(pointers.size>=2&&pinch){zoom=rubber(pinch.zoom*pinchDistance()/pinch.distance);dirty=true;viewDirty=true;return;}
    if(gesture.multi)return;
    var now=performance.now(),dx=(e.clientX-gesture.lastX)/scale,dy=(e.clientY-gesture.lastY)/scale,dt=Math.max(1,now-gesture.lastT)/1000;
    rotateBy(dx,dy);
    gesture.vx=gesture.vx*0.6+(dx/dt)*0.4;gesture.vy=gesture.vy*0.6+(dy/dt)*0.4;
    gesture.lastX=e.clientX;gesture.lastY=e.clientY;gesture.lastT=now;
  }
  function onPointerUp(e){
    if(!pointers.has(e.pointerId))return;
    pointers.delete(e.pointerId);
    if(minigame){var b=toBuffer(e.clientX,e.clientY);minigame.pointer("up",b.x,b.y);if(!pointers.size)gesture=null;return;}
    if(!gesture)return;
    if(pointers.size===1){pinch=null;var rest=Array.from(pointers.values())[0];gesture.lastX=rest.x;gesture.lastY=rest.y;return;}
    if(pointers.size)return;
    var g=gesture;gesture=null;pinch=null;
    var moved=Math.hypot(e.clientX-g.x0,e.clientY-g.y0),elapsed=performance.now()-g.t0;
    if(e.type==="pointerup"&&!g.multi&&moved<=11&&elapsed<700){tap(e.clientX,e.clientY);return;}
    if(!g.multi&&performance.now()-g.lastT<80&&Math.abs(g.vx)+Math.abs(g.vy)>20)momentum={x:g.vx,y:g.vy};
  }
  function onWheel(e){
    if(!active||minigame)return;
    e.preventDefault();lastInput=performance.now();
    zoom=clamp(zoom*Math.exp(-e.deltaY*0.0015),MIN_ZOOM,MAX_ZOOM);dirty=true;viewDirty=true;
  }
  canvas.addEventListener("pointerdown",onPointerDown);
  canvas.addEventListener("pointermove",onPointerMove);
  canvas.addEventListener("pointerup",onPointerUp);
  canvas.addEventListener("pointercancel",onPointerUp);
  canvas.addEventListener("wheel",onWheel,{passive:false});

  goEl.onclick=async function(){
    if(minigame){endMinigame();return;}
    if(!selected)return;
    if(selected.kind!=="place"){startMinigame(selected.toy.game);return;}
    if(!registry||typeof registry.open!=="function")return;
    refreshRegistry();if(!selected||selected.entry.available===false)return;
    var id=selected.id;goEl.disabled=true;
    try{
      var result=await registry.open(selected.id,{origin:"world"});
      if(result&&result.ok){haptic("success");}
      else if(selected&&selected.id===id)subtitleEl.textContent="Could not open. Try again or choose Classic. · 暫時無法開啟，請重試或選經典介面。";
    }catch(error){
      console.error("World content launch failed",error);
      if(selected&&selected.id===id)subtitleEl.textContent="Could not open. Try again or choose Classic. · 暫時無法開啟，請重試或選經典介面。";
    }finally{if(!destroyed&&selected&&selected.kind==="place"){var entry=registry.get(selected.id);goEl.disabled=!entry||entry.available===false;}}
  };

  /* ---------- rendering ---------- */
  function resize(){
    var w=Math.max(1,mount.clientWidth),h=Math.max(1,mount.clientHeight);
    scale=Math.min(w,h)<600?3:4;
    bw=Math.ceil(w/scale);bh=Math.ceil(h/scale);
    if(canvas.width!==bw||canvas.height!==bh){
      canvas.width=globeCanvas.width=bw;canvas.height=globeCanvas.height=bh;
      globeImage=gctx.createImageData(bw,bh);globeData=new Uint32Array(globeImage.data.buffer);
    }
    canvas.style.width=(bw*scale)+"px";canvas.style.height=(bh*scale)+"px";
    cx=Math.floor(bw/2);cy=Math.floor(bh*0.52);
    ctx.imageSmoothingEnabled=false;dirty=true;
    if(minigame)updateGameEnv();
  }
  function renderGlobe(){
    cloudDrawn=cloudOffset;
    drawGlobe({data:globeData,width:bw,height:bh},map,clouds,view(),cloudDrawn);
    gctx.putImageData(globeImage,0,0);dirty=false;
  }
  function drawStars(){
    var blink=Math.floor(clock*4);
    starField.forEach(function(star,index){
      if(star.twinkle&&!reduced&&(blink+index)%5===0)return;
      var k=star.layer?0.12:0.05;
      var x=Math.floor((((star.x*bw+starShift[0]*k)%bw)+bw)%bw),y=Math.floor((((star.y*bh+starShift[1]*k)%bh)+bh)%bh);
      ctx.fillStyle=HEX[star.layer?star.color:C.steel];ctx.fillRect(x,y,1,1);
    });
  }
  function drawParticles(){
    particles.forEach(function(p){
      if(p.fx.blink&&Math.floor(p.age*12)%2)return;
      var img=atlas[p.fx.sprite].normal[0];
      ctx.globalAlpha=Math.min(1,(p.fx.life-p.age)*3);
      ctx.drawImage(img,Math.round(p.x-img.width/2),Math.round(p.y-img.height/2));
    });
    ctx.globalAlpha=1;
    confetti.forEach(function(p){ctx.fillStyle=HEX[p.color];ctx.fillRect(Math.round(p.x),Math.round(p.y),1,1);});
  }
  function ambient(dt){
    if(reduced)return;
    places.forEach(function(mark){
      if(!mark.entry||mark.z<0.2)return;
      mark.ambient-=dt;
      if(mark.ambient>0)return;
      var asleep=mark.entry.available===false,kind=asleep?"zzz":AMBIENT[mark.id];
      mark.ambient=asleep?2:1.2+rand();
      if(kind)spawn(kind,mark.x+(asleep?4:0),mark.top+1,1);
    });
  }
  function composite(){
    ctx.fillStyle=HEX[C.space];ctx.fillRect(0,0,bw,bh);
    drawStars();
    if(moon.z<=0)drawItem(moon);
    ctx.drawImage(globeCanvas,0,0);
    surface.filter(function(item){return item.z>0.08;}).sort(function(a,b){return a.z-b.z;}).forEach(drawItem);
    if(moon.z>0)drawItem(moon);
    drawParticles();
    if(minigame){ctx.globalAlpha=0.62;ctx.fillStyle=HEX[C.space];ctx.fillRect(0,0,bw,bh);ctx.globalAlpha=1;minigame.draw(ctx);drawParticles();}
  }
  function frame(now){
    if(!active)return;
    /* rAF stamps can trail the performance.now() taken in resume(); never step backwards. */
    var dt=clamp((now-last)/1000,0,0.05);last=now;clock+=dt;
    try{
      if(!minigame)updateMotion(dt);
      if(!reduced)cloudOffset+=dt*0.012;
      if(Math.abs(cloudOffset-cloudDrawn)>Math.PI*2/MAP_W)dirty=true;
      if(dirty)renderGlobe();
      layout();stepReactions(dt);ambient(dt);stepMinigame(dt);
      composite();frames++;
      raf=requestAnimationFrame(frame);
    }catch(error){
      lastError=String(error.message||error);console.error("Summer Quest world render failed",error);pause();
      if(options.onStatus)options.onStatus("paused",lastError);
    }
  }
  function pause(){
    var wasActive=active;
    active=false;pointers.clear();gesture=null;pinch=null;cancelAnimationFrame(raf);
    if(wasActive||viewDirty)saveView();
  }
  function resume(){
    if(destroyed||nativePaused||document.hidden||!mount.isConnected||mount.closest(".hidden"))return;
    refreshRegistry();resize();if(active)return;
    active=true;last=performance.now();lastInput=performance.now();raf=requestAnimationFrame(frame);
  }
  function destroy(){
    if(destroyed)return;pause();destroyed=true;
    document.removeEventListener("visibilitychange",onVisibility);
    window.removeEventListener("summerquest:native-pause",onNativePause);window.removeEventListener("summerquest:native-resume",onNativeResume);window.removeEventListener("pagehide",pause);
    if(resizeObserver)resizeObserver.disconnect();else window.removeEventListener("resize",resize);
    canvas.removeEventListener("pointerdown",onPointerDown);canvas.removeEventListener("pointermove",onPointerMove);
    canvas.removeEventListener("pointerup",onPointerUp);canvas.removeEventListener("pointercancel",onPointerUp);canvas.removeEventListener("wheel",onWheel);
    goEl.onclick=null;goEl.textContent=goText;minigame=null;mount.innerHTML="";
  }
  function back(){
    if(!minigame)return false;
    endMinigame();return true;
  }
  function onVisibility(){if(document.hidden)pause();else if(!mount.closest(".hidden"))resume();}
  function onNativePause(){nativePaused=true;pause();}
  function onNativeResume(){nativePaused=false;resume();}
  document.addEventListener("visibilitychange",onVisibility);
  window.addEventListener("summerquest:native-pause",onNativePause);window.addEventListener("summerquest:native-resume",onNativeResume);window.addEventListener("pagehide",pause);
  var resizeObserver=typeof ResizeObserver!=="undefined"?new ResizeObserver(resize):null;if(resizeObserver)resizeObserver.observe(mount);else window.addEventListener("resize",resize);

  var saved=readView(options.kidId);
  if(saved){rotation=saved.rotation;zoom=saved.zoom;}
  resize();
  /* A successful startup includes a rendered frame, not just a mounted canvas. */
  try{renderGlobe();layout();composite();frames++;}catch(error){destroy();throw error;}
  showSelection(saved&&places.find(function(mark){return mark.id===saved.selected&&mark.entry;})||null,true);
  resume();

  function snapshot(){
    var rect=canvas.getBoundingClientRect(),distance=BASE_DISTANCE/zoom;
    layout();
    function point(item){
      if(item.z<=0.15)return null;
      var x=rect.left+(item.left+item.w/2)*scale,y=rect.top+(item.top+(item.h-2)/2)*scale;
      if(x<rect.left||y<rect.top||x>rect.right||y>rect.bottom)return null;
      return hitAt(x,y)===item?{x:x,y:y}:null;
    }
    return {running:active,frames:frames,contextLost:false,error:lastError,selected:selected&&selected.id,minigame:minigame&&minigame.kind,
      camera:{position:quatRotate(quatConj(rotation),[0,0,distance]),target:[0,0,0],distance:distance,minDistance:BASE_DISTANCE/MAX_ZOOM,maxDistance:BASE_DISTANCE/MIN_ZOOM,rotation:rotation.slice(),zoom:zoom},
      landmarks:places.map(function(mark){var at=point(mark);return {id:mark.id,x:at&&at.x,y:at&&at.y,visible:!!at,available:!!mark.entry&&mark.entry.available!==false};}),
      toys:toys.map(function(toy){var at=point(toy);return {id:toy.id,x:at&&at.x,y:at&&at.y,visible:!!at};})};
  }

  return {pause:pause,resume:resume,resize:resize,destroy:destroy,showSelection:showSelection,snapshot:snapshot,back:back};
}

export async function start(options){
  if(!options||!options.mount||!options.registry)throw new Error("Summer Quest world requires mount + registry");
  if(current&&current.kidId===options.kidId){current.instance.resume();current.instance.resize();return current.instance;}
  if(current){current.instance.destroy();current=null;}
  var instance=createWorld(options);current={kidId:options.kidId,instance:instance};return instance;
}
export function pause(){if(current)current.instance.pause();}
export function resume(){if(current)current.instance.resume();}
export function destroy(){if(current){current.instance.destroy();current=null;}}
export function back(){return current?current.instance.back():false;}
export function snapshot(){return current?Object.assign({kidId:current.kidId},current.instance.snapshot()):null;}
```

Notes for the reader (these are already handled in the code above, so don't "fix" them):
- `readView` must stay directly above `clamp` and stay self-contained, because the test slices the source between them and runs it in a VM.
- `dt` is clamped to `[0, 0.05]`. rAF timestamps can be *earlier* than the `performance.now()` taken in `resume()`. A negative `dt` made `clock` negative and indexed a missing sprite frame. This was caught in the planning harness.
- The `snapshot().camera.position` field is a virtual eye point, `quatRotate(conj(rotation), [0,0,16.4/zoom])`. The recovery harness keeps checking its drag delta, pinch clamp and reload restore.

### Task 3: Wire it into the app

**Files:**
- Modify: `css/world-explorer.css` (lines 1–3 and the canvas rule)
- Modify: `index.html` (world comment/aria-label ~line 802–805, hint ~line 813, `openWorld` options ~line 1594–1601, `summerQuestBack` ~line 5034)
- Modify: `sw.js` (`CACHE_NAME` line 1, and the `./js/world/world-explorer.js` entry ~line 173)

- [ ] **Step 4: `css/world-explorer.css`.** Make exactly these replacements:

```css
/* old */ /* Summer Quest miniature 3D world — a view over the authoritative root runtime. */
/* new */ /* Summer Quest Pixel Planet world — a view over the authoritative root runtime. */

/* old */ body.world-mode{overflow:hidden;background:#b9e7ff}
/* new */ body.world-mode{overflow:hidden;background:#17153b}

/* old */ #world{position:relative;width:100%;height:100vh;height:100dvh;overflow:hidden;background:linear-gradient(#a8dcff,#e9f8ff 58%,#c8f0d2)}
/* new */ #world{position:relative;width:100%;height:100vh;height:100dvh;overflow:hidden;background:#17153b}

/* old */ .world-canvas canvas{display:block;width:100%;height:100%;touch-action:none}
/* new */ .world-canvas canvas{display:block;touch-action:none;image-rendering:crisp-edges;image-rendering:pixelated}
```

The canvas size is set inline by `resize()` to `buffer × scale` CSS px, so pixels stay integer-sized. `.world-shell{overflow:hidden}` clips the ≤3 px overhang.

- [ ] **Step 5: `index.html`.** Make these four replacements:

```html
<!-- old --> <!-- MINIATURE 3D WORLD — primary child exploration surface -->
<!-- new --> <!-- PIXEL PLANET WORLD — primary child exploration surface (docs/plans/2026-10-02-pixel-planet) -->

<!-- old --> <div class="world-canvas" id="worldMount" aria-label="Interactive 3D Summer Quest world"></div>
<!-- new --> <div class="world-canvas" id="worldMount" aria-label="Interactive pixel planet · 互動像素星球"></div>

<!-- old --> <div class="world-hint" id="worldHint">☝️ Tap a place · ↔️ drag to look around · 🤏 pinch to zoom</div>
<!-- new --> <div class="world-hint" id="worldHint">☝️ Tap a place 點一個地方 · ↔️ spin the planet 轉動星球 · 🤏 pinch to zoom 雙指縮放</div>
```

In `openWorld`, pass the app's muted-aware `beep`:

```js
// old
      haptic:function(kind){return window.SQPlatform&&SQPlatform.haptic?SQPlatform.haptic(kind):null;},
// new
      beep:beep,haptic:function(kind){return window.SQPlatform&&SQPlatform.haptic?SQPlatform.haptic(kind):null;},
```

In `summerQuestBack`, end a running mini-game before leaving the world:

```js
// old
  if(world&&!world.classList.contains("hidden")){hubKid=null;saveAppPlace("home");showOnly("home");renderHome();return true;}
// new
  if(world&&!world.classList.contains("hidden")){if(worldExplorerModule&&worldExplorerModule.back&&worldExplorerModule.back())return true;hubKid=null;saveAppPlace("home");showOnly("home");renderHome();return true;}
```

- [ ] **Step 6: `sw.js`.**
  - Bump `CACHE_NAME`: take the current number +1 and use the `-pixel-planet` suffix. For example, `"summer-quest-v113-desktop-acceptance"` becomes `"summer-quest-v114-pixel-planet"`.
  - Precache the new modules right after the existing world entry. Keep the Three.js vendor lines, because Solar needs them.

```js
  "./js/world/world-explorer.js",
  "./js/world/planet-palette.js",
  "./js/world/planet-map.js",
  "./js/world/planet-globe.js",
  "./js/world/planet-sprites.js",
  "./js/world/planet-toys.js",
  "./js/world/planet-minigames.js",
```

- [ ] **Step 7: Run the gates**

Run: `node scripts/check.mjs` — expected: green.
Run: `npm run test:world` — expected: rebuilds `dist/android-web`, then 7/7 pass.

### Task 4: Desktop verification

- [ ] **Step 8: Diagnostics sanity check**

With the app open on the planet, run `SummerQuest.getDiagnostics().world` in the DevTools console. Expected:
- `running: true` and `frames` increasing
- 12 `landmarks` and 27 `toys`, several with `visible: true`
- a `camera` with `position`, `distance`, `minDistance: 8.2`, `maxDistance: 16.4`, `rotation` and `zoom`

- [ ] **Step 9: Manual desktop pass**

Serve the repo root, for example with `python -m http.server 8080`, open `http://127.0.0.1:8080/index.html`, pick a hero and check each item:
- Drag spins the globe, and a flick coasts.
- The globe slowly rights itself.
- The mouse wheel zooms within limits.
- Tapping a place turns the planet to centre it, the hero hops, and the card shows bilingual text. **GO** opens real content, and Back returns to the planet in the same pose.
- Tapping toys plays a reaction and a sound. With Sound off (home 🔊 button), toys are silent.
- Tapping the moon, the whale, the molehill or the echo stone shows a card. **GO** starts the game, **Done 完成** ends it, and when time runs out the bar shows `Yay! 好棒！` with **OK 好**.
- While a game runs, `SQPlatform.triggerBack()` in the console returns `true` and ends the game; it does not leave the world.
- With DevTools "Emulate CSS prefers-reduced-motion: reduce": no idle spin, no cloud drift, and taps snap.

Record anything off as a fix inside this slice. Do not claim tablet results from this.

- [ ] **Step 10: Commit**

```bash
git add js/world/world-explorer.js scripts/world-explorer.test.mjs css/world-explorer.css index.html sw.js
git commit -m "feat(world): replace the 3D island with the pixel planet home"
```
