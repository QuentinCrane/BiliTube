const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Motion = require('../src/core/motion.js');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const REPLACE = { strategy: 'replace', reason: 'reconcile', motionMode: 'full', reducedMotion: false };

test('motion policy only decorates replace-strategy content', () => {
  assert.equal(Motion.shouldAnimate(REPLACE), true);
  for (const strategy of ['decorate', 'adapt', 'passthrough', 'native', undefined]) {
    if (strategy === undefined) continue;
    assert.equal(Motion.shouldAnimate({ ...REPLACE, strategy }), false, strategy);
  }
});

test('motion policy respects motionMode, system preference and preview state', () => {
  assert.equal(Motion.shouldAnimate({ ...REPLACE, motionMode: 'none' }), false);
  assert.equal(Motion.shouldAnimate({ ...REPLACE, motionMode: 'subtle' }), true);
  assert.equal(Motion.shouldAnimate({ ...REPLACE, reducedMotion: true }), false);
  assert.equal(Motion.shouldAnimate({ ...REPLACE, previewActive: true }), false);
});

test('motion policy refuses unknown reasons and oversized frames', () => {
  assert.equal(Motion.shouldAnimate({ ...REPLACE, reason: 'debug' }), false);
  assert.equal(Motion.shouldAnimate({ ...REPLACE, reason: 'append' }), true);
  assert.equal(Motion.shouldAnimate({ ...REPLACE, reason: 'route' }), true);
  assert.equal(Motion.shouldAnimate({ ...REPLACE, visibleCardCount: Motion.LIMITS.maxVisibleCards }), true);
  assert.equal(Motion.shouldAnimate({ ...REPLACE, visibleCardCount: Motion.LIMITS.maxVisibleCards + 1 }), false);
});

function harness(options = {}) {
  const created = [];
  const settings = { motion: 'full', reduced: false, previewActive: false, hidden: false, themeReveal: false, ...options };
  class Node {
    constructor(key, rect) {
      this.__btCardKey = key;
      this.rect = rect;
      this.isConnected = true;
      this.own = [];
    }
    getBoundingClientRect() {
      return { left: this.rect.left, top: this.rect.top, width: this.rect.width ?? 300, height: this.rect.height ?? 170 };
    }
    animate(keyframes, timing) {
      const animation = {
        keyframes, timing, target: this, cancelled: false, finished: new Promise(() => {}),
        effect: { target: this, getKeyframes: () => keyframes, getTiming: () => timing },
        cancel() { this.cancelled = true; },
      };
      created.push(animation);
      this.own.push(animation);
      return animation;
    }
  }
  const doc = {
    get hidden() { return settings.hidden; },
    documentElement: {
      dataset: { get btMotion() { return settings.motion; } },
      classList: { contains: name => name === 'bt-theme-reveal' && settings.themeReveal },
      clientHeight: 900,
    },
    defaultView: {
      innerHeight: 900,
      innerWidth: 1600,
      matchMedia: () => ({ matches: settings.reduced }),
    },
  };
  const controller = Motion.createController(doc, {
    previewActive: () => settings.previewActive,
  });
  const container = nodes => ({ querySelectorAll: () => nodes });
  return { controller, doc, settings, created, Node, container };
}

test('measurement captures only visible keyed cards', () => {
  const h = harness();
  const cards = [
    new h.Node('BV1', { left: 0, top: 100 }),
    new h.Node('BV2', { left: 320, top: 100 }),
    new h.Node('', { left: 640, top: 100 }), // unkeyed: never flipped
    new h.Node('BV3', { left: 0, top: -400, width: 0, height: 0 }), // not painted
    new h.Node('BV4', { left: 0, top: 960 }), // below the fold
  ];
  const frame = h.controller.measure(h.container(cards));
  assert.equal(frame.cards.length, 2);
  assert.deepEqual(frame.cards.map(entry => entry.node.__btCardKey), ['BV1', 'BV2']);
  assert.equal(frame.nodes.has(cards[2]), false);
});

