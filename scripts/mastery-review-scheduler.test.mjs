import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
if (!existsSync(resolve(dist, "packages/learning/src/mastery/MasteryReviewScheduler.js"))) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0);
}

const {
  deriveMasteryReview,
  masteryReviewNeed,
  REVIEW_INTERVAL_DAYS,
} = await import(pathToFileURL(resolve(dist, "packages/learning/src/mastery/MasteryReviewScheduler.js")));

const DAY = 86_400_000;
const now = Date.UTC(2026, 8, 24, 4, 0, 0);

function summary(overrides = {}) {
  return {
    learnerId: "lili",
    domain: "math",
    skill: "math.addition.within_20",
    attempts: 8,
    correctAttempts: 7,
    independentAttempts: 8,
    independentCorrectAttempts: 7,
    independentCorrectRate: 7 / 8,
    firstAttemptAt: now - 8 * DAY,
    lastAttemptAt: now - 12 * 60 * 60 * 1000,
    lastIndependentAttemptAt: now - 12 * 60 * 60 * 1000,
    consecutiveIndependentCorrect: 4,
    recentIndependentCorrectRate: 1,
    previousIndependentCorrectRate: 0.75,
    independenceTrend: "improving",
    averageResponseMs: 500,
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
    latestAdaptation: "maintain",
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    ...overrides,
  };
}

assert.deepEqual(REVIEW_INTERVAL_DAYS, [1, 3, 7, 14, 30]);

const noEvidence = deriveMasteryReview(undefined, now);
assert.equal(noEvidence.state, "starting");
assert.equal(noEvidence.reviewDueAt, null);

const starting = deriveMasteryReview(summary({
  attempts: 2,
  correctAttempts: 2,
  independentAttempts: 2,
  independentCorrectAttempts: 2,
  independentCorrectRate: 1,
  consecutiveIndependentCorrect: 2,
}), now);
assert.equal(starting.state, "starting", "two independent answers are not enough to call a skill established");

const building = deriveMasteryReview(summary({
  independentAttempts: 8,
  independentCorrectAttempts: 5,
  independentCorrectRate: 5 / 8,
  recentIndependentCorrectRate: 0.5,
  consecutiveIndependentCorrect: 1,
  independenceTrend: "stable",
}), now);
assert.equal(building.state, "building");
assert.equal(building.reviewDueAt, null, "spaced review only starts after secure independent performance");

const secure = deriveMasteryReview(summary(), now);
assert.equal(secure.state, "secure");
assert.equal(secure.reviewStage, 0);
assert.equal(secure.reviewIntervalDays, 1);
assert.ok(secure.reviewDueAt > now);
assert.equal(secure.daysUntilReview, 1);

const due = deriveMasteryReview(summary({
  lastAttemptAt: now - 2 * DAY,
  lastIndependentAttemptAt: now - 2 * DAY,
}), now);
assert.equal(due.state, "review_due");
assert.equal(due.reviewIntervalDays, 1);
assert.equal(due.overdueDays, 1);
assert.ok(masteryReviewNeed(due) >= 0.58);

const mature = deriveMasteryReview(summary({
  attempts: 27,
  correctAttempts: 25,
  independentAttempts: 27,
  independentCorrectAttempts: 25,
  independentCorrectRate: 25 / 27,
  recentIndependentCorrectRate: 1,
  consecutiveIndependentCorrect: 8,
  lastAttemptAt: now - 5 * DAY,
  lastIndependentAttemptAt: now - 5 * DAY,
}), now);
assert.equal(mature.state, "secure");
assert.equal(mature.reviewIntervalDays, 14, "sustained independent evidence stretches the review interval");

const refreshed = deriveMasteryReview(summary({
  lastAttemptAt: now,
  lastIndependentAttemptAt: now,
}), now);
assert.equal(refreshed.state, "secure", "fresh successful independent practice pushes the next review into the future");
assert.equal(refreshed.overdueDays, 0);

const declining = deriveMasteryReview(summary({
  independenceTrend: "declining",
  recentIndependentCorrectRate: 0.75,
  consecutiveIndependentCorrect: 3,
}), now);
assert.equal(declining.state, "building", "declining evidence returns to active practice instead of being scheduled as secure review");

console.log("mastery review scheduler tests: ok");
