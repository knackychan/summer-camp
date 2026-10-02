import type { ReadingLevel } from "../../../core/src/interaction-profile.js";
import { getCurriculumSkill, isCurriculumSkillId, type CurriculumSkillId } from "../curriculum/SkillCatalog.js";
import type { VocabularyHintStrategy } from "../types.js";

export type LanguageTeachVisual =
  | { kind: "letter_build"; emoji: string; target: string; steps: string[] }
  | { kind: "picture_word"; emoji: string; target: string; letters: string[] }
  | { kind: "translation_pair"; emoji: string; sourceFrench: string; sourceChinese: string; target: string }
  | { kind: "sentence_chunks"; emoji: string; target: string; words: string[] }
  | { kind: "sound_symbols"; emoji: string; chinese: string; target: string; symbols: string[] };

export interface LanguageTeachAudioCue {
  text: string;
  locale: "en-US" | "zh-TW";
}

export interface LanguageTeachScene {
  skill: CurriculumSkillId;
  strategy: VocabularyHintStrategy;
  title: string;
  titleZh: string;
  message: string;
  messageZh: string;
  exampleLabel: string;
  target: string;
  visual: LanguageTeachVisual;
  readingLevel: ReadingLevel;
  audioCue: LanguageTeachAudioCue;
  sourceFrench?: string;
  sourceChinese?: string;
}

interface SceneSeed {
  strategy: VocabularyHintStrategy;
  target: string;
  emoji: string;
  message: string;
  messageZh: string;
  visual: LanguageTeachVisual;
  audioCue: LanguageTeachAudioCue;
  sourceFrench?: string;
  sourceChinese?: string;
}

function letters(value: string): string[] {
  return [...value].filter((char) => char.trim().length > 0);
}

