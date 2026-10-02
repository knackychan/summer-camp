import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
const geographyFile = resolve(dist, "packages/learning/src/knowledge/GeographyLessonCatalog.js");
if (!existsSync(geographyFile)) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0);
}

const geography = await import(pathToFileURL(geographyFile));
const catalog = await import(pathToFileURL(resolve(dist, "packages/learning/src/knowledge/KnowledgeLessonCatalog.js")));
const runtime = await import(pathToFileURL(resolve(dist, "packages/learning/src/knowledge/KnowledgeLessonRuntime.js")));
const requestMod = await import(pathToFileURL(resolve(dist, "packages/learning/src/knowledge/KnowledgeLessonRequest.js")));
const serviceMod = await import(pathToFileURL(resolve(dist, "packages/learning/src/knowledge/KnowledgeLessonService.js")));
const bridgeMod = await import(pathToFileURL(resolve(dist, "packages/learning/src/legacy/KnowledgeLessonBridge.js")));
const memoryMod = await import(pathToFileURL(resolve(dist, "packages/storage/src/memory/MemoryStorageDriver.js")));
const telemetryMod = await import(pathToFileURL(resolve(dist, "packages/learning/src/telemetry/LearningTelemetry.js")));
const profileStoreMod = await import(pathToFileURL(resolve(dist, "packages/learning/src/LearnerProfileStore.js")));

const lessons = geography.listGeographyLessons(8);
assert.equal(lessons.length, 6, "six Geography lessons ship in v0.5.0");
assert.deepEqual(
  new Set(lessons.map((lesson) => lesson.topic)),
  new Set(["directions", "symbols", "land_water", "world", "hemispheres", "environments"]),
);
for (const lesson of lessons) {
  assert.equal(lesson.domain, "geography");
  assert.equal(lesson.facts.length, 3, `${lesson.id} has three approved facts`);
  assert.equal(lesson.questions.length, 2, `${lesson.id} has two deterministic questions`);
  assert.ok(lesson.skill.startsWith("geography."));
}
assert.equal(geography.listGeographyLessons(3).length, 3, "age 3 pre-readers can explore the three most visual map lessons");
assert.equal(catalog.listKnowledgeLessons("science", 8).length, 6);
assert.equal(catalog.listKnowledgeLessons("geography", 8).length, 6);

const directions = geography.getGeographyLesson("geography-cardinal-directions");
assert.ok(directions);
assert.equal(catalog.getKnowledgeLesson(directions.id)?.domain, "geography");
let session = runtime.createKnowledgeLessonSession({ learnerId: "kid-map", lessonId: directions.id, readingLevel: "early_reader", now: 1000 });
assert.ok(session);
assert.equal(session.phase, "intro");
assert.equal(session.plan.source, "local_fallback");
session = runtime.advanceKnowledgeLesson(session, 1100);
assert.equal(runtime.knowledgeLessonSnapshot(session)?.currentQuestion?.id, "directions-q1");
session = runtime.answerKnowledgeQuestion(session, "east", 500, 1600);
let snapshot = runtime.knowledgeLessonSnapshot(session);
assert.equal(snapshot?.currentAnswer?.correct, true);
assert.equal(snapshot?.score, 1);
session = runtime.advanceKnowledgeLesson(session, 1700);
session = runtime.answerKnowledgeQuestion(session, "south", 450, 2200);
session = runtime.advanceKnowledgeLesson(session, 2300);
assert.equal(session.phase, "complete");
assert.equal(runtime.knowledgeLessonSnapshot(session)?.score, 2);

const profile = {
  kidId: "kid-map",
  age: 7,
  language: "en-zh-TW",
  readingLevel: "early_reader",
  levels: { math: 1, language: 1, logic: 1, science: 1, geography: 1 },
};
const request = requestMod.buildKnowledgeLessonRequest(profile, directions);
assert.equal(request.context.domain, "geography");
assert.equal(request.context.lessonId, directions.id);
assert.equal(request.context.purpose, "choose_a_short_age_appropriate_geography_lesson_sequence");

