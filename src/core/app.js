(() => {
  'use strict';
  if (window.__bilitubeCoreAppInstalled) return;
  window.__bilitubeCoreAppInstalled = true;

  const Policy = window.BiliTubePolicy;
  const Theme = window.BiliTubeTheme;
  const Data = window.BiliTubeData;
  const ApiClient = window.BiliTubeApiClient;
  const NativeVisibility = window.BiliTubeNativeVisibility;
  const NativeAdapter = window.BiliTubeNativeAdapter;
  const Extract = window.BiliTubeExtract;
  const Preview = window.BiliTubePreview;
  const Shell = window.BiliTubeShell;
  const Actions = window.BiliTubeActions;
  const Watch = window.BiliTubeWatch;
  if (!Policy || !Theme || !Data || !ApiClient || !NativeVisibility || !NativeAdapter || !Extract || !Preview || !Shell || !Actions || !Watch) return;
  const T = (key, fallback, substitutions) => {
    const i18n = window.BiliTubeI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback, substitutions) : fallback;
  };

  const CLIENT = 'bilitube-content-core';
  const BRIDGE = 'bilitube-bridge-core';
  const defaults = { enabled:true, glassMode:true, theme:'system', density:'comfortable', motionMode:'full', showCardAuthor:true, showCardMeta:true, sidebarCollapsed:false, showSubscriptions:true, homeFollowedShelf:true, homeLiveShelf:true, homeBangumiShelf:true, homePopularShelf:true, hoverPreview:true, hoverPreviewDelay:500, watchLaterQuick:true, searchSuggestions:true, hideAds:true };
  let settings = { ...defaults };
  let generation = 0;
  let routeController = null;
  let currentContext = null;
  let mountedHref = '';
  let bridgeState = { user:null, video:null, hydrated:false };
  let subscriptions = [];
  let dynamicSubscriptions = [];
  let homeVideos = [];
  let homeCategoryVideos = [], homeCategoryLoading = false, homeCategoryError = '', homeCategoryKey = '';
  let homeShelves = [];
  let homeSectionsLoading = false, homeSectionsError = '';
  let homePage = 1, homeLoading = false, homeHasMore = true, homeError = '';
  let searchVideos = [], searchUsers = [], searchPage = 1, searchLoading = false, searchHasMore = true, searchError = '', searchQueryKey = '', searchCategoryKey = 'all';
  let historyVideos = [];
  let historyCursor = { max:0, business:'', viewAt:0 };
  let historyLoading = false, historyHasMore = true, historyError = '', historyPaused = false;
  let dynamicItems = [];
  let dynamicOffset = '', dynamicLoading = false, dynamicHasMore = true, dynamicError = '';
  let watchLaterVideos = [], watchLaterLoading = false, watchLaterError = '';
  let watchLaterBvids = new Set(), watchLaterAids = new Set(), watchLaterStateLoaded = false, watchLaterStatePromise = null;
  let watchLaterReadSeq = 0;
  let infiniteObserver = null;
  let favoriteFolders = [];
  let favoriteVideos = [];
  let favoriteSelectedId = '';
  let favoritePage = 1, favoriteLoading = false, favoriteHasMore = true, favoriteError = '';
  const profiles = new Map();
  const spacePage = new Map(), spaceHasMore = new Map(), spaceLoading = new Map(), spaceError = new Map();
  const archivePayloads = new Map();
  const archives = new Map();
  const apiSeq = new Map();
  let toastTimer = null;
  let bridgeWriteSeq = 0;
  const bridgeWritePending = new Map();
  let rerenderTimer = null;
  let rerenderAppend = false;
  const pendingSettingWrites = new Set();
  let feedRevision = 0, refreshStatus = '', hiddenAt = 0;
  const refreshPending = new Set(), failedRequests = new Map();
  const feedTypes = new Set(['home','home-category','home-sections','search','dynamic','watchlater','favorites','space-profile','space-archives']);

  const themeReveal=Theme.createRevealController(document);
  const shell = Shell.createController(document);
  const guard = NativeVisibility.createGuard(document);
  const watch = Watch.createDecorator(document);
  const nativeAdapter = NativeAdapter.createAdapter(document);
  let preview;
  preview = Preview.createController({
    requestMedia: async (bvid) => {
      const result = await ApiClient.request('preview', { bvid });
      preview.resolve(bvid, result && result.url || '');
    },
    getDelay: () => settings.hoverPreviewDelay,
    shouldRetain:()=>document.documentElement.classList.contains('bt-theme-reveal'),
  });
  const mediaQuery = matchMedia('(prefers-color-scheme: dark)');

  function post(type, payload = {}) { window.postMessage({ source:CLIENT, type, ...payload }, '*'); }
  function bridgeWrite(request, timeout=5000) {
    return new Promise((resolve) => {
      const id=`btw-${Date.now()}-${++bridgeWriteSeq}`;
      const timer=setTimeout(()=>{bridgeWritePending.delete(id);resolve(null);},timeout);
      bridgeWritePending.set(id,(result)=>{clearTimeout(timer);bridgeWritePending.delete(id);resolve(result||null);});
      post('write-api',{id,request});
    });
  }
  function effectiveTheme() { return Theme.resolve(settings.theme, mediaQuery.matches); }
  function normalizeUser(user) {
    if (!user) return Extract.extractCurrentUser(document);
    return {
      mid:user.mid ? String(user.mid) : '',
      name:String(user.name || ''),
      face:Data.mediaUrl(user.face || ''),
      isLogin:Boolean(user.isLogin || user.mid),
    };
  }
  function currentQuery() {
    const params = new URLSearchParams(location.search);
    return params.get('keyword') || params.get('search_query') || '';
  }
  function chromeData() {
    const sidebarSubscriptions = currentContext && currentContext.route === 'dynamic' && dynamicSubscriptions.length ? dynamicSubscriptions : subscriptions;
    return { href:location.href, renderKey:Policy.navigationIdentity(location), user:normalizeUser(bridgeState.user), subscriptions:sidebarSubscriptions, query:currentQuery(), route:currentContext&&currentContext.route||'', settings };
  }
  function clearPreflight() { document.documentElement.classList.remove('bilitube-core-preflight'); }
  function applyThemeOnly(options = {}) {
    const theme = effectiveTheme();
    const html = document.documentElement;
    const animate = options.animate === true && settings.motionMode !== 'none' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const commit = () => {
      html.dataset.btTheme = theme;
      html.classList.toggle('bt-hide-ads', settings.hideAds !== false);
      html.classList.toggle('bt-glass-mode', settings.glassMode !== false);
      html.classList.toggle('bt-density-compact', settings.density === 'compact');
      html.dataset.btMotion = settings.motionMode || 'full';
      shell.updateTheme(theme);
      watch.updateTheme(theme);
      nativeAdapter.updateTheme(theme);
      syncVisualStyleButtons();
    };
    if (!animate) { themeReveal.cancel();commit(); return; }
    if (options.visualStyle) {
      html.classList.add('bt-style-switching');
      const finishStyleSwitch = () => html.classList.remove('bt-style-switching');
      const runStyleSwitch = () => { commit(); setTimeout(finishStyleSwitch, 140); };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(runStyleSwitch);
      else runStyleSwitch();
      return;
    }
    // startViewTransition keeps media intact while one snapshot fades out.
    Promise.resolve(themeReveal.run(commit,options.origin,true)).finally(()=>{if(preview.resume)preview.resume();});
  }

  function persist(patch) {
    settings = { ...settings, ...patch };
    const signature=JSON.stringify(settings);pendingSettingWrites.add(signature);
    while(pendingSettingWrites.size>16)pendingSettingWrites.delete(pendingSettingWrites.values().next().value);
    try { chrome.storage.local.set({ bilitubeCoreSettings:settings }); } catch {pendingSettingWrites.delete(signature);}
  }
  function showToast(text) {
    let node = document.getElementById('bilitube-core-toast');
    if (!node) { node = document.createElement('div'); node.id='bilitube-core-toast'; node.className='bt-toast'; document.body.append(node); }
    node.textContent = text; node.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('is-visible'), 2400);
  }
  function syncVisualStyleButtons() {
    const glassMode=settings.glassMode!==false;
    const title=glassMode?T('style_original','切换到原版 YouTube Desktop 风格'):T('style_glass','切换到毛玻璃界面');
    document.querySelectorAll('.bt-style-button').forEach(button=>{button.title=title;button.setAttribute('aria-label',title);button.setAttribute('aria-pressed',String(glassMode));});
  }
  function toggleTheme(origin) { const next=Theme.nextExplicit(effectiveTheme()); persist({theme:next}); applyThemeOnly({ animate:true, origin }); }
  function toggleVisualStyle() { const next=settings.glassMode===false; persist({glassMode:next}); applyThemeOnly({ animate:true, visualStyle:true }); syncVisualStyleButtons(); showToast(next?T('style_switched_glass','已切换到毛玻璃界面'):T('style_switched_original','已切换到原版 YouTube Desktop 风格')); }
  function openSettings() {
    try {
      chrome.runtime.sendMessage({ source:'bilitube-control', type:'open-options' }, (response) => {
        if (chrome.runtime.lastError || !response || !response.ok) showToast(T('open_settings_error','无法打开 BiliTube 设置页'));
      });
    } catch { showToast(T('open_settings_error','无法打开 BiliTube 设置页')); }
  }
  function toggleSidebar() {
    if(currentContext&&currentContext.strategy==='decorate'){watch.toggleSidebar();return;}
    if(currentContext&&currentContext.strategy==='adapt'){nativeAdapter.toggleSidebar();return;}
    if(shell.toggleSidebar())return;
    const side=shell.getRoot() && shell.getRoot().querySelector('[data-role="sidebar"]');
    persist({ sidebarCollapsed:Boolean(side && side.classList.contains('is-collapsed')) });
  }
  async function followSpace(mid, following) {
    const id=String(mid||'').replace(/\D/g,'');
    const csrf=csrfToken();
    if(!id){showToast(T('user_info_missing','没有读取到 UP 主信息'));return false;}
    if(!csrf){showToast(T('login_required','请先登录 Bilibili'));return false;}
    let result=await ApiClient.request('space-follow',{mid:id,following:Boolean(following),csrf});
    if(!result||result.code!==0) result=await bridgeWrite({action:'follow',mid:id,following:Boolean(following),csrf});
    if(!result||result.code!==0){showToast(result&&result.message?String(result.message):T('follow_error','关注操作失败'));return false;}
    const nextFollowing=!Boolean(following);
    const current=profiles.get(id)||{mid:id}; profiles.set(id,{...current,following:nextFollowing});
    searchUsers=searchUsers.map(item=>String(item.mid||'')===id?{...item,following:nextFollowing}:item);
    if(currentContext&&currentContext.strategy==='replace') rerenderCurrentReplace();
    showToast(following?T('unfollow_success','已取消关注'):T('follow_success','关注成功')); return true;
  }
  async function requestSearchSuggestions(term) {
    if(settings.searchSuggestions===false)return [];
    const q=String(term||'').trim(); if(!q)return [];
    const payload=await ApiClient.request('search-suggest',{term:q});
    return Data.normalizeSearchSuggestions(payload);
  }
  function ingestWatchLater(payload) {
    const videos=Data.normalizeWatchLater(payload);
    watchLaterVideos=videos;
    watchLaterBvids=new Set(videos.map(item=>String(item.bvid||'')).filter(Boolean));
    watchLaterAids=new Set(videos.map(item=>Number(item.aid||0)).filter(Boolean));
    watchLaterStateLoaded=Boolean(payload&&payload.code===0);
    return videos;
  }
  async function ensureWatchLaterState() {
    if (watchLaterStateLoaded) return true;
    if (watchLaterStatePromise) return watchLaterStatePromise;
    const seq=++watchLaterReadSeq,requestGeneration=generation;
    const task=ApiClient.request('watchlater').then(payload=>{
      if(seq===watchLaterReadSeq&&requestGeneration===generation&&payload&&payload.code===0)ingestWatchLater(payload);
      return watchLaterStateLoaded;
    }).finally(()=>{if(watchLaterStatePromise===task)watchLaterStatePromise=null;});
    watchLaterStatePromise=task;return task;
  }
  function isWatchLater(item) {
    if(!item)return false;
    const bvid=String(item.bvid||''); const aid=Number(item.aid||0);
    return Boolean((bvid&&watchLaterBvids.has(bvid))||(aid&&watchLaterAids.has(aid)));
  }
  function syncWatchLaterButtons(item, active) {
    const bvid=String(item&&item.bvid||''); const aid=String(Number(item&&item.aid||0)||'');
    const buttons=Array.from(document.querySelectorAll('.bt-watchlater-quick,.bt-watchlater-watch'));
    for(const button of buttons){
      const same=Boolean((bvid&&button.dataset.bvid===bvid)||(aid&&button.dataset.aid===aid));
      if(!same)continue;
      button.classList.toggle('is-active',Boolean(active));
      button.setAttribute('aria-pressed',String(Boolean(active)));
      button.title=active?T('remove_watch_later','从稍后再看移除'):T('add_watch_later','稍后再看');
      button.setAttribute('aria-label',button.title);
      const label=button.querySelector('.bt-watchlater-label');
      if(label)label.textContent=active?T('watch_later_added','已加入稍后再看'):T('add_watch_later','稍后再看');
    }
  }
  async function toggleWatchLater(item) {
    const csrf=requireWatchLogin(); if(!csrf)return null;
    await ensureWatchLaterState();
    const bvid=String(item&&item.bvid||''); const aid=Number(item&&item.aid||0); const current=isWatchLater(item); const next=!current;
    const result=await ApiClient.request('watchlater-toggle',{bvid,aid,add:next,csrf});
    if(!result||result.code!==0){showToast(result&&result.message?String(result.message):T('watch_later_error','稍后再看操作失败'));return current;}
    const resolvedAid=Number(result.aid||aid||0); const resolvedBvid=String(result.bvid||bvid||'');
    if(next){if(resolvedBvid)watchLaterBvids.add(resolvedBvid);if(resolvedAid)watchLaterAids.add(resolvedAid);}
    else {if(resolvedBvid)watchLaterBvids.delete(resolvedBvid);if(resolvedAid)watchLaterAids.delete(resolvedAid);watchLaterVideos=watchLaterVideos.filter(video=>!((resolvedBvid&&String(video.bvid||'')===resolvedBvid)||(resolvedAid&&Number(video.aid||0)===resolvedAid)));}
    syncWatchLaterButtons(item,next);
    showToast(next?T('watch_later_success','已加入稍后再看'):T('watch_later_removed','已从稍后再看移除'));
    if(currentContext&&currentContext.route==='watchlater')rerenderCurrentReplace();
    return next;
  }
  function bindPreview(card,item,host) { if(settings.hoverPreview===false)return ()=>{}; return preview.bind(card,item,host); }
  function disconnectInfiniteObserver() { if (infiniteObserver) infiniteObserver.disconnect(); infiniteObserver = null; }
  function restoreNativePage() {
    mountedHref='';themeReveal.cancel();
    generation += 1;
    if (routeController) routeController.abort();
    routeController = null;
    if (rerenderTimer) { clearTimeout(rerenderTimer); rerenderTimer = null; }
    disconnectInfiniteObserver();
    preview.destroy(); watch.destroy(); nativeAdapter.restore(); guard.restore(); shell.destroy(); clearPreflight(); document.documentElement.classList.remove('bt-theme-switching','bt-theme-animating','bt-style-switching','bt-hide-ads','bt-glass-mode','bt-density-compact'); document.documentElement.removeAttribute('data-bt-theme'); document.documentElement.removeAttribute('data-bt-motion');
  }
  function csrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)bili_jct=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }
  function currentAid() {
    const fromBridge = bridgeState.video && Number(bridgeState.video.aid || 0);
    if (fromBridge) return fromBridge;
    return 0;
  }
  function watchContext() {
    const base = Extract.extractWatch(document,bridgeState.video);
    return { ...base, bvid:currentBvid(), aid:currentAid() };
  }
  function requireWatchLogin() {
    const csrf = csrfToken();
    if (!csrf) { showToast(T('login_required','请先登录 Bilibili')); return ''; }
    return csrf;
  }
  async function runAction(action) {
    const ok=Actions.invoke(document,action);
    if(ok)return;
    showToast(T('native_action_hint','请使用页面上的 Bilibili 原生操作按钮'));
  }
  function dialogButton(text, primary=false) {
    const button=document.createElement('button');button.type='button';button.className=primary?'bt-dialog-button is-primary':'bt-dialog-button';button.textContent=text;return button;
  }
  async function clearHistory() {
    const csrf=requireWatchLogin(); if(!csrf)return;
    const modal=window.BiliTubeUI.createDialog(T('clear_history_title','清除观看记录'));modal.body.append(Object.assign(document.createElement('p'),{textContent:T('clear_history_description','将清除全部 Bilibili 观看记录。此操作无法撤销。')}));
    const cancel=dialogButton(T('cancel','取消')),confirm=dialogButton(T('clear','清除'),true);modal.footer.append(cancel,confirm);cancel.addEventListener('click',modal.close);confirm.addEventListener('click',async()=>{confirm.disabled=true;const result=await ApiClient.request('history-clear',{csrf});confirm.disabled=false;if(result&&result.code===0){historyVideos=[];historyHasMore=false;rerenderCurrentReplace();modal.close();showToast(T('history_cleared','观看记录已清除'));}else showToast(result&&result.message||T('clear_failed','清除失败'));});document.body.append(modal.backdrop);
  }
  async function toggleHistoryPause() {
    const csrf=requireWatchLogin(); if(!csrf)return;
    const next=!historyPaused;const result=await ApiClient.request('history-toggle',{paused:next,csrf});
    if(result&&result.code===0){historyPaused=next;rerenderCurrentReplace();showToast(next?T('history_paused','已暂停观看记录'):T('history_resumed','已开启观看记录'));}else showToast(result&&result.message||T('settings_failed','设置失败'));
  }
  const callbacks={ canDecorateAuthor:()=>bridgeState.hydrated||!document.querySelector('#app'), loadMore, retryFeed, refreshCurrent, toggleTheme,toggleVisualStyle,toggleSidebar,openSettings,bindPreview,beforeRender:()=>{disconnectInfiniteObserver();preview.destroy();},afterReconcile:()=>preview.prune(),followSpace,requestSearchSuggestions,action:runAction,clearHistory,toggleHistoryPause,toggleWatchLater,isWatchLater,showWatchLaterQuick:()=>settings.watchLaterQuick!==false,showCardAuthor:()=>settings.showCardAuthor!==false,showCardMeta:()=>settings.showCardMeta!==false };

  function mergeUnique(existing, incoming, keyFn) {
    const out = Array.isArray(existing) ? existing.slice() : [];
    const seen = new Set(out.map(keyFn).filter(Boolean));
    let added = 0;
    for (const item of incoming || []) {
      const key = keyFn(item);
      if (!key || seen.has(key)) continue;
      seen.add(key); out.push(item); added += 1;
    }
    return { items:out, added };
  }
  function currentBvid() {
    const fromBridge = bridgeState.video && String(bridgeState.video.bvid || '').trim();
    if (fromBridge) return fromBridge;
    const match = location.pathname.match(/\/(BV[0-9A-Za-z]+)/);
    return match ? match[1] : '';
  }
  function feedType(feed) {
    if(feed==='home')return homeCategory()==='all'?'home':['live','anime'].includes(homeCategory())?'home-sections':'home-category';
    return feed==='space'?'space-archives':feed;
  }
  function setFeedLoading(type) {
    if(type==='home'){homeLoading=true;homeError='';}
    else if(type==='home-category'){homeCategoryLoading=true;homeCategoryError='';}
    else if(type==='home-sections'){homeSectionsLoading=true;homeSectionsError='';}
    else if(type==='search'){searchLoading=true;searchError='';}
    else if(type==='dynamic'){dynamicLoading=true;dynamicError='';}
    else if(type==='watchlater'){watchLaterLoading=true;watchLaterError='';}
    else if(type==='favorites'){favoriteLoading=true;favoriteError='';}
    else if(type==='space-archives'){spaceLoading.set(currentContext.mid,true);spaceError.set(currentContext.mid,'');}
  }
  function refreshCurrent() {
    if(!currentContext||currentContext.strategy!=='replace'||refreshPending.size)return;
    const route=currentContext.route, requests=[];
    if(route==='home'){
      const category=homeCategory();
      if(category==='all')requests.push(['home',{page:1}],['home-sections',{}]);
      else if(['live','anime'].includes(category))requests.push(['home-sections',{}]);
      else requests.push(['home-category',{category}]);
    }else if(route.startsWith('search-'))requests.push(['search',{keyword:currentQuery(),category:searchCategoryForRoute(route),...searchFilters(),page:1}]);
    else if(route==='dynamic')requests.push(['dynamic',{offset:''}]);
    else if(route==='watchlater')requests.push(['watchlater',{}]);
    else if(route==='favorites')requests.push(['favorites',{mid:currentContext.mid,mediaId:favoriteSelectedId,page:1}]);
    else if(route==='space-home'||route==='space-upload')requests.push(['space-profile',{mid:currentContext.mid}],['space-archives',{mid:currentContext.mid,page:1}]);
    if(!requests.length)return;
    feedRevision+=1;failedRequests.clear();refreshStatus='refreshing';
    disconnectInfiniteObserver();
    for(const [type] of requests){refreshPending.add(type);setFeedLoading(type);}
    renderReplace(currentContext,false);
    for(const [type,params] of requests)requestApi(type,{...params,append:false,forceFresh:true});
    requestApi('account',{forceFresh:true});requestApi('subscriptions',{forceFresh:true});
  }
  function retryFeed(feed) {
    const type=feedType(feed),failed=failedRequests.get(type);
    if(!failed||refreshPending.size||!currentContext||currentContext.strategy!=='replace')return;
    failedRequests.delete(type);setFeedLoading(type);
    renderReplace(currentContext,false);
    requestApi(type,{...failed,forceFresh:true,nativeFirst:false});
  }
  function apiSucceeded(type,payload) {
    if(type==='favorites')return Boolean(payload&&payload.folders&&payload.folders.code===0&&(
      payload.resources&&payload.resources.code===0||!payload.mediaId&&Array.isArray(payload.folders.data&&payload.folders.data.list)&&!payload.folders.data.list.length));
    if(type==='home-sections'){
      const category=homeCategory(),keys=category==='live'?['live']:category==='anime'?['bangumi']:['followed','live','bangumi','popular'];
      return keys.some(key=>payload&&payload[key]&&payload[key].code===0);
    }
    return Boolean(payload&&payload.code===0);
  }
  function loadMoreHome() {
    if (!currentContext || currentContext.route !== 'home' || homeCategory()!=='all' || homeLoading || !homeHasMore) return;
    homeLoading = true; shell.setLoading();
    requestApi('home',{ page:homePage + 1, append:true });
  }
  function searchCategoryForRoute(route) {
    return route==='search-user'?'user':route==='search-bangumi'?'bangumi':route==='search-media'?'media':route==='search-video'?'video':'all';
  }
  function searchFilters(){
    const params=new URLSearchParams(location.search),order=params.get('order'),duration=params.get('duration')||'0';
    return {order:['totalrank','click','pubdate','dm','stow','scores'].includes(order)?order:'totalrank',duration:/^[0-4]$/.test(duration)?Number(duration):0};
  }
  function loadMoreSearch() {
    if (!currentContext || !String(currentContext.route||'').startsWith('search-') || searchLoading || !searchHasMore) return;
    const category=searchCategoryForRoute(currentContext.route);
    searchLoading=true; shell.setLoading(); requestApi('search',{keyword:currentQuery(),category,...searchFilters(),page:searchPage+1,append:true});
  }
  function loadMoreHistory() {
    if (!currentContext || currentContext.route !== 'history' || historyLoading || !historyHasMore) return;
    historyLoading = true; shell.setLoading();
    requestApi('history',{ ...historyCursor, append:true });
  }
  function loadMoreDynamic() {
    if (!currentContext || currentContext.route !== 'dynamic' || dynamicLoading || !dynamicHasMore) return;
    dynamicLoading = true; shell.setLoading();
    requestApi('dynamic',{ offset:dynamicOffset, append:true });
  }
  function loadMoreFavorites() {
    if (!currentContext || currentContext.route !== 'favorites' || favoriteLoading || !favoriteHasMore) return;
    favoriteLoading=true; shell.setLoading(); requestApi('favorites',{mid:currentContext.mid,mediaId:favoriteSelectedId,page:favoritePage+1,append:true});
  }
  function loadMoreSpace() {
    if (!currentContext || currentContext.route !== 'space-upload') return;
    const mid=currentContext.mid; if(spaceLoading.get(mid)||spaceHasMore.get(mid)===false)return;
    const page=Number(spacePage.get(mid)||1)+1; spaceLoading.set(mid,true); shell.setLoading(); requestApi('space-archives',{mid,page,append:true});
  }
  function loadMore(feed){
    if(refreshPending.size||failedRequests.has(feedType(feed)))return;
    if (feed === 'home') loadMoreHome();
    else if (feed === 'search') loadMoreSearch();
    else if (feed === 'history') loadMoreHistory();
    else if (feed === 'dynamic') loadMoreDynamic();
    else if (feed === 'favorites') loadMoreFavorites();
    else if (feed === 'space') loadMoreSpace();
  }
  function setupInfiniteLoading() {
    disconnectInfiniteObserver();
    const root = shell.getRoot();
    const target = root && root.querySelector('[data-bt-feed]');
    if (!target || target.dataset.btManual==='true' || target.dataset.btLoading==='true' || target.dataset.btHasMore==='false' || typeof IntersectionObserver !== 'function') return;
    infiniteObserver = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      loadMore(target.dataset.btFeed);
    }, { root:null, rootMargin:'900px 0px', threshold:0.01 });
    infiniteObserver.observe(target);
  }
  function armInfiniteLoading() { queueMicrotask(setupInfiniteLoading); }

  async function requestApi(type, params={}) {
    const requestGeneration = generation;
    const requestRevision = feedRevision;
    const watchLaterSeq = type==='watchlater'?++watchLaterReadSeq:0;
    const requestHref = Policy.navigationIdentity(location);
    const key = type === 'space-profile' ? `${type}:${params.mid || ''}`
      : type === 'space-archives' ? `${type}:${params.mid || ''}:${params.page || 1}`
      : type === 'home' ? `${type}:${params.page || 1}`
      : type === 'home-category' ? `${type}:${params.category || ''}`
      : type === 'search' ? `${type}:${params.category || 'all'}:${params.keyword || ''}:${params.page || 1}:${params.order||'totalrank'}:${params.duration||0}`
      : type === 'history' ? `${type}:${params.max || 0}:${params.business || ''}:${params.viewAt || 0}`
      : type === 'dynamic' ? `${type}:${params.offset || 'first'}`
      : type === 'favorites' ? `${type}:${params.mid || ''}:${params.mediaId || ''}:${params.page || 1}`
      : type === 'watch-related' ? `${type}:${params.bvid || ''}`
      : type;
    const seq=(apiSeq.get(key)||0)+1; apiSeq.set(key,seq);
    let payload;
    try { payload=await ApiClient.request(type,params); } catch { payload=null; }
    if (requestGeneration!==generation || requestHref!==Policy.navigationIdentity(location) || apiSeq.get(key)!==seq || feedTypes.has(type)&&requestRevision!==feedRevision) return;
    if(type==='watchlater'&&watchLaterSeq!==watchLaterReadSeq)return;
    if(feedTypes.has(type)){
      if(apiSucceeded(type,payload))failedRequests.delete(type);
      else failedRequests.set(type,params);
      if(refreshPending.delete(type)&&!refreshPending.size)refreshStatus=failedRequests.size?'failed':'updated';
      else if(refreshStatus==='failed'&&!refreshPending.size&&!failedRequests.size)refreshStatus='updated';
    }

    if (type==='account') {
      const account=Data.normalizeAccount(payload);
      if(account) bridgeState.user=account;
      if(account&&account.isLogin&&currentContext&&currentContext.strategy==='replace'&&currentContext.route!=='watchlater'&&settings.watchLaterQuick!==false&&!watchLaterStateLoaded){
        ensureWatchLaterState().then(loaded=>{
          if(!loaded||requestGeneration!==generation||requestHref!==Policy.navigationIdentity(location))return;
          for(const item of watchLaterVideos)syncWatchLaterButtons(item,true);
        }).catch(()=>{});
      }
    }
    else if (type==='home') {
      homeLoading=false;
      if (!payload||payload.code!==0) { homeError=T('feed_load_error','内容读取失败，请重试'); }
      else {
        homeError='';
        const list=Data.normalizeHome(payload);
        if(params.append){const merged=mergeUnique(homeVideos,list,item=>item.bvid||item.href);homeVideos=merged.items;homeHasMore=list.length>0&&merged.added>0;if(homeHasMore)homePage=Math.max(homePage,Number(params.page||homePage));}
        else {homeVideos=list;homePage=Math.max(1,Number(params.page||1));homeHasMore=list.length>0;}
      }
    }
    else if (type==='home-category') {
      homeCategoryLoading=false;
      if (!payload || payload.code!==0) { homeCategoryError=T('home_category_unavailable','该分类暂时无法读取'); }
      else { homeCategoryVideos=Data.normalizeHomeCategory(payload,params.category); homeCategoryError=''; }
    }
    else if (type==='home-sections') {
      homeSectionsLoading=false;
      homeSectionsError=apiSucceeded(type,payload)?'':T('feed_load_error','内容读取失败，请重试');
      const followed=Data.normalizeFollowedVideoShelf(payload&&payload.followed).slice(0,12);
      const live=Data.normalizeLiveShelf(payload&&payload.live).slice(0,12);
      const bangumi=Data.normalizeBangumiShelf(payload&&payload.bangumi).slice(0,12);
      const popular=Data.normalizePopularShelf(payload&&payload.popular).slice(0,12);
      const previousShelves=homeShelves;
      homeShelves=[
        { key:'following', title:T('following_shelf','来自你的关注'), href:'https://t.bilibili.com/', items:followed },
        { key:'live', title:T('live_now','正在直播'), href:'https://live.bilibili.com/', items:live },
        { key:'bangumi', title:T('recent_anime','番剧 · 最近更新'), href:'https://www.bilibili.com/anime/', items:bangumi },
        { key:'popular', title:T('popular','热门'), href:'https://www.bilibili.com/v/popular/all/', items:popular },
      ].map(section=>{
        const source=section.key==='following'?'followed':section.key;
        return payload&&payload[source]&&payload[source].code===0?section:previousShelves.find(old=>old.key===section.key)||section;
      }).filter(section=>section.items.length);
    }
    else if (type==='search') {
      searchLoading=false;
      const previousResultCount=searchVideos.length+searchUsers.length;
      const category=String(params.category||'all');
      if(!payload || payload.code!==0){searchError=T('feed_load_error','内容读取失败，请重试');}
      else {
        let results=[]; let users=[]; let rawForPaging=payload;
        if(category==='all'){
          const normalized=Data.normalizeSearchAll(payload);
          results=normalized.videos; users=normalized.users; rawForPaging=payload;
        } else if(category==='user') users=Data.normalizeSearchUsers(payload);
        else if(category==='bangumi'||category==='media') results=Data.normalizeSearchMedia(payload,category);
        else results=Data.normalizeSearch(payload);
        if(params.append){
          if(results.length){const merged=mergeUnique(searchVideos,results,item=>item.bvid||item.href);searchVideos=merged.items;}
          if(users.length){const mergedUsers=mergeUnique(searchUsers,users,item=>item.mid||item.href);searchUsers=mergedUsers.items;}
        } else {searchVideos=results;searchUsers=users;}
        searchError=''; searchPage=params.append?Math.max(searchPage,Number(params.page||1)):Math.max(1,Number(params.page||1));
        const pageData=rawForPaging&&rawForPaging.data||payload.data||{}; const totalPages=Number(pageData.numPages||pageData.num_pages||pageData.num_pages_by_type&&pageData.num_pages_by_type.video||0);
        const resultCount=category==='user'?users.length:results.length;
        const added=!params.append||searchVideos.length+searchUsers.length>previousResultCount;
        searchHasMore=added&&searchPage<50&&(totalPages?searchPage<totalPages:resultCount>0);
      }
    }
    else if (type==='subscriptions') subscriptions=Data.normalizeSubscriptions(payload);
    else if (type==='history') {
      historyLoading=false;
      if(!payload || payload.code!==0){historyHasMore=false;historyError=payload&&payload.code===-101?T('history_login_error','请先登录 Bilibili 后再查看历史记录'):T('history_load_error','历史记录读取失败，可使用右侧按钮打开 B站原生历史管理');}
      else {
        const list=Data.normalizeHistory(payload);const merged=params.append?mergeUnique(historyVideos,list,item=>`${item.href}|${item.viewedAt}`):{items:list,added:list.length};historyVideos=merged.items;historyError='';
        const cursor=payload.data&&payload.data.cursor||{};historyCursor={max:Number(cursor.max||0),business:String(cursor.business||''),viewAt:Number(cursor.view_at||0)};
        historyHasMore=list.length>0&&merged.added>0&&Boolean(historyCursor.viewAt||historyCursor.max);
      }
    }
    else if (type==='dynamic') {
      dynamicLoading=false;
      if(!payload || payload.code!==0){dynamicError=payload&&payload.code===-101?T('dynamic_login_error','请先登录 Bilibili 后再查看动态'):T('dynamic_load_error','动态读取失败');}
      else {
        const list=Data.normalizeDynamic(payload);const merged=params.append?mergeUnique(dynamicItems,list,item=>item.id||item.video&&item.video.bvid||`${item.author}|${item.time}|${item.text}`):{items:list,added:list.length};dynamicItems=merged.items;dynamicSubscriptions=Data.normalizeDynamicSubscriptions(dynamicItems);dynamicError='';
        dynamicOffset=String(payload.data&&payload.data.offset||'');dynamicHasMore=Boolean(payload.data&&payload.data.has_more)&&list.length>0&&merged.added>0&&Boolean(dynamicOffset);
      }
    }
    else if (type==='watchlater') {
      watchLaterLoading=false;
      watchLaterError=payload&&payload.code===0?'':payload&&payload.code===-101?T('watchlater_login_error','请先登录 Bilibili 后再查看稍后再看'):T('watchlater_load_error','稍后再看读取失败，可打开 B站原页面重试');
      if(payload&&payload.code===0)ingestWatchLater(payload);
    }
    else if (type==='history-status') {
      if(payload&&payload.code===0) historyPaused=Boolean(payload.data);
    }
    else if (type==='space-profile') {
      const mid=String(params.mid||''); const profile=Data.normalizeSpaceProfile(payload,mid);
      if(profile){profiles.set(mid,profile);const existing=archives.get(mid)||[];if(existing.length)archives.set(mid,existing.map(item=>({...item,author:item.author||profile.name,avatar:item.avatar||profile.avatar,authorHref:item.authorHref||profile.href})));}
      const raw=archivePayloads.get(mid); if(raw && !(archives.get(mid)||[]).length) archives.set(mid,Data.normalizeSpaceArchives(raw,mid,profile||{}));
    } else if (type==='space-archives') {
      const mid=String(params.mid||''); spaceLoading.set(mid,false);
      if(!payload || payload.code!==0){spaceError.set(mid,T('feed_load_error','内容读取失败，请重试'));}
      else {
        const list=Data.normalizeSpaceArchives(payload,mid,profiles.get(mid)||{}); const current=archives.get(mid)||[]; const merged=params.append?mergeUnique(current,list,item=>item.bvid||item.href):{items:list,added:list.length}; archives.set(mid,merged.items); spaceError.set(mid,'');
        const page=Math.max(1,Number(params.page||1)); spacePage.set(mid,page); const count=Number(payload.data&&payload.data.page&&payload.data.page.count||0); spaceHasMore.set(mid,count?page*30<count:list.length>=30&&merged.added>0);
      }
    } else if (type==='favorites') {
      favoriteLoading=false;
      if(payload&&payload.folders&&payload.folders.code===0){favoriteFolders=Data.normalizeFavoriteFolders(payload.folders);favoriteSelectedId=String(payload.mediaId||favoriteSelectedId||'');}
      if(!apiSucceeded(type,payload)){favoriteError=T('favorites_load_error','收藏夹读取失败');}
      else { const list=Data.normalizeFavoriteResources(payload.resources); const merged=params.append?mergeUnique(favoriteVideos,list,item=>item.bvid||item.href):{items:list,added:list.length}; favoriteVideos=merged.items; favoritePage=Math.max(1,Number(payload.page||params.page||1)); favoriteHasMore=Boolean(payload.hasMore)&&merged.added>0; favoriteError=''; }
    }
    if (!currentContext) return;
    if (type==='account') {
      if(currentContext.strategy==='decorate') watch.updateChrome(chromeData());
      else if(currentContext.strategy==='replace') shell.updateChrome(chromeData());
      else if(currentContext.strategy==='adapt') nativeAdapter.updateChrome(chromeData(),callbacks);
    }
    if (currentContext.strategy==='replace') {
      if (type==='subscriptions') shell.updateChrome(chromeData());
      else if (type!=='account') rerenderCurrentReplace(params.append===true);
    }
    else if (currentContext.strategy==='adapt' && type==='subscriptions') nativeAdapter.updateChrome(chromeData(),callbacks);
  }

  function visibleHomeShelves(category = 'all') {
    category = String(category || 'all');
    return homeShelves.filter(section => {
      if (category !== 'all') {
        const shelfCategory = category === 'anime' ? 'bangumi' : category;
        if (section.key !== shelfCategory) return false;
      }
      if(section.key==='following')return settings.homeFollowedShelf!==false;
      if(section.key==='live')return settings.homeLiveShelf!==false;
      if(section.key==='bangumi')return settings.homeBangumiShelf!==false;
      if(section.key==='popular')return settings.homePopularShelf!==false;
      return true;
    });
  }
  function homeCategory() {
    const value = new URLSearchParams(location.search).get('bilitube_category') || 'all';
    return ['all','live','anime','knowledge','tech','game','music','film'].includes(value) ? value : 'all';
  }
  function homeCategoryMatches(item, category) {
    if (category === 'all') return true;
    if (category === 'live' || category === 'anime') return false;
    const key = String(item && item.categoryKey || Data.homeCategoryKey(item && item.category, item && (item.tid || item.type_id)) || '');
    return key === category;
  }
  function homeRenderItems(category) {
    if (category === 'live' || category === 'anime') return [];
    if (category !== 'all' && homeCategoryVideos.length) return homeCategoryVideos;
    const source = homeVideos.length ? homeVideos : homeError ? Extract.extractSearchCards(document) : [];
    return source.filter(item => homeCategoryMatches(item, category));
  }
  function renderReplace(context, requestData=true, append=false) {
    const base={...chromeData(),append,refreshing:refreshPending.size>0,refreshStatus};
    if(context.route==='home') {
      if(requestData)homeLoading=true;
      const category=homeCategory();
      const categoryFromApi=!['all','live','anime'].includes(category);
      const shelfCategory=['live','anime'].includes(category);
      if(requestData){
        homeError='';homeSectionsError='';homeSectionsLoading=true;
        if(homeCategoryKey!==category){homeCategoryVideos=[];homeCategoryError='';homeCategoryKey=category;}
        if(categoryFromApi)homeCategoryLoading=true;
      }
      const homeData={...base,category,videos:homeRenderItems(category),shelves:visibleHomeShelves(),loading:categoryFromApi?homeCategoryLoading:shelfCategory?homeSectionsLoading:homeLoading,hasMore:category==='all'?homeHasMore:false,error:categoryFromApi?homeCategoryError:shelfCategory?homeSectionsError:homeError};
      if(category!=='all')homeData.shelves=visibleHomeShelves(category);
      shell.render('home',homeData);
      armInfiniteLoading();
      if(requestData){homePage=1;homeHasMore=true;homeLoading=true;requestApi('home',{page:1,append:false,nativeFirst:true});requestApi('home-sections');requestApi('subscriptions');if(categoryFromApi)requestApi('home-category',{category});} return;
    }
    if(String(context.route||'').startsWith('search-')) {
      const query=currentQuery(); const category=searchCategoryForRoute(context.route);const filters=searchFilters();const queryKey=JSON.stringify([query,filters]);
      if(requestData&&(searchQueryKey!==queryKey||searchCategoryKey!==category)){searchQueryKey=queryKey;searchCategoryKey=category;searchVideos=[];searchUsers=[];searchPage=1;searchHasMore=true;searchError='';}
      if(requestData)searchLoading=true;
      const fallback=searchError&&!searchVideos.length&&(category==='all'||category==='video')?Extract.extractSearchCards(document):[]; const results=searchVideos.length?searchVideos:fallback;
      shell.render(context.route,{...base,query,category,filters,results,users:searchUsers,videos:results,loading:searchLoading,hasMore:searchHasMore,error:searchError}); armInfiniteLoading();
      if(requestData){searchLoading=true;requestApi('search',{keyword:query,category,...filters,page:1,append:false,nativeFirst:true});if(category==='all'||category==='video')scheduleDomRefresh(context,[700]);requestApi('subscriptions');} return;
    }
    if(context.route==='dynamic') {
      const dynamicMode = new URLSearchParams(location.search).get('bilitube_dynamic') || 'all';
      if(requestData){dynamicLoading=true;dynamicError='';}
      shell.render('dynamic',{...base,items:dynamicItems,mode:dynamicMode,loading:dynamicLoading,hasMore:dynamicHasMore,error:dynamicError});
      armInfiniteLoading();
      if(requestData){dynamicOffset='';dynamicHasMore=true;dynamicError='';dynamicLoading=true;dynamicSubscriptions=[];requestApi('dynamic',{offset:'',append:false,nativeFirst:true});requestApi('subscriptions');} return;
    }
    if(context.route==='watchlater') {
      if(requestData){watchLaterLoading=true;watchLaterError='';}
      shell.render('watchlater',{...base,videos:watchLaterVideos,loading:watchLaterLoading,error:watchLaterError});
      if(requestData){requestApi('watchlater',{nativeFirst:true});requestApi('subscriptions');} return;
    }
    if(context.route==='favorites') {
      if(requestData){favoriteSelectedId=new URLSearchParams(location.search).get('fid')||'';favoriteFolders=[];favoriteVideos=[];favoritePage=1;favoriteHasMore=true;favoriteError='';favoriteLoading=true;}
      const selectedFolder=favoriteFolders.find(folder=>String(folder.id)===String(favoriteSelectedId))||favoriteFolders[0]||null;
      shell.render('favorites',{...base,mid:context.mid,folders:favoriteFolders,videos:favoriteVideos,selectedId:favoriteSelectedId,selectedFolder,loading:favoriteLoading,hasMore:favoriteHasMore,error:favoriteError}); armInfiniteLoading();
      if(requestData){favoriteLoading=true;favoritePage=1;favoriteHasMore=true;requestApi('favorites',{mid:context.mid,mediaId:favoriteSelectedId,page:1,append:false});requestApi('subscriptions');} return;
    }
    if(context.route==='space-home'||context.route==='space-upload') {
      const mid=context.mid;if(requestData)spaceLoading.set(mid,true); const profile=profiles.get(mid)||null; const apiVideos=archives.get(mid)||[]; const videos=apiVideos.length?apiVideos:spaceError.get(mid)?Extract.extractSearchCards(document):[];
      shell.render(context.route,{...base,mid,profile,videos,loading:Boolean(spaceLoading.get(mid)),hasMore:spaceHasMore.get(mid)!==false,error:spaceError.get(mid)||''}); if(context.route==='space-upload')armInfiniteLoading();
      if(requestData){spacePage.set(mid,1);spaceHasMore.set(mid,true);spaceLoading.set(mid,true);spaceError.set(mid,'');requestApi('space-profile',{mid});requestApi('space-archives',{mid,page:1,append:false,nativeFirst:true});requestApi('subscriptions');scheduleDomRefresh(context,[900]);}
    }
  }

  function scheduleDomRefresh(context,delays) {
    const myGeneration=generation;
    for(const delay of delays)setTimeout(()=>{
      if(myGeneration!==generation || routeController && routeController.signal.aborted)return;
      const now=Policy.resolve(location); if(now.route!==context.route||now.strategy!=='replace')return;
      if(context.route==='search-video'||context.route==='search-all') {
        if(searchError&&!searchVideos.length){const videos=Extract.extractSearchCards(document); if(videos.length)shell.render(context.route,{...chromeData(),query:currentQuery(),category:searchCategoryForRoute(context.route),results:videos,users:searchUsers,videos,loading:searchLoading,hasMore:searchHasMore,error:searchError});}
      } else if(context.route==='space-home'||context.route==='space-upload') {
        if((archives.get(context.mid)||[]).length||!spaceError.get(context.mid))return;
        const fallback=Extract.extractSearchCards(document);if(!fallback.length)return;
        shell.render(context.route,{...chromeData(),mid:context.mid,profile:profiles.get(context.mid)||null,videos:fallback,loading:Boolean(spaceLoading.get(context.mid)),hasMore:spaceHasMore.get(context.mid)!==false,error:spaceError.get(context.mid)||''});
      }
    },delay);
  }
  function mount(reason='route') {
    if(!document.body)return;
    const nextContext=Policy.resolve(location);
    if(reason==='bridge-navigation'&&mountedHref===Policy.navigationIdentity(location)){
      if(currentContext&&currentContext.strategy==='decorate'){currentContext=nextContext;watch.updateContext(watchContext());watch.updateChrome(chromeData());}
      else if(currentContext&&currentContext.strategy==='replace')shell.updateChrome(chromeData());
      return;
    }
    // Bilibili swaps video routes inside its mounted Vue app. Keep the native
    // player decoration and its DOM observers alive while that patch runs;
    // tearing them down here can leave the next player outside our layout.
    if(reason==='bridge-navigation'&&currentContext&&currentContext.route==='watch'&&nextContext.route==='watch'){
      mountedHref=Policy.navigationIdentity(location);currentContext=nextContext;
      watch.updateContext(watchContext());watch.updateChrome(chromeData());return;
    }
    mountedHref=Policy.navigationIdentity(location);
    generation+=1; apiSeq.clear(); refreshPending.clear();failedRequests.clear();refreshStatus=''; const myGeneration=generation;
    if(routeController)routeController.abort(); routeController=new AbortController();
    currentContext=nextContext;
    try {
      if(!settings.enabled||currentContext.strategy==='passthrough'){restoreNativePage();return;}
      const theme=effectiveTheme();
      if(currentContext.strategy==='adapt') {
        preview.destroy();watch.destroy();guard.restore();disconnectInfiniteObserver();shell.destroy();clearPreflight();
        nativeAdapter.mount(chromeData(),callbacks,theme,currentContext);post('state');requestApi('account');requestApi('subscriptions');return;
      }
      nativeAdapter.restore();
      if(currentContext.strategy==='decorate') {
        preview.destroy();guard.restore();shell.destroy();disconnectInfiniteObserver();clearPreflight();
        watch.mount(watchContext(),callbacks,theme,chromeData());applyThemeOnly();post('state');requestApi('account');
        ensureWatchLaterState().then(()=>{if(myGeneration===generation&&currentContext&&currentContext.strategy==='decorate')watch.updateContext(watchContext());}).catch(()=>{});
        return;
      }
      watch.destroy();
      const root=shell.ensure(chromeData(),callbacks);guard.hide(root);shell.setCollapsed(settings.sidebarCollapsed);shell.updateChrome(chromeData());shell.updateTheme(theme);renderReplace(currentContext);requestApi('account');
      if(myGeneration===generation)document.documentElement.classList.add('bilitube-core-preflight');
      post('state');
    } catch(error) { restoreNativePage(); console.warn('[BiliTube] Core mount failed; restored native Bilibili.',error); }
  }
  function rerenderCurrentReplace(append=false) {
    if(!currentContext||currentContext.strategy!=='replace'||!shell.getRoot())return;
    if (rerenderTimer) { rerenderAppend=rerenderAppend&&append;return; }
    rerenderAppend=append;
    rerenderTimer=setTimeout(()=>{
      rerenderTimer=null;
      if(!currentContext||currentContext.strategy!=='replace'||!shell.getRoot())return;
      shell.updateChrome(chromeData());renderReplace(currentContext,false,rerenderAppend);
    },60);
  }
  function onBridgeMessage(event) {
    if(event.source!==window||!event.data||event.data.source!==BRIDGE)return;
    const {type,payload}=event.data;
    if(type==='write-result'&&payload&&payload.id){const done=bridgeWritePending.get(String(payload.id));if(done)done(payload.result);return;}
    if(type==='navigation') {
      if(payload&&typeof payload.hydrated==='boolean')bridgeState.hydrated=payload.hydrated;
      if(payload&&payload.user)bridgeState.user=payload.user;
      if(payload&&payload.video)bridgeState.video=payload.video;
      queueMicrotask(()=>mount('bridge-navigation'));return;
    }
    if(type==='state') {
      if(payload)bridgeState={...bridgeState,user:payload.user||bridgeState.user,video:payload.video||null,hydrated:typeof payload.hydrated==='boolean'?payload.hydrated:bridgeState.hydrated};
      if(currentContext&&currentContext.strategy==='decorate'){watch.updateContext(watchContext());watch.updateChrome(chromeData());}
      else if(currentContext&&currentContext.strategy==='replace')shell.updateChrome(chromeData());
      else if(currentContext&&currentContext.strategy==='adapt')nativeAdapter.updateChrome(chromeData(),callbacks);
      return;
    }
    if(type==='space-archives'&&payload) {
      const mid=String(payload.mid||'');archivePayloads.set(mid,payload.payload);if(!(archives.get(mid)||[]).length)archives.set(mid,Data.normalizeSpaceArchives(payload.payload,mid,profiles.get(mid)||{}));
      if(currentContext&&currentContext.mid===mid)rerenderCurrentReplace();
    }
  }
  function loadSettings(done) {
    try{chrome.storage.local.get(['bilitubeCoreSettings'],result=>{if(!chrome.runtime.lastError&&result&&result.bilitubeCoreSettings)settings={...defaults,...result.bilitubeCoreSettings};done();});}catch{done();}
  }
  function boot() {
    addEventListener('message',onBridgeMessage);
    // Offer a refresh after a long absence without replacing the user's place
    // in a feed or issuing background polling requests.
    if(document.addEventListener)document.addEventListener('visibilitychange',()=>{
      if(document.hidden){hiddenAt=Date.now();return;}
      const stale=hiddenAt&&Date.now()-hiddenAt>=60000;hiddenAt=0;
      if(stale&&settings.enabled&&currentContext&&currentContext.strategy==='replace'&&!refreshPending.size){refreshStatus='stale';rerenderCurrentReplace();}
    });
    const systemThemeListener=()=>{if(settings.theme==='system')applyThemeOnly();};
    if(mediaQuery.addEventListener)mediaQuery.addEventListener('change',systemThemeListener);else if(mediaQuery.addListener)mediaQuery.addListener(systemThemeListener);
    try{chrome.storage.onChanged.addListener((changes,area)=>{
      if(area!=='local'||!changes.bilitubeCoreSettings)return;
      const next={...defaults,...(changes.bilitubeCoreSettings.newValue||{})};
      const signature=JSON.stringify(next);if(pendingSettingWrites.has(signature)){pendingSettingWrites.delete(signature);return;}
      const changed=Object.keys(next).filter(key=>next[key]!==settings[key]);
      if(!changed.length)return;
      settings=next;applyThemeOnly();
      if(changed.includes('enabled')){mount('settings-change');return;}
      if(changed.includes('hoverPreview')){
        if(settings.hoverPreview===false)preview.destroy();
        else {const root=shell.getRoot();if(root)for(const card of root.querySelectorAll('article'))if(card.__btCardItem&&card.__btPreviewHost)bindPreview(card,card.__btCardItem,card.__btPreviewHost);}
      }
      if(currentContext&&currentContext.strategy==='replace'&&shell.getRoot()){
        if(changed.includes('sidebarCollapsed'))shell.setCollapsed(settings.sidebarCollapsed);
        if(changed.includes('showSubscriptions'))shell.updateChrome(chromeData());
        const contentKeys=['showCardAuthor','showCardMeta','homeFollowedShelf','homeLiveShelf','homeBangumiShelf','homePopularShelf'];
        if(changed.some(key=>contentKeys.includes(key)))renderReplace(currentContext,false);
        if(changed.includes('watchLaterQuick'))window.BiliTubeUI.updateQuickControls(shell.getRoot(),callbacks);
      }
    });}catch{}

    loadSettings(()=>{applyThemeOnly();mount('boot');setTimeout(()=>post('state'),450);setTimeout(()=>post('state'),1400);});
  }
  if(document.body)boot();else addEventListener('DOMContentLoaded',boot,{once:true});
})();
