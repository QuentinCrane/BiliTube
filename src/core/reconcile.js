(function init(root, factory) {
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.BiliTubeReconcile=api;
})(typeof globalThis!=='undefined'?globalThis:this,function createReconcile(){
  // Staging must never detach live media. Represent unchanged cards with small
  // placeholders and resolve them only when reconciling the connected tree.
  function createReuse(target){
    const cards=new Map();
    for(const node of target.querySelectorAll('article')){
      if(!node.__btCardKey||!node.__btCardSignature)continue;
      const key=JSON.stringify([node.className,node.__btCardKey,node.__btCardSignature]);
      if(!cards.has(key))cards.set(key,{nodes:[],index:0});
      cards.get(key).nodes.push(node);
    }
    return (className,key,signature)=>{
      const matches=cards.get(JSON.stringify([className,key,signature]));
      return matches&&matches.nodes[matches.index++];
    };
  }
  // Render new metadata offscreen, then update the connected tree. Keyed cards
  // and their media stay connected, including when home shelves arrive later.
  // `hooks.beforeApply/afterApply` bracket the single DOM mutation so a visual
  // layer can measure and transition around it without re-implementing the diff.
  function update(target, fresh, callbacks={}, hooks={}){
    const pool=new Map(),used=new Set(),removals=[];
    const reserved=new Set(Array.from(fresh.querySelectorAll('article'),node=>node.__btReuseCard).filter(Boolean));
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
      const unkeyed=new Map();
      for(const node of old)if(!node.__btCardKey){
        const id=identity(node);if(!unkeyed.has(id))unkeyed.set(id,{nodes:[],index:0});
        unkeyed.get(id).nodes.push(node);
      }
      let cursor=parent.firstChild;
      for(const next of desired){
        const key=next.__btCardKey;
        let node=next.__btReuseCard;
        if(node&&used.has(node))node=null;
        if(!node&&key)node=(pool.get(key)||[]).find(item=>!used.has(item)&&!reserved.has(item)&&identity(item)===identity(next));
        if(!node&&!key){
          const group=unkeyed.get(identity(next));
          if(group){while(group.index<group.nodes.length&&used.has(group.nodes[group.index]))group.index++;node=group.nodes[group.index++];}
        }
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
    if(hooks&&typeof hooks.beforeApply==='function')hooks.beforeApply(target,fresh);
    children(target,fresh);
    for(const node of removals)if(!used.has(node))node.remove();
    if(hooks&&typeof hooks.afterApply==='function')hooks.afterApply(target);
    for(const img of target.querySelectorAll('img'))if(img.__btDeferredSrc){const src=img.__btDeferredSrc;delete img.__btDeferredSrc;img.src=src;}
    if(callbacks.bindPreview)for(const node of target.querySelectorAll('article')){
      const pending=node.__btPendingPreview;if(!pending)continue;
      delete node.__btPendingPreview;callbacks.bindPreview(node,pending.item,pending.host);
    }
    if(callbacks.afterReconcile)callbacks.afterReconcile();
  }
  return {update,createReuse};
});
