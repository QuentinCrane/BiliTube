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

test('theme changes commit immediately when animation is disabled or unavailable', () => {
  let committed=0;
  const doc={documentElement:{classList:{remove(){}},animate:()=>assert.fail('no animation expected')},startViewTransition:()=>assert.fail('no snapshot expected')};
  Theme.createRevealController(doc).run(()=>committed++,null,false);
  delete doc.startViewTransition;
  Theme.createRevealController(doc).run(()=>committed++,null,true);
  assert.equal(committed,2);
});

test('a newer theme request prevents an older snapshot commit and cleanup', async () => {
  const classes=new Set(),transitions=[],animations=[];
  const html={classList:{add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name))},animate:(frames,options)=>animations.push({frames,options})};
  const doc={documentElement:html,defaultView:{innerWidth:1000,innerHeight:600},startViewTransition(commit){
    let ready,finish;const t={commit,ready:new Promise(resolve=>{ready=resolve}),finished:new Promise(resolve=>{finish=resolve}),skipTransition:()=>{},readyNow:()=>{commit();ready();},finishNow:()=>finish()};transitions.push(t);return t;
  }};
  const reveal=Theme.createRevealController(doc);let theme='light';
  reveal.run(()=>{theme='old'},null);const last=reveal.run(()=>{theme='dark'},null);
  transitions[0].readyNow();transitions[0].finishNow();await Promise.resolve();await Promise.resolve();
  assert.equal(theme,'light');assert.equal(classes.has('bt-theme-reveal'),true);
  transitions[1].readyNow();await Promise.resolve();assert.equal(theme,'dark');assert.equal(animations.length,1);
  assert.deepEqual(animations[0].frames,{opacity:[1,0]});
  assert.equal(animations[0].options.pseudoElement,'::view-transition-old(root)');
  assert.ok(animations[0].options.duration<=200);
  transitions[1].finishNow();await last;await Promise.resolve();await Promise.resolve();assert.equal(classes.has('bt-theme-reveal'),false);
});

test('theme capture suspends only running decorators and restores them on cancellation',()=>{
  let played=0,paused=0,finish;
  const decorator={playState:'running',effect:{target:{}},pause(){paused++;this.playState='paused'},play(){played++;this.playState='running'}};
  const alreadyPaused={playState:'paused',effect:{target:{}},pause:()=>assert.fail('must retain pre-existing pause'),play:()=>assert.fail('must not resume unrelated paused animation')};
  const html={classList:{add(){},remove(){}},animate(){}};
  const doc={documentElement:html,defaultView:{innerWidth:1000,innerHeight:600},getAnimations:()=>[decorator,alreadyPaused],startViewTransition:()=>({ready:new Promise(()=>{}),finished:new Promise(resolve=>{finish=resolve}),skipTransition:()=>finish()})};
  const reveal=Theme.createRevealController(doc);reveal.run(()=>{},null);
  assert.equal(paused,1);assert.equal(played,0);reveal.cancel();assert.equal(played,1);assert.equal(decorator.playState,'running');
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

test('cache bounds entries, keeps recent reads and evicts expired values on insertion', () => {
  let now=100;
  const cache=Cache.createCache(()=>now,2);
  cache.set('a',1);cache.set('b',2);cache.get('a');cache.set('c',3);
  assert.equal(cache.get('b'),undefined);
  assert.equal(cache.get('a'),1);
  cache.set('short',4,10);now=110;cache.set('fresh',5);
  assert.equal(cache.get('short'),undefined);
  assert.equal(cache.get('fresh'),5);
});

test('clearing cache prevents a pending read from repopulating or deleting a newer request', async () => {
  const cache=Cache.createCache();let oldReply,newReply;
  const old=cache.remember('key',1000,()=>new Promise(resolve=>{oldReply=resolve;}));
  await Promise.resolve();cache.clear();
  const fresh=cache.remember('key',1000,()=>new Promise(resolve=>{newReply=resolve;}));
  await Promise.resolve();oldReply('old');await old;
  assert.equal(cache.get('key'),undefined);
  let unexpected=false;
  const shared=cache.remember('key',1000,()=>{unexpected=true;return 'wrong';});
  newReply('new');assert.equal(await fresh,'new');assert.equal(await shared,'new');
  assert.equal(unexpected,false);assert.equal(cache.get('key'),'new');
});

test('dynamic detail, unsupported search filters and native collection types retain native business UI', () => {
  const routes=[
    ['https://t.bilibili.com/123456789','dynamic-detail'],
    ['https://t.bilibili.com/vote/123','dynamic-native'],
    ['https://search.bilibili.com/video?keyword=demo&tids=3','search-native'],
    ['https://search.bilibili.com/upuser?keyword=demo&order=fans','search-native'],
    ['https://search.bilibili.com/all?keyword=demo&duration=1','search-native'],
    ['https://space.bilibili.com/123/favlist?fid=42&ftype=collect','space-favlist'],
    ['https://www.bilibili.com/list/watchlater?bvid=BVdemo','playlist-watch'],
  ];
  for(const [url,route] of routes){const context=Policy.resolve(loc(url));assert.equal(context.route,route,url);assert.equal(context.strategy,'adapt',url);}
  assert.equal(Policy.resolve(loc('https://search.bilibili.com/video?keyword=demo&order=click&duration=2')).strategy,'replace');
});

test('tracking parameters do not change navigation identity but content filters do', () => {
  const base=new URL('https://search.bilibili.com/video?keyword=demo&order=click');
  const tracking=new URL('https://search.bilibili.com/video?order=click&keyword=demo&spm_id_from=333&vd_source=fixture');
  assert.equal(Policy.navigationIdentity(base),Policy.navigationIdentity(tracking));
  tracking.searchParams.set('duration','2');assert.notEqual(Policy.navigationIdentity(base),Policy.navigationIdentity(tracking));
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