test('measurement is skipped for closed motion, reduced motion, previews and theme reveal', () => {
  for (const [option, value] of [['motion', 'none'], ['reduced', true], ['previewActive', true], ['themeReveal', true], ['hidden', true]]) {
    const h = harness({ [option]: value });
    const frame = h.controller.measure(h.container([new h.Node('BV1', { left: 0, top: 10 })]));
    assert.equal(frame, null, option);
  }
});

test('play inverts the measured delta with an additive transform', () => {
  const h = harness();
  const card = new h.Node('BV1', { left: 100, top: 200 });
  const frame = h.controller.measure(h.container([card]));
  card.rect = { left: 260, top: 120 }; // moved +160 right, -80 up
  const played = h.controller.play(frame);
  assert.equal(played, 1);
  assert.equal(h.created.length, 1);
  const [animation] = h.created;
  assert.equal(animation.keyframes[0].transform, 'translate(-160.00px, 80.00px)');
  assert.equal(animation.keyframes[1].transform, 'translate(0px, 0px)');
  assert.equal(animation.timing.composite, 'add');
  assert.equal(animation.timing.fill, 'none');
  assert.equal(animation.timing.duration, Motion.LIMITS.duration);
});

test('subtle motion uses the shorter duration', () => {
  const h = harness({ motion: 'subtle' });
  const card = new h.Node('BV1', { left: 0, top: 0 });
  const frame = h.controller.measure(h.container([card]));
  card.rect = { left: 0, top: 300 };
  h.controller.play(frame);
  assert.equal(h.created[0].timing.duration, Motion.LIMITS.durationSubtle);
});

test('play ignores sub-pixel settling and full-height jumps', () => {
  const h = harness();
  const still = new h.Node('BV1', { left: 0, top: 0 });
  const frame = h.controller.measure(h.container([still]));
  still.rect = { left: 0.2, top: 0.2 };
  assert.equal(h.controller.play(frame), 0);

  const jump = new h.Node('BV2', { left: 0, top: 0 });
  const second = h.controller.measure(h.container([jump]));
  jump.rect = { left: 0, top: 4000 };
  assert.equal(h.controller.play(second), 0);
});

test('a cancelled frame can no longer be played and running work is released', () => {
  const h = harness();
  const card = new h.Node('BV1', { left: 0, top: 0 });
  const frame = h.controller.measure(h.container([card]));
  card.rect = { left: 0, top: 200 };
  h.controller.play(frame);
  assert.equal(h.controller.isActive(), true);
  h.controller.cancel();
  assert.equal(h.created[0].cancelled, true);
  assert.equal(h.controller.isActive(), false);
  assert.equal(h.controller.play(frame), 0);
});

test('appended cards fade in once, are capped, and never replay existing ones', () => {
  const h = harness();
  const existing = new h.Node('BVold', { left: 0, top: 600 });
  const added = Array.from({ length: 12 }, (_, index) => new h.Node(`BVnew${index}`, { left: 0, top: 700 }));
  const before = new Set([existing]);
  const count = h.controller.enterNew(h.container([existing, ...added]), before);
  assert.equal(count, Motion.LIMITS.maxNewCards);
  assert.equal(h.created.length, Motion.LIMITS.maxNewCards);
  assert.equal(h.created[0].keyframes[0].opacity, 0);
  assert.match(h.created[0].keyframes[0].transform, /translateY/);
});

test('cards without the Web Animations API degrade to an instant update', () => {
  const h = harness();
  const card = new h.Node('BV1', { left: 0, top: 0 });
  card.animate = undefined;
  const frame = h.controller.measure(h.container([card]));
  card.rect = { left: 0, top: 240 };
  assert.equal(h.controller.play(frame), 0);
  assert.equal(h.controller.isActive(), false);
});

