const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = name => fs.readFileSync(require.resolve(`../src/core/${name}.js`), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

// Only the DOM operations used by the UI under test. Browser acceptance also
// checks focus, native navigation and real IntersectionObserver ownership.
class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.listeners = new Map();
    this.className = '';
    this.isConnected = true;
    this.classList = {
      contains: name => this.className.split(' ').includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(' '), ...names])].join(' '); },
      remove: (...names) => { this.className = this.className.split(' ').filter(name => !names.includes(name)).join(' '); },
      toggle: (name, value) => value ? this.classList.add(name) : this.classList.remove(name),
    };
  }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes) { for (const child of this.children) child.isConnected = false; this.children = []; this.append(...nodes); }
  replaceWith(node) { const index = this.parent.children.indexOf(this); this.parent.children[index] = node; node.parent = this.parent; this.isConnected = false; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); }
  removeEventListener(name, fn) { this.listeners.set(name, (this.listeners.get(name) || []).filter(listener => listener !== fn)); }
  querySelector(selector) {
    const matches = node => selector.startsWith('.') ? node.classList.contains(selector.slice(1)) : selector === '[data-role="header"]' ? node.dataset.role === 'header' : selector === '[data-role="sidebar"]' ? node.dataset.role === 'sidebar' : false;
    for (const child of this.children) { if (matches(child)) return child; const found = child.querySelector(selector); if (found) return found; }
    return null;
  }
}

function uiHarness() {
  const document = { createElement: tag => new Element(tag), createElementNS: (_ns, tag) => new Element(tag) };
  const context = vm.createContext({document, setTimeout, clearTimeout});
  vm.runInContext(source('ui'), context);
  return {ui:context.BiliTubeUI, document, context};
}

test('account and style updates preserve the search node and unsubmitted draft', () => {
  const {ui} = uiHarness();
  const header = ui.createTopbar({query:'original'});
  const input = header.querySelector('.bt-search-input');
  input.value = 'unfinished draft';
  ui.updateTopbar(header, {query:'original',user:{mid:'123',name:'Updated user'},settings:{glassMode:false}});
  assert.equal(header.querySelector('.bt-search-input'), input);
  assert.equal(input.value, 'unfinished draft');
  assert.equal(header.querySelector('.bt-account').href, 'https://space.bilibili.com/123');
  assert.equal(header.querySelector('.bt-account').title, 'Updated user');
  assert.equal(header.querySelector('.bt-style-button').attributes['aria-pressed'], 'false');
  ui.updateTopbar(header, {query:'new route query'});
  assert.equal(input.value, 'new route query');
  assert.equal(header.querySelector('.bt-account').href, 'https://passport.bilibili.com/login');
});

test('a late suggestion response cannot reappear after a query route change', async () => {
  const {ui, context} = uiHarness();
  let scheduled;
  context.setTimeout = callback => { scheduled = callback; return 1; };
  context.clearTimeout = () => {};
  let reply;
  const header = ui.createTopbar({query:'old'}, {requestSearchSuggestions:() => new Promise(resolve => { reply = resolve; })});
  const input = header.querySelector('.bt-search-input');
  input.listeners.get('input')[0]();
  const request = scheduled();
  ui.updateTopbar(header, {query:'new'});
  reply(['old suggestion']);
  await request;
  assert.equal(input.value, 'new');
  assert.equal(header.querySelector('.bt-search-suggestions').hidden, true);
});

test('favorite folders are real links without click interception, even with a legacy callback', () => {
  const {ui} = uiHarness();
  const outlet = new Element('main');
  ui.renderFavorites(outlet, {mid:'123',folders:[{id:'202',title:'B',count:0}],videos:[],hasMore:false}, {openFavorite:() => assert.fail('must use native navigation')});
  const link = outlet.querySelector('.bt-favorite-folder');
  assert.equal(link.href, 'https://space.bilibili.com/123/favlist?fid=202&ftype=create');
  assert.equal(link.listeners.has('click'), false);
});

function appHarness(url) {
  const pending = [];
  const renders = [];
  const events = new Map();
  const timers = new Map();
  let timerId = 0;
  const root = {querySelector:() => null};
  const noOp = () => {};
  const shell = {ensure:() => root,getRoot:() => root,render:(route,data) => renders.push({route,...data}),updateChrome:noOp,updateTheme:noOp,setCollapsed:noOp,destroy:noOp};
  const context = vm.createContext({
    URLSearchParams, AbortController, console, queueMicrotask,
    location:new URL(url),
    document:{body:{},documentElement:{dataset:{},classList:{add:noOp,remove:noOp,toggle:noOp},removeAttribute:noOp},querySelectorAll:() => []},
    matchMedia:() => ({matches:false,addEventListener:noOp}),
    setTimeout(fn, delay) { timers.set(++timerId,{fn,delay}); return timerId; },
    clearTimeout:id => timers.delete(id),
    addEventListener:(name, fn) => events.set(name,fn), postMessage:noOp,
    chrome:{storage:{local:{get:(_keys,fn) => fn({})},onChanged:{addListener:noOp}},runtime:{}},
    BiliTubePolicy:require('../src/core/policy'), BiliTubeTheme:require('../src/core/theme'), BiliTubeData:require('../src/core/data'),
    BiliTubeApiClient:{request:(type,params) => new Promise(resolve => pending.push({type,params,resolve}))},
    BiliTubeNativeVisibility:{createGuard:() => ({hide:noOp,restore:noOp})},
    BiliTubeNativeAdapter:{createAdapter:() => ({restore:noOp,updateTheme:noOp})},
    BiliTubeWatch:{createDecorator:() => ({destroy:noOp,updateTheme:noOp})},
    BiliTubeExtract:{extractCurrentUser:() => null,extractSearchCards:() => []},
    BiliTubePreview:{createController:() => ({destroy:noOp})},
    BiliTubeShell:{createController:() => shell}, BiliTubeActions:{},
  });
  context.window = context;
  vm.runInContext(source('app'),context);
  return {
    renders,
    latest:() => renders.at(-1),
    async navigate(url) {
      context.location = new URL(url);
      context.dispatchMessage = events.get('message');
      vm.runInContext("dispatchMessage({source:window,data:{source:'bilitube-bridge-core',type:'navigation',payload:{}}})",context);
      await settle();
    },
    async reply(type, params, payload) {
      const index = pending.findIndex(item => item.type === type && Object.entries(params).every(([key,value]) => item.params[key] === value));
      assert.notEqual(index,-1, `missing ${type} request ${JSON.stringify(params)}`);
      pending.splice(index,1)[0].resolve(payload);
      await settle();
      for (const [id,timer] of [...timers]) if (timer.delay === 60) { timers.delete(id); timer.fn(); }
      await settle();
    },
  };
}

