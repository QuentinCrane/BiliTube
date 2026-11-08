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

test('search cards retain result fields and fill missing details from video metadata', () => {
  const now=1_800_000_000;
  const api=Data.normalizeSearch({code:0,data:{result:[{bvid:'BVtest',aid:12,title:'<em>相机</em>',mid:42,author:'作者',play:12345,pubdate:now-86400,description:'简介 <em>文字</em>',upic:'//i0.hdslb.com/face.jpg'}]}},now)[0];
  assert.equal(api.description,'简介 文字');assert.equal(api.meta,'1.2万播放 · 1天前');assert.equal(api.avatar,'https://i0.hdslb.com/face.jpg');assert.equal(api.aid,12);
  const native=Data.normalizeSearch({code:0,data:{result:[{bvid:'BVdom',title:'原生',author:'作者',viewText:'27万',publishedText:'3天前'}]}},now)[0];
  assert.equal(native.meta,'27万播放 · 3天前');
  const detail=Data.normalizeSearchDetail({code:0,data:{aid:12,owner:{mid:42,name:'作者',face:'//i0.hdslb.com/face.jpg'},stat:{view:12345},pubdate:now-86400,desc:'视频简介'}},now);
  assert.equal(detail.avatar,'https://i0.hdslb.com/face.jpg');assert.equal(detail.authorHref,'https://space.bilibili.com/42');assert.equal(detail.description,'视频简介');assert.equal(detail.meta,api.meta);
  assert.equal(Data.normalizeSearchDetail({code:-403}),null);
});


test('normalizes dynamic feed video and text cards without DOM selectors', () => {
  const list = Data.normalizeDynamic({ code: 0, data: { items: [
    { id_str:'1', type:'DYNAMIC_TYPE_AV', modules:{ module_author:{ mid:7, name:'UP', face:'//i0.hdslb.com/a.jpg', pub_time:'刚刚' }, module_dynamic:{ major:{ archive:{ bvid:'BV1DYN', title:'新视频', cover:'//i0.hdslb.com/v.jpg', desc:'简介', stat:{ play:'1.2万' } } }, desc:{ text:'发布了视频' } } } },
    { id_str:'2', type:'DYNAMIC_TYPE_DRAW', modules:{ module_author:{ mid:8, name:'摄影UP', face:'//i0.hdslb.com/b.jpg', pub_time:'1小时前' }, module_dynamic:{ desc:{ text:'今天出去拍照了' }, major:{ draw:{ items:[{src:'//i0.hdslb.com/p.jpg'}] } } } } },
  ] } });
  assert.equal(list.length, 2);
  assert.equal(list[0].video.href, 'https://www.bilibili.com/video/BV1DYN');
  assert.equal(list[0].video.dynamicHref, 'https://t.bilibili.com/1');
  assert.equal(list[1].href, 'https://t.bilibili.com/2');
  assert.equal(list[0].authorHref, 'https://space.bilibili.com/7');
  assert.equal(list[1].images[0].startsWith('https://'), true);
});

test('dynamic video metadata keeps publish time and zero views distinct', () => {
  const video = stat => ({id_str:'123',modules:{module_author:{name:'UP',pub_time:'刚刚'},module_dynamic:{major:{archive:{bvid:'BV1DYN',title:'投稿',stat}}}}});
  const items = Data.normalizeDynamic({code:0,data:{items:[video(undefined),video({play:0}),video({view:'1.2万'})]}});
  assert.deepEqual(items.map(item => item.video.meta), ['刚刚','0播放 · 刚刚','1.2万播放 · 刚刚']);
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

test('normalizes the native default search word and trending list', () => {
  assert.equal(Data.normalizeSearchDefaultWord({ code:0, data:{ show_name:'默认<b>推荐</b>词' } }), '默认推荐词');
  const out = Data.normalizeSearchTrending({ code:0, data:{ trending:{
    title:'bilibili热搜',
    top_list:[{ keyword:'置顶词', show_name:'置顶展示' }],
    list:[
      { keyword:'热词', show_name:'热词展示', icon:'http://i0.hdslb.com/a.png' },
      { keyword:'置顶词', show_name:'重复项' },
    ],
  } } });
  assert.equal(out.title, 'bilibili热搜');
  assert.deepEqual(out.items.map(item => item.keyword), ['置顶词','热词']);
  assert.equal(out.items[0].pinned, true);
  assert.equal(out.items[0].position, 1);
  assert.equal(out.items[1].label, '热词展示');
  assert.equal(out.items[1].icon.startsWith('https://'), true);
  assert.deepEqual(Data.normalizeSearchTrending(null), { title:'', items:[] });
});
