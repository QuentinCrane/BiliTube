const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('watch keeps native toolbar as the only complex action surface while creator identity may be mirrored', () => {
  const watch = read('src/core/watch.js');
  const css = read('src/styles/core.css');
  assert.match(watch, /bt-native-watch-up/);
  assert.match(watch, /bt-native-watch-toolbar/);
  assert.doesNotMatch(watch, /bt-watch-hide-native-meta|bt-watch-native-toolbar/);
  assert.doesNotMatch(css, /bt-watch-hide-native-meta/);
});

test('watch decorator mirrors only creator identity and follow, never Bilibili complex toolbar controls', () => {
  const watch = read('src/core/watch.js');
  assert.match(watch, /bt-watch-author-row/);
  assert.match(watch, /bt-watch-follow/);
  assert.doesNotMatch(watch, /function buildPanel|data-action|bt-watch-actions|bt-watch-like|bt-watch-coin|bt-watch-favorite/);
});

test('space follow uses Bilibili relation API and updates BiliTube profile state', () => {
  const bg = read('src/background.js');
  const app = read('src/core/app.js');
  const ui = read('src/core/ui.js');
  assert.match(bg, /type === 'space-follow'/);
  assert.match(bg, /x\/relation\/modify/);
  assert.match(app, /followSpace/);
  assert.match(app, /profiles\.set/);
  assert.match(ui, /callbacks\.followSpace/);
});

test('desktop sidebar matches YouTube width and uses a transient thumb-only scrollbar', () => {
  const css = read('src/styles/core.css');
  const ui = read('src/core/ui.js');
  assert.match(css, /--bt-sidebar-w:240px/);
  assert.match(css, /--bt-sidebar-compact-w:72px/);
  assert.match(css, /\.bt-sidebar-scroll\{[^}]*scrollbar-width:none/);
  assert.match(css, /\.bt-sidebar-scroll::-webkit-scrollbar/);
  assert.match(css, /\.bt-sidebar-scroll-thumb\{[^}]*opacity:0/);
  assert.match(css, /\.bt-sidebar\.is-scrolling \.bt-sidebar-scroll-thumb/);
  assert.doesNotMatch(css, /\.bt-sidebar-scroll-track/);
  assert.match(ui, /bt-sidebar-scroll-thumb/);
  assert.match(ui, /addEventListener\(['"]scroll['"]/);
  assert.match(ui, /setTimeout\([^,]+,\s*(?:6\d\d|7\d\d|8\d\d)\)/);
});

test('native watch toolbar may be cosmetically restyled but keeps native hit testing', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /\.bt-native-watch-toolbar/);
  assert.doesNotMatch(css, /\.bt-native-watch-toolbar[^}]*pointer-events\s*:\s*none/is);
  assert.doesNotMatch(css, /\.bt-native-watch-toolbar[^}]*display\s*:\s*none/is);
});

