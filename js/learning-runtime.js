/* SQLearningRuntime — root application's bridge to the typed learning packages.
   The root index remains a classic-script app, while the learning runtime is
   compiled as ESM under dist/mobile. This file is deliberately thin: it lazy-
   imports the shared implementation and exposes semantic methods to the
   existing Brain Gym and Word Wizard UIs. Provider secrets never enter this client. */
(function(){
  var root=typeof window!=="undefined"?window:(typeof self!=="undefined"?self:null);
  var scriptSrc=(typeof document!=="undefined"&&document.currentScript&&document.currentScript.src)||"";
  var appRoot=scriptSrc?new URL("../",scriptSrc).href:"";
  var singleton=null,pending=null;
  var learningWrites=new Set();
  function trackLearningWrite(promise){
    learningWrites.add(promise);
    var release=function(){learningWrites.delete(promise);};promise.then(release,release);
    return promise;
  }
  function withDirector(method,input){
    // Wait only for local validated writes; provider calls are never in this set.
    return Promise.all(Array.from(learningWrites)).then(function(){return ensure();}).then(function(runtime){return runtime.learningDirector[method](directorInput(input));});
  }

  function cfg(){return root&&root.SQ_CONFIG||{};}
  function clean(v,max){return typeof v==="string"?v.trim().slice(0,max||120):"";}
  function moduleUrl(path){
    if(!appRoot)throw new Error("Summer learning runtime needs a browser module base URL");
    return new URL(path,appRoot).href;
  }
  async function build(){
    var config=cfg();
    var modules=await Promise.all([
      import(moduleUrl("dist/mobile/packages/storage/src/web/LocalStorageDriver.js")),
      import(moduleUrl("dist/mobile/packages/learning/src/legacy/BrainMathLearningBridge.js")),
      import(moduleUrl("dist/mobile/packages/learning/src/legacy/VocabularyLearningBridge.js")),
      import(moduleUrl("dist/mobile/packages/agent/src/client/AgentHttpClient.js")),
      import(moduleUrl("dist/mobile/packages/learning/src/telemetry/LearningTelemetry.js")),
      import(moduleUrl("dist/mobile/packages/learning/src/telemetry/LearningTelemetryHttpClient.js")),
      import(moduleUrl("dist/mobile/packages/learning/src/experiments/TutorExperimentHarness.js")),
      import(moduleUrl("dist/mobile/packages/learning/src/legacy/LearningDirectorBridge.js")),
      import(moduleUrl("dist/mobile/packages/learning/src/legacy/PlacementCalibrationBridge.js")),
      import(moduleUrl("dist/mobile/packages/learning/src/legacy/MathTeachBridge.js")),
      import(moduleUrl("dist/mobile/packages/learning/src/legacy/LanguageTeachBridge.js")),
      import(moduleUrl("dist/mobile/packages/learning/src/legacy/KnowledgeLessonBridge.js"))
    ]);
    var Storage=modules[0].LocalStorageDriver;
    var MathBridge=modules[1].BrainMathLearningBridge;
    var VocabularyBridge=modules[2].VocabularyLearningBridge;
    var Client=modules[3].AgentHttpClient;
    var TelemetryStore=modules[4].LearningTelemetryStore;
    var TelemetryRecorder=modules[4].LearningTelemetryRecorder;
    var TelemetryClient=modules[5].LearningTelemetryHttpClient;
    var ExperimentHarness=modules[6].TutorExperimentHarness;
    var DirectorBridge=modules[7].LearningDirectorBridge;
    var PlacementBridge=modules[8].PlacementCalibrationBridge;
    var MathTeachBridge=modules[9].MathTeachBridge;
    var LanguageTeachBridge=modules[10].LanguageTeachBridge;
    var KnowledgeLessonBridge=modules[11].KnowledgeLessonBridge;
    var storage=new Storage(root.localStorage);
    var endpoint=clean(config.SUMMER_AGENT_ENDPOINT,500);
    var client=endpoint?new Client({
      endpoint:endpoint,
      timeoutMs:Number(config.SUMMER_AGENT_TIMEOUT_MS)||7000
    }):undefined;
    var telemetryEndpoint=clean(config.SUMMER_LEARNING_TELEMETRY_ENDPOINT,500);
    var telemetryMirror=telemetryEndpoint?new TelemetryClient({endpoint:telemetryEndpoint,timeoutMs:2000}):undefined;
    var telemetryStore=new TelemetryStore(storage);
    var telemetry=new TelemetryRecorder(telemetryStore,telemetryMirror);
    var experimentIds=Array.isArray(config.SUMMER_TUTOR_EXPERIMENTS)?config.SUMMER_TUTOR_EXPERIMENTS.map(function(v){return clean(v,120);}).filter(Boolean):[];
    var experiments=new ExperimentHarness(experimentIds);
    var learningDirector=new DirectorBridge(storage);
    var placementCalibration=new PlacementBridge(storage);
    var mathTeach=new MathTeachBridge(storage,client);
    var languageTeach=new LanguageTeachBridge(storage,client);
    var knowledgeLessons=new KnowledgeLessonBridge(storage,client,telemetry);
    return {
      mathBridge:new MathBridge(storage,client,telemetry,experiments),
      vocabularyBridge:new VocabularyBridge(storage,client,telemetry),
      telemetry:telemetry,
      profileId:clean(config.SUMMER_AGENT_PROFILE,120),
      remoteEnabled:!!client,
      telemetryRemoteEnabled:!!telemetryMirror,
      tutorExperiments:experimentIds,
      learningDirector:learningDirector,
      placementCalibration:placementCalibration,
      mathTeach:mathTeach,
      languageTeach:languageTeach,
      knowledgeLessons:knowledgeLessons
    };
  }
  function ensure(){
    if(singleton)return Promise.resolve(singleton);
    if(!pending)pending=build().then(function(value){singleton=value;return value;}).catch(function(err){pending=null;throw err;});
    return pending;
  }
  function withMath(method,input){return ensure().then(function(runtime){return runtime.mathBridge[method](input);});}
  function withVocabulary(method,input){return ensure().then(function(runtime){return runtime.vocabularyBridge[method](input);});}

  function canSupportBrainMath(input){
    return withMath("canSupport",input).then(function(value){return value===true;}).catch(function(){return false;});
  }
  function recordBrainMathAttempt(input){
    return trackLearningWrite(withMath("recordAttempt",input).catch(function(err){
      console.warn("learning math attempt could not be stored",err);
      return null;
    }));
  }
  function getBrainMathHint(input){
    return ensure().then(function(runtime){
      var request=Object.assign({},input);
      if(runtime.profileId)request.profileId=runtime.profileId;
      return runtime.mathBridge.getHint(request);
    }).catch(function(err){
      console.warn("learning math hint bridge unavailable",err);
      return null;
    });
  }
  function getBrainMathIntervention(input){
    return withMath("getIntervention",input).catch(function(err){
      console.warn("learning math tutor policy unavailable",err);
      return null;
    });
  }
  function recordBrainMathSupportOutcome(input){
    return withMath("recordSupportOutcome",input).catch(function(err){
      console.warn("learning math support outcome could not be stored",err);
      return null;
    });
  }
  function brainMathSnapshot(input){return withMath("snapshot",input).catch(function(){return null;});}

  function canSupportVocabulary(input){
    return withVocabulary("canSupport",input).then(function(value){return value===true;}).catch(function(){return false;});
  }
  function recordVocabularyAttempt(input){
    return trackLearningWrite(withVocabulary("recordAttempt",input).catch(function(err){
      console.warn("learning vocabulary attempt could not be stored",err);
      return null;
    }));
  }
  function getVocabularyHint(input){
    return ensure().then(function(runtime){
      var request=Object.assign({},input);
      if(runtime.profileId)request.profileId=runtime.profileId;
      return runtime.vocabularyBridge.getHint(request);
    }).catch(function(err){
      console.warn("learning vocabulary hint bridge unavailable",err);
      return null;
    });
  }
  function getVocabularyIntervention(input){
    return withVocabulary("getIntervention",input).catch(function(err){
      console.warn("learning vocabulary tutor policy unavailable",err);
      return null;
    });
  }
  function vocabularySnapshot(input){return withVocabulary("snapshot",input).catch(function(){return null;});}


  function directorInput(input){
    var request=Object.assign({},input||{});
    return request;
  }
  function learningDirectorSession(input){
    return withDirector("snapshot",input).catch(function(err){
      console.warn("learning director unavailable",err);
      return null;
    });
  }
  function startLearningDirectorStep(input){
    return withDirector("start",input).catch(function(err){
      console.warn("learning director step could not start",err);
      return null;
    });
  }
  function completeLearningDirectorStep(input){
    return withDirector("completeCurrent",input).catch(function(err){
      console.warn("learning director teach step could not complete",err);
      return null;
    });
  }
  function mathTeachLocalScene(input){
    return ensure().then(function(runtime){return runtime.mathTeach.localScene(Object.assign({},input||{}));}).catch(function(err){
      console.warn("local math teach scene unavailable",err);
      return null;
    });
  }
  function mathTeachScene(input){
    return ensure().then(function(runtime){
      var request=Object.assign({},input||{});
      if(runtime.profileId)request.profileId=runtime.profileId;
      return runtime.mathTeach.getScene(request);
    }).catch(function(err){
      console.warn("math teach scene unavailable",err);
      return null;
    });
  }
  function languageTeachLocalScene(input){
    return ensure().then(function(runtime){return runtime.languageTeach.localScene(Object.assign({},input||{}));}).catch(function(err){
      console.warn("local language teach scene unavailable",err);
      return null;
    });
  }
  function languageTeachScene(input){
    return ensure().then(function(runtime){
      var request=Object.assign({},input||{});
      if(runtime.profileId)request.profileId=runtime.profileId;
      return runtime.languageTeach.getScene(request);
    }).catch(function(err){
      console.warn("language teach scene unavailable",err);
      return null;
    });
  }

  function withKnowledge(domain,method,input){
    return ensure().then(function(runtime){
      var request=Object.assign({},input||{},{domain:domain});
      if((method==="adapt"||method==="adaptHelp")&&runtime.profileId)request.profileId=runtime.profileId;
      return runtime.knowledgeLessons[method](request);
    });
  }
  /* Read-only discovery includes age-limited lessons; the root marks access for
     the selected child. The typed catalog remains the only lesson source. */
  function knowledgeCatalog(){
    return import(moduleUrl("dist/mobile/packages/learning/src/knowledge/KnowledgeLessonCatalog.js")).then(function(catalog){
      return ["science","geography","history"].reduce(function(all,domain){
        return all.concat(catalog.listKnowledgeLessons(domain));
      },[]);
    });
  }
  function knowledgeHelpCall(method,input){
    var domain=input&&input.domain;
    if(domain!=="science"&&domain!=="geography"&&domain!=="history")return Promise.resolve(null);
    return withKnowledge(domain,method,input).catch(function(){return null;});
  }
  function openKnowledgeHelp(input){return knowledgeHelpCall("openHelp",input);}
  function adaptKnowledgeHelp(input){return knowledgeHelpCall("adaptHelp",input);}
  function nextKnowledgeHelp(input){return knowledgeHelpCall("nextHelp",input);}
  function cancelKnowledgeHelp(input){return knowledgeHelpCall("cancelHelp",input);}
  function scienceLessonCatalog(input){return withKnowledge("science","catalog",input).catch(function(err){console.warn("science lesson catalog unavailable",err);return [];});}
  function scienceLessonSnapshot(input){return withKnowledge("science","snapshot",input).catch(function(){return null;});}
  function startScienceLesson(input){return withKnowledge("science","start",input).catch(function(err){console.warn("science lesson could not start",err);return null;});}
  function adaptScienceLesson(input){return withKnowledge("science","adapt",input).catch(function(err){console.warn("science lesson adaptation unavailable",err);return null;});}
  function answerScienceLesson(input){return withKnowledge("science","answer",input).catch(function(err){console.warn("science lesson answer could not be stored",err);return null;});}
  function advanceScienceLesson(input){return withKnowledge("science","advance",input).catch(function(err){console.warn("science lesson could not advance",err);return null;});}
  function resetScienceLesson(input){return withKnowledge("science","reset",input).catch(function(){return null;});}

  function geographyLessonCatalog(input){return withKnowledge("geography","catalog",input).catch(function(err){console.warn("geography lesson catalog unavailable",err);return [];});}
  function geographyLessonSnapshot(input){return withKnowledge("geography","snapshot",input).catch(function(){return null;});}
  function startGeographyLesson(input){return withKnowledge("geography","start",input).catch(function(err){console.warn("geography lesson could not start",err);return null;});}
  function adaptGeographyLesson(input){return withKnowledge("geography","adapt",input).catch(function(err){console.warn("geography lesson adaptation unavailable",err);return null;});}
  function answerGeographyLesson(input){return withKnowledge("geography","answer",input).catch(function(err){console.warn("geography lesson answer could not be stored",err);return null;});}
  function advanceGeographyLesson(input){return withKnowledge("geography","advance",input).catch(function(err){console.warn("geography lesson could not advance",err);return null;});}
  function resetGeographyLesson(input){return withKnowledge("geography","reset",input).catch(function(){return null;});}

  function historyLessonCatalog(input){return withKnowledge("history","catalog",input).catch(function(err){console.warn("history lesson catalog unavailable",err);return [];});}
  function historyLessonSnapshot(input){return withKnowledge("history","snapshot",input).catch(function(){return null;});}
  function startHistoryLesson(input){return withKnowledge("history","start",input).catch(function(err){console.warn("history lesson could not start",err);return null;});}
  function adaptHistoryLesson(input){return withKnowledge("history","adapt",input).catch(function(err){console.warn("history lesson adaptation unavailable",err);return null;});}
  function answerHistoryLesson(input){return withKnowledge("history","answer",input).catch(function(err){console.warn("history lesson answer could not be stored",err);return null;});}
  function advanceHistoryLesson(input){return withKnowledge("history","advance",input).catch(function(err){console.warn("history lesson could not advance",err);return null;});}
  function resetHistoryLesson(input){return withKnowledge("history","reset",input).catch(function(){return null;});}

  function guidedSessionAction(method,input){
    return withDirector(method,input).catch(function(err){
      console.warn("guided session action unavailable",err);return null;
    });
  }
  function pauseLearningDirectorSession(input){return guidedSessionAction("pause",input);}
  function finishLearningDirectorSession(input){return guidedSessionAction("finish",input);}
  function alternativeLearningDirectorStep(input){return guidedSessionAction("alternative",input);}

  function resetLearningDirectorSession(input){
    return withDirector("reset",input).catch(function(err){
      console.warn("learning director could not reset",err);
      return null;
    });
  }

  function placementCalibrationSession(input){
    return ensure().then(function(runtime){return runtime.placementCalibration.snapshot(directorInput(input));}).catch(function(err){
      console.warn("placement calibration unavailable",err);
      return null;
    });
  }
  function startPlacementCalibrationStep(input){
    return ensure().then(function(runtime){return runtime.placementCalibration.start(directorInput(input));}).catch(function(err){
      console.warn("placement calibration step could not start",err);
      return null;
    });
  }
  function resetPlacementCalibration(input){
    return ensure().then(function(runtime){return runtime.placementCalibration.reset(directorInput(input));}).catch(function(err){
      console.warn("placement calibration could not reset",err);
      return null;
    });
  }
  function skipPlacementCalibration(input){
    return ensure().then(function(runtime){return runtime.placementCalibration.skip(directorInput(input));}).catch(function(err){
      console.warn("placement calibration could not be skipped",err);
      return null;
    });
  }

  function telemetryList(){return ensure().then(function(runtime){return runtime.telemetry.list();}).catch(function(){return [];});}
  function telemetryClear(){return ensure().then(function(runtime){return runtime.telemetry.clear();}).catch(function(){return null;});}
  function status(){
    return ensure().then(function(runtime){return {ready:true,remoteEnabled:runtime.remoteEnabled,telemetryRemoteEnabled:runtime.telemetryRemoteEnabled,profileId:runtime.profileId||null,tutorExperiments:runtime.tutorExperiments||[]};})
      .catch(function(){return {ready:false,remoteEnabled:false,telemetryRemoteEnabled:false,profileId:null,tutorExperiments:[]};});
  }

  var api={
    knowledgeCatalog:knowledgeCatalog,
    canSupportBrainMath:canSupportBrainMath,
    recordBrainMathAttempt:recordBrainMathAttempt,
    getBrainMathHint:getBrainMathHint,
    getBrainMathIntervention:getBrainMathIntervention,
    recordBrainMathSupportOutcome:recordBrainMathSupportOutcome,
    brainMathSnapshot:brainMathSnapshot,
    canSupportVocabulary:canSupportVocabulary,
    recordVocabularyAttempt:recordVocabularyAttempt,
    getVocabularyHint:getVocabularyHint,
    getVocabularyIntervention:getVocabularyIntervention,
    vocabularySnapshot:vocabularySnapshot,
    learningDirectorSession:learningDirectorSession,
    startLearningDirectorStep:startLearningDirectorStep,
    pauseLearningDirectorSession:pauseLearningDirectorSession,
    finishLearningDirectorSession:finishLearningDirectorSession,
    alternativeLearningDirectorStep:alternativeLearningDirectorStep,
    completeLearningDirectorStep:completeLearningDirectorStep,
    mathTeachLocalScene:mathTeachLocalScene,
    mathTeachScene:mathTeachScene,
    languageTeachLocalScene:languageTeachLocalScene,
    languageTeachScene:languageTeachScene,
    openKnowledgeHelp:openKnowledgeHelp,
    adaptKnowledgeHelp:adaptKnowledgeHelp,
    nextKnowledgeHelp:nextKnowledgeHelp,
    cancelKnowledgeHelp:cancelKnowledgeHelp,
    scienceLessonCatalog:scienceLessonCatalog,
    scienceLessonSnapshot:scienceLessonSnapshot,
    startScienceLesson:startScienceLesson,
    adaptScienceLesson:adaptScienceLesson,
    answerScienceLesson:answerScienceLesson,
    advanceScienceLesson:advanceScienceLesson,
    resetScienceLesson:resetScienceLesson,
    geographyLessonCatalog:geographyLessonCatalog,
    geographyLessonSnapshot:geographyLessonSnapshot,
    startGeographyLesson:startGeographyLesson,
    adaptGeographyLesson:adaptGeographyLesson,
    answerGeographyLesson:answerGeographyLesson,
    advanceGeographyLesson:advanceGeographyLesson,
    resetGeographyLesson:resetGeographyLesson,
    historyLessonCatalog:historyLessonCatalog,
    historyLessonSnapshot:historyLessonSnapshot,
    startHistoryLesson:startHistoryLesson,
    adaptHistoryLesson:adaptHistoryLesson,
    answerHistoryLesson:answerHistoryLesson,
    advanceHistoryLesson:advanceHistoryLesson,
    resetHistoryLesson:resetHistoryLesson,
    resetLearningDirectorSession:resetLearningDirectorSession,
    placementCalibrationSession:placementCalibrationSession,
    startPlacementCalibrationStep:startPlacementCalibrationStep,
    resetPlacementCalibration:resetPlacementCalibration,
    skipPlacementCalibration:skipPlacementCalibration,
    telemetryList:telemetryList,
    telemetryClear:telemetryClear,
    status:status
  };
  if(root)root.SQLearningRuntime=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
