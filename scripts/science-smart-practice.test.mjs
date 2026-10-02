import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
if (!existsSync(resolve(dist, "packages/learning/src/director/LearningDirector.js"))) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0);
}

const catalog = await import(pathToFileURL(resolve(dist, "packages/learning/src/curriculum/SkillCatalog.js")));
const director = await import(pathToFileURL(resolve(dist, "packages/learning/src/director/LearningDirector.js")));
const knowledge = await import(pathToFileURL(resolve(dist, "packages/learning/src/knowledge/KnowledgeLessonRuntime.js")));

const learner = {
  kidId: "lili",
  age: 7,
  language: "en-zh-TW",
  readingLevel: "early_reader",
  levels: { math: 2, language: 2, logic: 1, science: 1, geography: 1 },
};

function summary(overrides = {}) {
  return {
    learnerId: "lili",
    domain: "science",
    skill: "science.matter.states",
    attempts: 6,
    correctAttempts: 2,
    independentAttempts: 6,
    independentCorrectAttempts: 2,
    independentCorrectRate: 2 / 6,
    firstAttemptAt: 100,
    lastAttemptAt: 900,
    lastIndependentAttemptAt: 900,
    consecutiveIndependentCorrect: 0,
    recentIndependentCorrectRate: 0.25,
    previousIndependentCorrectRate: 0.5,
    independenceTrend: "declining",
    averageResponseMs: 600,
    interventionCount: 0,
    remoteHintCount: 0,
    localHintCount: 0,
    aiHintRate: null,
    remoteFallbackCount: 0,
    retryRecoveries: 0,
    retryAttempts: 0,
    retryRecoveryRate: null,
    assistedCompletions: 0,
    topMistake: null,
    latestAdaptation: null,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    ...overrides,
  };
}

const scienceSkills = catalog.listCurriculumSkills().filter((skill) => skill.domain === "science");
assert.equal(scienceSkills.length, 6, "all six deterministic Science lessons participate in the shared skill map");
for (const skill of scienceSkills) {
  assert.equal(skill.launch.gameId, "science");
  assert.ok(skill.launch.lessonId.startsWith("science-"));
}

const evidence = [
  summary(),
  summary({
    domain: "math", skill: "math.addition.within_20", attempts: 12, correctAttempts: 11,
    independentAttempts: 12, independentCorrectAttempts: 11, independentCorrectRate: 11 / 12,
    recentIndependentCorrectRate: 1, previousIndependentCorrectRate: 0.83, independenceTrend: "improving",
    consecutiveIndependentCorrect: 5, latestAdaptation: "maintain",
  }),
  summary({
    domain: "language", skill: "language.picture_vocabulary.basic", attempts: 10, correctAttempts: 9,
    independentAttempts: 10, independentCorrectAttempts: 9, independentCorrectRate: 0.9,
    recentIndependentCorrectRate: 1, previousIndependentCorrectRate: 0.8, independenceTrend: "improving",
    consecutiveIndependentCorrect: 4, latestAdaptation: "maintain",
  }),
];
const plan = director.buildLearningDirectorPlan({ learner, summaries: evidence, day: "2026-09-25", preferredVocabularyMode: "recall", now: 1000 });
assert.equal(plan.version, 11);
assert.equal(plan.focusDomain, "science");
assert.equal(plan.focusSkill, "science.matter.states");
assert.equal(plan.steps.length, 3, "a Science focus is one bounded explore/check step, not the same two-question lesson repeated twice");
const scienceFocus = plan.steps.find((step) => step.kind === "focus");
assert.ok(scienceFocus);
assert.equal(scienceFocus.launch.gameId, "science");
assert.equal(scienceFocus.launch.lessonId, "science-matter-states");
assert.equal(scienceFocus.launch.knowledgeMode, "explore", "active Science learning explores the deterministic model before the check");
assert.equal(scienceFocus.launch.scienceMode, "explore", "the legacy Science mode alias remains available during v10 migration");
assert.equal(scienceFocus.targetAttempts, 2);

