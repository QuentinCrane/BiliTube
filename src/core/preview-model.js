(function init(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubePreviewModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPreviewModel() {
  function seekTime(clientX, left, width, duration) {
    const safeWidth = Math.max(0, Number(width) || 0);
    const safeDuration = Math.max(0, Number(duration) || 0);
    if (!safeWidth || !safeDuration) return 0;
    const ratio = Math.max(0, Math.min(1, (Number(clientX) - Number(left || 0)) / safeWidth));
    return ratio * safeDuration;
  }
  function initialState() { return { activeId: null }; }
  function reduce(state, action) {
    const current = state || initialState();
    if (!action || !action.type) return current;
    if (action.type === 'request') return { activeId: action.id || null };
    if (action.type === 'cancel' && current.activeId === action.id) return { activeId: null };
    if (action.type === 'reset') return { activeId: null };
    return current;
  }
  return { seekTime, initialState, reduce };
});
