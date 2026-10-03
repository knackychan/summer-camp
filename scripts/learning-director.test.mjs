import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
if (!existsSync(resolve(dist, "packages/learning/src/director/LearningDirector.js"))) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0);
}

const { MemoryStorageDriver } = await import(pathToFileURL(resolve(dist, "packages/storage/src/memory/MemoryStorageDriver.js")));
const {
  buildLearningDirectorPlan,
  completeLearningDirectorStep,
  currentLearningDirectorStep,
  refreshLearningDirectorPlan,
  startLearningDirectorStep,
} = await import(pathToFileURL(resolve(dist, "packages/learning/src/director/LearningDirector.js")));
const { LearningDirectorBridge } = await import(pathToFileURL(resolve(dist, "packages/learning/src/legacy/LearningDirectorBridge.js")));
const { LearningTelemetryStore } = await import(pathToFileURL(resolve(dist, "packages/learning/src/telemetry/LearningTelemetry.js")));

const learner = {
  kidId: "lili",
  age: 7,
  language: "en-zh-TW",
  readingLevel: "early_reader",
  levels: { math: 2, language: 2, logic: 1 },
};

function summary(overrides) {
  return {
    learnerId: "lili",
    domain: "math",
    skill: "math.addition.within_20",
    attempts: 10,
    correctAttempts: 8,
    independentAttempts: 10,
    independentCorrectAttempts: 8,
    independentCorrectRate: 0.8,
    firstAttemptAt: 100,
    lastAttemptAt: 900,
    lastIndependentAttemptAt: 900,
    consecutiveIndependentCorrect: 4,
    recentIndependentCorrectRate: 0.8,
    previousIndependentCorrectRate: 0.8,
    independenceTrend: "stable",
    averageResponseMs: 500,
    interventionCount: 1,
    remoteHintCount: 0,
    localHintCount: 1,
    aiHintRate: 0,
    remoteFallbackCount: 0,
    retryRecoveries: 0,
    retryAttempts: 0,
    retryRecoveryRate: null,
    assistedCompletions: 0,
    topMistake: null,
    latestAdaptation: "maintain",
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    ...overrides,
  };
}

const evidence = [
  summary({
    domain: "math", skill: "math.addition.within_20", attempts: 10,
    independentAttempts: 10, independentCorrectAttempts: 4, independentCorrectRate: 0.4,
    recentIndependentCorrectRate: 0.3, previousIndependentCorrectRate: 0.6,
    independenceTrend: "declining", latestAdaptation: "support", interventionCount: 4,
  }),
  summary({
    domain: "language", skill: "language.picture_vocabulary.basic", attempts: 12,
    independentAttempts: 12, independentCorrectAttempts: 11, independentCorrectRate: 11 / 12,
    recentIndependentCorrectRate: 1, previousIndependentCorrectRate: 0.83,
    independenceTrend: "improving", latestAdaptation: "maintain", interventionCount: 0,
  }),
];
const plan = buildLearningDirectorPlan({ learner, summaries: evidence, day: "2026-09-24", preferredVocabularyMode: "recall", now: 1000 });
assert.equal(plan.focusDomain, "math", "the weaker precise skill becomes the deterministic focus");
assert.equal(plan.focusSkill, "math.addition.within_20");
assert.equal(plan.version, 11);
assert.equal(plan.steps.length, 4);
assert.equal(plan.steps[0].domain, "language", "a familiar strong skill is used as the warm-up");
assert.equal(plan.steps[1].domain, "math");
assert.equal(plan.steps[1].skill, "math.addition.within_20");
assert.equal(plan.steps[1].kind, "teach", "repeated weakness inserts a brief concept-teach step before practice");
assert.equal(plan.steps[1].launch, undefined, "teach steps are inline explanations rather than a second game");
assert.equal(plan.steps[2].kind, "focus");
assert.equal(plan.steps[2].domain, "math", "practice follows the teach scene for the same focus skill");
assert.equal(plan.steps[2].launch.gameId, "calc");
assert.equal(plan.steps[2].launch.mathSkill, "math.addition.within_20");
assert.equal(plan.steps[0].launch.gameId, "vocab");
assert.equal(plan.steps[0].launch.vocabularyMode, "recall");
assert.ok(plan.skills.some((skill) => skill.skill === "math.addition.within_20" && skill.band === "needs_practice"));
assert.ok(plan.skills.some((skill) => skill.skill === "language.picture_vocabulary.basic" && skill.band === "strong"));

