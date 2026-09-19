const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('background exposes a reliable logged-in account endpoint for the topbar avatar', () => {
  const src = read('src/background.js');
  assert.match(src, /type === ['"]account['"]/);
  assert.match(src, /x\/web-interface\/nav/);
});

test('account payload normalization keeps mid name face and login state', () => {
  const Data = require('../src/core/data.js');
  assert.equal(typeof Data.normalizeAccount, 'function');
  const user = Data.normalizeAccount({ code:0, data:{ mid:123, uname:'Alice', face:'http://i0.hdslb.com/a.jpg', isLogin:true } });
  assert.deepEqual(user, { mid:'123', name:'Alice', face:'https://i0.hdslb.com/a.jpg', isLogin:true });
});

test('watch topbar receives and can update real chrome account data without remounting the page', () => {
  const src = read('src/core/watch.js');
  assert.match(src, /function updateChrome\(/);
  assert.match(src, /createTopbar\(chromeData/);
  assert.match(src, /return \{[\s\S]*updateChrome/);
  assert.doesNotMatch(src, /createTopbar\(\{\},callbacks\)/);
});

test('app refreshes account data on watch pages and updates the persistent watch chrome', () => {
  const src = read('src/core/app.js');
  assert.match(src, /requestApi\(['"]account['"]/);
  assert.match(src, /watch\.updateChrome\(chromeData\(\)/);
});

test('watch decorator preserves Bilibili comments in place instead of replacing or relocating them', () => {
  const src = read('src/core/watch.js');
  const app = read('src/core/app.js');
  assert.match(src, /bt-native-watch-comments/);
  assert.doesNotMatch(src, /bt-native-comments-slot|restoreNativeModules|function buildComments|submitComment|cloneNode\(/);
  assert.doesNotMatch(app, /requestApi\(['"]watch-comments['"]/);
});

test('watch CSS only decorates the native comment root and never hides comment internals', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /\.bt-native-watch-comments\{/);
  assert.doesNotMatch(css, /bt-api-comments-ready/);
  assert.doesNotMatch(css, /\.bt-native-watch-comments\s+(?:bili-comment|bili-comments|#comment|\.reply)/);
});

test('native-first watch does not use metadata-hiding selectors that can swallow comment ancestors', () => {
  const css = read('src/styles/core.css');
  const watch = read('src/core/watch.js');
  assert.doesNotMatch(css, /bt-watch-hide-native-meta/);
  assert.doesNotMatch(watch, /bt-watch-hide-native-meta/);
});

