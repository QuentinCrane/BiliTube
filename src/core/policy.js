(function init(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubePolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPolicy() {
  function cleanHost(value) { return String(value || '').toLowerCase(); }
  function resolve(locationLike) {
    const hostname = cleanHost(locationLike && locationLike.hostname);
    const pathname = String(locationLike && locationLike.pathname || '/');
    const search = String(locationLike && locationLike.search || '');
    if (new URLSearchParams(search).get('bilitube_native') === '1') return { route: 'native-escape', strategy: 'passthrough' };

    if (hostname === 'www.bilibili.com' || hostname === 'bilibili.com') {
      if (pathname === '/' || pathname === '') return { route: 'home', strategy: 'replace' };
      if (/^\/dynamic(?:\/|$)/.test(pathname)) return { route: 'dynamic', strategy: 'replace' };
      if (/^\/video\/BV[0-9A-Za-z]+/.test(pathname)) return { route: 'watch', strategy: 'decorate' };
      if (/^\/(?:history|account\/history)(?:\/|$)/.test(pathname)) return { route: 'history', strategy: 'adapt' };
      if (/^\/watchlater(?:\/|$)/.test(pathname) || /^\/list\/watchlater(?:\/|$)/.test(pathname)) return { route: 'watchlater', strategy: 'replace' };
      if (/^\/(?:medialist\/play\/ml|list\/ml)/.test(pathname)) return { route: 'playlist-watch', strategy: 'adapt' };
      if (/^\/cheese\/play\//.test(pathname)) return { route: 'course-watch', strategy: 'adapt' };
      if (/^\/festival\//.test(pathname)) return { route: 'native-content', strategy: 'adapt' };
      if (/^\/opus\//.test(pathname)) return { route: 'dynamic-detail', strategy: 'adapt' };
      if (/^\/bangumi\/play\//.test(pathname)) return { route: 'bangumi-watch', strategy: 'adapt' };
      if (/^\/v\/popular(?:\/|$)/.test(pathname)) return { route: 'popular', strategy: 'adapt' };
      if (/^\/(?:v\/|anime(?:\/|$)|guochuang(?:\/|$)|tv(?:\/|$)|movie(?:\/|$)|variety(?:\/|$)|documentary(?:\/|$)|mooc(?:\/|$)|read\/)/.test(pathname)) return { route: 'native-content', strategy: 'adapt' };
      if (/^\/account(?:\/|$)/.test(pathname)) return { route: 'account', strategy: 'adapt' };
      return { route: 'native', strategy: 'adapt' };
    }

    if (hostname === 'search.bilibili.com') {
      if (/^\/(?:|all)\/?$/.test(pathname)) return { route: 'search-all', strategy: 'replace' };
      if (/^\/video\/?$/.test(pathname)) return { route: 'search-video', strategy: 'replace' };
      if (/^\/upuser\/?$/.test(pathname)) return { route: 'search-user', strategy: 'replace' };
      if (/^\/bangumi\/?$/.test(pathname)) return { route: 'search-bangumi', strategy: 'replace' };
      if (/^\/media_ft\/?$/.test(pathname)) return { route: 'search-media', strategy: 'replace' };
      return { route: 'search-native', strategy: 'adapt' };
    }

    if (hostname === 'space.bilibili.com') {
      const match = pathname.match(/^\/(\d+)(?:\/([^/?#]+))?\/?/);
      if (!match) return { route: 'space-native', strategy: 'adapt' };
      const mid = match[1];
      const sub = String(match[2] || '').toLowerCase();
      if (!sub || sub === 'home') return { route: 'space-home', strategy: 'replace', mid };
      if (sub === 'upload' || sub === 'video') return { route: 'space-upload', strategy: 'replace', mid };
      if (sub === 'favlist') return { route: 'favorites', strategy: 'replace', mid };
      return { route: `space-${sub}`, strategy: 'adapt', mid };
    }

    if (hostname === 't.bilibili.com') {
      if (/^\/(?:vote|share)(?:\/|$)/.test(pathname)) return { route: 'dynamic-native', strategy: 'adapt' };
      return { route: 'dynamic', strategy: 'replace' };
    }
    if (hostname === 'message.bilibili.com') return { route: 'message', strategy: 'adapt' };
    if (hostname === 'live.bilibili.com') return { route: 'live', strategy: 'adapt' };
    if (hostname === 'member.bilibili.com') return { route: 'creator', strategy: 'adapt' };
    if (hostname === 'account.bilibili.com') return { route: 'account', strategy: 'adapt' };

    return { route: 'native', strategy: 'passthrough' };
  }
  return { resolve };
});