const search = title => ({code:0,data:{numPages:1,result:[{bvid:'BVtest',title}]}});
const favorite = (id,title) => ({mediaId:id,page:1,hasMore:false,folders:{code:0,data:{list:[{id,title}]}},resources:{code:0,data:{medias:[{bvid:'BVtest',title}]}}});

test('an old search response neither replaces the new result nor clears its loading state', async () => {
  const h = appHarness('https://search.bilibili.com/video?keyword=old');
  await h.navigate('https://search.bilibili.com/video?keyword=new');
  const renderCount = h.renders.length;
  await h.reply('search',{keyword:'old'}, search('OLD'));
  assert.equal(h.renders.length,renderCount);
  await h.reply('search',{keyword:'new'}, search('NEW'));
  assert.equal(h.latest().query,'new');
  assert.equal(h.latest().results[0].title,'NEW');
});

test('a late favorite response cannot replace the current folder', async () => {
  const h = appHarness('https://space.bilibili.com/123/favlist?fid=101');
  await h.navigate('https://space.bilibili.com/123/favlist?fid=202');
  await h.reply('favorites',{mediaId:'202'},favorite('202','B'));
  await h.reply('favorites',{mediaId:'101'},favorite('101','A'));
  assert.equal(h.latest().selectedId,'202');
  assert.equal(h.latest().videos[0].title,'B');
});

test('favorite route changes without fid select the new owner default folder', async () => {
  const h = appHarness('https://space.bilibili.com/123/favlist?fid=101');
  await h.reply('favorites',{mediaId:'101'},favorite('101','A'));
  await h.navigate('https://space.bilibili.com/456/favlist');
  assert.equal(h.latest().selectedId,'');
  assert.equal(h.latest().videos.length,0);
  await h.reply('favorites',{mid:'456',mediaId:''},favorite('303','New owner default'));
  assert.equal(h.latest().selectedId,'303');
  assert.equal(h.latest().videos[0].title,'New owner default');
});

test('every shell render releases previous preview bindings before removing cards', () => {
  const {document,context} = uiHarness();
  document.body = new Element('body');
  document.defaultView = {matchMedia:() => ({matches:true})};
  const observed = new Set();
  context.IntersectionObserver = class {
    observe(node) { observed.add(node); }
    unobserve(node) { observed.delete(node); }
    disconnect() { observed.clear(); }
  };
  vm.runInContext(source('preview'),context);
  const preview = context.BiliTubePreview.createController();
  context.BiliTubeUI = {
    e:document.createElement,
    createTopbar:() => new Element('header'),createSidebar:() => new Element('aside'),
    renderHome(outlet) { const card = new Element('article'); outlet.append(card); preview.bind(card,{bvid:'BVtest'},card); },
  };
  vm.runInContext(source('shell'),context);
  const shell = context.BiliTubeShell.createController(document);
  shell.ensure({}, {beforeRender:() => {
    assert.ok([...observed].every(node => node.isConnected));
    preview.destroy();
  }});
  for (let index=0;index<5;index++) {
    shell.render('home');
    assert.equal(observed.size,1);
    assert.ok([...observed].every(node => node.isConnected));
  }
  preview.destroy();
});

test('a settled thumbnail stays sharp when a later page rerenders the feed', () => {
  const {ui} = uiHarness();
  const item = {bvid:'BVimage',href:'https://www.bilibili.com/video/BVimage',thumbnail:'https://i.example.test/thumbnail.webp'};
  const first = ui.createCard(item);
  const firstImage = first.querySelector('.bt-thumb-image');
  firstImage.listeners.get('load')[0]();
  const second = ui.createCard(item);
  const secondImage = second.querySelector('.bt-thumb-image');
  const secondBox = second.querySelector('.bt-thumb');
  assert.ok(secondImage.classList.contains('is-loaded'));
  assert.equal(secondImage.classList.contains('is-preview'), false);
  assert.equal(secondBox.classList.contains('is-image-loading'), false);
  assert.ok(secondBox.classList.contains('is-image-loaded'));
});
