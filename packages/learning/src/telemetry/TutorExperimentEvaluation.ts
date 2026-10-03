import type {
  LearningAttemptTelemetryEvent,
  LearningInterventionTelemetryEvent,
  LearningSupportOutcomeTelemetryEvent,
  LearningTelemetryEvent,
} from "./LearningTelemetry.js";
import type { LearningDomain } from "../types.js";

export interface TutorExperimentEvidenceRow {
  experimentId: string;
  variantId: string;
  domain: LearningDomain;
  intervention: LearningInterventionTelemetryEvent["intervention"];
  learners: number;
  uses: number;
  supportOutcomes: number;
  successfulSupportOutcomes: number;
  supportSuccessRate: number | null;
  retryAttempts: number;
  retryRecoveries: number;
  retryRecoveryRate: number | null;
  nextIndependentAttempts: number;
  nextIndependentCorrect: number;
  nextIndependentCorrectRate: number | null;
  baselineIndependentAttempts: number;
  baselineIndependentCorrect: number;
  baselineIndependentCorrectRate: number | null;
  laterIndependentAttempts: number;
  laterIndependentCorrect: number;
  laterIndependentCorrectRate: number | null;
  independenceDelta: number | null;
  evidence: "very_low" | "low" | "emerging" | "usable";
}

function rate(n: number, d: number): number | null { return d > 0 ? n / d : null; }
function evidenceLevel(uses: number): TutorExperimentEvidenceRow["evidence"] {
  if (uses >= 20) return "usable";
  if (uses >= 10) return "emerging";
  if (uses >= 5) return "low";
  return "very_low";
}
function successful(outcome: LearningSupportOutcomeTelemetryEvent["outcome"]): boolean {
  return outcome === "retry_recovered" || outcome === "scaffold_success" || outcome === "assisted_completion";
}
function independentWindow(attempts: LearningAttemptTelemetryEvent[], at: number, direction: "before" | "after", count = 5): LearningAttemptTelemetryEvent[] {
  const eligible = attempts.filter((event) => event.hintsUsed === 0 && (direction === "before" ? event.at < at : event.at > at));
  return direction === "before" ? eligible.slice(-count) : eligible.slice(0, count);
}

/**
 * Descriptive evidence for explicitly tagged controlled tutor experiments.
 * No ranking, winning variant, significance claim, or policy mutation is
 * produced here. An adult can review the raw rates and sample labels.
 */
export function evaluateTutorExperiments(events: LearningTelemetryEvent[]): TutorExperimentEvidenceRow[] {
  const sorted = events.slice().sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const attemptsByLearnerSkill = new Map<string, LearningAttemptTelemetryEvent[]>();
  for (const event of sorted) {
    if (event.type !== "attempt") continue;
    const key = `${event.learnerId}\u0000${event.domain}\u0000${event.skill}`;
    const list = attemptsByLearnerSkill.get(key) ?? [];
    list.push(event);
    attemptsByLearnerSkill.set(key, list);
  }

  const tagged = sorted.filter((event): event is LearningInterventionTelemetryEvent =>
    event.type === "intervention" && Boolean(event.experimentId) && Boolean(event.experimentVariant),
  );
  const groups = new Map<string, LearningInterventionTelemetryEvent[]>();
  for (const event of tagged) {
    const key = `${event.experimentId}\u0000${event.experimentVariant}\u0000${event.domain}\u0000${event.intervention}`;
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }

  const rows: TutorExperimentEvidenceRow[] = [];
  for (const uses of groups.values()) {
    const first = uses[0];
    if (!first || !first.experimentId || !first.experimentVariant) continue;
    let supportOutcomes = 0;
    let successfulSupportOutcomes = 0;
    let retryAttempts = 0;
    let retryRecoveries = 0;
    let nextIndependentAttempts = 0;
    let nextIndependentCorrect = 0;
    let baselineIndependentAttempts = 0;
    let baselineIndependentCorrect = 0;
    let laterIndependentAttempts = 0;
    let laterIndependentCorrect = 0;
    const learners = new Set<string>();

    for (const use of uses) {
      learners.add(use.learnerId);
      const skillKey = `${use.learnerId}\u0000${use.domain}\u0000${use.skill}`;
      const attempts = attemptsByLearnerSkill.get(skillKey) ?? [];
      const next = attempts.find((attempt) => attempt.at > use.at && attempt.hintsUsed === 0);
      if (next) {
        nextIndependentAttempts += 1;
        if (next.correct) nextIndependentCorrect += 1;
      }
      const before = independentWindow(attempts, use.at, "before");
      const after = independentWindow(attempts, use.at, "after");
      baselineIndependentAttempts += before.length;
      baselineIndependentCorrect += before.filter((event) => event.correct).length;
      laterIndependentAttempts += after.length;
      laterIndependentCorrect += after.filter((event) => event.correct).length;

      const outcomes = sorted.filter((event): event is LearningSupportOutcomeTelemetryEvent =>
        event.type === "support_outcome" &&
        event.learnerId === use.learnerId &&
        event.domain === use.domain &&
        event.skill === use.skill &&
        event.questionId === use.questionId &&
        event.intervention === use.intervention &&
        event.at >= use.at,
      );
      // One support outcome is expected per intervention. Counting only the
      // first avoids duplicate UI notifications inflating experiment evidence.
      const outcome = outcomes[0];
      if (outcome) {
        supportOutcomes += 1;
        if (successful(outcome.outcome)) successfulSupportOutcomes += 1;
        if (outcome.outcome === "retry_recovered" || outcome.outcome === "retry_failed") {
          retryAttempts += 1;
          if (outcome.outcome === "retry_recovered") retryRecoveries += 1;
        }
      }
    }

    const baselineRate = rate(baselineIndependentCorrect, baselineIndependentAttempts);
    const laterRate = rate(laterIndependentCorrect, laterIndependentAttempts);
    rows.push({
      experimentId: first.experimentId,
      variantId: first.experimentVariant,
      domain: first.domain,
      intervention: first.intervention,
      learners: learners.size,
      uses: uses.length,
      supportOutcomes,
      successfulSupportOutcomes,
      supportSuccessRate: rate(successfulSupportOutcomes, supportOutcomes),
      retryAttempts,
      retryRecoveries,
      retryRecoveryRate: rate(retryRecoveries, retryAttempts),
      nextIndependentAttempts,
      nextIndependentCorrect,
      nextIndependentCorrectRate: rate(nextIndependentCorrect, nextIndependentAttempts),
      baselineIndependentAttempts,
      baselineIndependentCorrect,
      baselineIndependentCorrectRate: baselineRate,
      laterIndependentAttempts,
      laterIndependentCorrect,
      laterIndependentCorrectRate: laterRate,
      independenceDelta: baselineRate == null || laterRate == null ? null : laterRate - baselineRate,
      evidence: evidenceLevel(uses.length),
    });
  }

  return rows.sort((a, b) => a.experimentId.localeCompare(b.experimentId) || a.variantId.localeCompare(b.variantId));
}
