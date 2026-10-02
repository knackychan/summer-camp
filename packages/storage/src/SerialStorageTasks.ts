import type { StorageDriver } from "./StorageDriver.js";

// Serialize read/modify/write operations sharing one storage driver in this app.
// This is not a cross-tab or distributed lock.
const queues = new WeakMap<StorageDriver, Map<string, Promise<unknown>>>();
export function serialStorageTask<T>(storage: StorageDriver, key: string, task: () => Promise<T>): Promise<T> {
  let queue = queues.get(storage);
  if (!queue) { queue = new Map(); queues.set(storage, queue); }
  const previous = queue.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  queue.set(key, next);
  const release = () => { if (queue!.get(key) === next) queue!.delete(key); };
  void next.then(release, release);
  return next;
}
