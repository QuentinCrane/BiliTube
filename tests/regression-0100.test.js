const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('watch page keeps native comments and no longer mounts API comment surface', () => {
  const watch = read('src/core/watch.js');
  const app = read('src/core/app.js');
  const css = read('src/styles/core.css');
  assert.doesNotMatch(watch, /buildComments\(/);
  assert.doesNotMatch(app, /requestApi\('watch-comments'/);
  assert.doesNotMatch(css, /bt-api-comments-ready[^\n]*bili-comments/);
});

test('native toolbar stays in Bilibili DOM and is only marked for YouTube-style decoration', () => {
  const watch = read('src/core/watch.js');
  const css = read('src/styles/core.css');
  assert.match(watch, /bt-native-watch-toolbar/);
  assert.doesNotMatch(watch, /bt-native-toolbar-slot|slot\.append|cloneNode\(/);
  assert.match(css, /\.bt-native-watch-toolbar/);
  assert.doesNotMatch(css, /\.bt-native-watch-toolbar[^}]*pointer-events\s*:\s*none/is);
});

test('native recommendation column is decorated in place instead of duplicated', () => {
  const watch = read('src/core/watch.js');
  const css = read('src/styles/core.css');
  assert.match(watch, /bt-native-watch-related/);
  assert.match(css, /\.bt-native-watch-related/);
  assert.doesNotMatch(watch, /bt-watch-related-column|buildRelated|compactRelatedCard/);
});

test('decorate and adapt pages expose overlay sidebar drawers', () => {
  const watch = read('src/core/watch.js');
  const adapter = read('src/core/native-adapter.js');
  const ui = read('src/core/ui.js');
  assert.match(ui, /createSidebarDrawer/);
  assert.match(watch, /toggleSidebar/);
  assert.match(adapter, /toggleSidebar/);
});

test('unknown Bilibili web pages use native adapter rather than passthrough', () => {
  const policy = read('src/core/policy.js');
  assert.match(policy, /return \{ route: 'native', strategy: 'adapt' \}/);
});

test('all-search uses official WBI all endpoint rather than parallel video plus users', () => {
  const bg = read('src/background.js');
  assert.match(bg, /\/x\/web-interface\/wbi\/search\/all\/v2/);
  assert.doesNotMatch(bg, /Promise\.all\(\[runTypedSearch\('video'\), page === 1 \? runTypedSearch\('bili_user'\)/);
});

test('all-search limits channel card to one official user result', () => {
  const data = read('src/core/data.js');
  const ui = read('src/core/ui.js');
  assert.match(data, /normalizeSearchAll/);
  assert.match(ui, /category==='all'\?users\.slice\(0,1\):users/);
});

test('sidebar sections have subtle separators', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /\.bt-side-section\+\.bt-side-section\{[^}]*border-top:1px solid var\(--bt-border\)/);
});

test('settings expose meaningful appearance home playback and search options', () => {
  const html = read('src/options/options.html');
  const js = read('src/options/options.js');
  for (const id of ['showSubscriptions','homeFollowedShelf','homeLiveShelf','homeBangumiShelf','homePopularShelf','hoverPreview','searchSuggestions','hideAds']) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(js, new RegExp(id));
  }
});

test('native Bilibili comments remain in place and BiliTube only marks their outer root', () => {
  const watch = read('src/core/watch.js');
  const css = read('src/styles/core.css');
  assert.match(watch, /bt-native-watch-comments/);
  assert.doesNotMatch(watch, /bt-native-comments-slot|slot\.append|buildComments\(|cloneNode\(/);
  assert.match(css, /\.bt-native-watch-comments\{/);
  assert.doesNotMatch(css, /\.bt-native-watch-comments\s+(?:bili-comment|#comment|\.reply)/);
});

test('watch does not rebuild recommendation anchors or intercept native recommendation navigation', () => {
  const watch = read('src/core/watch.js');
  assert.doesNotMatch(watch, /bindDirectLink|preventDefault\(|location\.assign|buildRelated|compactRelatedCard/);
  assert.match(watch, /bt-native-watch-related/);
});

