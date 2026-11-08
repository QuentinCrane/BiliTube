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

test('legacy synthetic native action proxy is removed from runtime and package', () => {
  const watch = read('src/core/watch.js');
  const app = read('src/core/app.js');
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(fs.existsSync(path.join(root,'src/core/actions.js')),false);
  assert.doesNotMatch(watch, /Actions|callbacks\.action|dispatchEvent/);
  assert.doesNotMatch(app, /BiliTubeActions|Actions\.invoke|callbacks\.action/);
  assert.ok(!manifest.content_scripts.some(entry => (entry.js || []).includes('src/core/actions.js')));
});

test('watch discovers native left-column regions with bounded retries and marking only', () => {
  const src = read('src/core/watch.js');
  assert.match(src, /\.left-container/);
  assert.match(src, /#playerWrap|#bilibili-player-wrap|\.video-player-container|\.player-wrap|#bilibili-player/);
  assert.match(src, /classList\.add/);
  assert.match(src, /MAX_RETRIES/);
  assert.doesNotMatch(src, /findInsertionAnchor|appendChild\s*\(\s*player|replaceWith\s*\(\s*player/);
});
