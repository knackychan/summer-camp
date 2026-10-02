import type { StorageDriver } from "../../../storage/src/StorageDriver.js";
import { LearnerProfileStore } from "../LearnerProfileStore.js";
import { isCurriculumSkillId } from "../curriculum/SkillCatalog.js";
import { MathTeachService, type MathTeachAgentClient, type MathTeachResult } from "../teach/MathTeachService.js";

export interface MathTeachBridgeInput {
  kidId: string;
  age: number;
  language?: string;
  skill: string;
  profileId?: string;
}

export class MathTeachBridge {
  private readonly profiles: LearnerProfileStore;
  private readonly service: MathTeachService;
  private readonly localService = new MathTeachService();

  constructor(storage: StorageDriver, client?: MathTeachAgentClient) {
    this.profiles = new LearnerProfileStore(storage);
    this.service = new MathTeachService(client);
  }

  private async learner(input: MathTeachBridgeInput) {
    return this.profiles.load(input.kidId, {
      age: input.age,
      language: input.language?.trim() || "en-zh-TW",
      levels: { math: 1, language: 1, logic: 1, science: 1, geography: 1, history: 1 },
    });
  }

  async localScene(input: MathTeachBridgeInput): Promise<MathTeachResult | null> {
    if (!isCurriculumSkillId(input.skill) || !input.skill.startsWith("math.")) return null;
    const learner = await this.learner(input);
    return this.localService.getScene({ learner, skill: input.skill });
  }

  async getScene(input: MathTeachBridgeInput): Promise<MathTeachResult | null> {
    if (!isCurriculumSkillId(input.skill) || !input.skill.startsWith("math.")) return null;
    const learner = await this.learner(input);
    return this.service.getScene({
      learner,
      skill: input.skill,
      ...(input.profileId ? { profileId: input.profileId } : {}),
    });
  }
}
