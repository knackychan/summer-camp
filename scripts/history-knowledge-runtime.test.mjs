import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
const historyFile = resolve(dist, "packages/learning/src/knowledge/HistoryLessonCatalog.js");
if (!existsSync(historyFile)) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0);
}

const history = await import(pathToFileURL(historyFile));
const catalog = await import(pathToFileURL(resolve(dist, "packages/learning/src/knowledge/KnowledgeLessonCatalog.js")));
const runtime = await import(pathToFileURL(resolve(dist, "packages/learning/src/knowledge/KnowledgeLessonRuntime.js")));
const requestMod = await import(pathToFileURL(resolve(dist, "packages/learning/src/knowledge/KnowledgeLessonRequest.js")));
const serviceMod = await import(pathToFileURL(resolve(dist, "packages/learning/src/knowledge/KnowledgeLessonService.js")));
const bridgeMod = await import(pathToFileURL(resolve(dist, "packages/learning/src/legacy/KnowledgeLessonBridge.js")));
const memoryMod = await import(pathToFileURL(resolve(dist, "packages/storage/src/memory/MemoryStorageDriver.js")));
const telemetryMod = await import(pathToFileURL(resolve(dist, "packages/learning/src/telemetry/LearningTelemetry.js")));
const profileStoreMod = await import(pathToFileURL(resolve(dist, "packages/learning/src/LearnerProfileStore.js")));
const curriculum = await import(pathToFileURL(resolve(dist, "packages/learning/src/curriculum/SkillCatalog.js")));

const lessons = history.listHistoryLessons(8);
assert.equal(lessons.length, 6, "six deterministic History lessons ship in v0.5.2");
assert.deepEqual(
  new Set(lessons.map((lesson) => lesson.topic)),
  new Set(["past_present", "sequence", "sources", "egypt", "china", "communication"]),
);
for (const lesson of lessons) {
  assert.equal(lesson.domain, "history");
  assert.equal(lesson.facts.length, 3, `${lesson.id} has three approved facts`);
  assert.equal(lesson.questions.length, 2, `${lesson.id} has two deterministic questions`);
  assert.ok(lesson.skill.startsWith("history."));
}
assert.equal(history.listHistoryLessons(3).length, 2, "age 3 pre-readers get two highly visual time concepts");
assert.equal(history.listHistoryLessons(4).length, 3, "age 4 adds the History Detective source lesson");
assert.equal(catalog.listKnowledgeLessons("science", 8).length, 6);
assert.equal(catalog.listKnowledgeLessons("geography", 8).length, 6);
assert.equal(catalog.listKnowledgeLessons("history", 8).length, 6);
assert.equal(curriculum.listCurriculumSkills().filter((skill) => skill.domain === "history").length, 6, "History lessons are director-eligible in v0.5.3");
assert.equal(curriculum.getCurriculumSkill("history.time.before_after")?.launch.gameId, "history");
assert.equal(curriculum.getCurriculumSkill("history.time.before_after")?.launch.lessonId, "history-before-after");

const sequence = history.getHistoryLesson("history-before-after");
assert.ok(sequence);
assert.equal(catalog.getKnowledgeLesson(sequence.id)?.domain, "history");
let session = runtime.createKnowledgeLessonSession({ learnerId: "kid-time", lessonId: sequence.id, readingLevel: "pre_reader", now: 1000 });
assert.ok(session);
assert.equal(session.phase, "intro");
assert.equal(session.plan.source, "local_fallback");
assert.equal(session.plan.encouragement, "detective");
session = runtime.advanceKnowledgeLesson(session, 1100);
assert.equal(runtime.knowledgeLessonSnapshot(session)?.currentQuestion?.id, "before-after-q1");
session = runtime.answerKnowledgeQuestion(session, "seed", 420, 1600);
let snapshot = runtime.knowledgeLessonSnapshot(session);
assert.equal(snapshot?.currentAnswer?.correct, true);
assert.equal(snapshot?.score, 1);
session = runtime.advanceKnowledgeLesson(session, 1700);
session = runtime.answerKnowledgeQuestion(session, "after", 390, 2200);
session = runtime.advanceKnowledgeLesson(session, 2300);
assert.equal(session.phase, "complete");
assert.equal(runtime.knowledgeLessonSnapshot(session)?.score, 2);

