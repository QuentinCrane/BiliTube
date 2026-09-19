(function init(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeTheme = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createTheme() {
  function resolve(preference, systemDark) {
    if (preference === 'dark') return 'dark';
    if (preference === 'light') return 'light';
    return systemDark ? 'dark' : 'light';
  }
  function nextExplicit(currentResolved) { return currentResolved === 'dark' ? 'light' : 'dark'; }
  return { resolve, nextExplicit };
});
