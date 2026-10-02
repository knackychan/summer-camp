import type { VocabularyMode } from "../types.js";

export const GRANULAR_LANGUAGE_SKILL_IDS = [
  "language.initial_sound",
  "language.word_build.simple",
  "language.picture_vocabulary.basic",
  "language.high_frequency.recall",
  "language.spelling_patterns.basic",
  "language.word_translation.basic",
  "language.sentence_patterns.simple",
  "language.sentence_patterns.questions",
  "language.bopomofo.sound_symbol",
  "language.bopomofo.word_build",
] as const;

export type GranularLanguageSkillId = typeof GRANULAR_LANGUAGE_SKILL_IDS[number];

export interface LanguageEntryShape {
  mode: VocabularyMode;
  target: string;
  emoji?: string;
  sourceFrench?: string;
  sourceChinese?: string;
}

const HIGH_FREQUENCY_WORDS = new Set([
  "big", "small", "red", "blue", "hot", "cold", "day", "time", "one", "two", "three", "four", "five",
  "go", "come", "look", "listen", "read", "write", "open", "close", "give", "take", "make", "find", "sit", "stand",
  "want", "need", "like", "know", "run", "jump", "play", "eat", "drink", "water", "school", "book", "home", "mom", "dad",
]);

const QUESTION_START = /^(what|where|who|how|why|when|can|do|does|is|are|will|would|could|should)\b/i;
const SPELLING_PATTERN = /(sh|ch|th|ph|wh|ck|ng|ee|oo|ea|ai|ay|oa|ou|ow|oi|oy|ar|er|ir|or|ur|tion|ing|ed|ll|ss|tt|pp|rr)/i;
const ENGLISH_WORD = /^[a-z]+$/i;
const BOPOMOFO_BASE = /[\u3105-\u312f]/;


const LEGACY_TO_GRANULAR: Record<string, GranularLanguageSkillId> = {
  "language.word_copy": "language.word_build.simple",
  "language.word_recall": "language.picture_vocabulary.basic",
  "language.word_translation": "language.word_translation.basic",
  "language.sentence_recall": "language.sentence_patterns.simple",
  "language.bopomofo": "language.bopomofo.word_build",
};

const GRANULAR_TO_LEGACY: Partial<Record<GranularLanguageSkillId, string>> = {
  "language.word_build.simple": "language.word_copy",
  "language.picture_vocabulary.basic": "language.word_recall",
  "language.word_translation.basic": "language.word_translation",
  "language.sentence_patterns.simple": "language.sentence_recall",
  "language.bopomofo.word_build": "language.bopomofo",
};

const MODE_BY_SKILL: Record<GranularLanguageSkillId, VocabularyMode> = {
  "language.initial_sound": "copy",
  "language.word_build.simple": "copy",
  "language.picture_vocabulary.basic": "recall",
  "language.high_frequency.recall": "recall",
  "language.spelling_patterns.basic": "recall",
  "language.word_translation.basic": "translate",
  "language.sentence_patterns.simple": "sentences",
  "language.sentence_patterns.questions": "sentences",
  "language.bopomofo.sound_symbol": "bopomofo",
  "language.bopomofo.word_build": "bopomofo",
};

export function isGranularLanguageSkillId(value: unknown): value is GranularLanguageSkillId {
  return typeof value === "string" && (GRANULAR_LANGUAGE_SKILL_IDS as readonly string[]).includes(value);
}

export function vocabularyModeForLanguageSkill(skill: string): VocabularyMode | null {
  return isGranularLanguageSkillId(skill) ? MODE_BY_SKILL[skill] : null;
}

export function granularLanguageSkillForLegacy(skill: string): GranularLanguageSkillId | null {
  return LEGACY_TO_GRANULAR[skill] ?? null;
}

export function legacyLanguageSkillForGranular(skill: string): string | null {
  return isGranularLanguageSkillId(skill) ? GRANULAR_TO_LEGACY[skill] ?? null : null;
}

function normalizeEnglish(value: string): string {
  return String(value || "").trim().toLocaleLowerCase();
}

