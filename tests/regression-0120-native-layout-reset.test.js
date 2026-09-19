const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const Policy = require('../src/core/policy.js');

function loc(url) {
  const u = new URL(url);
  return { hostname:u.hostname, pathname:u.pathname, search:u.search, hash:u.hash };
}

test('v0.12 History is native-first adapt instead of API-backed replacement', () => {
  assert.deepEqual(Policy.resolve(loc('https://www.bilibili.com/history')), { route:'history', strategy:'adapt' });
  assert.deepEqual(Policy.resolve(loc('https://www.bilibili.com/account/history')), { route:'history', strategy:'adapt' });
  const app = read('src/core/app.js');
  const replaceStart = app.indexOf('function renderReplace(context, requestData=true)');
  const replaceEnd = app.indexOf('function scheduleDomRefresh', replaceStart);
  const replaceBody = app.slice(replaceStart, replaceEnd);
  assert.doesNotMatch(replaceBody, /context\.route==='history'/);
  assert.doesNotMatch(replaceBody, /requestApi\('history'/);
});

test('Watch keeps native left/right wrappers intact and uses a stable two-column YouTube-like layout', () => {
  const watch = read('src/core/watch.js');
  const css = read('src/styles/core.css');
  assert.match(watch, /bt-native-watch-aside/);
  assert.match(watch, /bt-native-watch-aside-inner/);
  assert.match(css, /--bt-watch-related-w\s*:\s*402px/);
  assert.match(css, /\.bt-watch-native-layout\{[^}]*grid-template-columns\s*:\s*minmax\(0,1fr\)\s+minmax\(320px,var\(--bt-watch-related-w\)\)/s);
  assert.match(css, /\.bt-native-watch-main\{[^}]*display\s*:\s*flex!important/s);
  assert.match(css, /\.bt-native-watch-aside\{[^}]*display\s*:\s*block!important/s);
  assert.doesNotMatch(css, /display\s*:\s*contents/i);
  assert.doesNotMatch(watch, /appendChild\s*\(\s*(?:player|toolbar|comment|related|up)/i);
  assert.doesNotMatch(watch, /insertBefore\s*\(\s*(?:player|toolbar|comment|related|up)/i);
});

test('Watch orders the native left column as player title author toolbar description comments', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /\.bt-native-watch-player-host\{[^}]*order\s*:\s*0!important[^}]*aspect-ratio\s*:\s*16\s*\/\s*9/s);
  assert.match(css, /\.bt-native-watch-info\{[^}]*order\s*:\s*1!important/s);
  assert.match(css, /\.bt-watch-author-row\{[^}]*order\s*:\s*2!important/s);
  assert.match(css, /\.bt-native-watch-toolbar\{[^}]*order\s*:\s*3!important/s);
  assert.match(css, /\.bt-native-watch-description\{[^}]*order\s*:\s*4!important/s);
  assert.match(css, /\.bt-native-watch-comments\{[^}]*order\s*:\s*5!important/s);
  assert.match(css, /\.bt-native-watch-related\{[^}]*width\s*:\s*100%!important/s);
});

test('native BPX controls are only visually compacted toward YouTube geometry', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /html\.bt-watch-decorated[^\n]*\.bpx-player-control-bottom/);
  assert.match(css, /\.bpx-player-control-bottom\{[^}]*min-height\s*:\s*48px/s);
  assert.match(css, /\.bpx-player-ctrl-btn\{[^}]*min-width\s*:\s*40px[^}]*height\s*:\s*40px/s);
  assert.match(css, /\.bpx-player-progress[^\{]*\{[^}]*height\s*:\s*3px/s);
  assert.doesNotMatch(read('src/core/watch.js'), /\.click\(\)|dispatchEvent\s*\(/);
});

test('History native route has YouTube-like layout styling but keeps Bilibili controls visible', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /html\.bt-native-adapted\[data-bt-native-route="history"\]/);
  for (const selector of ['.history-record','.history-wrap','.history-list','.b-head-search','.main-breadcrums','.r-info','.l-info','.cover-contain']) {
    assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  assert.doesNotMatch(css, /data-bt-native-route="history"[^\n]*:is\([^)]*(?:history-btn|b-head-search)[^)]*\)[^{]*\{[^}]*display\s*:\s*none/is);
});
