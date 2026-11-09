(function init(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubePlayerAmbient = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPlayerAmbientModule() {
  // A small frame, updated at most ten times a second, is sufficient behind
  // the heavily blurred background. The original video remains untouched.
  const FRAME_EDGE = 192;
  const FRAME_INTERVAL = 100;
  const MEDIA_EVENTS = ['loadedmetadata', 'loadeddata', 'playing', 'pause', 'seeked', 'emptied', 'waiting', 'ended', 'error', 'resize'];

  function createController(doc = document) {
    const view = doc.defaultView || globalThis;
    let host = null, video = null, perch = null, canvas = null, context = null;
    let mutationObserver = null, resizeObserver = null, frameTimer = null;
    let enabled = false, waiting = false, failed = false;

    function stopFrames() {
      if (frameTimer != null) view.clearTimeout(frameTimer);
      frameTimer = null;
    }

    function removeBackground() {
      stopFrames();
      if (perch) perch.classList.remove('bt-player-ambient-active');
      if (canvas) canvas.remove();
      canvas = null;
      context = null;
    }

    function hasVisibleBars() {
      if (!video || !perch || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return false;
      const outer = perch.getBoundingClientRect();
      const box = video.getBoundingClientRect();
      if (outer.width < 2 || outer.height < 2 || box.width < 2 || box.height < 2) return false;
      const fit = view.getComputedStyle(video).objectFit;
      const ratio = video.videoWidth / video.videoHeight;
      const innerGap = (fit === 'contain' || fit === 'scale-down') && Math.abs(box.width / box.height / ratio - 1) > 0.005;
      const outerGap = box.width < outer.width - 2 || box.height < outer.height - 2;
      return innerGap || outerGap;
    }

    function drawFrame() {
      frameTimer = null;
      if (!enabled || !video || !canvas || doc.hidden || failed || video.readyState < 2) return;
      try {
        const scale = Math.min(1, FRAME_EDGE / Math.max(video.videoWidth, video.videoHeight));
        const width = Math.max(1, Math.round(video.videoWidth * scale));
        const height = Math.max(1, Math.round(video.videoHeight * scale));
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        context.drawImage(video, 0, 0, width, height);
        perch.classList.add('bt-player-ambient-active');
      } catch {
        // Some protected or unavailable media cannot be drawn to a canvas.
        failed = true;
        removeBackground();
        return;
      }
      if (!video.paused && !video.ended && !waiting) frameTimer = view.setTimeout(drawFrame, FRAME_INTERVAL);
    }

    function update() {
      if (!enabled || !video || !perch || doc.hidden || failed || !hasVisibleBars()) {
        removeBackground();
        return;
      }
      if (canvas && canvas.parentElement !== perch) { canvas = null; context = null; }
      if (!canvas) {
        canvas = doc.createElement('canvas');
        canvas.className = 'bt-player-ambient';
        canvas.dataset.btOwned = 'true';
        canvas.setAttribute('aria-hidden', 'true');
        context = canvas.getContext('2d', { alpha: false });
        if (!context) { failed = true; removeBackground(); return; }
        perch.prepend(canvas);
      }
      stopFrames();
      drawFrame();
    }

    function watchPath(anchor, waitingForVideo) {
      if (!mutationObserver || !host) return;
      mutationObserver.disconnect();
      let node = anchor || host;
      if (waitingForVideo) mutationObserver.observe(node, { childList: true, subtree: true });
      else node = node.parentElement;
      while (node) {
        if (!(waitingForVideo && node === anchor)) mutationObserver.observe(node, { childList: true });
        if (node === host) break;
        node = node.parentElement;
      }
    }

    function refresh() {
      if (!enabled || !host || host.isConnected === false) { removeBackground(); return; }
      const nextPerch = host.querySelector('.bpx-player-video-perch');
      const nextVideo = nextPerch && nextPerch.querySelector('.bpx-player-video-wrap video');
      if (nextVideo !== video || nextPerch !== perch) {
        removeBackground();
        if (resizeObserver) resizeObserver.disconnect();
        video = nextVideo || null;
        perch = nextPerch || null;
        waiting = false;
        failed = false;
        if (resizeObserver && perch) resizeObserver.observe(perch);
        if (resizeObserver && video) resizeObserver.observe(video);
      }
      const anchor = video || perch || host.querySelector('.bpx-player-video-area') || host.querySelector('.bpx-player-container') || host;
      watchPath(anchor, !video);
      update();
    }

    function onMedia(event) {
      if (event.target !== video) { if (event.type === 'loadedmetadata' || event.type === 'loadeddata') refresh(); return; }
      if (event.type === 'emptied' || event.type === 'error') {
        failed = false;
        waiting = false;
        removeBackground();
        return;
      }
      if (event.type === 'waiting') waiting = true;
      if (event.type === 'playing' || event.type === 'loadeddata') { waiting = false; failed = false; }
      update();
    }

    function mount(nextHost, nextEnabled = true) {
      destroy();
      host = nextHost || null;
      enabled = Boolean(nextEnabled && host);
      if (!enabled) return;
      for (const event of MEDIA_EVENTS) host.addEventListener(event, onMedia, true);
      doc.addEventListener('visibilitychange', update);
      if (typeof view.MutationObserver === 'function') mutationObserver = new view.MutationObserver(refresh);
      if (typeof view.ResizeObserver === 'function') resizeObserver = new view.ResizeObserver(update);
      refresh();
    }

    function setEnabled(nextEnabled) {
      const nextHost = host;
      if (Boolean(nextEnabled) === enabled) return;
      mount(nextHost, nextEnabled);
    }

    function destroy() {
      removeBackground();
      if (host) for (const event of MEDIA_EVENTS) host.removeEventListener(event, onMedia, true);
      doc.removeEventListener('visibilitychange', update);
      if (mutationObserver) mutationObserver.disconnect();
      if (resizeObserver) resizeObserver.disconnect();
      mutationObserver = null; resizeObserver = null;
      host = null; video = null; perch = null; enabled = false; waiting = false; failed = false;
    }

    return { mount, setEnabled, refresh, destroy };
  }

  return { createController, FRAME_EDGE, FRAME_INTERVAL };
});
