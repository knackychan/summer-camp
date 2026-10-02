import type { SummerAgentProxyRequest } from "../../../agent/src/types.js";
import type { LearnerProfile } from "../types.js";
import type { MathTeachScene } from "./MathTeachScene.js";

function ageBand(age: number): string {
  if (age <= 4) return "3-4";
  if (age <= 6) return "5-6";
  if (age <= 9) return "7-9";
  if (age <= 12) return "10-12";
  return "13+";
}

export function buildMathTeachRequest(learner: LearnerProfile, scene: MathTeachScene, profileId?: string): SummerAgentProxyRequest {
  return {
    version: 1,
    stage: "learning:math_explanation",
    task: "lesson_explanation",
    context: {
      ageBand: ageBand(learner.age),
      language: learner.language,
      readingLevel: learner.readingLevel,
      domain: "math",
      skill: scene.skill,
      conceptLabel: scene.title,
      example: {
        operation: scene.example.operation,
        left: scene.example.left,
        right: scene.example.right,
        correctAnswer: scene.example.answer,
      },
      preferredStrategies: [scene.strategy],
      purpose: "brief_concept_teach",
    },
    ...(profileId ? { routing: { mode: "manual", profileId } } : {}),
  };
}
