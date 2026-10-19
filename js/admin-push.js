/* Parent push notifications on this device (docs/plans/2026-10-19-parent-app/ D4).
   Registers a Web Push subscription with the existing service worker and saves it
   in parent_push_subscriptions, so the notify-parents Edge Function can reach this
   phone or computer with the app closed. Admin chrome is English-only (D23). */
(function(){
  const PREFS_DEFAULT={kinds:["task","reward","ask"],quiet_start:"21:30",quiet_end:"07:00"};

  function keyBytes(b64u){
    const s=String(b64u||"").replace(/-/g,"+").replace(/_/g,"/");
    const raw=atob(s+"===".slice((s.length+3)%4));
    const out=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
    return out;
  }
  function isIOS(ua,touchPoints){
    return /iPad|iPhone|iPod/.test(ua||"")||(/Macintosh/.test(ua||"")&&touchPoints>1);
  }
  /* What this device can do: "ready" | "install" (iPhone/iPad in Safari: add to
     Home Screen first) | "unsupported" | "blocked" (permission denied) | "off" (no
     public key configured yet). */
  function support(env){
    if(!env.vapidKey)return "off";
    if(isIOS(env.ua,env.touchPoints)&&!env.standalone)return "install";
    if(!env.serviceWorker||!env.pushManager||!env.notification)return "unsupported";
    if(env.permission==="denied")return "blocked";
    return "ready";
  }
  function deviceLabel(ua){
    ua=String(ua||"");
    const os=/Android/.test(ua)?"Android":/iPhone/.test(ua)?"iPhone":/iPad/.test(ua)?"iPad":/Windows/.test(ua)?"Windows":/Mac OS X|Macintosh/.test(ua)?"Mac":/Linux/.test(ua)?"Linux":"Device";
    const browser=/Edg\//.test(ua)?"Edge":/CriOS|Chrome\//.test(ua)?"Chrome":/Firefox\//.test(ua)?"Firefox":/Safari\//.test(ua)?"Safari":"browser";
    return os+" · "+browser;
  }
  function validTime(v){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v||""));}
  function cleanPrefs(p){
    p=p||{};
    const kinds=Array.isArray(p.kinds)?p.kinds.filter(function(k){return PREFS_DEFAULT.kinds.indexOf(k)>=0;}):PREFS_DEFAULT.kinds.slice();
    return {
      kinds:kinds,
      quiet_start:validTime(p.quiet_start)?p.quiet_start:PREFS_DEFAULT.quiet_start,
      quiet_end:validTime(p.quiet_end)?p.quiet_end:PREFS_DEFAULT.quiet_end
    };
  }
  function row(sub,ua,prefs){
    const j=sub.toJSON?sub.toJSON():sub, p=cleanPrefs(prefs);
    return {endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,device_label:deviceLabel(ua),
      kinds:p.kinds,quiet_start:p.quiet_start,quiet_end:p.quiet_end,enabled:true};
  }

  function env(){
    const w=typeof window!=="undefined"?window:{};
    const nav=w.navigator||{};
    return {
      vapidKey:(w.SQ_CONFIG&&w.SQ_CONFIG.PUSH_VAPID_PUBLIC_KEY)||"",
      ua:nav.userAgent||"", touchPoints:nav.maxTouchPoints||0,
      standalone:!!(nav.standalone||(w.matchMedia&&w.matchMedia("(display-mode: standalone)").matches)),
      serviceWorker:"serviceWorker" in nav, pushManager:"PushManager" in w, notification:"Notification" in w,
      permission:"Notification" in w?w.Notification.permission:"default"
    };
  }
  async function current(){
    if(!("serviceWorker" in navigator))return null;
    const reg=await navigator.serviceWorker.getRegistration();
    return reg&&reg.pushManager?reg.pushManager.getSubscription():null;
  }
  /* Must run from a tap: iOS only shows the permission prompt for a user gesture. */
  async function enable(client,prefs){
    const e=env(), s=support(e);
    if(s!=="ready")throw new Error(s);
    const permission=await Notification.requestPermission();
    if(permission!=="granted")throw new Error("blocked");
    await navigator.serviceWorker.register("./sw.js");
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(e.vapidKey)});
    const r=await client.from("parent_push_subscriptions").upsert(row(sub,e.ua,prefs),{onConflict:"endpoint"});
    if(r.error)throw r.error;
    return sub;
  }
  async function disable(client){
    const sub=await current();
    if(!sub)return;
    const endpoint=sub.endpoint;
    await sub.unsubscribe().catch(function(){});
    const r=await client.from("parent_push_subscriptions").delete().eq("endpoint",endpoint);
    if(r.error)throw r.error;
  }
  async function savePrefs(client,prefs){
    const sub=await current();
    if(!sub)return false;
    const p=cleanPrefs(prefs);
    const r=await client.from("parent_push_subscriptions").update({kinds:p.kinds,quiet_start:p.quiet_start,quiet_end:p.quiet_end}).eq("endpoint",sub.endpoint);
    if(r.error)throw r.error;
    return true;
  }
  async function load(client){
    const sub=await current();
    if(!sub)return null;
    const r=await client.from("parent_push_subscriptions").select("*").eq("endpoint",sub.endpoint).maybeSingle();
    if(r.error)throw r.error;
    /* The browser still holds a subscription the database dropped (expired, or
       another parent's account on this device): treat it as off. */
    return r.data||null;
  }
  async function test(client){
    const r=await client.functions.invoke("notify-parents",{body:{type:"test"}});
    if(r.error)throw r.error;
    return r.data||{sent:0};
  }

  const api={PREFS_DEFAULT:PREFS_DEFAULT,keyBytes:keyBytes,isIOS:isIOS,support:support,deviceLabel:deviceLabel,cleanPrefs:cleanPrefs,row:row,
    env:env,current:current,enable:enable,disable:disable,savePrefs:savePrefs,load:load,test:test};
  if(typeof window!=="undefined")window.SQAdminPush=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
