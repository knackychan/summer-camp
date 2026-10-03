import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
const catalogFile = resolve(dist, "packages/learning/src/knowledge/ScienceLessonCatalog.js");
if (!existsSync(catalogFile)) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0);
}

const catalog = await import(pathToFileURL(catalogFile));
const runtime = await import(pathToFileURL(resolve(dist, "packages/learning/src/knowledge/KnowledgeLessonRuntime.js")));
const serviceMod = await import(pathToFileURL(resolve(dist, "packages/learning/src/knowledge/KnowledgeLessonService.js")));
const bridgeMod = await import(pathToFileURL(resolve(dist, "packages/learning/src/legacy/KnowledgeLessonBridge.js")));
const memoryMod = await import(pathToFileURL(resolve(dist, "packages/storage/src/memory/MemoryStorageDriver.js")));
const telemetryMod = await import(pathToFileURL(resolve(dist, "packages/learning/src/telemetry/LearningTelemetry.js")));
const validation = await import(pathToFileURL(resolve(dist, "packages/agent/src/ResponseValidation.js")));

const lessons = catalog.listScienceLessons(8);
assert.equal(lessons.length, 6);
assert.deepEqual(new Set(lessons.map((lesson) => lesson.topic)), new Set(["animals", "plants", "body", "matter", "weather", "space"]));
for (const lesson of lessons) {
  assert.equal(lesson.facts.length, 3, `${lesson.id} has three approved facts`);
  assert.equal(lesson.questions.length, 2, `${lesson.id} has two deterministic questions`);
  assert.ok(lesson.skill.startsWith("science."));
}

const animals = catalog.getScienceLesson("science-animals-groups");
assert.ok(animals);
let session = runtime.createKnowledgeLessonSession({ learnerId: "kid-a", lessonId: animals.id, readingLevel: "early_reader", now: 1000 });
assert.ok(session);
assert.equal(session.phase, "intro");
assert.equal(session.plan.source, "local_fallback");
assert.deepEqual(session.plan.questionIds, animals.questions.map((question) => question.id));

session = runtime.advanceKnowledgeLesson(session, 1100);
assert.equal(session.phase, "question");
let snapshot = runtime.knowledgeLessonSnapshot(session);
assert.equal(snapshot.currentQuestion.id, "animals-q1");
session = runtime.answerKnowledgeQuestion(session, "feathers", 850, 2000);
snapshot = runtime.knowledgeLessonSnapshot(session);
assert.equal(snapshot.currentAnswer.correct, true);
assert.equal(snapshot.score, 1);
const unchanged = runtime.answerKnowledgeQuestion(session, "gills", 900, 2100);
assert.equal(unchanged.answers.length, 1, "an answered question cannot be overwritten");
session = runtime.advanceKnowledgeLesson(session, 2200);
assert.equal(runtime.knowledgeLessonSnapshot(session).currentQuestion.id, "animals-q2");
session = runtime.answerKnowledgeQuestion(session, "dog", 700, 3000);
session = runtime.advanceKnowledgeLesson(session, 3100);
assert.equal(session.phase, "complete");
assert.equal(runtime.knowledgeLessonSnapshot(session).score, 1);

const remoteClient = {
  async request() {
    return {
      kind: "knowledge_lesson_plan",
      factIds: ["gills", "feathers"],
      questionIds: ["animals-q2", "animals-q1"],
      presentation: "compare_first",
      encouragement: "detective",
      provider: "remote:openai",
      usage: { provider: "openai", model: "test-model", profileId: "test-profile", inputTokens: 12, outputTokens: 8, estimatedCostUsd: 0.001 },
    };
  },
};
const service = new serviceMod.KnowledgeLessonService(remoteClient);
const profile = { kidId: "kid-a", age: 7, language: "en-zh-TW", readingLevel: "early_reader", levels: { math: 1, language: 1, logic: 1, science: 1, geography: 1 } };
const remotePlan = await service.plan({ learner: profile, lessonId: animals.id });
assert.equal(remotePlan.source, "remote");
assert.deepEqual(remotePlan.factIds, ["gills", "feathers"]);
assert.equal(remotePlan.model, "test-model");

const badService = new serviceMod.KnowledgeLessonService({ async request(){ return { kind:"knowledge_lesson_plan", factIds:["invented","gills"], questionIds:["animals-q1","animals-q2"], presentation:"visual_first", encouragement:"curious" }; } });
const fallbackPlan = await badService.plan({ learner: profile, lessonId: animals.id });
assert.equal(fallbackPlan.source, "local_fallback");
assert.match(fallbackPlan.remoteError, /unsupported science fact IDs/);

const validAgent = validation.validateAgentResponse("knowledge_lesson", {
  kind: "knowledge_lesson_plan",
  factIds: ["a", "b"],
  questionIds: ["q1", "q2"],
  presentation: "visual_first",
  encouragement: "explorer",
});
assert.equal(validAgent.kind, "knowledge_lesson_plan");
assert.throws(() => validation.validateAgentResponse("knowledge_lesson", {
  kind: "knowledge_lesson_plan",
  factIds: ["a", "a"],
  questionIds: ["q1", "q2"],
  presentation: "visual_first",
  encouragement: "explorer",
}), /fact IDs/);

const storage = new memoryMod.MemoryStorageDriver();
const telemetryStore = new telemetryMod.LearningTelemetryStore(storage);
const recorder = new telemetryMod.LearningTelemetryRecorder(telemetryStore);
const bridge = new bridgeMod.KnowledgeLessonBridge(storage, undefined, recorder);
await bridge.start({ kidId:"kid-b", age:6, lessonId: animals.id });
await bridge.advance({ kidId:"kid-b", age:6 });
await bridge.answer({ kidId:"kid-b", age:6, selectedOptionId:"feathers", responseMs:620 });
const events = await telemetryStore.list();
assert.equal(events.length, 1);
assert.equal(events[0].domain, "science");
assert.equal(events[0].skill, "science.animals.groups");
assert.equal(events[0].correct, true);

const indexSource = readFileSync(resolve(root, "index.html"), "utf8");
const runtimeSource = readFileSync(resolve(root, "js/learning-runtime.js"), "utf8");
const swSource = readFileSync(resolve(root, "sw.js"), "utf8");
assert.match(indexSource, /Science Lab/);
assert.match(indexSource, /AI may choose approved clues and lesson order/);
assert.match(runtimeSource, /KnowledgeLessonBridge\.js/);
assert.match(runtimeSource, /answerScienceLesson/);
assert.match(swSource, /KnowledgeLessonRuntime\.js/);
assert.match(swSource, /summer-quest-v\d+/);

console.log("knowledge lesson runtime tests: ok");
