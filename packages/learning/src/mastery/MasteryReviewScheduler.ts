import type { LearningTelemetrySummary } from "../telemetry/LearningTelemetry.js";

export type MasteryReviewState = "starting" | "building" | "secure" | "review_due";

export interface MasteryReviewSnapshot {
  state: MasteryReviewState;
  independentAttempts: number;
  independentCorrectAttempts: number;
  independentCorrectRate: number | null;
  recentIndependentCorrectRate: number | null;
  consecutiveIndependentCorrect: number;
  lastIndependentAt: number | null;
  reviewStage: number;
  reviewIntervalDays: number | null;
  reviewDueAt: number | null;
  daysUntilReview: number | null;
  overdueDays: number;
}

export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;
const DAY_MS = 86_400_000;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function reviewStageFor(independentAttempts: number): number {
  if (independentAttempts >= 40) return 4;
  if (independentAttempts >= 25) return 3;
  if (independentAttempts >= 15) return 2;
  if (independentAttempts >= 10) return 1;
  return 0;
}

function isSecure(summary: LearningTelemetrySummary): boolean {
  if (summary.independentAttempts < 6) return false;
  if ((summary.independentCorrectRate ?? 0) < 0.85) return false;
  if ((summary.recentIndependentCorrectRate ?? summary.independentCorrectRate ?? 0) < 0.8) return false;
  if ((summary.consecutiveIndependentCorrect ?? 0) < 3) return false;
  if (summary.independenceTrend === "declining") return false;
  if (summary.latestAdaptation === "level_down") return false;
  return true;
}

/**
 * Derives longitudinal mastery + spaced-review timing from existing telemetry.
 * This is intentionally pure/derived state: no second mastery database can drift
 * away from the child's real attempts. Only independent attempts advance mastery.
 */
export function deriveMasteryReview(
  summary: LearningTelemetrySummary | undefined,
  now = Date.now(),
): MasteryReviewSnapshot {
  if (!summary || summary.independentAttempts <= 0) {
    return {
      state: "starting",
      independentAttempts: 0,
      independentCorrectAttempts: 0,
      independentCorrectRate: null,
      recentIndependentCorrectRate: null,
      consecutiveIndependentCorrect: 0,
      lastIndependentAt: null,
      reviewStage: 0,
      reviewIntervalDays: null,
      reviewDueAt: null,
      daysUntilReview: null,
      overdueDays: 0,
    };
  }

  const base = {
    independentAttempts: summary.independentAttempts,
    independentCorrectAttempts: summary.independentCorrectAttempts,
    independentCorrectRate: summary.independentCorrectRate,
    recentIndependentCorrectRate: summary.recentIndependentCorrectRate,
    consecutiveIndependentCorrect: summary.consecutiveIndependentCorrect ?? 0,
    lastIndependentAt: summary.lastIndependentAttemptAt ?? null,
  };

  if (summary.independentAttempts < 3) {
    return {
      ...base,
      state: "starting",
      reviewStage: 0,
      reviewIntervalDays: null,
      reviewDueAt: null,
      daysUntilReview: null,
      overdueDays: 0,
    };
  }

  if (!isSecure(summary) || !summary.lastIndependentAttemptAt) {
    return {
      ...base,
      state: "building",
      reviewStage: 0,
      reviewIntervalDays: null,
      reviewDueAt: null,
      daysUntilReview: null,
      overdueDays: 0,
    };
  }

  const stage = reviewStageFor(summary.independentAttempts);
  const intervalDays = REVIEW_INTERVAL_DAYS[stage] ?? 30;
  const dueAt = summary.lastIndependentAttemptAt + intervalDays * DAY_MS;
  const deltaDays = (dueAt - now) / DAY_MS;
  const due = dueAt <= now;

  return {
    ...base,
    state: due ? "review_due" : "secure",
    reviewStage: stage,
    reviewIntervalDays: intervalDays,
    reviewDueAt: dueAt,
    daysUntilReview: due ? 0 : Math.max(0, Math.ceil(deltaDays)),
    overdueDays: due ? clamp(Math.floor((now - dueAt) / DAY_MS), 0, 3650) : 0,
  };
}

/** A bounded boost used by Smart Practice to make due reviews visible without
 * letting review scheduling overwhelm a skill that is actively struggling. */
export function masteryReviewNeed(snapshot: MasteryReviewSnapshot): number {
  if (snapshot.state !== "review_due") return 0;
  return clamp(0.58 + snapshot.overdueDays * 0.025, 0.58, 0.78);
}
