import * as THREE from "../vendor/three.module.min.js";
import { OrbitControls } from "../vendor/OrbitControls.js";

var current = null;
var savedViews = new Map();

function readView(kidId){
  var view=savedViews.get(kidId);
  try{if(!view)view=JSON.parse(window.localStorage.getItem("sq:world-view:"+kidId)||"null");}catch(error){}
  if(!view||![view.camera,view.target].every(function(row){return Array.isArray(row)&&row.length===3&&row.every(function(value){return Number.isFinite(value)&&Math.abs(value)<=50;});}))return null;
  return view;
}

function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function makeMaterial(hex,roughness){return new THREE.MeshStandardMaterial({color:hex,roughness:roughness==null?0.88:roughness,metalness:0});}
function makeMesh(geometry,material){var mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}
function addBox(group,size,position,hex,rotation){
  var mesh=makeMesh(new THREE.BoxGeometry(size[0],size[1],size[2]),makeMaterial(hex));
  mesh.position.set(position[0],position[1],position[2]);
  if(rotation)mesh.rotation.set(rotation[0]||0,rotation[1]||0,rotation[2]||0);
  group.add(mesh);return mesh;
}
function addCylinder(group,rTop,rBottom,height,segments,position,hex,rotation){
  var mesh=makeMesh(new THREE.CylinderGeometry(rTop,rBottom,height,segments||16),makeMaterial(hex));
  mesh.position.set(position[0],position[1],position[2]);
  if(rotation)mesh.rotation.set(rotation[0]||0,rotation[1]||0,rotation[2]||0);
  group.add(mesh);return mesh;
}
function addSphere(group,radius,position,hex,scale){
  var mesh=makeMesh(new THREE.SphereGeometry(radius,18,12),makeMaterial(hex));
  mesh.position.set(position[0],position[1],position[2]);
  if(scale)mesh.scale.set(scale[0],scale[1],scale[2]);
  group.add(mesh);return mesh;
}
function addCone(group,radius,height,position,hex,rotation){
  var mesh=makeMesh(new THREE.ConeGeometry(radius,height,12),makeMaterial(hex));
  mesh.position.set(position[0],position[1],position[2]);
  if(rotation)mesh.rotation.set(rotation[0]||0,rotation[1]||0,rotation[2]||0);
  group.add(mesh);return mesh;
}
function setInteractive(group,id,hitTargets){
  group.userData.contentId=id;
  group.traverse(function(obj){
    if(obj.isMesh){obj.userData.contentId=id;hitTargets.push(obj);}
  });
  return group;
}
function place(group,x,z,rotation){group.position.set(x,1.12,z);group.rotation.y=rotation||0;return group;}

