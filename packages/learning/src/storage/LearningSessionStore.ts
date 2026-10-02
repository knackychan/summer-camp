import type { StorageDriver } from "../../../storage/src/StorageDriver.js";
import type { LearningSessionState } from "../types.js";

const PREFIX = "sq:learning:session:v1:";

export class LearningSessionStore {
  constructor(private readonly storage: StorageDriver) {}

  async load(sessionId: string): Promise<LearningSessionState | null> {
    return this.storage.get<LearningSessionState>(`${PREFIX}${sessionId}`);
  }

  async save(session: LearningSessionState): Promise<void> {
    await this.storage.set(`${PREFIX}${session.id}`, session);
  }

  async remove(sessionId: string): Promise<void> {
    await this.storage.remove(`${PREFIX}${sessionId}`);
  }
}
