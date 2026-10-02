import type { LessonHintAgentResponse } from "../../../agent/src/types.js";
import type { ReadingLevel } from "../../../core/src/interaction-profile.js";
import type { VocabularyExercise, VocabularyHintStrategy } from "../types.js";

function chooseStrategy(
  exercise: VocabularyExercise,
  readingLevel: ReadingLevel,
  preferred: VocabularyHintStrategy[],
): VocabularyHintStrategy {
  const first = preferred.find((strategy) => strategy !== "retry");
  if (first) return first;
  if (readingLevel === "pre_reader" && exercise.emoji) return "picture_clue";
  if (exercise.position < exercise.target.length) return "next_letter";
  return "repeat_prompt";
}

function response(strategy: VocabularyHintStrategy): LessonHintAgentResponse {
  if (strategy === "picture_clue") return {
    kind: "lesson_hint",
    message: "Look at the picture, then try again.",
    messageZh: "看看圖片，再試一次。",
    strategy,
    emotion: "encouraging",
  };
  if (strategy === "sound_it_out") return {
    kind: "lesson_hint",
    message: "Listen carefully, then try the sounds again.",
    messageZh: "仔細聽，再試著把聲音拼起來。",
    strategy,
    emotion: "encouraging",
  };
  if (strategy === "first_letter") return {
    kind: "lesson_hint",
    message: "Start with just the first letter.",
    messageZh: "先從第一個字母開始。",
    strategy,
    emotion: "encouraging",
  };
  if (strategy === "next_letter") return {
    kind: "lesson_hint",
    message: "Reveal just the next letter, then keep going.",
    messageZh: "只看下一個字母，然後繼續試。",
    strategy,
    emotion: "encouraging",
  };
  if (strategy === "word_shape") return {
    kind: "lesson_hint",
    message: "Look at how long the word is and fill it in one part at a time.",
    messageZh: "看看單字有多長，一小段一小段填進去。",
    strategy,
    emotion: "encouraging",
  };
  if (strategy === "repeat_prompt") return {
    kind: "lesson_hint",
    message: "Look at the clue again before you try the word.",
    messageZh: "再看一次線索，再試這個單字。",
    strategy,
    emotion: "encouraging",
  };
  return {
    kind: "lesson_hint",
    message: "Try the same spot once more.",
    messageZh: "同一個地方再試一次。",
    strategy: "retry",
    emotion: "encouraging",
  };
}

export function createLocalVocabularyHint(
  exercise: VocabularyExercise,
  readingLevel: ReadingLevel,
  preferredStrategies: VocabularyHintStrategy[] = [],
): LessonHintAgentResponse {
  return response(chooseStrategy(exercise, readingLevel, preferredStrategies));
}
