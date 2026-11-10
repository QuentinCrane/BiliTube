(function init(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeMotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMotion() {
  // Visual-only coordination layer. It never owns data, routing or media: the
  // shell decides *whether* a render happens, this module only softens how the
  // already-committed DOM change looks. Every entry point is allowed to bail.
  const LIMITS = {
    maxVisibleCards: 24, // measured cards per flip; more means a jump is safer
    maxNewCards: 8, // fade-in budget for freshly inserted cards
    minDistance: 0.5, // px; ignore sub-pixel settling
    duration: 320,
    durationSubtle: 180,
    enterDuration: 280,
    enterRise: 12,
  };
  const EASING = 'cubic-bezier(.16,1,.3,1)';
  const REASONS = new Set(['reconcile', 'append', 'route']);

  function shouldAnimate(input = {}) {
    const strategy = input.strategy || 'replace';
    if (strategy !== 'replace') return false; // decorate/adapt/passthrough stay native
    if (input.motionMode === 'none') return false;
    if (input.reducedMotion) return false;
    if (input.reason && !REASONS.has(input.reason)) return false;
    if (input.previewActive) return false; // never fly a card that is playing media
    const visible = Number(input.visibleCardCount);
    if (Number.isFinite(visible) && visible > LIMITS.maxVisibleCards) return false;
    return true;
  }

  function createController(doc = typeof document !== 'undefined' ? document : null, options = {}) {
    const win = doc && (doc.defaultView || doc.parentWindow) || (typeof window !== 'undefined' ? window : null);
    const previewActive = typeof options.previewActive === 'function' ? options.previewActive : () => false;
    const shouldMeasure = typeof options.shouldMeasure === 'function' ? options.shouldMeasure : () => true;
    const limits = { ...LIMITS, ...(options.limits || {}) };
    const running = new Map(); // element -> Animation
    let version = 0;

    function motionMode() {
      const value = doc && doc.documentElement && doc.documentElement.dataset
        ? doc.documentElement.dataset.btMotion
        : '';
      return value === 'subtle' || value === 'none' ? value : 'full';
    }
    function reducedMotion() {
      return Boolean(win && typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    function viewportHeight() {
      return Number(win && (win.innerHeight || doc && doc.documentElement && doc.documentElement.clientHeight)) || 900;
    }
    function themeRevealActive() {
      return Boolean(doc && doc.documentElement && doc.documentElement.classList.contains('bt-theme-reveal'));
    }
    // Public contract: the shell and tests read the same decision the coordinator uses.
    function allowed(reason, extra = {}) {
      if (doc && doc.hidden) return false;
      if (themeRevealActive()) return false; // root View Transition owns the frame
      return shouldAnimate({
        strategy: extra.strategy || 'replace',
        reason,
        motionMode: motionMode(),
        reducedMotion: reducedMotion(),
        previewActive: extra.previewActive === undefined ? previewActive() : extra.previewActive,
        visibleCardCount: extra.visibleCardCount,
      });
    }

    function stop(node) {
      const animation = running.get(node);
      if (!animation) return;
      running.delete(node);
      try { animation.cancel(); } catch {}
    }
    function cancelAnimations() {
      for (const [node, animation] of running) {
        running.delete(node);
        try { animation.cancel(); } catch {}
      }
    }
    function cancel() {
      version += 1; // invalidates any handle measured before this point
      cancelAnimations();
    }
    function track(node, animation) {
      if (!animation) return;
      running.set(node, animation);
      const done = () => { if (running.get(node) === animation) running.delete(node); };
      Promise.resolve(animation.finished).then(done, done);
    }
    function canAnimateNode(node) {
      return Boolean(node && node.isConnected && typeof node.animate === 'function');
    }

    // Snapshot visible, keyed cards before a same-route reconcile. Returns null
    // whenever the frame is not worth animating, so callers can skip the work.
    function measure(container) {
      if (!container || !allowed('reconcile')) return null;
      cancelAnimations(); // never stack two flips on the same nodes
      const id = ++version;
      const height = viewportHeight();
      const cards = [];
      const nodes = new Set();
      for (const node of container.querySelectorAll('article')) {
        if (!node.__btCardKey || !shouldMeasure(node)) continue;
        const rect = node.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        if (rect.bottom <= 0 || rect.top >= height) continue;
        cards.push({ node, rect: { left: rect.left, top: rect.top } });
        nodes.add(node);
        if (cards.length > limits.maxVisibleCards) return null;
      }
      if (!cards.length) return null;
      return { version: id, cards, nodes };
    }

    function play(handle) {
      if (!handle || handle.version !== version) return 0;
      if (!allowed('reconcile', { visibleCardCount: handle.cards.length })) return 0;
      const duration = motionMode() === 'subtle' ? limits.durationSubtle : limits.duration;
      // A reorder can cross the whole grid; only movement that leaves the
      // viewport reads as a layout jump instead of a reorder.
      const maxShiftX = Math.max(1200, Number(win && win.innerWidth) || 1600);
      const maxShiftY = Math.max(900, viewportHeight() * 1.4);
      let count = 0;
      for (const entry of handle.cards) {
        const node = entry.node;
        if (!canAnimateNode(node)) continue;
        const rect = node.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        const dx = entry.rect.left - rect.left;
        const dy = entry.rect.top - rect.top;
        if (Math.abs(dx) < limits.minDistance && Math.abs(dy) < limits.minDistance) continue;
        if (Math.abs(dx) > maxShiftX || Math.abs(dy) > maxShiftY) continue;
        stop(node);
        // additive transform keeps any hover CSS transform the card already owns
        track(node, node.animate(
          [{ transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)` }, { transform: 'translate(0px, 0px)' }],
          { duration, easing: EASING, composite: 'add', fill: 'none' }
        ));
        count += 1;
      }
      return count;
    }

    // The append renderer supplies the new cards directly, so long feeds do
    // not need a full before/after scan to decide which cards may animate.
    function enterNew(cards) {
      if (!cards || !allowed('append')) return 0;
      const height = viewportHeight();
      const duration = motionMode() === 'subtle' ? limits.durationSubtle : limits.enterDuration;
      let count = 0;
      for (const node of cards) {
        if (count >= limits.maxNewCards) break;
        if (!canAnimateNode(node)) continue;
        const rect = node.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        if (rect.top > height + 200) continue; // below the fold: skip the paint
        stop(node);
        track(node, node.animate(
          [
            { opacity: 0, transform: `translateY(${limits.enterRise}px) scale(.985)` },
            { opacity: 1, transform: 'translateY(-1px) scale(1.002)', offset: .72 },
            { opacity: 1, transform: 'translateY(0px) scale(1)' },
          ],
          { duration, easing: EASING, fill: 'none' }
        ));
        count += 1;
      }
      return count;
    }

    function prepare() {
      // Called just before a mutation: a card that is still flying would keep a
      // composited transform while its subtree is rewritten.
      if (running.size) cancelAnimations();
    }
    function isActive() { return running.size > 0; }
    function destroy() { cancel(); running.clear(); }

    return { shouldAnimate, allowed, measure, play, enterNew, prepare, cancel, isActive, destroy, motionMode, reducedMotion };
  }

  return { LIMITS, EASING, shouldAnimate, createController };
});
