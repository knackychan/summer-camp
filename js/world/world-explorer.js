/* Summer Quest Pixel Planet — the child's world home (docs/plans/2026-10-02-pixel-planet).
   A software-rendered pixel globe on a 2D canvas: places open real content through the
   registry, toys react, sparkly toys start tiny in-place games. No stars, no navigation of its own. */
import { HEX, C, nearestIndex } from "./planet-palette.js";
import { buildPlanetMap, buildCloudMap, SITES, MAP_W, DEFAULT_SEED } from "./planet-map.js";
import { facingQuat, project, unproject, drawGlobe, cloudAtPoint, quatMul, quatAxisAngle, quatNormalize, quatRotate, quatConj, quatSlerp } from "./planet-globe.js";
import { buildAtlas, LANDMARK_SPRITE } from "./planet-sprites.js";
import { TOYS, SOUNDS, GAMES, SKY } from "./planet-toys.js";
import { createMinigame } from "./planet-minigames.js";

var current = null;
var savedViews = new Map();

function selectionSubtitle(entry){
  if(entry.available===false)return "Not available right now · 現在暫時無法開啟";
  var title=entry.title||[],blurb=entry.blurb||[];
  return [blurb[0],[title[1],blurb[1]].filter(Boolean).join(" · ")].filter(Boolean).join("\n");
}

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

/* The map and clouds are fixed by the seed and the atlas only varies by hero colour,
   so a kid switch reuses them instead of rebuilding before the first frame. All read-only. */
