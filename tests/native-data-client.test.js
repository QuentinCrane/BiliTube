const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function harness(){
  const timers=new Map(),sent=[];let next=0,listener;
  const context=vm.createContext({URL,URLSearchParams,location:new URL('https://search.bilibili.com/all?keyword=demo'),BiliTubePolicy:require('../src/core/policy'),setTimeout:(fn,ms)=>{timers.set(++next,{fn,ms});return next},clearTimeout:id=>timers.delete(id),addEventListener:(type,fn)=>{if(type==='message')listener=fn},chrome:{runtime:{sendMessage:(message,reply)=>sent.push({message,reply})}}});
  context.window=context;
  vm.runInContext(fs.readFileSync(require.resolve('../src/core/api-client.js'),'utf8'),context);
  return {api:context.BiliTubeApiClient,sent,timers,
    tick(ms){for(const [id,timer] of [...timers])if(timer.ms===ms){timers.delete(id);timer.fn();}},
    deliver(snapshot){context.snapshot=snapshot;context.listener=listener;vm.runInContext("listener({source:window,data:{source:'bilitube-bridge-core',type:'native-data',payload:snapshot}})",context);}};
}
const snapshot=(keyword='demo')=>({type:'search',href:'https://search.bilibili.com/all?keyword=demo&vt=42',params:{keyword,category:'all',page:1},payload:{code:0,data:{result:[],numPages:0}}});

test('the native page response paints without sending a duplicate extension request',async()=>{
  const h=harness();const pending=h.api.request('search',{keyword:'demo',category:'all',page:1,nativeFirst:true});
  h.deliver(snapshot());assert.equal((await pending).code,0);h.tick(250);
  assert.equal(h.sent.length,0);assert.equal(h.timers.size,0);
});

test('a late extension response cannot replace faster native results',async()=>{
  const h=harness();const pending=h.api.request('search',{keyword:'demo',category:'all',nativeFirst:true});h.tick(250);
  assert.equal(h.sent.length,1);assert.equal(h.sent[0].message.params.nativeFirst,undefined);
  h.deliver(snapshot());const result=await pending;h.sent[0].reply({ok:true,data:{code:0,data:{result:['late']}}});
  assert.deepEqual(result.data.result,[]);assert.equal(h.timers.size,0);
});

test('a missing native response and hanging runtime request resolve within the read deadline',async()=>{
  const h=harness();const pending=h.api.request('search',{keyword:'demo',category:'all',nativeFirst:true});
  h.deliver(snapshot('other'));h.tick(250);assert.equal(h.sent.length,1);h.tick(5000);
  assert.equal(await pending,null);assert.equal(h.timers.size,0);
});

test('cached native data is reused for matching requests but not different queries',async()=>{
  const h=harness();h.deliver(snapshot());assert.equal((await h.api.request('search',{keyword:'demo',category:'all',nativeFirst:true})).code,0);
  const next=h.api.request('search',{keyword:'new',category:'all',nativeFirst:true});h.tick(250);h.tick(5000);
  assert.equal(await next,null);assert.equal(h.sent.length,1);
});

test('an explicit refresh bypasses native snapshots and only accepts its fresh runtime response',async()=>{
  const h=harness();h.deliver(snapshot());
  const pending=h.api.request('search',{keyword:'demo',category:'all',nativeFirst:true,forceFresh:true});
  assert.equal(h.sent.length,1);assert.equal(h.sent[0].message.params.forceFresh,true);
  h.deliver(snapshot());h.sent[0].reply({ok:true,data:{code:0,data:{result:['fresh']}}});
  assert.deepEqual((await pending).data.result,['fresh']);assert.equal(h.timers.size,0);
});
