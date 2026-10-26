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
    const paused=new Set();
    function suspendDecorators(){
      if(typeof doc.getAnimations!=='function')return;
      for(const animation of doc.getAnimations()){
        const effect=animation.effect;
        if(animation.playState!=='running'||!effect||effect.pseudoElement||effect.target===doc.documentElement)continue;
        try{animation.pause();paused.add(animation);}catch{}
      }
    }
    function resumeDecorators(){
      for(const animation of paused)if(animation.playState==='paused'){try{animation.play();}catch{}}
      paused.clear();
    }
    function run(commit,_origin,animate=true){
      const current=++version,html=doc.documentElement;
      if(active){try{active.skipTransition();}catch{}active=null;}
      const finish=()=>{if(current===version){active=null;html.classList.remove('bt-theme-reveal','bt-theme-switching','bt-theme-animating');resumeDecorators();}};
      if(!animate||typeof doc.startViewTransition!=='function'||typeof html.animate!=='function'){finish();commit();return;}
      suspendDecorators();
      html.classList.add('bt-theme-reveal','bt-theme-switching','bt-theme-animating');
      try{
        const transition=doc.startViewTransition(()=>{if(current===version)commit();});active=transition;
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
    function cancel(){version++;if(active){try{active.skipTransition();}catch{}active=null;}doc.documentElement.classList.remove('bt-theme-reveal','bt-theme-switching','bt-theme-animating');resumeDecorators();}
    return {run,cancel};
  }
  return { resolve, nextExplicit, createRevealController };
});
