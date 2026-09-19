(function init(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeCache = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCacheModule() {
  function createCache(nowFn = () => Date.now()) {
    const values = new Map();
    const inflight = new Map();
    function set(key, value, ttl = 0) {
      values.set(key, { value, expiresAt: ttl > 0 ? nowFn() + ttl : Infinity });
      return value;
    }
    function get(key) {
      const entry = values.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt < nowFn()) {
        values.delete(key);
        return undefined;
      }
      return entry.value;
    }
    async function remember(key, ttl, loader) {
      const cached = get(key);
      if (cached !== undefined) return cached;
      if (inflight.has(key)) return inflight.get(key);
      const task = Promise.resolve().then(loader).then((value) => {
        set(key, value, ttl);
        return value;
      }).finally(() => inflight.delete(key));
      inflight.set(key, task);
      return task;
    }
    function clear() { values.clear(); inflight.clear(); }
    return { get, set, remember, clear };
  }
  return { createCache };
});
