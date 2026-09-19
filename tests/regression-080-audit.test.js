const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Data = require('../src/core/data.js');
const Policy = require('../src/core/policy.js');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('search API results normalize title, author, views and publish time', () => {
  const now = 1_800_000_000;
  const out = Data.normalizeSearch({code:0,data:{result:[{
    bvid:'BV1SEARCH',title:'<em class="keyword">Microduck</em> 测试',pic:'//i0.hdslb.com/s.jpg',duration:'01:23',
    author:'测试UP',mid:12,play:23456,pubdate:now-3*86400,
  }]}}, now);
  assert.equal(out[0].title,'Microduck 测试');
  assert.equal(out[0].author,'测试UP');
  assert.match(out[0].meta,/播放/);
  assert.match(out[0].meta,/3天前/);
});

test('space uploads and library cards consistently expose publish dates', () => {
  const now = 1_800_000_000;
  const profile = {name:'UP',avatar:'//i0.hdslb.com/a.jpg',mid:'9'};
  const space = Data.normalizeSpaceArchives({code:0,data:{list:{vlist:[{bvid:'BV1SPACE',title:'投稿',pic:'//i0.hdslb.com/p.jpg',length:'2:00',play:5000,created:now-86400}]}}},'9',profile,now);
  assert.match(space[0].meta,/1天前/);
  const later = Data.normalizeWatchLater({code:0,data:{list:[{bvid:'BV1LATER',title:'稍后看',pic:'//i0.hdslb.com/l.jpg',duration:120,progress:30,pubdate:now-7200,owner:{mid:9,name:'UP'}}]}},now);
  assert.match(later[0].meta,/2小时前/);
  const fav = Data.normalizeFavoriteResources({code:0,data:{medias:[{bvid:'BV1FAV',title:'收藏',cover:'//i0.hdslb.com/f.jpg',duration:60,pubtime:now-30*60,cnt_info:{play:100},upper:{mid:9,name:'UP'}}]}},now);
  assert.match(fav[0].meta,/30分钟前/);
});

test('search and space uploads use background API paths with paging instead of DOM-only discovery', () => {
  const bg = read('src/background.js');
  const app = read('src/core/app.js');
  assert.match(bg,/type === 'search'/);
  assert.match(bg,/x\/web-interface\/search\/type/);
  assert.match(bg,/type === 'space-archives'/);
  assert.match(bg,/x\/space\/arc\/search/);
  assert.match(app,/searchPage/);
  assert.match(app,/searchHasMore/);
  assert.match(app,/spacePage/);
  assert.match(app,/spaceHasMore/);
});

test('infinite loading covers search, favorites and channel uploads too', () => {
  const app = read('src/core/app.js');
  for (const feed of ['search','favorites','space']) assert.ok(app.includes(`feed === '${feed}'`), `missing ${feed} infinite feed`);
  const ui = read('src/core/ui.js');
  assert.match(ui,/feedSentinel\('search'/);
  assert.match(ui,/feedSentinel\('favorites'/);
  assert.match(ui,/feedSentinel\('space'/);
});

test('search page exposes YouTube-like result filters without faking unsupported categories', () => {
  const ui = read('src/core/ui.js');
  assert.match(ui,/bt-search-tabs/);
  assert.match(ui,/视频/);
  assert.match(ui,/用户/);
  assert.match(ui,/番剧/);
});

test('watch later and favorites provide usable library actions and selected collection summary', () => {
  const ui = read('src/core/ui.js');
  assert.match(ui,/bt-library-summary/);
  assert.match(ui,/播放全部/);
  assert.match(ui,/bt-favorite-summary/);
  assert.match(ui,/selectedFolder/);
});

test('favorites paging is page-aware and not hard-coded to pn=1', () => {
  const bg = read('src/background.js');
  assert.match(bg,/params\.page/);
  assert.match(bg,/pn=\$\{page\}/);
  const app = read('src/core/app.js');
  assert.match(app,/favoritePage/);
  assert.match(app,/favoriteHasMore/);
});

test('native adapters reserve topbar space and keep page-specific business DOM functional', () => {
  const css = read('src/styles/core.css');
  assert.match(css,/html\.bt-native-adapted body\{padding-top:var\(--bt-topbar-h\)/);
  for (const route of ['message','search-native','bangumi-watch','live','creator','account']) assert.match(css,new RegExp(`data-bt-native-route="${route}"`));
});

test('policy explicitly adapts creator and account pages instead of silently passing through', () => {
  assert.equal(Policy.resolve({hostname:'member.bilibili.com',pathname:'/platform/home',search:''}).strategy,'adapt');
  assert.equal(Policy.resolve({hostname:'account.bilibili.com',pathname:'/account/home',search:''}).strategy,'adapt');
});

test('library play-all actions use current Bilibili playlist routes', () => {
  const ui = read('src/core/ui.js');
  assert.match(ui,/https:\/\/www\.bilibili\.com\/list\/watchlater/);
  assert.match(ui,/medialist\/play\/ml\$\{selectedFolder\.id\}/);
});

test('full-site navigation delegates BiliTube settings to background and preserves native playlist playback', () => {
  const ui = read('src/core/ui.js');
  const app = read('src/core/app.js');
  const bg = read('src/background.js');
  assert.match(ui,/action:'openSettings'/);
  assert.match(app,/bilitube-control/);
  assert.match(app,/open-options/);
  assert.match(bg,/chrome\.runtime\.openOptionsPage/);
  assert.match(bg,/chrome\.tabs/);
  assert.match(ui,/list\/watchlater\?bilitube_native=1/);
  assert.equal(Policy.resolve({hostname:'www.bilibili.com',pathname:'/medialist/play/ml123',search:''}).strategy,'adapt');
});

test('native adapter mutation observer scans only added subtrees after initial mount', () => {
  const adapter = read('src/core/native-adapter.js');
  assert.match(adapter,/function scanAdded\(records\)/);
  assert.match(adapter,/record\.addedNodes/);
  assert.match(adapter,/new MutationObserver\(scanAdded\)/);
  assert.doesNotMatch(adapter,/new MutationObserver\(scan\)/);
});
