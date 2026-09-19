const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('UI exports the supported core surfaces', () => {
  const src = read('src/core/ui.js');
  for (const name of ['createCard','renderHome','renderHistory','renderSearch','renderSpace','renderDynamic','renderWatchLater','renderFavorites']) assert.match(src, new RegExp(name));
});

test('homepage category chips stay inside the BiliTube replacement route', () => {
  const ui = read('src/core/ui.js');
  const app = read('src/core/app.js');
  assert.match(ui, /bilitube_category/);
  assert.match(ui, /homeCategoryDefs/);
  assert.match(app, /function homeCategory\(\)/);
  assert.match(app, /homeCategoryMatches/);
});

test('video thumbnails use progressive loading states', () => {
  const ui = read('src/core/ui.js');
  const css = read('src/styles/core.css');
  assert.match(ui, /function progressiveImage/);
  assert.match(ui, /bt-thumb-progress-shimmer/);
  assert.match(css, /\.bt-thumb-image\.is-preview/);
  assert.match(css, /\.bt-thumb\.is-image-loaded \.bt-thumb-progress-shimmer/);
  assert.match(ui, /fetchPriority=.*(?:high|low).*auto/);
});

test('hover preview has delayed single media, seek control, and destructive cleanup', () => {
  const src = read('src/core/preview.js');
  assert.match(src, /500/);
  assert.doesNotMatch(src, /type\s*=\s*['"]range['"]/);
  assert.match(src, /bt-preview-progress/);
  assert.match(src, /setPointerCapture/);
  assert.match(src, /currentTime/);
  assert.match(src, /removeAttribute\(['"]src['"]\)/);
  assert.match(src, /load\(\)/);
});

test('extractors expose search and watch data discovery', () => {
  const src = read('src/core/extract.js');
  assert.match(src, /extractSearchCards/);
  assert.match(src, /extractWatch/);
});


test('preview controller uses IntersectionObserver to avoid offscreen preview work', () => {
  const src = read('src/core/preview.js');
  assert.match(src, /IntersectionObserver/);
  assert.match(src, /observe\(card\)/);
});


test('native adapter exists for complex pages that should stay functional', () => {
  const src = read('src/core/native-adapter.js');
  assert.match(src, /bt-native-adapted/);
  assert.match(src, /createTopbar/);
  assert.match(src, /restore/);
});

test('native adaptation has page-scoped styling instead of a header-only skin', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /data-bt-native-route="message"/);
  assert.match(css, /\.space-left/);
  assert.match(css, /data-bt-native-route="search-native"/);
  assert.match(css, /data-bt-native-route="bangumi-watch"/);
});

test('native adapter updates chrome without remounting its observer', () => {
  const adapter = read('src/core/native-adapter.js');
  const app = read('src/core/app.js');
  assert.match(adapter, /function updateChrome/);
  assert.match(adapter, /updateChrome/);
  assert.match(app, /nativeAdapter\.updateChrome/);
});
