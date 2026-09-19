const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('native-first architecture avoids comment hydration races by never relocating comments', () => {
  const watch = read('src/core/watch.js');
  assert.match(watch, /bt-native-watch-comments/);
  assert.doesNotMatch(watch, /isCommentRootUsable|COMMENT_CONTENT_MARKER_SELECTOR|moveCommentRoot|bt-native-comments-slot/);
});

test('native-first architecture needs no React event bridge because toolbar stays under Bilibili ownership', () => {
  const watch = read('src/core/watch.js');
  assert.match(watch, /bt-native-watch-toolbar/);
  assert.doesNotMatch(watch, /react-bridge|ReactEvent|dispatchEvent|MouseEvent|PointerEvent/i);
});

test('normal watch layout is CSS-first around intact Bilibili left and right columns', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /\.bt-watch-native-layout\{[^}]*display:grid!important/s);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) minmax\(320px,var\(--bt-watch-related-w\)\)/);
  assert.match(css, /\.bt-native-watch-main\{[^}]*display:flex!important[^}]*flex-direction:column/s);
  assert.match(css, /\.bt-native-watch-aside\{[^}]*display:block!important/s);
  assert.doesNotMatch(css, /\.bt-native-watch-(?:main|aside|aside-inner)[^{]*\{[^}]*display:contents/i);
  assert.match(css, /\.bt-native-watch-player-host/);
});

test('native wide web and browser fullscreen remain owned by Bilibili', () => {
  const watch = read('src/core/watch.js');
  const css = read('src/styles/core.css');
  assert.match(watch, /playerScreens\(\)/);
  assert.match(css, /bt-player-wide/);
  assert.match(css, /bt-player-web-fullscreen/);
  assert.match(css, /bt-player-browser-fullscreen/);
  assert.doesNotMatch(watch, /preventDefault|stopPropagation|\.click\(\)/);
});

test('BiliTube cards retain a real watch-later hover control independent of native watch DOM', () => {
  const ui = read('src/core/ui.js');
  assert.match(ui, /bt-watchlater-quick/);
  assert.match(ui, /toggleWatchLater/);
  assert.match(ui, /stopPropagation/);
});
