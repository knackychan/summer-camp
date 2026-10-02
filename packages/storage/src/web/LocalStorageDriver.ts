import type { StorageDriver } from "../StorageDriver.js";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class LocalStorageDriver implements StorageDriver {
  constructor(private readonly storage: StorageLike = window.localStorage) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = this.storage.getItem(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.storage.setItem(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    this.storage.removeItem(key);
  }
}