const service = new serviceMod.KnowledgeLessonService({
  async request(agentRequest) {
    assert.equal(agentRequest.context.domain, "geography");
    return {
      kind: "knowledge_lesson_plan",
      factIds: ["north-south", "north-top"],
      questionIds: ["directions-q2", "directions-q1"],
      presentation: "visual_first",
      encouragement: "explorer",
    };
  },
});
const remotePlan = await service.plan({ learner: profile, lessonId: directions.id });
assert.equal(remotePlan?.source, "remote");
assert.deepEqual(remotePlan?.questionIds, ["directions-q2", "directions-q1"]);

const badService = new serviceMod.KnowledgeLessonService({
  async request() {
    return {
      kind: "knowledge_lesson_plan",
      factIds: ["invented-place", "north-top"],
      questionIds: ["directions-q1", "directions-q2"],
      presentation: "visual_first",
      encouragement: "explorer",
    };
  },
});
const fallback = await badService.plan({ learner: profile, lessonId: directions.id });
assert.equal(fallback?.source, "local_fallback");
assert.match(fallback?.remoteError ?? "", /unsupported geography fact IDs/);

const storage = new memoryMod.MemoryStorageDriver();
const normalizedProfile = await new profileStoreMod.LearnerProfileStore(storage).load("kid-profile", { age: 6 });
assert.equal(normalizedProfile.levels.geography, 1, "learner profiles normalize the new Geography domain");
const telemetryStore = new telemetryMod.LearningTelemetryStore(storage);
const recorder = new telemetryMod.LearningTelemetryRecorder(telemetryStore);
const bridge = new bridgeMod.KnowledgeLessonBridge(storage, undefined, recorder);
await bridge.start({ kidId: "kid-geo", age: 6, domain: "geography", lessonId: directions.id });
assert.equal(await bridge.snapshot({ kidId: "kid-geo", age: 6, domain: "science" }), null, "Science card does not adopt a Geography session");
assert.equal((await bridge.snapshot({ kidId: "kid-geo", age: 6, domain: "geography" }))?.lesson.domain, "geography");
await bridge.reset({ kidId: "kid-geo", age: 6, domain: "science" });
assert.equal((await bridge.snapshot({ kidId: "kid-geo", age: 6, domain: "geography" }))?.lesson.id, directions.id, "resetting Science cannot delete the active Geography session");
await bridge.advance({ kidId: "kid-geo", age: 6, domain: "geography" });
await bridge.answer({ kidId: "kid-geo", age: 6, domain: "geography", selectedOptionId: "east", responseMs: 620 });
const events = await telemetryStore.list();
assert.equal(events.length, 1);
assert.equal(events[0].domain, "geography");
assert.equal(events[0].skill, "geography.map.cardinal_directions");
assert.equal(events[0].correct, true);

const indexSource = readFileSync(resolve(root, "index.html"), "utf8");
const runtimeSource = readFileSync(resolve(root, "js/learning-runtime.js"), "utf8");
const promptSource = readFileSync(resolve(root, "server/agent-proxy/src/prompt.ts"), "utf8");
const swSource = readFileSync(resolve(root, "sw.js"), "utf8");
assert.match(indexSource, /Map Explorer/);
assert.match(indexSource, /Geography facts and correct answers come from Summer Quest/);
assert.match(indexSource, /renderGeographyLab\(\)/);
assert.match(runtimeSource, /geographyLessonCatalog/);
assert.match(runtimeSource, /answerGeographyLesson/);
assert.match(promptSource, /authoritative knowledge lesson/);
assert.match(promptSource, /geographic claim/);
assert.match(swSource, /GeographyLessonCatalog\.js/);
assert.match(swSource, /KnowledgeLessonCatalog\.js/);
assert.match(swSource, /summer-quest-v\d+/);

console.log("geography knowledge runtime tests: ok");
