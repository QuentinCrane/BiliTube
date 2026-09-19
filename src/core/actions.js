(function init(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeActions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createActions() {
  const selectors = {
    like: [
      '.video-toolbar-container .video-like',
      '.video-toolbar .like',
      '.tool-bar .like-info',
      '.video-toolbar-v1 .like',
      '.toolbar .like',
    ],
    coin: [
      '.video-toolbar-container .video-coin',
      '.video-toolbar .coin',
      '.tool-bar .coin-info',
      '.video-toolbar-module .coin-box',
      '.video-toolbar-v1 .coin',
      '.toolbar .coin',
    ],
    favorite: [
      '.video-toolbar-container .video-fav',
      '.video-toolbar .collect',
      '.video-toolbar-module .fav-box',
      '.video-toolbar-v1 .collect',
      '.toolbar .collect',
    ],
    share: [
      '.video-toolbar-container .video-share',
      '.video-toolbar .share',
      '.video-toolbar-v1 .share',
      '.toolbar .share',
    ],
    follow: [
      '.up-info-container .follow-btn',
      '.upinfo-btn-panel .follow-btn',
      '.up-panel-container .follow-btn',
      '.bili-follow-btn',
      '.subscribe-button',
      'button[class*="follow"]',
    ],
    charge: [
      '.video-toolbar-container .video-charge',
      '.up-info-container .charge-btn',
      '.charge-btn',
      'button[class*="charge"]',
    ],
    triple: [
      '.video-toolbar-container [class*="triple"]',
      '.video-toolbar [class*="triple"]',
      '[class*="three-click"]',
    ],
  };
  const textPatterns = {
    like: [/^点赞/, /点赞$/], coin: [/投币/], favorite: [/收藏/], share: [/分享/],
    follow: [/关注/, /已关注/], charge: [/充电/], triple: [/三连/, /一键三连/],
  };

  function isUsable(node) {
    if (!node || !node.isConnected || node.closest('#bilitube-watch-layer,.bt-watch-panel,.bt-watch-related')) return false;
    if ('disabled' in node && node.disabled) return false;
    return true;
  }

  function findTarget(doc, action) {
    for (const selector of selectors[action] || []) {
      let nodes = [];
      try { nodes = Array.from(doc.querySelectorAll(selector)); } catch {}
      const found = nodes.find(isUsable);
      if (found) return found;
    }
    const patterns = textPatterns[action] || [];
    if (!patterns.length) return null;
    const nodes = Array.from(doc.querySelectorAll('button, a, [role="button"], span'));
    return nodes.find((node) => isUsable(node) && patterns.some((rx) => rx.test(String(node.textContent || '').trim()))) || null;
  }

  function dispatchMouse(doc, target, type, extra = {}) {
    const ViewMouseEvent = doc.defaultView && doc.defaultView.MouseEvent || (typeof MouseEvent === 'function' ? MouseEvent : null);
    if (!ViewMouseEvent || !target || typeof target.dispatchEvent !== 'function') return false;
    try {
      const pressed = type === 'mousedown';
      target.dispatchEvent(new ViewMouseEvent(type, {
        bubbles:true, cancelable:true, composed:true, view:doc.defaultView || null,
        button:0, buttons:pressed ? 1 : 0, clientX:1, clientY:1, ...extra,
      }));
      return true;
    } catch { return false; }
  }

  function simulateClick(doc, target) {
    if (!isUsable(target)) return false;
    dispatchMouse(doc,target,'mousedown');
    dispatchMouse(doc,target,'mouseup');
    const dispatched = dispatchMouse(doc,target,'click');
    if (!dispatched && typeof target.click === 'function') {
      try { target.click(); return true; } catch {}
    }
    return dispatched;
  }

  function simulateTriple(doc, explicitTarget) {
    const target = explicitTarget || findTarget(doc,'like');
    if (!isUsable(target)) return false;
    dispatchMouse(doc,target,'mousedown');
    setTimeout(() => {
      if (!target.isConnected) return;
      dispatchMouse(doc,target,'mouseup');
    }, 900);
    return true;
  }

  function invoke(doc, action) {
    const target = findTarget(doc, action);
    if (action === 'triple') return target ? simulateClick(doc,target) : simulateTriple(doc,null);
    if (!target) return false;
    return simulateClick(doc,target);
  }

  function isFollowing(doc) {
    const target = findTarget(doc, 'follow');
    if (!target) return false;
    const cls = String(target.className || '');
    const text = String(target.textContent || '').trim();
    return /following|followed|is-follow|following-btn/i.test(cls) || /已关注|取消关注/.test(text);
  }
  return { findTarget, invoke, isFollowing, simulateClick };
});
