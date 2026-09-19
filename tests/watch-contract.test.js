const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('watch decorator keeps native player and business modules in their original parents', () => {
  const src = read('src/core/watch.js');
  assert.match(src, /MAX_RETRIES/);
  assert.match(src, /bt-native-watch-player-host/);
  assert.match(src, /bt-native-watch-toolbar/);
  assert.match(src, /bt-native-watch-comments/);
  assert.doesNotMatch(src, /appendChild\s*\(\s*(?:player|toolbar|comment)|replaceWith\s*\(\s*(?:player|toolbar|comment)|insertBefore\s*\(\s*(?:player|toolbar|comment)/i);
});

test('legacy native action proxy remains fail-closed and is not used by the watch decorator', () => {
  const actions = read('src/core/actions.js');
  const watch = read('src/core/watch.js');
  assert.match(actions, /findTarget/);
  assert.match(actions, /return false/);
  assert.doesNotMatch(watch, /Actions|callbacks\.action|dispatchEvent/);
});

test('watch discovers native left-column regions with bounded retries and marking only', () => {
  const src = read('src/core/watch.js');
  assert.match(src, /\.left-container/);
  assert.match(src, /#playerWrap|#bilibili-player-wrap|\.video-player-container|\.player-wrap|#bilibili-player/);
  assert.match(src, /classList\.add/);
  assert.match(src, /MAX_RETRIES/);
  assert.doesNotMatch(src, /findInsertionAnchor|appendChild\s*\(\s*player|replaceWith\s*\(\s*player/);
});
