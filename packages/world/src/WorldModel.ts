import type { ActivityRegistry } from "../../activities/src/ActivityRegistry.js";
import type { InteractionProfile } from "../../core/src/interaction-profile.js";
import type { LocalizedText } from "../../core/src/localization.js";
import type { QuestCardModel, QuestGateway } from "../../quests/src/QuestGateway.js";

export type WorldZoneId = "daily" | "brain" | "garden" | "play";

export interface WorldZoneDefinition {
  id: WorldZoneId;
  icon: string;
  label: LocalizedText;
  description: LocalizedText;
  questCategories: string[];
  questIds?: string[];
  excludeQuestIds?: string[];
  activityCapabilities: string[];
}

export interface WorldZoneState extends WorldZoneDefinition {
  questCount: number;
  requiredCount: number;
  activityCount: number;
  attention: "required" | "available" | "quiet";
}

export interface WorldSnapshot {
  zones: WorldZoneState[];
  availableQuests: QuestCardModel[];
}

export const WORLD_ZONES: readonly WorldZoneDefinition[] = Object.freeze([
  {
    id: "daily",
    icon: "🏠",
    label: ["Daily Life", "生活任務"],
    description: ["Home help and everyday routines", "家事幫忙和每天的生活任務"],
    questCategories: ["care", "help"],
    excludeQuestIds: ["plant_patrol"],
    activityCapabilities: [],
  },
  {
    id: "brain",
    icon: "🧠",
    label: ["Brain Island", "頭腦島"],
    description: ["Learning, books and brain challenges", "學習、閱讀和頭腦挑戰"],
    questCategories: ["learn"],
    activityCapabilities: ["learning", "books", "brain"],
  },
  {
    id: "garden",
    icon: "🌱",
    label: ["Science Garden", "科學花園"],
    description: ["Plants, nature and discoveries", "植物、自然和小發現"],
    questCategories: [],
    questIds: ["plant_patrol"],
    activityCapabilities: ["science", "nature"],
  },
  {
    id: "play",
    icon: "🎮",
    label: ["Play Park", "遊戲樂園"],
    description: ["Games, movement, music and creative play", "遊戲、運動、音樂和創作"],
    questCategories: ["play", "move"],
    activityCapabilities: ["play", "music", "creative"],
  },
]);

export interface BuildWorldSnapshotOptions {
  kidId: string;
  age: number;
  profile: InteractionProfile;
  quests: QuestGateway;
  activities: ActivityRegistry;
}

export function buildWorldSnapshot(options: BuildWorldSnapshotOptions): WorldSnapshot {
  const availableQuests = options.quests.listAvailable({
    kidId: options.kidId,
    age: options.age,
    energy: "any",
    preference: "surprise",
  });
  const activities = options.activities.listForAgeBand(options.profile.readingLevel);

  const zones = WORLD_ZONES.map((zone) => {
    const zoneQuests = availableQuests.filter((quest) => {
      if (zone.excludeQuestIds?.includes(quest.id)) return false;
      if (zone.questIds?.includes(quest.id)) return true;
      return zone.questCategories.includes(quest.category);
    });
    const zoneActivities = activities.filter((activity) =>
      zone.activityCapabilities.some((capability) => activity.capabilities.includes(capability)),
    );
    const requiredCount = zoneQuests.filter((quest) => quest.required).length;
    return {
      ...zone,
      questCount: zoneQuests.length,
      requiredCount,
      activityCount: zoneActivities.length,
      attention: requiredCount > 0 ? "required" as const : zoneQuests.length + zoneActivities.length > 0 ? "available" as const : "quiet" as const,
    };
  });

  return { zones, availableQuests };
}

export function getWorldZone(id: string): WorldZoneDefinition | null {
  return WORLD_ZONES.find((zone) => zone.id === id) || null;
}
