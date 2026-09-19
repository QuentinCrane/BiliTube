const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Data = require('../src/core/data.js');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('home recommendation metadata includes a relative publish time when pubdate exists', () => {
  const now = 1_800_000_000;
  const out = Data.normalizeHome({ code:0, data:{ item:[{
    bvid:'BV1DATE', title:'带发布日期的视频', pic:'//i0.hdslb.com/date.jpg', duration:60,
    pubdate: now - 7200,
    owner:{ mid:1, name:'UP', face:'//i0.hdslb.com/u.jpg' }, stat:{ view:12345 },
  }] } }, now);
  assert.equal(out[0].publishedAt, now - 7200);
  assert.match(out[0].meta, /播放/);
  assert.match(out[0].meta, /2小时前/);
});

test('dynamic video metadata keeps publish timestamp and human readable time', () => {
  const now = 1_800_000_000;
  const list = Data.normalizeDynamic({ code:0, data:{ items:[{
    id_str:'1', type:'DYNAMIC_TYPE_AV', modules:{
      module_author:{ mid:7, name:'UP', face:'//i0.hdslb.com/a.jpg', pub_ts:now-86400, pub_time:'' },
      module_dynamic:{ major:{ archive:{ bvid:'BV1DYNDATE', title:'动态视频', cover:'//i0.hdslb.com/v.jpg', duration:12, stat:{ play:321 } } } },
    },
  }] } }, now);
  assert.equal(list[0].video.publishedAt, now - 86400);
  assert.match(list[0].video.meta, /1天前/);
});

test('watch mirrors simple creator identity but keeps the native toolbar in place', () => {
  const watch = read('src/core/watch.js');
  const css = read('src/styles/core.css');
  assert.match(watch, /bt-watch-author-row/);
  assert.match(watch, /bt-native-watch-toolbar/);
  assert.match(css, /\.bt-watch-author-row/);
  assert.match(css, /\.bt-native-watch-toolbar/);
  assert.doesNotMatch(watch, /bt-native-toolbar-slot/);
});

test('watch decorator does not use the legacy synthetic native-action proxy', () => {
  const watch = read('src/core/watch.js');
  assert.doesNotMatch(watch, /Actions|findTarget|dispatchEvent|MouseEvent|callbacks\.action/);
  assert.match(watch, /bt-native-watch-toolbar/);
});

test('watch decorator detects native wide and web-fullscreen states without moving or clicking the player', () => {
  const src = read('src/core/watch.js');
  assert.match(src, /data-screen/);
  assert.match(src, /bt-player-wide/);
  assert.match(src, /bt-player-web-fullscreen/);
  assert.match(src, /fullscreenchange/);
  assert.doesNotMatch(src, /appendChild\s*\(\s*player|replaceWith\s*\(\s*player|append\s*\(\s*player|\.click\(\)/);
});

test('watch CSS yields to native web fullscreen and wide modes', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /html\.bt-player-web-fullscreen body/);
  assert.match(css, /html\.bt-player-web-fullscreen #bilitube-watch-layer/);
  assert.match(css, /html\.bt-player-wide \.bt-watch-native-layout/);
  assert.match(css, /\.bt-player-wide \.bt-native-watch-related/);
  assert.match(css, /\.bt-watch-native-layout/);
});

test('watch has no BiliTube action controls that could steal native toolbar events', () => {
  const watch = read('src/core/watch.js');
  assert.doesNotMatch(watch, /bt-watch-actions|data-action|callbacks\.action|dispatchEvent/);
});

test('watch extraction can read live native toolbar counts and active state', () => {
  const src = read('src/core/extract.js');
  assert.match(src, /video-like-info/);
  assert.match(src, /video-coin-info/);
  assert.match(src, /video-fav-info/);
  assert.match(src, /active/);
});

test('ordinary watch follow uses the existing relation callback without a second watch state store', () => {
  const watch = read('src/core/watch.js');
  const app = read('src/core/app.js');
  assert.match(watch, /bt-watch-follow/);
  assert.match(watch, /callbacks\.followSpace/);
  assert.doesNotMatch(app, /watchFollowState/);
});

