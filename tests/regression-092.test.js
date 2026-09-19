const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Data = require('../src/core/data.js');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('hover preview progress is an in-thumbnail YouTube-style overlay, not a native range row', () => {
  const preview = read('src/core/preview.js');
  const css = read('src/styles/core.css');
  assert.doesNotMatch(preview, /createElement\(['"]input['"]\)/);
  assert.doesNotMatch(preview, /bt-preview-time/);
  assert.match(preview, /bt-preview-progress/);
  assert.match(preview, /bt-preview-progress-fill/);
  assert.match(preview, /bt-preview-progress-thumb/);
  assert.match(preview, /pointerdown/);
  assert.match(preview, /pointermove/);
  assert.match(preview, /setPointerCapture/);
  assert.match(css, /\.bt-preview-progress\{[^}]*position:absolute[^}]*bottom:/);
  assert.match(css, /\.bt-preview-progress-thumb\{[^}]*opacity:0/);
  assert.match(css, /\.bt-preview-progress:hover[\s\S]*\.bt-preview-progress-thumb/);
});

test('home special-content normalizers preserve Bilibili live, bangumi, popular and followed-video identity', () => {
  const live = Data.normalizeLiveShelf({ code:0, data:{ recommend_room_list:[{
    roomid:923833, title:'正在直播', cover:'https://i0.hdslb.com/live.jpg', online:262700,
    uname:'主播', face:'https://i0.hdslb.com/face.jpg', uid:34646754, area_v2_name:'游戏', is_ad:false,
  }, { roomid:1, title:'广告', is_ad:true }] } });
  assert.equal(live.length, 1);
  assert.equal(live[0].kind, 'live');
  assert.equal(live[0].href, 'https://live.bilibili.com/923833');
  assert.match(live[0].meta, /正在观看/);

  const bangumi = Data.normalizeBangumiShelf({ code:0, result:[{ date_ts:1800000000, episodes:[{
    episode_id:508403, title:'第8话', pub_index:'第8话', pub_time:'20:00', season_title:'测试番剧',
    ep_cover:'https://i0.hdslb.com/ep.jpg', cover:'https://i0.hdslb.com/season.jpg', follows:'123万人追番', plays:'45万播放',
  }] }] });
  assert.equal(bangumi[0].kind, 'bangumi');
  assert.equal(bangumi[0].href, 'https://www.bilibili.com/bangumi/play/ep508403');
  assert.match(bangumi[0].meta, /第8话|20:00/);

  const popular = Data.normalizePopularShelf({ code:0, data:{ list:[{
    bvid:'BV1POPULAR', title:'热门视频', pic:'//i0.hdslb.com/p.jpg', duration:90, pubdate:1799990000,
    owner:{ mid:9, name:'热门UP', face:'//i0.hdslb.com/u.jpg' }, stat:{ view:123456 },
  }] } }, 1800000000);
  assert.equal(popular[0].bvid, 'BV1POPULAR');
  assert.match(popular[0].meta, /播放/);

  const followed = Data.normalizeFollowedVideoShelf({ code:0, data:{ items:[{
    id_str:'d1', modules:{ module_author:{ mid:7, name:'关注UP', face:'//i0.hdslb.com/a.jpg', pub_ts:1799996400 }, module_dynamic:{ major:{ archive:{ bvid:'BV1FOLLOW', title:'关注投稿', cover:'//i0.hdslb.com/f.jpg', duration:20, stat:{ play:'1.2万' } } } } }
  }] } }, 1800000000);
  assert.equal(followed[0].bvid, 'BV1FOLLOW');
  assert.equal(followed[0].author, '关注UP');
});

test('background aggregates Bilibili-native home shelves with independent fallbacks', () => {
  const bg = read('src/background.js');
  assert.match(bg, /type === 'home-sections'/);
  assert.match(bg, /getMoreRecList/);
  assert.match(bg, /pgc\/web\/timeline/);
  assert.match(bg, /x\/web-interface\/popular/);
  assert.match(bg, /x\/polymer\/web-dynamic\/v1\/feed\/all/);
  assert.match(bg, /Promise\.allSettled/);
});

test('home renderer interleaves recommendation grids with Bilibili-special shelves', () => {
  const ui = read('src/core/ui.js');
  const css = read('src/styles/core.css');
  assert.match(ui, /data\.shelves/);
  assert.match(ui, /bt-home-shelf/);
  assert.match(ui, /bt-home-shelf-row/);
  assert.match(ui, /bt-special-card/);
  assert.match(ui, /正在直播|番剧|热门|关注/);
  assert.match(css, /\.bt-home-shelf/);
  assert.match(css, /\.bt-home-shelf-row/);
  assert.match(css, /\.bt-special-card/);
});

test('app loads special home shelves once and preserves normal infinite recommendation paging', () => {
  const app = read('src/core/app.js');
  assert.match(app, /homeShelves/);
  assert.match(app, /requestApi\(['"]home-sections['"]/);
  assert.match(app, /shelves:visibleHomeShelves\(\)/);
  assert.match(app, /loadMoreHome/);
});

test('background service worker remains syntactically valid after interaction and shelf additions', () => {
  assert.doesNotThrow(() => new Function(read('src/background.js')));
});
