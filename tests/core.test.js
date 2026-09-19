const test = require('node:test');
const assert = require('node:assert/strict');

const Policy = require('../src/core/policy.js');
const Theme = require('../src/core/theme.js');
const Cache = require('../src/core/cache.js');
const Preview = require('../src/core/preview-model.js');

function loc(url) {
  const u = new URL(url);
  return { hostname: u.hostname, pathname: u.pathname, search: u.search, hash: u.hash };
}

test('route policy only replaces supported core pages', () => {
  assert.deepEqual(Policy.resolve(loc('https://www.bilibili.com/')), { route: 'home', strategy: 'replace' });
  assert.deepEqual(Policy.resolve(loc('https://www.bilibili.com/video/BV1abc')), { route: 'watch', strategy: 'decorate' });
  assert.deepEqual(Policy.resolve(loc('https://space.bilibili.com/12345')), { route: 'space-home', strategy: 'replace', mid: '12345' });
  assert.deepEqual(Policy.resolve(loc('https://space.bilibili.com/12345/upload')), { route: 'space-upload', strategy: 'replace', mid: '12345' });
  assert.deepEqual(Policy.resolve(loc('https://search.bilibili.com/all?keyword=test')), { route: 'search-all', strategy: 'replace' });
  assert.deepEqual(Policy.resolve(loc('https://search.bilibili.com/video?keyword=test')), { route: 'search-video', strategy: 'replace' });
  assert.deepEqual(Policy.resolve(loc('https://search.bilibili.com/upuser?keyword=test')), { route: 'search-user', strategy: 'replace' });
  assert.deepEqual(Policy.resolve(loc('https://www.bilibili.com/history')), { route: 'history', strategy: 'adapt' });
});

test('expanded page policy replaces data-backed library pages and adapts complex native pages', () => {
  assert.deepEqual(Policy.resolve(loc('https://t.bilibili.com/')), { route: 'dynamic', strategy: 'replace' });
  assert.deepEqual(Policy.resolve(loc('https://www.bilibili.com/dynamic')), { route: 'dynamic', strategy: 'replace' });
  assert.deepEqual(Policy.resolve(loc('https://www.bilibili.com/watchlater/#/list')), { route: 'watchlater', strategy: 'replace' });
  assert.deepEqual(Policy.resolve(loc('https://www.bilibili.com/list/watchlater')), { route: 'watchlater', strategy: 'replace' });
  assert.deepEqual(Policy.resolve(loc('https://space.bilibili.com/12345/favlist')), { route: 'favorites', strategy: 'replace', mid: '12345' });
  for (const url of [
    'https://message.bilibili.com/',
    'https://live.bilibili.com/123',
    'https://www.bilibili.com/bangumi/play/ep123',
    'https://space.bilibili.com/12345/dynamic',
    'https://www.bilibili.com/v/popular/all',
  ]) {
    assert.equal(Policy.resolve(loc(url)).strategy, 'adapt', url);
  }
});



test('explicit per-page native escape bypasses replacement', () => {
  assert.equal(Policy.resolve(loc('https://www.bilibili.com/history?bilitube_native=1')).strategy, 'passthrough');
  assert.equal(Policy.resolve(loc('https://space.bilibili.com/12345?bilitube_native=1')).strategy, 'passthrough');
});
test('theme preference resolves without changing route state', () => {
  assert.equal(Theme.resolve('light', true), 'light');
  assert.equal(Theme.resolve('dark', false), 'dark');
  assert.equal(Theme.resolve('system', true), 'dark');
  assert.equal(Theme.resolve('system', false), 'light');
  assert.equal(Theme.nextExplicit('light'), 'dark');
  assert.equal(Theme.nextExplicit('dark'), 'light');
});

test('cache expires entries by ttl', async () => {
  let now = 1000;
  const cache = Cache.createCache(() => now);
  cache.set('a', 42, 100);
  assert.equal(cache.get('a'), 42);
  now = 1099;
  assert.equal(cache.get('a'), 42);
  now = 1101;
  assert.equal(cache.get('a'), undefined);
});

test('cache remember deduplicates inflight requests', async () => {
  let calls = 0;
  const cache = Cache.createCache(() => Date.now());
  const loader = async () => { calls += 1; await new Promise(r => setTimeout(r, 5)); return 'ok'; };
  const [a, b] = await Promise.all([
    cache.remember('same', 1000, loader),
    cache.remember('same', 1000, loader),
  ]);
  assert.equal(a, 'ok');
  assert.equal(b, 'ok');
  assert.equal(calls, 1);
});

test('preview seek math clamps to media bounds', () => {
  assert.equal(Preview.seekTime(50, 0, 100, 200), 100);
  assert.equal(Preview.seekTime(-10, 0, 100, 200), 0);
  assert.equal(Preview.seekTime(120, 0, 100, 200), 200);
  assert.equal(Preview.seekTime(10, 0, 0, 200), 0);
});

test('preview session reducer keeps exactly one active card', () => {
  let state = Preview.initialState();
  state = Preview.reduce(state, { type: 'request', id: 'A' });
  assert.equal(state.activeId, 'A');
  state = Preview.reduce(state, { type: 'request', id: 'B' });
  assert.equal(state.activeId, 'B');
  state = Preview.reduce(state, { type: 'cancel', id: 'A' });
  assert.equal(state.activeId, 'B');
  state = Preview.reduce(state, { type: 'cancel', id: 'B' });
  assert.equal(state.activeId, null);
});
