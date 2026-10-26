(function init(root, factory) {
  const model = root && root.BiliTubePreviewModel || (typeof require === 'function' ? require('./preview-model.js') : null);
  const api = factory(model);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubePreview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPreviewModule(Model) {
  const T = (key, fallback, substitutions) => {
    const i18n = typeof globalThis !== 'undefined' && globalThis.BiliTubeI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback, substitutions) : fallback;
  };
  function createController(options = {}) {
    const requestMedia = options.requestMedia || (() => {});
    const getDelay = options.getDelay || (() => 500);
    const shouldRetain = options.shouldRetain || (() => false);
    const cached = new Map();
    let active = null;
    const offscreen = new WeakSet();
    const bindings = new Map();
    const trackPointer=event=>{if(active)active.point={x:event.clientX,y:event.clientY};};
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) offscreen.delete(entry.target);
        else {
          offscreen.add(entry.target);
          if (active && active.card === entry.target && !shouldRetain()) cleanupActive();
        }
      }
    }, { rootMargin: '240px 0px' }) : null;

    function cleanupActive() {
      if (!active) return;
      if(typeof document!=='undefined')document.removeEventListener('pointermove',trackPointer,true);
      if (active.timer) clearTimeout(active.timer);
      if (active.leaveTimer) clearTimeout(active.leaveTimer);
      if (active.video) {
        try { active.video.pause(); } catch {}
        active.video.removeAttribute('src');
        try { active.video.load(); } catch {}
      }
      if (active.layer && active.layer.remove) active.layer.remove();
      if (active.host && active.host.classList) active.host.classList.remove('bt-preview-active');
      active = null;
    }

    function mountMedia(session, url) {
      if (!session || active !== session || !url) return;
      const layer = document.createElement('div');
      layer.className = 'bt-preview-layer';
      const video = document.createElement('video');
      video.className = 'bt-preview-video';
      video.muted = true; video.autoplay = true; video.loop = true; video.playsInline = true; video.preload = 'metadata';

      const progress = document.createElement('div');
      progress.className = 'bt-preview-progress';
      progress.setAttribute('role', 'slider');
      progress.setAttribute('aria-label', T('preview_progress','预览进度'));
      progress.setAttribute('aria-valuemin', '0');
      progress.setAttribute('aria-valuemax', '100');
      progress.setAttribute('aria-valuenow', '0');
      const rail = document.createElement('div'); rail.className = 'bt-preview-progress-rail';
      const fill = document.createElement('div'); fill.className = 'bt-preview-progress-fill';
      const thumb = document.createElement('div'); thumb.className = 'bt-preview-progress-thumb';
      rail.append(fill, thumb); progress.append(rail); layer.append(video, progress);

      session.host.append(layer);
      session.layer = layer; session.video = video;
      session.host.classList.add('bt-preview-active');
      let dragging = false;

      function sync() {
        if (!Number.isFinite(video.duration) || video.duration <= 0) return;
        const ratio = Math.max(0, Math.min(1, video.currentTime / video.duration));
        const pct = ratio * 100;
        fill.style.width = `${pct}%`;
        thumb.style.left = `${pct}%`;
        progress.setAttribute('aria-valuenow', String(Math.round(pct)));
      }
      function seekFromPointer(event) {
        if (!Number.isFinite(video.duration) || video.duration <= 0) return;
        const rect = progress.getBoundingClientRect();
        if (!rect.width) return;
        const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        video.currentTime = ratio * video.duration;
        sync();
      }
      progress.addEventListener('pointerdown', (event) => {
        event.preventDefault(); event.stopPropagation(); dragging = true;
        try { progress.setPointerCapture(event.pointerId); } catch {}
        seekFromPointer(event);
      });
      progress.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        event.preventDefault(); event.stopPropagation(); seekFromPointer(event);
      });
      const endDrag = (event) => {
        if (!dragging) return;
        dragging = false; event.preventDefault(); event.stopPropagation();
        try { progress.releasePointerCapture(event.pointerId); } catch {}
      };
      progress.addEventListener('pointerup', endDrag);
      progress.addEventListener('pointercancel', endDrag);
      progress.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); });
      video.addEventListener('timeupdate', sync);
      video.addEventListener('loadedmetadata', sync);
      const fail = () => { if (active === session) cleanupActive(); };
      video.addEventListener('error', fail, { once: true });
      video.src = url;
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(fail);
    }

    function begin(id, host, card, event) {
      if(active&&active.card===card){if(active.leaveTimer){clearTimeout(active.leaveTimer);active.leaveTimer=null;}return;}
      cleanupActive();
      const session = { id, host, card, timer: null, leaveTimer: null, layer: null, video: null };
      if(event&&Number.isFinite(event.clientX))session.point={x:event.clientX,y:event.clientY};
      active = session;
      if(typeof document!=='undefined')document.addEventListener('pointermove',trackPointer,{capture:true,passive:true});
      session.timer = setTimeout(() => {
        session.timer = null;
        if (active !== session) return;
        const known = cached.get(id);
        if (known && known.expiresAt > Date.now()) { cached.delete(id); cached.set(id,known); mountMedia(session, known.url); }
        else requestMedia(id);
      }, Math.max(0, Math.min(2000, Number(getDelay()) || 500)));
    }

    function bind(card, item, host) {
      if (!card || !item || !item.bvid || !host) return () => {};
      if(active&&active.card===card&&active.host!==host)cleanupActive();
      if (bindings.has(card)) bindings.get(card)();
      const id = String(item.bvid);
      if (observer) observer.observe(card);
      const enter = (event) => {
        if (active && active.card === card && active.leaveTimer) { clearTimeout(active.leaveTimer); active.leaveTimer = null; return; }
        if (!offscreen.has(card)) begin(id, host, card, event);
      };
      const leave = () => {
        if (!active || active.card !== card) return;
        if(shouldRetain())return;
        if (active.leaveTimer) clearTimeout(active.leaveTimer);
        active.leaveTimer = setTimeout(() => { if (active && active.card === card && !shouldRetain()) cleanupActive(); }, 120);
      };
      const focusout = (event) => { if (!card.contains(event.relatedTarget)) leave(); };
      card.addEventListener('pointerenter', enter);
      card.addEventListener('pointerleave', leave);
      card.addEventListener('focusout', focusout);
      let bound = true;
      const unbind = () => {
        if (!bound) return;
        bound = false;
        card.removeEventListener('pointerenter', enter);
        card.removeEventListener('pointerleave', leave);
        card.removeEventListener('focusout', focusout);
        if (observer) observer.unobserve(card);
        offscreen.delete(card);
        bindings.delete(card);
        leave();
      };
      bindings.set(card, unbind);
      return unbind;
    }

    function resolve(id, url) {
      if (url) {
        cached.delete(String(id));cached.set(String(id), {url,expiresAt:Date.now()+120000});
        while(cached.size>64)cached.delete(cached.keys().next().value);
      }
      if (active && active.id === String(id) && !active.timer && !active.video && url) mountMedia(active, url);
    }

    function destroy() {
      cleanupActive();
      for (const unbind of bindings.values()) unbind();
      if (observer) observer.disconnect();
    }

    function prune(){for(const [card,unbind] of bindings)if(!card.isConnected){if(active&&active.card===card)cleanupActive();unbind();}}
    function resume(){
      if(!active||shouldRetain()||typeof active.card.matches!=='function')return;
      const rect=active.point&&active.card.getBoundingClientRect();
      const inside=rect&&active.point.x>=rect.left&&active.point.x<=rect.right&&active.point.y>=rect.top&&active.point.y<=rect.bottom;
      if(!inside&&!active.card.matches(':hover')&&!active.card.contains(document.activeElement))cleanupActive();
    }

    return { bind, resolve, destroy, prune, resume, seekTime: Model && Model.seekTime };
  }
  return { createController };
});
