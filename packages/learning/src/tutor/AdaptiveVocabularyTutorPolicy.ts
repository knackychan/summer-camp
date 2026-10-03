import type { ReadingLevel } from "../../../core/src/interaction-profile.js";
import type {
  LearningSessionState,
  VocabularyExercise,
  VocabularyHintStrategy,
  VocabularyTutorIntervention,
} from "../types.js";
import { classifyVocabularyMistake } from "../language/VocabularyMistakeClassifier.js";

export interface AdaptiveVocabularyTutorInput {
  session: LearningSessionState;
  exercise: VocabularyExercise;
  readingLevel: ReadingLevel;
  typedCharacter?: string;
  expectedCharacter?: string;
  wrongCountAtPosition?: number;
  totalWrongCount?: number;
}

function tinyStrategies(exercise: VocabularyExercise): VocabularyHintStrategy[] {
  if (exercise.promptMode === "fr" || exercise.promptMode === "both") return ["repeat_prompt", "first_letter"];
  if (exercise.emoji) return ["word_shape", "first_letter"];
  return ["first_letter", "word_shape"];
}

function pictureAudioStrategies(exercise: VocabularyExercise): VocabularyHintStrategy[] {
  const out: VocabularyHintStrategy[] = [];
  if (exercise.emoji) out.push("picture_clue");
  out.push("sound_it_out", "repeat_prompt");
  return out;
}

function revealThrough(exercise: VocabularyExercise): number {
  const chars = [...exercise.target];
  if (!chars.length) return 0;
  let index = Math.max(0, Math.min(chars.length - 1, exercise.position));
  while (index < chars.length && chars[index] === " ") index += 1;
  return Math.min(chars.length, index + 1);
}

/**
 * Deterministic vocabulary tutor. The local runtime owns intervention shape.
 * AI may phrase a hint only inside the strategy allow-list returned here.
 */
export function chooseVocabularyTutorIntervention(input: AdaptiveVocabularyTutorInput): VocabularyTutorIntervention {
  const mistake = classifyVocabularyMistake(input);
  const recent = input.session.attempts.slice(-5);
  const recentThree = recent.slice(-3);
  const recentCorrect = recent.filter((attempt) => attempt.correct).length;
  const recentWrong = recentThree.filter((attempt) => !attempt.correct).length;
  const recentHinted = recentThree.filter((attempt) => attempt.hintsUsed > 0).length;
  const repeatedSame = recentThree.filter((attempt) => !attempt.correct && attempt.mistake === mistake).length;
  const wrongAtPosition = Math.max(0, Math.round(Number(input.wrongCountAtPosition) || 0));
  const totalWrong = Math.max(wrongAtPosition, Math.round(Number(input.totalWrongCount) || 0));

  // A single typo after a strong run needs no extra interruption.
  if (recent.length >= 4 && recentCorrect >= 4 && mistake === "single_letter_slip") {
    return {
      kind: "continue",
      mistake,
      reason: "slip_after_success",
      preferredStrategies: [],
    };
  }

  // Repeated misses on one letter: reveal exactly that letter, locally.
  if (wrongAtPosition >= 2 || mistake === "repeated_letter_confusion") {
    return {
      kind: "reveal_letter",
      mistake,
      reason: "same_position_repeated",
      preferredStrategies: ["next_letter"],
      revealThrough: revealThrough(input.exercise),
    };
  }

  // Pre-readers and learners stuck at the start benefit from concrete sensory cues.
  if (input.readingLevel === "pre_reader" || mistake === "recall_stall" || (input.exercise.position === 0 && totalWrong >= 2)) {
    return {
      kind: "picture_audio",
      mistake,
      reason: "recall_stalled",
      preferredStrategies: pictureAudioStrategies(input.exercise),
      showPicture: !!input.exercise.emoji,
      speakTarget: true,
    };
  }

  // Sustained difficulty steps down the current word without changing the global mode.
  if (recentWrong >= 2 || recentHinted >= 2 || (recent.length >= 3 && input.session.lastAdaptation === "level_down")) {
    return {
      kind: "easier_recall",
      mistake,
      reason: "repeated_support",
      preferredStrategies: pictureAudioStrategies(input.exercise),
      revealThrough: Math.max(input.exercise.revealed, revealThrough(input.exercise)),
      showPicture: !!input.exercise.emoji,
      speakTarget: true,
    };
  }

  // The same completed-attempt pattern returning again gets concrete reinforcement.
  if (repeatedSame >= 1 && mistake !== "unknown") {
    return {
      kind: "picture_audio",
      mistake,
      reason: "needs_support",
      preferredStrategies: pictureAudioStrategies(input.exercise),
      showPicture: !!input.exercise.emoji,
      speakTarget: true,
    };
  }

  return {
    kind: "tiny_clue",
    mistake,
    reason: recent.length === 0 ? "isolated_slip" : "needs_support",
    preferredStrategies: tinyStrategies(input.exercise),
  };
}
