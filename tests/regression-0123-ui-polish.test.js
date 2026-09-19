const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('Watch marks every recommendation container and never treats generic card info as the UP module', () => {
  const watch = read('src/core/watch.js');
  assert.match(watch, /function\s+all\s*\(selectors/);
  assert.match(watch, /def\.marker\s*===\s*['"]bt-native-watch-related['"]/);
  assert.match(watch, /for\s*\(const\s+node\s+of\s+all\(def\.selectors/);
  assert.match(watch, /bt-native-watch-up[^\n]*selectors:\s*\[['"]\.up-panel-container['"],\s*['"]\.up-info-container['"]/);
  assert.doesNotMatch(watch, /bt-native-watch-up[^\n]*['"]\.up-info['"]/);
  assert.doesNotMatch(watch, /bt-native-watch-up[^\n]*['"]\.upinfo['"]/);
});

test('Watch recommendation styling is scoped to the whole native aside so lazy-loaded cards keep metadata visible', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /\.bt-native-watch-aside\s+:is\([^)]*video-page-card-small[^)]*\)\s+\.card-box[^\{]*\{[^}]*grid-template-columns\s*:\s*168px\s+minmax\(0,1fr\)/s);
  assert.match(css, /\.bt-native-watch-aside\s+:is\([^)]*\.title[^)]*\)\{[^}]*-webkit-line-clamp\s*:\s*2/s);
  assert.match(css, /\.bt-native-watch-aside\s+:is\([^)]*(?:upname|name|playinfo|meta)[^)]*\)\{[^}]*display\s*:\s*(?:block|flex|inline-flex)!important/s);
});

test('Watch waits for core layout and does not rescan the entire body for every lazy mutation', () => {
  const watch = read('src/core/watch.js');
  assert.match(watch, /function\s+coreRegionsReady\s*\(/);
  assert.match(watch, /classList\.add\([^\n]*['"]bt-watch-ready['"]/);
  assert.doesNotMatch(watch, /regionObserver\.observe\(doc\.body,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/);
  assert.match(watch, /regionObserver\.observe\([^,]*(?:layout|aside|main)[^,]*,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/);
});

test('Watch rebinds core markers after Bilibili rewrites native classes', () => {
  const watch = read('src/core/watch.js');
  assert.match(watch, /classObserver\s*=\s*new MutationObserver/);
  assert.match(watch, /attributeFilter:\s*\[['"]class['"]\]/);
  assert.match(watch, /discoverAddedRegions\(mutation\.target\)/);
});

test('top bar uses Dynamic instead of Upload', () => {
  const ui = read('src/core/ui.js');
  assert.match(ui, /navLink\(['"]https:\/\/t\.bilibili\.com\/['"],['"]动态['"],['"]dynamic['"]/);
  assert.doesNotMatch(ui, /member\.bilibili\.com\/platform\/upload\/video\/frame['"],['"]投稿['"]/);
});

test('theme toggle has a real transition path and no global transition kill-switch', () => {
  const app = read('src/core/app.js');
  const css = read('src/styles/core.css');
  assert.match(app, /startViewTransition/);
  assert.match(app, /bt-theme-animating/);
  assert.doesNotMatch(css, /html\.bt-theme-switching[^\n]*transition\s*:\s*none!important/);
  assert.match(css, /::view-transition-(?:old|new)\(root\)/);
  assert.match(css, /html\.bt-theme-animating\s+:is\(/);
});

test('Watch spacing keeps YouTube-like tight column gap with safer outer gutters', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /\.bt-watch-native-layout\{[^}]*column-gap\s*:\s*16px!important[^}]*padding\s*:\s*16px 36px 48px!important/s);
  assert.match(css, /\.bt-native-watch-player-host\{[^}]*margin\s*:\s*0 0 10px!important/s);
  assert.match(css, /\.bt-native-watch-info\{[^}]*margin\s*:\s*0 0 4px!important/s);
});
