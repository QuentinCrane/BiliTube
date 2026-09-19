const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('watch observes Bilibili data-screen state instead of intercepting player controls', () => {
  const watch = read('src/core/watch.js');
  assert.match(watch, /data-screen/);
  assert.match(watch, /bt-player-wide/);
  assert.match(watch, /bt-player-web-fullscreen/);
  assert.match(watch, /bt-player-mini/);
  assert.doesNotMatch(watch, /PLAYER_MODE_CONTROL_SELECTOR|pointerdown|\.click\(\)|dispatchEvent/);
});

test('web fullscreen removes BiliTube chrome while leaving player ownership to Bilibili', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /html\.bt-player-web-fullscreen body[^}]*padding-top:0!important/);
  assert.match(css, /html\.bt-player-web-fullscreen #bilitube-watch-layer[^}]*display:none!important/);
  assert.doesNotMatch(css, /bt-player-mode-transition/);
});

test('wide mode releases two-column geometry while mini keeps the normal Watch grid', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /html\.bt-player-wide \.bt-watch-native-layout/);
  assert.match(css, /\.bt-player-wide \.bt-native-watch-related[^}]*display:none!important/);
  assert.doesNotMatch(css, /html\.bt-player-mini \.bt-watch-native-layout/);
  assert.doesNotMatch(css, /\.bt-player-mini \.bt-native-watch-related[^}]*display:none!important/);
});

test('mode synchronization follows mutations to data-screen and fullscreenchange', () => {
  const watch = read('src/core/watch.js');
  assert.match(watch, /attributeFilter:\s*\['data-screen'\]/);
  assert.match(watch, /schedulePlayerModeSync/);
  assert.match(watch, /fullscreenchange/);
  assert.match(watch, /webkitfullscreenchange/);
});
