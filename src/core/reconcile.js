(function init(root, factory) {
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.BiliTubeReconcile=api;
})(typeof globalThis!=='undefined'?globalThis:this,function createReconcile(){
  // Render new metadata offscreen, then update the connected tree. Keyed cards
  // and their media stay connected, including when home shelves arrive later.
  function update(target, fresh, callbacks={}){
    const pool=new Map(),used=new Set(),removals=[];
    for(const node of target.querySelectorAll('article')){
      if(!node.__btCardKey)continue;
      if(!pool.has(node.__btCardKey))pool.set(node.__btCardKey,[]);
      pool.get(node.__btCardKey).push(node);
    }
    const identity=node=>node.nodeType===3?'#text':node.nodeType===1?`${node.tagName}:${node.id||String(node.className||'').split(' ')[0]}`:String(node.nodeType);
    function place(parent,node,before){
      if(node===before)return;
      if(node.isConnected&&typeof parent.moveBefore==='function')parent.moveBefore(node,before);
      else parent.insertBefore(node,before);
    }
    function children(parent,source){
      const old=Array.from(parent.childNodes),desired=Array.from(source.childNodes);
      let cursor=parent.firstChild;
      for(const next of desired){
        const key=next.__btCardKey;
        const candidates=key?pool.get(key)||[]:old;
        let node=candidates.find(item=>!used.has(item)&&(key?item.__btCardKey===key:!item.__btCardKey&&identity(item)===identity(next)));
        if(!node)node=next;
        used.add(node);place(parent,node,cursor);
        if(node!==next){
          if(node.nodeType===3){if(node.nodeValue!==next.nodeValue)node.nodeValue=next.nodeValue;}
          else if(node.__btCardSignature&&node.__btCardSignature===next.__btCardSignature){/* unchanged card */}
          else if(node.__btMediaKey&&node.__btMediaKey===next.__btMediaKey){/* retain image and playing preview */}
          else if((node.tagName==='BUTTON'||node.tagName==='INPUT')&&!(node.__btAction&&next.__btAction)){
            parent.replaceChild(next,node);used.delete(node);used.add(next);node=next;
          }else{
            if(next.__btAction)node.__btAction=next.__btAction;
            for(const attr of Array.from(node.attributes))if(!next.hasAttribute(attr.name))node.removeAttribute(attr.name);
            for(const attr of Array.from(next.attributes))if(node.getAttribute(attr.name)!==attr.value)node.setAttribute(attr.name,attr.value);
            children(node,next);node.__btCardSignature=next.__btCardSignature;node.__btMediaKey=next.__btMediaKey;node.__btCardItem=next.__btCardItem;
            if(node.__btPreviewHost&&!node.__btPreviewHost.isConnected&&next.__btPendingPreview){node.__btPendingPreview=next.__btPendingPreview;node.__btPreviewHost=next.__btPendingPreview.host;}
          }
        }else if(node.nodeType===1){children(node,node);}
        cursor=node.nextSibling;
      }
      for(const node of old)if(!used.has(node))removals.push(node);
    }
    children(target,fresh);
    for(const node of removals)if(!used.has(node))node.remove();
    for(const img of target.querySelectorAll('img'))if(img.__btDeferredSrc){const src=img.__btDeferredSrc;delete img.__btDeferredSrc;img.src=src;}
    if(callbacks.bindPreview)for(const node of target.querySelectorAll('article')){
      const pending=node.__btPendingPreview;if(!pending)continue;
      delete node.__btPendingPreview;callbacks.bindPreview(node,pending.item,pending.host);
    }
    if(callbacks.afterReconcile)callbacks.afterReconcile();
  }
  return {update};
});
