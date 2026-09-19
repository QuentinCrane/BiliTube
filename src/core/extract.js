(function init(root, factory) {
  const data = root && root.BiliTubeData || (typeof require === 'function' ? require('./data.js') : null);
  const api = factory(data);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeExtract = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createExtract(Data) {
  const abs = Data && Data.absoluteUrl ? Data.absoluteUrl : (value) => String(value || '');
  function text(node) { return node ? String(node.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function imageSource(node) { return node ? (node.currentSrc || node.src || node.getAttribute('data-src') || node.getAttribute('data-lazy-src') || '') : ''; }
  function queryFirst(root, selectors) {
    for (const selector of selectors) {
      try { const found = root.querySelector(selector); if (found) return found; } catch {}
    }
    return null;
  }
  function findVideoAnchor(node) {
    if (!node) return null;
    if (node.matches && node.matches('a[href*="/video/BV"]')) return node;
    return queryFirst(node, ['a[href*="/video/BV"]']);
  }
  function extractSearchCards(doc = document) {
    const candidates = Array.from(doc.querySelectorAll([
      '.video-list-item', '.bili-video-card', '.video-item', '.search-page-video',
      '[class*="video-item"]', '[class*="video-card"]', '[class*="search-video"]'
    ].join(',')));
    if (!candidates.length) {
      for (const anchor of Array.from(doc.querySelectorAll('a[href*="/video/BV"]'))) {
        const card = anchor.closest('article, li, div');
        if (card) candidates.push(card);
      }
    }
    const seen = new Set();
    const result = [];
    for (const card of candidates) {
      const videoAnchor = findVideoAnchor(card);
      if (!videoAnchor) continue;
      const href = abs(videoAnchor.href || videoAnchor.getAttribute('href'));
      const bvidMatch = href.match(/\/video\/(BV[0-9A-Za-z]+)/);
      if (!bvidMatch || seen.has(bvidMatch[1])) continue;
      const titleNode = queryFirst(card, ['h3','[title]','.title','.bili-video-card__info--tit','[class*="title"]']);
      const title = (titleNode && (titleNode.getAttribute('title') || text(titleNode))) || videoAnchor.getAttribute('title') || text(videoAnchor);
      if (!title) continue;
      const authorAnchor = queryFirst(card, ['a[href*="space.bilibili.com"]']);
      const image = queryFirst(card, ['img']);
      const metaNode = queryFirst(card, ['.so-icon.watch-num','.bili-video-card__stats--item','[class*="meta"]','[class*="stat"]']);
      const durationNode = queryFirst(card, ['.duration','.bili-video-card__stats__duration','[class*="duration"]']);
      const avatar = authorAnchor && queryFirst(authorAnchor, ['img']);
      const normalized = Data.normalizeSearchItem({
        bvid: bvidMatch[1], href, title,
        thumbnail: imageSource(image), duration: text(durationNode),
        author: text(authorAnchor), authorHref: authorAnchor && (authorAnchor.href || authorAnchor.getAttribute('href')),
        avatar: imageSource(avatar), meta: text(metaNode),
      });
      if (!normalized) continue;
      seen.add(bvidMatch[1]); result.push(normalized);
      if (result.length >= 60) break;
    }
    return result;
  }
  function extractCategories(doc = document) {
    const result = [];
    const seen = new Set();
    for (const anchor of Array.from(doc.querySelectorAll('a[href]'))) {
      const label = text(anchor);
      if (!label || label.length > 12 || seen.has(label)) continue;
      const href = abs(anchor.href || anchor.getAttribute('href'));
      if (!/^https:\/\/(?:www\.)?bilibili\.com\/(?:v\/|c\/|anime|guochuang|movie|documentary|tv|variety|dance|music|game|knowledge|tech|digital|life|food|car|sports|fashion)/.test(href)) continue;
      seen.add(label); result.push({ label, href });
      if (result.length >= 16) break;
    }
    return result;
  }
  function extractWatch(doc = document, bridgeVideo = null) {
    const titleNode = queryFirst(doc, ['h1.video-title','h1[title]','.video-title h1','h1']);
    const creatorAnchor = queryFirst(doc, ['.up-name a','a.up-name','a[href*="space.bilibili.com"][class*="name"]','.up-info-container a[href*="space.bilibili.com"]']);
    const avatar = queryFirst(doc, ['.up-avatar img','.up-info-container img','a[href*="space.bilibili.com"] img']);
    const descNode = queryFirst(doc, ['.desc-info-text','.video-desc-container','.basic-desc-info','[class*="desc-info"]']);
    const statNode = queryFirst(doc, ['.view-text','.video-info-detail','.video-data','[class*="video-info"]']);
    const owner = bridgeVideo && bridgeVideo.owner || {};
    const stat = bridgeVideo && bridgeVideo.stat || {};
    const actionNode = (selectors) => queryFirst(doc, selectors);
    const actionText = (selectors) => text(queryFirst(doc, selectors));
    const actionActive = (node) => {
      if (!node) return false;
      const cls = String(node.className || '');
      const pressed = node.getAttribute && node.getAttribute('aria-pressed');
      return pressed === 'true' || /(?:^|\s)(?:on|active|liked|selected|is-active)(?:\s|$)/i.test(cls);
    };
    const likeNode = actionNode(['.video-toolbar-container .video-like','.video-toolbar .like','.video-toolbar-v1 .like','.toolbar .like']);
    const coinNode = actionNode(['.video-toolbar-container .video-coin','.video-toolbar .coin','.video-toolbar-v1 .coin','.toolbar .coin']);
    const favoriteNode = actionNode(['.video-toolbar-container .video-fav','.video-toolbar .collect','.video-toolbar-v1 .collect','.toolbar .collect']);
    const shareNode = actionNode(['.video-toolbar-container .video-share','.video-toolbar .share','.video-toolbar-v1 .share','.toolbar .share']);
    const likeCount = actionText(['.video-toolbar-container .video-like-info','.video-like-info']);
    const coinCount = actionText(['.video-toolbar-container .video-coin-info','.video-coin-info']);
    const favoriteCount = actionText(['.video-toolbar-container .video-fav-info','.video-fav-info']);
    const shareCount = actionText(['.video-toolbar-container .video-share-info-text','.video-toolbar-container .video-share-info','.video-share-info-text','.video-share-info']);
    const creatorHref = creatorAnchor ? abs(creatorAnchor.href || creatorAnchor.getAttribute('href')) : (owner.mid ? `https://space.bilibili.com/${owner.mid}` : '');
    const followNode = actionNode(['.up-info-container .follow-btn','.upinfo-btn-panel .follow-btn','.up-panel-container .follow-btn','.bili-follow-btn','button[class*="follow"]']);
    const followText = text(followNode);
    const following = Boolean(followNode && (/following|followed|is-follow|following-btn/i.test(String(followNode.className || '')) || /已关注|取消关注/.test(followText)));
    return {
      title: bridgeVideo && bridgeVideo.title || (titleNode && (titleNode.getAttribute('title') || text(titleNode))) || document.title.replace(/_哔哩哔哩.*$/,'').trim(),
      description: bridgeVideo && bridgeVideo.desc || text(descNode),
      meta: stat.view ? `${Data.compactNumber(stat.view)}播放` : text(statNode),
      creator: {
        name: owner.name || text(creatorAnchor) || 'UP主',
        href: creatorHref,
        avatar: owner.face || imageSource(avatar),
        following,
      },
      actions: {
        like: { count: likeCount || (stat.like ? Data.compactNumber(stat.like) : ''), active: actionActive(likeNode) },
        coin: { count: coinCount || (stat.coin ? Data.compactNumber(stat.coin) : ''), active: actionActive(coinNode) },
        favorite: { count: favoriteCount || (stat.favorite ? Data.compactNumber(stat.favorite) : ''), active: actionActive(favoriteNode) },
        share: { count: shareCount || (stat.share ? Data.compactNumber(stat.share) : ''), active: actionActive(shareNode) },
      },
    };
  }
  function findPlayer(doc = document) {
    return queryFirst(doc, ['#bilibili-player','.bpx-player-container','#bilibili-player-wrap','.bilibili-player']);
  }
  function extractCurrentUser(doc = document) {
    const avatar = queryFirst(doc, ['.header-avatar-wrap img','.bili-avatar-img','.header-entry-mini img']);
    const link = avatar && avatar.closest('a[href*="space.bilibili.com"]');
    const mid = link && String(link.href).match(/space\.bilibili\.com\/(\d+)/);
    return { mid: mid ? mid[1] : '', name: avatar && (avatar.alt || avatar.title) || '', face: imageSource(avatar) };
  }
  return { extractSearchCards, extractCategories, extractWatch, findPlayer, extractCurrentUser };
});
