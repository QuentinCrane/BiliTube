(function init(root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeApiClient = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createApiClient(root) {
  const snapshots=new Map(),waiting=new Set();
  const nativeTypes=new Set(['home','search','space-archives','dynamic','watchlater']);
  const reads=new Set(['home','search','space-archives','space-profile','dynamic','watchlater','favorites','home-sections','home-category','account','subscriptions','history','history-status','preview','search-suggest','watch-related']);
  function key(type,params={}){
    if(type==='search')return JSON.stringify([type,String(params.keyword||'').trim(),params.category||'all',Number(params.page||1),params.category==='video'?params.order||'totalrank':'',params.category==='video'?Number(params.duration||0):0]);
    if(type==='space-archives')return JSON.stringify([type,String(params.mid||''),Number(params.page||1)]);
    if(type==='dynamic')return JSON.stringify([type,String(params.offset||'')]);
    return JSON.stringify([type,Number(params.page||1)]);
  }
  function identity(href){
    try{return root.BiliTubePolicy.navigationIdentity(new URL(href));}catch{return href;}
  }
  function onMessage(event){
    if(event.source!==root||!event.data||event.data.source!=='bilitube-bridge-core'||event.data.type!=='native-data')return;
    const snapshot=event.data.payload;
    if(!snapshot||!nativeTypes.has(snapshot.type)||!snapshot.payload||snapshot.payload.code!==0||!snapshot.payload.data)return;
    const id=key(snapshot.type,snapshot.params),href=identity(snapshot.href);
    snapshots.delete(id);snapshots.set(id,{payload:snapshot.payload,href,at:Date.now()});
    while(snapshots.size>8)snapshots.delete(snapshots.keys().next().value);
    for(const pending of waiting)if(pending.key===id&&pending.href===href)pending.finish(snapshot.payload);
  }
  if(root&&typeof root.addEventListener==='function')root.addEventListener('message',onMessage);
  function request(type, params = {}) {
    return new Promise((resolve) => {
      const preferNative=params.nativeFirst&&!params.forceFresh&&nativeTypes.has(type),id=key(type,params),href=root.location&&identity(root.location.href);
      if(params.forceFresh)snapshots.delete(id);
      let settled=false,backup=null,deadline=null;
      const pending={key:id,href,finish(value){
        if(settled)return;settled=true;clearTimeout(backup);clearTimeout(deadline);waiting.delete(pending);resolve(value);
      }};
      const wireParams={...params};delete wireParams.nativeFirst;
      const send=()=>{
        backup=null;if(settled)return;
        try{chrome.runtime.sendMessage({source:'bilitube-api',type,params:wireParams},response=>{
          if(chrome.runtime.lastError)return pending.finish(null);
          pending.finish(response&&response.ok?response.data:null);
        });}catch{pending.finish(null);}
      };
      if(reads.has(type))deadline=setTimeout(()=>pending.finish(null),5000);
      if(preferNative){
        const known=snapshots.get(id);
        if(known&&known.href===href&&Date.now()-known.at<10000){pending.finish(known.payload);return;}
        waiting.add(pending);backup=setTimeout(send,250);
      }else send();
    });
  }
  return { request };
});