const languageWeakEvidence = [
  summary({
    domain: "math", skill: "math.addition.within_20", attempts: 12,
    independentAttempts: 12, independentCorrectAttempts: 11, independentCorrectRate: 11 / 12,
    recentIndependentCorrectRate: 1, previousIndependentCorrectRate: 0.83,
    independenceTrend: "improving", latestAdaptation: "maintain", interventionCount: 0,
  }),
  summary({
    domain: "language", skill: "language.picture_vocabulary.basic", attempts: 9,
    correctAttempts: 4, independentAttempts: 9, independentCorrectAttempts: 4, independentCorrectRate: 4 / 9,
    recentIndependentCorrectRate: 0.4, previousIndependentCorrectRate: 0.5,
    independenceTrend: "declining", latestAdaptation: "support", interventionCount: 4,
  }),
];
const languageTeachPlan = buildLearningDirectorPlan({ learner, summaries: languageWeakEvidence, day: "2026-09-25", preferredVocabularyMode: "recall", now: 1100 });
assert.equal(languageTeachPlan.focusDomain, "language", "a weak language skill can become the deterministic focus");
assert.equal(languageTeachPlan.focusSkill, "language.picture_vocabulary.basic");
assert.equal(languageTeachPlan.steps[1].kind, "teach", "repeated language weakness inserts a brief language teach step");
assert.equal(languageTeachPlan.steps[1].skill, "language.picture_vocabulary.basic");
assert.equal(languageTeachPlan.steps[2].launch.gameId, "vocab", "language practice resumes in the existing Word Wizard after teaching");
assert.equal(languageTeachPlan.steps[2].launch.vocabularyMode, "recall");


const legacyLanguageEvidence = [
  summary({
    domain: "language", skill: "language.word_recall", attempts: 8,
    independentAttempts: 8, independentCorrectAttempts: 7, independentCorrectRate: 7 / 8,
    recentIndependentCorrectRate: 1, previousIndependentCorrectRate: 0.75,
    independenceTrend: "stable", latestAdaptation: "maintain", interventionCount: 0,
  }),
];
const legacySeedPlan = buildLearningDirectorPlan({ learner, summaries: legacyLanguageEvidence, day: "2026-09-26", preferredVocabularyMode: "recall", now: 1200 });
const legacySeedState = legacySeedPlan.skills.find((skill) => skill.skill === "language.picture_vocabulary.basic");
assert.ok(legacySeedState && legacySeedState.attempts === 8, "legacy word-recall history seeds the nearest new base vocabulary skill after upgrade");
assert.equal(legacySeedPlan.skills.find((skill) => skill.skill === "language.spelling_patterns.basic")?.attempts, 0, "coarse legacy recall does not fabricate spelling-pattern evidence");

const dayMs = 86_400_000;
const reviewNow = 20 * dayMs;
const reviewEvidence = [
  summary({
    domain: "math", skill: "math.addition.within_20", attempts: 8,
    independentAttempts: 8, independentCorrectAttempts: 7, independentCorrectRate: 7 / 8,
    recentIndependentCorrectRate: 1, previousIndependentCorrectRate: 0.75, independenceTrend: "improving",
    consecutiveIndependentCorrect: 4, firstAttemptAt: reviewNow - 8 * dayMs, lastAttemptAt: reviewNow - 2 * dayMs, lastIndependentAttemptAt: reviewNow - 2 * dayMs,
    latestAdaptation: "maintain", interventionCount: 0,
  }),
  summary({
    domain: "language", skill: "language.picture_vocabulary.basic", attempts: 10,
    independentAttempts: 10, independentCorrectAttempts: 10, independentCorrectRate: 1,
    recentIndependentCorrectRate: 1, previousIndependentCorrectRate: 1, independenceTrend: "stable",
    consecutiveIndependentCorrect: 10, firstAttemptAt: reviewNow - 5 * dayMs, lastAttemptAt: reviewNow, lastIndependentAttemptAt: reviewNow,
    latestAdaptation: "maintain", interventionCount: 0,
  }),
];
const reviewPlan = buildLearningDirectorPlan({ learner, summaries: reviewEvidence, day: "2026-09-24", preferredVocabularyMode: "recall", now: reviewNow });
const dueSkill = reviewPlan.skills.find((skill) => skill.skill === "math.addition.within_20");
assert.equal(dueSkill?.mastery, "review_due");
assert.equal(reviewPlan.reviewDueCount, 1);
assert.equal(reviewPlan.steps[0].kind, "review", "a due secure skill is mixed into the session as a scheduled review when another skill is the focus");
assert.equal(reviewPlan.steps[0].skill, "math.addition.within_20");

const blankPlanA = buildLearningDirectorPlan({ learner, summaries: [], day: "2026-09-24", preferredVocabularyMode: "recall", now: 2000 });
const blankPlanB = buildLearningDirectorPlan({ learner, summaries: [], day: "2026-09-24", preferredVocabularyMode: "recall", now: 3000 });
assert.equal(blankPlanA.focusSkill, blankPlanB.focusSkill, "no-data tie breaking is stable for a learner/day");
assert.ok(blankPlanA.skills.some((skill) => skill.domain === "science"), "Science joins the same Smart Practice skill pool");
assert.ok(blankPlanA.skills.some((skill) => skill.domain === "geography"), "Geography joins the same Smart Practice skill pool");
assert.ok(blankPlanA.skills.some((skill) => skill.domain === "history"), "History joins the same Smart Practice skill pool");
assert.ok(new Set(blankPlanA.steps.map((step) => step.domain)).size >= 2, "a blank plan still mixes domains instead of becoming a one-subject drill");

