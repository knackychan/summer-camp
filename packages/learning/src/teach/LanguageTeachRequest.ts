import type { SummerAgentProxyRequest } from "../../../agent/src/types.js";
import type { LearnerProfile } from "../types.js";
import type { LanguageTeachScene } from "./LanguageTeachScene.js";

function ageBand(age: number): string {
  if (age <= 4) return "3-4";
  if (age <= 6) return "5-6";
  if (age <= 9) return "7-9";
  if (age <= 12) return "10-12";
  return "13+";
}

export function buildLanguageTeachRequest(learner: LearnerProfile, scene: LanguageTeachScene, profileId?: string): SummerAgentProxyRequest {
  return {
    version: 1,
    stage: "learning:language_explanation",
    task: "lesson_explanation",
    context: {
      ageBand: ageBand(learner.age),
      language: learner.language,
      readingLevel: learner.readingLevel,
      domain: "language",
      skill: scene.skill,
      conceptLabel: scene.title,
      example: {
        target: scene.target,
        visualKind: scene.visual.kind,
        ...(scene.sourceFrench ? { sourceFrench: scene.sourceFrench } : {}),
        ...(scene.sourceChinese ? { sourceChinese: scene.sourceChinese } : {}),
      },
      preferredStrategies: [scene.strategy],
      purpose: "brief_concept_teach",
    },
    ...(profileId ? { routing: { mode: "manual", profileId } } : {}),
  };
}
