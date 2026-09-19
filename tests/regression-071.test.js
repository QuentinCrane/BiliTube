const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Data = require('../src/core/data.js');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('history request respects cursor API page-size limit and keeps type=all', () => {
  const background = read('src/background.js');
  assert.match(background, /history\/cursor/);
  assert.match(background, /ps:'30'/);
  assert.match(background, /type:'all'/);
  assert.doesNotMatch(background, /ps=50|ps:'50'/);
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
  assert.match(ui, /bt-dynamic-video-grid/);
  assert.match(ui, /其他动态|图文动态/);
  assert.match(ui, /!videos\.length&&!others\.length/);
});

test('related video payload normalizes into creator-aware recommendation cards', () => {
  assert.equal(typeof Data.normalizeRelated, 'function');
  const out = Data.normalizeRelated({ code:0, data:[{
    bvid:'BV1REL', title:'相关视频', pic:'//i0.hdslb.com/r.jpg', duration:181,
    owner:{mid:42,name:'相关UP',face:'//i0.hdslb.com/u.jpg'}, stat:{view:45678}
  }]});
  assert.equal(out.length, 1);
  assert.equal(out[0].href, 'https://www.bilibili.com/video/BV1REL');
  assert.equal(out[0].authorHref, 'https://space.bilibili.com/42');
  assert.equal(out[0].duration, '3:01');
});

test('ordinary watch uses Bilibili native recommendations and does not request a duplicate related feed', () => {
  const app = read('src/core/app.js');
  const watch = read('src/core/watch.js');
  assert.match(watch, /bt-native-watch-related/);
  assert.doesNotMatch(watch, /buildRelated|bt-watch-related-column/);
  assert.doesNotMatch(app, /requestApi\('watch-related'/);
  assert.doesNotMatch(watch, /appendChild\s*\(\s*player|replaceWith\s*\(\s*player|append\s*\(\s*player/);
});