function buildingBase(body,roof){
  var g=new THREE.Group();
  addBox(g,[1.25,0.95,1.05],[0,0.48,0],body);
  var top=addCone(g,0.9,0.72,[0,1.25,0],roof,[0,Math.PI/4,0]);
  top.scale.z=0.85;
  addBox(g,[0.28,0.52,0.08],[0,0.28,0.57],0x4e3c54);
  return g;
}
function makeArcade(){
  var g=buildingBase(0xff6fb5,0xffc93c);
  addBox(g,[0.78,0.27,0.14],[0,0.82,0.59],0x2b2757);
  addSphere(g,0.12,[-0.22,0.83,0.69],0x3ddc97);
  addSphere(g,0.12,[0.22,0.83,0.69],0x4ea8ff);
  return g;
}
function makeWorkshop(){
  var g=buildingBase(0xf19b5b,0xe85e4f);
  addBox(g,[0.12,0.82,0.12],[-0.35,1.05,0.62],0xd9e0eb,[0,0,0.45]);
  addBox(g,[0.12,0.82,0.12],[0.35,1.05,0.62],0xd9e0eb,[0,0,-0.45]);
  return g;
}
function makeAcademy(){
  var g=new THREE.Group();
  addCylinder(g,0.65,0.76,1.05,20,[0,0.52,0],0x5c73d8);
  var dome=addSphere(g,0.73,[0,1.1,0],0x8dd6ff,[1,0.52,1]);
  dome.material.roughness=0.38;
  addCylinder(g,0.08,0.08,0.75,10,[0.38,1.55,0],0xf4f1ff,[0,0,0.6]);
  addSphere(g,0.16,[0.62,1.76,0],0xffc93c);
  return g;
}
function makeLibrary(){
  var g=buildingBase(0x78a66b,0x356d4c);
  addBox(g,[0.85,0.12,0.12],[0,0.82,0.6],0xf4efe6);
  addBox(g,[0.65,0.09,0.13],[0,1.02,0.6],0xf4efe6);
  return g;
}
function makeMusic(){
  var g=new THREE.Group();
  addCylinder(g,0.86,0.86,0.18,24,[0,0.09,0],0x654c8f);
  addBox(g,[1.35,0.13,0.48],[0,0.38,0],0xf3f0ff);
  for(var i=0;i<7;i++)addBox(g,[0.14,0.06,0.5],[-0.45+i*0.15,0.48,0],i%2?0x2b2757:0xffffff);
  addCylinder(g,0.08,0.08,0.9,10,[0.62,0.67,-0.15],0xffc93c,[0,0,-0.25]);
  addSphere(g,0.18,[0.77,1.08,-0.15],0xff6fb5);
  return g;
}
function makeQuestBoard(){
  var g=new THREE.Group();
  addBox(g,[1.15,0.8,0.12],[0,0.9,0],0xc7894f);
  addBox(g,[0.12,1.2,0.12],[-0.43,0.46,0],0x765132);
  addBox(g,[0.12,1.2,0.12],[0.43,0.46,0],0x765132);
  addBox(g,[0.25,0.2,0.05],[-0.28,0.98,0.09],0xffc93c);
  addBox(g,[0.28,0.2,0.05],[0.14,0.75,0.09],0xf3f0ff);
  addBox(g,[0.22,0.17,0.05],[0.28,1.08,0.09],0x3ddc97);
  return g;
}
function makeClock(){
  var g=new THREE.Group();
  addBox(g,[0.72,1.45,0.72],[0,0.72,0],0xf0c78d);
  addCone(g,0.65,0.65,[0,1.78,0],0x4ea8ff);
  var face=addCylinder(g,0.28,0.28,0.08,24,[0,1.18,0.4],0xfff8df,[Math.PI/2,0,0]);
  face.rotation.x=Math.PI/2;
  addBox(g,[0.03,0.23,0.04],[0,1.21,0.45],0x2b2757,[0,0,-0.45]);
  addBox(g,[0.03,0.17,0.04],[0,1.21,0.45],0x2b2757,[0,0,0.8]);
  return g;
}
function makeRewards(){
  var g=new THREE.Group();
  addCylinder(g,0.8,0.95,0.3,20,[0,0.15,0],0x7c6bb5);
  addBox(g,[0.9,0.48,0.62],[0,0.58,0],0xc98a42);
  addBox(g,[0.94,0.16,0.66],[0,0.91,0],0xe9b35f);
  addBox(g,[0.13,0.32,0.08],[0,0.65,0.34],0xffc93c);
  addSphere(g,0.22,[0,1.28,0],0xffc93c,[1,0.55,1]);
  return g;
}
function makeTruck(){
  var g=new THREE.Group();
  addBox(g,[1.1,0.34,0.55],[0,0.47,0],0xff5d4f);
  addBox(g,[0.48,0.38,0.52],[-0.18,0.82,0],0x4ea8ff);
  [[-0.38,0.26,-0.32],[0.38,0.26,-0.32],[-0.38,0.26,0.32],[0.38,0.26,0.32]].forEach(function(p){
    addCylinder(g,0.18,0.18,0.13,14,p,0x2b2757,[Math.PI/2,0,0]);
  });
  return g;
}
function makeSolar(){
  var g=new THREE.Group();
  addSphere(g,0.3,[0,0.72,0],0xffc93c);
  addSphere(g,0.16,[0.58,0.8,0],0x4ea8ff);
  var ring=makeMesh(new THREE.TorusGeometry(0.6,0.025,8,40),makeMaterial(0xe4e1f3));
  ring.position.y=0.8; ring.rotation.x=Math.PI/2; g.add(ring);
  return g;
}
function makeBook(){
  var g=new THREE.Group();
  addBox(g,[0.62,0.12,0.85],[-0.32,0.42,0],0xf4efe6,[0,0,0.16]);
  addBox(g,[0.62,0.12,0.85],[0.32,0.42,0],0xf4efe6,[0,0,-0.16]);
  addBox(g,[0.06,0.15,0.86],[0,0.4,0],0x3f315c);
  return g;
}
function makePaint(){
  var g=new THREE.Group();
  addBox(g,[0.12,1.15,0.12],[-0.36,0.56,0],0x7b5538,[0,0,-0.18]);
  addBox(g,[0.12,1.15,0.12],[0.36,0.56,0],0x7b5538,[0,0,0.18]);
  addBox(g,[0.9,0.68,0.08],[0,0.78,0],0xf4efe6);
  addSphere(g,0.1,[-0.25,0.92,0.08],0xff6fb5);
  addSphere(g,0.1,[0,0.72,0.08],0x4ea8ff);
  addSphere(g,0.1,[0.25,0.9,0.08],0xffc93c);
  return g;
}

