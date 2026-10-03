import type { StorageDriver } from "../../../storage/src/StorageDriver.js";
import type { PlacementCalibrationState } from "./PlacementCalibration.js";

const PREFIX = "sq:learning:placement:v3:";

export class PlacementCalibrationStore {
  constructor(private readonly storage: StorageDriver) {}

  private key(learnerId: string): string {
    return `${PREFIX}${learnerId}`;
  }

  async load(learnerId: string): Promise<PlacementCalibrationState | null> {
    const value = await this.storage.get<PlacementCalibrationState>(this.key(learnerId));
    if (!value || value.version !== 3 || value.learnerId !== learnerId) return null;
    return value;
  }

  save(state: PlacementCalibrationState): Promise<void> {
    return this.storage.set(this.key(state.learnerId), state);
  }

  remove(learnerId: string): Promise<void> {
    return this.storage.remove(this.key(learnerId));
  }
}
