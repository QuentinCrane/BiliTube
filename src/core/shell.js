(function init(root, factory) {
  const ui = root && root.BiliTubeUI || (typeof require === 'function' ? require('./ui.js') : null);
  const api = factory(ui);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeShell = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createShellModule(UI) {
  function createController(doc = document) {
    let root = null, outlet = null, callbacks = null, chromeData = {}, previousRoute = null, transitionTimer = null;
    function ensure(data={}, nextCallbacks={}) {
      callbacks = nextCallbacks; chromeData = data;
      if (root && root.isConnected) return root;
      root = UI.e('div','bt-root');root.id='bilitube-root';root.dataset.btTheme='light';
      const header=UI.createTopbar(data,nextCallbacks);const body=UI.e('div','bt-body');const sidebar=UI.createSidebar(data,nextCallbacks);outlet=UI.e('main','bt-main');outlet.id='bilitube-outlet';body.append(sidebar,outlet);root.append(header,body);doc.body.append(root);return root;
    }
    function render(route,data={}) {
      if (!root) ensure(data,callbacks||{});
      const shouldAnimate=previousRoute===null||previousRoute!==route;
      if(transitionTimer){clearTimeout(transitionTimer);transitionTimer=null;}
      outlet.classList.remove('is-route-entering');
      outlet.replaceChildren();
      outlet.dataset.route=route;
      const payload={...data,route};
      if(route==='home')UI.renderHome(outlet,payload,callbacks);
      else if(route==='history')UI.renderHistory(outlet,payload,callbacks);
      else if(['search-all','search-video','search-user','search-bangumi','search-media'].includes(route))UI.renderSearch(outlet,payload,callbacks);
      else if(route==='dynamic')UI.renderDynamic(outlet,payload,callbacks);
      else if(route==='watchlater')UI.renderWatchLater(outlet,payload,callbacks);
      else if(route==='favorites')UI.renderFavorites(outlet,payload,callbacks);
      else if(route==='space-home'||route==='space-upload')UI.renderSpace(outlet,payload,callbacks);
      previousRoute=route;
      if(shouldAnimate&&!(doc.defaultView&&doc.defaultView.matchMedia&&doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches)){
        const schedule=doc.defaultView&&typeof doc.defaultView.requestAnimationFrame==='function' ? doc.defaultView.requestAnimationFrame.bind(doc.defaultView) : (callback)=>setTimeout(callback,0);
        schedule(()=>{
          if(!outlet||!outlet.isConnected)return;
          outlet.classList.add('is-route-entering');
          transitionTimer=setTimeout(()=>{if(outlet)outlet.classList.remove('is-route-entering');transitionTimer=null;},620);
        });
      }
    }
    function updateTheme(theme){if(root)root.dataset.btTheme=theme;doc.documentElement.dataset.btTheme=theme;}
    function updateChrome(data){chromeData={...chromeData,...data};if(root)UI.updateChrome(root,chromeData,callbacks||{});}
    function setCollapsed(value){const side=root&&root.querySelector('[data-role="sidebar"]');if(side)side.classList.toggle('is-collapsed',Boolean(value));}
    function toggleSidebar(){const side=root&&root.querySelector('[data-role="sidebar"]');if(side)side.classList.toggle('is-collapsed');}
    function destroy(){if(transitionTimer){clearTimeout(transitionTimer);transitionTimer=null;}if(root)root.remove();root=null;outlet=null;previousRoute=null;}
    return { ensure, render, updateTheme, updateChrome, setCollapsed, toggleSidebar, destroy, getRoot:()=>root };
  }
  return { createController };
});
