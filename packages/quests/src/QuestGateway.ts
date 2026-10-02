import type { LocalizedText } from "../../core/src/localization.js";

export type QuestEnergy = "low" | "medium" | "high" | "any";
export type QuestPreference = "quick" | "help" | "care" | "move" | "play" | "surprise";

export interface QuestCardModel {
  id: string;
  icon: string;
  title: LocalizedText;
  blurb: LocalizedText;
  category: string;
  duration: number;
  energy: string;
  rewardStars: number;
  required: boolean;
  steps: LocalizedText[];
}

export interface QuestQuery {
  kidId: string;
  age: number;
  energy?: QuestEnergy;
  preference?: QuestPreference;
  completed?: string[];
  waiting?: string[];
  recent?: string[];
  inProgress?: string[];
  redo?: string[];
  now?: Date;
}

export interface QuestGateway {
  listAvailable(query: QuestQuery): QuestCardModel[];
  getById(id: string, query: QuestQuery): QuestCardModel | null;
}
