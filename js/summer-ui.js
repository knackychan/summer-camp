/* SQSummerUI — child-facing presenter for Summer's structured responses.
   Keeps personality/motion decisions out of the agent and maps them onto a
   small, deterministic visual vocabulary that also works in an Android shell. */
(function(){
  const EMOTIONS=new Set(["neutral","thinking","happy","excited","proud","encouraging","surprised","celebrate","sleepy","attention"]);
  const ANIMATIONS=new Set(["idle","blink","lean_in","small_hop","double_hop","thinking_loop","celebrate","wave"]);
  const GLYPHS={neutral:"•ᴗ•",thinking:"•﹏•",happy:"•ᴗ•",excited:"★ᴗ★",proud:"˘ᴗ˘",encouraging:"•◡•",surprised:"•O•",celebrate:"★▽★",sleepy:"－ᴗ－",attention:"•!•"};
  function token(value,allowed,fallback){value=String(value||"");return allowed.has(value)?value:fallback;}
  function normalize(response){response=response||{};return {
    emotion:token(response.emotion,EMOTIONS,"happy"),
    animation:token(response.animation,ANIMATIONS,"small_hop"),
    speech:typeof response.speech==="string"?response.speech:"",
    speechZh:typeof response.speechZh==="string"?response.speechZh:"",
    kind:typeof response.kind==="string"?response.kind:"status"
  };}
  function restartAnimation(el,name){
    if(!el)return;
    Array.from(el.classList).filter(function(c){return c.indexOf("summer-motion-")===0;}).forEach(function(c){el.classList.remove(c);});
    /* Reflow intentionally restarts short feedback animation after repeated replies. */
    if(typeof el.offsetWidth==="number")void el.offsetWidth;
    el.classList.add("summer-motion-"+token(name,ANIMATIONS,"small_hop"));
  }
  function present(opts,response){
    opts=opts||{};const r=normalize(response),face=opts.face,panel=opts.panel,dialogue=opts.dialogue;
    if(face){face.dataset.emotion=r.emotion;face.dataset.mood=GLYPHS[r.emotion]||GLYPHS.happy;restartAnimation(face,r.animation);}
    if(panel){panel.dataset.emotion=r.emotion;panel.dataset.kind=r.kind;}
    if(opts.speech)opts.speech.textContent=r.speech;
    if(opts.speechZh)opts.speechZh.textContent=r.speechZh;
    if(dialogue){dialogue.classList.remove("is-arriving");if(typeof dialogue.offsetWidth==="number")void dialogue.offsetWidth;dialogue.classList.add("is-arriving");}
    return r;
  }
  function attentionKey(attention){return attention&&attention.kind&&attention.questId?attention.kind+":"+attention.questId:"";}
  function attentionCopy(attention,quest){
    if(!attention)return null;
    const title=quest&&quest.title||["this quest","這個任務"],icon=quest&&quest.icon||"✨";
    if(attention.kind==="redo")return {icon:icon,eyebrow:["ONE MORE TRY","再試一次"],title:title,body:["Want to give this one another try together?","要不要一起再試一次？"],action:["Try again","再試一次"]};
    if(attention.kind==="routine_due")return {icon:icon,eyebrow:["READY WHEN YOU ARE","準備好就開始"],title:title,body:["A daily quest is ready. You can start it when it fits.","有一個每日任務準備好了，適合的時候就可以開始。"],action:["Open quest","打開任務"]};
    return {icon:icon,eyebrow:["SUMMER HAS AN IDEA","SUMMER 有個點子"],title:title,body:["Want to take a look?","要不要看看？"],action:["Show me","給我看看"]};
  }
  function shouldShowNudge(input){
    input=input||{};if(!input.attention||!attentionKey(input.attention))return false;
    if(!input.hubVisible||input.overlayOpen)return false;
    if(input.surface&&input.surface!=="hub")return false;
    return input.dismissedKey!==attentionKey(input.attention);
  }
  const api={normalize:normalize,present:present,restartAnimation:restartAnimation,attentionKey:attentionKey,attentionCopy:attentionCopy,shouldShowNudge:shouldShowNudge,GLYPHS:GLYPHS};
  if(typeof window!=="undefined")window.SQSummerUI=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