test('the shell brackets a same-route reconcile with one measured motion frame', () => {
  const calls = [];
  const motion = {
    allowed: () => true,
    measure: () => { calls.push('measure'); return { version: 1, cards: [], nodes: new Set() }; },
    play: () => { calls.push('play'); return 0; },
    prepare: () => calls.push('prepare'),
    enterNew: () => calls.push('enterNew'),
    snapshotCards: () => new Set(),
    cancel: () => calls.push('cancel'),
  };
  class Element {
    constructor(tag = 'div', cls = '') {
      this.tagName = tag; this.className = cls; this.children = []; this.dataset = {}; this.attributes = {};
      this.classList = {
        contains: name => this.className.split(' ').includes(name),
        add: name => { if (!this.classList.contains(name)) this.className = `${this.className} ${name}`.trim(); },
        remove: name => { this.className = this.className.split(' ').filter(item => item !== name).join(' '); },
        toggle: (name, on) => (on ? this.classList.add(name) : this.classList.remove(name)),
      };
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    append(...nodes) { nodes.forEach(node => this.children.push(node)); }
    replaceChildren(...nodes) { this.children = nodes; }
    querySelector(selector) { return selector === '[data-role="sidebar"]' ? null : null; }
    querySelectorAll() { return []; }
  }
  const UI = {
    e: (tag, cls) => new Element(tag, cls),
    createTopbar: () => new Element('header'),
    createSidebar: () => new Element('aside'),
    renderHome: () => {},
    updateFeedStatus: () => {},
    appendFeed: () => false,
  };
  const Reconcile = {
    createReuse: () => null,
    update: (target, fresh, callbacks, hooks) => {
      calls.push('update');
      hooks.beforeApply();
      hooks.afterApply();
    },
  };
  const doc = {
    body: new Element('body'),
    documentElement: new Element('html'),
    defaultView: { requestAnimationFrame: () => 1, matchMedia: () => ({ matches: false }) },
  };
  const previousUI = globalThis.BiliTubeUI;
  const previousReconcile = globalThis.BiliTubeReconcile;
  globalThis.BiliTubeUI = UI; globalThis.BiliTubeReconcile = Reconcile;
  let ShellBound;
  try {
    delete require.cache[require.resolve('../src/core/shell.js')];
    ShellBound = require('../src/core/shell.js');
  } finally {
    if (previousUI === undefined) delete globalThis.BiliTubeUI; else globalThis.BiliTubeUI = previousUI;
    if (previousReconcile === undefined) delete globalThis.BiliTubeReconcile; else globalThis.BiliTubeReconcile = previousReconcile;
  }
  const shell = ShellBound.createController(doc, { motion });
  shell.render('home', { renderKey: 'k', mid: '1' });
  calls.length = 0;
  shell.render('home', { renderKey: 'k', mid: '1' });
  assert.deepEqual(calls, ['measure', 'update', 'prepare', 'play']);
});
test('motion.js is injected before shell.js and both share the same contract', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const scripts = manifest.content_scripts.find(entry => (entry.js || []).includes('src/core/shell.js')).js;
  assert.ok(scripts.includes('src/core/motion.js'));
  assert.ok(scripts.indexOf('src/core/motion.js') < scripts.indexOf('src/core/shell.js'));

  const shell = read('src/core/shell.js');
  assert.match(shell, /options\.motion/);
  assert.match(shell, /motion\.measure\(outlet\)/);
  assert.match(shell, /afterApply:\s*\(\)\s*=>\s*motion\.play\(frame\)/);
  assert.match(shell, /motion\.enterNew\(outlet,before\)/);
  assert.match(shell, /is-route-entering/);
  assert.match(read('src/core/reconcile.js'), /hooks\.afterApply/);
  assert.match(read('src/styles/core.css'), /\.is-route-entering>:/);
});

test('theme reveal never overlaps a local flip', () => {
  const app = read('src/core/app.js');
  assert.match(app, /motion\.cancel\(\);\s*\n\s*Promise\.resolve\(themeReveal\.run/);
  assert.match(app, /previewActive:\(\)\s*=>\s*Boolean\(preview&&preview\.isActive/);
  const preview = read('src/core/preview.js');
  assert.match(preview, /function isActive\(\)/);
  assert.match(preview, /isActive, seekTime/);
});
