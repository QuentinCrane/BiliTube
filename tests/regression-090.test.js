const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('web fullscreen is derived from native screen attributes and releases normal watch geometry', () => {
  const watch = read('src/core/watch.js');
  const css = read('src/styles/core.css');
  assert.match(watch, /modeObserver\.observe\(ready\.player[\s\S]*attributeFilter:\s*\['data-screen'\]/);
  assert.match(watch, /web-fullscreen|pagefullscreen|data-screen/);
  assert.match(css, /html\.bt-player-web-fullscreen \.bt-watch-native-layout/);
  assert.match(css, /html\.bt-player-web-fullscreen #bilitube-watch-layer/);
});

test('watch keeps native Bilibili comments in their original ownership tree', () => {
  const watch = read('src/core/watch.js');
  const app = read('src/core/app.js');
  const css = read('src/styles/core.css');
  assert.match(watch, /bt-native-watch-comments/);
  assert.doesNotMatch(watch, /bt-native-comments-slot|placeholder\.replaceWith|cloneNode\(|submitComment/);
  assert.doesNotMatch(app, /watch-comment-add|requestApi\(['"]watch-comments['"]/);
  assert.doesNotMatch(css, /bt-api-comments-ready/);
});

test('known Bilibili video advertising slots are hidden explicitly', () => {
  const css = read('src/styles/core.css');
  for (const selector of ['.video-card-ad-small','.video-page-game-card-small','.video-page-special-card-small','#slide_ad','.strip-ad','.activity-m-v1']) {
    assert.ok(css.includes(selector), `missing ad selector ${selector}`);
  }
});

test('history is a real YouTube-like management page with clear and pause controls', () => {
  const ui = read('src/core/ui.js');
  const bg = read('src/background.js');
  assert.match(ui, /clearHistory/);
  assert.match(ui, /toggleHistoryPause/);
  assert.match(ui, /清除观看记录/);
  assert.match(ui, /暂停观看记录|开启观看记录/);
  assert.match(bg, /type === 'history-status'/);
  assert.match(bg, /type === 'history-clear'/);
  assert.match(bg, /type === 'history-toggle'/);
});

test('settings opening is delegated to background with a tab fallback', () => {
  const app = read('src/core/app.js');
  const bg = read('src/background.js');
  assert.match(app, /bilitube-control/);
  assert.match(app, /open-options/);
  assert.match(bg, /openOptionsPage/);
  assert.match(bg, /tabs\.create/);
});

test('theme bridge updates html first and exports Bilibili native variables with animated switching', () => {
  const app = read('src/core/app.js');
  const css = read('src/styles/core.css');
  assert.match(app, /function applyThemeOnly\(options = \{\}\)/);
  assert.ok(app.indexOf('html.dataset.btTheme = theme') < app.indexOf('shell.updateTheme(theme)'));
  assert.match(app, /bt-theme-switching/);
  assert.match(app, /startViewTransition/);
  assert.match(css, /--bg1:/);
  assert.match(css, /--text1:/);
  assert.match(css, /bt-theme-animating/);
  assert.doesNotMatch(css, /bt-theme-switching[^\n]*transition\s*:\s*none!important/);
});

test('complex video actions stay on the original Bilibili toolbar in place', () => {
  const watch = read('src/core/watch.js');
  const css = read('src/styles/core.css');
  const app = read('src/core/app.js');
  assert.match(watch, /bt-native-watch-toolbar/);
  assert.doesNotMatch(watch, /bt-native-toolbar-slot|slot\.append|cloneNode\(/);
  assert.doesNotMatch(css, /\.bt-native-watch-toolbar[^}]*pointer-events\s*:\s*none/is);
  assert.doesNotMatch(app, /openCoinDialog|openFavoriteDialog/);
});

test('coin and favorite popovers are not reimplemented by BiliTube', () => {
  const app = read('src/core/app.js');
  const watch = read('src/core/watch.js');
  assert.doesNotMatch(app, /openCoinDialog|openFavoriteDialog|confirmTriple/);
  for (const action of ['coin','favorite','share','triple']) assert.ok(!watch.includes(`data-action','${action}`));
});

test('comment payload normalization preserves author, text, relative time and nested replies', () => {
  const Data = require('../src/core/data.js');
  const now = 1_800_000_000;
  const out = Data.normalizeComments({ code:0, data:{ cursor:{ all_count:12 }, replies:[{
    rpid_str:'99', ctime:now-3600, like:123,
    member:{ mid:'42', uname:'评论者', avatar:'http://i0.hdslb.com/avatar.jpg' },
    content:{ message:'这是一条评论' },
    replies:[{ rpid:100, ctime:now-1800, like:2, member:{ mid:'43', uname:'回复者' }, content:{ message:'回复内容' } }],
  }] } }, now);
  assert.equal(out.count, 12);
  assert.equal(out.items[0].author, '评论者');
  assert.equal(out.items[0].message, '这是一条评论');
  assert.equal(out.items[0].time, '1小时前');
  assert.equal(out.items[0].authorHref, 'https://space.bilibili.com/42');
  assert.equal(out.items[0].replies[0].author, '回复者');
});

test('BiliTube follow has a same-site MAIN-world relation fallback when extension background cookies are rejected', () => {
  const app = read('src/core/app.js');
  const bridge = read('src/page/bridge.js');
  assert.match(app, /bridgeWrite\(\{action:'follow'/);
  assert.match(bridge, /action === 'follow'|action==='follow'/);
  assert.match(bridge, /x\/relation\/modify/);
  assert.match(bridge, /credentials:'include'/);
});

test('managed-page theme persists across BiliTube surfaces but is removed when native passthrough is restored', () => {
  const shell = read('src/core/shell.js');
  const app = read('src/core/app.js');
  assert.doesNotMatch(shell, /delete doc\.documentElement\.dataset\.btTheme/);
  assert.match(app, /removeAttribute\(['"]data-bt-theme['"]\)/);
  assert.match(app, /chrome\.storage\.onChanged/);
});
