const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Data = require('../src/core/data.js');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('history stays native and the unreachable replacement API is removed', () => {
  const background = read('src/background.js');
  const app = read('src/core/app.js');
  const ui = read('src/core/ui.js');
  const Policy = require('../src/core/policy.js');
  assert.equal(Policy.resolve({hostname:'www.bilibili.com',pathname:'/history',search:''}).strategy,'adapt');
  assert.doesNotMatch(background, /type === 'history'|history-clear|history-toggle|history-status/);
  assert.doesNotMatch(app, /loadMoreHistory|historyVideos|historyCursor/);
  assert.doesNotMatch(ui, /function renderHistory/);
});

test('home feed supports successive recommendation pages instead of one cached first page', () => {
  const background = read('src/background.js');
  const app = read('src/core/app.js');
  assert.match(background, /params\.page|params\.freshIdx|fresh_idx/);
  assert.match(background, /home:\$\{|`home:/);
  assert.match(app, /IntersectionObserver/);
  assert.match(app, /loadMoreHome|homePage|homeHasMore/);
});

test('dynamic page renders a YouTube-style latest video grid before non-video updates', () => {
  const ui = read('src/core/ui.js');
  assert.match(ui, /最新/);
  assert.match(ui, /bt-dynamic-hero/);
  assert.match(ui, /bt-dynamic-section-head/);
  assert.match(ui, /bt-dynamic-video-grid/);
  assert.match(ui, /其他动态|图文动态/);
  assert.match(ui, /!videos\.length&&!others\.length/);
});

test('legacy Watch API payloads and normalizers are no longer shipped', () => {
  const background = read('src/background.js');
  assert.equal(typeof Data.normalizeRelated, 'undefined');
  assert.equal(typeof Data.normalizeParts, 'undefined');
  assert.equal(typeof Data.normalizeComments, 'undefined');
  assert.doesNotMatch(background, /watch-related|watch-comments|watch-comment-add|watch-favorite-folders|watch-action/);
});

test('ordinary watch uses Bilibili native recommendations and does not request a duplicate related feed', () => {
  const app = read('src/core/app.js');
  const watch = read('src/core/watch.js');
  assert.match(watch, /bt-native-watch-related/);
  assert.doesNotMatch(watch, /buildRelated|bt-watch-related-column/);
  assert.doesNotMatch(app, /requestApi\('watch-related'/);
  assert.doesNotMatch(watch, /appendChild\s*\(\s*player|replaceWith\s*\(\s*player|append\s*\(\s*player/);
});
