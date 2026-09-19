(() => {
  'use strict';
  const host = location.hostname.toLowerCase();
  const path = location.pathname || '/';
  let replace = false;
  const nativeEscape = new URLSearchParams(location.search).get('bilitube_native') === '1';
  const watch = (host === 'www.bilibili.com' || host === 'bilibili.com') && /^\/video\//.test(path);

  if (host === 'www.bilibili.com' || host === 'bilibili.com') {
    replace = path === '/' || path === '' || /^\/dynamic(?:\/|$)/.test(path) || /^\/(?:history|account\/history)(?:\/|$)/.test(path) || /^\/watchlater(?:\/|$)/.test(path) || /^\/list\/watchlater(?:\/|$)/.test(path);
  } else if (host === 'search.bilibili.com') {
    replace = /^\/(?:|all|video)\/?$/.test(path);
  } else if (host === 'space.bilibili.com') {
    const match = path.match(/^\/(\d+)(?:\/([^/?#]+))?\/?/);
    const sub = match ? String(match[2] || '').toLowerCase() : '';
    replace = Boolean(match && (!sub || sub === 'home' || sub === 'upload' || sub === 'video' || sub === 'favlist'));
  } else if (host === 't.bilibili.com') {
    replace = !/^\/(?:vote|share)(?:\/|$)/.test(path);
  }

  if (replace && !nativeEscape) document.documentElement.classList.add('bilitube-core-preflight');
  if (watch && !nativeEscape) document.documentElement.classList.add('bilitube-watch-preflight');

  try {
    chrome.storage.local.get(['bilitubeCoreSettings'], (result) => {
      const saved = result && result.bilitubeCoreSettings || {};
      if (saved.enabled === false) {
        document.documentElement.classList.remove('bilitube-core-preflight');
        document.documentElement.classList.remove('bilitube-watch-preflight');
        return;
      }
      const systemDark = matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = saved.theme === 'dark' ? 'dark' : saved.theme === 'light' ? 'light' : systemDark ? 'dark' : 'light';
      document.documentElement.dataset.btTheme = theme;
    });
  } catch {}
})();
