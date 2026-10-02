import { getGeographyLesson, listGeographyLessons } from "./GeographyLessonCatalog.js";
import { getScienceLesson, listScienceLessons } from "./ScienceLessonCatalog.js";
import { getHistoryLesson, listHistoryLessons } from "./HistoryLessonCatalog.js";

export type KnowledgeLessonDomain = "science" | "geography" | "history";
export type KnowledgeLessonVisualKind =
  | "classify"
  | "sequence"
  | "system"
  | "states"
  | "cycle"
  | "orbit"
  | "compass"
  | "map"
  | "land_water"
  | "globe"
  | "environment"
  | "past_present"
  | "sequence"
  | "sources"
  | "timeline"
  | "civilization"
  | "change";

export interface KnowledgeLessonVisualItem {
  id: string;
  icon: string;
  label: string;
  labelZh: string;
  note: string;
  noteZh: string;
}

export interface KnowledgeLessonVisual {
  kind: KnowledgeLessonVisualKind;
  items: KnowledgeLessonVisualItem[];
}

export interface KnowledgeLessonFact {
  id: string;
  icon: string;
  text: string;
  textZh: string;
}

export interface KnowledgeQuestionOption {
  id: string;
  icon?: string;
  label: string;
  labelZh: string;
}

export interface KnowledgeLessonQuestion {
  id: string;
  prompt: string;
  promptZh: string;
  options: KnowledgeQuestionOption[];
  correctOptionId: string;
  explain: string;
  explainZh: string;
}

export interface KnowledgeLessonDefinition {
  id: string;
  domain: KnowledgeLessonDomain;
  topic: string;
  skill: string;
  minAge: number;
  difficulty: number;
  icon: string;
  title: string;
  titleZh: string;
  subtitle: string;
  subtitleZh: string;
  preReaderIntro: string;
  preReaderIntroZh: string;
  intro: string;
  introZh: string;
  visual: KnowledgeLessonVisual;
  facts: KnowledgeLessonFact[];
  questions: KnowledgeLessonQuestion[];
}

export function listKnowledgeLessons(domain: KnowledgeLessonDomain, age?: number): KnowledgeLessonDefinition[] {
  if (domain === "geography") return listGeographyLessons(age);
  if (domain === "history") return listHistoryLessons(age);
  return listScienceLessons(age);
}

export function getKnowledgeLesson(id: string): KnowledgeLessonDefinition | null {
  if (id.startsWith("geography-")) return getGeographyLesson(id);
  if (id.startsWith("history-")) return getHistoryLesson(id);
  if (id.startsWith("science-")) return getScienceLesson(id);
  return getScienceLesson(id) ?? getGeographyLesson(id) ?? getHistoryLesson(id);
}
