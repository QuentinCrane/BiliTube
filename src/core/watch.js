(function init(root, factory) {
  const ui = root && root.BiliTubeUI || (typeof require === 'function' ? require('./ui.js') : null);
  const extract = root && root.BiliTubeExtract || (typeof require === 'function' ? require('./extract.js') : null);
  const ambient = root && root.BiliTubePlayerAmbient || (typeof require === 'function' ? require('./player-ambient.js') : null);
  const api = factory(ui, extract, ambient);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeWatch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createWatchModule(UI, Extract, Ambient) {
  const T = (key, fallback, substitutions) => {
    const i18n = typeof globalThis !== 'undefined' && globalThis.BiliTubeI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback, substitutions) : fallback;
  };
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
  ].map(def => ({ ...def, selector: def.selectors.join(',') }));
  const REGION_SELECTOR = REGION_DEFS.map(def => def.selector).join(',');
  const PLAYER_INTERIOR = '#playerWrap,#bilibili-player-wrap,#bilibili-player,#bilibiliPlayer,.bpx-player-container';
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
    let authorRetryTimer = null, authorRetries = 0;
    let authorFallbackTimer = null, authorFallback = false;
    let recommendationListening = false;
    const recommendationTargets = new Map();
    const marked = new Set();
    const ambient = Ambient && Ambient.createController(doc);
    let ambientHost = null;

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

    function pruneDetachedMarkers() {
      for (const node of marked) if (!node || node.isConnected === false) marked.delete(node);
    }

    function clearMarkers() {
      for (const node of marked) {
        if (!node || !node.classList) continue;
        for (const { marker } of REGION_DEFS) node.classList.remove(marker);
      }
      marked.clear();
    }

    function restoreRecommendationTargets() {
      for (const [link, state] of recommendationTargets) {
        if (link && link.isConnected !== false && link.getAttribute('target') === state.written) {
          if (state.original == null) link.removeAttribute('target');
          else link.setAttribute('target', state.original);
        }
      }
      recommendationTargets.clear();
    }

    function recommendationLink(event) {
      const target = event.target && (event.target.closest ? event.target : event.target.parentElement);
      const link = target && target.closest && target.closest('a[href]');
      if (!link || !link.closest('.bt-native-watch-related')) return null;
      try {
        const url = new URL(link.href, doc.baseURI);
        if (!/^https?:$/.test(url.protocol) || !/^(?:www\.)?bilibili\.com$/i.test(url.hostname) || !/^\/video\/(?:BV[0-9a-z]+|av\d+)/i.test(url.pathname)) return null;
      } catch { return null; }
      return link;
    }

    function recommendationClick(event) {
      if (!callbacks.openRecommendationsInNewTab || event.defaultPrevented || event.button !== 0) return;
      const link = recommendationLink(event);if (!link) return;
      const enabled = callbacks.openRecommendationsInNewTab();
      const modified = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
      if (!enabled && (modified || link.getAttribute('target') !== '_blank')) return;
      for (const node of recommendationTargets.keys()) if (node.isConnected === false) recommendationTargets.delete(node);
      const written = enabled ? '_blank' : '_self';
      if (!recommendationTargets.has(link)) recommendationTargets.set(link, {original:link.getAttribute('target'),written});
      else recommendationTargets.get(link).written = written;
      link.setAttribute('target', written);
      if (!enabled) return;
      // BPX/Vue also handles this click as an SPA navigation. Let the real
      // anchor open the tab, while preventing that second navigation.
      event.stopPropagation();
    }

    function recommendationKeydown(event) {
      if (event.key !== 'Enter' || event.defaultPrevented || !callbacks.openRecommendationsInNewTab) return;
      // Bilibili's global player shortcut can consume Enter before the focused
      // native anchor activates. Keep the anchor's own browser action intact.
      if (recommendationLink(event)) event.stopPropagation();
    }

    function updateRecommendationPreference() {
      restoreRecommendationTargets();
    }

    function syncAmbient() {
      if (!ambient) return;
      const host = first(REGION_DEFS[4].selectors);
      const enabled = !callbacks.playerAmbient || callbacks.playerAmbient();
      if (host !== ambientHost) { ambientHost = host; ambient.mount(host, enabled); }
      else { ambient.setEnabled(enabled); if (host && enabled) ambient.refresh(); }
    }

    function discoverRegions() {
      pruneDetachedMarkers();
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

    function discoverAddedRegionBatch(nodes, descendants = true, observeApps = false) {
      if (!nodes.length) return;
      pruneDetachedMarkers();
      const player = first(['#playerWrap','#bilibili-player-wrap','#bilibili-player','#bilibiliPlayer','.bpx-player-container']);
      const activeScreens = playerScreens();
      const nativeMode = activeScreens.some(value => ['wide','web','web-fullscreen','pagefullscreen','page-fullscreen'].includes(value));
      let coreChanged = false;
      let eligible = false;
      for (const node of nodes) {
        if (!node || node.nodeType !== 1 || player && player !== node && player.contains(node)) continue;
        const candidates = [node];
        if (descendants && node.querySelectorAll) candidates.push(...node.querySelectorAll(observeApps ? `${REGION_SELECTOR},#app` : REGION_SELECTOR));
        for (const candidate of candidates) {
          if (observeApps && candidate.matches?.('#app') && regionObserver) regionObserver.observe(candidate, { childList: true, subtree: true });
          if (nativeMode) continue;
          eligible = true;
          if (!candidate.matches?.(REGION_SELECTOR)) continue;
          for (const def of REGION_DEFS) {
            try {
              if (candidate.matches && candidate.matches(def.selector)) {
                const added = mark(candidate, def.marker);
                if (CORE_MARKERS.has(def.marker) && added) coreChanged = true;
              }
            } catch {}
          }
        }
      }
      if (!eligible) return;
      ensureAuthorRow();
      if (coreChanged) {
        const ready = coreRegionsReady();
        if (ready) {
          discoverRegions();
          startObservers(ready);
          syncPlayerMode();
          syncAmbient();
        }
      }
    }

    function discoverAddedRegions(node, descendants = true) {
      // Single-node entry used by the class observer: only the markers on this
      // node can be missing after a Vue class rewrite. Restoring them in place
      // keeps the running observers untouched; the heavy batch path (player
      // lookup, region rediscovery, observer restart) belongs to added subtrees.
      if (!node || node.nodeType !== 1) return;
      if (descendants) { discoverAddedRegionBatch([node], true); return; }
      for (const def of REGION_DEFS) {
        if (node.classList.contains(def.marker)) continue;
        try { if (node.matches(def.selector)) mark(node, def.marker); } catch {}
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
      const actions = authorRow.querySelector('.bt-watch-author-actions') || authorRow;
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
          // A native SPA navigation can change the URL before the bridge has
          // delivered the next video's metadata.
          const match = doc.location && doc.location.pathname.match(/^\/video\/(BV[0-9A-Za-z]+|av\d+)(?:\/|$)/i);
          if (match && /^av/i.test(match[1]) && Number(match[1].slice(2)) !== nextItem.aid) {
            nextItem.bvid = ''; nextItem.aid = Number(match[1].slice(2));
          } else if (match && /^BV/i.test(match[1]) && match[1] !== nextItem.bvid) {
            nextItem.bvid = match[1]; nextItem.aid = 0;
          }
          try {
            const next = await callbacks.toggleWatchLater(nextItem, button);
            if (typeof next === 'boolean' && button.dataset.bvid === nextItem.bvid) syncWatchLaterButton(button, next);
          } catch {
            if (callbacks.showToast) callbacks.showToast(T('watch_later_error','稍后再看操作失败'));
          } finally {
            button.classList.remove('is-loading');
            button.removeAttribute('aria-busy');
          }
        });
        actions.append(button);
      }
      button.dataset.bvid = item.bvid;
      button.dataset.aid = String(item.aid || '');
      const active = typeof callbacks.isWatchLater === 'function' && callbacks.isWatchLater(item);
      syncWatchLaterButton(button, Boolean(active));
      return true;
    }

    function syncWatchLaterButton(button, active) {
      if (!button) return;
      const title = active ? T('remove_watch_later','从稍后再看移除') : T('add_watch_later','稍后再看');
      button.classList.toggle('is-active', Boolean(active));
      button.setAttribute('aria-pressed', String(Boolean(active)));
      button.title = title;
      button.setAttribute('aria-label', title);
      const label = button.querySelector('.bt-watchlater-label');
      if (label) label.textContent = active ? T('watch_later_added','已加入稍后再看') : T('add_watch_later','稍后再看');
    }

    function ensureAuthorRow() {
      // Keep the native-author layout once the startup fallback is visible;
      // late hydration must not move an already-visible recommendation list.
      // The narrow layout has no visible aside to preserve; it may still fill
      // the reserved author slot when hydration eventually completes.
      if (authorFallback && (!doc.defaultView || !doc.defaultView.matchMedia || !doc.defaultView.matchMedia('(max-width:900px)').matches)) return false;
      // The SSR page can start its player before Vue hydrates #app. Adding a
      // child to its columns at that point invalidates hydration and causes
      // Bilibili to disconnect and recreate the already-loading player.
      const app=doc.querySelector('#app');
      const hydrated=callbacks.canDecorateAuthor?callbacks.canDecorateAuthor():!app;
      if(!hydrated){
        if(!authorRetryTimer&&authorRetries<MAX_RETRIES){authorRetries++;authorRetryTimer=setTimeout(()=>{authorRetryTimer=null;ensureAuthorRow();},200);}
        return false;
      }
      if(authorRetryTimer){clearTimeout(authorRetryTimer);authorRetryTimer=null;}
      const creator = watchData && watchData.creator || {};
      const signature = [creator.name || '', creator.href || '', creator.avatar || '', creator.following ? '1' : '0'].join('|');
      // The unchanged fast path must not depend on re-finding the main column;
      // comment batches call this every delivery and the lookup is pure cost.
      if (authorRow && authorRow.isConnected && authorSignature === signature) { ensureWatchLaterButton(); return true; }
      const main = first(['.bt-native-watch-main','.video-container-v1 > .left-container','#mirror-vdcon.video-container-v1 > .left-container','.video-page-container > .left-container']);
      if (!main || !creator.name) return false;
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
      const name = UI.e('a', 'bt-watch-author-name', creator.name || T('uploader','UP主'));
      name.href = creator.href || '#';
      text.append(name);
      identity.append(avatarLink, text);
      const actions = UI.e('div', 'bt-watch-author-actions');
      authorRow.append(identity, actions);

      const mid = creatorMid(creator);
      if (mid && callbacks.followSpace) {
        const follow = UI.e('button', `bt-watch-follow${creator.following ? ' is-following' : ''}`, creator.following ? T('following','已关注') : T('follow','关注'));
        follow.type = 'button';
        follow.addEventListener('click', async () => {
          follow.disabled = true;
          const ok = await callbacks.followSpace(mid, Boolean(creator.following));
          follow.disabled = false;
          if (ok) {
            creator.following = !Boolean(creator.following);
            follow.classList.toggle('is-following', Boolean(creator.following));
            follow.textContent = creator.following ? T('following','已关注') : T('follow','关注');
            authorSignature = [creator.name || '', creator.href || '', creator.avatar || '', creator.following ? '1' : '0'].join('|');
          }
        });
        actions.append(follow);
      }
      authorSignature = signature;
      doc.documentElement.classList.add('bt-watch-author-ready');
      if (authorFallback) { authorFallback = false; doc.documentElement.classList.remove('bt-watch-author-fallback'); }
      if (authorFallbackTimer) { clearTimeout(authorFallbackTimer); authorFallbackTimer = null; }
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
          const added = new Set();
          for (const mutation of mutations) {
            // Danmaku, player controls and extension chrome cannot introduce
            // layout regions. Reject the whole mutation before querying nodes.
            if (mutation.target.closest?.(`${PLAYER_INTERIOR},#bilitube-watch-layer,.bt-watch-author-row`)) continue;
            for (const node of mutation.addedNodes || []) {
              if (node && node.nodeType === 1 && node.isConnected !== false) added.add(node);
            }
          }
          const roots = [];
          for (const node of added) {
            let parent=node.parentElement;
            while(parent&&!added.has(parent))parent=parent.parentElement;
            if(parent)continue;
            roots.push(node);
          }
          // Player state and author readiness are shared by the whole delivery,
          // not by each of the many sibling nodes in a comment update.
          discoverAddedRegionBatch(roots, true, true);
        });
        const app = doc.querySelector('#app');
        const appParent = app && app.parentElement;
        if (app) {
          if (doc.body) regionObserver.observe(doc.body, { childList: true });
          if (appParent && appParent !== doc.body) regionObserver.observe(appParent, { childList: true });
          regionObserver.observe(app, { childList: true, subtree: true });
        } else {
          regionObserver.observe(doc.body || ready.layout.parentElement || layout, { childList: true, subtree: true });
        }
        classObserver = new MutationObserver((mutations) => {
          const changed = new Set();
          for (const mutation of mutations) {
            if (mutation.type === 'attributes') changed.add(mutation.target);
          }
          for (const node of changed) {
            // Our marker writes also fire this observer. Only a missing native
            // region marker needs restoration; its descendants did not change.
            if (REGION_DEFS.some(def => CORE_MARKERS.has(def.marker) && !node.classList.contains(def.marker) && node.matches(def.selector))) discoverAddedRegions(node, false);
          }
        });
        // Related-video navigation reuses this host and Vue rewrites its class.
        // Restore its marker before paint so flex order cannot send it below comments.
        for (const node of [ready.layout, ready.main, ready.aside, ready.player, ready.info]) {
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
      UI.updateChrome(layer,chromeData,callbacks);
    }

    function tryMount(theme) {
      const player = Extract && Extract.findPlayer ? Extract.findPlayer(doc) : first(['#playerWrap','#bilibili-player','#bilibiliPlayer','.bpx-player-container']);
      const ready = coreRegionsReady();
      if (!player || !player.isConnected || !ready) return false;
      ensureLayer(theme);
      if (!authorFallbackTimer) authorFallbackTimer = setTimeout(() => {
        authorFallbackTimer = null;
        if (authorRow && authorRow.isConnected) return;
        authorFallback = true;
        if (authorRetryTimer) { clearTimeout(authorRetryTimer); authorRetryTimer = null; }
        doc.documentElement.classList.add('bt-watch-author-fallback');
      }, 6000);
      discoverRegions();
      syncPlayerMode();
      syncAmbient();
      doc.documentElement.classList.add('bt-watch-decorated','bt-watch-ready');
      doc.documentElement.classList.remove('bilitube-watch-preflight');
      if (!recommendationListening) { doc.addEventListener('click', recommendationClick, true); doc.addEventListener('keydown', recommendationKeydown, true); recommendationListening = true; }
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

    function updateContext(nextData = {}) { watchData = { ...watchData, ...nextData }; ensureAuthorRow(); syncPlayerMode(); syncAmbient(); }
    function updateTheme(theme) { if (layer) layer.dataset.btTheme = theme; }
    function toggleSidebar() { if (drawer) drawer.toggle(); }
    function revealNativeMeta() { clearMarkers(); discoverRegions(); }

    function destroy(clearCallbacks = true) {
      if (authorFallbackTimer) clearTimeout(authorFallbackTimer);
      authorFallbackTimer = null; authorFallback = false;
      if(authorRetryTimer)clearTimeout(authorRetryTimer);authorRetryTimer=null;authorRetries=0;
      doc.documentElement.classList.remove('bt-watch-author-ready','bt-watch-author-fallback');
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      retryCount = 0;
      stopObservers();
      if (ambient) ambient.destroy();
      ambientHost = null;
      if (recommendationListening) { doc.removeEventListener('click', recommendationClick, true); doc.removeEventListener('keydown', recommendationKeydown, true); }
      recommendationListening = false;
      restoreRecommendationTargets();
      clearMarkers();
      if (authorRow) authorRow.remove();
      authorRow = null;
      authorSignature = '';
      if (layer) layer.remove();
      layer = null;
      drawer = null;
      for (const cls of ROOT_CLASSES) doc.documentElement.classList.remove(cls);
      if (clearCallbacks) {
        doc.documentElement.classList.remove('bilitube-watch-preflight');
        callbacks = {};
        chromeData = {};
        watchData = {};
      }
    }

    return { mount, updateContext, updateChrome, updateTheme, updateRecommendationPreference, syncAmbient, toggleSidebar, destroy, revealNativeMeta };
  }

  return { createDecorator, MAX_RETRIES };
});
