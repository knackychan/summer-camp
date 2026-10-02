import type { SummerAgentProxyRequest } from "../../../agent/src/types.js";
import type { LearnerProfile, LearningMistakeKind, LearningSessionState, MathHintStrategy, MathQuestion, TutorInterventionKind } from "../types.js";

function ageBand(age: number): string {
  if (age <= 4) return "3-4";
  if (age <= 6) return "5-6";
  if (age <= 9) return "7-9";
  if (age <= 12) return "10-12";
  return "13+";
}

export function buildMathHintRequest(
  learner: LearnerProfile,
  session: LearningSessionState,
  question: MathQuestion,
  childAnswer: number,
  profileId?: string,
  support?: {
    preferredStrategies?: MathHintStrategy[];
    mistake?: LearningMistakeKind;
    intervention?: TutorInterventionKind;
  },
): SummerAgentProxyRequest {
  const recent = session.attempts.slice(-5);
  return {
    version: 1,
    stage: "learning:math_hint",
    task: "lesson_hint",
    context: {
      ageBand: ageBand(learner.age),
      language: learner.language,
      readingLevel: learner.readingLevel,
      domain: "math",
      skill: session.skill,
      level: session.level,
      question: {
        operation: question.operation,
        left: question.left,
        right: question.right,
        correctAnswer: question.answer,
      },
      childAnswer,
      recentAttempts: recent.map((attempt) => ({ correct: attempt.correct, hintsUsed: attempt.hintsUsed, ...(attempt.mistake ? { mistake: attempt.mistake } : {}) })),
      ...(support?.mistake ? { mistake: support.mistake } : {}),
      ...(support?.intervention ? { intervention: support.intervention } : {}),
      ...(support?.preferredStrategies?.length ? { preferredStrategies: support.preferredStrategies.slice(0, 3) } : {}),
    },
    ...(profileId ? { routing: { mode: "manual", profileId } } : {}),
  };
}
