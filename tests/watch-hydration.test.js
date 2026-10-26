const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('author mirroring waits for MAIN-world hydration readiness and cancels pending retries',()=>{
  const timers=new Map();let ready=false,next=0;
  const classes=new Set(['bilitube-watch-preflight']);
  const element=(tag,cls='')=>({tagName:tag,className:cls,isConnected:true,dataset:{},children:[],append(...nodes){this.children.push(...nodes)},replaceChildren(...nodes){this.children=nodes},querySelector(){return null},addEventListener(){},setAttribute(){},remove(){this.isConnected=false}});
  const main=element('main');
  const doc={documentElement:{classList:{add:(...keys)=>keys.forEach(key=>classes.add(key)),remove:(...keys)=>keys.forEach(key=>classes.delete(key)),toggle:()=>{}}},
    querySelector:selector=>selector==='#app'?{}:selector==='.bt-native-watch-main'?main:null,removeEventListener(){}};
  const context=vm.createContext({BiliTubeUI:{e:element,icon:()=>element('svg')},setTimeout:fn=>{timers.set(++next,fn);return next},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(fs.readFileSync(require.resolve('../src/core/watch.js'),'utf8'),context);
  const watch=context.BiliTubeWatch.createDecorator(doc);
  // Pass hydration via the same callback the isolated-world app supplies.
  // mount() saves callbacks even when the native player is still missing.
  watch.mount({}, {canDecorateAuthor:()=>ready});
  watch.updateContext({creator:{name:'Native creator',href:'https://space.bilibili.com/123'}});
  assert.equal(main.children.length,0);assert.equal(classes.has('bt-watch-author-ready'),false);
  ready=true;watch.updateContext({});
  assert.equal(main.children.length,1);assert.equal(classes.has('bt-watch-author-ready'),true);
  watch.updateContext({});assert.equal(main.children.length,1);
  watch.destroy();assert.equal(timers.size,0);assert.equal(classes.has('bilitube-watch-preflight'),false);
});

test('MAIN-world bridge publishes hydration readiness once, across isolated-world boundaries',()=>{
  const messages=[],listeners=new Map();let poll;
  const app={__vue__:{_isMounted:false}};
  const context=vm.createContext({location:{href:'https://www.bilibili.com/video/BVdemo'},document:{title:'Fixture',querySelector:()=>app,addEventListener(){}},history:{pushState(){},replaceState(){}},postMessage:message=>messages.push(message),addEventListener:(name,listener)=>listeners.set(name,listener),setInterval:fn=>{poll=fn;},queueMicrotask:fn=>fn()});
  context.window=context;
  vm.runInContext(fs.readFileSync(require.resolve('../src/page/bridge.js'),'utf8'),context);
  assert.equal(messages.at(-1).payload.hydrated,false);
  app.__vue__._isMounted=true;poll();assert.equal(messages.at(-1).payload.hydrated,true);
  const count=messages.length;poll();assert.equal(messages.length,count);
});
