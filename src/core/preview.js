(function init(root, factory) {
  const model = root && root.BiliTubePreviewModel || (typeof require === 'function' ? require('./preview-model.js') : null);
  const api = factory(model);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubePreview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPreviewModule(Model) {
  function createController(options = {}) {
    const requestMedia = options.requestMedia || (() => {});
    const getDelay = options.getDelay || (() => 500);
    const cached = new Map();
    let active = null;
    const offscreen = new WeakSet();
    const bindings = new Map();
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) offscreen.delete(entry.target);
        else {
          offscreen.add(entry.target);
          if (active && active.card === entry.target) cleanupActive();
        }
      }
    }, { rootMargin: '240px 0px' }) : null;

    function cleanupActive() {
      if (!active) return;
      if (active.timer) clearTimeout(active.timer);
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
      progress.setAttribute('aria-label', '预览进度');
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

    function begin(id, host, card) {
      cleanupActive();
      const session = { id, host, card, timer: null, layer: null, video: null };
      active = session;
      session.timer = setTimeout(() => {
        session.timer = null;
        if (active !== session) return;
        const known = cached.get(id);
        if (known) mountMedia(session, known);
        else requestMedia(id);
      }, Math.max(0, Math.min(2000, Number(getDelay()) || 500)));
    }

    function bind(card, item, host) {
      if (!card || !item || !item.bvid || !host) return () => {};
      if (bindings.has(card)) bindings.get(card)();
      const id = String(item.bvid);
      if (observer) observer.observe(card);
      const enter = () => { if (!offscreen.has(card)) begin(id, host, card); };
      const leave = () => { if (active && active.card === card) cleanupActive(); };
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
      if (url) cached.set(String(id), url);
      if (active && active.id === String(id) && !active.timer && !active.video && url) mountMedia(active, url);
    }

    function destroy() {
      cleanupActive();
      for (const unbind of bindings.values()) unbind();
      if (observer) observer.disconnect();
    }

    return { bind, resolve, destroy, seekTime: Model && Model.seekTime };
  }
  return { createController };
});
