(function init(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeNativeVisibility = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createNativeVisibility() {
  const PROTECTED = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'META']);
  function createGuard(doc = document) {
    let records = [];
    let hidden = false;
    let protectedRoot = null;
    let observer = null;

    function shouldIgnore(node) {
      return !node || node.nodeType !== 1 || node === protectedRoot || PROTECTED.has(node.tagName) || node.id === 'bilitube-watch-layer';
    }
    function recordAndHide(node) {
      if (shouldIgnore(node) || node.dataset.bilitubeCoreHidden === '1') return;
      records.push({
        node,
        display: node.style.getPropertyValue('display'),
        displayPriority: node.style.getPropertyPriority('display'),
        visibility: node.style.getPropertyValue('visibility'),
        visibilityPriority: node.style.getPropertyPriority('visibility'),
        aria: node.getAttribute('aria-hidden'),
        hadAria: node.hasAttribute('aria-hidden'),
      });
      node.style.setProperty('display', 'none', 'important');
      node.style.setProperty('visibility', 'hidden', 'important');
      node.setAttribute('aria-hidden', 'true');
      node.dataset.bilitubeCoreHidden = '1';
    }
    function hide(rootNode) {
      if (hidden || !doc.body) return;
      records = [];
      protectedRoot = rootNode || null;
      for (const child of Array.from(doc.body.children)) recordAndHide(child);
      hidden = true;
      if (typeof MutationObserver !== 'undefined') {
        observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const node of Array.from(mutation.addedNodes || [])) recordAndHide(node);
          }
        });
        observer.observe(doc.body, { childList: true });
      }
    }
    function restore() {
      if (observer) observer.disconnect();
      observer = null;
      for (const item of records) {
        const node = item.node;
        if (!node || !node.style) continue;
        if (item.display) node.style.setProperty('display', item.display, item.displayPriority || '');
        else node.style.removeProperty('display');
        if (item.visibility) node.style.setProperty('visibility', item.visibility, item.visibilityPriority || '');
        else node.style.removeProperty('visibility');
        if (item.hadAria) node.setAttribute('aria-hidden', item.aria == null ? '' : item.aria);
        else node.removeAttribute('aria-hidden');
        delete node.dataset.bilitubeCoreHidden;
      }
      records = [];
      protectedRoot = null;
      hidden = false;
    }
    return { hide, restore, isHidden: () => hidden };
  }
  return { createGuard };
});