function wordCount(value: string): number {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

function firstEnglishLetter(value: string): string {
  const hit = normalizeEnglish(value).match(/[a-z]/);
  return hit?.[0] ?? normalizeEnglish(value).slice(0, 1);
}

function firstBopomofoSymbol(value: string): string {
  return [...String(value || "")].find((char) => BOPOMOFO_BASE.test(char)) ?? String(value || "").slice(0, 1);
}

export function languageEntryMatchesSkill(skill: string, entry: LanguageEntryShape): boolean {
  if (!isGranularLanguageSkillId(skill)) return false;
  if (MODE_BY_SKILL[skill] !== entry.mode) return false;
  const target = normalizeEnglish(entry.target);
  switch (skill) {
    case "language.initial_sound":
      return ENGLISH_WORD.test(target) && target.length >= 2 && target.length <= 6 && Boolean(entry.emoji);
    case "language.word_build.simple":
      return ENGLISH_WORD.test(target) && target.length >= 2 && target.length <= 5;
    case "language.picture_vocabulary.basic":
      return ENGLISH_WORD.test(target) && target.length >= 3 && target.length <= 8 && Boolean(entry.emoji);
    case "language.high_frequency.recall":
      return ENGLISH_WORD.test(target) && HIGH_FREQUENCY_WORDS.has(target);
    case "language.spelling_patterns.basic":
      return ENGLISH_WORD.test(target) && target.length >= 4 && target.length <= 12 && SPELLING_PATTERN.test(target);
    case "language.word_translation.basic":
      return ENGLISH_WORD.test(target) && Boolean(entry.sourceFrench || entry.sourceChinese);
    case "language.sentence_patterns.simple":
      return wordCount(entry.target) >= 2 && wordCount(entry.target) <= 5 && !QUESTION_START.test(String(entry.target).trim());
    case "language.sentence_patterns.questions":
      return wordCount(entry.target) >= 2 && wordCount(entry.target) <= 7 && QUESTION_START.test(String(entry.target).trim());
    case "language.bopomofo.sound_symbol":
    case "language.bopomofo.word_build":
      return BOPOMOFO_BASE.test(String(entry.target));
  }
}

export function directedVocabularyTarget(skill: string | undefined, target: string): string {
  if (skill === "language.initial_sound") return firstEnglishLetter(target);
  if (skill === "language.bopomofo.sound_symbol") return firstBopomofoSymbol(target);
  return target;
}

export function classifyGranularLanguageSkill(entry: LanguageEntryShape, requestedSkill?: string): GranularLanguageSkillId {
  if (requestedSkill && isGranularLanguageSkillId(requestedSkill) && languageEntryMatchesSkill(requestedSkill, entry)) {
    return requestedSkill;
  }
  const target = normalizeEnglish(entry.target);
  if (entry.mode === "copy") {
    return target.length <= 1 ? "language.initial_sound" : "language.word_build.simple";
  }
  if (entry.mode === "recall") {
    if (HIGH_FREQUENCY_WORDS.has(target)) return "language.high_frequency.recall";
    if (SPELLING_PATTERN.test(target)) return "language.spelling_patterns.basic";
    return "language.picture_vocabulary.basic";
  }
  if (entry.mode === "translate") return "language.word_translation.basic";
  if (entry.mode === "sentences") return QUESTION_START.test(String(entry.target).trim())
    ? "language.sentence_patterns.questions"
    : "language.sentence_patterns.simple";
  return [...String(entry.target || "")].filter((char) => BOPOMOFO_BASE.test(char)).length <= 1
    ? "language.bopomofo.sound_symbol"
    : "language.bopomofo.word_build";
}

export function languageSkillDisplayName(skill: string): string {
  const labels: Partial<Record<GranularLanguageSkillId, string>> = {
    "language.initial_sound": "Initial sound",
    "language.word_build.simple": "Build words",
    "language.picture_vocabulary.basic": "Picture words",
    "language.high_frequency.recall": "Everyday words",
    "language.spelling_patterns.basic": "Spelling patterns",
    "language.word_translation.basic": "Meaning links",
    "language.sentence_patterns.simple": "Sentence patterns",
    "language.sentence_patterns.questions": "Everyday questions",
    "language.bopomofo.sound_symbol": "Zhuyin sounds",
    "language.bopomofo.word_build": "Zhuyin words",
  };
  return isGranularLanguageSkillId(skill) ? labels[skill] ?? "Language" : "Language";
}
