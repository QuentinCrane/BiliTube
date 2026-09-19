const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('Watch keeps Bilibili left/right columns as real layout boxes and bans display:contents', () => {
  const css = read('src/styles/core.css');
  assert.doesNotMatch(css, /\.bt-native-watch-(?:main|aside|aside-inner)[^{]*\{[^}]*display\s*:\s*contents/i);
  assert.match(css, /\.bt-watch-native-layout\{[^}]*grid-template-columns\s*:\s*minmax\(0,1fr\)\s+minmax\(320px,var\(--bt-watch-related-w\)\)/s);
  assert.match(css, /\.bt-native-watch-main\{[^}]*display\s*:\s*flex!important[^}]*flex-direction\s*:\s*column/s);
  assert.match(css, /\.bt-native-watch-aside\{[^}]*display\s*:\s*block!important/s);
});

test('Watch orders native left-column regions with flex order instead of cross-parent grid placement', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /\.bt-native-watch-player-host\{[^}]*order\s*:\s*0!important/s);
  assert.match(css, /\.bt-native-watch-info\{[^}]*order\s*:\s*1!important/s);
  assert.match(css, /\.bt-watch-author-row\{[^}]*order\s*:\s*2!important/s);
  assert.match(css, /\.bt-native-watch-toolbar\{[^}]*order\s*:\s*3!important/s);
  assert.match(css, /\.bt-native-watch-description\{[^}]*order\s*:\s*4!important/s);
  assert.match(css, /\.bt-native-watch-comments\{[^}]*order\s*:\s*5!important/s);
  assert.doesNotMatch(css, /\.bt-native-watch-(?:player-host|info|up|toolbar|description|comments|related)\{[^}]*grid-(?:column|row)/s);
});

test('Watch creates a stable YouTube-like author row without moving native Bilibili modules', () => {
  const watch = read('src/core/watch.js');
  assert.match(watch, /bt-watch-author-row/);
  assert.match(watch, /creator\.avatar/);
  assert.match(watch, /creator\.href/);
  assert.match(watch, /callbacks\.followSpace/);
  assert.doesNotMatch(watch, /appendChild\s*\(\s*(?:player|toolbar|comment|related|up)\b/i);
  assert.doesNotMatch(watch, /insertBefore\s*\(\s*(?:player|toolbar|comment|related|up)\b/i);
});

test('Watch right column hides native author and danmaku modules but keeps recommendations native and clickable', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /\.bt-native-watch-aside\s+\.bt-native-watch-up\{[^}]*display\s*:\s*none!important/s);
  assert.match(css, /\.bt-native-watch-aside\s+:is\([^)]*(?:danmukuBox|danmaku)[^)]*\)\{[^}]*display\s*:\s*none!important/s);
  assert.match(css, /\.bt-native-watch-related\{[^}]*width\s*:\s*100%!important/s);
  assert.doesNotMatch(css, /\.bt-native-watch-related\{[^}]*position\s*:\s*(?:fixed|absolute)/s);
});

test('author mirror is idempotent across body mutation rescans', () => {
  const watch = read('src/core/watch.js');
  assert.match(watch, /let authorSignature\s*=\s*['"]/);
  assert.match(watch, /authorRow\s*&&\s*authorRow\.isConnected\s*&&\s*authorSignature\s*===\s*signature/);
  assert.match(watch, /authorSignature\s*=\s*signature/);
});
