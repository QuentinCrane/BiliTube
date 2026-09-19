(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BiliTubeWbi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MIXIN_KEY_ENC_TAB = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];

  function add32(a, b) { return (a + b) | 0; }
  function rol(num, cnt) { return (num << cnt) | (num >>> (32 - cnt)); }
  function cmn(q, a, b, x, s, t) { return add32(rol(add32(add32(a, q), add32(x, t)), s), b); }
  function ff(a,b,c,d,x,s,t) { return cmn((b & c) | ((~b) & d), a,b,x,s,t); }
  function gg(a,b,c,d,x,s,t) { return cmn((b & d) | (c & (~d)), a,b,x,s,t); }
  function hh(a,b,c,d,x,s,t) { return cmn(b ^ c ^ d, a,b,x,s,t); }
  function ii(a,b,c,d,x,s,t) { return cmn(c ^ (b | (~d)), a,b,x,s,t); }

  function md5cycle(state, k) {
    let [a,b,c,d] = state;
    a=ff(a,b,c,d,k[0],7,-680876936); d=ff(d,a,b,c,k[1],12,-389564586); c=ff(c,d,a,b,k[2],17,606105819); b=ff(b,c,d,a,k[3],22,-1044525330);
    a=ff(a,b,c,d,k[4],7,-176418897); d=ff(d,a,b,c,k[5],12,1200080426); c=ff(c,d,a,b,k[6],17,-1473231341); b=ff(b,c,d,a,k[7],22,-45705983);
    a=ff(a,b,c,d,k[8],7,1770035416); d=ff(d,a,b,c,k[9],12,-1958414417); c=ff(c,d,a,b,k[10],17,-42063); b=ff(b,c,d,a,k[11],22,-1990404162);
    a=ff(a,b,c,d,k[12],7,1804603682); d=ff(d,a,b,c,k[13],12,-40341101); c=ff(c,d,a,b,k[14],17,-1502002290); b=ff(b,c,d,a,k[15],22,1236535329);

    a=gg(a,b,c,d,k[1],5,-165796510); d=gg(d,a,b,c,k[6],9,-1069501632); c=gg(c,d,a,b,k[11],14,643717713); b=gg(b,c,d,a,k[0],20,-373897302);
    a=gg(a,b,c,d,k[5],5,-701558691); d=gg(d,a,b,c,k[10],9,38016083); c=gg(c,d,a,b,k[15],14,-660478335); b=gg(b,c,d,a,k[4],20,-405537848);
    a=gg(a,b,c,d,k[9],5,568446438); d=gg(d,a,b,c,k[14],9,-1019803690); c=gg(c,d,a,b,k[3],14,-187363961); b=gg(b,c,d,a,k[8],20,1163531501);
    a=gg(a,b,c,d,k[13],5,-1444681467); d=gg(d,a,b,c,k[2],9,-51403784); c=gg(c,d,a,b,k[7],14,1735328473); b=gg(b,c,d,a,k[12],20,-1926607734);

    a=hh(a,b,c,d,k[5],4,-378558); d=hh(d,a,b,c,k[8],11,-2022574463); c=hh(c,d,a,b,k[11],16,1839030562); b=hh(b,c,d,a,k[14],23,-35309556);
    a=hh(a,b,c,d,k[1],4,-1530992060); d=hh(d,a,b,c,k[4],11,1272893353); c=hh(c,d,a,b,k[7],16,-155497632); b=hh(b,c,d,a,k[10],23,-1094730640);
    a=hh(a,b,c,d,k[13],4,681279174); d=hh(d,a,b,c,k[0],11,-358537222); c=hh(c,d,a,b,k[3],16,-722521979); b=hh(b,c,d,a,k[6],23,76029189);
    a=hh(a,b,c,d,k[9],4,-640364487); d=hh(d,a,b,c,k[12],11,-421815835); c=hh(c,d,a,b,k[15],16,530742520); b=hh(b,c,d,a,k[2],23,-995338651);

    a=ii(a,b,c,d,k[0],6,-198630844); d=ii(d,a,b,c,k[7],10,1126891415); c=ii(c,d,a,b,k[14],15,-1416354905); b=ii(b,c,d,a,k[5],21,-57434055);
    a=ii(a,b,c,d,k[12],6,1700485571); d=ii(d,a,b,c,k[3],10,-1894986606); c=ii(c,d,a,b,k[10],15,-1051523); b=ii(b,c,d,a,k[1],21,-2054922799);
    a=ii(a,b,c,d,k[8],6,1873313359); d=ii(d,a,b,c,k[15],10,-30611744); c=ii(c,d,a,b,k[6],15,-1560198380); b=ii(b,c,d,a,k[13],21,1309151649);
    a=ii(a,b,c,d,k[4],6,-145523070); d=ii(d,a,b,c,k[11],10,-1120210379); c=ii(c,d,a,b,k[2],15,718787259); b=ii(b,c,d,a,k[9],21,-343485551);

    state[0]=add32(a,state[0]); state[1]=add32(b,state[1]); state[2]=add32(c,state[2]); state[3]=add32(d,state[3]);
  }

  function md5blk(s) {
    const out = new Array(16);
    for (let i=0;i<64;i+=4) out[i>>2] = s.charCodeAt(i) | (s.charCodeAt(i+1)<<8) | (s.charCodeAt(i+2)<<16) | (s.charCodeAt(i+3)<<24);
    return out;
  }
  function md51(s) {
    const n=s.length; const state=[1732584193,-271733879,-1732584194,271733878]; let i;
    for (i=64;i<=n;i+=64) md5cycle(state,md5blk(s.substring(i-64,i)));
    s=s.substring(i-64);
    const tail=new Array(16).fill(0);
    for(i=0;i<s.length;i++) tail[i>>2] |= s.charCodeAt(i) << ((i%4)<<3);
    tail[i>>2] |= 0x80 << ((i%4)<<3);
    if(i>55){ md5cycle(state,tail); tail.fill(0); }
    tail[14]=n*8;
    md5cycle(state,tail);
    return state;
  }
  const HEX='0123456789abcdef';
  function rhex(n){ let s=''; for(let j=0;j<4;j++) s += HEX[(n>>(j*8+4))&15] + HEX[(n>>(j*8))&15]; return s; }
  function md5(value) {
    // WBI's canonical query is URI encoded ASCII, but support arbitrary input as UTF-8 for tests/reuse.
    const ascii = unescape(encodeURIComponent(String(value)));
    return md51(ascii).map(rhex).join('');
  }

  function keyFromUrl(url) {
    const match=String(url||'').match(/\/([^/?#]+)\.(?:png|webp|jpg)(?:[?#].*)?$/i);
    return match ? match[1] : '';
  }
  function keysFromNav(payload) {
    const wbi=payload && payload.data && payload.data.wbi_img || {};
    const imgKey=keyFromUrl(wbi.img_url); const subKey=keyFromUrl(wbi.sub_url);
    return imgKey && subKey ? {imgKey,subKey} : null;
  }
  function mixinKey(imgKey,subKey) {
    const raw=String(imgKey||'')+String(subKey||'');
    return MIXIN_KEY_ENC_TAB.map(i=>raw[i]||'').join('').slice(0,32);
  }
  function encode(value) { return encodeURIComponent(String(value).replace(/[!'()*]/g,'')); }
  function sign(params,imgKey,subKey,nowSeconds) {
    const wts=Math.floor(Number(nowSeconds) || Date.now()/1000);
    const all={...(params||{}),wts};
    const query=Object.keys(all).sort().filter(key=>all[key]!==undefined&&all[key]!==null&&all[key]!=='')
      .map(key=>`${encode(key)}=${encode(all[key])}`).join('&');
    const w_rid=md5(query+mixinKey(imgKey,subKey));
    return { ...all, w_rid, query:`${query}&w_rid=${w_rid}` };
  }

  return { md5,keyFromUrl,keysFromNav,mixinKey,sign };
});
