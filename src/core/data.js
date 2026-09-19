(function init(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createData() {
  function absoluteUrl(value, base = 'https://www.bilibili.com/') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('//')) return `https:${raw}`;
    try {
      const url = new URL(raw, base);
      if (url.protocol === 'http:' && /(?:^|\.)?(?:hdslb\.com|bilivideo\.com)$/i.test(url.hostname)) url.protocol = 'https:';
      return url.href;
    } catch { return raw; }
  }
  function mediaUrl(value) {
    const url = absoluteUrl(value);
    return url.replace(/^http:(?=\/\/[^/]*(?:hdslb\.com|bilivideo\.com))/i, 'https:');
  }
  function compactNumber(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '';
    if (n >= 100000000) return `${(n / 100000000).toFixed(n >= 1000000000 ? 0 : 1).replace(/\.0$/, '')}亿`;
    if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '')}万`;
    return String(Math.round(n));
  }
  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    if (!total) return '';
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }
  function timestampSeconds(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.floor(n > 1e12 ? n / 1000 : n);
  }
  function formatRelativeTime(value, nowSeconds = Math.floor(Date.now() / 1000)) {
    const ts = timestampSeconds(value);
    const now = timestampSeconds(nowSeconds) || Math.floor(Date.now() / 1000);
    if (!ts) return '';
    const diff = Math.max(0, now - ts);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}分钟前`;
    if (diff < 86400) return `${Math.max(1, Math.floor(diff / 3600))}小时前`;
    if (diff < 30 * 86400) return `${Math.max(1, Math.floor(diff / 86400))}天前`;
    if (diff < 365 * 86400) return `${Math.max(1, Math.floor(diff / (30 * 86400)))}个月前`;
    return `${Math.max(1, Math.floor(diff / (365 * 86400)))}年前`;
  }
  function stripHtml(value) {
    return String(value || '')
      .replace(/<em\b[^>]*>/gi, '')
      .replace(/<\/em>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ').trim();
  }
  function homeCategoryKey(value, tid = 0) {
    const label = String(value || '').trim().toLowerCase();
    if (/直播|live/.test(label)) return 'live';
    if (/番剧|动画|anime|bangumi/.test(label)) return 'anime';
    if (/知识|knowledge/.test(label)) return 'knowledge';
    if (/科技|数码|tech|digital/.test(label)) return 'tech';
    if (/游戏|game/.test(label)) return 'game';
    if (/音乐|music/.test(label)) return 'music';
    if (/影视|电影|电视剧|纪录片|综艺|cine|film|movie|tv|documentary|variety/.test(label)) return 'film';
    const numericTid = Number(tid || 0);
    if (numericTid === 1) return 'anime';
    if (numericTid === 3) return 'music';
    if (numericTid === 4) return 'game';
    if (numericTid === 36) return 'knowledge';
    if (numericTid === 155 || numericTid === 160 || numericTid === 165 || numericTid === 211) return '';
    if (numericTid === 177 || numericTid === 181 || numericTid === 182 || numericTid === 183) return 'film';
    if (numericTid === 188 || numericTid === 95) return 'tech';
    return '';
  }
  function normalizeAccount(payload) {
    const data = payload && payload.code === 0 && payload.data ? payload.data : null;
    if (!data) return null;
    const mid = data.mid ? String(data.mid) : '';
    return {
      mid,
      name: String(data.uname || data.name || '').trim(),
      face: mediaUrl(data.face || data.avatar || ''),
      isLogin: Boolean(data.isLogin && mid),
    };
  }
  function normalizeHome(payload, nowSeconds = Math.floor(Date.now() / 1000)) {
    const items = payload && payload.code === 0 && payload.data && Array.isArray(payload.data.item) ? payload.data.item : [];
    return items.map((raw) => {
      const item = raw && raw.business_info && raw.business_info.archive ? raw.business_info.archive : raw;
      const owner = item && item.owner || {};
      const bvid = String(item && item.bvid || '').trim();
      const title = String(item && item.title || '').trim();
      if (!bvid || !title) return null;
      const category = String(item && (item.tname || item.type_name || item.category || item.category_name) || raw && (raw.tname || raw.type_name || raw.category || raw.category_name) || '').trim();
      const categoryKey = homeCategoryKey(category, item && (item.tid || item.type_id) || raw && (raw.tid || raw.type_id));
      const publishedAt = timestampSeconds(item.pubdate || item.ctime || raw && (raw.pubdate || raw.ctime));
      const viewText = item.stat && item.stat.view != null ? `${compactNumber(item.stat.view)}播放` : '';
      const publishedText = formatRelativeTime(publishedAt, nowSeconds);
      return {
        kind: 'video', bvid, title, category, categoryKey,
        href: `https://www.bilibili.com/video/${bvid}`,
        thumbnail: mediaUrl(item.pic),
        duration: formatDuration(item.duration || item.duraion),
        author: String(owner.name || '').trim(),
        authorMid: owner.mid ? String(owner.mid) : '',
        authorHref: owner.mid ? `https://space.bilibili.com/${owner.mid}` : '',
        avatar: mediaUrl(owner.face),
        publishedAt,
        meta: [viewText, publishedText].filter(Boolean).join(' · '),
      };
    }).filter(Boolean);
  }
  function normalizeHomeCategory(payload, categoryKey = '', nowSeconds = Math.floor(Date.now() / 1000)) {
    const list = payload && payload.code === 0 && payload.data
      ? (Array.isArray(payload.data.list) ? payload.data.list : Array.isArray(payload.data.item) ? payload.data.item : [])
      : [];
    return normalizeHome({ code:0, data:{ item:list } }, nowSeconds).map(item => ({ ...item, categoryKey:String(categoryKey || item.categoryKey || '') }));
  }
  function normalizeHistory(payload) {
    const items = payload && payload.code === 0 && payload.data && Array.isArray(payload.data.list) ? payload.data.list : [];
    return items.map((item) => {
      const h = item && item.history || {};
      let href = '';
      if (h.business === 'archive' && h.bvid) href = `https://www.bilibili.com/video/${h.bvid}${Number(h.page || 0) > 1 ? `?p=${Number(h.page)}` : ''}`;
      else if (h.business === 'pgc' && h.epid) href = `https://www.bilibili.com/bangumi/play/ep${h.epid}`;
      else if (h.business === 'live' && h.oid) href = `https://live.bilibili.com/${h.oid}`;
      else href = absoluteUrl(item && item.uri);
      if (!item || !item.title || !href) return null;
      const durationSeconds = Math.max(0, Number(item.duration || 0));
      const rawProgress = Number(item.progress || 0);
      const progressSeconds = rawProgress < 0 ? durationSeconds : Math.max(0, rawProgress);
      const progress = durationSeconds > 0 ? Math.max(0, Math.min(1, progressSeconds / durationSeconds)) : 0;
      const progressText = durationSeconds > 0 ? `已观看 ${Math.round(progress * 100)}%` : (progressSeconds ? `已观看 ${formatDuration(progressSeconds)}` : '已观看');
      return {
        kind: h.business === 'live' ? 'live' : h.business === 'pgc' ? 'bangumi' : 'video',
        bvid: String(h.bvid || ''), title: String(item.title), href,
        thumbnail: mediaUrl(item.cover || (Array.isArray(item.covers) ? item.covers[0] : '')),
        duration: formatDuration(durationSeconds),
        author: String(item.author_name || ''),
        authorHref: item.author_mid ? `https://space.bilibili.com/${item.author_mid}` : '',
        meta: [String(h.part || '').trim(), progressText].filter(Boolean).join(' · '),
        progress, progressSeconds, viewedAt: Number(item.view_at || 0),
      };
    }).filter(Boolean);
  }
  function normalizeSpaceProfile(payload, mid) {
    if (!payload || payload.code !== 0 || !payload.data) return null;
    const data = payload.data;
    const card = data.card || {};
    const resolvedMid = String(card.mid || mid || '').replace(/\D/g, '');
    const name = String(card.name || '').trim();
    if (!resolvedMid || !name) return null;
    const fans = Number(data.follower != null ? data.follower : card.fans || 0);
    const attention = Number(card.attention || 0);
    const archiveCount = Number(card.archive_count || card.video || 0);
    return {
      mid: resolvedMid, name,
      avatar: mediaUrl(card.face),
      banner: mediaUrl(data.space && (data.space.l_img || data.space.s_img)),
      sign: String(card.sign || '').trim(),
      fans, attention, archiveCount,
      stats: [fans ? `${compactNumber(fans)} 粉丝` : '', attention ? `${compactNumber(attention)} 关注` : '', archiveCount ? `${compactNumber(archiveCount)} 投稿` : ''].filter(Boolean).join(' · '),
      following: Boolean(data.following),
      href: `https://space.bilibili.com/${resolvedMid}`,
    };
  }
  function normalizeSpaceArchives(payload, mid, profile = {}, nowSeconds = Math.floor(Date.now() / 1000)) {
    const list = payload && payload.code === 0 && payload.data && payload.data.list && Array.isArray(payload.data.list.vlist) ? payload.data.list.vlist : [];
    const resolvedMid = String(mid || profile.mid || '').replace(/\D/g, '');
    return list.map((item) => {
      const bvid = String(item && item.bvid || '').trim();
      const title = String(item && item.title || '').trim();
      if (!bvid || !title) return null;
      return {
        kind: 'video', bvid, title,
        href: `https://www.bilibili.com/video/${bvid}`,
        thumbnail: mediaUrl(item.pic), duration: String(item.length || item.duration || ''),
        author: String(profile.name || ''), avatar: mediaUrl(profile.avatar),
        authorHref: resolvedMid ? `https://space.bilibili.com/${resolvedMid}` : '',
        publishedAt: Number(item.created || 0),
        meta: [item.play != null ? `${compactNumber(item.play)}播放` : '', formatRelativeTime(item.created, nowSeconds)].filter(Boolean).join(' · '),
      };
    }).filter(Boolean);
  }
  function normalizeSubscriptions(payload) {
    const items = payload && payload.code === 0 && payload.data && Array.isArray(payload.data.items) ? payload.data.items : [];
    const seen = new Set();
    const output = [];
    for (const item of items) {
      const author = item && item.author || {};
      const mid = String(author.mid || '').trim();
      if (!mid || seen.has(mid)) continue;
      seen.add(mid);
      output.push({
        mid, name: String(author.name || '').trim(), avatar: mediaUrl(author.face),
        href: `https://space.bilibili.com/${mid}`,
        live: Boolean(Number(author.live_status || item.live_status || 0) > 0),
        unread: Boolean(item.has_update || item.is_new || author.has_update),
      });
      if (output.length >= 12) break;
    }
    return output;
  }

  function normalizeDynamic(payload, nowSeconds = Math.floor(Date.now() / 1000)) {
    const items = payload && payload.code === 0 && payload.data && Array.isArray(payload.data.items) ? payload.data.items : [];
    return items.map((item) => {
      const modules = item && item.modules || {};
      const author = modules.module_author || {};
      const dynamic = modules.module_dynamic || {};
      const major = dynamic.major || {};
      const archive = major.archive || null;
      const draw = major.draw || null;
      const opus = major.opus || null;
      const mid = String(author.mid || '').trim();
      const publishedAt = timestampSeconds(author.pub_ts || author.pub_time_ts || item && item.pub_ts);
      const publishedText = String(author.pub_time || '').trim() || formatRelativeTime(publishedAt, nowSeconds);
      const output = {
        id: String(item && (item.id_str || item.id) || ''),
        type: String(item && item.type || ''),
        author: String(author.name || '').trim(),
        avatar: mediaUrl(author.face),
        authorHref: mid ? `https://space.bilibili.com/${mid}` : '',
        time: publishedText,
        publishedAt,
        text: String(dynamic.desc && dynamic.desc.text || opus && opus.summary && opus.summary.text || '').trim(),
        images: [],
        video: null,
      };
      if (draw && Array.isArray(draw.items)) output.images = draw.items.map(x => mediaUrl(x && x.src)).filter(Boolean);
      if (opus && Array.isArray(opus.pics) && !output.images.length) output.images = opus.pics.map(x => mediaUrl(x && (x.url || x.src))).filter(Boolean);
      if (archive && archive.bvid && archive.title) {
        output.video = {
          kind: 'video', bvid: String(archive.bvid), title: String(archive.title),
          href: `https://www.bilibili.com/video/${archive.bvid}`,
          thumbnail: mediaUrl(archive.cover), duration: formatDuration(archive.duration),
          author: output.author, avatar: output.avatar, authorHref: output.authorHref,
          publishedAt,
          meta: [String(archive.stat && (archive.stat.play || archive.stat.view) || '').trim(), publishedText].filter(Boolean).map((value,index)=>index===0&&!/播放$/.test(value)?`${value}播放`:value).join(' · '),
        };
      }
      return output.author || output.text || output.images.length || output.video ? output : null;
    }).filter(Boolean);
  }
  function normalizeDynamicSubscriptions(items) {
    const output = [];
    const seen = new Set();
    for (const item of Array.isArray(items) ? items : []) {
      const href = String(item && item.authorHref || '').trim();
      const mid = (href.match(/space\.bilibili\.com\/(\d+)/) || [,''])[1];
      const key = mid || href;
      if (!key || seen.has(key) || !item.author) continue;
      seen.add(key);
      output.push({
        mid, name:String(item.author || '').trim(), avatar:mediaUrl(item.avatar || ''),
        href, live:false, unread:false,
      });
      if (output.length >= 12) break;
    }
    return output;
  }
  function normalizeWatchLater(payload, nowSeconds = Math.floor(Date.now() / 1000)) {
    const items = payload && payload.code === 0 && payload.data && Array.isArray(payload.data.list) ? payload.data.list : [];
    return items.map((item) => {
      const owner = item && item.owner || {};
      const bvid = String(item && (item.bvid || item.history && item.history.bvid) || '').trim();
      const durationSeconds = Math.max(0, Number(item && item.duration || 0));
      const rawProgress = Number(item && item.progress || 0);
      const progressSeconds = rawProgress < 0 ? durationSeconds : Math.max(0, rawProgress);
      if (!bvid || !item.title) return null;
      return {
        kind:'video', bvid, title:String(item.title),
        // Every item is a normal video link. The list page is kept separately for library actions.
        href:`https://www.bilibili.com/video/${bvid}`,
        playHref:`https://www.bilibili.com/video/${bvid}`,
        libraryHref:`https://www.bilibili.com/list/watchlater?bvid=${bvid}`,
        thumbnail:mediaUrl(item.pic), duration:formatDuration(durationSeconds),
        author:String(owner.name || ''), avatar:mediaUrl(owner.face),
        authorHref:owner.mid ? `https://space.bilibili.com/${owner.mid}` : '',
        publishedAt:Number(item.pubdate || 0),
        meta:[durationSeconds ? `已观看 ${Math.round(Math.min(1, progressSeconds / durationSeconds) * 100)}%` : '', formatRelativeTime(item.pubdate, nowSeconds)].filter(Boolean).join(' · '),
        progress:durationSeconds ? Math.max(0, Math.min(1, progressSeconds / durationSeconds)) : 0,
        aid:Number(item.aid || 0),
      };
    }).filter(Boolean);
  }
  function normalizeFavoriteFolders(payload) {
    const list = payload && payload.code === 0 && payload.data && Array.isArray(payload.data.list) ? payload.data.list : [];
    return list.map((item) => ({
      id:String(item.id || item.media_id || ''), title:String(item.title || '收藏夹'), count:Number(item.media_count || item.count || 0),
      cover:mediaUrl(item.cover), href:item.id ? `https://space.bilibili.com/${item.mid || ''}/favlist?fid=${item.id}&ftype=create` : '',
    })).filter(x => x.id);
  }
  function normalizeFavoriteResources(payload, nowSeconds = Math.floor(Date.now() / 1000)) {
    const list = payload && payload.code === 0 && payload.data && Array.isArray(payload.data.medias) ? payload.data.medias : [];
    return list.map((item) => {
      const upper = item && item.upper || {};
      const bvid = String(item && item.bvid || '').trim();
      if (!bvid || !item.title) return null;
      return {
        kind:'video', bvid, title:String(item.title), href:`https://www.bilibili.com/video/${bvid}`,
        thumbnail:mediaUrl(item.cover), duration:formatDuration(item.duration),
        author:String(upper.name || ''), avatar:mediaUrl(upper.face), authorHref:upper.mid ? `https://space.bilibili.com/${upper.mid}` : '',
        publishedAt:Number(item.pubtime || item.ctime || 0),
        meta:[item.cnt_info && item.cnt_info.play != null ? `${compactNumber(item.cnt_info.play)}播放` : '', formatRelativeTime(item.pubtime || item.ctime, nowSeconds)].filter(Boolean).join(' · '),
      };
    }).filter(Boolean);
  }


  function normalizeRelated(payload, nowSeconds = Math.floor(Date.now() / 1000)) {
    const list = payload && payload.code === 0 && Array.isArray(payload.data) ? payload.data : [];
    return list.map((item) => {
      const owner = item && item.owner || {};
      const bvid = String(item && item.bvid || '').trim();
      const title = String(item && item.title || '').trim();
      if (!bvid || !title) return null;
      const publishedAt = timestampSeconds(item.pubdate || item.ctime);
      return {
        kind:'video', bvid, title,
        href:`https://www.bilibili.com/video/${bvid}`,
        thumbnail:mediaUrl(item.pic), duration:formatDuration(item.duration),
        author:String(owner.name || ''), avatar:mediaUrl(owner.face),
        authorHref:owner.mid ? `https://space.bilibili.com/${owner.mid}` : '',
        publishedAt,
        meta:[item.stat && item.stat.view != null ? `${compactNumber(item.stat.view)}播放` : '', formatRelativeTime(publishedAt, nowSeconds)].filter(Boolean).join(' · '),
      };
    }).filter(Boolean);
  }
  function normalizeParts(payload) {
    const data = payload && payload.code === 0 && payload.data ? payload.data : {};
    const bvid = String(data.bvid || '').trim();
    const pages = Array.isArray(data.pages) ? data.pages : [];
    if (!bvid || pages.length < 2) return [];
    return pages.map((page, index) => ({
      page:Number(page.page || index + 1),
      cid:Number(page.cid || 0),
      title:String(page.part || `P${index + 1}`),
      duration:formatDuration(page.duration),
      href:`https://www.bilibili.com/video/${bvid}?p=${Number(page.page || index + 1)}`,
    }));
  }

  function normalizeSearch(payload, nowSeconds = Math.floor(Date.now() / 1000)) {
    const list = payload && payload.code === 0 && payload.data && Array.isArray(payload.data.result) ? payload.data.result : [];
    return list.map((item) => {
      const bvid = String(item && item.bvid || '').trim();
      const title = stripHtml(item && item.title);
      if (!bvid || !title) return null;
      const publishedAt = timestampSeconds(item.pubdate || item.pub_time || item.ctime);
      return {
        kind:'video', bvid, title,
        href:`https://www.bilibili.com/video/${bvid}`,
        thumbnail:mediaUrl(item.pic), duration:String(item.duration || ''),
        author:stripHtml(item.author || item.up_name || ''), avatar:mediaUrl(item.upic || item.face || ''),
        authorHref:item.mid ? `https://space.bilibili.com/${item.mid}` : '',
        publishedAt,
        meta:[item.play != null ? `${compactNumber(item.play)}播放` : '', formatRelativeTime(publishedAt, nowSeconds)].filter(Boolean).join(' · '),
      };
    }).filter(Boolean);
  }
  function normalizeSearchAll(payload, nowSeconds = Math.floor(Date.now() / 1000)) {
    const sections = payload && payload.code === 0 && payload.data && Array.isArray(payload.data.result) ? payload.data.result : [];
    const byType = (type) => sections.find(section => section && section.result_type === type);
    const wrap = (section) => ({ code:0, data:{ result:section && Array.isArray(section.data) ? section.data : [] } });
    const videoSection = byType('video');
    const userSection = byType('bili_user');
    const bangumiSection = byType('media_bangumi');
    const mediaSection = byType('media_ft');
    return {
      videos: normalizeSearch(wrap(videoSection), nowSeconds),
      users: normalizeSearchUsers(wrap(userSection)),
      bangumi: normalizeSearchMedia(wrap(bangumiSection), 'bangumi', nowSeconds),
      media: normalizeSearchMedia(wrap(mediaSection), 'media', nowSeconds),
    };
  }
  function normalizeSearchUsers(payload) {
    const list = payload && payload.code === 0 && payload.data && Array.isArray(payload.data.result) ? payload.data.result : [];
    return list.map((item) => {
      const mid = String(item && item.mid || '').replace(/\D/g, '');
      const name = stripHtml(item && (item.uname || item.name));
      if (!mid || !name) return null;
      const fans = Number(item.fans || item.follower || item.followers || 0);
      const videos = Number(item.videos || item.video_num || item.archives || 0);
      return {
        kind:'user', mid, name,
        href:`https://space.bilibili.com/${mid}`,
        avatar:mediaUrl(item.upic || item.face || item.avatar || ''),
        sign:stripHtml(item.usign || item.sign || ''),
        following:Boolean(item.is_followed || item.following),
        fans, videos,
        meta:[fans ? `${compactNumber(fans)}粉丝` : '', videos ? `${compactNumber(videos)}个视频` : ''].filter(Boolean).join(' · '),
      };
    }).filter(Boolean);
  }
  function normalizeSearchMedia(payload, kind = 'bangumi', nowSeconds = Math.floor(Date.now() / 1000)) {
    const list = payload && payload.code === 0 && payload.data && Array.isArray(payload.data.result) ? payload.data.result : [];
    return list.map((item) => {
      const mediaId = String(item && (item.media_id || item.season_id || item.id) || '').replace(/\D/g, '');
      const seasonId = String(item && (item.season_id || item.media_id || item.id) || '').replace(/\D/g, '');
      const title = stripHtml(item && (item.title || item.org_title));
      if (!title || (!mediaId && !seasonId)) return null;
      const publishedAt = timestampSeconds(item.pubtime || item.pubdate || item.ctime);
      const isBangumi = kind === 'bangumi';
      const href = seasonId ? `https://www.bilibili.com/bangumi/play/ss${seasonId}` : `https://www.bilibili.com/bangumi/media/md${mediaId}`;
      const score = item.media_score && (item.media_score.score || item.media_score.user_count) ? String(item.media_score.score || '') : '';
      return {
        kind:isBangumi ? 'bangumi' : 'media', mediaId, seasonId, title, href,
        thumbnail:mediaUrl(item.cover || item.pic || ''),
        description:stripHtml(item.desc || item.cv || item.staff || ''),
        meta:[String(item.areas || '').trim(), String(item.styles || '').trim(), score ? `${score}分` : '', formatRelativeTime(publishedAt, nowSeconds)].filter(Boolean).join(' · '),
      };
    }).filter(Boolean);
  }
  function normalizeSearchSuggestions(payload) {
    const tags = payload && payload.code === 0 && payload.data && payload.data.result && Array.isArray(payload.data.result.tag)
      ? payload.data.result.tag
      : payload && payload.code === 0 && payload.result && Array.isArray(payload.result.tag) ? payload.result.tag : [];
    const seen = new Set();
    return tags.map(item => stripHtml(item && (item.value || item.term || item.name))).filter(value => {
      if (!value || seen.has(value)) return false;
      seen.add(value); return true;
    }).slice(0, 10);
  }
  function normalizeComments(payload, nowSeconds = Math.floor(Date.now() / 1000)) {
    const data = payload && payload.code === 0 && payload.data ? payload.data : {};
    const replies = Array.isArray(data.replies) ? data.replies : [];
    const normalizeReply = (reply) => {
      const member = reply && reply.member || {};
      const content = reply && reply.content || {};
      const mid = String(member.mid || '').trim();
      return {
        id:String(reply && (reply.rpid_str || reply.rpid) || ''),
        author:String(member.uname || member.name || '用户'),
        avatar:mediaUrl(member.avatar || member.face || ''),
        authorHref:mid ? `https://space.bilibili.com/${mid}` : '',
        message:String(content.message || ''),
        time:formatRelativeTime(reply && reply.ctime, nowSeconds),
        likes:compactNumber(reply && reply.like),
      };
    };
    const items = replies.map((reply) => {
      const item = normalizeReply(reply);
      const nested = Array.isArray(reply && reply.replies) ? reply.replies : [];
      item.replies = nested.slice(0, 3).map(normalizeReply);
      return item;
    });
    const count = Number(data.cursor && data.cursor.all_count || data.page && data.page.count || items.length || 0);
    let next = '';
    try {
      const paginationReply = data.cursor && data.cursor.pagination_reply;
      next = paginationReply && paginationReply.next_offset ? String(paginationReply.next_offset) : '';
    } catch {}
    return { items, count, next };
  }

  function normalizeLiveShelf(payload) {
    const list = payload && payload.code === 0 && payload.data && Array.isArray(payload.data.recommend_room_list) ? payload.data.recommend_room_list : [];
    return list.map((item) => {
      if (!item || item.is_ad || item.show_ad_icon) return null;
      const roomId = String(item.roomid || item.room_id || '').replace(/\D/g, '');
      const title = String(item.title || '').trim();
      if (!roomId || !title) return null;
      const online = Number(item.online || item.watched_show && item.watched_show.num || 0);
      const uid = String(item.uid || '').replace(/\D/g, '');
      return {
        kind:'live', title, href:`https://live.bilibili.com/${roomId}`,
        thumbnail:mediaUrl(item.keyframe || item.cover), duration:'LIVE',
        author:String(item.uname || '').trim(), avatar:mediaUrl(item.face),
        authorHref:uid ? `https://space.bilibili.com/${uid}` : '',
        meta:[online ? `${compactNumber(online)}人正在观看` : '正在直播', String(item.area_v2_name || '').trim()].filter(Boolean).join(' · '),
        roomId,
      };
    }).filter(Boolean);
  }

  function normalizeBangumiShelf(payload) {
    const days = payload && payload.code === 0 && Array.isArray(payload.result) ? payload.result : [];
    const episodes = [];
    for (const day of days) {
      for (const ep of Array.isArray(day && day.episodes) ? day.episodes : []) {
        const episodeId = String(ep && (ep.episode_id || ep.ep_id || ep.id) || '').replace(/\D/g, '');
        if (!episodeId) continue;
        const episodeLabel = String(ep.pub_index || ep.pub_title || ep.title || '').trim();
        const seriesTitle = String(ep.season_title || ep.show_title || ep.long_title || ep.title || episodeLabel || '番剧').trim();
        episodes.push({
          kind:'bangumi', title:seriesTitle, href:`https://www.bilibili.com/bangumi/play/ep${episodeId}`,
          thumbnail:mediaUrl(ep.ep_cover || ep.square_cover || ep.cover), duration:episodeLabel,
          author:'番剧', avatar:'', authorHref:'https://www.bilibili.com/anime/',
          meta:[episodeLabel && episodeLabel !== seriesTitle ? episodeLabel : '', String(ep.pub_time || '').trim(), String(ep.plays || '').trim(), String(ep.follows || '').trim()].filter(Boolean).join(' · '),
          publishedAt:Number(day && day.date_ts || 0), episodeId,
        });
      }
    }
    return episodes;
  }

  function normalizePopularShelf(payload, nowSeconds = Math.floor(Date.now() / 1000)) {
    const list = payload && payload.code === 0 && payload.data && Array.isArray(payload.data.list) ? payload.data.list : [];
    return list.map((item) => {
      const owner = item && item.owner || {};
      const bvid = String(item && item.bvid || '').trim();
      const title = String(item && item.title || '').trim();
      if (!bvid || !title) return null;
      const publishedAt = timestampSeconds(item.pubdate || item.ctime);
      return {
        kind:'video', bvid, title, href:`https://www.bilibili.com/video/${bvid}`,
        thumbnail:mediaUrl(item.pic), duration:formatDuration(item.duration),
        author:String(owner.name || '').trim(), avatar:mediaUrl(owner.face),
        authorHref:owner.mid ? `https://space.bilibili.com/${owner.mid}` : '',
        publishedAt,
        meta:[item.stat && item.stat.view != null ? `${compactNumber(item.stat.view)}播放` : '', formatRelativeTime(publishedAt, nowSeconds)].filter(Boolean).join(' · '),
      };
    }).filter(Boolean);
  }

  function normalizeFollowedVideoShelf(payload, nowSeconds = Math.floor(Date.now() / 1000)) {
    return normalizeDynamic(payload, nowSeconds).map(item => item.video).filter(Boolean);
  }

  function normalizeSearchItem(item) {
    if (!item || !item.title || !item.href) return null;
    return {
      kind: 'video', bvid: String(item.bvid || ''), title: String(item.title).trim(),
      href: absoluteUrl(item.href), thumbnail: mediaUrl(item.thumbnail), duration: String(item.duration || ''),
      author: String(item.author || '').trim(), avatar: mediaUrl(item.avatar),
      authorHref: absoluteUrl(item.authorHref), meta: String(item.meta || '').trim(),
    };
  }
  return { absoluteUrl, mediaUrl, compactNumber, formatDuration, formatRelativeTime, stripHtml, homeCategoryKey, normalizeAccount, normalizeHome, normalizeHomeCategory, normalizeHistory, normalizeSpaceProfile, normalizeSpaceArchives, normalizeSubscriptions, normalizeDynamic, normalizeDynamicSubscriptions, normalizeWatchLater, normalizeFavoriteFolders, normalizeFavoriteResources, normalizeRelated, normalizeParts, normalizeSearch, normalizeSearchAll, normalizeSearchUsers, normalizeSearchMedia, normalizeSearchSuggestions, normalizeComments, normalizeLiveShelf, normalizeBangumiShelf, normalizePopularShelf, normalizeFollowedVideoShelf, normalizeSearchItem };
});
