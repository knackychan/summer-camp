import type { ReadingLevel } from "../../core/src/interaction-profile.js";
import type { StorageDriver } from "../../storage/src/StorageDriver.js";
import type { LearnerProfile, LearningDomain } from "./types.js";

const VERSION = 1;
const DEFAULT_LEVEL = 1;
const DOMAINS: LearningDomain[] = ["math", "language", "logic", "science", "geography", "history"];
const READING_LEVELS = new Set<ReadingLevel>(["pre_reader", "early_reader", "reader"]);

function clampLevel(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.max(1, Math.min(10, n)) : DEFAULT_LEVEL;
}

function normalizeReadingLevel(value: unknown, age: number): ReadingLevel {
  if (typeof value === "string" && READING_LEVELS.has(value as ReadingLevel)) return value as ReadingLevel;
  if (age <= 4) return "pre_reader";
  if (age <= 7) return "early_reader";
  return "reader";
}

export function normalizeLearnerProfile(raw: Partial<LearnerProfile> & Pick<LearnerProfile, "kidId">): LearnerProfile {
  const ageRaw = Math.round(Number(raw.age));
  const age = Number.isFinite(ageRaw) ? Math.max(3, Math.min(17, ageRaw)) : 8;
  const levels = {} as Record<LearningDomain, number>;
  for (const domain of DOMAINS) levels[domain] = clampLevel(raw.levels?.[domain]);
  return {
    kidId: String(raw.kidId || "kid").trim() || "kid",
    age,
    language: typeof raw.language === "string" && raw.language.trim() ? raw.language.trim().slice(0, 12) : "en",
    readingLevel: normalizeReadingLevel(raw.readingLevel, age),
    levels,
  };
}

export class LearnerProfileStore {
  constructor(private readonly storage: StorageDriver) {}

  private key(kidId: string): string {
    return `sq:learning:learner:v${VERSION}:${kidId}`;
  }

  async load(kidId: string, fallback: Partial<LearnerProfile> = {}): Promise<LearnerProfile> {
    const saved = await this.storage.get<Partial<LearnerProfile>>(this.key(kidId));
    return normalizeLearnerProfile({ kidId, ...fallback, ...(saved || {}) });
  }

  async save(profile: LearnerProfile): Promise<void> {
    const normalized = normalizeLearnerProfile(profile);
    await this.storage.set(this.key(normalized.kidId), normalized);
  }
}
