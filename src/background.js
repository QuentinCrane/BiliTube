'use strict';

if (typeof importScripts === 'function') importScripts('core/wbi.js');

const cache = new Map();
function cached(key, ttl, loader) {
  const now = Date.now();
  const item = cache.get(key);
  if (item && item.expiresAt > now) return item.value;
  const value = Promise.resolve().then(loader).catch(() => null);
  cache.set(key, { value, expiresAt: now + ttl });
  value.then((resolved) => cache.set(key, { value: Promise.resolve(resolved), expiresAt: Date.now() + ttl }));
  return value;
}
async function json(url) {
  const response = await fetch(url, { credentials:'include', headers:{ Accept:'application/json, text/plain, */*' } });
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
      const nav = await json('https://api.bilibili.com/x/web-interface/nav');
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
async function freshView(bvid, aid) {
  try {
    if (bvid) return await json(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`);
    if (aid) return await json(`https://api.bilibili.com/x/web-interface/view?aid=${encodeURIComponent(aid)}`);
  } catch {}
  return null;
}

async function handle(type, params = {}) {
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
    if (!rid) return { code:-400, message:'不支持的首页分类', data:{ list:[] } };
    const key = `home-category:${category}`;
    return cached(key, 15000, () => first([
      `https://api.bilibili.com/x/web-interface/ranking/v2?rid=${rid}&type=all`,
      `https://api.bilibili.com/x/web-interface/newlist?rid=${rid}&pn=1&ps=30`,
    ]));
  }
  if (type === 'home-sections') {
    return cached('home-sections', 30000, async () => {
      const results = await Promise.allSettled([
        json('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?type=all'),
        json('https://api.live.bilibili.com/xlive/web-interface/v1/webMain/getMoreRecList?platform=web&web_location=333.1007'),
        json('https://api.bilibili.com/pgc/web/timeline?types=1&before=2&after=2'),
        json('https://api.bilibili.com/x/web-interface/popular?ps=12&pn=1'),
      ]);
      const value = (index) => results[index] && results[index].status === 'fulfilled' ? results[index].value : null;
      return { followed:value(0), live:value(1), bangumi:value(2), popular:value(3) };
    });
  }
  if (type === 'search-suggest') {
    const term = String(params.term || params.keyword || '').trim();
    if (!term) return { code:0, data:{ result:{ tag:[] } } };
    const q = new URLSearchParams({ term, highlight:'0', spmid:'333.337', web_location:'1430654' });
    return cached(`search-suggest:${term}`, 10000, () => json(`https://api.bilibili.com/x/web-interface/suggest?${q}`));
  }
  if (type === 'search') {
    const keyword = String(params.keyword || '').trim();
    const page = Math.max(1, Math.min(50, Number(params.page || 1) || 1));
    const category = String(params.category || 'video');
    if (!keyword) return null;
    const typeMap = { video:'video', user:'bili_user', bangumi:'media_bangumi', media:'media_ft' };
    const runTypedSearch = (searchType) => {
      const searchParams = {
        search_type:searchType, keyword, page, page_size:searchType==='bili_user'?36:searchType==='video'?42:12,
        order:searchType==='bili_user'?'':searchType==='video'?'totalrank':'', duration:0,
        category_id:'', ad_resource:searchType==='video'?5654:5646, __refresh__:true, context:'', from_spmid:'333.337',
        platform:'pc', highlight:1, single_column:0, source_tag:3, dynamic_offset:0,
        web_roll_page:1, web_location:1430654, order_sort:0, user_type:0,
      };
      const legacy = new URLSearchParams({ search_type:searchType, keyword, page:String(page), page_size:String(searchParams.page_size) });
      if (searchParams.order) legacy.set('order', searchParams.order);
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
    return cached(`search:${searchType}:${keyword}:${page}`, 12000, () => runTypedSearch(searchType));
  }
  if (type === 'account') return cached('account', 30000, () => json('https://api.bilibili.com/x/web-interface/nav'));
  if (type === 'subscriptions') return cached('subscriptions', 45000, () => json('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/nav'));
  if (type === 'history') {
    const max = Math.max(0, Number(params.max || 0) || 0);
    const viewAt = Math.max(0, Number(params.viewAt || params.view_at || 0) || 0);
    const business = String(params.business || '');
    const q = new URLSearchParams({ ps:'30', type:'all', max:String(max), business, view_at:String(viewAt) });
    return cached(`history:${max}:${business}:${viewAt}`, 12000, () => json(`https://api.bilibili.com/x/web-interface/history/cursor?${q}`));
  }
  if (type === 'history-status') return json('https://api.bilibili.com/x/v2/history/shadow');
  if (type === 'history-clear') {
    const csrf = String(params.csrf || '').trim();
    if (!csrf) return { code:-101, message:'请先登录 Bilibili' };
    const result = await postForm('https://api.bilibili.com/x/v2/history/clear', { csrf });
    cache.clear();
    return result;
  }
  if (type === 'history-toggle') {
    const csrf = String(params.csrf || '').trim();
    if (!csrf) return { code:-101, message:'请先登录 Bilibili' };
    const paused = Boolean(params.paused);
    const result = await postForm('https://api.bilibili.com/x/v2/history/shadow/set', { switch:paused ? 1 : 0, csrf });
    cache.delete('history-status');
    return result;
  }
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
    if (!csrf || !aid) return { code:-101, message:'请先登录 Bilibili', aid:Number(aid||0), bvid };
    const add = params.add !== false;
    const endpoint = add ? 'https://api.bilibili.com/x/v2/history/toview/add' : 'https://api.bilibili.com/x/v2/history/toview/del';
    const result = await postForm(endpoint, { aid, csrf });
    if (result && result.code === 0) cache.delete('watchlater');
    return { ...(result || { code:-1, message:'请求失败' }), aid:Number(aid), bvid };
  }
  if (type === 'space-profile') {
    const mid = digits(params.mid); if (!mid) return null;
    return cached(`space-profile:${mid}`, 120000, () => json(`https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(mid)}&photo=true`));
  }
  if (type === 'space-follow') {
    const fid = digits(params.mid); const csrf = String(params.csrf || '').trim();
    if (!fid || !csrf) return { code:-101, message:'请先登录 Bilibili' };
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
  if (type === 'watch-related') {
    const bvid = validBvid(params.bvid);
    if (!bvid) return { bvid, view:null, related:null };
    const view = await cached(`watch-view:${bvid}`, 180000, () => json(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`));
    const related = await cached(`watch-related:${bvid}`, 60000, () => json(`https://api.bilibili.com/x/web-interface/archive/related?bvid=${encodeURIComponent(bvid)}`));
    return { bvid, view, related };
  }
  if (type === 'watch-comments') {
    const { aid } = await resolveVideoIdentity(params);
    if (!aid) return { code:-400, message:'缺少视频 aid', data:{ replies:[], cursor:{ all_count:0 } } };
    const pagination = typeof params.pagination === 'string' ? params.pagination : '';
    const paginationStr = JSON.stringify({ offset:pagination });
    const wbiParams = { oid:aid, type:1, mode:3, pagination_str:paginationStr, plat:1, seek_rpid:'', web_location:1315875 };
    const fallback = `https://api.bilibili.com/x/v2/reply?type=1&oid=${encodeURIComponent(aid)}&sort=2&pn=1&ps=20`;
    return wbiFirst('/x/v2/reply/wbi/main', wbiParams, [fallback]);
  }
  if (type === 'watch-comment-add') {
    const { aid } = await resolveVideoIdentity(params);
    const csrf = String(params.csrf || '').trim();
    const message = String(params.message || '').trim();
    if (!aid || !csrf || !message) return { code:-400, message:'缺少评论参数' };
    return postForm('https://api.bilibili.com/x/v2/reply/add', { type:1, oid:aid, message, csrf });
  }
  if (type === 'watch-favorite-folders') {
    const mid = digits(params.mid);
    const { aid } = await resolveVideoIdentity(params);
    if (!mid) return { code:-101, message:'请先登录 Bilibili', data:{ list:[] } };
    const query = new URLSearchParams({ up_mid:mid });
    if (aid) { query.set('rid', aid); query.set('type', '2'); }
    return json(`https://api.bilibili.com/x/v3/fav/folder/created/list-all?${query}`);
  }
  if (type === 'watch-action') {
    const action = String(params.action || '');
    const csrf = String(params.csrf || '').trim();
    const identity = await resolveVideoIdentity(params);
    const { aid, bvid } = identity;
    if (!csrf || (!aid && !bvid)) return { code:-101, message:'请先登录 Bilibili' };
    let result = null;
    if (action === 'like') {
      result = await postForm('https://api.bilibili.com/x/web-interface/archive/like', { aid, bvid, like:params.active ? 2 : 1, csrf });
    } else if (action === 'triple') {
      result = await postForm('https://api.bilibili.com/x/web-interface/archive/like/triple', { aid, bvid, csrf });
    } else if (action === 'coin') {
      const multiply = Math.max(1, Math.min(2, Number(params.multiply || 1) || 1));
      result = await postForm('https://api.bilibili.com/x/web-interface/coin/add', { aid, bvid, multiply, select_like:params.selectLike ? 1 : 0, csrf });
    } else if (action === 'favorite') {
      if (!aid) return { code:-400, message:'收藏操作缺少 aid' };
      const add = Array.isArray(params.addMediaIds) ? params.addMediaIds.map(digits).filter(Boolean).join(',') : String(params.addMediaIds || '');
      const del = Array.isArray(params.delMediaIds) ? params.delMediaIds.map(digits).filter(Boolean).join(',') : String(params.delMediaIds || '');
      result = await postForm('https://api.bilibili.com/x/v3/fav/resource/deal', { rid:aid, type:2, add_media_ids:add, del_media_ids:del, csrf });
    } else {
      return { code:-400, message:'不支持的操作' };
    }
    if (result && result.code === 0) cache.clear();
    const view = result && result.code === 0 ? await freshView(bvid, aid) : null;
    return { ...(result || { code:-1, message:'请求失败' }), view };
  }
  if (type === 'preview') {
    const bvid = validBvid(params.bvid);
    if (!bvid) return { bvid, url:'' };
    const view = await cached(`preview-view:${bvid}`, 300000, () => json(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`));
    const info = view && view.code === 0 ? view.data || {} : {};
    const cid = info.cid || (Array.isArray(info.pages) && info.pages[0] && info.pages[0].cid);
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
