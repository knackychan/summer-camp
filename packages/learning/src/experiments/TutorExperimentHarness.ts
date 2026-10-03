import { createEasierMathFollowUp } from "../math/MathScaffold.js";
import type { MathQuestion, MathTutorIntervention } from "../types.js";

export const MATH_NEAR_MISS_SUPPORT_EXPERIMENT_ID = "math-near-miss-support-v1";

export type TutorExperimentVariantId = "visual_explanation" | "easier_follow_up";

export interface TutorExperimentAssignment {
  experimentId: typeof MATH_NEAR_MISS_SUPPORT_EXPERIMENT_ID;
  variantId: TutorExperimentVariantId;
}

export interface TutorExperimentMathResult {
  intervention: MathTutorIntervention;
  assignment?: TutorExperimentAssignment;
}

export interface TutorExperimentMathInput {
  learnerId: string;
  question: MathQuestion;
  baseline: MathTutorIntervention;
}

function hash32(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function isEligibleMathNearMiss(input: TutorExperimentMathInput): boolean {
  if (input.baseline.reason !== "repeated_pattern") return false;
  return input.baseline.mistake === "near_miss" || input.baseline.mistake === "counting_slip";
}

/**
 * Controlled tutor-policy experiment harness.
 *
 * Experiments are opt-in through server-provided public config. Assignment is
 * deterministic per learner + experiment, so the same learner does not bounce
 * between variants across sessions/devices. The harness never changes grading,
 * learning level, or eligibility for an activity; it can only replace one
 * already-approved tutor support intervention with another predefined support.
 */
export class TutorExperimentHarness {
  private readonly enabled = new Set<string>();

  constructor(enabledExperimentIds: readonly string[] = []) {
    for (const id of enabledExperimentIds) {
      const clean = String(id || "").trim();
      if (clean === MATH_NEAR_MISS_SUPPORT_EXPERIMENT_ID) this.enabled.add(clean);
    }
  }

  isEnabled(experimentId: string): boolean {
    return this.enabled.has(experimentId);
  }

  assignmentFor(learnerId: string, experimentId = MATH_NEAR_MISS_SUPPORT_EXPERIMENT_ID): TutorExperimentAssignment | null {
    if (experimentId !== MATH_NEAR_MISS_SUPPORT_EXPERIMENT_ID || !this.isEnabled(experimentId)) return null;
    const bucket = hash32(`${experimentId}\u0000${learnerId}`) % 2;
    return {
      experimentId: MATH_NEAR_MISS_SUPPORT_EXPERIMENT_ID,
      variantId: bucket === 0 ? "visual_explanation" : "easier_follow_up",
    };
  }

  applyMath(input: TutorExperimentMathInput): TutorExperimentMathResult {
    if (!this.isEnabled(MATH_NEAR_MISS_SUPPORT_EXPERIMENT_ID) || !isEligibleMathNearMiss(input)) {
      return { intervention: input.baseline };
    }
    const assignment = this.assignmentFor(input.learnerId);
    if (!assignment) return { intervention: input.baseline };

    if (assignment.variantId === "visual_explanation") {
      const { easierQuestion: _ignored, ...baselineWithoutScaffold } = input.baseline;
      return {
        assignment,
        intervention: {
          ...baselineWithoutScaffold,
          kind: "visual_explanation",
          preferredStrategies: ["objects", "number_line"],
        },
      };
    }

    return {
      assignment,
      intervention: {
        ...input.baseline,
        kind: "easier_follow_up",
        preferredStrategies: ["objects", "number_line"],
        easierQuestion: createEasierMathFollowUp(input.question),
      },
    };
  }
}
