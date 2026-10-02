import type {
  LearningAttemptTelemetryEvent,
  LearningInterventionKind,
  LearningInterventionTelemetryEvent,
  LearningSupportOutcomeTelemetryEvent,
  LearningTelemetryEvent,
} from "./LearningTelemetry.js";
import type { LearningDomain } from "../types.js";

export interface TutorPolicyEvidenceRow {
  learnerId: string;
  domain: LearningDomain;
  skill: string;
  intervention: LearningInterventionKind;
  uses: number;
  supportOutcomes: number;
  successfulSupportOutcomes: number;
  supportSuccessRate: number | null;
  retryAttempts: number;
  retryRecoveries: number;
  retryRecoveryRate: number | null;
  assistedCompletions: number;
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

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function evidenceLevel(uses: number): TutorPolicyEvidenceRow["evidence"] {
  if (uses >= 20) return "usable";
  if (uses >= 10) return "emerging";
  if (uses >= 5) return "low";
  return "very_low";
}

function isSuccessfulOutcome(outcome: LearningSupportOutcomeTelemetryEvent["outcome"]): boolean {
  return outcome === "retry_recovered" || outcome === "scaffold_success" || outcome === "assisted_completion";
}

function windowIndependent(attempts: LearningAttemptTelemetryEvent[], fromAt: number, direction: "before" | "after", count = 5): LearningAttemptTelemetryEvent[] {
  const eligible = attempts.filter((attempt) => attempt.hintsUsed === 0 && (direction === "before" ? attempt.at < fromAt : attempt.at > fromAt));
  if (direction === "before") return eligible.slice(-count);
  return eligible.slice(0, count);
}

/**
 * Descriptive policy evidence only. It deliberately does not recommend or
 * mutate tutor policy. Small samples are labelled as such so an adult can
 * decide whether an intervention warrants further testing.
 */
export function evaluateTutorPolicy(events: LearningTelemetryEvent[]): TutorPolicyEvidenceRow[] {
  const sorted = events.slice().sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const groups = new Map<string, LearningTelemetryEvent[]>();
  for (const event of sorted) {
    const key = `${event.learnerId}\u0000${event.domain}\u0000${event.skill}`;
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }
  const out: TutorPolicyEvidenceRow[] = [];

  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    const attempts = group.filter((event): event is LearningAttemptTelemetryEvent => event.type === "attempt");
    const interventions = group.filter((event): event is LearningInterventionTelemetryEvent => event.type === "intervention");
    const byKind = new Map<LearningInterventionKind, LearningInterventionTelemetryEvent[]>();
    for (const intervention of interventions) {
      const list = byKind.get(intervention.intervention) ?? [];
      list.push(intervention);
      byKind.set(intervention.intervention, list);
    }

    for (const [kind, uses] of byKind) {
      const outcomes = group.filter((event): event is LearningSupportOutcomeTelemetryEvent =>
        event.type === "support_outcome" && event.intervention === kind,
      );
      const retryOutcomes = outcomes.filter((event) => event.outcome === "retry_recovered" || event.outcome === "retry_failed");
      const retryRecoveries = retryOutcomes.filter((event) => event.outcome === "retry_recovered").length;

      let nextIndependentAttempts = 0;
      let nextIndependentCorrect = 0;
      let baselineIndependentAttempts = 0;
      let baselineIndependentCorrect = 0;
      let laterIndependentAttempts = 0;
      let laterIndependentCorrect = 0;

      for (const intervention of uses) {
        const next = attempts.find((attempt) => attempt.at > intervention.at && attempt.hintsUsed === 0);
        if (next) {
          nextIndependentAttempts += 1;
          if (next.correct) nextIndependentCorrect += 1;
        }
        const before = windowIndependent(attempts, intervention.at, "before");
        const after = windowIndependent(attempts, intervention.at, "after");
        baselineIndependentAttempts += before.length;
        baselineIndependentCorrect += before.filter((attempt) => attempt.correct).length;
        laterIndependentAttempts += after.length;
        laterIndependentCorrect += after.filter((attempt) => attempt.correct).length;
      }

      const baselineRate = rate(baselineIndependentCorrect, baselineIndependentAttempts);
      const laterRate = rate(laterIndependentCorrect, laterIndependentAttempts);
      out.push({
        learnerId: first.learnerId,
        domain: first.domain,
        skill: first.skill,
        intervention: kind,
        uses: uses.length,
        supportOutcomes: outcomes.length,
        successfulSupportOutcomes: outcomes.filter((event) => isSuccessfulOutcome(event.outcome)).length,
        supportSuccessRate: rate(outcomes.filter((event) => isSuccessfulOutcome(event.outcome)).length, outcomes.length),
        retryAttempts: retryOutcomes.length,
        retryRecoveries,
        retryRecoveryRate: rate(retryRecoveries, retryOutcomes.length),
        assistedCompletions: outcomes.filter((event) => event.outcome === "assisted_completion").length,
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
  }

  return out.sort((a, b) => b.uses - a.uses || a.learnerId.localeCompare(b.learnerId) || a.domain.localeCompare(b.domain) || a.intervention.localeCompare(b.intervention));
}
