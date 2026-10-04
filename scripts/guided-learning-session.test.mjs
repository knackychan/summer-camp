import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryStorageDriver } from "../dist/mobile/packages/storage/src/memory/MemoryStorageDriver.js";
import { LearningDirectorBridge } from "../dist/mobile/packages/learning/src/legacy/LearningDirectorBridge.js";
import { LearningDirectorStore } from "../dist/mobile/packages/learning/src/director/LearningDirectorStore.js";
import { buildLearningDirectorPlan } from "../dist/mobile/packages/learning/src/director/LearningDirector.js";
import { LearningTelemetryStore, LearningTelemetryRecorder } from "../dist/mobile/packages/learning/src/telemetry/LearningTelemetry.js";
import { KnowledgeLessonBridge } from "../dist/mobile/packages/learning/src/legacy/KnowledgeLessonBridge.js";
import { BrainMathLearningBridge } from "../dist/mobile/packages/learning/src/legacy/BrainMathLearningBridge.js";
import { VocabularyLearningBridge } from "../dist/mobile/packages/learning/src/legacy/VocabularyLearningBridge.js";
import { taipeiClock } from "../dist/mobile/packages/core/src/time.js";

const input = {kidId:"guided-child",age:7,guided:true,preferredVocabularyMode:"recall"};
function setup(extra={}) {
  const storage=new MemoryStorageDriver(),telemetry=new LearningTelemetryStore(storage);
  return {storage,telemetry,recorder:new LearningTelemetryRecorder(telemetry),bridge:new LearningDirectorBridge(storage),input:{...input,...extra}};
}
function expected(input,state) {
  return {...input,expectedPlanId:state.plan.id,expectedStepId:state.currentStep?.id,expectedRevision:state.plan.coordination?.revision};
}
async function event(f,state,id,extra={}) {
  const step=state.currentStep;
  const value={version:1,type:"attempt",id,at:Date.now()+10,learnerId:f.input.kidId,domain:step.domain,skill:step.skill,sessionId:step.runId,questionId:`q-${id}`,correct:true,responseMs:100,hintsUsed:0,difficulty:1,...extra};
  await f.telemetry.append(value);return value;
}

for (const [gameId,domain] of [["calc","math"],["vocab","language"],["science","science"],["geography","geography"],["history","history"]]) {
  test(`guided ${domain}: available existing runtime, run-bound result and no automatic next launch`,async()=>{
    const f=setup({availableGameIds:[gameId]});
    const before=await f.bridge.snapshot(f.input);
    const state=await f.bridge.start(expected(f.input,before)),step=state.currentStep;
    assert.equal(step.domain,domain);assert.equal(step.launch.gameId,gameId);assert.ok(step.runId);
    assert.equal(state.plan.skills.find(s=>s.skill===step.skill).readiness,"ready");
    if (["science","geography","history"].includes(domain)) {
      assert.equal(step.launch.knowledgeMode,"explore");
      const lessons=new KnowledgeLessonBridge(f.storage,undefined,f.recorder);
      const req={...f.input,domain,flow:"director",lessonId:step.launch.lessonId,mode:step.launch.knowledgeMode,directorSessionId:state.plan.id,directorStepId:step.id,directorRunId:step.runId,resume:true};
      let snap=await lessons.start(req);assert.equal(snap.totalQuestions,2);
      snap=await lessons.advance(req);
      for(let i=0;i<2;i++){
        const q=snap.currentQuestion;
        snap=await lessons.answer({...req,expectedSessionId:snap.session.id,expectedQuestionId:q.id,selectedOptionId:q.correctOptionId,responseMs:120});
        snap=await lessons.advance({...req,expectedSessionId:snap.session.id,expectedQuestionId:q.id});
      }
      assert.equal(snap.session.phase,"complete");
    } else if(domain==="math") {
      const math=new BrainMathLearningBridge(f.storage,undefined,f.recorder);
      for(let i=0;i<2;i++)await math.recordAttempt({...f.input,gameId:"calc",tier:"tot",index:i,item:{prompt:{type:"emoji",a:1,b:1},answer:2},childAnswer:2,responseMs:120,skill:step.skill,directorRunId:step.runId,attemptId:`${step.runId}:item-${i}`});
    } else {
      const vocab=new VocabularyLearningBridge(f.storage,undefined,f.recorder);
      for(let i=0;i<2;i++)await vocab.recordAttempt({...f.input,gameId:"vocab",mode:step.launch.vocabularyMode,target:step.skill==="language.initial_sound"?(i?"d":"c"):(i?"dog":"cat"),emoji:"🐱",correct:true,responseMs:120,skill:step.skill,directorRunId:step.runId,attemptId:`${step.runId}:item-${i}`});
    }
    const after=await f.bridge.snapshot(f.input);
    assert.equal(after.plan.activeStepIndex,1);assert.equal(after.plan.steps[0].progressAttempts,2);
    assert.equal(after.currentStep?.startedAt,undefined);assert.equal(after.currentStep?.runId,undefined);
    assert.equal((await f.telemetry.list()).filter(e=>e.type==="attempt").length,2);
  });
}

