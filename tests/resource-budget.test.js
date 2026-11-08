const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const UI = require('../src/core/ui.js');
const Data = require('../src/core/data.js');

test('image hosts get one sized WebP variant and everything else is untouched', () => {
  const cover = 'https://i2.hdslb.com/bfs/archive/9ed76ef38bde2543f7cfe0b7edcf6bcc2d90855e.jpg';
  assert.equal(UI.sizedImage(cover, 672, 378), `${cover}@672w_378h_1c.webp`);
  // an existing modifier is replaced, not appended
  assert.equal(UI.sizedImage(`${cover}@320w_180h_1c`, 672, 378), `${cover}@672w_378h_1c.webp`);
  // avatars keep a square crop
  assert.equal(UI.sizedImage('https://i2.hdslb.com/bfs/face/abc.jpg', 96, 96), 'https://i2.hdslb.com/bfs/face/abc.jpg@96w_96h_1c.webp');
  // query strings survive the rewrite
  assert.equal(UI.sizedImage(`${cover}?x=1`, 480, 270), `${cover}@480w_270h_1c.webp?x=1`);
  for (const untouched of [
    '',
    'data:image/svg+xml;charset=utf-8,%3Csvg%3E',
    'https://example.com/cover.jpg',
    'https://www.bilibili.com/video/BV1xx',
    'https://i0.hdslb.com.dark.example.com/cover.jpg',
  ]) {
    assert.equal(UI.sizedImage(untouched, 672, 378), untouched, untouched);
  }
});

test('the sized variant is the requested src while the original stays as the fallback', () => {
  const ui = read('src/core/ui.js');
  assert.match(ui, /img\.dataset\.btFullSrc=full/);
  assert.match(ui, /img\.__btDeferredSrc=rendered/);
  assert.match(ui, /degraded=true;img\.src=full;return;/, 'a rejected variant must fall back once');
});

test('feed items carry the first page id when the payload provides it', () => {
  const payload = {
    code: 0,
    data: {
      item: [{ bvid: 'BV1cid', title: 'cid', cid: 43221911263, pic: 'http://i2.hdslb.com/bfs/archive/a.jpg', owner: { mid: 1, name: 'u' } }],
    },
  };
  const [item] = Data.normalizeHome(payload);
  assert.equal(item.cid, 43221911263);
  const [without] = Data.normalizeHome({ code: 0, data: { item: [{ bvid: 'BV1nocid', title: 'no cid', pic: '' }] } });
  assert.equal(without.cid, 0);
});

function previewHarness() {
  const timers = new Map();
  let nextTimer = 0;
  const calls = [];
  const clock = { now: 1_000_000 };
  const context = vm.createContext({
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
    setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    URL,
    // The module reads Date.now() from the vm realm, so drive it from the test.
    Date: { now: () => clock.now },
  });
  vm.runInContext(read('src/core/preview.js'), context);
  const controller = context.BiliTubePreview.createController({
    requestMedia: (bvid, cid) => calls.push({ bvid, cid }),
    getDelay: () => 0,
  });
  const card = () => {
    const listeners = new Map();
    return {
      __btCardItem: null,
      addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
      contains() { return false; },
      fire(type) { for (const fn of listeners.get(type) || []) fn({ relatedTarget: null, clientX: 0, clientY: 0 }); },
    };
  };
  const flush = () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } };
  return { controller, card, calls, flush, clock };
}

test('hover preview sends the page id it already knows', () => {
  const h = previewHarness();
  const card = h.card();
  card.__btCardItem = { bvid: 'BV1cid', cid: 43221911263 };
  h.controller.bind(card, { bvid: 'BV1cid', cid: 43221911263 }, { append() {} });
  card.fire('pointerenter');
  h.flush();
  assert.deepEqual(h.calls, [{ bvid: 'BV1cid', cid: 43221911263 }]);
});

test('hover preview without a known page id still asks for the bvid alone', () => {
  const h = previewHarness();
  const card = h.card();
  card.__btCardItem = { bvid: 'BV1nocid', cid: 0 };
  h.controller.bind(card, { bvid: 'BV1nocid', cid: 0 }, { append() {} });
  card.fire('pointerenter');
  h.flush();
  assert.deepEqual(h.calls, [{ bvid: 'BV1nocid', cid: 0 }]);
});

test('a video without a preview stream is not looked up again immediately', () => {
  const h = previewHarness();
  h.controller.resolve('BVdead', '');
  const first = h.card();
  first.__btCardItem = { bvid: 'BVdead', cid: 0 };
  h.controller.bind(first, { bvid: 'BVdead', cid: 0 }, { append() {} });
  first.fire('pointerenter');
  h.flush();
  assert.equal(h.calls.length, 0, 'a negative result is cached for 30 s');

  h.clock.now += 31_000;
  const second = h.card();
  second.__btCardItem = { bvid: 'BVdead', cid: 0 };
  h.controller.bind(second, { bvid: 'BVdead', cid: 0 }, { append() {} });
  second.fire('pointerenter');
  h.flush();
  assert.equal(h.calls.length, 1, 'after the negative TTL the lookup is retried');
});

test('preview resolves the cid without a second lookup, and keeps view as a fallback', () => {
  const background = read('src/background.js');
  const block = background.slice(background.indexOf("if (type === 'preview')"), background.indexOf("return null;\n}", background.indexOf("if (type === 'preview')")));
  assert.match(block, /let cid = Number\(params\.cid\) \|\| 0/, 'a supplied cid must win');
  assert.ok(block.indexOf('player/pagelist') < block.indexOf('web-interface/view'), 'pagelist is the cheap first fallback');
  assert.match(block, /preview-pages/, 'the lookup is cached');
  const app = read('src/core/app.js');
  assert.match(app, /requestMedia: async \(bvid, cid\)/);
  assert.match(app, /ApiClient\.request\('preview', cid \? \{ bvid, cid \} : \{ bvid \}\)/);
});

test('the audit tooling is wired to the shipped contracts', () => {
  const audit = read('scripts/resource_audit.py');
  assert.match(audit, /672w_378h_1c\.webp/);
  assert.match(audit, /player\/pagelist/);
  assert.match(audit, /web-interface\/view/);
  // The existing feed-level paint skipping stays as it was; this change adds no
  // second, unverified variant of it.
  const css = read('src/styles/core.css');
  assert.doesNotMatch(css, /is-long-feed/);
  assert.equal(css.match(/content-visibility/g).length, 1);
});
