'use strict';

if (typeof importScripts === 'function') importScripts('core/wbi.js');

function t(key, fallback, substitutions) {
  try {
    const getMessage = typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage;
    if (typeof getMessage === 'function') {
      const values = Array.isArray(substitutions) ? substitutions : substitutions == null ? [] : [String(substitutions)];
      const message = getMessage.call(chrome.i18n, key, values);
      if (message) return message;
    }
  } catch {}
  return fallback;
}

const cache = new Map();
const CACHE_LIMIT = 256;
function cached(key, ttl, loader) {
  const now = Date.now();
  const item = cache.get(key);
  if (item && item.expiresAt > now) {
    cache.delete(key); cache.set(key, item);
    return item.value;
  }
  for (const [id, entry] of cache) if (entry.expiresAt <= now) cache.delete(id);
  const value = Promise.resolve().then(loader).catch(() => null);
  const entry = { value, expiresAt: now + ttl };
  cache.delete(key); cache.set(key, entry);
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  // A write or eviction may invalidate this entry before the read completes.
  value.then((resolved) => {
    if (cache.get(key) !== entry) return;
    if (resolved == null || resolved.code != null && resolved.code !== 0) cache.delete(key);
    else entry.expiresAt = Date.now() + ttl;
  });
  return value;
}
async function json(url) {
  const signal=typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout==='function'?AbortSignal.timeout(3500):undefined;
  const response = await fetch(url, { credentials:'include', cache:'no-store', signal, headers:{ Accept:'application/json, text/plain, */*' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
async function postForm(url, data = {}) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === '') continue;
    body.set(key, String(value));
  }
  const response = await fetch(url, {
    method:'POST',
    credentials:'include',
    headers:{
      Accept:'application/json, text/plain, */*',
      'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body:body.toString(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
async function first(urls) {
  let last = null;
  for (const url of urls) {
    try { const payload = await json(url); last = payload; if (payload && payload.code === 0) return payload; } catch {}
  }
  return last;
}
function digits(value) { return String(value || '').replace(/\D/g, ''); }
function validBvid(value) { const bvid = String(value || '').trim(); return /^BV[0-9A-Za-z]+$/.test(bvid) ? bvid : ''; }

let wbiKeysCache = null;
let wbiKeysPromise = null;
const HOME_REGION_RIDS = { knowledge:36, tech:188, game:4, music:3, film:181 };
async function getWbiKeys() {
  const now = Date.now();
  if (wbiKeysCache && now - wbiKeysCache.timestamp < 24 * 60 * 60 * 1000) return wbiKeysCache;
  if (wbiKeysPromise) return wbiKeysPromise;
  wbiKeysPromise = (async () => {
    try {
      // Account chrome and WBI signing need the same nav response at startup.
      const nav = await cached('account', 30000, () => json('https://api.bilibili.com/x/web-interface/nav'));
      const keys = globalThis.BiliTubeWbi && globalThis.BiliTubeWbi.keysFromNav(nav);
      if (!keys) return null;
      wbiKeysCache = { ...keys, timestamp:Date.now() };
      return wbiKeysCache;
    } catch { return null; }
    finally { wbiKeysPromise = null; }
  })();
  return wbiKeysPromise;
}
async function wbiJson(path, params) {
  const keys = await getWbiKeys();
  if (!keys || !globalThis.BiliTubeWbi) return null;
  const signed = globalThis.BiliTubeWbi.sign(params, keys.imgKey, keys.subKey);
  return json(`https://api.bilibili.com${path}?${signed.query}`);
}
async function wbiFirst(path, params, fallbackUrls = []) {
  try {
    const payload = await wbiJson(path, params);
    if (payload && payload.code === 0) return payload;
  } catch {}
  return first(fallbackUrls);
}
async function resolveVideoIdentity(params = {}) {
  let aid = digits(params.aid);
  const bvid = validBvid(params.bvid);
  let view = null;
  if (!aid && bvid) {
    try {
      view = await json(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`);
      aid = digits(view && view.data && view.data.aid);
    } catch {}
  }
  return { aid, bvid, view };
}
async function handle(type, params = {}) {
  // Drop later pages too, so pagination after a refresh uses the new feed.
  // The cache's entry check prevents older reads from refilling these entries.
  if (params.forceFresh === true) {
    const prefixes = {
      home:['home:'], 'home-category':[`home-category:${params.category || ''}`],
      'home-sections':['home-sections'], search:['search:'], dynamic:['dynamic:'],
      watchlater:['watchlater'], favorites:['favorite-folders:','favorite-resources:'],
      'space-profile':[`space-profile:${digits(params.mid)}`],
      'space-archives':[`space-archives:${digits(params.mid)}:`],
      account:['account'], subscriptions:['subscriptions'],
    }[type] || [];
    for (const key of cache.keys()) if (prefixes.some(prefix => key.startsWith(prefix))) cache.delete(key);
  }
  if (type === 'home') {
    const page = Math.max(1, Math.min(50, Number(params.page || params.freshIdx || 1) || 1));
    const ps = 30;
    const key = `home:${page}`;
    const recommendParams = {
      web_location:1430650, y_num:4, fresh_type:3, feed_version:'V8', homepage_ver:1,
      ps, fresh_idx:page, fresh_idx_1h:page, fetch_row:page, brush:0, device:'unknown', last_y_num:4,
    };
    return cached(key, page === 1 ? 20000 : 8000, () => wbiFirst('/x/web-interface/wbi/index/top/feed/rcmd', recommendParams, [
      `https://api.bilibili.com/x/web-interface/index/top/feed/rcmd?fresh_type=3&version=1&ps=${ps}&fresh_idx=${page}&fresh_idx_1h=${page}`,
    ]));
  }
  if (type === 'home-category') {
    const category = String(params.category || '');
    const rid = Number(HOME_REGION_RIDS[category] || 0);
    if (!rid) return { code:-400, message:t('unsupported_home_category','不支持的首页分类'), data:{ list:[] } };
    const key = `home-category:${category}`;
    return cached(key, 15000, () => first([
      `https://api.bilibili.com/x/web-interface/ranking/v2?rid=${rid}&type=all`,
      `https://api.bilibili.com/x/web-interface/newlist?rid=${rid}&pn=1&ps=30`,
    ]));
  }
  if (type === 'home-sections') {
    const endpoints = {
      followed:'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?type=all',
      live:'https://api.live.bilibili.com/xlive/web-interface/v1/webMain/getMoreRecList?platform=web&web_location=333.1007',
      bangumi:'https://api.bilibili.com/pgc/web/timeline?types=1&before=2&after=2',
      popular:'https://api.bilibili.com/x/web-interface/popular?ps=12&pn=1',
    };
    // Cache each source independently so a category view waits only for its
    // own endpoint, and enabling another shelf can reuse successful reads.
    const sections = Array.isArray(params.sections) ? params.sections : Object.keys(endpoints);
    const requested = [...new Set(sections.filter(key => Object.hasOwn(endpoints, key)))];
    const values = await Promise.all(requested.map(key => cached(`home-sections:${key}`, 30000, () => json(endpoints[key]))));
    return Object.fromEntries(requested.map((key, index) => [key, values[index]]));
  }
  if (type === 'search-suggest') {
    const term = String(params.term || params.keyword || '').trim();
    if (!term) return { code:0, data:{ result:{ tag:[] } } };
    const q = new URLSearchParams({ term, highlight:'0', spmid:'333.337', web_location:'1430654' });
    return cached(`search-suggest:${term}`, 10000, () => json(`https://api.bilibili.com/x/web-interface/suggest?${q}`));
  }
  // The native header uses this promoted word as the empty search placeholder.
  if (type === 'search-default') {
    return cached('search-default', 60000, () => json('https://api.bilibili.com/x/web-interface/search/default'));
  }
  // `search/square` is what the native focus panel renders as "bilibili热搜".
  if (type === 'search-trending') {
    return cached('search-trending', 60000, () => json('https://api.bilibili.com/x/web-interface/search/square?limit=10&platform=web'));
  }
  if (type === 'search-detail') {
    const bvid=String(params.bvid||'').trim();
    if(!/^BV[0-9A-Za-z]+$/.test(bvid))return null;
    return cached(`preview-view:${bvid}`,300000,()=>json(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`));
  }
  if (type === 'search') {
    const keyword = String(params.keyword || '').trim();
    const page = Math.max(1, Math.min(50, Number(params.page || 1) || 1));
    const category = String(params.category || 'video');
    const order = ['totalrank','click','pubdate','dm','stow','scores'].includes(params.order) ? params.order : 'totalrank';
    const duration = /^[0-4]$/.test(String(params.duration ?? 0)) ? Number(params.duration || 0) : 0;
    if (!keyword) return null;
    const typeMap = { video:'video', user:'bili_user', bangumi:'media_bangumi', media:'media_ft' };
    const runTypedSearch = (searchType) => {
      const searchParams = {
        search_type:searchType, keyword, page, page_size:searchType==='bili_user'?36:searchType==='video'?42:12,
        order:searchType==='video'?order:'', duration:searchType==='video'?duration:0,
        category_id:'', ad_resource:searchType==='video'?5654:5646, __refresh__:true, context:'', from_spmid:'333.337',
        platform:'pc', highlight:1, single_column:0, source_tag:3, dynamic_offset:0,
        web_roll_page:1, web_location:1430654, order_sort:0, user_type:0,
      };
      const legacy = new URLSearchParams({ search_type:searchType, keyword, page:String(page), page_size:String(searchParams.page_size) });
      if (searchParams.order) legacy.set('order', searchParams.order);
      if (searchType === 'video') legacy.set('duration', String(duration));
      return wbiFirst('/x/web-interface/wbi/search/type', searchParams, [
        `https://api.bilibili.com/x/web-interface/search/type?${legacy}`,
      ]);
    };
    if (category === 'all') {
      const allParams = {
        __refresh__:true, _extra:'', context:'', page, page_size:42, order:'', pubtime_begin_s:0, pubtime_end_s:0,
        duration:'', from_source:'', from_spmid:'333.337', platform:'pc', highlight:1, single_column:0,
        keyword, qv_id:'', ad_resource:5646, source_tag:3, web_roll_page:page, web_location:1430654,
      };
      const legacy = new URLSearchParams({ keyword, page:String(page), page_size:'42' });
      return cached(`search:all:${keyword}:${page}`, 12000, () => wbiFirst('/x/web-interface/wbi/search/all/v2', allParams, [
        `https://api.bilibili.com/x/web-interface/search/all/v2?${legacy}`,
      ]));
    }
    const searchType = typeMap[category] || 'video';
    return cached(`search:${searchType}:${keyword}:${page}:${order}:${duration}`, 12000, () => runTypedSearch(searchType));
  }
  if (type === 'account') return cached('account', 30000, () => json('https://api.bilibili.com/x/web-interface/nav'));
  if (type === 'subscriptions') return cached('subscriptions', 45000, () => json('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/nav'));
  if (type === 'dynamic') {
    const offset = String(params.offset || '');
    const q = new URLSearchParams({ type:'all', offset });
    return cached(`dynamic:${offset || 'first'}`, 10000, () => json(`https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?${q}`));
  }
  if (type === 'watchlater') return cached('watchlater', 15000, async () => {
    const current = await json('https://api.bilibili.com/x/v2/history/toview/web');
    if (current && current.code === 0) return current;
    return json('https://api.bilibili.com/x/v2/history/toview');
  });
  if (type === 'watchlater-toggle') {
    const csrf = String(params.csrf || '').trim();
    const identity = await resolveVideoIdentity(params);
    const aid = digits(identity && identity.aid);
    const bvid = validBvid(identity && identity.bvid || params.bvid);
    if (!csrf || !aid) return { code:-101, message:t('login_required','请先登录 Bilibili'), aid:Number(aid||0), bvid };
    const add = params.add !== false;
    const endpoint = add ? 'https://api.bilibili.com/x/v2/history/toview/add' : 'https://api.bilibili.com/x/v2/history/toview/del';
    const result = await postForm(endpoint, { aid, csrf });
    if (result && result.code === 0) cache.delete('watchlater');
    return { ...(result || { code:-1, message:t('request_failed','请求失败') }), aid:Number(aid), bvid };
  }
  if (type === 'space-profile') {
    const mid = digits(params.mid); if (!mid) return null;
    return cached(`space-profile:${mid}`, 120000, () => json(`https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(mid)}&photo=true`));
  }
  if (type === 'space-follow') {
    const fid = digits(params.mid); const csrf = String(params.csrf || '').trim();
    if (!fid || !csrf) return { code:-101, message:t('login_required','请先登录 Bilibili') };
    const following = Boolean(params.following);
    const result = await postForm('https://api.bilibili.com/x/relation/modify', { fid, act:following ? 2 : 1, re_src:11, csrf });
    if (result && result.code === 0) cache.delete(`space-profile:${fid}`);
    return result;
  }
  if (type === 'space-archives') {
    const mid = digits(params.mid); if (!mid) return null;
    const page = Math.max(1, Math.min(100, Number(params.page || 1) || 1));
    const archiveParams = { mid, pn:page, ps:30, tid:0, keyword:'', order:'pubdate' };
    const legacy = new URLSearchParams({ mid, pn:String(page), ps:'30', tid:'0', keyword:'', order:'pubdate', jsonp:'jsonp' });
    return cached(`space-archives:${mid}:${page}`, 20000, () => wbiFirst('/x/space/wbi/arc/search', archiveParams, [
      `https://api.bilibili.com/x/space/arc/search?${legacy}`,
    ]));
  }
  if (type === 'favorites') {
    const mid = digits(params.mid); if (!mid) return { mid:'', folders:null, resources:null, mediaId:'', page:1, hasMore:false };
    const page = Math.max(1, Math.min(100, Number(params.page || 1) || 1));
    const folders = await cached(`favorite-folders:${mid}`, 30000, () => json(`https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${encodeURIComponent(mid)}`));
    let mediaId = digits(params.mediaId);
    if (!mediaId && folders && folders.code === 0 && folders.data && Array.isArray(folders.data.list) && folders.data.list[0]) mediaId = digits(folders.data.list[0].id);
    let resources = null;
    if (mediaId) {
      const q = `media_id=${encodeURIComponent(mediaId)}&pn=${page}&ps=30&keyword=&order=mtime&type=0&tid=0&platform=web`;
      resources = await cached(`favorite-resources:${mediaId}:${page}`, 15000, () => json(`https://api.bilibili.com/x/v3/fav/resource/list?${q}`));
    }
    const hasMore = Boolean(resources && resources.code === 0 && resources.data && resources.data.has_more);
    return { mid, folders, resources, mediaId, page, hasMore };
  }
  if (type === 'preview') {
    const bvid = validBvid(params.bvid);
    if (!bvid) return { bvid, url:'' };
    let cid = Number(params.cid) || 0;
    if (!cid) {
      // `pagelist` returns the same first-page cid as `view` for a fraction of
      // the payload; `view` stays as the fallback for videos without pages.
      const pages = await cached(`preview-pages:${bvid}`, 300000, () => json(`https://api.bilibili.com/x/player/pagelist?bvid=${encodeURIComponent(bvid)}`));
      cid = Array.isArray(pages && pages.data) && pages.data[0] && Number(pages.data[0].cid) || 0;
      if (!cid) {
        const view = await cached(`preview-view:${bvid}`, 300000, () => json(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`));
        const info = view && view.code === 0 ? view.data || {} : {};
        cid = Number(info.cid) || Number(Array.isArray(info.pages) && info.pages[0] && info.pages[0].cid) || 0;
      }
    }
    if (!cid) return { bvid, url:'' };
    const q = `bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(cid)}&qn=32&fnval=0&fnver=0&fourk=0&platform=html5&high_quality=1`;
    const play = await cached(`preview-play:${bvid}:${cid}`, 180000, () => json(`https://api.bilibili.com/x/player/playurl?${q}`));
    const item = play && play.code === 0 && play.data && Array.isArray(play.data.durl) ? play.data.durl[0] : null;
    return { bvid, url:item && item.url ? String(item.url).replace(/^http:/i,'https:') : '' };
  }
  return null;
}

async function openOptions() {
  try {
    if (chrome.runtime && chrome.runtime.openOptionsPage) {
      await chrome.runtime.openOptionsPage();
      return true;
    }
  } catch {}
  try {
    if (chrome.tabs && chrome.tabs.create) {
      await chrome.tabs.create({ url:chrome.runtime.getURL('src/options/options.html') });
      return true;
    }
  } catch {}
  return false;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return false;
  if (message.source === 'bilitube-control' && message.type === 'open-options') {
    openOptions().then(ok => sendResponse({ ok })).catch(error => sendResponse({ ok:false, error:String(error && error.message || error) }));
    return true;
  }
  if (message.source !== 'bilitube-api') return false;
  handle(message.type, message.params || {}).then(data => sendResponse({ ok:true, data })).catch(error => sendResponse({ ok:false, error:String(error && error.message || error) }));
  return true;
});