let running = { ...plan, activeStepIndex: plan.steps.indexOf(scienceFocus), steps: plan.steps.map((step) => ({ ...step })) };
running = director.startLearningDirectorStep(running, 2000);
const started = director.currentLearningDirectorStep(running);
assert.equal(started.skill, "science.matter.states");
const scienceEvents = [
  { version:1,id:"s1",type:"attempt",at:2010,learnerId:"lili",domain:"science",skill:"science.matter.states",sessionId:"science",questionId:"matter-q1",correct:true,responseMs:500,hintsUsed:0,difficulty:1 },
  { version:1,id:"s2",type:"attempt",at:2020,learnerId:"lili",domain:"science",skill:"science.matter.states",sessionId:"science",questionId:"matter-q2",correct:false,responseMs:550,hintsUsed:0,difficulty:1 },
];
running = director.refreshLearningDirectorPlan(running, scienceEvents, 2100);
assert.equal(running.activeStepIndex, plan.steps.indexOf(scienceFocus) + 1, "the two real Science questions advance the same director step through shared telemetry");

const DAY = 86_400_000;
const reviewNow = 20 * DAY;
const reviewEvidence = [
  summary({
    skill: "science.animals.groups", attempts: 8, correctAttempts: 8,
    independentAttempts: 8, independentCorrectAttempts: 8, independentCorrectRate: 1,
    recentIndependentCorrectRate: 1, previousIndependentCorrectRate: 1, independenceTrend: "stable",
    consecutiveIndependentCorrect: 8, firstAttemptAt: reviewNow - 6 * DAY,
    lastAttemptAt: reviewNow - 2 * DAY, lastIndependentAttemptAt: reviewNow - 2 * DAY,
  }),
  summary({
    domain: "math", skill: "math.addition.within_20", attempts: 8, correctAttempts: 3,
    independentAttempts: 8, independentCorrectAttempts: 3, independentCorrectRate: 3 / 8,
    recentIndependentCorrectRate: 0.25, previousIndependentCorrectRate: 0.5, independenceTrend: "declining",
    latestAdaptation: "support",
  }),
];
const reviewPlan = director.buildLearningDirectorPlan({ learner, summaries: reviewEvidence, day: "2026-09-26", preferredVocabularyMode: "recall", now: reviewNow });
const scienceReview = reviewPlan.steps.find((step) => step.kind === "review" && step.skill === "science.animals.groups");
assert.ok(scienceReview, "a secure Science concept can come back through the existing spaced-review scheduler");
assert.equal(scienceReview.launch.gameId, "science");
assert.equal(scienceReview.launch.knowledgeMode, "check", "spaced Science review starts directly at the local questions instead of reteaching first");

const checkSession = knowledge.createKnowledgeLessonSession({
  learnerId: "lili",
  lessonId: "science-animals-groups",
  readingLevel: "early_reader",
  mode: "check",
  flow: "director",
  directorSessionId: "director-1",
  directorStepId: "step-1",
  now: 3000,
});
assert.ok(checkSession);
assert.equal(checkSession.phase, "question");
assert.equal(checkSession.adaptationAttempted, true, "an independent review check never asks AI to resequence the measurement");
assert.equal(checkSession.flow, "director");
assert.equal(checkSession.directorSessionId, "director-1");
assert.equal(checkSession.directorStepId, "step-1");

const indexSource = readFileSync(resolve(root, "index.html"), "utf8");
assert.match(indexSource, /launch\.gameId==="science"\|\|launch\.gameId==="geography"\|\|launch\.gameId==="history"/);
assert.match(indexSource, /mode:launch\.knowledgeMode\|\|launch\.scienceMode\|\|"explore"/);
assert.match(indexSource, /Back to Smart Practice 回到聰明練習/);
assert.match(indexSource, /snapshot\.session&&snapshot\.session\.flow==="director"/);

console.log("science Smart Practice + mastery tests: ok");
