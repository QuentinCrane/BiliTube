const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('mini player state is tracked but never switches the Watch page to wide/single-column layout', () => {
  const watch = read('src/core/watch.js');
  const css = read('src/styles/core.css');

  assert.match(watch, /screens\.includes\('mini'\)/);
  assert.match(watch, /classList\.toggle\('bt-player-mini',\s*mini\)/);

  assert.doesNotMatch(css, /html\.bt-player-wide \.bt-watch-native-layout\s*,\s*html\.bt-player-mini \.bt-watch-native-layout/);
  assert.doesNotMatch(css, /\.bt-player-mini \.bt-native-watch-(?:aside|related)[^{]*\{[^}]*display\s*:\s*none!important/s);
  assert.doesNotMatch(css, /\.bt-player-mini \.bt-native-watch-player-host[^{]*\{[^}]*width\s*:\s*100%/s);
});

test('YouTube-sized BPX control overrides do not apply to Bilibili mini player', () => {
  const css = read('src/styles/core.css');
  const controlRules = css.match(/html\.bt-watch-decorated[^\n]*\.bpx-player-(?:control-bottom|ctrl-btn|progress[^\{]*)[^\n]*/g) || [];
  assert.ok(controlRules.length >= 4, 'expected ordinary Watch player control rules');
  for (const rule of controlRules) {
    assert.match(rule, /:not\(\.bt-player-mini\)/, `mini exclusion missing from: ${rule}`);
  }
});

test('native mini player geometry is explicitly released from ordinary Watch sizing', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /html\.bt-watch-decorated\.bt-player-mini[^\{]*\.bpx-player-container\[data-screen=["']mini["']\][^{]*\{[^}]*max-width\s*:\s*none!important/s);
  assert.match(css, /html\.bt-watch-decorated\.bt-player-mini[^\{]*\.bpx-player-container\[data-screen=["']mini["']\][^{]*\{[^}]*aspect-ratio\s*:\s*auto!important/s);
});
