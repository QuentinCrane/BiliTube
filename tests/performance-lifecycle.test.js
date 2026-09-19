const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
  const timers = new Map();
  const observed = new Set();
  const requests = [];
  let nextTimer = 0;
  const context = vm.createContext({
    setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
    IntersectionObserver: class {
      observe(card) { observed.add(card); }
      unobserve(card) { observed.delete(card); }
      disconnect() { observed.clear(); }
    },
  });
  vm.runInContext(fs.readFileSync(require.resolve('../src/core/preview.js'), 'utf8'), context);
  const controller = context.BiliTubePreview.createController({ requestMedia: id => requests.push(id) });
  function card() {
    const listeners = new Map();
    return {
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
      },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
      contains() { return false; },
      fire(type) { for (const fn of listeners.get(type) || []) fn({ relatedTarget: null }); },
      count() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
    };
  }
  return { controller, card, timers, observed, requests };
}

test('preview destruction releases all card listeners, observations and pending work', () => {
  const h = harness();
  const cards = Array.from({ length: 500 }, h.card);
  for (const card of cards) h.controller.bind(card, { bvid: 'BVtest' }, {});
  cards[0].fire('pointerenter');
  assert.equal(h.timers.size, 1);
  assert.equal(h.observed.size, 500);
  h.controller.destroy();
  assert.equal(h.timers.size, 0);
  assert.equal(h.observed.size, 0);
  assert.equal(cards.reduce((sum, card) => sum + card.count(), 0), 0);
  cards[0].fire('pointerenter');
  assert.equal(h.timers.size, 0);
});

test('rebinding a preview card does not accumulate listeners and old cleanup is harmless', () => {
  const h = harness();
  const card = h.card();
  const oldCleanup = h.controller.bind(card, { bvid: 'BVold' }, {});
  h.controller.bind(card, { bvid: 'BVnew' }, {});
  oldCleanup();
  assert.equal(card.count(), 3);
  card.fire('pointerenter');
  assert.equal(h.timers.size, 1);
  [...h.timers.values()][0]();
  assert.deepEqual(h.requests, ['BVnew']);
  h.controller.destroy();
  assert.equal(card.count(), 0);
});

test('duplicate video cards cannot cancel each other and the controller can be reused', () => {
  const h = harness();
  const first = h.card(), second = h.card();
  const unbind = h.controller.bind(first, { bvid: 'BVsame' }, {});
  h.controller.bind(second, { bvid: 'BVsame' }, {});
  second.fire('pointerenter');
  unbind();
  assert.equal(h.timers.size, 1);
  h.controller.destroy();
  h.controller.bind(first, { bvid: 'BVagain' }, {});
  first.fire('pointerenter');
  assert.equal(h.timers.size, 1);
  assert.equal(h.observed.size, 1);
  h.controller.destroy();
  assert.equal(first.count(), 0);
});
