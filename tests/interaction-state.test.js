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
  const context = vm.createContext({document, URL, setTimeout, clearTimeout});
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

function appHarness(url,fallback=[]) {
  const pending = [];
  const renders = [];
  const events = new Map();
  const timers = new Map();
  const watchCalls = {mount:0,updateContext:0,updateChrome:0,destroy:0};
  let timerId = 0;
  let callbacks;
  const root = {querySelector:() => null};
  const noOp = () => {};
  const shell = {ensure:(_data,handlers) => {callbacks=handlers;return root;},getRoot:() => root,render:(route,data) => renders.push({route,...data}),setLoading:noOp,updateChrome:noOp,updateTheme:noOp,setCollapsed:noOp,destroy:noOp};
  const context = vm.createContext({
    URLSearchParams, AbortController, console, queueMicrotask,
    location:new URL(url),
    document:{body:{},documentElement:{dataset:{},classList:{add:noOp,remove:noOp,toggle:noOp},removeAttribute:noOp},querySelectorAll:() => []},
    matchMedia:() => ({matches:false,addEventListener:noOp}),
    setTimeout(fn, delay) { timers.set(++timerId,{fn,delay}); return timerId; },
    clearTimeout:id => timers.delete(id),
    addEventListener:(name, fn) => events.set(name,fn), postMessage:noOp,
    chrome:{storage:{local:{get:(_keys,fn) => fn({})},onChanged:{addListener:fn=>events.set('storage',fn)}},runtime:{}},
    BiliTubePolicy:require('../src/core/policy'), BiliTubeTheme:require('../src/core/theme'), BiliTubeData:require('../src/core/data'),
    BiliTubeApiClient:{request:(type,params={}) => new Promise(resolve => pending.push({type,params,resolve}))},
    BiliTubeNativeVisibility:{createGuard:() => ({hide:noOp,restore:noOp})},
    BiliTubeNativeAdapter:{createAdapter:() => ({restore:noOp,updateTheme:noOp})},
    BiliTubeWatch:{createDecorator:() => ({mount:() => {watchCalls.mount++;},updateContext:() => {watchCalls.updateContext++;},updateChrome:() => {watchCalls.updateChrome++;},destroy:() => {watchCalls.destroy++;},updateTheme:noOp})},
    BiliTubeExtract:{extractCurrentUser:() => null,extractSearchCards:() => fallback,extractWatch:() => ({})},
    BiliTubePreview:{createController:() => ({destroy:noOp})},
    BiliTubeShell:{createController:() => shell}, BiliTubeActions:{},
  });
  context.window = context;
  vm.runInContext(source('app'),context);
  return {
    renders,pending,watchCalls,
    act(name,...args){return callbacks[name](...args);},
    latest:() => renders.at(-1),
    async changeSettings(patch){events.get('storage')({bilitubeCoreSettings:{newValue:patch}},'local');await settle();},
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

test('video-to-video SPA navigation keeps the Watch decorator mounted', async () => {
  const h=appHarness('https://www.bilibili.com/video/BVfirst/');
  assert.equal(h.watchCalls.mount,1);
  await h.navigate('https://www.bilibili.com/video/BVsecond/');
  assert.equal(h.watchCalls.mount,1);
  assert.equal(h.watchCalls.destroy,0);
  assert.equal(h.watchCalls.updateContext,1);
  assert.equal(h.watchCalls.updateChrome,1);
});

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

test('native feature links retain current query and hash without click interception', () => {
  const {ui}=uiHarness();const outlet=new Element('main');
  ui.renderPageTools(outlet,{href:'https://space.bilibili.com/123/favlist?fid=42#tab',route:'favorites'});
  const link=outlet.querySelector('.bt-text-button');const url=new URL(link.href);
  assert.equal(url.searchParams.get('fid'),'42');assert.equal(url.searchParams.get('bilitube_native'),'1');assert.equal(url.hash,'#tab');
  assert.equal(link.listeners.has('click'),false);
  const sorted=new URL(ui.searchHref('video','a & b',{order:'click',duration:2}));
  assert.equal(sorted.searchParams.get('keyword'),'a & b');assert.equal(sorted.searchParams.get('order'),'click');assert.equal(sorted.searchParams.get('duration'),'2');
});

test('changing search filters resets same-keyword results and rejects the old variant', async () => {
  const h=appHarness('https://search.bilibili.com/video?keyword=demo&order=click&duration=1');
  await h.navigate('https://search.bilibili.com/video?keyword=demo&order=pubdate&duration=4');
  const renderCount=h.renders.length;
  await h.reply('search',{order:'click',duration:1},search('OLD'));
  assert.equal(h.renders.length,renderCount);
  await h.reply('search',{order:'pubdate',duration:4},search('NEW'));
  assert.equal(h.latest().filters.order,'pubdate');assert.equal(h.latest().filters.duration,4);assert.equal(h.latest().results[0].title,'NEW');
});

test('watch-later load errors are distinguishable from an empty successful list', async () => {
  const h=appHarness('https://www.bilibili.com/list/watchlater');
  await h.reply('watchlater',{}, {code:-101});
  assert.match(h.latest().error,/登录/);assert.equal(h.latest().videos.length,0);
  await h.navigate('https://www.bilibili.com/list/watchlater?reload=1');
  await h.reply('watchlater',{}, {code:0,data:{list:[]}});
  assert.equal(h.latest().error,'');assert.equal(h.latest().videos.length,0);
});

test('dynamic detail preflight never hides native discussion before adaptation', () => {
  for(const pathname of ['/', '/123456789', '/vote/123']){
    const classes=new Set();
    vm.runInNewContext(fs.readFileSync(require.resolve('../src/page/preflight.js'),'utf8'),{
      location:{hostname:'t.bilibili.com',pathname,search:''},URLSearchParams,
      document:{documentElement:{classList:{add:name=>classes.add(name)}}},
    });
    assert.equal(classes.has('bilitube-core-preflight'),pathname==='/');
  }
});

test('user-search pagination also switches to an actionable manual button at the item budget', () => {
  const {ui}=uiHarness();const sentinel=new Element('div');sentinel.dataset.btFeed='search';let selected='';
  ui.updateFeedStatus({querySelector:()=>sentinel},{category:'user',users:Array(300).fill({}),results:[],hasMore:true},{loadMore:feed=>{selected=feed;}});
  assert.equal(sentinel.dataset.btManual,'true');
  assert.equal(sentinel.children[0].tagName,'button');sentinel.children[0].listeners.get('click')[0]();
  assert.equal(selected,'search');
});

test('theme and sidebar-only storage changes do not rebuild the feed', async () => {
  const h=appHarness('https://search.bilibili.com/video?keyword=demo');await h.reply('search',{},search('Stable'));
  const count=h.renders.length;
  await h.changeSettings({theme:'dark'});assert.equal(h.renders.length,count);
  await h.changeSettings({theme:'dark',sidebarCollapsed:true});assert.equal(h.renders.length,count);
  await h.changeSettings({theme:'dark',sidebarCollapsed:true,showCardMeta:false});assert.equal(h.renders.length,count+1);
});

test('DOM and API versions of the same thumbnail share media identity across CDN resizing', () => {
  const {ui}=uiHarness();
  const first=ui.createCard({bvid:'BVsame',href:'https://www.bilibili.com/video/BVsame?from=search',thumbnail:'https://i0.hdslb.com/bfs/archive/cover.jpg@320w_180h.webp'});
  const second=ui.createCard({bvid:'BVsame',href:'https://www.bilibili.com/video/BVsame',thumbnail:'https://i1.hdslb.com/bfs/archive/cover.jpg'});
  assert.equal(first.querySelector('.bt-card-media').__btMediaKey,second.querySelector('.bt-card-media').__btMediaKey);
});

test('initial loading does not show native cards and then replace them with API cards', async () => {
  const fallback=[{bvid:'BVnative',title:'Native draft'}];
  const h=appHarness('https://search.bilibili.com/video?keyword=demo',fallback);
  assert.equal(h.latest().results.length,0);assert.equal(h.latest().loading,true);
  await h.reply('search',{},search('API result'));
  assert.equal(h.latest().results[0].title,'API result');
  assert.ok(h.renders.every(render=>!render.results?.some(item=>item.title==='Native draft')));
  await h.navigate('https://search.bilibili.com/video?keyword=failed');
  await h.reply('search',{keyword:'failed'},{code:-1});assert.equal(h.latest().results[0].title,'Native draft');
});

test('the search experiment parameter does not discard pending content or remount the feed', async () => {
  const h=appHarness('https://search.bilibili.com/video?keyword=demo');const count=h.renders.length;
  await h.navigate('https://search.bilibili.com/video?vt=50535213&keyword=demo');assert.equal(h.renders.length,count);
  await h.reply('search',{},search('Stable result'));assert.equal(h.latest().results[0].title,'Stable result');
});

test('refresh preserves results, rejects an older page and restarts pagination at page one', async () => {
  const h=appHarness('https://search.bilibili.com/video?keyword=demo');
  await h.reply('search',{}, {code:0,data:{numPages:4,result:[{bvid:'BVfirst',title:'First'}]}});
  h.act('loadMore','search');
  h.act('refreshCurrent');h.act('refreshCurrent');
  assert.equal(h.pending.filter(item=>item.type==='search'&&item.params.forceFresh).length,1);
  assert.equal(h.latest().refreshing,true);assert.equal(h.latest().results[0].title,'First');
  await h.reply('search',{page:2},{code:0,data:{numPages:4,result:[{bvid:'BVold',title:'Old page'}]}});
  assert.equal(h.latest().refreshing,true);assert.equal(h.latest().results.length,1);
  await h.reply('search',{page:1,forceFresh:true},{code:0,data:{numPages:4,result:[{bvid:'BVnew',title:'New'}]}});
  assert.equal(h.latest().refreshStatus,'updated');assert.equal(h.latest().refreshing,false);
  assert.equal(h.latest().results[0].title,'New');
  h.act('loadMore','search');assert.ok(h.pending.some(item=>item.type==='search'&&item.params.page===2));
});

test('failed pagination retains content and retries the exact page without an observer retry loop', async () => {
  const h=appHarness('https://search.bilibili.com/video?keyword=demo');
  await h.reply('search',{}, {code:0,data:{numPages:4,result:[{bvid:'BVfirst',title:'First'}]}});
  h.act('loadMore','search');await h.reply('search',{page:2},null);
  assert.equal(h.latest().results[0].title,'First');assert.ok(h.latest().error);assert.equal(h.latest().hasMore,true);
  h.act('loadMore','search');assert.equal(h.pending.filter(item=>item.type==='search').length,0);
  h.act('retryFeed','search');h.act('retryFeed','search');
  assert.equal(h.pending.filter(item=>item.type==='search').length,1);
  await h.reply('search',{page:2,forceFresh:true},{code:0,data:{numPages:4,result:[{bvid:'BVsecond',title:'Second'}]}});
  assert.equal(h.latest().results.length,2);assert.equal(h.latest().error,'');
});

test('a failed Watch Later refresh keeps the last successful list visible', async () => {
  const h=appHarness('https://www.bilibili.com/list/watchlater');
  await h.reply('watchlater',{}, {code:0,data:{list:[{bvid:'BVkeep',title:'Keep'}]}});
  h.act('refreshCurrent');await h.reply('watchlater',{forceFresh:true},null);
  assert.equal(h.latest().videos[0].title,'Keep');assert.equal(h.latest().refreshStatus,'failed');
  h.act('refreshCurrent');await h.reply('watchlater',{forceFresh:true},{code:0,data:{list:[]}});
  assert.equal(h.latest().videos.length,0);assert.equal(h.latest().refreshStatus,'updated');
});

test('a late background Watch Later preload cannot overwrite a newer page read',async()=>{
  const h=appHarness('https://www.bilibili.com/');
  await h.reply('account',{}, {code:0,data:{mid:123,uname:'User',isLogin:true}});
  await h.navigate('https://www.bilibili.com/list/watchlater');
  await h.reply('watchlater',{nativeFirst:true},{code:0,data:{list:[{bvid:'BVnew',title:'New list'}]}});
  await h.reply('watchlater',{}, {code:0,data:{list:[{bvid:'BVold',title:'Old preload'}]}});
  h.act('refreshCurrent');assert.equal(h.latest().videos[0].title,'New list');
});

test('fresh search results reset a previously advanced page counter', async () => {
  const h=appHarness('https://search.bilibili.com/video?keyword=demo');
  await h.reply('search',{}, {code:0,data:{numPages:5,result:[{bvid:'BV1',title:'1'}]}});
  for(const page of [2,3]){h.act('loadMore','search');await h.reply('search',{page},{code:0,data:{numPages:5,result:[{bvid:`BV${page}`,title:String(page)}]}});}
  h.act('refreshCurrent');await h.reply('search',{forceFresh:true},{code:0,data:{numPages:5,result:[{bvid:'BVnew',title:'New'}]}});
  h.act('loadMore','search');assert.ok(h.pending.some(item=>item.type==='search'&&item.params.page===2));
});

test('dynamic starts with loading feedback and home category requests do not paginate unrelated recommendations', async () => {
  const dynamic=appHarness('https://t.bilibili.com/');assert.equal(dynamic.latest().loading,true);
  const home=appHarness('https://www.bilibili.com/?bilitube_category=tech');
  assert.equal(home.latest().loading,true);assert.equal(home.latest().hasMore,false);
  const count=home.pending.length;home.act('loadMore','home');assert.equal(home.pending.length,count);
  const live=appHarness('https://www.bilibili.com/?bilitube_category=live');
  await live.reply('home',{}, {code:0,data:{item:[]}});assert.equal(live.latest().loading,true);
  await live.reply('home-sections',{}, {live:{code:0,data:{}}});assert.equal(live.latest().loading,false);
});

test('an account with no favorite folders renders a successful empty state', async () => {
  const h=appHarness('https://space.bilibili.com/123/favlist');
  await h.reply('favorites',{}, {folders:{code:0,data:{list:[]}},resources:null,mediaId:'',page:1,hasMore:false});
  assert.equal(h.latest().error,'');assert.equal(h.latest().hasMore,false);assert.equal(h.latest().videos.length,0);
});

test('failed feeds display a retry action instead of an end-of-list label', () => {
  const {ui}=uiHarness();const sentinel=new Element('div');sentinel.dataset.btFeed='search';let retried;
  ui.updateFeedStatus({querySelector:()=>sentinel},{error:'Offline',hasMore:false,loading:false},{retryFeed:feed=>{retried=feed;}});
  assert.equal(sentinel.dataset.btManual,'true');assert.equal(sentinel.children[0].textContent,'Offline');
  sentinel.children[1].listeners.get('click')[0]({});assert.equal(retried,'search');
});

for(const dismissal of ['Escape','blur','clear'])test(`late suggestions stay dismissed after ${dismissal}`,async()=>{
  const {ui,context}=uiHarness();let scheduled,reply;
  context.setTimeout=fn=>{scheduled=fn;return 1;};context.clearTimeout=()=>{};
  const header=ui.createTopbar({query:'demo'},{requestSearchSuggestions:()=>new Promise(resolve=>{reply=resolve;})});
  const input=header.querySelector('.bt-search-input');input.listeners.get('input')[0]();const pending=scheduled();
  if(dismissal==='Escape')input.listeners.get('keydown')[0]({key:'Escape'});
  else if(dismissal==='blur')input.listeners.get('blur')[0]();
  else {input.value='';input.listeners.get('input')[0]();input.value='demo';}
  reply(['demo suggestion']);await pending;assert.equal(header.querySelector('.bt-search-suggestions').hidden,true);
});

test('IME composition suppresses suggestions and does not select a result on confirmation',()=>{
  const {ui,context}=uiHarness();let scheduled=0;
  context.setTimeout=()=>{scheduled++;return scheduled;};context.clearTimeout=()=>{};
  const header=ui.createTopbar({query:'中文'},{requestSearchSuggestions:()=>[]});const input=header.querySelector('.bt-search-input');
  input.listeners.get('compositionstart')[0]();input.listeners.get('input')[0]();
  input.listeners.get('keydown')[0]({key:'Enter',isComposing:true,preventDefault:()=>assert.fail('IME confirmation must stay native')});
  assert.equal(scheduled,0);input.listeners.get('compositionend')[0]();assert.equal(scheduled,1);
});