function addTree(scene,x,z,scale){
  var g=new THREE.Group();
  addCylinder(g,0.09,0.12,0.62,9,[0,0.31,0],0x80583b);
  addSphere(g,0.46,[0,0.83,0],0x5ca85d,[1,0.9,1]);
  addSphere(g,0.31,[-0.28,0.82,0.04],0x6fbd6d);
  addSphere(g,0.31,[0.27,0.92,-0.04],0x76c976);
  g.position.set(x,1.07,z);g.scale.setScalar(scale||1);scene.add(g);return g;
}
function addRock(scene,x,z,scale){
  var m=makeMesh(new THREE.DodecahedronGeometry(0.28,0),makeMaterial(0xa0a3ad));
  m.position.set(x,1.24,z);m.scale.set(scale||1,(scale||1)*0.72,(scale||1)*0.9);scene.add(m);return m;
}
function addPath(scene,angle,length){
  var group=new THREE.Group();
  for(var i=0;i<Math.floor(length/0.55);i++){
    var d=1.15+i*0.52;
    var x=Math.sin(angle)*d,z=Math.cos(angle)*d;
    var tile=addBox(group,[0.34,0.035,0.48],[x,1.34,z],i%2?0xf1d6a5:0xe6c68f,[0,-angle,0]);
    tile.receiveShadow=true;
  }
  scene.add(group);
}
function addCloud(scene,x,y,z,scale){
  var g=new THREE.Group();
  [[0,0,0,.5],[.42,.08,0,.38],[-.42,.03,.05,.34],[.08,.18,.02,.4]].forEach(function(p){
    var s=addSphere(g,p[3],[p[0],p[1],p[2]],0xffffff,[1.15,.7,1]);s.material.transparent=true;s.material.opacity=.88;
  });
  g.position.set(x,y,z);g.scale.setScalar(scale||1);scene.add(g);return g;
}
function createAvatar(kid){
  var g=new THREE.Group(), c=(kid&&kid.color)||"#4EA8FF";
  addCylinder(g,0.24,0.3,0.6,14,[0,0.45,0],c);
  addSphere(g,0.28,[0,0.98,0],0xffd7b5);
  addSphere(g,0.035,[-0.09,1.02,0.25],0x2b2757);
  addSphere(g,0.035,[0.09,1.02,0.25],0x2b2757);
  addCone(g,0.3,0.18,[0,1.25,0],c,[0,0,0]);
  g.position.set(0,1.15,0);return g;
}

