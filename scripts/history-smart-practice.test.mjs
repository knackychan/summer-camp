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
  kidId: "time-kid",
  age: 7,
  language: "en-zh-TW",
  readingLevel: "early_reader",
  levels: { math: 2, language: 2, logic: 1, science: 1, geography: 1, history: 1 },
};

function summary(overrides = {}) {
  return {
    learnerId: "time-kid",
    domain: "history",
    skill: "history.time.before_after",
    attempts: 6,
    correctAttempts: 1,
    independentAttempts: 6,
    independentCorrectAttempts: 1,
    independentCorrectRate: 1 / 6,
    firstAttemptAt: 100,
    lastAttemptAt: 900,
    lastIndependentAttemptAt: 900,
    consecutiveIndependentCorrect: 0,
    recentIndependentCorrectRate: 0,
    previousIndependentCorrectRate: 0.33,
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

const historySkills = catalog.listCurriculumSkills().filter((skill) => skill.domain === "history");
assert.equal(historySkills.length, 6, "all six deterministic History lessons participate in the shared skill map");
for (const skill of historySkills) {
  assert.equal(skill.launch.gameId, "history");
  assert.ok(skill.launch.lessonId.startsWith("history-"));
}

const evidence = [
  summary(),
  summary({
    domain: "science", skill: "science.matter.states", attempts: 10, correctAttempts: 9,
    independentAttempts: 10, independentCorrectAttempts: 9, independentCorrectRate: 0.9,
    recentIndependentCorrectRate: 1, previousIndependentCorrectRate: 0.8, independenceTrend: "improving",
    consecutiveIndependentCorrect: 4, latestAdaptation: "maintain",
  }),
  summary({
    domain: "geography", skill: "geography.map.cardinal_directions", attempts: 10, correctAttempts: 9,
    independentAttempts: 10, independentCorrectAttempts: 9, independentCorrectRate: 0.9,
    recentIndependentCorrectRate: 1, previousIndependentCorrectRate: 0.8, independenceTrend: "improving",
    consecutiveIndependentCorrect: 4, latestAdaptation: "maintain",
  }),
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
assert.equal(plan.focusDomain, "history");
assert.equal(plan.focusSkill, "history.time.before_after");
assert.equal(plan.steps.length, 3, "a History focus is one bounded explore/check step, not the same two-question lesson repeated twice");
const historyFocus = plan.steps.find((step) => step.kind === "focus");
assert.ok(historyFocus);
assert.equal(historyFocus.launch.gameId, "history");
assert.equal(historyFocus.launch.lessonId, "history-before-after");
assert.equal(historyFocus.launch.knowledgeMode, "explore", "active History learning explores the deterministic time/evidence model before the check");
assert.equal(historyFocus.targetAttempts, 2);

let running = { ...plan, activeStepIndex: plan.steps.indexOf(historyFocus), steps: plan.steps.map((step) => ({ ...step })) };
running = director.startLearningDirectorStep(running, 2000);
const historyEvents = [
  { version:1,id:"h1",type:"attempt",at:2010,learnerId:"time-kid",domain:"history",skill:"history.time.before_after",sessionId:"history",questionId:"before-after-q1",correct:true,responseMs:500,hintsUsed:0,difficulty:1 },
  { version:1,id:"h2",type:"attempt",at:2020,learnerId:"time-kid",domain:"history",skill:"history.time.before_after",sessionId:"history",questionId:"before-after-q2",correct:false,responseMs:550,hintsUsed:0,difficulty:1 },
];
running = director.refreshLearningDirectorPlan(running, historyEvents, 2100);
assert.equal(running.activeStepIndex, plan.steps.indexOf(historyFocus) + 1, "the two real History questions advance the same director step through shared telemetry");

const DAY = 86_400_000;
const reviewNow = 20 * DAY;
const reviewEvidence = [
  summary({
    skill: "history.sources.clues", attempts: 8, correctAttempts: 8,
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
const historyReview = reviewPlan.steps.find((step) => step.kind === "review" && step.skill === "history.sources.clues");
assert.ok(historyReview, "a secure History concept can come back through the existing spaced-review scheduler");
assert.equal(historyReview.launch.gameId, "history");
assert.equal(historyReview.launch.knowledgeMode, "check", "spaced History review starts directly at the local questions instead of reteaching first");

const checkSession = knowledge.createKnowledgeLessonSession({
  learnerId: "time-kid",
  lessonId: "history-clues-sources",
  readingLevel: "early_reader",
  mode: "check",
  flow: "director",
  directorSessionId: "director-history-1",
  directorStepId: "step-history-1",
  now: 3000,
});
assert.ok(checkSession);
assert.equal(checkSession.phase, "question");
assert.equal(checkSession.adaptationAttempted, true, "an independent History review check never asks AI to resequence the measurement");
assert.equal(checkSession.flow, "director");
assert.equal(checkSession.directorSessionId, "director-history-1");
assert.equal(checkSession.directorStepId, "step-history-1");

const indexSource = readFileSync(resolve(root, "index.html"), "utf8");
assert.match(indexSource, /launch\.gameId==="science"\|\|launch\.gameId==="geography"\|\|launch\.gameId==="history"/);
assert.match(indexSource, /mode:launch\.knowledgeMode\|\|launch\.scienceMode\|\|"explore"/);
assert.match(indexSource, /snapshot\.session&&snapshot\.session\.flow==="director"/);
assert.match(indexSource, /Back to Smart Practice 回到聰明練習/);

console.log("history Smart Practice + mastery tests: ok");
