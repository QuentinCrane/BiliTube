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
  const values = new Map();
  const localStorage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: key => { values.delete(key); },
  };
  const context = vm.createContext({document, URL, setTimeout, clearTimeout, localStorage});
  vm.runInContext(source('ui'), context);
  return {ui:context.BiliTubeUI, document, context};
}

test('video cards retain full titles and independent creator and discussion links', () => {
  const {ui} = uiHarness();
  const item = {bvid:'BV1TEST',title:'很长的视频标题'.repeat(12),href:'https://www.bilibili.com/video/BV1TEST',author:'作者',authorHref:'https://space.bilibili.com/7',meta:'1万播放 · 1小时前',dynamicHref:'https://t.bilibili.com/123'};
  const card = ui.createCard(item);
  const title = card.querySelector('.bt-card-title');
  const byline = card.querySelector('.bt-card-byline');
  const discussion = card.querySelector('.bt-card-discussion');
  assert.equal(title.textContent,item.title);
  assert.equal(title.title,item.title);
  assert.equal(title.href,item.href);
  assert.equal(byline.querySelector('.bt-card-author').href,item.authorHref);
  assert.equal(byline.querySelector('.bt-card-meta').textContent,item.meta);
  assert.equal(discussion.href,item.dynamicHref);
  assert.equal(discussion.attributes['aria-label'],'查看动态与讨论');
  assert.equal(discussion.listeners.has('click'),false);
  const hidden = ui.createCard(item,{showCardAuthor:()=>false,showCardMeta:()=>false});
  assert.equal(hidden.querySelector('.bt-card-byline'),null);
  assert.equal(hidden.querySelector('.bt-card-discussion').href,item.dynamicHref);
});

test('home recommendation video links follow the new-tab preference without changing author links', () => {
  const {ui} = uiHarness();
  const make = enabled => {
    const outlet = new Element('main');
    ui.renderHome(outlet,{category:'all',videos:[{kind:'video',bvid:'BV1TEST',title:'推荐视频',href:'https://www.bilibili.com/video/BV1TEST',author:'作者',authorHref:'https://space.bilibili.com/7'}],shelves:[],hasMore:false},{openHomeRecommendationsInNewTab:()=>enabled});
    return outlet;
  };
  const enabled=make(true),disabled=make(false);
  assert.equal(enabled.querySelector('.bt-thumb-link').attributes.target,'_blank');
  assert.equal(enabled.querySelector('.bt-card-title').attributes.target,'_blank');
  assert.equal(enabled.querySelector('.bt-card-author').attributes.target,undefined);
  assert.equal(disabled.querySelector('.bt-card-title').attributes.target,undefined);
});

test('topbar search opens a new tab only on playback routes and updates without losing a draft', () => {
  const {ui}=uiHarness(),header=ui.createTopbar({route:'home'});
  const form=header.querySelector('.bt-search'),input=header.querySelector('.bt-search-input');
  input.value='unfinished draft';assert.equal(form.attributes.target,undefined);
  for(const route of ['watch','playlist-watch','bangumi-watch','course-watch']){
    ui.updateTopbar(header,{route});assert.equal(form.attributes.target,'_blank');assert.equal(form.attributes.rel,'noopener');
    assert.equal(input.value,'unfinished draft');
  }
  ui.updateTopbar(header,{route:'home'});
  assert.equal(form.attributes.target,undefined);assert.equal(form.attributes.rel,undefined);assert.equal(input.value,'unfinished draft');
});

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

test('empty search renders a useful landing instead of an API error', () => {
  const {ui}=uiHarness(),outlet=new Element('main');
  ui.renderSearch(outlet,{query:'',category:'all',results:[],users:[],loading:false,hasMore:false,error:''},{});
  assert.ok(outlet.querySelector('.bt-search-landing'));
  assert.ok(outlet.querySelector('.bt-search-quick'));
  assert.equal(outlet.querySelector('.bt-empty'),null);
});

