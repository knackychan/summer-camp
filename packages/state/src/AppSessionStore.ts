import type { InteractionProfile } from "../../core/src/interaction-profile.js";
import { READER_PROFILE } from "../../core/src/interaction-profile.js";
import type { StorageDriver } from "../../storage/src/StorageDriver.js";

export interface AppSession {
  kidId: string;
  age: number;
  interactionProfile: InteractionProfile;
}

const KEY = "sq:mobile:session:v1";

export class AppSessionStore {
  constructor(private readonly storage: StorageDriver) {}

  async load(fallback: Partial<AppSession> = {}): Promise<AppSession> {
    const saved = await this.storage.get<AppSession>(KEY);
    return {
      kidId: saved?.kidId || fallback.kidId || "kid",
      age: Number(saved?.age || fallback.age || 8),
      interactionProfile: saved?.interactionProfile || fallback.interactionProfile || READER_PROFILE,
    };
  }

  async save(session: AppSession): Promise<void> {
    await this.storage.set(KEY, session);
  }
}
