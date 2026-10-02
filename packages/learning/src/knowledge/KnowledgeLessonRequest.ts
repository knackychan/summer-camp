import type { SummerAgentProxyRequest } from "../../../agent/src/types.js";
import type { LearnerProfile } from "../types.js";
import type { KnowledgeLessonDefinition } from "./KnowledgeLessonCatalog.js";

function ageBand(age: number): string {
  if (age <= 4) return "3-4";
  if (age <= 6) return "5-6";
  if (age <= 9) return "7-9";
  if (age <= 12) return "10-12";
  return "13+";
}

export function buildKnowledgeLessonRequest(
  learner: LearnerProfile,
  lesson: KnowledgeLessonDefinition,
  profileId?: string,
): SummerAgentProxyRequest {
  return {
    version: 1,
    stage: "learning:knowledge_lesson",
    task: "knowledge_lesson",
    context: {
      ageBand: ageBand(learner.age),
      readingLevel: learner.readingLevel,
      language: learner.language,
      domain: lesson.domain,
      lessonId: lesson.id,
      topic: lesson.topic,
      visualKind: lesson.visual.kind,
      allowedFactIds: lesson.facts.map((fact) => fact.id),
      allowedQuestionIds: lesson.questions.map((question) => question.id),
      facts: lesson.facts.map((fact) => ({ id: fact.id, text: fact.text, textZh: fact.textZh })),
      questions: lesson.questions.map((question) => ({ id: question.id, prompt: question.prompt, promptZh: question.promptZh })),
      purpose: `choose_a_short_age_appropriate_${lesson.domain}_lesson_sequence`,
    },
    ...(profileId ? { routing: { mode: "manual", profileId } } : {}),
  };
}
