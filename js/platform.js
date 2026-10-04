/* SQPlatform — browser/default implementation behind an Android-ready seam.
   Android uses one bounded Capacitor plugin registered by MainActivity before
   the Bridge loads the page. Learning, grading and learner state stay in JS. */
(function(){
  let adapter=null,backHandlers=[];
  function call(name,args,fallback){
    if(adapter&&typeof adapter[name]==="function")return adapter[name].apply(adapter,args||[]);
    return fallback?fallback():undefined;
  }
  function haptic(kind){
    return call("haptic",[kind],function(){
      if(typeof navigator==="undefined"||!navigator.vibrate)return false;
      const ms=kind==="success"?[18,30,24]:kind==="warning"?[28,35,28]:[12];
      return navigator.vibrate(ms);
    });
  }
  function speak(text,lang){return call("speak",[text,lang],function(){return false;});}
  function scheduleNotification(req){return call("scheduleNotification",[req],function(){return Promise.resolve({supported:false});});}
  function cancelNotification(id){return call("cancelNotification",[id],function(){return Promise.resolve({supported:false});});}
  function requestAudioFocus(){return call("requestAudioFocus",[],function(){return false;});}
  function releaseAudioFocus(){return call("releaseAudioFocus",[],function(){});}
  function registerBackHandler(fn){if(typeof fn==="function")backHandlers.push(fn);return function(){backHandlers=backHandlers.filter(function(x){return x!==fn;});};}
  function triggerBack(){for(let i=backHandlers.length-1;i>=0;i--){if(backHandlers[i]()===true)return true;}return false;}
  function capabilities(){
    return {
      haptics:!!(adapter&&adapter.haptic)||(typeof navigator!=="undefined"&&!!navigator.vibrate),
      notifications:!!(adapter&&adapter.scheduleNotification)||(typeof window!=="undefined"&&"Notification" in window),
      audioFocus:!!(adapter&&adapter.requestAudioFocus),
      native:!!(adapter&&adapter.native),camera:!!(adapter&&adapter.camera),microphone:!!(adapter&&adapter.microphone)
    };
  }
  function setAdapter(next){adapter=next||null;if(adapter&&typeof adapter.setBackHandler==="function")adapter.setBackHandler(triggerBack);}

  function promiseBoolean(task,key){
    try{
      return Promise.resolve(task).then(function(result){return !!(result&&result[key]);}).catch(function(error){
        if(typeof console!=="undefined"&&console.warn)console.warn("Summer Quest native capability failed",error);
        return false;
      });
    }catch(error){
      if(typeof console!=="undefined"&&console.warn)console.warn("Summer Quest native capability failed",error);
      return Promise.resolve(false);
    }
  }

  function dispatchNativeEvent(name){
    if(typeof window==="undefined"||!window.dispatchEvent)return;
    try{window.dispatchEvent(new CustomEvent(name));}
    catch(e){if(typeof Event==="function")window.dispatchEvent(new Event(name));}
  }

  function listenPlugin(plugin,name,handler){
    if(!plugin||typeof plugin.addListener!=="function")return;
    try{
      const handle=plugin.addListener(name,handler);
      if(handle&&typeof handle.catch==="function")handle.catch(function(){});
    }catch(e){}
  }

  function capacitorAndroidAdapter(){
    if(typeof window==="undefined")return null;
    const capacitor=window.Capacitor;
    if(!capacitor)return null;
    try{
      if(typeof capacitor.isNativePlatform==="function"&&!capacitor.isNativePlatform())return null;
    }catch(e){return null;}
    const plugin=capacitor.Plugins&&capacitor.Plugins.SummerQuestNative||
      (typeof capacitor.registerPlugin==="function"&&capacitor.registerPlugin("SummerQuestNative"));
    if(!plugin)return null;
    let nativeBack=null;
    listenPlugin(plugin,"audioFocusChanged",function(event){
      if(event&&event.state==="gained")dispatchNativeEvent("summerquest:native-audio-gained");
      else if(event&&event.state==="lost")dispatchNativeEvent("summerquest:native-audio-lost");
    });
    listenPlugin(plugin,"lifecycleChanged",function(event){
      if(event&&event.state==="resume")dispatchNativeEvent("summerquest:native-resume");
      else if(event&&event.state==="pause")dispatchNativeEvent("summerquest:native-pause");
    });
    return {
      native:true,
      haptic:function(kind){return promiseBoolean(plugin.haptic({kind:String(kind||"tap")}),"supported");},
      speak:function(text,lang){return promiseBoolean(plugin.speak({text:String(text||""),lang:String(lang||"en-US")}),"supported");},
      scheduleNotification:function(){return Promise.resolve({supported:false});},
      requestAudioFocus:function(){return promiseBoolean(plugin.requestAudioFocus({}),"granted");},
      releaseAudioFocus:function(){try{return Promise.resolve(plugin.releaseAudioFocus({})).then(function(){}).catch(function(){});}catch(e){return Promise.resolve();}},
      setBackHandler:function(handler){nativeBack=typeof handler==="function"?handler:null;},
      triggerBack:function(){return nativeBack?nativeBack()===true:false;}
    };
  }

  const api={setAdapter:setAdapter,haptic:haptic,speak:speak,scheduleNotification:scheduleNotification,cancelNotification:cancelNotification,requestAudioFocus:requestAudioFocus,releaseAudioFocus:releaseAudioFocus,registerBackHandler:registerBackHandler,triggerBack:triggerBack,capabilities:capabilities};
  if(typeof window!=="undefined"){
    window.SQPlatform=api;
    const native=capacitorAndroidAdapter();
    if(native){window.SummerQuestNative=native;setAdapter(native);}
  }
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
