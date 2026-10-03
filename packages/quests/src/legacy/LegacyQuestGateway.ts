import { taipeiClock } from "../../../core/src/time.js";
import type { LocalizedText } from "../../../core/src/localization.js";
import type { QuestCardModel, QuestGateway, QuestQuery } from "../QuestGateway.js";

interface LegacyQuest {
  id: string;
  icon?: string;
  title?: string[];
  blurb?: string[];
  category?: string;
  duration?: number;
  energy?: string;
  rewardStars?: number;
  required?: boolean;
  steps?: string[][];
}

interface LegacyGlobals {
  SQQuestData?: { all(): LegacyQuest[]; byId(id: string): LegacyQuest | null };
  SQQuestConfig?: { catalog(source?: unknown): LegacyQuest[] };
  SQQuestCore?: { listAvailable(catalog: LegacyQuest[], context: Record<string, unknown>): LegacyQuest[] };
  SyncStore?: { familySettings?: unknown };
}

function pair(value: string[] | undefined, fallback: LocalizedText): LocalizedText {
  return [String(value?.[0] || fallback[0]), String(value?.[1] || fallback[1])];
}

function toModel(quest: LegacyQuest): QuestCardModel {
  return {
    id: quest.id,
    icon: String(quest.icon || "✨"),
    title: pair(quest.title, ["Quest", "任務"]),
    blurb: pair(quest.blurb, ["Summer Quest activity", "Summer Quest 活動"]),
    category: String(quest.category || "help"),
    duration: Math.max(1, Number(quest.duration) || 10),
    energy: String(quest.energy || "medium"),
    rewardStars: Math.max(0, Number(quest.rewardStars) || 0),
    required: Boolean(quest.required),
    steps: Array.isArray(quest.steps)
      ? quest.steps.map((step) => pair(step, ["Next step", "下一步"]))
      : [],
  };
}

export class LegacyQuestGateway implements QuestGateway {
  listAvailable(query: QuestQuery): QuestCardModel[] {
    const globals = globalThis as unknown as LegacyGlobals;
    const fallback = globals.SQQuestData?.all() || [];
    const catalog = globals.SQQuestConfig?.catalog(globals.SyncStore?.familySettings) || fallback;
    const clock = taipeiClock(query.now);
    const context = {
      kid: query.kidId,
      age: query.age,
      day: clock.day,
      minutes: clock.minutes,
      energy: query.energy || "any",
      preference: query.preference || "surprise",
      completed: query.completed || [],
      waiting: query.waiting || [],
      recent: query.recent || [],
      inProgress: query.inProgress || [],
      redo: query.redo || [],
    };
    const available = globals.SQQuestCore?.listAvailable(catalog, context) || catalog;
    return available.map(toModel);
  }

  getById(id: string, query: QuestQuery): QuestCardModel | null {
    return this.listAvailable(query).find((quest) => quest.id === id) || null;
  }
}
