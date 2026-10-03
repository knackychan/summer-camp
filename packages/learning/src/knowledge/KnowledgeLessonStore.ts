import type { StorageDriver } from "../../../storage/src/StorageDriver.js";
import type { KnowledgeLessonSession } from "./KnowledgeLessonRuntime.js";

const PREFIX = "sq:learning:knowledge:v1:";

export class KnowledgeLessonStore {
  constructor(private readonly storage: StorageDriver) {}

  private key(learnerId: string): string { return `${PREFIX}${learnerId}`; }

  load(learnerId: string): Promise<KnowledgeLessonSession | null> {
    return this.storage.get<KnowledgeLessonSession>(this.key(learnerId));
  }

  save(session: KnowledgeLessonSession): Promise<void> {
    return this.storage.set(this.key(session.learnerId), session);
  }

  remove(learnerId: string): Promise<void> {
    return this.storage.remove(this.key(learnerId));
  }
}
