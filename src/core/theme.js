(function init(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeTheme = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createTheme() {
  function resolve(preference, systemDark) {
    if (preference === 'dark') return 'dark';
    if (preference === 'light') return 'light';
    return systemDark ? 'dark' : 'light';
  }
  function nextExplicit(currentResolved) { return currentResolved === 'dark' ? 'light' : 'dark'; }
  function createRevealController(doc){
    let active=null,version=0;
    function run(commit,_origin,animate=true){
      const current=++version,html=doc.documentElement;
      if(active){try{active.skipTransition();}catch{}active=null;}
      const finish=()=>{if(current===version){active=null;html.classList.remove('bt-theme-reveal','bt-theme-switching','bt-theme-animating');}};
      if(!animate||typeof doc.startViewTransition!=='function'||typeof html.animate!=='function'){finish();commit();return;}
      html.classList.add('bt-theme-reveal');
      try{
        // Defer subtree style changes until the snapshot update. Enumerating
        // document animations here forces style/layout for offscreen cards.
        const transition=doc.startViewTransition(()=>{if(current===version){html.classList.add('bt-theme-switching','bt-theme-animating');commit();}});active=transition;
        transition.ready.then(()=>{
          if(current!==version)return;
          // Only composite the old snapshot's opacity. Animating a viewport-
          // sized clip path keeps the expensive reveal active on high-DPI pages.
          html.animate({opacity:[1,0]},
            {duration:180,easing:'ease-out',fill:'both',pseudoElement:'::view-transition-old(root)'});
        }).catch(()=>{try{transition.skipTransition();}catch{}});
        Promise.resolve(transition.finished).catch(()=>{}).finally(finish);
        return transition.finished.catch(()=>{});
      }catch{finish();commit();}
    }
    function cancel(){version++;if(active){try{active.skipTransition();}catch{}active=null;}doc.documentElement.classList.remove('bt-theme-reveal','bt-theme-switching','bt-theme-animating');}
    return {run,cancel};
  }
  return { resolve, nextExplicit, createRevealController };
});
