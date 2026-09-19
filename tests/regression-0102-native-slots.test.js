const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('watch marks native toolbar and comment roots without creating slots', () => {
  const watch = read('src/core/watch.js');
  assert.match(watch, /bt-native-watch-toolbar/);
  assert.match(watch, /bt-native-watch-comments/);
  assert.doesNotMatch(watch, /bt-native-toolbar-slot|bt-native-comments-slot|createComment\(/);
});

test('native watch business nodes are never moved cloned or restored by BiliTube', () => {
  const watch = read('src/core/watch.js');
  assert.doesNotMatch(watch, /slot\.append|placeholder\.replaceWith|restoreNativeModules|cloneNode\(/);
  assert.doesNotMatch(watch, /appendChild\s*\(\s*(?:player|toolbar|comment)/i);
});

test('native comment internals are not restyled by BiliTube', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /\.bt-native-watch-comments\{/);
  assert.doesNotMatch(css, /\.bt-native-watch-comments\s+(?:bili-comment|bili-comments|#comment|\.reply)/);
});
