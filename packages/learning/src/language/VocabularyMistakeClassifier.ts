import type { VocabularyExercise, VocabularyMistakeKind } from "../types.js";

export interface VocabularyMistakeInput {
  exercise: VocabularyExercise;
  typedCharacter?: string;
  expectedCharacter?: string;
  wrongCountAtPosition?: number;
  totalWrongCount?: number;
}

/**
 * Conservative local diagnosis for Word Wizard. It labels only observable
 * interaction patterns; it never guesses a linguistic disorder or changes
 * grading/progression.
 */
export function classifyVocabularyMistake(input: VocabularyMistakeInput): VocabularyMistakeKind {
  const exercise = input.exercise;
  const expected = (input.expectedCharacter ?? exercise.target[exercise.position] ?? "").toLocaleLowerCase();
  const typed = (input.typedCharacter ?? "").toLocaleLowerCase();
  const wrongAtPosition = Math.max(0, Math.round(Number(input.wrongCountAtPosition) || 0));
  const totalWrong = Math.max(wrongAtPosition, Math.round(Number(input.totalWrongCount) || 0));

  if (!expected || !typed || typed === expected) return "unknown";
  if (exercise.position === 0 && totalWrong >= 2) return "recall_stall";
  if (wrongAtPosition >= 2) return "repeated_letter_confusion";
  if (wrongAtPosition === 1) return "single_letter_slip";
  return "unknown";
}
