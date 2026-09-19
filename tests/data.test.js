const test = require('node:test');
const assert = require('node:assert/strict');
const Data = require('../src/core/data.js');

test('normalizes home recommendation into navigable creator-aware card', () => {
  const out = Data.normalizeHome({ code: 0, data: { item: [{
    bvid: 'BV1TEST123', title: '测试视频', pic: 'http://i0.hdslb.com/a.jpg', duration: 125,
    owner: { mid: 99, name: 'UP测试', face: 'http://i0.hdslb.com/u.jpg' },
    stat: { view: 123456 },
  }] } });
  assert.equal(out.length, 1);
  assert.equal(out[0].href, 'https://www.bilibili.com/video/BV1TEST123');
  assert.equal(out[0].authorHref, 'https://space.bilibili.com/99');
  assert.equal(out[0].thumbnail.startsWith('https://'), true);
  assert.equal(out[0].duration, '2:05');
});

test('normalizes homepage category metadata for BiliTube filters', () => {
  const out = Data.normalizeHome({ code: 0, data: { item: [
    { bvid:'BV1TECH', title:'科技视频', tname:'科技', tid:188, owner:{ mid:1, name:'UP' } },
    { bvid:'BV1FILM', title:'影视视频', tname:'影视', tid:181, owner:{ mid:2, name:'UP2' } },
  ] } });
  assert.equal(out[0].categoryKey, 'tech');
  assert.equal(out[1].categoryKey, 'film');
  assert.equal(Data.homeCategoryKey('番剧'), 'anime');
});

test('normalizes public region ranking items into category cards', () => {
  const out = Data.normalizeHomeCategory({ code:0, data:{ list:[{ bvid:'BV1REGION', title:'分区视频', pic:'//i0.hdslb.com/r.jpg', duration:61, owner:{mid:5,name:'UP'} }] } }, 'tech');
  assert.equal(out.length, 1);
  assert.equal(out[0].categoryKey, 'tech');
  assert.equal(out[0].href, 'https://www.bilibili.com/video/BV1REGION');
});

test('normalizes history progress and part', () => {
  const out = Data.normalizeHistory({ code: 0, data: { list: [{
    title: '历史视频', author_name: 'UP', author_mid: 8, cover: '//i0.hdslb.com/h.jpg',
    duration: 100, progress: 40, view_at: 1700000000,
    history: { business: 'archive', bvid: 'BV1HISTORY', part: 'P2' },
  }] } });
  assert.equal(out[0].progress, 0.4);
  assert.match(out[0].meta, /P2/);
  assert.match(out[0].meta, /40%/);
});

test('space profile never fabricates identity and preserves MID', () => {
  const profile = Data.normalizeSpaceProfile({ code: 0, data: {
    card: { mid: '357702240', name: 'Creator', face: '//i0.hdslb.com/f.jpg', sign: 'hello', fans: 1200, attention: 12, archive_count: 33 },
    follower: 1300, following: true, space: { l_img: '//i0.hdslb.com/banner.jpg' },
  } }, '357702240');
  assert.equal(profile.mid, '357702240');
  assert.equal(profile.name, 'Creator');
  assert.equal(profile.following, true);
  assert.equal(profile.banner.startsWith('https://'), true);
  assert.equal(Data.normalizeSpaceProfile({ code: -1 }, '123'), null);
});

test('space archive cards use supplied creator identity', () => {
  const cards = Data.normalizeSpaceArchives({ code: 0, data: { list: { vlist: [{ bvid:'BV1ARC', title:'投稿', pic:'//i0.hdslb.com/v.jpg', play:888, length:'03:21' }] } } }, '7', { name:'A', avatar:'https://x/a.jpg' });
  assert.equal(cards[0].author, 'A');
  assert.equal(cards[0].authorHref, 'https://space.bilibili.com/7');
});

test('subscription nav keeps live and unread signals', () => {
  const list = Data.normalizeSubscriptions({ code:0, data:{ items:[{ author:{ mid:1, name:'One', face:'//i0.hdslb.com/1.jpg', live_status:1 }, has_update:true }] } });
  assert.deepEqual({ mid:list[0].mid, live:list[0].live, unread:list[0].unread }, { mid:'1', live:true, unread:true });
});

