(() => {
  'use strict';
  if (window.__bilitubeCoreBridgeInstalled) return;
  window.__bilitubeCoreBridgeInstalled = true;

  const SOURCE = 'bilitube-bridge-core';
  const CLIENT = 'bilitube-content-core';

  const post = (type, payload) => window.postMessage({ source: SOURCE, type, payload }, '*');

  function safeState() {
    const state = window.__INITIAL_STATE__ || {};
    const video = state.videoData || null;
    const user = state.loginInfo || state.navInfo || state.userInfo || null;
    return {
      href: location.href,
      title: document.title,
      user: user ? {
        mid: user.mid || user.uid || null,
        name: user.uname || user.name || '',
        face: user.face || user.avatar || '',
        isLogin: Boolean(user.isLogin || user.mid || user.uid),
      } : null,
      video: video ? {
        aid: video.aid || null,
        bvid: video.bvid || null,
        title: video.title || '',
        desc: video.desc || '',
        duration: video.duration || 0,
        owner: video.owner ? { mid: video.owner.mid || null, name: video.owner.name || '', face: video.owner.face || '' } : null,
        stat: video.stat ? {
          view: video.stat.view || 0, like: video.stat.like || 0, coin: video.stat.coin || 0,
          favorite: video.stat.favorite || 0, share: video.stat.share || 0,
        } : null,
      } : null,
    };
  }











  const MOVED_REACT_BRIDGE_SELECTOR = '[data-bt-react-bridge="true"]';
  const movedReactEvents = {
    pointerdown:['onPointerDownCapture','onPointerDown'],
    pointerup:['onPointerUpCapture','onPointerUp'],
    pointermove:['onPointerMoveCapture','onPointerMove'],
    pointerover:['onPointerEnterCapture','onPointerEnter'],
    pointerout:['onPointerLeaveCapture','onPointerLeave'],
    mousedown:['onMouseDownCapture','onMouseDown'],
    mouseup:['onMouseUpCapture','onMouseUp'],
    mousemove:['onMouseMoveCapture','onMouseMove'],
    mouseover:['onMouseEnterCapture','onMouseEnter'],
    mouseout:['onMouseLeaveCapture','onMouseLeave'],
    click:['onClickCapture','onClick'],
    dblclick:['onDoubleClickCapture','onDoubleClick'],
    contextmenu:['onContextMenuCapture','onContextMenu'],
    focusin:['onFocusCapture','onFocus'],
    focusout:['onBlurCapture','onBlur'],
  };

  function getPageReactProps(element) {
    if (!element || typeof element !== 'object') return null;
    const key = Object.keys(element).find(name => name.startsWith('__reactProps$') || name.startsWith('__reactEventHandlers$'));
    if (!key) return null;
    const props = element[key];
    return props && typeof props === 'object' ? props : null;
  }

  function movedReactEvent(nativeEvent, currentTarget, state) {
    return new Proxy(nativeEvent, {
      get(target, prop) {
        if (prop === 'nativeEvent') return nativeEvent;
        if (prop === 'currentTarget') return currentTarget;
        if (prop === 'isPropagationStopped') return () => state.stopped;
        if (prop === 'isDefaultPrevented') return () => nativeEvent.defaultPrevented;
        if (prop === 'persist') return () => {};
        if (prop === 'stopPropagation') return () => { state.stopped = true; nativeEvent.stopPropagation(); };
        if (prop === 'preventDefault') return () => nativeEvent.preventDefault();
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  function invokeMovedReactEvent(event, captureProp, bubbleProp) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const boundary = target.closest(MOVED_REACT_BRIDGE_SELECTOR);
    if (!boundary) return;
    const composed = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const path = [];
    if (composed.length) {
      for (const node of composed) {
        if (!(node instanceof Element)) continue;
        if (!boundary.contains(node) && node !== boundary) continue;
        path.push(node);
        if (node === boundary) break;
      }
    } else {
      let node = target;
      while (node instanceof Element) {
        path.push(node);
        if (node === boundary) break;
        node = node.parentElement;
      }
    }
    if (!path.includes(boundary)) path.push(boundary);
    const state = { stopped:false };
    for (const node of [...path].reverse()) {
      const handler = getPageReactProps(node)?.[captureProp];
      if (typeof handler === 'function') handler(movedReactEvent(event,node,state));
      if (state.stopped) return;
    }
    for (const node of path) {
      const handler = getPageReactProps(node)?.[bubbleProp];
      if (typeof handler === 'function') handler(movedReactEvent(event,node,state));
      if (state.stopped) return;
    }
  }

  function installMovedReactEventBridge() {
    for (const [eventName,[captureProp,bubbleProp]] of Object.entries(movedReactEvents)) {
      document.addEventListener(eventName, event => invokeMovedReactEvent(event,captureProp,bubbleProp));
    }
  }

  function observeSpaceArchive(rawUrl, payload) {
    try {
      const url = new URL(String(rawUrl || ''), location.href);
      if (url.pathname !== '/x/space/wbi/arc/search') return;
      const mid = String(url.searchParams.get('mid') || '').replace(/\D/g, '');
      if (mid && payload) post('space-archives', { mid, payload });
    } catch {}
  }

  function installNetworkObservation() {
    const nativeFetch = window.fetch;
    if (typeof nativeFetch === 'function') {
      window.fetch = async function bilitubeCoreObservedFetch(...args) {
        const response = await nativeFetch.apply(this, args);
        try {
          const input = args[0];
          const raw = typeof input === 'string' || input instanceof URL ? String(input) : input && input.url;
          if (raw && /\/x\/space\/wbi\/arc\/search(?:\?|$)/.test(raw)) {
            response.clone().json().then((payload) => observeSpaceArchive(raw, payload)).catch(() => {});
          }
        } catch {}
        return response;
      };
    }
    const xhr = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
    if (xhr && typeof xhr.open === 'function' && typeof xhr.send === 'function') {
      const open = xhr.open;
      const send = xhr.send;
      xhr.open = function coreOpen(method, url, ...rest) {
        this.__btCoreUrl = String(url || '');
        return open.call(this, method, url, ...rest);
      };
      xhr.send = function coreSend(...args) {
        const raw = this.__btCoreUrl || '';
        if (/\/x\/space\/wbi\/arc\/search(?:\?|$)/.test(raw)) {
          this.addEventListener('loadend', () => {
            try {
              const payload = this.responseType === 'json' ? this.response : JSON.parse(this.responseText || 'null');
              observeSpaceArchive(raw, payload);
            } catch {}
          }, { once: true });
        }
        return send.apply(this, args);
      };
    }
  }

  async function handleWriteRequest(data) {
    const id = String(data.id || '');
    if (!id) return;
    const request = data.request || {};
    const action = String(request.action || '');
    const csrf = String(request.csrf || '');
    const bvid = String(request.bvid || '');
    const aid = String(request.aid || '');
    const mid = String(request.mid || '');
    const form = new URLSearchParams();
    const set = (key, value) => { if (value !== undefined && value !== null && value !== '') form.set(key, String(value)); };
    let path = '';
    if (action === 'like') {
      path = '/x/web-interface/archive/like'; set('bvid',bvid); set('aid',aid); set('like',request.active ? 2 : 1);
    } else if (action === 'triple') {
      path = '/x/web-interface/archive/like/triple'; set('bvid',bvid); set('aid',aid);
    } else if (action === 'coin') {
      path = '/x/web-interface/coin/add'; set('bvid',bvid); set('aid',aid); set('multiply',request.multiply || 1); set('select_like',request.selectLike ? 1 : 0);
    } else if (action === 'favorite') {
      path = '/x/v3/fav/resource/deal'; set('rid',aid); set('type',2); set('add_media_ids',Array.isArray(request.addMediaIds)?request.addMediaIds.join(','):request.addMediaIds); set('del_media_ids',Array.isArray(request.delMediaIds)?request.delMediaIds.join(','):request.delMediaIds);
    } else if (action === 'comment') {
      path = '/x/v2/reply/add'; set('type',1); set('oid',aid); set('message',request.message || '');
    } else if (action === 'follow') {
      path = '/x/relation/modify'; set('fid',mid); set('act',request.following ? 2 : 1); set('re_src',11);
    }
    set('csrf',csrf);
    if (!path || !csrf) { post('write-result',{ id, result:{ code:-400, message:'无效的写入请求' } }); return; }
    try {
      const response = await fetch(`https://api.bilibili.com${path}`, { method:'POST', credentials:'include', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','Accept':'application/json, text/plain, */*'}, body:form.toString() });
      const result = await response.json();
      let view = null;
      if (result && result.code === 0 && (bvid || aid) && action !== 'comment') {
        try {
          const query = bvid ? `bvid=${encodeURIComponent(bvid)}` : `aid=${encodeURIComponent(aid)}`;
          view = await fetch(`https://api.bilibili.com/x/web-interface/view?${query}`, { credentials:'include' }).then(r=>r.json());
        } catch {}
      }
      post('write-result',{ id, result:{ ...result, view } });
    } catch (error) {
      post('write-result',{ id, result:{ code:-1, message:String(error && error.message || error) } });
    }
  }


  let lastHref = location.href;
  function emitNavigation() {
    lastHref = location.href;
    post('navigation', safeState());
  }
  function emitNavigationIfChanged() {
    if (location.href === lastHref) return;
    emitNavigation();
  }
  function wrapHistory(name) {
    const original = history[name];
    if (typeof original !== 'function') return;
    history[name] = function coreHistoryWrapper(...args) {
      const out = original.apply(this, args);
      queueMicrotask(emitNavigationIfChanged);
      return out;
    };
  }

  installNetworkObservation();
  installMovedReactEventBridge();
  wrapHistory('pushState');
  wrapHistory('replaceState');
  addEventListener('popstate', emitNavigation);
  addEventListener('hashchange', emitNavigationIfChanged);
  addEventListener('pageshow', emitNavigationIfChanged);
  if (window.navigation && typeof window.navigation.addEventListener === 'function') window.navigation.addEventListener('navigate', () => queueMicrotask(emitNavigationIfChanged));
  // History/popstate/hashchange/navigation cover normal SPA transitions; keep this only as a low-cost fallback.
  setInterval(emitNavigationIfChanged, 1500);
  addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== CLIENT) return;
    const data = event.data;
    if (data.type === 'state') post('state', safeState());
    else if (data.type === 'write-api') handleWriteRequest(data);
  });
  post('state', safeState());
})();
