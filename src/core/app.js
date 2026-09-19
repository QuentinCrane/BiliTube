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
  let bridgeState = { user:null, video:null };
  let subscriptions = [];
  let dynamicSubscriptions = [];
  let homeVideos = [];
  let homeCategoryVideos = [], homeCategoryLoading = false, homeCategoryError = '';
  let homeShelves = [];
  let homePage = 1, homeLoading = false, homeHasMore = true;
  let searchVideos = [], searchUsers = [], searchPage = 1, searchLoading = false, searchHasMore = true, searchError = '', searchQueryKey = '', searchCategoryKey = 'all';
  let historyVideos = [];
  let historyCursor = { max:0, business:'', viewAt:0 };
  let historyLoading = false, historyHasMore = true, historyError = '', historyPaused = false;
  let dynamicItems = [];
  let dynamicOffset = '', dynamicLoading = false, dynamicHasMore = true, dynamicError = '';
  let watchLaterVideos = [], watchLaterLoading = false;
  let watchLaterBvids = new Set(), watchLaterAids = new Set(), watchLaterStateLoaded = false, watchLaterStatePromise = null;
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
    return { user:normalizeUser(bridgeState.user), subscriptions:sidebarSubscriptions, query:currentQuery(), route:currentContext&&currentContext.route||'', settings };
  }
  function clearPreflight() { document.documentElement.classList.remove('bilitube-core-preflight'); }
  function applyThemeOnly(options = {}) {
    const theme = effectiveTheme();
    const html = document.documentElement;
    const animate = options.animate === true && !matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    if (!animate) { commit(); return; }
    if (options.visualStyle) {
      html.classList.add('bt-style-switching');
      const finishStyleSwitch = () => html.classList.remove('bt-style-switching');
      const runStyleSwitch = () => { commit(); setTimeout(finishStyleSwitch, 140); };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(runStyleSwitch);
      else runStyleSwitch();
      return;
    }
    html.classList.add('bt-theme-switching','bt-theme-animating');
    const finish = () => html.classList.remove('bt-theme-switching','bt-theme-animating');
    if (options.viewTransition === true && typeof document.startViewTransition === 'function') {
      try {
        const transition = document.startViewTransition(commit);
        Promise.resolve(transition && transition.finished).catch(() => {}).finally(finish);
        return;
      } catch {}
    }
    commit();
    setTimeout(finish, 220);
  }
  function persist(patch) {
    settings = { ...settings, ...patch };
    try { chrome.storage.local.set({ bilitubeCoreSettings:settings }); } catch {}
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
  function toggleTheme() { const next=Theme.nextExplicit(effectiveTheme()); persist({theme:next}); applyThemeOnly({ animate:true, viewTransition:false }); }
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
    shell.toggleSidebar();
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
    watchLaterStatePromise=ApiClient.request('watchlater').then(payload=>{ingestWatchLater(payload);return watchLaterStateLoaded;}).finally(()=>{watchLaterStatePromise=null;});
    return watchLaterStatePromise;
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
    else {if(resolvedBvid)watchLaterBvids.delete(resolvedBvid);if(resolvedAid)watchLaterAids.delete(resolvedAid);watchLaterVideos=watchLaterVideos.filter(video=>String(video.bvid||'')!==resolvedBvid&&Number(video.aid||0)!==resolvedAid);}
    syncWatchLaterButtons(item,next);
    showToast(next?T('watch_later_success','已加入稍后再看'):T('watch_later_removed','已从稍后再看移除'));
    if(currentContext&&currentContext.route==='watchlater')rerenderCurrentReplace();
    return next;
  }
  function bindPreview(card,item,host) { if(settings.hoverPreview===false)return ()=>{}; return preview.bind(card,item,host); }
  function disconnectInfiniteObserver() { if (infiniteObserver) infiniteObserver.disconnect(); infiniteObserver = null; }
  function restoreNativePage() {
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
  const callbacks={ toggleTheme,toggleVisualStyle,toggleSidebar,openSettings,bindPreview,beforeRender:()=>preview.destroy(),followSpace,requestSearchSuggestions,action:runAction,clearHistory,toggleHistoryPause,toggleWatchLater,isWatchLater,showWatchLaterQuick:()=>settings.watchLaterQuick!==false,showCardAuthor:()=>settings.showCardAuthor!==false,showCardMeta:()=>settings.showCardMeta!==false };

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
  function loadMoreHome() {
    if (!currentContext || currentContext.route !== 'home' || homeLoading || !homeHasMore) return;
    homeLoading = true; rerenderCurrentReplace();
    requestApi('home',{ page:homePage + 1, append:true });
  }
  function searchCategoryForRoute(route) {
    return route==='search-user'?'user':route==='search-bangumi'?'bangumi':route==='search-media'?'media':route==='search-video'?'video':'all';
  }
  function loadMoreSearch() {
    if (!currentContext || !String(currentContext.route||'').startsWith('search-') || searchLoading || !searchHasMore) return;
    const category=searchCategoryForRoute(currentContext.route);
    searchLoading=true; rerenderCurrentReplace(); requestApi('search',{keyword:currentQuery(),category,page:searchPage+1,append:true});
  }
  function loadMoreHistory() {
    if (!currentContext || currentContext.route !== 'history' || historyLoading || !historyHasMore) return;
    historyLoading = true; rerenderCurrentReplace();
    requestApi('history',{ ...historyCursor, append:true });
  }
  function loadMoreDynamic() {
    if (!currentContext || currentContext.route !== 'dynamic' || dynamicLoading || !dynamicHasMore) return;
    dynamicLoading = true; rerenderCurrentReplace();
    requestApi('dynamic',{ offset:dynamicOffset, append:true });
  }
  function loadMoreFavorites() {
    if (!currentContext || currentContext.route !== 'favorites' || favoriteLoading || !favoriteHasMore) return;
    favoriteLoading=true; rerenderCurrentReplace(); requestApi('favorites',{mid:currentContext.mid,mediaId:favoriteSelectedId,page:favoritePage+1,append:true});
  }
  function loadMoreSpace() {
    if (!currentContext || currentContext.route !== 'space-upload') return;
    const mid=currentContext.mid; if(spaceLoading.get(mid)||spaceHasMore.get(mid)===false)return;
    const page=Number(spacePage.get(mid)||1)+1; spaceLoading.set(mid,true); rerenderCurrentReplace(); requestApi('space-archives',{mid,page,append:true});
  }
  function setupInfiniteLoading() {
    disconnectInfiniteObserver();
    const root = shell.getRoot();
    const target = root && root.querySelector('[data-bt-feed]');
    if (!target || typeof IntersectionObserver !== 'function') return;
    infiniteObserver = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      const feed = target.dataset.btFeed;
      if (feed === 'home') loadMoreHome();
      else if (feed === 'search') loadMoreSearch();
      else if (feed === 'history') loadMoreHistory();
      else if (feed === 'dynamic') loadMoreDynamic();
      else if (feed === 'favorites') loadMoreFavorites();
      else if (feed === 'space') loadMoreSpace();
    }, { root:null, rootMargin:'900px 0px', threshold:0.01 });
    infiniteObserver.observe(target);
  }
  function armInfiniteLoading() { queueMicrotask(setupInfiniteLoading); }

  async function requestApi(type, params={}) {
    const requestGeneration = generation;
    const requestHref = location.href;
    const key = type === 'space-profile' ? `${type}:${params.mid || ''}`
      : type === 'space-archives' ? `${type}:${params.mid || ''}:${params.page || 1}`
      : type === 'home' ? `${type}:${params.page || 1}`
      : type === 'home-category' ? `${type}:${params.category || ''}`
      : type === 'search' ? `${type}:${params.category || 'all'}:${params.keyword || ''}:${params.page || 1}`
      : type === 'history' ? `${type}:${params.max || 0}:${params.business || ''}:${params.viewAt || 0}`
      : type === 'dynamic' ? `${type}:${params.offset || 'first'}`
      : type === 'favorites' ? `${type}:${params.mid || ''}:${params.mediaId || ''}:${params.page || 1}`
      : type === 'watch-related' ? `${type}:${params.bvid || ''}`
      : type;
    const seq=(apiSeq.get(key)||0)+1; apiSeq.set(key,seq);
    const payload=await ApiClient.request(type,params);
    if (requestGeneration!==generation || requestHref!==location.href || apiSeq.get(key)!==seq) return;

    if (type==='account') {
      const account=Data.normalizeAccount(payload);
      if(account) bridgeState.user=account;
    }
    else if (type==='home') {
      homeLoading=false;
      if (payload==null) { homeHasMore=false; }
      else {
        const list=Data.normalizeHome(payload);
        if(params.append){const merged=mergeUnique(homeVideos,list,item=>item.bvid||item.href);homeVideos=merged.items;homeHasMore=list.length>0&&merged.added>0;if(homeHasMore)homePage=Math.max(homePage,Number(params.page||homePage));}
        else {homeVideos=list;homePage=Math.max(1,Number(params.page||1));homeHasMore=list.length>0;}
      }
    }
    else if (type==='home-category') {
      homeCategoryLoading=false;
      if (!payload || payload.code!==0) { homeCategoryVideos=[]; homeCategoryError=T('home_category_unavailable','该分类暂时无法读取'); }
      else { homeCategoryVideos=Data.normalizeHomeCategory(payload,params.category); homeCategoryError=''; }
    }
    else if (type==='home-sections') {
      const followed=Data.normalizeFollowedVideoShelf(payload&&payload.followed).slice(0,12);
      const live=Data.normalizeLiveShelf(payload&&payload.live).slice(0,12);
      const bangumi=Data.normalizeBangumiShelf(payload&&payload.bangumi).slice(0,12);
      const popular=Data.normalizePopularShelf(payload&&payload.popular).slice(0,12);
      homeShelves=[
        { key:'following', title:T('following_shelf','来自你的关注'), href:'https://t.bilibili.com/', items:followed },
        { key:'live', title:T('live_now','正在直播'), href:'https://live.bilibili.com/', items:live },
        { key:'bangumi', title:T('recent_anime','番剧 · 最近更新'), href:'https://www.bilibili.com/anime/', items:bangumi },
        { key:'popular', title:T('popular','热门'), href:'https://www.bilibili.com/v/popular/all/', items:popular },
      ].filter(section=>section.items.length);
    }
    else if (type==='search') {
      searchLoading=false;
      const category=String(params.category||'all');
      if(!payload || payload.code!==0){searchHasMore=false;searchError=T('search_unavailable','搜索接口暂时不可用，已保留页面内结果作为兜底');}
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
        searchError=''; searchPage=Math.max(searchPage,Number(params.page||1));
        const pageData=rawForPaging&&rawForPaging.data||payload.data||{}; const totalPages=Number(pageData.numPages||pageData.num_pages||pageData.num_pages_by_type&&pageData.num_pages_by_type.video||0);
        const resultCount=category==='user'?users.length:results.length;
        searchHasMore=totalPages?searchPage<totalPages:resultCount>0;
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
      if(!payload || payload.code!==0){dynamicHasMore=false;dynamicError=payload&&payload.code===-101?T('dynamic_login_error','请先登录 Bilibili 后再查看动态'):T('dynamic_load_error','动态读取失败');}
      else {
        const list=Data.normalizeDynamic(payload);const merged=params.append?mergeUnique(dynamicItems,list,item=>item.id||item.video&&item.video.bvid||`${item.author}|${item.time}|${item.text}`):{items:list,added:list.length};dynamicItems=merged.items;dynamicSubscriptions=Data.normalizeDynamicSubscriptions(dynamicItems);dynamicError='';
        dynamicOffset=String(payload.data&&payload.data.offset||'');dynamicHasMore=Boolean(payload.data&&payload.data.has_more)&&list.length>0&&merged.added>0&&Boolean(dynamicOffset);
      }
    }
    else if (type==='watchlater') { watchLaterLoading=false; ingestWatchLater(payload); }
    else if (type==='history-status') {
      if(payload&&payload.code===0) historyPaused=Boolean(payload.data);
    }
    else if (type==='space-profile') {
      const mid=String(params.mid||''); const profile=Data.normalizeSpaceProfile(payload,mid);
      if(profile){profiles.set(mid,profile);const existing=archives.get(mid)||[];if(existing.length)archives.set(mid,existing.map(item=>({...item,author:item.author||profile.name,avatar:item.avatar||profile.avatar,authorHref:item.authorHref||profile.href})));}
      const raw=archivePayloads.get(mid); if(raw && !(archives.get(mid)||[]).length) archives.set(mid,Data.normalizeSpaceArchives(raw,mid,profile||{}));
    } else if (type==='space-archives') {
      const mid=String(params.mid||''); spaceLoading.set(mid,false);
      if(!payload || payload.code!==0){spaceHasMore.set(mid,false);spaceError.set(mid,T('space_unavailable','投稿接口暂时不可用，已保留 B站页面数据兜底'));}
      else {
        const list=Data.normalizeSpaceArchives(payload,mid,profiles.get(mid)||{}); const current=archives.get(mid)||[]; const merged=params.append?mergeUnique(current,list,item=>item.bvid||item.href):{items:list,added:list.length}; archives.set(mid,merged.items); spaceError.set(mid,'');
        const page=Math.max(1,Number(params.page||1)); spacePage.set(mid,page); const count=Number(payload.data&&payload.data.page&&payload.data.page.count||0); spaceHasMore.set(mid,count?page*30<count:list.length>=30&&merged.added>0);
      }
    } else if (type==='favorites') {
      favoriteLoading=false; favoriteFolders=Data.normalizeFavoriteFolders(payload&&payload.folders); favoriteSelectedId=String(payload&&payload.mediaId||favoriteSelectedId||'');
      if(!payload || !payload.resources || payload.resources.code!==0){favoriteHasMore=false;favoriteError=T('favorites_load_error','收藏夹读取失败');}
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
      else if (type!=='account') rerenderCurrentReplace();
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
    const source = homeVideos.length ? homeVideos : Extract.extractSearchCards(document);
    return source.filter(item => homeCategoryMatches(item, category));
  }
  function renderReplace(context, requestData=true) {
    const base=chromeData();
    if(context.route==='home') {
      const category=homeCategory();
      const categoryFromApi=!['all','live','anime'].includes(category);
      if(requestData&&categoryFromApi)homeCategoryLoading=true;
      const homeData={...base,category,videos:homeRenderItems(category),shelves:visibleHomeShelves(),loading:categoryFromApi?homeCategoryLoading:homeLoading,hasMore:categoryFromApi?false:homeHasMore,error:homeCategoryError};
      if(category!=='all')homeData.shelves=visibleHomeShelves(category);
      shell.render('home',homeData);
      armInfiniteLoading();
      if(requestData){homePage=1;homeHasMore=true;homeLoading=true;requestApi('home',{page:1,append:false});requestApi('home-sections');requestApi('subscriptions');if(categoryFromApi)requestApi('home-category',{category});} return;
    }
    if(String(context.route||'').startsWith('search-')) {
      const query=currentQuery(); const category=searchCategoryForRoute(context.route);
      if(requestData&&(searchQueryKey!==query||searchCategoryKey!==category)){searchQueryKey=query;searchCategoryKey=category;searchVideos=[];searchUsers=[];searchPage=1;searchHasMore=true;searchError='';}
      const fallback=!searchVideos.length&&(category==='all'||category==='video')?Extract.extractSearchCards(document):[]; const results=searchVideos.length?searchVideos:fallback;
      shell.render(context.route,{...base,query,category,results,users:searchUsers,videos:results,loading:searchLoading,hasMore:searchHasMore,error:searchError}); armInfiniteLoading();
      if(requestData){searchLoading=true;requestApi('search',{keyword:query,category,page:1,append:false});if(category==='all'||category==='video')scheduleDomRefresh(context,[700]);requestApi('subscriptions');} return;
    }
    if(context.route==='dynamic') {
      const dynamicMode = new URLSearchParams(location.search).get('bilitube_dynamic') || 'all';
      shell.render('dynamic',{...base,items:dynamicItems,mode:dynamicMode,loading:dynamicLoading,hasMore:dynamicHasMore,error:dynamicError});
      armInfiniteLoading();
      if(requestData){dynamicOffset='';dynamicHasMore=true;dynamicError='';dynamicLoading=true;dynamicSubscriptions=[];requestApi('dynamic',{offset:'',append:false});requestApi('subscriptions');} return;
    }
    if(context.route==='watchlater') {
      if(requestData)watchLaterLoading=true;
      shell.render('watchlater',{...base,videos:watchLaterVideos,loading:watchLaterLoading});
      if(requestData){requestApi('watchlater');requestApi('subscriptions');} return;
    }
    if(context.route==='favorites') {
      if(requestData){favoriteSelectedId=new URLSearchParams(location.search).get('fid')||'';favoriteFolders=[];favoriteVideos=[];favoritePage=1;favoriteHasMore=true;favoriteError='';favoriteLoading=true;}
      const selectedFolder=favoriteFolders.find(folder=>String(folder.id)===String(favoriteSelectedId))||favoriteFolders[0]||null;
      shell.render('favorites',{...base,mid:context.mid,folders:favoriteFolders,videos:favoriteVideos,selectedId:favoriteSelectedId,selectedFolder,loading:favoriteLoading,hasMore:favoriteHasMore,error:favoriteError}); armInfiniteLoading();
      if(requestData){favoriteLoading=true;favoritePage=1;favoriteHasMore=true;requestApi('favorites',{mid:context.mid,mediaId:favoriteSelectedId,page:1,append:false});requestApi('subscriptions');} return;
    }
    if(context.route==='space-home'||context.route==='space-upload') {
      const mid=context.mid; const profile=profiles.get(mid)||null; const apiVideos=archives.get(mid)||[]; const videos=apiVideos.length?apiVideos:Extract.extractSearchCards(document);
      shell.render(context.route,{...base,mid,profile,videos,loading:Boolean(spaceLoading.get(mid)),hasMore:spaceHasMore.get(mid)!==false,error:spaceError.get(mid)||''}); if(context.route==='space-upload')armInfiniteLoading();
      if(requestData){spacePage.set(mid,1);spaceHasMore.set(mid,true);spaceLoading.set(mid,true);spaceError.set(mid,'');requestApi('space-profile',{mid});requestApi('space-archives',{mid,page:1,append:false});requestApi('subscriptions');scheduleDomRefresh(context,[900]);}
    }
  }

  function scheduleDomRefresh(context,delays) {
    const myGeneration=generation;
    for(const delay of delays)setTimeout(()=>{
      if(myGeneration!==generation || routeController && routeController.signal.aborted)return;
      const now=Policy.resolve(location); if(now.route!==context.route||now.strategy!=='replace')return;
      if(context.route==='search-video'||context.route==='search-all') {
        if(!searchVideos.length){const videos=Extract.extractSearchCards(document); if(videos.length)shell.render(context.route,{...chromeData(),query:currentQuery(),category:searchCategoryForRoute(context.route),results:videos,users:searchUsers,videos,loading:searchLoading,hasMore:searchHasMore,error:searchError});}
      } else if(context.route==='space-home'||context.route==='space-upload') {
        const existing=archives.get(context.mid)||[]; const fallback=existing.length?[]:Extract.extractSearchCards(document);
        shell.render(context.route,{...chromeData(),mid:context.mid,profile:profiles.get(context.mid)||null,videos:existing.length?existing:fallback,loading:Boolean(spaceLoading.get(context.mid)),hasMore:spaceHasMore.get(context.mid)!==false,error:spaceError.get(context.mid)||''});
      }
    },delay);
  }
  function mount(reason='route') {
    if(!document.body)return;
    generation+=1; const myGeneration=generation;
    if(routeController)routeController.abort(); routeController=new AbortController();
    currentContext=Policy.resolve(location);
    try {
      if(!settings.enabled||currentContext.strategy==='passthrough'){restoreNativePage();return;}
      const theme=effectiveTheme();
      if(currentContext.strategy==='adapt') {
        preview.destroy();watch.destroy();guard.restore();shell.destroy();clearPreflight();
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
  function rerenderCurrentReplace() {
    if(!currentContext||currentContext.strategy!=='replace'||!shell.getRoot())return;
    if (rerenderTimer) return;
    rerenderTimer=setTimeout(()=>{
      rerenderTimer=null;
      if(!currentContext||currentContext.strategy!=='replace'||!shell.getRoot())return;
      shell.updateChrome(chromeData());renderReplace(currentContext,false);
    },60);
  }
  function onBridgeMessage(event) {
    if(event.source!==window||!event.data||event.data.source!==BRIDGE)return;
    const {type,payload}=event.data;
    if(type==='write-result'&&payload&&payload.id){const done=bridgeWritePending.get(String(payload.id));if(done)done(payload.result);return;}
    if(type==='navigation') {
      if(payload&&payload.user)bridgeState.user=payload.user;
      if(payload&&payload.video)bridgeState.video=payload.video;
      queueMicrotask(()=>mount('bridge-navigation'));return;
    }
    if(type==='state') {
      if(payload)bridgeState={user:payload.user||bridgeState.user,video:payload.video||null};
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
    const systemThemeListener=()=>{if(settings.theme==='system')applyThemeOnly();};
    if(mediaQuery.addEventListener)mediaQuery.addEventListener('change',systemThemeListener);else if(mediaQuery.addListener)mediaQuery.addListener(systemThemeListener);
    try{chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local'||!changes.bilitubeCoreSettings)return;const next={...defaults,...(changes.bilitubeCoreSettings.newValue||{})};const enabledChanged=next.enabled!==settings.enabled;settings=next;applyThemeOnly();if(enabledChanged)mount('settings-change');else if(currentContext&&currentContext.strategy==='replace'){if(shell.getRoot()){shell.setCollapsed(settings.sidebarCollapsed);shell.updateChrome(chromeData());renderReplace(currentContext,false);}}else if(currentContext&&currentContext.strategy==='decorate')watch.updateChrome(chromeData());else if(currentContext&&currentContext.strategy==='adapt')nativeAdapter.updateChrome(chromeData(),callbacks);});}catch{}
    loadSettings(()=>{applyThemeOnly();mount('boot');setTimeout(()=>post('state'),450);setTimeout(()=>post('state'),1400);});
  }
  if(document.body)boot();else addEventListener('DOMContentLoaded',boot,{once:true});
})();
