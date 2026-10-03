import type { SummerAgentProxyRequest } from "../../../agent/src/types.js";
import type {
  LearnerProfile,
  LearningSessionState,
  VocabularyExercise,
  VocabularyHintStrategy,
  VocabularyMistakeKind,
  VocabularyTutorInterventionKind,
} from "../types.js";

function ageBand(age: number): string {
  if (age <= 4) return "3-4";
  if (age <= 6) return "5-6";
  if (age <= 9) return "7-9";
  if (age <= 12) return "10-12";
  return "13+";
}

export function buildVocabularyHintRequest(
  learner: LearnerProfile,
  session: LearningSessionState,
  exercise: VocabularyExercise,
  profileId?: string,
  support?: {
    preferredStrategies?: VocabularyHintStrategy[];
    mistake?: VocabularyMistakeKind;
    intervention?: VocabularyTutorInterventionKind;
  },
): SummerAgentProxyRequest {
  const recent = session.attempts.slice(-5);
  return {
    version: 1,
    stage: "learning:vocabulary_hint",
    task: "lesson_hint",
    context: {
      ageBand: ageBand(learner.age),
      language: learner.language,
      readingLevel: learner.readingLevel,
      domain: "language",
      skill: session.skill,
      level: session.level,
      exercise: {
        type: "vocabulary",
        mode: exercise.mode,
        target: exercise.target,
        targetLength: exercise.target.length,
        isPhrase: exercise.target.includes(" "),
        emoji: exercise.emoji,
        sourceFrench: exercise.sourceFrench,
        sourceChinese: exercise.sourceChinese,
        promptMode: exercise.promptMode,
        position: exercise.position,
        revealed: exercise.revealed,
      },
      recentAttempts: recent.map((attempt) => ({
        correct: attempt.correct,
        hintsUsed: attempt.hintsUsed,
        ...(attempt.mistake ? { mistake: attempt.mistake } : {}),
      })),
      ...(support?.mistake ? { mistake: support.mistake } : {}),
      ...(support?.intervention ? { intervention: support.intervention } : {}),
      ...(support?.preferredStrategies?.length ? { preferredStrategies: support.preferredStrategies.slice(0, 3) } : {}),
    },
    ...(profileId ? { routing: { mode: "manual", profileId } } : {}),
  };
}