const profile = {
  kidId: "kid-time",
  age: 7,
  language: "en-zh-TW",
  readingLevel: "early_reader",
  levels: { math: 1, language: 1, logic: 1, science: 1, geography: 1, history: 1 },
};
const request = requestMod.buildKnowledgeLessonRequest(profile, sequence);
assert.equal(request.context.domain, "history");
assert.equal(request.context.lessonId, sequence.id);
assert.equal(request.context.purpose, "choose_a_short_age_appropriate_history_lesson_sequence");

const service = new serviceMod.KnowledgeLessonService({
  async request(agentRequest) {
    assert.equal(agentRequest.context.domain, "history");
    return {
      kind: "knowledge_lesson_plan",
      factIds: ["after-later", "sequence-order"],
      questionIds: ["before-after-q2", "before-after-q1"],
      presentation: "visual_first",
      encouragement: "detective",
    };
  },
});
const remotePlan = await service.plan({ learner: profile, lessonId: sequence.id });
assert.equal(remotePlan?.source, "remote");
assert.deepEqual(remotePlan?.questionIds, ["before-after-q2", "before-after-q1"]);

const badService = new serviceMod.KnowledgeLessonService({
  async request() {
    return {
      kind: "knowledge_lesson_plan",
      factIds: ["invented-empire", "sequence-order"],
      questionIds: ["before-after-q1", "before-after-q2"],
      presentation: "visual_first",
      encouragement: "detective",
    };
  },
});
const fallback = await badService.plan({ learner: profile, lessonId: sequence.id });
assert.equal(fallback?.source, "local_fallback");
assert.match(fallback?.remoteError ?? "", /unsupported history fact IDs/);

const storage = new memoryMod.MemoryStorageDriver();
const normalizedProfile = await new profileStoreMod.LearnerProfileStore(storage).load("kid-profile", { age: 6 });
assert.equal(normalizedProfile.levels.history, 1, "learner profiles normalize the new History domain");
const telemetryStore = new telemetryMod.LearningTelemetryStore(storage);
const recorder = new telemetryMod.LearningTelemetryRecorder(telemetryStore);
const bridge = new bridgeMod.KnowledgeLessonBridge(storage, undefined, recorder);
await bridge.start({ kidId: "kid-history", age: 6, domain: "history", lessonId: sequence.id });
assert.equal(await bridge.snapshot({ kidId: "kid-history", age: 6, domain: "science" }), null, "Science card does not adopt a History session");
assert.equal(await bridge.snapshot({ kidId: "kid-history", age: 6, domain: "geography" }), null, "Geography card does not adopt a History session");
assert.equal((await bridge.snapshot({ kidId: "kid-history", age: 6, domain: "history" }))?.lesson.domain, "history");
await bridge.reset({ kidId: "kid-history", age: 6, domain: "geography" });
assert.equal((await bridge.snapshot({ kidId: "kid-history", age: 6, domain: "history" }))?.lesson.id, sequence.id, "resetting Geography cannot delete the active History session");
await bridge.advance({ kidId: "kid-history", age: 6, domain: "history" });
await bridge.answer({ kidId: "kid-history", age: 6, domain: "history", selectedOptionId: "seed", responseMs: 510 });
const events = await telemetryStore.list();
assert.equal(events.length, 1);
assert.equal(events[0].domain, "history");
assert.equal(events[0].skill, "history.time.before_after");
assert.equal(events[0].correct, true);

const indexSource = readFileSync(resolve(root, "index.html"), "utf8");
const runtimeSource = readFileSync(resolve(root, "js/learning-runtime.js"), "utf8");
const promptSource = readFileSync(resolve(root, "server/agent-proxy/src/prompt.ts"), "utf8");
const swSource = readFileSync(resolve(root, "sw.js"), "utf8");
assert.match(indexSource, /Time Traveler/);
assert.match(indexSource, /History facts and correct answers come from Summer Quest/);
assert.match(indexSource, /renderHistoryLab\(\)/);
assert.match(runtimeSource, /historyLessonCatalog/);
assert.match(runtimeSource, /answerHistoryLesson/);
assert.match(promptSource, /historical claim/);
assert.match(promptSource, /science, geography and history/);
assert.match(swSource, /HistoryLessonCatalog\.js/);
assert.match(swSource, /summer-quest-v\d+/);

console.log("history knowledge runtime tests: ok");
