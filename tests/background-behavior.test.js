const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/background.js'), 'utf8');

function createHarness() {
  const urls = [];
  let listener = null;
  const sandbox = {
    URLSearchParams,
    Promise,
    Date,
    Map,
    String,
    Number,
    Math,
    encodeURIComponent,
    fetch: async (url) => {
      urls.push(String(url));
      return { ok:true, json:async()=>({ code:0, data:{ item:[], list:[], cursor:{} } }) };
    },
    chrome:{ runtime:{ onMessage:{ addListener(fn){ listener=fn; } } } },
  };
  vm.runInNewContext(source, sandbox, { filename:'background.js' });
  async function request(type, params={}) {
    return new Promise((resolve, reject) => {
      if (!listener) return reject(new Error('listener missing'));
      const async = listener({ source:'bilitube-api', type, params }, {}, response => resolve(response));
      if (!async) reject(new Error('listener did not stay open'));
    });
  }
  return { urls, request };
}

test('refresh bypasses cached reads and invalidates later pages of that feed',async()=>{
  const h=createHarness();
  await h.request('dynamic',{offset:''});await h.request('dynamic',{offset:'next'});
  await h.request('dynamic',{offset:''});assert.equal(h.urls.length,2);
  await h.request('dynamic',{offset:'',forceFresh:true});assert.equal(h.urls.length,3);
  await h.request('dynamic',{offset:'next'});assert.equal(h.urls.length,4);
  await h.request('dynamic',{offset:'next'});assert.equal(h.urls.length,4);
});

test('history background request uses legal 30-item cursor page and cursor parameters', async () => {
  const h=createHarness();
  await h.request('history',{max:123,business:'archive',viewAt:456});
  const url=new URL(h.urls.at(-1));
  assert.equal(url.pathname,'/x/web-interface/history/cursor');
  assert.equal(url.searchParams.get('ps'),'30');
  assert.equal(url.searchParams.get('type'),'all');
  assert.equal(url.searchParams.get('max'),'123');
  assert.equal(url.searchParams.get('business'),'archive');
  assert.equal(url.searchParams.get('view_at'),'456');
});

test('home page two generates a distinct fresh_idx request', async () => {
  const h=createHarness();
  await h.request('home',{page:2});
  const requestUrl=h.urls.find(value=>value.includes('/index/top/feed/rcmd'));
  assert.ok(requestUrl,'recommendation request missing');
  const url=new URL(requestUrl);
  assert.equal(url.searchParams.get('fresh_idx'),'2');
  assert.equal(url.searchParams.get('ps'),'30');
});

test('home category uses a public region ranking endpoint', async () => {
  const h=createHarness();
  await h.request('home-category',{category:'tech'});
  const url=new URL(h.urls.find(value=>value.includes('/ranking/v2')));
  assert.equal(url.searchParams.get('rid'),'188');
  assert.equal(url.searchParams.get('type'),'all');
});

test('account background request uses the Bilibili nav endpoint', async () => {
  const h=createHarness();
  await h.request('account');
  const url=new URL(h.urls.at(-1));
  assert.equal(url.pathname,'/x/web-interface/nav');
});

test('search forwards sort and duration and isolates cached variants', async () => {
  const h=createHarness();
  await h.request('search',{keyword:'demo',category:'video',order:'click',duration:2});
  await h.request('search',{keyword:'demo',category:'video',order:'pubdate',duration:4});
  const urls=h.urls.filter(url=>url.includes('/search/type')).map(url=>new URL(url));
  assert.equal(urls.length,2);
  assert.equal(urls[0].searchParams.get('order'),'click');assert.equal(urls[0].searchParams.get('duration'),'2');
  assert.equal(urls[1].searchParams.get('order'),'pubdate');assert.equal(urls[1].searchParams.get('duration'),'4');
  await h.request('search',{keyword:'bad',category:'video',order:'invalid',duration:99});
  const fallback=new URL(h.urls.at(-1));
  assert.equal(fallback.searchParams.get('order'),'totalrank');assert.equal(fallback.searchParams.get('duration'),'0');
});

test('background cache stays bounded and pending reads cannot restore invalidated entries', async () => {
  const sandbox={chrome:{runtime:{onMessage:{addListener(){}}}}};
  vm.createContext(sandbox);vm.runInContext(source,sandbox);
  await vm.runInContext("Promise.all(Array.from({length:600},(_,i)=>cached('item:'+i,1000,()=>i)))",sandbox);
  assert.equal(vm.runInContext('cache.size',sandbox),256);
  vm.runInContext("globalThis.reply=null;globalThis.pending=cached('stale',1000,()=>new Promise(resolve=>{reply=resolve}))",sandbox);
  await Promise.resolve();
  vm.runInContext("cache.clear();reply({code:0});",sandbox);
  await sandbox.pending;await Promise.resolve();
  assert.equal(vm.runInContext('cache.size',sandbox),0);
});
