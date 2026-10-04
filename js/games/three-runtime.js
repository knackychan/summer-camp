/* Keep current Three on WebGL2. Only WebGL1-only devices download r162. */
function graphicsError(message){
  var error=new Error(message);error.code="SQ_GRAPHICS_UNAVAILABLE";return error;
}

export function releaseContext(runtime){
  var extension=runtime.context.getExtension("WEBGL_lose_context");
  if(extension)extension.loseContext();
}

export function graphicsContext(canvas){
  var device=typeof navigator==="undefined"?{}:navigator;
  var android=/Android (\d+)/.exec(device.userAgent||"");
  var reduced=!!((android&&Number(android[1])<=9)||(device.deviceMemory&&device.deviceMemory<=4));
  var attributes={alpha:false,depth:true,stencil:false,antialias:!reduced,powerPreference:"default"};
  function get(kind){try{return canvas.getContext(kind,attributes);}catch(error){return null;}}
  var context=get("webgl2");
  if(!context&&attributes.antialias){attributes.antialias=false;reduced=true;context=get("webgl2");}
  var legacy=!context;
  if(legacy){attributes.antialias=false;context=get("webgl")||get("experimental-webgl");}
  if(!context)throw graphicsError("This device could not start 3D graphics.");
  return {canvas:canvas,context:context,attributes:attributes,legacy:legacy,reduced:reduced||legacy};
}

/* Adreno 3xx on WebGL1 (Lenovo TB-8504F, Adreno 308, Chrome 138) loses any GLSL
   struct that crosses a function call (out, inout, returned), so r162's lit
   materials draw black. Same maths as macros: no struct crosses a call. Only
   Lambert's light functions are rewritten; Phong/Standard stay broken there,
   which is why reduced quality uses Lambert. Proven pixel-identical in SwiftShader. */
var STRUCT_FREE_LIGHTS={
  getDirectionalLightInfo:"#define getDirectionalLightInfo( directionalLight, light ) light.color = directionalLight.color; light.direction = directionalLight.direction; light.visible = true",
  getPointLightInfo:"#define getPointLightInfo( pointLight, geometryPosition, light ) light.direction = normalize( pointLight.position - geometryPosition ); light.color = pointLight.color * getDistanceAttenuation( length( pointLight.position - geometryPosition ), pointLight.distance, pointLight.decay ); light.visible = ( light.color != vec3( 0.0 ) )",
  getSpotLightInfo:"#define getSpotLightInfo( spotLight, geometryPosition, light ) light.direction = normalize( spotLight.position - geometryPosition ); light.color = spotLight.color * getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, dot( light.direction, spotLight.direction ) ) * getDistanceAttenuation( length( spotLight.position - geometryPosition ), spotLight.distance, spotLight.decay ); light.visible = ( light.color != vec3( 0.0 ) )",
  getHemisphereLightIrradiance:"#define getHemisphereLightIrradiance( hemiLight, normal ) ( mix( hemiLight.groundColor, hemiLight.skyColor, 0.5 * dot( normal, hemiLight.direction ) + 0.5 ) )"
};
export function structFreeLighting(chunks){
  if(chunks.sqStructFree)return true;
  var lights=chunks.lights_pars_begin,lambert=chunks.lights_lambert_pars_fragment;
  for(var name in STRUCT_FREE_LIGHTS){
    var next=lights.replace(new RegExp("\\t(?:void|vec3) "+name+"\\([\\s\\S]*?\\n\\t}\\n"),"\t"+STRUCT_FREE_LIGHTS[name]+"\n");
    if(next===lights)return false;
    lights=next;
  }
  var cut=lambert.indexOf("void RE_Direct_Lambert");
  if(cut<0)return false;
  chunks.lights_pars_begin=lights;
  chunks.lights_lambert_pars_fragment=lambert.slice(0,cut)+
    "#define RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight ) reflectedLight.directDiffuse += saturate( dot( geometryNormal, directLight.direction ) ) * directLight.color * BRDF_Lambert( material.diffuseColor )\n"+
    "#define RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight ) reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor )\n";
  chunks.sqStructFree=true;
  return true;
}

export async function loadThree(canvas,withControls){
  var runtime=graphicsContext(canvas);
  try{
    var modules;
    if(runtime.legacy){
      modules=await Promise.all([
        import("../vendor/three-legacy/three.module.min.js"),
        import("../vendor/three-legacy/Timer.js"),
        withControls?import("../vendor/three-legacy/OrbitControls.js"):Promise.resolve(null)
      ]);
      structFreeLighting(modules[0].ShaderChunk);
      runtime.THREE=Object.assign({},modules[0],{Timer:modules[1].Timer});
      runtime.OrbitControls=modules[2]&&modules[2].OrbitControls;
    }else{
      modules=await Promise.all([
        import("../vendor/three.module.min.js"),
        withControls?import("../vendor/OrbitControls.js"):Promise.resolve(null)
      ]);
      runtime.THREE=modules[0];runtime.OrbitControls=modules[1]&&modules[1].OrbitControls;
    }
    return runtime;
  }catch(error){releaseContext(runtime);throw error;}
}

export function createRenderer(runtime,maxPixelRatio){
  var renderer,canvas=runtime.canvas;
  try{renderer=new runtime.THREE.WebGLRenderer(Object.assign({canvas:canvas,context:runtime.context},runtime.attributes));}
  catch(error){releaseContext(runtime);throw graphicsError(error.message);}
  renderer.sqReducedQuality=runtime.reduced;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,runtime.reduced?1:maxPixelRatio));
  canvas.dataset.sqGraphics=runtime.legacy?"webgl1":"webgl2";
  canvas.dataset.sqGraphicsQuality=runtime.reduced?"reduced":"standard";
  var notice=null;
  function showNotice(message){
    if(!notice){
      notice=document.createElement("div");notice.dataset.sqGraphicsNotice="";notice.setAttribute("role","status");
      notice.style.cssText="position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;white-space:pre-line;background:#201a40ee;color:#fff;font:700 18px system-ui";
      canvas.parentNode.appendChild(notice);
    }
    notice.textContent=message;
  }
  function lost(event){
    event.preventDefault();
    showNotice("The picture paused. Waiting to reconnect…\n畫面暫停，正在恢復…\nUse Back to choose another game. · 可按返回選其他遊戲。");
  }
  function restored(){if(notice){notice.remove();notice=null;}}
  canvas.addEventListener("webglcontextlost",lost);
  canvas.addEventListener("webglcontextrestored",restored);
  renderer.debug.onShaderError=function(){
    renderer.sqGraphicsError=graphicsError("This device could not draw the 3D scene.");
    showNotice("This picture could not open. Use Back and try again.\n無法顯示畫面，請返回再試一次。");
  };
  var dispose=renderer.dispose.bind(renderer);
  renderer.dispose=function(){
    canvas.removeEventListener("webglcontextlost",lost);canvas.removeEventListener("webglcontextrestored",restored);
    restored();dispose();
  };
  return renderer;
}

export function firstFrame(renderer,scene,camera){
  renderer.render(scene,camera);
  if(renderer.sqGraphicsError)throw renderer.sqGraphicsError;
}

export function observeResize(mount,resize){
  if(typeof ResizeObserver!=="undefined"){var observer=new ResizeObserver(resize);observer.observe(mount);return observer;}
  window.addEventListener("resize",resize);
  return {disconnect:function(){window.removeEventListener("resize",resize);}};
}
