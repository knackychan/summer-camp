import type { StorageDriver } from "../../../storage/src/StorageDriver.js";
import type { LearningDirectorPlan } from "./LearningDirector.js";

const PREFIX = "sq:learning:director:v1:";

export class LearningDirectorStore {
  constructor(private readonly storage: StorageDriver) {}

  private key(learnerId: string, day: string): string {
    return `${PREFIX}${learnerId}:${day}`;
  }

  load(learnerId: string, day: string): Promise<LearningDirectorPlan | null> {
    return this.storage.get<LearningDirectorPlan>(this.key(learnerId, day));
  }

  save(plan: LearningDirectorPlan): Promise<void> {
    return this.storage.set(this.key(plan.learnerId, plan.day), plan);
  }

  remove(learnerId: string, day: string): Promise<void> {
    return this.storage.remove(this.key(learnerId, day));
  }
}