var planetArt=null,atlases=new Map();
function worldArt(heroIndex){
  if(!planetArt)planetArt={map:buildPlanetMap(DEFAULT_SEED),clouds:buildCloudMap(DEFAULT_SEED)};
  if(!atlases.has(heroIndex))atlases.set(heroIndex,buildAtlas(heroIndex));
  return {map:planetArt.map,clouds:planetArt.clouds,atlas:atlases.get(heroIndex)};
}

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
  var goText=goEl.textContent,shell=selectionEl.parentElement;
  var reduced=!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var coarse=!!(window.matchMedia&&window.matchMedia("(pointer: coarse)").matches);
  var heroIndex=nearestIndex((options.kid&&(options.kid.raw||options.kid.color))||"#4EA8FF");

  var canvas=document.createElement("canvas");
  canvas.dataset.sqWorld="planet";
  mount.innerHTML="";mount.appendChild(canvas);
  var ctx=canvas.getContext("2d");
  if(!ctx){mount.innerHTML="";throw new Error("2D canvas unavailable for the planet world");}
  var globeCanvas=document.createElement("canvas"),gctx=globeCanvas.getContext("2d");
  var art=worldArt(heroIndex),map=art.map,clouds=art.clouds,atlas=art.atlas;

  var seed=11;
  function rand(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646;}
  function between(range){return range[0]+(range[1]-range[0])*rand();}
  var starField=[];
  for(var s=0;s<150;s++)starField.push({x:rand(),y:rand(),layer:rand()<0.35?1:0,twinkle:rand()<0.3,color:rand()<0.2?C.yellow:C.white});

  var scale=4,dpr=1,bw=1,bh=1,cx=0,cy=0,globeImage=null,globeData=null;
  var focus=null,dim=0,cardKey="",silhouettes=new WeakMap();
  var rotation=DEFAULT_VIEW.slice(),zoom=1,dirty=true,viewDirty=false;
  var cloudOffset=0,cloudDrawn=0,starShift=[0,0],clock=0,tick=0;
  var pointers=new Map(),gesture=null,pinch=null,momentum=null,easing=null,lastInput=performance.now();
  var particles=[],confetti=[],selected=null,minigame=null,hudTimer=0;
  var active=false,destroyed=false,nativePaused=false,frames=0,raf=0,last=performance.now(),lastError=null;

  var places=SITES.map(function(site){
    return {kind:"place",id:site.id,lat:site.lat,lon:site.lon,sprite:LANDMARK_SPRITE[site.id],entry:null,react:null,ambient:rand()*2};
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
  function radius(){return Math.max(8,Math.round(Math.min(bw,bh)*0.45*zoom));}
  function view(){return {rotation:rotation,radius:radius(),cx:cx,cy:cy};}

  /* ---------- selection card ---------- */
  function cardFor(item){
    if(item.kind==="place")return item.entry;
    var game=GAMES[item.toy.game];
    return {icon:game.icon,title:game.title,blurb:game.blurb,available:true};
  }
  function showSelection(item,quiet){
    selected=item||null;
    if(!item){focus=null;dockCard();selectionEl.classList.add("hidden");dirty=true;return;}
    var entry=cardFor(item);
    iconEl.textContent=entry.icon||"✨";titleEl.textContent=(entry.title&&entry.title[0])||item.id;
    subtitleEl.textContent=selectionSubtitle(entry);
    goEl.textContent=goText;goEl.disabled=entry.available===false;selectionEl.classList.remove("hidden");
    selectionEl.classList.toggle("is-locked",goEl.disabled);
    if(!quiet)haptic("tap");
  }

  /* ---------- focus mode (design 2026-10-03-planet-focus-readability D3–D8) ---------- */
  /* The chosen thing pops to 2× over a dimmed scene and the card hangs off it. Any press
     outside the card and the sprite leaves focus; a second tap on the sprite goes. */
  function enterFocus(item,quiet){
    showSelection(item,quiet);
    focus={item:item,t:reduced?1:0};cardKey="";dirty=true;
    shell.classList.add("is-focus");selectionEl.classList.add("is-anchored");
    placeCard();
  }
  function dockCard(){
    shell.classList.remove("is-focus");selectionEl.classList.remove("is-anchored","is-above");
    selectionEl.style.left=selectionEl.style.top="";cardKey="";
  }
  function focusScale(){
    var t=focus.t;
    if(t>=1)return 2;
    var c=1.70158,u=t-1;
    return 1+(1+(c+1)*u*u*u+c*u*u);
  }
  function focusBox(){
    var item=focus.item,img=atlas[item.sprite].normal[0],k=focusScale(),pose=reactionPose(item);
    var w=img.width*k,h=img.height*k;
    var top=item.kind==="moon"?item.y-h/2:item.y-(img.height-2)*k+pose.dy*k;
    return {left:item.x-w/2,top:top,w:w,h:h,k:k};
  }
  function inFocus(x,y){
    var box=focusBox(),pad=coarse?Math.max(0,(44/scale-Math.min(box.w,box.h))/2):0;
    return x>=box.left-pad&&x<=box.left+box.w+pad&&y>=box.top-pad&&y<=box.top+box.h+pad;
  }
  function silhouette(img){
    var white=silhouettes.get(img);
    if(white)return white;
    white=document.createElement("canvas");white.width=img.width;white.height=img.height;
    var c=white.getContext("2d");c.drawImage(img,0,0);c.globalCompositeOperation="source-in";c.fillStyle=HEX[C.white];c.fillRect(0,0,white.width,white.height);
    silhouettes.set(img,white);return white;
  }
  function drawFocus(){
    var item=focus.item,box=focusBox(),frames=atlas[item.sprite][item.kind==="place"&&item.entry&&item.entry.available===false?"sleep":"normal"];
    var idle=item.kind==="place"&&frames.length>1&&!reduced?(Math.floor(clock*2)%2):0;
    var img=frames[Math.min(frames.length-1,idle)];
    var x=Math.round(box.left),y=Math.round(box.top),w=Math.round(box.w),h=Math.round(box.h);
    if(item.kind!=="moon"){
      var half=Math.max(3,Math.round(img.width*0.4*box.k));
      ctx.globalAlpha=0.5;ctx.fillStyle=HEX[C.outline];
      ctx.fillRect(item.x-half,item.y+1,half*2,1);ctx.fillRect(item.x-half+2,item.y+2,half*2-4,1);
      ctx.globalAlpha=1;
    }
    var white=silhouette(img);
    ctx.drawImage(white,x-1,y,w,h);ctx.drawImage(white,x+1,y,w,h);ctx.drawImage(white,x,y-1,w,h);ctx.drawImage(white,x,y+1,w,h);
    ctx.drawImage(img,x,y,w,h);
  }
  /* The card hangs below the sprite, tail pointing up, or above it when the bottom is too close.
     The mount fills the shell from its top-left, so buffer × scale is shell coordinates. */
  function placeCard(){
    if(!focus||minigame)return;
    var box=focusBox(),cw=selectionEl.offsetWidth,ch=selectionEl.offsetHeight,W=shell.clientWidth,H=shell.clientHeight;
    var gap=16,margin=12,ax=(box.left+box.w/2)*scale;
    var below=(box.top+box.h)*scale+gap,above=box.top*scale-gap-ch;
    var up=below+ch>H-margin&&above>=margin;
    var top=up?above:Math.max(margin,Math.min(below,H-margin-ch));
    var left=clamp(ax-cw/2,margin,Math.max(margin,W-margin-cw)),tail=clamp(ax-left,24,cw-24);
    var key=Math.round(left)+","+Math.round(top)+","+Math.round(tail)+","+up;
    if(key===cardKey)return;
    cardKey=key;
    selectionEl.style.left=Math.round(left)+"px";selectionEl.style.top=Math.round(top)+"px";
    selectionEl.style.setProperty("--tail-x",Math.round(tail)+"px");selectionEl.classList.toggle("is-above",up);
  }
  function stepFocus(dt){
    var target=focus&&!minigame?1:0;
    dim=reduced?target:dim+(target-dim)*Math.min(1,dt*12);
    if(Math.abs(dim-target)<0.01)dim=target;
    if(focus){if(focus.t<1)focus.t=Math.min(1,focus.t+dt/0.24);placeCard();}
  }
  function refreshRegistry(){
    // One catalog snapshot: get(id) otherwise rebuilds every entry for each landmark.
    var entries=typeof registry.list==="function"?new Map(registry.list().map(function(entry){return [entry.id,entry];})):null;
    places.forEach(function(mark){mark.entry=entries?entries.get(mark.id)||null:registry.get(mark.id);});
    if(selected&&selected.kind==="place")showSelection(selected.entry?selected:null,true);
    dirty=true;
  }

  /* ---------- view persistence ---------- */
  function saveView(){
    var saved={rotation:rotation.slice(),zoom:clamp(zoom,MIN_ZOOM,MAX_ZOOM),selected:selected&&selected.kind==="place"?selected.id:null};
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
      if(item.z<=0.08)return;
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
    return cloudAtPoint(clouds,x,y,view(),cloudDrawn);
  }
  function tap(clientX,clientY){
    var hit=hitAt(clientX,clientY);
    if(hit.kind==="place"){
      enterFocus(hit);react(hit,"hop");focusOn(hit);
      hero.react=null;react(hero,"hop");hero.flip=hit.x<hero.x;playSound("pop");
      return;
    }
    if(hit.kind==="toy"||hit.kind==="moon"){
      var toy=hit.toy;
      react(hit,toy.react);playSound(toy.sound);haptic("tap");
      if(toy.fx)spawn(toy.fx,hit.x,hit.kind==="moon"?hit.y:hit.top+2,toy.count);
      if(toy.game){enterFocus(hit,true);if(hit.kind==="toy")focusOn(hit);}
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
    focus=null;dockCard();updateGameEnv();
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
    minigame=null;dirty=true;goEl.textContent=goText;showSelection(null);
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
    if(pointers.size===1){
      gesture={x0:e.clientX,y0:e.clientY,t0:performance.now(),lastX:e.clientX,lastY:e.clientY,lastT:performance.now(),vx:0,vy:0,multi:false};momentum=null;
      if(focus){
        var at=toBuffer(e.clientX,e.clientY);
        // A press away from the focused sprite leaves focus and is spent: it never also taps what it landed on.
        if(inFocus(at.x,at.y))gesture.focusTap=true;else{gesture.spent=true;showSelection(null);}
      }
      if(!gesture.focusTap)easing=null;
    }
    else if(pointers.size===2&&gesture){gesture.multi=true;pinch={distance:pinchDistance(),zoom:zoom};if(focus)showSelection(null);}
  }
  function onPointerMove(e){
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(minigame){var b=toBuffer(e.clientX,e.clientY);minigame.pointer("move",b.x,b.y);return;}
    if(!gesture)return;
    // Hard clamp, no rubber band: the zoom under the fingers is the zoom that stays on release (D2).
    if(pointers.size>=2&&pinch){zoom=clamp(pinch.zoom*pinchDistance()/pinch.distance,MIN_ZOOM,MAX_ZOOM);dirty=true;viewDirty=true;return;}
    if(gesture.multi)return;
    var now=performance.now(),dx=(e.clientX-gesture.lastX)/scale,dy=(e.clientY-gesture.lastY)/scale,dt=Math.max(1,now-gesture.lastT)/1000;
    if(focus&&Math.hypot(e.clientX-gesture.x0,e.clientY-gesture.y0)>11){gesture.focusTap=false;easing=null;showSelection(null);}
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
    if(e.type==="pointerup"&&!g.multi&&moved<=11&&elapsed<700){
      if(g.spent)return;
      if(g.focusTap&&focus){go();return;}
      tap(e.clientX,e.clientY);return;
    }
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

  /* ---------- canvas context loss ---------- */
  /* Android Chrome can drop a 2D canvas backing store; on restore the context comes back blank,
     with smoothing on. Sprite canvases may be blank too, so the hero-colour atlas is rebuilt. */
  var lostCanvases=new Set();
  function onContextLost(e){lostCanvases.add(e.target);}
  function onContextRestored(e){
    lostCanvases.delete(e.target);dirty=true;
    if(e.target!==canvas)return;
    ctx.imageSmoothingEnabled=false;
    atlases.delete(heroIndex);atlas=gameEnv.atlas=worldArt(heroIndex).atlas;
  }
  canvas.addEventListener("contextlost",onContextLost);canvas.addEventListener("contextrestored",onContextRestored);
  globeCanvas.addEventListener("contextlost",onContextLost);globeCanvas.addEventListener("contextrestored",onContextRestored);

  async function go(){
    if(minigame){endMinigame();return;}
    if(!selected)return;
    if(selected.kind!=="place"){startMinigame(selected.toy.game);return;}
    if(!registry||typeof registry.open!=="function")return;
    refreshRegistry();if(!selected||selected.entry.available===false)return;
    var id=selected.id;goEl.disabled=true;
    try{
      var result=await registry.open(selected.id,{origin:"world"});
      // Focus is a moment, not saved state: coming back shows the plain planet (D7).
      if(result&&result.ok){haptic("success");if(!destroyed&&selected&&selected.id===id)showSelection(null);}
      else if(selected&&selected.id===id)subtitleEl.textContent="Could not open. Try again or choose Classic. · 暫時無法開啟，請重試或選經典介面。";
    }catch(error){
      console.error("World content launch failed",error);
      if(selected&&selected.id===id)subtitleEl.textContent="Could not open. Try again or choose Classic. · 暫時無法開啟，請重試或選經典介面。";
    }finally{if(!destroyed&&selected&&selected.kind==="place"){var entry=registry.get(selected.id);goEl.disabled=!entry||entry.available===false;}}
  }
  goEl.onclick=go;

  /* ---------- rendering ---------- */
  function resize(){
    var w=Math.max(1,mount.clientWidth),h=Math.max(1,mount.clientHeight);
    var previousScale=scale;
    /* 6 CSS px per art px (4.5 on small screens), rounded to whole device pixels so every art
       pixel is equally wide on 1.5×/2.25×/2.625× tablets instead of beating 6,7,6,7 (D1). */
    dpr=window.devicePixelRatio||1;
    scale=Math.max(1,Math.round((Math.min(w,h)<600?4.5:6)*dpr))/dpr;
    bw=Math.ceil(w/scale);bh=Math.ceil(h/scale);
    if(globeImage&&canvas.width===bw&&canvas.height===bh&&previousScale===scale){if(minigame)updateGameEnv();cardKey="";return;}
    if(canvas.width!==bw||canvas.height!==bh){
      canvas.width=globeCanvas.width=bw;canvas.height=globeCanvas.height=bh;
      globeImage=gctx.createImageData(bw,bh);globeData=new Uint32Array(globeImage.data.buffer);
    }
    canvas.style.width=(bw*scale)+"px";canvas.style.height=(bh*scale)+"px";
    cx=Math.floor(bw/2);cy=Math.floor(bh*0.52);
    ctx.imageSmoothingEnabled=false;dirty=true;cardKey="";
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
  }
  function drawConfetti(){
    confetti.forEach(function(p){ctx.fillStyle=HEX[p.color];ctx.fillRect(Math.round(p.x),Math.round(p.y),1,1);});
  }
  function ambient(dt){
    if(reduced||minigame)return;
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
    if(dim>0&&!minigame){ctx.globalAlpha=0.68*dim;ctx.fillStyle=HEX[C.space];ctx.fillRect(0,0,bw,bh);ctx.globalAlpha=1;}
    if(focus&&!minigame)drawFocus();
    if(minigame){ctx.globalAlpha=0.62;ctx.fillStyle=HEX[C.space];ctx.fillRect(0,0,bw,bh);ctx.globalAlpha=1;minigame.draw(ctx);}
    drawConfetti();
  }
  function frame(now){
    if(!active)return;
    /* rAF stamps can trail the performance.now() taken in resume(); never step backwards. */
    var dt=clamp((now-last)/1000,0,0.05);last=now;clock+=dt;
    try{
      if(!minigame)updateMotion(dt);
      if(reduced&&!dirty&&!focus&&!particles.length&&!confetti.length&&!minigame&&!moon.react&&!surface.some(function(item){return item.react;})){
        raf=requestAnimationFrame(frame);return;
      }
      if(!reduced)cloudOffset+=dt*0.012;
      if(Math.abs(cloudOffset-cloudDrawn)>Math.PI*2/MAP_W)dirty=true;
      if(dirty)renderGlobe();
      layout();stepReactions(dt);stepFocus(dt);ambient(dt);stepMinigame(dt);
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
    canvas.removeEventListener("contextlost",onContextLost);canvas.removeEventListener("contextrestored",onContextRestored);
    globeCanvas.removeEventListener("contextlost",onContextLost);globeCanvas.removeEventListener("contextrestored",onContextRestored);
    goEl.onclick=null;goEl.textContent=goText;minigame=null;mount.innerHTML="";
  }
  function back(){
    if(minigame){endMinigame();return true;}
    if(focus){showSelection(null);return true;}
    return false;
  }
  function onVisibility(){if(document.hidden)pause();else if(!mount.closest(".hidden"))resume();}
  function onNativePause(){nativePaused=true;pause();}
  function onNativeResume(){nativePaused=false;resume();}
  document.addEventListener("visibilitychange",onVisibility);
  window.addEventListener("summerquest:native-pause",onNativePause);window.addEventListener("summerquest:native-resume",onNativeResume);window.addEventListener("pagehide",pause);
  var resizeObserver=typeof ResizeObserver!=="undefined"?new ResizeObserver(resize):null;if(resizeObserver)resizeObserver.observe(mount);else window.addEventListener("resize",resize);

  var saved=readView(options.kidId);
  if(saved){rotation=saved.rotation;zoom=saved.zoom;}
  refreshRegistry();resize();
  /* A successful startup includes a rendered frame, not just a mounted canvas. */
  try{renderGlobe();layout();composite();frames++;}catch(error){destroy();throw error;}
  // The world opens unfocused; the saved selection is no longer restored (D7).
  showSelection(null,true);
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
    return {running:active,frames:frames,contextLost:lostCanvases.size>0,error:lastError,selected:selected&&selected.id,minigame:minigame&&minigame.kind,
      camera:{position:quatRotate(quatConj(rotation),[0,0,distance]),target:[0,0,0],distance:distance,minDistance:BASE_DISTANCE/MAX_ZOOM,maxDistance:BASE_DISTANCE/MIN_ZOOM,rotation:rotation.slice(),zoom:zoom},
      landmarks:places.map(function(mark){var at=point(mark);return {id:mark.id,x:at&&at.x,y:at&&at.y,visible:!!at,available:!!mark.entry&&mark.entry.available!==false};}),
      toys:toys.map(function(toy){var at=point(toy);return {id:toy.id,x:at&&at.x,y:at&&at.y,visible:!!at};})};
  }

  return {pause:pause,resume:resume,resize:resize,destroy:destroy,showSelection:showSelection,snapshot:snapshot,back:back};
}

export async function start(options){
  if(!options||!options.mount||!options.registry)throw new Error("Summer Quest world requires mount + registry");
  if(current&&current.kidId===options.kidId){current.instance.resume();return current.instance;}
  if(current){current.instance.destroy();current=null;}
  var instance=createWorld(options);current={kidId:options.kidId,instance:instance};return instance;
}
export function pause(){if(current)current.instance.pause();}
export function resume(){if(current)current.instance.resume();}
export function destroy(){if(current){current.instance.destroy();current=null;}}
export function back(){return current?current.instance.back():false;}
export function snapshot(){return current?Object.assign({kidId:current.kidId},current.instance.snapshot()):null;}
