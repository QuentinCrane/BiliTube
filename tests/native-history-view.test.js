const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
  const classes=new Set(),listeners=new Map(),reads=[],writes=[];
  const html={dataset:{},classList:{add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name))}};
  const doc={
    documentElement:html,
    body:{append(){}},
    createElement:()=>({dataset:{},append(){},remove(){}}),
    querySelectorAll:()=>[],
    addEventListener:(type,fn)=>listeners.set(type,fn),
    removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);},
  };
  const ui={createTopbar:()=>({}),createSidebarDrawer:()=>({backdrop:{},toggle(){},close(){}})};
  const context=vm.createContext({document:doc,BiliTubeUI:ui,MutationObserver:class{observe(){} disconnect(){}},chrome:{storage:{local:{get:(_key,callback)=>reads.push(callback),set:value=>writes.push(value)}}}});
  vm.runInContext(fs.readFileSync(require.resolve('../src/core/native-adapter.js'),'utf8'),context);
  return {adapter:context.BiliTubeNativeAdapter.createAdapter(doc),classes,listeners,reads,writes};
}

test('history view choice survives an outstanding read and stops following clicks after restore',()=>{
  const h=harness();h.adapter.mount({}, {}, 'light', {route:'history'});
  h.listeners.get('click')({target:{closest:()=>null}});assert.equal(h.writes.length,0);
  h.listeners.get('click')({target:{closest:()=>({})}});
  assert.equal(h.classes.has('bt-history-view-chosen'),true);assert.equal(h.writes[0].bilitube_history_view_chosen,true);
  h.reads[0]({bilitube_history_view_chosen:false});assert.equal(h.classes.has('bt-history-view-chosen'),true);
  h.adapter.restore();assert.equal(h.listeners.has('click'),false);assert.equal(h.classes.has('bt-history-view-chosen'),false);
  h.reads[0]({bilitube_history_view_chosen:true});assert.equal(h.classes.has('bt-history-view-chosen'),false);
});

test('a saved history view choice is restored only for the history route',()=>{
  const h=harness();h.adapter.mount({}, {}, 'light', {route:'history'});
  h.reads[0]({bilitube_history_view_chosen:true});assert.equal(h.classes.has('bt-history-view-chosen'),true);
  h.adapter.mount({}, {}, 'light', {route:'message'});
  assert.equal(h.classes.has('bt-history-view-chosen'),false);assert.equal(h.listeners.has('click'),false);
});
