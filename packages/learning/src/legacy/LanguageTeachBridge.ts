import type { StorageDriver } from "../../../storage/src/StorageDriver.js";
import { LearnerProfileStore } from "../LearnerProfileStore.js";
import { isCurriculumSkillId } from "../curriculum/SkillCatalog.js";
import { LanguageTeachService, type LanguageTeachAgentClient, type LanguageTeachResult } from "../teach/LanguageTeachService.js";

export interface LanguageTeachBridgeInput {
  kidId: string;
  age: number;
  language?: string;
  skill: string;
  profileId?: string;
}

export class LanguageTeachBridge {
  private readonly profiles: LearnerProfileStore;
  private readonly service: LanguageTeachService;
  private readonly localService = new LanguageTeachService();

  constructor(storage: StorageDriver, client?: LanguageTeachAgentClient) {
    this.profiles = new LearnerProfileStore(storage);
    this.service = new LanguageTeachService(client);
  }

  private async learner(input: LanguageTeachBridgeInput) {
    return this.profiles.load(input.kidId, {
      age: input.age,
      language: input.language?.trim() || "en-zh-TW",
      levels: { math: 1, language: 1, logic: 1, science: 1, geography: 1, history: 1 },
    });
  }

  async localScene(input: LanguageTeachBridgeInput): Promise<LanguageTeachResult | null> {
    if (!isCurriculumSkillId(input.skill) || !input.skill.startsWith("language.")) return null;
    const learner = await this.learner(input);
    return this.localService.getScene({ learner, skill: input.skill });
  }

  async getScene(input: LanguageTeachBridgeInput): Promise<LanguageTeachResult | null> {
    if (!isCurriculumSkillId(input.skill) || !input.skill.startsWith("language.")) return null;
    const learner = await this.learner(input);
    return this.service.getScene({
      learner,
      skill: input.skill,
      ...(input.profileId ? { profileId: input.profileId } : {}),
    });
  }
}