test("free practice, another learner, wrong skill and duplicate events cannot complete a guided step",async()=>{
  const f=setup(),state=await f.bridge.start(f.input);
  await event(f,state,"free",{sessionId:"free-practice"});
  await event(f,state,"other",{learnerId:"other"});
  await event(f,state,"wrong-skill",{skill:"not-this-skill"});
  const first=await event(f,state,"one");await f.telemetry.append(first);await f.telemetry.append(first);
  let current=await f.bridge.snapshot(f.input);assert.equal(current.plan.activeStepIndex,0);assert.equal(current.currentStep.progressAttempts,1);
  await event(f,state,"two");current=await f.bridge.snapshot(f.input);assert.equal(current.plan.activeStepIndex,1);
  assert.equal((await f.telemetry.list()).filter(e=>e.id==="one").length,1);
});

test("pause closes the old run; refresh/resume keeps committed progress even after telemetry pruning",async()=>{
  const f=setup(),started=await f.bridge.start(f.input);
  await event(f,started,"committed");
  const paused=await f.bridge.pause(expected(f.input,started));
  assert.equal(paused.currentStep.progressAttempts,1);assert.equal(paused.plan.coordination.status,"paused");
  await event(f,started,"late-old-run");
  const reloaded=new LearningDirectorBridge(f.storage);
  assert.equal((await reloaded.snapshot(f.input)).currentStep.progressAttempts,1);
  await f.telemetry.clear();
  const resumed=await reloaded.start(expected(f.input,paused));assert.notEqual(resumed.currentStep.runId,started.currentStep.runId);
  assert.equal(resumed.currentStep.progressAttempts,1);
  await event(f,resumed,"new-run");
  assert.equal((await reloaded.snapshot(f.input)).plan.activeStepIndex,1);
});

test("another choice persists across rendering, retains completed prefix and ignores old run",async()=>{
  const f=setup(),state=await f.bridge.start(f.input);
  const chosen=await f.bridge.alternative(expected(f.input,state));
  assert.equal(chosen.actionApplied,true);assert.notEqual(chosen.currentStep.skill,state.currentStep.skill);assert.notEqual(chosen.currentStep.id,state.currentStep.id);
  const again=await f.bridge.snapshot(f.input);assert.equal(again.currentStep.skill,chosen.currentStep.skill);
  await event(f,state,"stale-one");await event(f,state,"stale-two");
  assert.equal((await f.bridge.snapshot(f.input)).plan.activeStepIndex,0);
  assert.equal(chosen.plan.steps.filter(s=>s.completedAt).length,0);
});

test("finish is not successful completion and stale reset/start cannot reopen a finished session",async()=>{
  const f=setup(),state=await f.bridge.start(f.input),bound=expected(f.input,state);
  const finished=await f.bridge.finish(bound);
  assert.equal(finished.plan.coordination.finishReason,"child_choice");assert.equal(finished.plan.completedAt,undefined);assert.equal(finished.currentStep,null);
  assert.equal((await f.bridge.start(bound)).actionApplied,false);
  assert.equal((await f.bridge.reset(bound)).actionApplied,false);
  const fresh=await f.bridge.reset(expected(f.input,finished));assert.notEqual(fresh.plan.id,state.plan.id);
});

test("an empty available-runtime set returns a supported no-candidate finish, never an invented exercise",async()=>{
  const f=setup({availableGameIds:[]}),state=await f.bridge.snapshot(f.input);
  assert.equal(state.currentStep,null);assert.equal(state.plan.coordination.finishReason,"no_candidates");assert.equal(state.plan.completedAt,undefined);
});

test("double start is compare-and-set; child scopes and stale revisions are isolated",async()=>{
  const f=setup(),state=await f.bridge.snapshot(f.input),request=expected(f.input,state);
  const values=await Promise.all([f.bridge.start(request),f.bridge.start(request)]);
  assert.equal(values.filter(x=>x.actionApplied).length,1);
  const other=await f.bridge.snapshot({...f.input,kidId:"sibling"});assert.equal(other.plan.learnerId,"sibling");assert.notEqual(other.plan.id,state.plan.id);
  assert.equal((await f.bridge.finish({...request,kidId:"sibling"})).actionApplied,false);
});

