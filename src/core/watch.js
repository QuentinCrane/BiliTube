(function init(root, factory) {
  const ui = root && root.BiliTubeUI || (typeof require === 'function' ? require('./ui.js') : null);
  const extract = root && root.BiliTubeExtract || (typeof require === 'function' ? require('./extract.js') : null);
  const api = factory(ui, extract);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeWatch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createWatchModule(UI, Extract) {
  const MAX_RETRIES = 24;
  const REGION_DEFS = [
    { marker: 'bt-watch-native-layout', selectors: ['.video-container-v1', '#mirror-vdcon.video-container-v1', '.video-page-container', '.video-container'] },
    { marker: 'bt-native-watch-main', selectors: ['.video-container-v1 > .left-container', '#mirror-vdcon.video-container-v1 > .left-container', '.video-page-container > .left-container'] },
    { marker: 'bt-native-watch-aside', selectors: ['.video-container-v1 > .right-container', '#mirror-vdcon.video-container-v1 > .right-container', '.video-page-container > .right-container'] },
    { marker: 'bt-native-watch-aside-inner', selectors: ['.right-container > .right-container-inner', '.right-container-inner', '.video-right-container'] },
    { marker: 'bt-native-watch-player-host', selectors: ['#playerWrap', '#bilibili-player-wrap', '.video-player-container', '.player-wrap', '#bilibili-player', '#bilibiliPlayer'] },
    { marker: 'bt-native-watch-info', selectors: ['.video-info-container', '#viewbox_report', '.video-info-v1'] },
    { marker: 'bt-native-watch-up', selectors: ['.up-panel-container', '.up-info-container', '.members-info-container', '.membersinfo-normal'] },
    { marker: 'bt-native-watch-toolbar', selectors: ['#arc_toolbar_report', '.video-toolbar-container', '.video-toolbar-v1', '.video-toolbar'] },
    { marker: 'bt-native-watch-description', selectors: ['#v_desc', '.video-desc-container', '.video-desc'] },
    { marker: 'bt-native-watch-comments', selectors: ['#comment-module', '#comment-body', '#commentapp', '.commentapp', '.comment-container', '.bili-comment-container', '.bb-comment', 'bili-comments'] },
    { marker: 'bt-native-watch-related', selectors: ['.recommend-list-v1', '.recommend-list', '.rec-list', '.next-play', '.video-page-card-small-list', '.video-card-list', '.related-list', '[class*=recommend_wrap]'] },
  ];
  const ROOT_CLASSES = ['bt-watch-decorated','bt-watch-ready','bt-player-wide','bt-player-web-fullscreen','bt-player-mini','bt-player-browser-fullscreen'];
  const CORE_MARKERS = new Set(['bt-watch-native-layout','bt-native-watch-main','bt-native-watch-aside','bt-native-watch-player-host','bt-native-watch-info']);

  function createDecorator(doc = document) {
    let layer = null;
    let drawer = null;
    let callbacks = {};
    let chromeData = {};
    let retryTimer = null;
    let retryCount = 0;
    let regionObserver = null;
    let classObserver = null;
    let modeObserver = null;
    let modeSyncTimer = null;
    let fullscreenHandler = null;
    let watchData = {};
    let authorRow = null;
    let authorSignature = '';
    const marked = new Set();

    function first(selectors, root = doc) {
      for (const selector of selectors) {
        try {
          const node = root.querySelector(selector);
          if (node) return node;
        } catch {}
      }
      return null;
    }

    function all(selectors, root = doc) {
      const out = [];
      const seen = new Set();
      for (const selector of selectors) {
        try {
          for (const node of root.querySelectorAll(selector)) {
            if (seen.has(node)) continue;
            seen.add(node);
            out.push(node);
          }
        } catch {}
      }
      return out;
    }

    function mark(node, marker) {
      if (!node || !node.classList) return false;
      const added = !node.classList.contains(marker);
      if (added) node.classList.add(marker);
      marked.add(node);
      return added;
    }

    function clearMarkers() {
      for (const node of marked) {
        if (!node || !node.classList) continue;
        for (const { marker } of REGION_DEFS) node.classList.remove(marker);
      }
      marked.clear();
    }

    function discoverRegions() {
      let found = 0;
      for (const def of REGION_DEFS) {
        if (def.marker === 'bt-native-watch-related') {
          for (const node of all(def.selectors)) {
            if (mark(node, def.marker)) found += 1;
          }
          continue;
        }
        const node = first(def.selectors);
        if (node && mark(node, def.marker)) found += 1;
      }
      ensureAuthorRow();
      return found;
    }

    function coreRegionsReady() {
      const layout = first(REGION_DEFS[0].selectors);
      const main = first(REGION_DEFS[1].selectors);
      const aside = first(REGION_DEFS[2].selectors);
      const player = first(REGION_DEFS[4].selectors);
      const info = first(REGION_DEFS[5].selectors);
      if (!layout || !main || !aside || !player || !info) return null;
      return { layout, main, aside, player, info };
    }

    function discoverAddedRegions(node) {
      if (!node || node.nodeType !== 1) return;
      const player = first(['#playerWrap','#bilibili-player-wrap','#bilibili-player','#bilibiliPlayer','.bpx-player-container']);
      if (player && player !== node && player.contains(node)) return;
      const activeScreens = playerScreens();
      if (activeScreens.some(value => ['wide','web','web-fullscreen','pagefullscreen','page-fullscreen'].includes(value))) return;
      const lateMarkers = new Set([
        'bt-native-watch-up','bt-native-watch-toolbar','bt-native-watch-description',
        'bt-native-watch-comments','bt-native-watch-related','bt-native-watch-aside-inner'
      ]);
      const observedMarkers = new Set([...lateMarkers, ...CORE_MARKERS]);
      let coreChanged = false;
      for (const def of REGION_DEFS) {
        if (!observedMarkers.has(def.marker)) continue;
        for (const selector of def.selectors) {
          try {
            if (node.matches && node.matches(selector)) coreChanged = CORE_MARKERS.has(def.marker) && mark(node, def.marker) || coreChanged;
            if (node.querySelectorAll) {
              for (const child of node.querySelectorAll(selector)) {
                const added = mark(child, def.marker);
                if (CORE_MARKERS.has(def.marker) && added) coreChanged = true;
              }
            }
          } catch {}
        }
      }
      ensureAuthorRow();
      if (coreChanged) {
        const ready = coreRegionsReady();
        if (ready) {
          discoverRegions();
          startObservers(ready);
          syncPlayerMode();
        }
      }
    }

    function creatorMid(creator = {}) {
      const href = String(creator.href || '');
      const match = href.match(/space\.bilibili\.com\/(\d+)/);
      return match ? match[1] : '';
    }

    function ensureWatchLaterButton() {
      if (!authorRow || !watchData || !watchData.bvid || !callbacks.toggleWatchLater) return false;
      const item = { bvid:String(watchData.bvid), aid:Number(watchData.aid || 0), title:String(watchData.title || '') };
      let button = authorRow.querySelector('.bt-watchlater-watch');
      if (!button) {
        button = UI.e('button', 'bt-watchlater-watch');
        button.type = 'button';
        button.append(UI.icon('watchLater'), UI.e('span', 'bt-watchlater-label'));
        button.addEventListener('click', async (event) => {
          if (button.classList.contains('is-loading')) return;
          button.classList.add('is-loading');
          button.setAttribute('aria-busy', 'true');
          const nextItem = { bvid:String(button.dataset.bvid || ''), aid:Number(button.dataset.aid || 0), title:String(watchData.title || '') };
          const next = await callbacks.toggleWatchLater(nextItem, button);
          button.classList.remove('is-loading');
          button.removeAttribute('aria-busy');
          if (typeof next === 'boolean') syncWatchLaterButton(button, next);
        });
        authorRow.append(button);
      }
      button.dataset.bvid = item.bvid;
      button.dataset.aid = String(item.aid || '');
      const active = typeof callbacks.isWatchLater === 'function' && callbacks.isWatchLater(item);
      syncWatchLaterButton(button, Boolean(active));
      return true;
    }

    function syncWatchLaterButton(button, active) {
      if (!button) return;
      const title = active ? '从稍后再看移除' : '稍后再看';
      button.classList.toggle('is-active', Boolean(active));
      button.setAttribute('aria-pressed', String(Boolean(active)));
      button.title = title;
      button.setAttribute('aria-label', title);
      const label = button.querySelector('.bt-watchlater-label');
      if (label) label.textContent = active ? '已加入稍后再看' : '稍后再看';
    }

    function ensureAuthorRow() {
      const main = first(['.bt-native-watch-main','.video-container-v1 > .left-container','#mirror-vdcon.video-container-v1 > .left-container','.video-page-container > .left-container']);
      const creator = watchData && watchData.creator || {};
      if (!main || !creator.name) return false;
      const signature = [creator.name || '', creator.href || '', creator.avatar || '', creator.following ? '1' : '0'].join('|');
      if (authorRow && authorRow.isConnected && authorSignature === signature) { ensureWatchLaterButton(); return true; }
      if (!authorRow || !authorRow.isConnected) {
        authorRow = UI.e('section', 'bt-watch-author-row');
        authorRow.dataset.btOwned = 'true';
        main.append(authorRow);
      }
      authorRow.replaceChildren();
      const identity = UI.e('div', 'bt-watch-author-identity');
      const avatarLink = UI.e('a', 'bt-watch-author-avatar');
      avatarLink.href = creator.href || '#';
      if (creator.avatar) {
        const img = UI.e('img', '');
        img.src = creator.avatar;
        img.alt = creator.name || '';
        avatarLink.append(img);
      } else {
        avatarLink.textContent = String(creator.name || 'UP').slice(0, 1);
      }
      const text = UI.e('div', 'bt-watch-author-text');
      const name = UI.e('a', 'bt-watch-author-name', creator.name || 'UP主');
      name.href = creator.href || '#';
      text.append(name);
      identity.append(avatarLink, text);
      authorRow.append(identity);

      const mid = creatorMid(creator);
      if (mid && callbacks.followSpace) {
        const follow = UI.e('button', `bt-watch-follow${creator.following ? ' is-following' : ''}`, creator.following ? '已关注' : '关注');
        follow.type = 'button';
        follow.addEventListener('click', async () => {
          follow.disabled = true;
          const ok = await callbacks.followSpace(mid, Boolean(creator.following));
          follow.disabled = false;
          if (ok) {
            creator.following = !Boolean(creator.following);
            follow.classList.toggle('is-following', Boolean(creator.following));
            follow.textContent = creator.following ? '已关注' : '关注';
            authorSignature = [creator.name || '', creator.href || '', creator.avatar || '', creator.following ? '1' : '0'].join('|');
          }
        });
        authorRow.append(follow);
      }
      authorSignature = signature;
      ensureWatchLaterButton();
      return true;
    }

    function playerScreens() {
      const player = first(REGION_DEFS[4].selectors);
      if (!player) return [];
      const values = [];
      const nodes = [];
      try {
        if (player.hasAttribute && player.hasAttribute('data-screen')) nodes.push(player);
        nodes.push(...player.querySelectorAll('[data-screen]'));
      } catch {}
      for (const node of nodes) {
        const value = String(node.getAttribute('data-screen') || '').toLowerCase();
        if (value) values.push(value);
      }
      return values;
    }

    function syncPlayerMode() {
      const screens = playerScreens();
      const html = doc.documentElement;
      const browserFull = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
      const web = browserFull || screens.some(value => ['web','web-fullscreen','pagefullscreen','page-fullscreen'].includes(value));
      const wide = !web && screens.includes('wide');
      const mini = !web && screens.includes('mini');
      html.classList.toggle('bt-player-wide', wide);
      html.classList.toggle('bt-player-web-fullscreen', web);
      html.classList.toggle('bt-player-mini', mini);
      html.classList.toggle('bt-player-browser-fullscreen', browserFull);
      const nativeMode = web || wide;
      if (nativeMode) {
        if (web) clearMarkers();
        if (regionObserver) { regionObserver.disconnect(); regionObserver = null; }
        if (classObserver) { classObserver.disconnect(); classObserver = null; }
      } else if (modeObserver && !regionObserver) {
        const ready = coreRegionsReady();
        if (ready) { discoverRegions(); startObservers(ready); }
      }
    }

    function schedulePlayerModeSync() {
      if (modeSyncTimer != null) return;
      const run = () => { modeSyncTimer = null; syncPlayerMode(); };
      if (typeof requestAnimationFrame === 'function') modeSyncTimer = requestAnimationFrame(run);
      else modeSyncTimer = setTimeout(run, 0);
    }

    function startObservers(ready = coreRegionsReady()) {
      stopObservers();
      if (typeof MutationObserver === 'function' && ready && ready.layout) {
        const layout = ready.layout;
        regionObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes || []) discoverAddedRegions(node);
          }
        });
        regionObserver.observe(ready.layout.parentElement || layout, { childList: true, subtree: true });
        classObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === 'attributes') discoverAddedRegions(mutation.target);
          }
        });
        for (const node of [ready.layout, ready.main, ready.aside, ready.info]) {
          if (node) classObserver.observe(node, { attributes: true, attributeFilter: ['class'] });
        }
        modeObserver = new MutationObserver(schedulePlayerModeSync);
        modeObserver.observe(ready.player, { subtree: true, attributes: true, attributeFilter: ['data-screen'] });
      }
      fullscreenHandler = schedulePlayerModeSync;
      doc.addEventListener('fullscreenchange', fullscreenHandler);
      doc.addEventListener('webkitfullscreenchange', fullscreenHandler);
    }

    function stopObservers() {
      if (regionObserver) regionObserver.disconnect();
      if (classObserver) classObserver.disconnect();
      if (modeObserver) modeObserver.disconnect();
      regionObserver = null;
      classObserver = null;
      modeObserver = null;
      if (modeSyncTimer != null) {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(modeSyncTimer);
        else clearTimeout(modeSyncTimer);
      }
      modeSyncTimer = null;
      if (fullscreenHandler) {
        doc.removeEventListener('fullscreenchange', fullscreenHandler);
        doc.removeEventListener('webkitfullscreenchange', fullscreenHandler);
      }
      fullscreenHandler = null;
    }

    function ensureLayer(theme = 'light') {
      if (layer && layer.isConnected) {
        layer.dataset.btTheme = theme;
        return;
      }
      layer = UI.e('div', 'bt-watch-layer');
      layer.id = 'bilitube-watch-layer';
      layer.dataset.btTheme = theme;
      layer.append(UI.createTopbar(chromeData, callbacks));
      drawer = UI.createSidebarDrawer(chromeData, callbacks);
      layer.append(drawer.backdrop);
      doc.body.append(layer);
    }

    function updateChrome(next = {}) {
      chromeData = { ...chromeData, ...next };
      if (!layer) return;
      const wasOpen = drawer && drawer.isOpen();
      const oldHeader = layer.querySelector('[data-role="header"]');
      if (oldHeader) oldHeader.replaceWith(UI.createTopbar(chromeData, callbacks));
      if (drawer) drawer.backdrop.remove();
      drawer = UI.createSidebarDrawer(chromeData, callbacks);
      layer.append(drawer.backdrop);
      if (wasOpen) drawer.toggle();
    }

    function tryMount(theme) {
      const player = Extract && Extract.findPlayer ? Extract.findPlayer(doc) : first(['#playerWrap','#bilibili-player','#bilibiliPlayer','.bpx-player-container']);
      const ready = coreRegionsReady();
      if (!player || !player.isConnected || !ready) return false;
      ensureLayer(theme);
      discoverRegions();
      syncPlayerMode();
      doc.documentElement.classList.add('bt-watch-decorated','bt-watch-ready');
      doc.documentElement.classList.remove('bilitube-watch-preflight');
      startObservers(ready);
      retryCount = 0;
      return true;
    }

    function mount(_data = {}, nextCallbacks = {}, theme = 'light', nextChromeData = {}) {
      watchData = _data || {};
      callbacks = nextCallbacks || {};
      chromeData = { ...chromeData, ...nextChromeData };
      destroy(false);
      callbacks = nextCallbacks || {};
      chromeData = { ...chromeData, ...nextChromeData };
      if (tryMount(theme)) return true;
      const retry = () => {
        if (tryMount(theme)) return;
        retryCount += 1;
        if (retryCount >= MAX_RETRIES) { retryTimer = null; doc.documentElement.classList.remove('bilitube-watch-preflight'); return; }
        retryTimer = setTimeout(retry, 140 + Math.min(360, retryCount * 18));
      };
      retryCount = 0;
      retryTimer = setTimeout(retry, 140);
      return false;
    }

    function updateContext(nextData = {}) { watchData = { ...watchData, ...nextData }; ensureAuthorRow(); syncPlayerMode(); }
    function updateTheme(theme) { if (layer) layer.dataset.btTheme = theme; }
    function toggleSidebar() { if (drawer) drawer.toggle(); }
    function revealNativeMeta() { clearMarkers(); discoverRegions(); }

    function destroy(clearCallbacks = true) {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      retryCount = 0;
      stopObservers();
      clearMarkers();
      if (authorRow) authorRow.remove();
      authorRow = null;
      authorSignature = '';
      if (layer) layer.remove();
      layer = null;
      drawer = null;
      for (const cls of ROOT_CLASSES) doc.documentElement.classList.remove(cls);
      if (clearCallbacks) {
        callbacks = {};
        chromeData = {};
        watchData = {};
      }
    }

    return { mount, updateContext, updateChrome, updateTheme, toggleSidebar, destroy, revealNativeMeta };
  }

  return { createDecorator, MAX_RETRIES };
});
