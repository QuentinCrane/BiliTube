const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Wbi = require('../src/core/wbi.js');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('WBI helper has a correct MD5 implementation', () => {
  assert.equal(Wbi.md5('hello'), '5d41402abc4b2a76b9719d911017c592');
  assert.equal(Wbi.md5(''), 'd41d8cd98f00b204e9800998ecf8427e');
});

test('WBI helper extracts keys from nav payload', () => {
  const keys = Wbi.keysFromNav({data:{wbi_img:{
    img_url:'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',
    sub_url:'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png',
  }}});
  assert.equal(keys.imgKey,'7cd084941338484aae1ad9425b84077c');
  assert.equal(keys.subKey,'4932caff0ff746eab6f01bf08b70ac45');
});

test('WBI signature is stable, sorted and strips forbidden characters', () => {
  const signed = Wbi.sign({b:"b!'()*",a:'a value'},'7cd084941338484aae1ad9425b84077c','4932caff0ff746eab6f01bf08b70ac45',1700000000);
  assert.match(signed.query,/^a=a%20value&b=b&wts=1700000000&w_rid=[0-9a-f]{32}$/);
});

test('background prefers current WBI search and space archive endpoints with legacy fallbacks', () => {
  const bg = read('src/background.js');
  assert.match(bg,/importScripts\('core\/wbi\.js'\)/);
  assert.match(bg,/\/x\/web-interface\/wbi\/search\/type/);
  assert.match(bg,/\/x\/space\/wbi\/arc\/search/);
  assert.match(bg,/x\/web-interface\/search\/type/);
  assert.match(bg,/x\/space\/arc\/search/);
});

test('home recommendations also use the signed WBI endpoint first', () => {
  const bg = read('src/background.js');
  assert.match(bg,/wbiFirst\('\/x\/web-interface\/wbi\/index\/top\/feed\/rcmd'/);
});
