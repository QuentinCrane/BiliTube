(function init(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeCache = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCacheModule() {
  function createCache(nowFn = () => Date.now(), maxEntries = 256) {
    const values = new Map();
    const inflight = new Map();
    const limit = Math.max(1, Number(maxEntries) || 256);
    let generation = 0;
    function set(key, value, ttl = 0) {
      for (const [id, entry] of values) if (entry.expiresAt <= nowFn()) values.delete(id);
      values.delete(key);
      values.set(key, { value, expiresAt: ttl > 0 ? nowFn() + ttl : Infinity });
      while (values.size > limit) values.delete(values.keys().next().value);
      return value;
    }
    function get(key) {
      const entry = values.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= nowFn()) {
        values.delete(key);
        return undefined;
      }
      values.delete(key); values.set(key, entry);
      return entry.value;
    }
    async function remember(key, ttl, loader) {
      const cached = get(key);
      if (cached !== undefined) return cached;
      if (inflight.has(key)) return inflight.get(key);
      const requestGeneration = generation;
      const task = Promise.resolve().then(loader).then((value) => {
        if (requestGeneration === generation) set(key, value, ttl);
        return value;
      }).finally(() => { if (inflight.get(key) === task) inflight.delete(key); });
      inflight.set(key, task);
      return task;
    }
    function clear() { generation += 1; values.clear(); inflight.clear(); }
    return { get, set, remember, clear };
  }
  return { createCache };
});
