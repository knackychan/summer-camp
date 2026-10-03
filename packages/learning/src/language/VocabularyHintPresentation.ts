import type { ReadingLevel } from "../../../core/src/interaction-profile.js";
import type { VocabularyExercise, VocabularyHintPresentation, VocabularyHintStrategy } from "../types.js";

function mask(target: string): string {
  return [...target].map((ch) => ch === " " ? "  " : "_ ").join("").trimEnd();
}

function firstVisibleCharacter(target: string): string | undefined {
  return [...target].find((ch) => ch.trim().length > 0);
}

export function buildVocabularyHintPresentation(
  exercise: VocabularyExercise,
  strategy: VocabularyHintStrategy,
  readingLevel: ReadingLevel,
): VocabularyHintPresentation {
  const showText = readingLevel !== "pre_reader";
  const out: VocabularyHintPresentation = {
    mode: showText ? "text_visual" : "visual_audio",
    strategy,
    showText,
  };

  if (strategy === "picture_clue" && exercise.emoji) out.emoji = exercise.emoji;
  if (strategy === "word_shape") out.wordShape = mask(exercise.target);
  if (strategy === "first_letter") {
    const letter = firstVisibleCharacter(exercise.target);
    if (letter) out.letter = letter;
  }
  if (strategy === "next_letter") {
    const chars = [...exercise.target];
    const index = Math.max(0, Math.min(chars.length - 1, exercise.position));
    out.revealThrough = index + 1;
    const letter = chars[index];
    if (letter) out.letter = letter;
  }
  if (strategy === "repeat_prompt") {
    if ((exercise.promptMode === "fr" || exercise.promptMode === "both") && exercise.sourceFrench) out.promptCue = exercise.sourceFrench;
    else if (exercise.emoji) out.promptCue = exercise.emoji;
    else if (exercise.sourceChinese) out.promptCue = exercise.sourceChinese;
  }
  if (strategy === "sound_it_out") out.speakTarget = true;
  return out;
}
