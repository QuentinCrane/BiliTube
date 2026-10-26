(function init(root, factory) {
  const ui = root && root.BiliTubeUI || (typeof require === 'function' ? require('./ui.js') : null);
  const reconcile = root && root.BiliTubeReconcile || (typeof require === 'function' ? require('./reconcile.js') : null);
  const api = factory(ui,reconcile);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeShell = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createShellModule(UI,Reconcile) {
  function createController(doc = document) {
    let root = null, outlet = null, callbacks = null, chromeData = {}, previousRoute = null, previousPayload = null, transitionTimer = null, drawer = null;
    function ensure(data={}, nextCallbacks={}) {
      callbacks = nextCallbacks; chromeData = data;
      if (root && root.isConnected) return root;
      root = UI.e('div','bt-root');root.id='bilitube-root';root.dataset.btTheme='light';
      const header=UI.createTopbar(data,nextCallbacks);const body=UI.e('div','bt-body');const sidebar=UI.createSidebar(data,nextCallbacks);outlet=UI.e('main','bt-main');outlet.id='bilitube-outlet';body.append(sidebar,outlet);root.append(header,body);doc.body.append(root);return root;
    }
    function render(route,data={}) {
      if (!root) ensure(data,callbacks||{});
      const payload={...data,route};
      outlet.setAttribute('aria-busy',String(Boolean(data.loading||data.refreshing)));
      if(data.append&&previousRoute===route&&UI.appendFeed&&UI.appendFeed(outlet,route,payload,previousPayload,callbacks)){
        previousPayload=payload;return;
      }
      if(Reconcile&&previousRoute===route&&previousPayload&&(previousPayload.renderKey||previousPayload.href)===(payload.renderKey||payload.href)&&previousPayload.mid===payload.mid){
        const fresh=UI.e('main','bt-main');
        const staging={...callbacks,staging:true,bindPreview:(card,item,host)=>{card.__btPendingPreview={item,host};}};
        renderContent(fresh,route,payload,staging);
        Reconcile.update(outlet,fresh,callbacks||{});
        if(UI.updateFeedStatus)UI.updateFeedStatus(outlet,payload,callbacks);
        previousPayload=payload;return;
      }
      const shouldAnimate=previousRoute===null||previousRoute!==route;
      if(drawer)drawer.close();
      if(transitionTimer){clearTimeout(transitionTimer);transitionTimer=null;}
      outlet.classList.remove('is-route-entering');
      if(callbacks&&callbacks.beforeRender)callbacks.beforeRender();
      outlet.replaceChildren();
      outlet.dataset.route=route;
      renderContent(outlet,route,payload,callbacks);
      if(UI.updateFeedStatus)UI.updateFeedStatus(outlet,payload,callbacks);
      previousRoute=route;previousPayload=payload;
      if(shouldAnimate&&!(doc.defaultView&&doc.defaultView.matchMedia&&doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches)){
        const schedule=doc.defaultView&&typeof doc.defaultView.requestAnimationFrame==='function' ? doc.defaultView.requestAnimationFrame.bind(doc.defaultView) : (callback)=>setTimeout(callback,0);
        schedule(()=>{
          if(!outlet||!outlet.isConnected)return;
          outlet.classList.add('is-route-entering');
          transitionTimer=setTimeout(()=>{if(outlet)outlet.classList.remove('is-route-entering');transitionTimer=null;},620);
        });
      }
    }
    function renderContent(target,route,payload,handlers){
      if(UI.renderPageTools)UI.renderPageTools(target,payload,handlers);
      if(route==='home')UI.renderHome(target,payload,handlers);
      else if(route==='history')UI.renderHistory(target,payload,handlers);
      else if(['search-all','search-video','search-user','search-bangumi','search-media'].includes(route))UI.renderSearch(target,payload,handlers);
      else if(route==='dynamic')UI.renderDynamic(target,payload,handlers);
      else if(route==='watchlater')UI.renderWatchLater(target,payload,handlers);
      else if(route==='favorites')UI.renderFavorites(target,payload,handlers);
      else if(route==='space-home'||route==='space-upload')UI.renderSpace(target,payload,handlers);
    }
    function updateTheme(theme){if(root)root.dataset.btTheme=theme;doc.documentElement.dataset.btTheme=theme;}
    function updateChrome(data){chromeData={...chromeData,...data};if(root)UI.updateChrome(root,chromeData,callbacks||{});if(drawer)UI.updateChrome(drawer.backdrop,chromeData,callbacks||{});}
    function setCollapsed(value){const side=root&&root.querySelector('[data-role="sidebar"]');if(side)side.classList.toggle('is-collapsed',Boolean(value));}
    function toggleSidebar(){
      if(root&&doc.defaultView&&doc.defaultView.matchMedia('(max-width:1120px)').matches){
        if(!drawer){drawer=UI.createSidebarDrawer(chromeData,callbacks||{});root.append(drawer.backdrop);}
        drawer.toggle();return true;
      }
      const side=root&&root.querySelector('[data-role="sidebar"]');if(side)side.classList.toggle('is-collapsed');return false;
    }
    function setLoading(){if(outlet)outlet.setAttribute('aria-busy','true');const target=outlet&&outlet.querySelector('[data-bt-feed]');if(target&&UI.setFeedStatus)UI.setFeedStatus(target,true,true);}
    function destroy(){if(transitionTimer){clearTimeout(transitionTimer);transitionTimer=null;}if(drawer)drawer.close();drawer=null;if(root)root.remove();root=null;outlet=null;previousRoute=null;previousPayload=null;}
    return { ensure, render, setLoading, updateTheme, updateChrome, setCollapsed, toggleSidebar, destroy, getRoot:()=>root };
  }
  return { createController };
});
