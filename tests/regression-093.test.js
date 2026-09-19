const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Data = require('../src/core/data.js');
const Policy = require('../src/core/policy.js');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('watch applies YouTube-like cosmetics to native metadata and toolbar plus a simple creator mirror', () => {
  const watch = read('src/core/watch.js');
  const css = read('src/styles/core.css');
  assert.match(watch, /bt-native-watch-info/);
  assert.match(watch, /bt-native-watch-toolbar/);
  assert.match(watch, /bt-watch-author-row/);
  assert.match(css, /\.bt-native-watch-info/);
  assert.match(css, /\.bt-native-watch-toolbar/);
  assert.match(css, /\.bt-watch-author-row/);
  assert.doesNotMatch(watch, /bt-watch-actions|bt-watch-like|bt-watch-coin/);
});

test('watch keeps real Bilibili toolbar event ownership by never relocating it', () => {
  const watch = read('src/core/watch.js');
  assert.match(watch, /bt-native-watch-toolbar/);
  assert.doesNotMatch(watch, /bt-native-toolbar-slot|createComment\(|placeholder\.replaceWith|cloneNode\(|dispatchEvent/);
});

test('watch leaves native recommendation links untouched rather than rebuilding or bridging them', () => {
  const watch = read('src/core/watch.js');
  assert.match(watch, /bt-native-watch-related/);
  assert.doesNotMatch(watch, /bindDirectLink|preventDefault|callbacks\.navigate|buildRelated/);
});

test('all supported search tabs stay inside the BiliTube replacement surface', () => {
  const cases = [
    ['https://search.bilibili.com/all?keyword=test','search-all'],
    ['https://search.bilibili.com/video?keyword=test','search-video'],
    ['https://search.bilibili.com/upuser?keyword=test','search-user'],
    ['https://search.bilibili.com/bangumi?keyword=test','search-bangumi'],
    ['https://search.bilibili.com/media_ft?keyword=test','search-media'],
  ];
  for (const [href,route] of cases) {
    const u = new URL(href);
    const result = Policy.resolve(u);
    assert.equal(result.strategy,'replace');
    assert.equal(result.route,route);
  }
});

test('search data normalizes UP/channel results for YouTube-style creator cards', () => {
  const users = Data.normalizeSearchUsers({ code:0, data:{ result:[{
    mid:123, uname:'测试UP', usign:'签名', fans:123456, videos:88, upic:'//i0.hdslb.com/u.jpg', is_followed:1,
  }] } });
  assert.equal(users.length,1);
  assert.equal(users[0].kind,'user');
  assert.equal(users[0].name,'测试UP');
  assert.equal(users[0].href,'https://space.bilibili.com/123');
  assert.match(users[0].meta,/粉丝/);
  assert.equal(users[0].following,true);
});

test('search data normalizes bangumi and film results instead of dropping non-video results', () => {
  const items = Data.normalizeSearchMedia({ code:0, data:{ result:[{
    media_id:456, season_id:789, title:'<em>测试番剧</em>', cover:'//i0.hdslb.com/b.jpg', areas:'日本', styles:'动画', pubtime:1799990000,
  }] } }, 'bangumi', 1800000000);
  assert.equal(items.length,1);
  assert.equal(items[0].kind,'bangumi');
  assert.match(items[0].href,/bangumi/);
  assert.equal(items[0].title,'测试番剧');
});

test('top search box has debounced Bilibili suggestions with keyboard navigation', () => {
  const ui = read('src/core/ui.js');
  assert.match(ui, /requestSearchSuggestions/);
  assert.match(ui, /bt-search-suggestions/);
  assert.match(ui, /setTimeout\([^,]+,\s*180\)/);
  assert.match(ui, /ArrowDown/);
  assert.match(ui, /ArrowUp/);
  assert.match(ui, /Escape/);
});

test('background exposes search suggestions and typed WBI search requests', () => {
  const bg = read('src/background.js');
  assert.match(bg, /type === 'search-suggest'/);
  assert.match(bg, /x\/web-interface\/suggest/);
  assert.match(bg, /searchType/);
  assert.match(bg, /bili_user/);
  assert.match(bg, /media_bangumi/);
  assert.match(bg, /media_ft/);
});

test('search renderer contains a YouTube-style channel result card', () => {
  const ui = read('src/core/ui.js');
  const css = read('src/styles/core.css');
  assert.match(ui, /bt-search-channel/);
  assert.match(ui, /bt-search-channel-avatar/);
  assert.match(ui, /bt-search-channel-meta/);
  assert.match(css, /\.bt-search-channel/);
});
