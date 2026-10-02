export type ReadingLevel = "pre_reader" | "early_reader" | "reader";
export type TextDensity = "none" | "low" | "normal";

export interface InteractionProfile {
  readingLevel: ReadingLevel;
  textDensity: TextDensity;
  voiceGuidance: boolean;
  assistantDialogue: boolean;
  directExploration: boolean;
}

export const READER_PROFILE: InteractionProfile = Object.freeze({
  readingLevel: "reader",
  textDensity: "normal",
  voiceGuidance: false,
  assistantDialogue: true,
  directExploration: true,
});

export const PRE_READER_PROFILE: InteractionProfile = Object.freeze({
  readingLevel: "pre_reader",
  textDensity: "none",
  voiceGuidance: true,
  assistantDialogue: false,
  directExploration: true,
});

export function defaultInteractionProfileForAge(age: number): InteractionProfile {
  return Number.isFinite(age) && age <= 4 ? PRE_READER_PROFILE : READER_PROFILE;
}

export function resolveInteractionProfile(
  age: number,
  mode: string | null,
  saved?: InteractionProfile,
): InteractionProfile {
  if (mode === "pre_reader") return PRE_READER_PROFILE;
  if (mode === "reader") return READER_PROFILE;
  if (Number.isFinite(age) && age <= 4) return PRE_READER_PROFILE;
  return saved || defaultInteractionProfileForAge(age);
}