test("v11 additive migration retains committed progress; v10 rebuild does not erase learning telemetry",async()=>{
  const f=setup(),day=taipeiClock().day,plans=new LearningDirectorStore(f.storage);
  const learner={kidId:f.input.kidId,age:7,language:"en-zh-TW",readingLevel:"early_reader",levels:{math:1,language:1,logic:1,science:1,geography:1,history:1}};
  const old=buildLearningDirectorPlan({learner,summaries:[],day});old.steps[0].startedAt=Date.now()-1000;old.steps[0].progressAttempts=1;
  await plans.save(old);
  const migrated=await f.bridge.snapshot(f.input);assert.equal(migrated.plan.version,11);assert.equal(migrated.plan.id,old.id);assert.equal(migrated.currentStep.progressAttempts,1);assert.equal(migrated.currentStep.startedAt,undefined);
  const running=await f.bridge.start(expected(f.input,migrated));await event(f,running,"second");assert.equal((await f.bridge.snapshot(f.input)).plan.activeStepIndex,1);
  const count=(await f.telemetry.list()).length;
  await plans.save({...old,version:10,id:"old-v10"});const rebuilt=await f.bridge.snapshot(f.input);
  assert.notEqual(rebuilt.plan.id,"old-v10");assert.equal((await f.telemetry.list()).length,count);
});

test("math duplicate callbacks remain idempotent after reloading the learning engine",async()=>{
  const f=setup(),req={...f.input,gameId:"calc",tier:"tot",index:0,item:{prompt:{type:"emoji",a:1,b:2},answer:3},childAnswer:3,responseMs:150,attemptId:"durable-math-attempt",directorRunId:"run-math"};
  let math=new BrainMathLearningBridge(f.storage,undefined,f.recorder);
  await Promise.all([math.recordAttempt(req),math.recordAttempt(req)]);
  math=new BrainMathLearningBridge(f.storage,undefined,f.recorder);const again=await math.recordAttempt(req);
  assert.equal(again.session.attempts.length,1);assert.equal((await f.telemetry.list()).filter(e=>e.type==="attempt").length,1);
});

test("vocabulary duplicate callbacks neither inflate mastery evidence nor replay support outcomes",async()=>{
  const f=setup(),req={...f.input,gameId:"vocab",mode:"recall",target:"cat",correct:true,responseMs:150,hintsUsed:1,attemptId:"durable-vocab-attempt",directorRunId:"run-vocab"};
  let words=new VocabularyLearningBridge(f.storage,undefined,f.recorder);
  await Promise.all([words.recordAttempt(req),words.recordAttempt(req)]);
  words=new VocabularyLearningBridge(f.storage,undefined,f.recorder);const again=await words.recordAttempt(req);
  assert.equal(again.session.attempts.length,1);assert.equal((await f.telemetry.list()).filter(e=>e.type==="attempt").length,1);assert.equal((await f.telemetry.list()).filter(e=>e.type==="support_outcome").length,1);
});

test("simultaneous telemetry writes are serialized instead of silently losing sibling/subject evidence",async()=>{
  const f=setup(),state=await f.bridge.start(f.input);
  await Promise.all(Array.from({length:40},(_,i)=>event(f,state,`concurrent-${i}`)));
  assert.equal((await f.telemetry.list()).length,40);
});

function remoteResult(){return {kind:"knowledge_lesson_plan",factIds:["gills","feathers"],questionIds:["animals-q2","animals-q1"],presentation:"compare_first",encouragement:"detective"};}
for (const transition of ["advance","reset","replace"]) {
  test(`late knowledge AI cannot undo ${transition}`,async()=>{
    const f=setup();let release,called=0;
    const gate=new Promise(resolve=>release=resolve);
    const lessons=new KnowledgeLessonBridge(f.storage,{async request(){called++;return gate;}},f.recorder);
    const req={...f.input,domain:"science",lessonId:"science-animals-groups"};
    const before=await lessons.start(req),pending=lessons.adapt(req);
    while(!called)await new Promise(resolve=>setTimeout(resolve,0));
    if(transition==="advance")await lessons.advance(req);
    else if(transition==="reset")await lessons.reset(req);
    else await lessons.start({...req,lessonId:"science-plants-parts"});
    const expectedState=await lessons.snapshot(req);
    release(remoteResult());await pending;
    const actual=await lessons.snapshot(req);
    assert.deepEqual(actual,expectedState);assert.equal(called,1);
    if(transition==="advance")assert.equal(actual.session.phase,"question");
    if(transition==="reset")assert.equal(actual,null);
    if(transition==="replace")assert.notEqual(actual?.session.id,before.session.id);
  });
}

