(function init(root, factory) {
  const ui = root && root.BiliTubeUI || (typeof require === 'function' ? require('./ui.js') : null);
  const api = factory(ui);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeNativeAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createNativeAdapterModule(UI) {
  const HEADER_SELECTORS = ['.bili-header', '#biliMainHeader', '.mini-header', '.international-header', '.bili-header-v2'];
  function createAdapter(doc = document) {
    let layer = null;
    let drawer = null;
    let observer = null;
    let currentData = {};
    let currentCallbacks = {};
    const hidden = new Map();
    function hideHeader(node) {
      if (!node || hidden.has(node)) return;
      hidden.set(node, node.getAttribute('style'));
      node.style.setProperty('display', 'none', 'important');
    }
    function scan() { for (const selector of HEADER_SELECTORS) doc.querySelectorAll(selector).forEach(hideHeader); }
    function scanAdded(records) {
      for (const record of records || []) for (const node of record.addedNodes || []) {
        if (!node || node.nodeType !== 1) continue;
        for (const selector of HEADER_SELECTORS) {
          if (node.matches && node.matches(selector)) hideHeader(node);
          if (node.querySelectorAll) node.querySelectorAll(selector).forEach(hideHeader);
        }
      }
    }
    function createChrome(theme = 'light') {
      layer = doc.createElement('div');
      layer.id = 'bilitube-native-layer';
      layer.dataset.btTheme = theme;
      layer.append(UI.createTopbar(currentData, currentCallbacks));
      drawer = UI.createSidebarDrawer(currentData, currentCallbacks);
      layer.append(drawer.backdrop);
      doc.body.append(layer);
    }
    function mount(data = {}, callbacks = {}, theme = 'light', context = {}) {
      restore();
      currentData = data;
      currentCallbacks = callbacks;
      const html = doc.documentElement;
      html.classList.add('bt-native-adapted');
      html.dataset.btNativeRoute = context.route || 'native';
      html.dataset.btTheme = theme;
      createChrome(theme);
      scan();
      observer = new MutationObserver(scanAdded);
      observer.observe(doc.documentElement, { childList: true, subtree: true });
    }
    function updateChrome(data = {}, callbacks = currentCallbacks) {
      currentData = { ...currentData, ...data };
      currentCallbacks = callbacks || currentCallbacks;
      if (!layer) return;
      const wasOpen = drawer && drawer.isOpen();
      const old = layer.querySelector('[data-role="header"]');
      const next = UI.createTopbar(currentData, currentCallbacks);
      if (old) old.replaceWith(next); else layer.prepend(next);
      if (drawer) drawer.backdrop.remove();
      drawer = UI.createSidebarDrawer(currentData, currentCallbacks);
      layer.append(drawer.backdrop);
      if (wasOpen) drawer.toggle();
    }
    function toggleSidebar() { if (drawer) drawer.toggle(); }
    function closeSidebar() { if (drawer) drawer.close(); }
    function updateTheme(theme) {
      if (layer) layer.dataset.btTheme = theme;
      doc.documentElement.dataset.btTheme = theme;
    }
    function restore() {
      if (observer) observer.disconnect();
      observer = null;
      if (layer) layer.remove();
      layer = null;
      drawer = null;
      for (const [node, oldStyle] of hidden) {
        if (!node || !node.isConnected) continue;
        if (oldStyle == null) node.removeAttribute('style'); else node.setAttribute('style', oldStyle);
      }
      hidden.clear();
      doc.documentElement.classList.remove('bt-native-adapted');
      delete doc.documentElement.dataset.btNativeRoute;
    }
    return { mount, updateChrome, updateTheme, toggleSidebar, closeSidebar, restore };
  }
  return { createAdapter };
});
