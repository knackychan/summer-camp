
const VERSION = 1;

function safeParse(raw) {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function initialState() {
  return {
    version: VERSION,
    completedModels: {},
    lastModelId: null,
    lastStepIndex: 0,
    paperColorId: "sakura",
    slow: false,
    updatedAt: null
  };
}

export function createOrigamiProgressStore({ profileId = "kid", storage = null } = {}) {
  const backend = storage || window.localStorage;
  const key = `sq:origami-atelier:v1:${String(profileId || "kid")}`;

  function load() {
    const parsed = safeParse(backend?.getItem?.(key));
    if (!parsed || parsed.version !== VERSION) return initialState();
    return { ...initialState(), ...parsed };
  }

  function save(next) {
    const value = { ...initialState(), ...next, version: VERSION, updatedAt: new Date().toISOString() };
    backend?.setItem?.(key, JSON.stringify(value));
    return value;
  }

  function patch(partial) {
    return save({ ...load(), ...partial });
  }

  function markComplete(modelId) {
    const current = load();
    const previous = current.completedModels?.[modelId] || { count: 0 };
    return save({
      ...current,
      completedModels: {
        ...current.completedModels,
        [modelId]: {
          count: Number(previous.count || 0) + 1,
          lastCompletedAt: new Date().toISOString()
        }
      },
      lastModelId: null,
      lastStepIndex: 0
    });
  }

  function clearResume() {
    const current = load();
    return save({ ...current, lastModelId: null, lastStepIndex: 0 });
  }

  function reset() {
    backend?.removeItem?.(key);
    return initialState();
  }

  return { key, load, save, patch, markComplete, clearResume, reset };
}