function appHarness(url,fallback=[],initialSettings={},beforeBody=false) {
  const pending = [];
  const renders = [];
  const events = new Map();
  const timers = new Map();
  const watchCalls = {mount:0,updateContext:0,updateChrome:0,updateRecommendationPreference:0,destroy:0};
  let timerId = 0;
  let callbacks;
  const root = {querySelector:() => null};
  const noOp = () => {};
  const shell = {ensure:(_data,handlers) => {callbacks=handlers;return root;},getRoot:() => root,render:(route,data) => renders.push({route,...data}),setLoading:noOp,updateChrome:noOp,updateTheme:noOp,setCollapsed:noOp,destroy:noOp};
  const context = vm.createContext({
    URLSearchParams, AbortController, console, queueMicrotask,
    location:new URL(url),
    document:{body:beforeBody?null:{},documentElement:{dataset:{},classList:{add:noOp,remove:noOp,toggle:noOp},removeAttribute:noOp},querySelectorAll:() => []},
    matchMedia:() => ({matches:false,addEventListener:noOp}),
    setTimeout(fn, delay) { timers.set(++timerId,{fn,delay}); return timerId; },
    clearTimeout:id => timers.delete(id),
    addEventListener:(name, fn) => events.set(name,fn), removeEventListener:(name,fn)=>{if(events.get(name)===fn)events.delete(name);}, postMessage:noOp,
    chrome:{storage:{local:{get:(_keys,fn) => fn({bilitubeCoreSettings:initialSettings})},onChanged:{addListener:fn=>events.set('storage',fn)}},runtime:{}},
    BiliTubePolicy:require('../src/core/policy'), BiliTubeTheme:require('../src/core/theme'), BiliTubeData:require('../src/core/data'),
    BiliTubeApiClient:{request:(type,params={},options={}) => new Promise(resolve => {
      const entry={type,params,resolve,aborted:false};pending.push(entry);
      if(options.signal)options.signal.addEventListener('abort',()=>{entry.aborted=true;},{once:true});
    })},
    BiliTubeNativeVisibility:{createGuard:() => ({hide:noOp,restore:noOp})},
    BiliTubeNativeAdapter:{createAdapter:() => ({restore:noOp,updateTheme:noOp})},
    BiliTubeWatch:{createDecorator:() => ({mount:() => {watchCalls.mount++;},updateContext:() => {watchCalls.updateContext++;},updateChrome:() => {watchCalls.updateChrome++;},updateRecommendationPreference:() => {watchCalls.updateRecommendationPreference++;},destroy:() => {watchCalls.destroy++;},updateTheme:noOp})},
    BiliTubeExtract:{extractCurrentUser:() => null,extractSearchCards:() => fallback,extractWatch:() => ({})},
    BiliTubePreview:{createController:() => ({destroy:noOp})},
    BiliTubeMotion:{createController:() => ({allowed:() => false,cancel:noOp,prepare:noOp,measure:() => null,play:() => 0,enterNew:() => 0,snapshotCards:() => new Set()})},
    BiliTubeShell:{createController:() => shell},
  });
  context.window = context;
  vm.runInContext(source('app'),context);
  return {
    renders,pending,watchCalls,
    act(name,...args){return callbacks[name](...args);},
    latest:() => renders.at(-1),
    async changeSettings(patch){events.get('storage')({bilitubeCoreSettings:{newValue:patch}},'local');await settle();},
    async finishDocument(){
      context.document.body={};events.get('DOMContentLoaded')();await settle();
      for(const [id,timer] of [...timers])if(timer.delay===60){timers.delete(id);timer.fn();}
      await settle();
    },
    changeUrlWithoutNotification(url){context.location=new URL(url);},
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

test('a first feed read can finish before DOMContentLoaded and is reused by the mounted page',async()=>{
  const h=appHarness('https://www.bilibili.com/',[],{},true);
  assert.equal(h.renders.length,0);
  assert.equal(h.pending.filter(item=>item.type==='home').length,1);
  await h.reply('home',{}, {code:0,data:{item:[{bvid:'BVearly',title:'Early result'}]}});
  await h.finishDocument();
  assert.equal(h.pending.filter(item=>item.type==='home').length,0);
  assert.equal(h.latest().videos[0].title,'Early result');
});

test('early feed reads honor disabled settings and discard results after navigation',async()=>{
  const disabled=appHarness('https://www.bilibili.com/',[],{enabled:false},true);
  assert.equal(disabled.pending.length,0);
  await disabled.finishDocument();assert.equal(disabled.pending.length,0);

  const h=appHarness('https://www.bilibili.com/',[],{},true);
  const old=h.pending.find(item=>item.type==='home');
  await h.navigate('https://search.bilibili.com/video?keyword=new');
  assert.equal(old.aborted,true);
  await h.finishDocument();
  assert.ok(h.pending.some(item=>item.type==='search'&&item.params.keyword==='new'));
  await h.reply('home',{}, {code:0,data:{item:[{bvid:'BVold',title:'Old result'}]}});
  await h.reply('search',{},search('New result'));
  assert.equal(h.latest().results[0].title,'New result');

  const unnoticed=appHarness('https://www.bilibili.com/',[],{},true);
  const unused=unnoticed.pending.find(item=>item.type==='home');
  unnoticed.changeUrlWithoutNotification('https://www.bilibili.com/video/BVfirst');
  await unnoticed.finishDocument();
  assert.equal(unused.aborted,true);
  assert.equal(unnoticed.watchCalls.mount,1);
});

test('a failed early read is retried normally at mount',async()=>{
  const h=appHarness('https://www.bilibili.com/',[],{},true);
  await h.reply('home',{},null);
  await h.finishDocument();
  assert.equal(h.pending.filter(item=>item.type==='home').length,1);
  await h.reply('home',{}, {code:0,data:{item:[{bvid:'BVretry',title:'Retry result'}]}});
  assert.equal(h.latest().videos[0].title,'Retry result');
});

test('home category first reads start before DOMContentLoaded and are reused',async()=>{
  const cases=[
    {url:'tech',type:'home-category',params:{category:'tech'},payload:{code:0,data:{list:[{bvid:'BVtech',title:'Tech',owner:{name:'Fixture'}}]}},title:'Tech'},
    {url:'live',type:'home-sections',section:'live',payload:{live:{code:0,data:{recommend_room_list:[{roomid:1,title:'Live'}]}}},title:'Live'},
    {url:'anime',type:'home-sections',section:'bangumi',payload:{bangumi:{code:0,result:[{episodes:[{episode_id:1,title:'Anime'}]}]}},title:'Anime'},
  ];
  for(const item of cases){
    const h=appHarness(`https://www.bilibili.com/?bilitube_category=${item.url}`,[],{},true);
    const early=h.pending.filter(request=>request.type===item.type);
    assert.equal(early.length,1,item.url);
    if(item.section)assert.deepEqual(Array.from(early[0].params.sections),[item.section]);
    if(item.params)assert.equal(early[0].params.category,item.params.category);
    await h.reply(item.type,{},item.payload);
    await h.finishDocument();
    assert.equal(h.pending.filter(request=>request.type===item.type).length,0,item.url);
    const shown=item.section?h.latest().shelves[0].items[0]:h.latest().videos[0];
    assert.equal(shown.title,item.title,item.url);
  }
});

test('home shelf preloads respect settings and release a read disabled before mount',async()=>{
  const disabled=appHarness('https://www.bilibili.com/?bilitube_category=live',[],{homeLiveShelf:false},true);
  assert.equal(disabled.pending.some(request=>request.type==='home-sections'),false);
  await disabled.finishDocument();
  assert.equal(disabled.pending.some(request=>request.type==='home-sections'),false);

  const settings={};
  const changed=appHarness('https://www.bilibili.com/?bilitube_category=live',[],settings,true);
  const early=changed.pending.find(request=>request.type==='home-sections');
  settings.homeLiveShelf=false;
  await changed.finishDocument();
  assert.equal(early.aborted,true);
  assert.equal(changed.pending.filter(request=>request.type==='home-sections').length,1);
});

test('failed early home section reads are retried after mounting',async()=>{
  const h=appHarness('https://www.bilibili.com/?bilitube_category=live',[],{},true);
  await h.reply('home-sections',{}, {live:{code:-1}});
  await h.finishDocument();
  assert.equal(h.pending.filter(request=>request.type==='home-sections').length,1);
  await h.reply('home-sections',{}, {live:{code:0,data:{recommend_room_list:[{roomid:2,title:'Recovered'}]}}});
  assert.equal(h.latest().shelves[0].items[0].title,'Recovered');
});

test('a category preload is cancelled when navigation selects another category',async()=>{
  const h=appHarness('https://www.bilibili.com/?bilitube_category=live',[],{},true);
  const old=h.pending.find(request=>request.type==='home-sections');
  await h.navigate('https://www.bilibili.com/?bilitube_category=tech');
  assert.equal(old.aborted,true);
  await h.finishDocument();
  await h.reply('home-sections',{}, {live:{code:0,data:{recommend_room_list:[{roomid:1,title:'Stale'}]}}});
  await h.reply('home-category',{category:'tech'}, {code:0,data:{list:[{bvid:'BVnew',title:'New',owner:{name:'Fixture'}}]}});
  assert.equal(h.latest().category,'tech');
  assert.equal(h.latest().videos[0].title,'New');
});

test('other first-page reads reuse matching early requests',async()=>{
  for(const [url,type,expected] of [
    ['https://search.bilibili.com/video?keyword=demo&order=click&duration=2','search',{keyword:'demo',category:'video',order:'click',duration:2}],
    ['https://t.bilibili.com/','dynamic',{offset:''}],
    ['https://www.bilibili.com/list/watchlater','watchlater',{}],
    ['https://space.bilibili.com/123/upload','space-archives',{mid:'123',page:1}],
  ]){
    const h=appHarness(url,[],{},true);
    const early=h.pending.filter(item=>item.type===type);
    assert.equal(early.length,1,url);
    for(const [key,value] of Object.entries(expected))assert.equal(early[0].params[key],value,url);
    await h.finishDocument();
    assert.equal(h.pending.filter(item=>item.type===type).length,1,url);
  }
});

test('video-to-video SPA navigation keeps the Watch decorator mounted', async () => {
  const h=appHarness('https://www.bilibili.com/video/BVfirst/');
  assert.equal(h.watchCalls.mount,1);
  await h.navigate('https://www.bilibili.com/video/BVsecond/');
  assert.equal(h.watchCalls.mount,1);
  assert.equal(h.watchCalls.destroy,0);
  assert.equal(h.watchCalls.updateContext,1);
  assert.equal(h.watchCalls.updateChrome,1);
});

test('changing Watch recommendation preference updates links without remounting the player', async () => {
  const h=appHarness('https://www.bilibili.com/video/BVfirst/');
  await h.changeSettings({openWatchRecommendationsInNewTab:true});
  assert.equal(h.watchCalls.updateRecommendationPreference,1);
  assert.equal(h.watchCalls.mount,1);
  assert.equal(h.watchCalls.destroy,0);
});

test('an empty search route stays on its landing without issuing a search request', async () => {
  const h=appHarness('https://search.bilibili.com/all');
  assert.equal(h.latest().loading,false);
  assert.equal(h.latest().hasMore,false);
  assert.equal(h.pending.filter(item=>item.type==='search').length,0);
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

test('favorite searches retain their folder and keyword across paging, refresh, and delayed responses', async () => {
  const h=appHarness('https://space.bilibili.com/123/favlist?fid=101');
  const payload=(page,title,hasMore=true)=>({mediaId:'101',page,hasMore,folders:{code:0,data:{list:[{id:101,title:'A'}]}},resources:{code:0,data:{medias:[{bvid:`BV${page}${title}`,title}]}}});
  await h.reply('favorites',{mediaId:'101',keyword:'',page:1},payload(1,'Initial'));
  h.act('loadMore','favorites');
  h.act('searchFavorites',' 相机 ');
  await h.reply('favorites',{mediaId:'101',keyword:'相机',page:1},payload(1,'Match'));
  await h.reply('favorites',{mediaId:'101',keyword:'',page:2},payload(2,'Stale'));
  assert.equal(h.latest().searchKeyword,'相机');assert.equal(h.latest().videos[0].title,'Match');
  h.act('loadMore','favorites');
  await h.reply('favorites',{mediaId:'101',keyword:'相机',page:2},payload(2,'Next',false));
  assert.equal(h.latest().videos.map(item=>item.title).join(','),'Match,Next');
  h.act('refreshCurrent');
  await h.reply('favorites',{mediaId:'101',keyword:'相机',page:1,forceFresh:true},payload(1,'Refreshed'));
  h.act('loadMore','favorites');
  h.act('searchFavorites','');
  await h.reply('favorites',{mediaId:'101',keyword:'',page:1},payload(1,'All'));
  await h.reply('favorites',{mediaId:'101',keyword:'相机',page:2},payload(2,'Late'));
  assert.equal(h.latest().searchKeyword,'');assert.equal(h.latest().videos[0].title,'All');
  await h.navigate('https://space.bilibili.com/123/favlist?fid=202');
  assert.equal(h.latest().searchKeyword,'');
  await h.reply('favorites',{mediaId:'202',keyword:''},favorite('202','Folder B'));
  assert.equal(h.latest().selectedId,'202');assert.equal(h.latest().videos[0].title,'Folder B');
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

test('disabled subscriptions skip new route reads and enabling them fetches once',async()=>{
  const h=appHarness('https://search.bilibili.com/video?keyword=old');
  await h.changeSettings({showSubscriptions:false});
  const before=h.pending.filter(item=>item.type==='subscriptions').length;
  await h.navigate('https://search.bilibili.com/video?keyword=new');
  assert.equal(h.pending.filter(item=>item.type==='subscriptions').length,before);
  await h.changeSettings({showSubscriptions:true});
  assert.equal(h.pending.filter(item=>item.type==='subscriptions').length,before+1);
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
  assert.equal(home.pending.some(item=>item.type==='home'||item.type==='home-sections'),false);
  assert.ok(home.pending.some(item=>item.type==='home-category'&&item.params.category==='tech'));
  const live=appHarness('https://www.bilibili.com/?bilitube_category=live');
  assert.equal(live.pending.some(item=>item.type==='home'||item.type==='home-category'),false);
  assert.deepEqual(Array.from(live.pending.find(item=>item.type==='home-sections').params.sections),['live']);
  assert.equal(live.latest().loading,true);
  await live.reply('home-sections',{}, {live:{code:0,data:{}}});assert.equal(live.latest().loading,false);
});

test('a failed home category fetches recommendation fallback only when needed',async()=>{
  const h=appHarness('https://www.bilibili.com/?bilitube_category=tech');
  assert.equal(h.pending.some(item=>item.type==='home'),false);
  await h.reply('home-category',{category:'tech'},null);
  assert.equal(h.pending.filter(item=>item.type==='home').length,1);
  await h.reply('home',{}, {code:0,data:{item:[{bvid:'BVtech',title:'Fallback',tname:'科技',owner:{name:'Author'}}]}});
  assert.equal(h.latest().videos[0].title,'Fallback');
});

test('home reads only enabled shelves and fetches a shelf when it is enabled', async () => {
  const disabled={homeFollowedShelf:false,homeLiveShelf:false,homeBangumiShelf:false,homePopularShelf:false};
  const h=appHarness('https://www.bilibili.com/',[],disabled);
  assert.equal(h.pending.some(item=>item.type==='home-sections'),false);
  await h.changeSettings({...disabled,homeLiveShelf:true});
  assert.deepEqual(Array.from(h.pending.find(item=>item.type==='home-sections').params.sections),['live']);
  await h.reply('home-sections',{}, {live:{code:0,data:{list:[]}}});
  h.act('refreshCurrent');
  assert.deepEqual(Array.from(h.pending.find(item=>item.type==='home-sections'&&item.params.forceFresh).params.sections),['live']);

  const live=appHarness('https://www.bilibili.com/?bilitube_category=live',[],disabled);
  assert.equal(live.latest().loading,false);
  assert.equal(live.pending.some(item=>item.type==='home-sections'),false);
  await live.changeSettings({...disabled,homeLiveShelf:true});
  assert.equal(live.latest().loading,true);
  await live.reply('home-sections',{}, {live:{code:0,data:{}}});
  assert.equal(live.latest().loading,false);
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

test('empty search focus shows the native default word, history and trending panel', async () => {
  const { ui } = uiHarness();
  const header = ui.createTopbar({settings:{searchSuggestions:true}}, {
    requestSearchDefaultWord: async () => '默认推荐词',
    requestSearchTrending: async () => ({
      title:'bilibili热搜', items:[{ keyword:'热词', label:'热词展示', position:1, icon:'' }],
    }),
  });
  const input = header.querySelector('.bt-search-input');
  input.listeners.get('focus')[0]();
  await settle(); await settle();
  assert.equal(input.placeholder, '默认推荐词');
  const panel = header.querySelector('.bt-search-suggestions');
  assert.equal(panel.hidden, false);
  assert.ok(panel.querySelector('.bt-search-trending'));
  assert.equal(panel.querySelector('.bt-search-rank').textContent, '1');
  assert.equal(panel.querySelector('.bt-search-trending-text').textContent, '热词展示');
});

test('search history renders in the empty focus panel and supports clear and record', async () => {
  const { ui, context } = uiHarness();
  context.localStorage.setItem('bilitube_search_history', JSON.stringify([{value:'摄影教程'},{value:'NAS 搭建'}]));
  const header = ui.createTopbar({}, { requestSearchTrending: async () => ({ title:'', items:[] }) });
  const input = header.querySelector('.bt-search-input');
  input.listeners.get('focus')[0]();
  await settle(); await settle();
  const panel = header.querySelector('.bt-search-suggestions');
  assert.equal(panel.hidden, false);
  const section = panel.querySelector('.bt-search-history');
  assert.equal(section.children[1].children.length, 2);
  assert.equal(section.children[1].children[0].children[0].children[1].textContent, '摄影教程');
  section.children[0].children[1].listeners.get('click')[0]();
  assert.equal(panel.hidden, true);
  assert.deepEqual(JSON.parse(context.localStorage.getItem('bilitube_search_history')), []);
  const form = header.querySelector('.bt-search');
  input.value = '新搜索';
  form.listeners.get('submit')[0]({ preventDefault() {} });
  assert.equal(JSON.parse(context.localStorage.getItem('bilitube_search_history'))[0].value, '新搜索');
});

test('disabled search suggestions suppress the default focus panel', async () => {
  const { ui } = uiHarness();
  let requested = false;
  const header = ui.createTopbar({settings:{searchSuggestions:false}}, {
    requestSearchDefaultWord: async () => { requested = true; return '不应出现'; },
    requestSearchTrending: async () => { requested = true; return { title:'', items:[] }; },
  });
  const input = header.querySelector('.bt-search-input');
  input.listeners.get('focus')[0]();
  await settle();
  assert.equal(requested, false);
  assert.equal(input.placeholder, '搜索');
  assert.equal(header.querySelector('.bt-search-suggestions').hidden, true);
});

test('IME composition suppresses suggestions and does not select a result on confirmation',()=>{
  const {ui,context}=uiHarness();let scheduled=0;
  context.setTimeout=()=>{scheduled++;return scheduled;};context.clearTimeout=()=>{};
  const header=ui.createTopbar({query:'中文'},{requestSearchSuggestions:()=>[]});const input=header.querySelector('.bt-search-input');
  input.listeners.get('compositionstart')[0]();input.listeners.get('input')[0]();
  input.listeners.get('keydown')[0]({key:'Enter',isComposing:true,preventDefault:()=>assert.fail('IME confirmation must stay native')});
  assert.equal(scheduled,0);input.listeners.get('compositionend')[0]();assert.equal(scheduled,1);
});