function seedForSkill(skill: CurriculumSkillId): SceneSeed | null {
  switch (skill) {
    case "language.initial_sound": {
      return {
        strategy: "sound_it_out",
        target: "c",
        emoji: "🐱",
        message: "Listen to cat. The first sound is /k/, and this word starts with c.",
        messageZh: "先聽 cat。開頭的聲音是 /k/，這個單字從 c 開始。",
        visual: { kind: "picture_word", emoji: "🐱", target: "c", letters: ["c"] },
        audioCue: { text: "cat", locale: "en-US" },
        sourceFrench: "chat",
        sourceChinese: "貓",
      };
    }
    case "language.word_build.simple":
    case "language.word_copy": {
      const target = "cat";
      return {
        strategy: "next_letter",
        target,
        emoji: "🐱",
        message: "Build a short word one letter at a time: c, then a, then t.",
        messageZh: "把短單字一個字母一個字母拼起來：c、a、t。",
        visual: { kind: "letter_build", emoji: "🐱", target, steps: ["c", "ca", "cat"] },
        audioCue: { text: target, locale: "en-US" },
        sourceFrench: "chat",
        sourceChinese: "貓",
      };
    }
    case "language.picture_vocabulary.basic":
    case "language.word_recall": {
      const target = "apple";
      return {
        strategy: "picture_clue",
        target,
        emoji: "🍎",
        message: "Connect the picture and the spoken word, then rebuild apple from left to right.",
        messageZh: "把圖片和聽到的單字連起來，再從左到右拼出 apple。",
        visual: { kind: "picture_word", emoji: "🍎", target, letters: letters(target) },
        audioCue: { text: target, locale: "en-US" },
        sourceFrench: "pomme",
        sourceChinese: "蘋果",
      };
    }
    case "language.high_frequency.recall": {
      const target = "go";
      return {
        strategy: "word_shape",
        target,
        emoji: "➡️",
        message: "Some everyday words should become quick to recognise. See go, say go, then rebuild it: g · o.",
        messageZh: "常用單字要慢慢變得一眼就認得。看 go、說 go，再拼回 g · o。",
        visual: { kind: "letter_build", emoji: "➡️", target, steps: ["g", "go"] },
        audioCue: { text: target, locale: "en-US" },
        sourceFrench: "aller",
        sourceChinese: "去",
      };
    }
    case "language.spelling_patterns.basic": {
      const target = "rain";
      return {
        strategy: "word_shape",
        target,
        emoji: "🌧️",
        message: "Notice the spelling chunk ai inside rain. Build the word as r · ai · n.",
        messageZh: "注意 rain 裡的拼字組合 ai。可以想成 r · ai · n。",
        visual: { kind: "letter_build", emoji: "🌧️", target, steps: ["r", "rai", "rain"] },
        audioCue: { text: target, locale: "en-US" },
        sourceFrench: "pluie",
        sourceChinese: "雨",
      };
    }
    case "language.word_translation.basic":
    case "language.word_translation": {
      const target = "water";
      return {
        strategy: "repeat_prompt",
        target,
        emoji: "💧",
        message: "Connect one meaning across languages. Eau and 水 both point to the English word water.",
        messageZh: "把同一個意思跨語言連起來。eau 和「水」都對應英文 water。",
        visual: { kind: "translation_pair", emoji: "💧", sourceFrench: "eau", sourceChinese: "水", target },
        audioCue: { text: target, locale: "en-US" },
        sourceFrench: "eau",
        sourceChinese: "水",
      };
    }
    case "language.sentence_patterns.simple":
    case "language.sentence_recall": {
      const target = "i like pizza";
      return {
        strategy: "word_shape",
        target,
        emoji: "🍕",
        message: "Learn the sentence frame in chunks: who · action · thing. I · like · pizza.",
        messageZh: "把句型分成小塊：誰 · 動作 · 東西。I · like · pizza。",
        visual: { kind: "sentence_chunks", emoji: "🍕", target, words: ["I", "like", "pizza"] },
        audioCue: { text: "I like pizza", locale: "en-US" },
        sourceFrench: "j'aime la pizza",
        sourceChinese: "我喜歡披薩",
      };
    }
    case "language.sentence_patterns.questions": {
      const target = "where is my bag";
      return {
        strategy: "word_shape",
        target,
        emoji: "🎒",
        message: "Question patterns have a reusable frame. Start with where is, then add the thing: where is · my bag.",
        messageZh: "問句也有可以重複使用的句型。先用 where is，再加上要找的東西：where is · my bag。",
        visual: { kind: "sentence_chunks", emoji: "🎒", target, words: ["Where is", "my bag"] },
        audioCue: { text: "Where is my bag?", locale: "en-US" },
        sourceFrench: "où est mon sac",
        sourceChinese: "我的書包在哪裡",
      };
    }
    case "language.bopomofo.sound_symbol": {
      return {
        strategy: "sound_it_out",
        target: "ㄇ",
        emoji: "🐱",
        message: "Listen to 貓. Its first Bopomofo sound starts with ㄇ.",
        messageZh: "先聽「貓」。它的第一個注音聲符是 ㄇ。",
        visual: { kind: "sound_symbols", emoji: "🐱", chinese: "貓", target: "ㄇ", symbols: ["ㄇ"] },
        audioCue: { text: "貓", locale: "zh-TW" },
        sourceChinese: "貓",
      };
    }
    case "language.bopomofo.word_build":
    case "language.bopomofo": {
      const target = "ㄇㄠ";
      return {
        strategy: "sound_it_out",
        target,
        emoji: "🐱",
        message: "Listen to 貓, then build the Bopomofo sounds in order: ㄇ · ㄠ.",
        messageZh: "先聽「貓」，再依順序拼出注音：ㄇ · ㄠ。",
        visual: { kind: "sound_symbols", emoji: "🐱", chinese: "貓", target, symbols: ["ㄇ", "ㄠ"] },
        audioCue: { text: "貓", locale: "zh-TW" },
        sourceChinese: "貓",
      };
    }
    default:
      return null;
  }
}

export function createLocalLanguageTeachScene(skill: string, readingLevel: ReadingLevel): LanguageTeachScene | null {
  if (!isCurriculumSkillId(skill)) return null;
  const definition = getCurriculumSkill(skill);
  if (!definition || definition.domain !== "language") return null;
  const seed = seedForSkill(skill);
  if (!seed) return null;

  let message = seed.message;
  let messageZh = seed.messageZh;
  if (readingLevel === "pre_reader") {
    if (seed.visual.kind === "letter_build") {
      message = "Look. Tap the same letters in order.";
      messageZh = "看一看，照順序點一樣的字母。";
    } else if (seed.visual.kind === "picture_word") {
      message = "Look. Listen. Build the word.";
      messageZh = "看圖片、聽聲音、拼單字。";
    } else if (seed.visual.kind === "sound_symbols") {
      message = "Listen. Match the sounds.";
      messageZh = "聽一聽，把聲音配起來。";
    } else {
      message = "Look and listen.";
      messageZh = "看一看、聽一聽。";
    }
  }

  return {
    skill,
    strategy: seed.strategy,
    title: `Learn · ${definition.shortLabel}`,
    titleZh: `先學會 · ${definition.shortLabelZh}`,
    message,
    messageZh,
    exampleLabel: seed.target,
    target: seed.target,
    visual: { ...seed.visual } as LanguageTeachVisual,
    readingLevel,
    audioCue: { ...seed.audioCue },
    ...(seed.sourceFrench ? { sourceFrench: seed.sourceFrench } : {}),
    ...(seed.sourceChinese ? { sourceChinese: seed.sourceChinese } : {}),
  };
}
