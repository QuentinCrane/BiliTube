(() => {
  'use strict';
  if (window.__bilitubeCoreBridgeInstalled) return;
  window.__bilitubeCoreBridgeInstalled = true;

  const SOURCE = 'bilitube-bridge-core';
  const CLIENT = 'bilitube-content-core';
  const nativeData=new Map();
  function searchContext(){try{const u=new URL(location.href),p=u.searchParams;return JSON.stringify([u.hostname,u.pathname.replace(/\/$/,''),p.get('keyword')||p.get('search_query')||'',p.get('order')||'totalrank',p.get('duration')||'0']);}catch{return '';}}
  const initialSearchContext=searchContext();

  const post = (type, payload) => window.postMessage({ source: SOURCE, type, payload }, '*');
  function nativeAppReady(){
    const app=document.querySelector('#app');
    return !app||Boolean(app.__vue__&&app.__vue__._isMounted||app.__vue_app__&&app.__vue_app__._instance&&app.__vue_app__._instance.isMounted||app.__vueParentComponent&&app.__vueParentComponent.isMounted);
  }

  function safeState() {
    const state = window.__INITIAL_STATE__ || {};
    const video = state.videoData || null;
    const user = state.loginInfo || state.navInfo || state.userInfo || null;
    return {
      href: location.href,
      hydrated: nativeAppReady(),
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
  function nativeRequest(rawUrl){
    try{
      const url=new URL(String(rawUrl||''),location.href),p=url.searchParams,path=url.pathname;
      if(url.hostname!=='api.bilibili.com')return null;
      if(/^\/x\/web-interface\/(?:wbi\/)?search\/(?:all(?:\/v2)?|type)$/.test(path)){
        const category=path.endsWith('/type')?({video:'video',bili_user:'user',media_bangumi:'bangumi',media_ft:'media'}[p.get('search_type')]):'all';
        if(!category)return null;
        return {type:'search',params:{keyword:p.get('keyword')||'',category,page:Number(p.get('page')||1),order:p.get('order')||'totalrank',duration:Number(p.get('duration')||0)}};
      }
      if(/^\/x\/web-interface\/(?:wbi\/)?index\/top\/feed\/rcmd$/.test(path))return {type:'home',params:{page:1}};
      if(/^\/x\/space\/(?:wbi\/)?arc\/search$/.test(path))return {type:'space-archives',params:{mid:p.get('mid')||'',page:Number(p.get('pn')||1)}};
      if(path==='/x/polymer/web-dynamic/v1/feed/all')return {type:'dynamic',params:{offset:p.get('offset')||''}};
      if(/^\/x\/v2\/history\/toview(?:\/web)?$/.test(path))return {type:'watchlater',params:{page:1}};
    }catch{}
    return null;
  }
  function observeNativeData(rawUrl,payload,href){
    const request=nativeRequest(rawUrl);
    if(!request||!payload||payload.code!==0||!payload.data)return;
    const snapshot={...request,payload,href};const key=JSON.stringify([request.type,request.params,href]);
    nativeData.delete(key);nativeData.set(key,snapshot);while(nativeData.size>8)nativeData.delete(nativeData.keys().next().value);
    post('native-data',snapshot);
  }
  function replayNativeData(){
    // SSR search data is already available when the content script boots.
    // Only forward a populated result shape, never an empty client placeholder.
    try{
      if(location.hostname==='search.bilibili.com'){
        const state=window.__INITIAL_STATE__||{},params=new URLSearchParams(location.search);
        const data=state.searchData&&state.searchData.data||state.searchData;
        if(data&&Array.isArray(data.result)&&(data.result.length||Object.hasOwn(data,'numResults')||Object.hasOwn(data,'numPages'))){
          const type={upuser:'bili_user',bangumi:'media_bangumi',media_ft:'media_ft',video:'video'}[location.pathname.replace(/^\/|\/$/g,'')];
          const query=new URLSearchParams({keyword:params.get('keyword')||params.get('search_query')||'',page:'1',order:params.get('order')||'totalrank',duration:params.get('duration')||'0'});
          if(type)query.set('search_type',type);
          const typed=data.result.some(item=>item&&item.result_type);
          if(!type||!typed)observeNativeData(`https://api.bilibili.com/x/web-interface/search/${type?'type':'all/v2'}?${query}`,{code:0,data},location.href);
        }
      }
    }catch{}
    replaySearchCards();
    for(const snapshot of nativeData.values())post('native-data',snapshot);
  }
  function replaySearchCards(){
    if(location.hostname!=='search.bilibili.com'||searchContext()!==initialSearchContext)return;
    const path=location.pathname.replace(/^\/|\/$/g,'');if(path&&path!=='all'&&path!=='video')return;
    if([...nativeData.values()].some(item=>item.type==='search'))return;
    const cards=[],seen=new Set();
    for(const card of document.querySelectorAll('.bili-video-card,.video-list-item,.video-item')){
      if(card.closest('#bilitube-root,#bilitube-watch-layer,#bilitube-native-layer'))continue;
      const link=card.querySelector('a[href*="/video/BV"]'),match=link&&String(link.href).match(/\/video\/(BV[0-9A-Za-z]+)/);
      if(!match||seen.has(match[1]))continue;
      const title=card.querySelector('h3,[title],.title'),name=String(title&&(title.getAttribute('title')||title.textContent)||link.getAttribute('title')||link.textContent||'').trim();
      if(!name)continue;
      const img=card.querySelector('img'),author=card.querySelector('a[href*="space.bilibili.com"]'),mid=author&&String(author.href).match(/space\.bilibili\.com\/(\d+)/),duration=card.querySelector('.duration,.bili-video-card__stats__duration');
      cards.push({bvid:match[1],title:name,pic:img&&(img.currentSrc||img.src||img.getAttribute('data-src'))||'',author:author&&author.textContent.trim()||'',mid:mid&&mid[1]||'',duration:duration&&duration.textContent.trim()||''});seen.add(match[1]);
      if(cards.length>=60)break;
    }
    if(!cards.length)return;
    const p=new URLSearchParams(location.search),query=new URLSearchParams({keyword:p.get('keyword')||p.get('search_query')||'',page:'1',order:p.get('order')||'totalrank',duration:p.get('duration')||'0'});
    const pages=[...document.querySelectorAll('.vui_pagenation--btn-num,.pagination .page-item')].map(node=>Number(node.textContent.trim())).filter(Number.isFinite);
    const numPages=Math.max(cards.length>=42?0:1,...pages);
    const data={numPages,result:path==='video'?cards:[{result_type:'video',data:cards}]};if(path==='video')query.set('search_type','video');
    observeNativeData(`https://api.bilibili.com/x/web-interface/search/${path==='video'?'type':'all/v2'}?${query}`,{code:0,data},location.href);
  }

  function installNetworkObservation() {
    const nativeFetch = window.fetch;
    if (typeof nativeFetch === 'function') {
      window.fetch = async function bilitubeCoreObservedFetch(...args) {
        const input=args[0],raw=typeof input==='string'||input instanceof URL?String(input):input&&input.url;
        const href=location.href,observed=nativeRequest(raw);
        const response = await nativeFetch.apply(this, args);
        try {
          if(observed){
            response.clone().json().then(payload=>{observeNativeData(raw,payload,href);if(observed.type==='space-archives')observeSpaceArchive(raw,payload);}).catch(()=>{});
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
        this.__btCoreHref = location.href;
        return open.call(this, method, url, ...rest);
      };
      xhr.send = function coreSend(...args) {
        const raw = this.__btCoreUrl || '';
        const observed=nativeRequest(raw),href=this.__btCoreHref||location.href;
        if (observed) {
          this.addEventListener('loadend', () => {
            try {
              const payload = this.responseType === 'json' ? this.response : JSON.parse(this.responseText || 'null');
              observeNativeData(raw,payload,href);if(observed.type==='space-archives')observeSpaceArchive(raw,payload);
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
  let lastHydrated = nativeAppReady();
  function emitNavigation() {
    lastHref = location.href;
    post('navigation', safeState());
  }
  function emitNavigationIfChanged() {
    if (location.href === lastHref) {
      const hydrated=nativeAppReady();
      if(hydrated!==lastHydrated){lastHydrated=hydrated;post('state',safeState());}
      return;
    }
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
    if (data.type === 'state') {post('state', safeState());replayNativeData();}
    else if (data.type === 'write-api') handleWriteRequest(data);
  });
  post('state', safeState());
})();
