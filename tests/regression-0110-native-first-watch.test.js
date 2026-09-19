const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('v0.11 watch never moves or rebuilds native business modules', () => {
  const watch = read('src/core/watch.js');
  for (const forbidden of [
    /bt-native-toolbar-slot/,
    /bt-native-comments-slot/,
    /moveNativeModule/,
    /restoreNativeModules/,
    /movedNativeModules/,
    /data-bt-react-bridge/,
    /COMMENT_CONTENT_MARKER_SELECTOR/,
    /function\s+buildPanel\s*\(/,
  ]) assert.doesNotMatch(watch, forbidden);
  assert.doesNotMatch(watch, /appendChild\s*\(\s*(?:player|toolbar|comment)/i);
  assert.doesNotMatch(watch, /insertBefore\s*\(\s*(?:player|toolbar|comment)/i);
});

test('v0.11 watch discovers and marks native regions in place', () => {
  const watch = read('src/core/watch.js');
  for (const marker of [
    'bt-native-watch-player-host','bt-native-watch-info','bt-native-watch-up',
    'bt-native-watch-toolbar','bt-native-watch-description','bt-native-watch-comments','bt-native-watch-related'
  ]) assert.match(watch, new RegExp(marker));
  assert.match(watch, /classList\.add/);
  assert.match(watch, /classList\.remove/);
});

test('v0.11 watch observes native screen state without clicking mode controls', () => {
  const watch = read('src/core/watch.js');
  assert.match(watch, /data-screen/);
  assert.match(watch, /bt-player-wide/);
  assert.match(watch, /bt-player-web-fullscreen/);
  assert.match(watch, /fullscreenchange/);
  assert.doesNotMatch(watch, /\.click\(\)/);
  assert.doesNotMatch(watch, /dispatchEvent\s*\(/);
});

test('native comments and toolbar remain interactive in CSS', () => {
  const css = read('src/styles/core.css');
  assert.doesNotMatch(css, /bt-native-toolbar-slot|bt-native-comments-slot/);
  assert.match(css, /\.bt-native-watch-toolbar/);
  assert.match(css, /\.bt-native-watch-comments/);
  assert.doesNotMatch(css, /\.bt-native-watch-(?:toolbar|comments)[^{]*\{[^}]*pointer-events\s*:\s*none/is);
});

test('native recommendations are decorated instead of replaced by a duplicate watch column', () => {
  const watch = read('src/core/watch.js');
  const css = read('src/styles/core.css');
  assert.doesNotMatch(watch, /bt-watch-related-column|buildRelated|compactRelatedCard/);
  assert.match(watch, /bt-native-watch-related/);
  assert.match(css, /\.bt-native-watch-related/);
});

test('watch page exposes a BiliTube-owned watch-later control and syncs its state', () => {
  const watch = read('src/core/watch.js');
  const app = read('src/core/app.js');
  const css = read('src/styles/core.css');
  assert.match(watch, /bt-watchlater-watch/);
  assert.match(watch, /callbacks\.toggleWatchLater/);
  assert.match(watch, /watchData\.bvid/);
  assert.match(app, /ensureWatchLaterState\(\)\.then/);
  assert.match(app, /\.bt-watchlater-quick,\.bt-watchlater-watch/);
  assert.match(css, /\.bt-watchlater-watch/);
});