const preReader = { ...learner, kidId: "lucien", age: 4, readingLevel: "pre_reader" };
const prePlan = buildLearningDirectorPlan({ learner: preReader, summaries: [], day: "2026-09-24", preferredVocabularyMode: "translate", now: 4000 });
assert.equal(prePlan.vocabularyMode, "copy", "pre-reader sessions never force a translation-text mode");
assert.ok(prePlan.skills.some((skill) => skill.skill === "math.addition.within_5"));
assert.ok(prePlan.skills.some((skill) => skill.skill === "language.initial_sound"));
assert.ok(prePlan.skills.some((skill) => skill.skill === "language.word_build.simple"));
assert.ok(prePlan.skills.some((skill) => skill.domain === "science"), "pre-readers can receive age-appropriate visual Science practice");
assert.ok(prePlan.skills.some((skill) => skill.domain === "geography"), "pre-readers can receive age-appropriate visual Geography practice");
assert.ok(prePlan.skills.some((skill) => skill.domain === "history"), "pre-readers can receive age-appropriate visual History practice");
assert.ok(prePlan.steps.every((step) => step.domain !== "language" || ["language.initial_sound", "language.word_build.simple"].includes(step.skill)), "pre-reader language steps stay in no-reading modes even when Science is also available");

let running = startLearningDirectorStep(plan, 5000);
let active = currentLearningDirectorStep(running);
assert.ok(active?.startedAt);
const unrelatedDomain = active?.domain === "math" ? "language" : "math";
const unrelatedSkill = unrelatedDomain === "math" ? "math.addition.within_20" : "language.picture_vocabulary.basic";
const unrelated = [{ version:1,id:"x",type:"attempt",at:5100,learnerId:"lili",domain:unrelatedDomain,skill:unrelatedSkill,sessionId:"s",questionId:"q",correct:true,responseMs:300,hintsUsed:0,difficulty:2 }];
running = refreshLearningDirectorPlan(running, unrelated, 5200);
assert.equal(running.activeStepIndex, 0, "unrelated skill practice cannot complete the current curriculum step");
if (!active) throw new Error("expected active step");
const matching = [
  { version:1,id:"a",type:"attempt",at:5100,learnerId:"lili",domain:active.domain,skill:active.skill,sessionId:"v",questionId:"w1",correct:true,responseMs:300,hintsUsed:0,difficulty:2 },
  { version:1,id:"b",type:"attempt",at:5150,learnerId:"lili",domain:active.domain,skill:active.skill,sessionId:"v",questionId:"w2",correct:true,responseMs:300,hintsUsed:0,difficulty:2 },
];
running = refreshLearningDirectorPlan(running, matching, 5300);
assert.equal(running.activeStepIndex, 1, "the step advances only after its matching attempt target");
assert.ok(running.steps[0].completedAt);
assert.equal(running.steps[1].startedAt, undefined, "later steps do not consume earlier game attempts until explicitly started");
running = startLearningDirectorStep(running, 5400);
assert.equal(currentLearningDirectorStep(running)?.kind, "teach");
assert.ok(currentLearningDirectorStep(running)?.startedAt, "teach step explicitly starts before the visual lesson is shown");
running = refreshLearningDirectorPlan(running, matching, 5450);
assert.equal(running.activeStepIndex, 1, "teach steps never auto-complete from unrelated or matching attempt telemetry");
running = completeLearningDirectorStep(running, 5500);
assert.equal(running.activeStepIndex, 2, "the child acknowledgement advances the inline teach step");
assert.equal(currentLearningDirectorStep(running)?.kind, "focus");

const memory = new MemoryStorageDriver();
const telemetry = new LearningTelemetryStore(memory);
const bridge = new LearningDirectorBridge(memory);
const bridgeInput = { kidId:"lili", age:7, language:"en-zh-TW", preferredVocabularyMode:"recall" };
const before = await bridge.snapshot(bridgeInput);
const started = await bridge.start(bridgeInput);
assert.equal(started.plan.id, before.plan.id, "starting reuses the persisted daily plan");
assert.ok(started.currentStep?.startedAt);
if (!started.currentStep) throw new Error("expected a current step");
for (let i = 0; i < started.currentStep.targetAttempts; i += 1) {
  await telemetry.append({
    version:1,id:`bridge-${i}`,type:"attempt",at:started.currentStep.startedAt + i + 1,
    learnerId:"lili",domain:started.currentStep.domain,skill:started.currentStep.skill,sessionId:"bridge",questionId:`q${i}`,
    correct:true,responseMs:350,hintsUsed:0,difficulty:2,
  });
}
const advanced = await bridge.snapshot(bridgeInput);
assert.equal(advanced.plan.activeStepIndex, 1, "bridge refresh derives progress from real learning telemetry");
const reset = await bridge.reset(bridgeInput);
assert.notEqual(reset.plan.id, advanced.plan.id, "reset creates a fresh session plan");

console.log("learning director tests: ok");