test("Check mode never calls AI; concurrent answers and stale item callbacks cannot double-grade or skip",async()=>{
  const f=setup();let calls=0;const lessons=new KnowledgeLessonBridge(f.storage,{async request(){calls++;throw new Error("not allowed in check");}},f.recorder);
  const req={...f.input,domain:"history",lessonId:"history-before-after",mode:"check"};
  let snap=await lessons.start(req);await lessons.adapt(req);assert.equal(calls,0);assert.equal(snap.totalQuestions,2);
  const old={...req,expectedSessionId:snap.session.id,expectedPhase:"question",expectedQuestionId:snap.currentQuestion.id,selectedOptionId:snap.currentQuestion.correctOptionId};
  await Promise.all([lessons.answer(old),lessons.answer(old)]);assert.equal((await f.telemetry.list()).length,1);
  await Promise.all([lessons.advance(old),lessons.advance(old)]);
  snap=await lessons.snapshot(req);assert.equal(snap.session.questionIndex,1);assert.equal(snap.currentAnswer,null);
  await lessons.answer(old);assert.equal((await lessons.snapshot(req)).currentAnswer,null);
});

test("directed knowledge resume retains its answer and question position, while rebinding its new run",async()=>{
  const f=setup(),lessons=new KnowledgeLessonBridge(f.storage,undefined,f.recorder);
  const req={...f.input,domain:"history",lessonId:"history-before-after",mode:"check",flow:"director",directorSessionId:"plan",directorStepId:"step",directorRunId:"run-one",resume:true};
  let snap=await lessons.start(req);snap=await lessons.answer({...req,selectedOptionId:snap.currentQuestion.correctOptionId});snap=await lessons.advance(req);
  const resumed=await lessons.start({...req,directorRunId:"run-two"});assert.equal(resumed.session.id,snap.session.id);assert.equal(resumed.session.answers.length,1);assert.equal(resumed.session.questionIndex,1);assert.equal(resumed.session.directorRunId,"run-two");
});


test("an unavailable saved activity offers a valid replacement without starting or crediting it",async()=>{
  const f=setup(),before=await f.bridge.snapshot(f.input);
  // The first step is day-seeded, so pick whichever game it is NOT as the only available one.
  const only=before.currentStep.launch.gameId==="history"?"vocab":"history",domain=only==="history"?"history":"language";
  const replacement=await f.bridge.start({...expected(f.input,before),availableGameIds:[only]});
  assert.equal(replacement.actionApplied,false);assert.equal(replacement.currentStep.domain,domain);
  assert.equal(replacement.currentStep.startedAt,undefined);assert.equal(replacement.currentStep.progressAttempts,0);
  assert.notEqual(replacement.currentStep.id,before.currentStep.id);assert.equal(replacement.plan.activeStepIndex,0);
  const none=await f.bridge.start({...expected(f.input,replacement),availableGameIds:[]});
  assert.equal(none.currentStep,null);assert.equal(none.plan.coordination.finishReason,"no_candidates");
  assert.equal(none.plan.completedAt,undefined);assert.equal((await f.telemetry.list()).length,0);
});

test("the full guided plan reaches genuine completion only through every current step",async()=>{
  const f=setup();let snapshot=await f.bridge.snapshot(f.input),starts=0;
  const initialCount=snapshot.plan.steps.length;
  while(snapshot.currentStep){
    assert.ok(starts<8,"bounded original plan");
    const started=await f.bridge.start(expected(f.input,snapshot));starts++;
    if(started.currentStep.kind==="teach")snapshot=await f.bridge.completeCurrent(expected(f.input,started));
    else{
      for(let i=0;i<started.currentStep.targetAttempts;i++)await event(f,started,`full-${starts}-${i}`);
      snapshot=await f.bridge.snapshot(f.input);
    }
    assert.equal(snapshot.currentStep?.startedAt,undefined);
  }
  assert.equal(starts,initialCount);assert.ok(snapshot.plan.completedAt);
  assert.ok(snapshot.plan.steps.every(step=>step.completedAt));
  const duplicateFinish=await f.bridge.snapshot(f.input);assert.equal(duplicateFinish.plan.completedAt,snapshot.plan.completedAt);
});