function createWorld(options){
  var mount=options.mount;
  var registry=options.registry;
  var scene=new THREE.Scene();
  scene.background=new THREE.Color(0xbce8ff);
  scene.fog=new THREE.Fog(0xbce8ff,18,34);

  var camera=new THREE.PerspectiveCamera(43,Math.max(1,mount.clientWidth)/Math.max(1,mount.clientHeight),0.1,80);
  camera.position.set(9.4,7.2,10.4);

  var renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.55));
  renderer.setSize(Math.max(1,mount.clientWidth),Math.max(1,mount.clientHeight),false);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  mount.innerHTML="";mount.appendChild(renderer.domElement);

  var controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=0.07;controls.enablePan=false;
  controls.minDistance=8.2;controls.maxDistance=15.2;
  controls.minPolarAngle=0.66;controls.maxPolarAngle=1.22;
  controls.target.set(0,1.05,0);
  controls.zoomToCursor=false;

  scene.add(new THREE.HemisphereLight(0xeef9ff,0x5c4b3f,2.3));
  var sun=new THREE.DirectionalLight(0xfff4d8,3.1);sun.position.set(-6,11,7);sun.castShadow=true;
  sun.shadow.mapSize.width=1024;sun.shadow.mapSize.height=1024;sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;scene.add(sun);

  var water=addCylinder(scene,7.1,7.1,0.28,64,[0,-0.84,0],0x57b9d9);water.material.roughness=.42;
  var island=addCylinder(scene,5.75,5.15,1.65,48,[0,0.05,0],0x8a6749);island.receiveShadow=true;
  var grass=addCylinder(scene,5.72,5.68,0.24,48,[0,0.98,0],0x78bd63);grass.receiveShadow=true;
  var plaza=addCylinder(scene,1.45,1.52,0.09,36,[0,1.17,0],0xe7ce9e);plaza.receiveShadow=true;

  [0.1,1.1,2.15,3.2,4.25,5.3].forEach(function(a){addPath(scene,a,3.45);});
  [[-4.4,-1.4,.9],[-3.8,2.5,.78],[-1.2,4.25,.9],[2.1,4.0,.85],[4.15,2.1,.8],[4.3,-2.2,.78],[-2.3,-4.0,.75],[1.2,-4.2,.72]].forEach(function(p){addTree(scene,p[0],p[1],p[2]);});
  [[-4.8,.2,.9],[3.8,.3,.7],[.4,4.8,.65],[-.2,-4.7,.8]].forEach(function(p){addRock(scene,p[0],p[1],p[2]);});
  var clouds=[addCloud(scene,-8,7,-5,1.3),addCloud(scene,8,6,2,1),addCloud(scene,2,8,-8,.85)];
  var avatar=createAvatar(options.kid);scene.add(avatar);

  var hitTargets=[];
  var landmarks=[];
  var selected=null;
  var selectionEl=options.selectionEl,titleEl=options.titleEl,subtitleEl=options.subtitleEl,iconEl=options.iconEl,goEl=options.goEl;
  var active=false,destroyed=false,contextLost=false,nativePaused=false,frames=0,raf=0,last=performance.now(),clock=0,lastError=null;

  var defs=[
    {id:"section:quests",angle:0.08,r:2.45,scale:1.02,build:makeQuestBoard},
    {id:"section:games",angle:0.92,r:4.05,scale:1.12,build:makeArcade},
    {id:"section:acts",angle:1.84,r:4.15,scale:1.08,build:makeWorkshop},
    {id:"section:learn",angle:2.76,r:4.05,scale:1.08,build:makeAcademy},
    {id:"section:books",angle:3.67,r:4.12,scale:1.08,build:makeLibrary},
    {id:"section:music",angle:4.58,r:4.08,scale:1.05,build:makeMusic},
    {id:"section:day",angle:5.36,r:3.9,scale:.92,build:makeClock},
    {id:"section:rewards",angle:5.92,r:2.65,scale:.92,build:makeRewards}
  ];
  var featured=[
    {id:"game:monster-truck",angle:1.18,r:2.7,scale:.78,build:makeTruck},
    {id:"game:solar",angle:2.55,r:2.72,scale:.8,build:makeSolar},
    {id:"book:space",angle:3.95,r:2.8,scale:.82,build:makeBook},
    {id:"game:paint",angle:1.98,r:2.85,scale:.72,build:makePaint}
  ];

  defs.concat(featured).forEach(function(def){
    var entry=registry&&registry.get?registry.get(def.id):null;
    if(!entry)return;
    var x=Math.sin(def.angle)*def.r,z=Math.cos(def.angle)*def.r;
    var obj=def.build();obj.scale.setScalar(def.scale||1);place(obj,x,z,-def.angle+Math.PI);scene.add(obj);setInteractive(obj,def.id,hitTargets);
    landmarks.push({id:def.id,entry:entry,object:obj,baseY:obj.position.y,angle:def.angle,r:def.r});
  });

  function showSelection(item,quiet){
    selected=item||null;
    landmarks.forEach(function(mark){
      var active=selected&&mark.id===selected.id;mark.object.scale.setScalar((mark.object.userData.baseScale||1)*(active?1.1:1));
    });
    if(!item){selectionEl.classList.add("hidden");return;}
    var entry=item.entry;iconEl.textContent=entry.icon||"✨";titleEl.textContent=(entry.title&&entry.title[0])||entry.id;
    subtitleEl.textContent=entry.available===false?"Not available right now · 現在暫時無法開啟":(entry.title&&entry.title[1]?entry.title[1]+" · ":"")+((entry.blurb&&entry.blurb[0])||"");
    goEl.disabled=entry.available===false;selectionEl.classList.remove("hidden");
    if(!quiet&&options.haptic)options.haptic("tap");
  }
  landmarks.forEach(function(mark){mark.object.userData.baseScale=mark.object.scale.x;});
  function refreshRegistry(){
    landmarks.forEach(function(mark){var entry=registry.get(mark.id);mark.object.visible=!!entry;if(entry)mark.entry=entry;});
    if(selected)showSelection(selected.object.visible?selected:null,true);
  }

  var raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),down=null;
  function hitAt(clientX,clientY){
    var rect=renderer.domElement.getBoundingClientRect();
    pointer.x=((clientX-rect.left)/rect.width)*2-1;pointer.y=-((clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(pointer,camera);
    var hits=raycaster.intersectObjects(hitTargets.filter(function(object){return object.parent&&object.parent.visible;}),false);
    if(!hits.length)return null;
    var id=hits[0].object.userData.contentId;
    for(var i=0;i<landmarks.length;i++)if(landmarks[i].id===id)return landmarks[i];
    return null;
  }
  function onPointerDown(e){if(active)down={x:e.clientX,y:e.clientY,t:performance.now()};}
  function onPointerCancel(){down=null;}
  function onPointerUp(e){
    if(!down)return;var dx=e.clientX-down.x,dy=e.clientY-down.y,dist=Math.sqrt(dx*dx+dy*dy),elapsed=performance.now()-down.t;down=null;
    if(dist>11||elapsed>700)return;
    var item=hitAt(e.clientX,e.clientY);if(!item){showSelection(null);return;}
    showSelection(item);
    var target=item.object.getWorldPosition(new THREE.Vector3());
    controls.target.lerp(new THREE.Vector3(target.x,1.0,target.z),0.45);
    saveView();
  }
  renderer.domElement.addEventListener("pointerdown",onPointerDown);
  renderer.domElement.addEventListener("pointerup",onPointerUp);
  renderer.domElement.addEventListener("pointercancel",onPointerCancel);

  goEl.onclick=async function(){
    if(!selected||!registry||typeof registry.open!=="function")return;
    refreshRegistry();if(!selected||selected.entry.available===false)return;
    var id=selected.id;goEl.disabled=true;
    try{
      var result=await registry.open(selected.id,{origin:"world"});
      if(result&&result.ok){if(options.haptic)options.haptic("success");}
      else if(selected&&selected.id===id)subtitleEl.textContent="Could not open. Try again or choose Classic. · 暫時無法開啟，請重試或選經典介面。";
    }catch(error){
      console.error("World content launch failed",error);
      if(selected&&selected.id===id)subtitleEl.textContent="Could not open. Try again or choose Classic. · 暫時無法開啟，請重試或選經典介面。";
    }finally{if(!destroyed&&selected){var entry=registry.get(selected.id);goEl.disabled=!entry||entry.available===false;}}
  };

  var saved=readView(options.kidId);
  if(saved){camera.position.fromArray(saved.camera);controls.target.fromArray(saved.target);controls.target.set(clamp(controls.target.x,-5,5),clamp(controls.target.y,0,3),clamp(controls.target.z,-5,5));}
  controls.update();
  showSelection(saved&&landmarks.find(function(mark){return mark.id===saved.selected;})||null,true);

  function saveView(){
    var view={camera:camera.position.toArray(),target:controls.target.toArray(),selected:selected&&selected.id};
    savedViews.set(options.kidId,view);
    try{window.localStorage.setItem("sq:world-view:"+options.kidId,JSON.stringify(view));}catch(error){}
  }
  controls.addEventListener("end",saveView);
  function frame(now){
    if(!active)return;
    var dt=Math.min(.05,(now-last)/1000);last=now;clock+=dt;
    controls.update();
    avatar.position.y=1.15+Math.sin(clock*2.2)*.035;avatar.rotation.y=Math.sin(clock*.75)*.12;
    landmarks.forEach(function(mark,index){
      if(mark.id.indexOf("section:")!==0)mark.object.position.y=mark.baseY+Math.sin(clock*1.8+index)*.04;
    });
    clouds.forEach(function(c,index){c.rotation.y+=dt*(.025+index*.008);});
    water.material.color.setHSL(.54,.58,.58+Math.sin(clock*.6)*.015);
    try{renderer.render(scene,camera);frames++;raf=requestAnimationFrame(frame);}
    catch(error){lastError=String(error.message||error);console.error("Summer Quest world render failed",error);pause();if(options.onStatus)options.onStatus("paused",lastError);}
  }
  function pause(){
    active=false;controls.enabled=false;down=null;cancelAnimationFrame(raf);saveView();
  }
  function resume(){
    if(destroyed||contextLost||nativePaused||document.hidden||!mount.isConnected||mount.closest(".hidden"))return;
    refreshRegistry();resize();if(active)return;
    active=true;controls.enabled=true;last=performance.now();raf=requestAnimationFrame(frame);
  }
  function resize(){var w=Math.max(1,mount.clientWidth),h=Math.max(1,mount.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
  function destroy(){
    if(destroyed)return;pause();destroyed=true;controls.removeEventListener("end",saveView);controls.dispose();
    document.removeEventListener("visibilitychange",onVisibility);
    window.removeEventListener("summerquest:native-pause",onNativePause);window.removeEventListener("summerquest:native-resume",onNativeResume);window.removeEventListener("pagehide",pause);
    if(resizeObserver)resizeObserver.disconnect();else window.removeEventListener("resize",resize);
    renderer.domElement.removeEventListener("pointerdown",onPointerDown);renderer.domElement.removeEventListener("pointerup",onPointerUp);renderer.domElement.removeEventListener("pointercancel",onPointerCancel);
    renderer.domElement.removeEventListener("webglcontextlost",onContextLost);renderer.domElement.removeEventListener("webglcontextrestored",onContextRestored);
    scene.traverse(function(object){
      if(object.geometry)object.geometry.dispose();
      if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(function(material){material.dispose();});
      if(object.shadow)object.shadow.dispose();
    });
    renderer.dispose();goEl.onclick=null;mount.innerHTML="";
  }
  function onVisibility(){if(document.hidden)pause();else if(!mount.closest(".hidden"))resume();}
  function onNativePause(){nativePaused=true;pause();}
  function onNativeResume(){nativePaused=false;resume();}
  function onContextLost(e){e.preventDefault();contextLost=true;pause();if(options.onStatus)options.onStatus("paused");}
  function onContextRestored(){contextLost=false;lastError=null;if(options.onStatus)options.onStatus("ready");resume();}
  document.addEventListener("visibilitychange",onVisibility);
  window.addEventListener("summerquest:native-pause",onNativePause);window.addEventListener("summerquest:native-resume",onNativeResume);window.addEventListener("pagehide",pause);
  var resizeObserver=typeof ResizeObserver!=="undefined"?new ResizeObserver(resize):null;if(resizeObserver)resizeObserver.observe(mount);else window.addEventListener("resize",resize);
  renderer.domElement.addEventListener("webglcontextlost",onContextLost);
  renderer.domElement.addEventListener("webglcontextrestored",onContextRestored);
  /* A successful startup includes a rendered frame, not just a mounted canvas. */
  try{renderer.render(scene,camera);frames++;}catch(error){destroy();throw error;}
  resume();

  function snapshot(){
    scene.updateMatrixWorld(true);camera.updateMatrixWorld();
    var rect=renderer.domElement.getBoundingClientRect();
    return {running:active,frames:frames,contextLost:contextLost,error:lastError,selected:selected&&selected.id,
      camera:{position:camera.position.toArray(),target:controls.target.toArray(),distance:camera.position.distanceTo(controls.target),minDistance:controls.minDistance,maxDistance:controls.maxDistance},
      landmarks:landmarks.map(function(mark){
        var point=null;
        mark.object.traverse(function(object){
          if(point||!object.isMesh||!mark.object.visible)return;
          var projected=new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).project(camera);
          if(Math.abs(projected.x)>1||Math.abs(projected.y)>1||Math.abs(projected.z)>1)return;
          var x=rect.left+(projected.x+1)*rect.width/2,y=rect.top+(1-projected.y)*rect.height/2;
          if(hitAt(x,y)===mark)point={x:x,y:y};
        });
        return {id:mark.id,x:point&&point.x,y:point&&point.y,visible:!!point,available:mark.entry.available!==false};
      })};
  }

  return {pause:pause,resume:resume,resize:resize,destroy:destroy,showSelection:showSelection,snapshot:snapshot};
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
export function snapshot(){return current?Object.assign({kidId:current.kidId},current.instance.snapshot()):null;}