test('search DOM-shaped item normalization keeps distinct video and author links', () => {
  const card = Data.normalizeSearchItem({ title:'Result', href:'/video/BV1R', author:'Maker', authorHref:'https://space.bilibili.com/2', thumbnail:'//i0.hdslb.com/r.jpg', meta:'1万播放' });
  assert.equal(card.href, 'https://www.bilibili.com/video/BV1R');
  assert.equal(card.authorHref, 'https://space.bilibili.com/2');
});


test('normalizes dynamic feed video and text cards without DOM selectors', () => {
  const list = Data.normalizeDynamic({ code: 0, data: { items: [
    { id_str:'1', type:'DYNAMIC_TYPE_AV', modules:{ module_author:{ mid:7, name:'UP', face:'//i0.hdslb.com/a.jpg', pub_time:'刚刚' }, module_dynamic:{ major:{ archive:{ bvid:'BV1DYN', title:'新视频', cover:'//i0.hdslb.com/v.jpg', desc:'简介', stat:{ play:'1.2万' } } }, desc:{ text:'发布了视频' } } } },
    { id_str:'2', type:'DYNAMIC_TYPE_DRAW', modules:{ module_author:{ mid:8, name:'摄影UP', face:'//i0.hdslb.com/b.jpg', pub_time:'1小时前' }, module_dynamic:{ desc:{ text:'今天出去拍照了' }, major:{ draw:{ items:[{src:'//i0.hdslb.com/p.jpg'}] } } } } },
  ] } });
  assert.equal(list.length, 2);
  assert.equal(list[0].video.href, 'https://www.bilibili.com/video/BV1DYN');
  assert.equal(list[0].authorHref, 'https://space.bilibili.com/7');
  assert.equal(list[1].images[0].startsWith('https://'), true);
});

test('derives sidebar subscription creators from dynamic feed authors', () => {
  const creators = Data.normalizeDynamicSubscriptions([
    { author:'UP一', authorHref:'https://space.bilibili.com/11', avatar:'//i0.hdslb.com/a.jpg' },
    { author:'UP一', authorHref:'https://space.bilibili.com/11', avatar:'//i0.hdslb.com/a.jpg' },
    { author:'UP二', authorHref:'https://space.bilibili.com/22', avatar:'//i0.hdslb.com/b.jpg' },
  ]);
  assert.deepEqual(creators.map(item => item.mid), ['11','22']);
  assert.equal(creators[0].avatar.startsWith('https://'), true);
});

test('normalizes watch later API list into progress-aware video cards', () => {
  const out = Data.normalizeWatchLater({ code:0, data:{ list:[{ aid:1,bvid:'BV1LATER',title:'稍后再看',pic:'//i0.hdslb.com/l.jpg',duration:200,progress:50,owner:{mid:9,name:'UP',face:'//i0.hdslb.com/u.jpg'} }] } });
  assert.equal(out[0].href, 'https://www.bilibili.com/video/BV1LATER');
  assert.equal(out[0].libraryHref, 'https://www.bilibili.com/list/watchlater?bvid=BV1LATER');
  assert.equal(out[0].progress, 0.25);
  assert.equal(out[0].authorHref, 'https://space.bilibili.com/9');
});

test('normalizes favorite folders and favorite resources', () => {
  const folders = Data.normalizeFavoriteFolders({ code:0, data:{ list:[{id:11,title:'摄影',media_count:24,cover:'//i0.hdslb.com/f.jpg'}] } });
  assert.equal(folders[0].id, '11');
  assert.equal(folders[0].count, 24);
  const items = Data.normalizeFavoriteResources({ code:0, data:{ medias:[{id:1,bvid:'BV1FAV',title:'收藏视频',cover:'//i0.hdslb.com/c.jpg',duration:61,upper:{mid:3,name:'作者',face:'//i0.hdslb.com/a.jpg'},cnt_info:{play:5000}}] } });
  assert.equal(items[0].href, 'https://www.bilibili.com/video/BV1FAV');
  assert.equal(items[0].duration, '1:01');
});

test('history treats progress=-1 as completed and preserves multipart page link', () => {
  const out = Data.normalizeHistory({ code:0, data:{ list:[{
    title:'已看完的分P视频', author_name:'UP', author_mid:8, cover:'//i0.hdslb.com/h.jpg',
    duration:120, progress:-1, view_at:1700000001,
    history:{ business:'archive', bvid:'BV1DONE', page:3, part:'第三P' },
  }] } });
  assert.equal(out[0].progress, 1);
  assert.match(out[0].meta, /100%/);
  assert.equal(out[0].href, 'https://www.bilibili.com/video/BV1DONE?p=3');
});
