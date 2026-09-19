(function init(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeApiClient = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createApiClient() {
  function request(type, params = {}) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ source:'bilitube-api', type, params }, (response) => {
          if (chrome.runtime.lastError) return resolve(null);
          resolve(response && response.ok ? response.data : null);
        });
      } catch { resolve(null); }
    });
  }
  return { request };
});
