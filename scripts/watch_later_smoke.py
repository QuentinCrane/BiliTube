"""Exercise Watch Later with synthetic credentials and isolated Bilibili responses."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = """<!doctype html><html><head><meta charset="utf-8"><style>__CSS__</style></head><body>
<div id="app"><div class="video-container-v1"><div class="left-container">
<div class="video-info-container"><h1>Fixture video</h1></div>
<div id="playerWrap" class="player-wrap"><div id="bilibili-player"><div class="bpx-player-container" data-screen="normal"></div></div></div>
<div id="arc_toolbar_report" class="video-toolbar-container"><button>Like</button></div>
<div id="v_desc" class="video-desc">Fixture description</div><div id="commentapp">Comments</div>
</div><aside class="right-container"><div class="right-container-inner"><div class="up-info-container">
<a class="up-name" href="https://space.bilibili.com/7">Fixture uploader</a></div><div class="recommend-list-v1"></div>
</div></aside></div></div></body></html>"""

MOCK = r"""(() => {
  const videos={BVfirst:11,BVsecond:22,BVthird:33};
  const item=bvid=>({bvid,aid:videos[bvid],title:bvid,owner:{mid:7,name:'Fixture uploader'}});
  window.__fixture={list:[item('BVfirst')],requests:[],writes:[],failReads:location.search.includes('fail=1'),holdNext:false,held:null};
  window.__INITIAL_STATE__={videoData:{bvid:'BVfirst',aid:11,title:'First',owner:{mid:7,name:'Fixture uploader'}}};
  window.fetch=async (input,options={})=>{
    const url=new URL(String(input),location.href), path=url.pathname;
    let data={code:0,data:{}};
    if(path==='/x/v2/history/toview/web'||path==='/x/v2/history/toview'){
      data=__fixture.failReads?{code:-101}:{code:0,data:{list:__fixture.list}};
    }else if(path==='/x/web-interface/view'){
      data={code:0,data:{aid:videos[url.searchParams.get('bvid')]||0}};
    }else if(path.endsWith('/toview/add')||path.endsWith('/toview/del')){
      const form=new URLSearchParams(options.body),aid=Number(form.get('aid'));
      const bvid=Object.keys(videos).find(key=>videos[key]===aid);
      __fixture.writes.push({path,aid,bvid,csrf:form.get('csrf')});
      if(path.endsWith('/add')&&bvid&&!__fixture.list.some(video=>video.bvid===bvid))__fixture.list.push(item(bvid));
      if(path.endsWith('/del'))__fixture.list=__fixture.list.filter(video=>video.aid!==aid);
    }
    return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  };
  window.chrome={
    storage:{local:{get:(_keys,done)=>done({bilitubeCoreSettings:{motionMode:'none'}}),set:()=>{}},onChanged:{addListener:()=>{}}},
    runtime:{sendMessage:(message,done)=>{
      const {type,params={}}=message;__fixture.requests.push({type,params});
      let data={code:0,data:{}};
      if(type==='watchlater')data={code:-101};
      if(type==='watchlater-toggle')data={code:-101,aid:Number(params.aid||0),bvid:params.bvid};
      if(type==='account')data={code:0,data:{mid:7,uname:'Fixture',isLogin:true}};
      if(type==='home')data={code:0,data:{item:[item('BVfirst')]}};
      const reply=()=>done({ok:true,data});
      if(type==='watchlater-toggle'&&__fixture.holdNext){__fixture.holdNext=false;__fixture.held=reply;}
      else setTimeout(reply,0);
    }}
  };
})();"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', default=os.environ.get('BROWSER_EXECUTABLE', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'))
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
    content = next(entry for entry in manifest['content_scripts'] if 'src/core/app.js' in entry.get('js', []))
    css = '\n'.join((ROOT / name).read_text(encoding='utf-8') for name in content['css'])
    sources = '\n;\n'.join((ROOT / name).read_text(encoding='utf-8') for name in content['js'])
    bridge = (ROOT / 'src/page/bridge.js').read_text(encoding='utf-8')
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.browser, headless=True)
        context = browser.new_context(viewport={'width':1440,'height':1000})
        context.add_cookies([{'name':'bili_jct','value':'fixture-token','domain':'.bilibili.com','path':'/'}])
        context.route('**/*', lambda route: route.fulfill(body=FIXTURE.replace('__CSS__',css),content_type='text/html') if route.request.resource_type == 'document' else route.abort())
        context.add_init_script(MOCK)

        def open_page(suffix='',url=None):
            page=context.new_page()
            page.goto(url or 'https://www.bilibili.com/video/BVfirst'+suffix,wait_until='load')
            page.evaluate("document.querySelector('#app').__vue__={_isMounted:true}")
            page.add_script_tag(content=bridge)
            page.add_script_tag(content=sources)
            return page

        page=open_page()
        button=page.locator('.bt-watchlater-watch')
        expect(button).to_have_attribute('aria-pressed','true')
        button.click()
        expect(button).to_have_attribute('aria-pressed','false')
        button.click()
        expect(button).to_have_attribute('aria-pressed','true')
        assert page.evaluate("__fixture.writes.map(w=>[w.path.split('/').pop(),w.aid])") == [['del',11],['add',11]]
        page.wait_for_function("__fixture.requests.some(r=>r.type==='watchlater-invalidate')")

        # URL navigation can precede the next video's native metadata.
        page.evaluate("history.pushState({},'', '/video/BVsecond')")
        expect(button).to_have_attribute('data-bvid','BVsecond')
        expect(button).to_have_attribute('data-aid','')
        button.click()
        expect(button).to_have_attribute('aria-pressed','true')
        assert page.evaluate('__fixture.writes.at(-1).aid') == 22
        page.evaluate("__INITIAL_STATE__.videoData={bvid:'BVsecond',aid:22,title:'Second',owner:{mid:7,name:'Fixture uploader'}}")
        expect(button).to_have_attribute('data-aid','22',timeout=4000)

        # A response for the previous video must not change the reused button.
        page.evaluate('__fixture.holdNext=true')
        button.click()
        page.wait_for_function('__fixture.held !== null')
        page.evaluate("history.pushState({},'', '/video/BVthird')")
        expect(button).to_have_attribute('data-bvid','BVthird')
        page.evaluate('__fixture.held()')
        page.wait_for_function("__fixture.writes.length===4")
        expect(button).to_have_attribute('aria-pressed','false')
        assert page.evaluate('__fixture.writes.at(-1).aid') == 22
        expect(button).not_to_have_attribute('aria-busy','true')
        page.evaluate("history.pushState({},'', '/video/av33'); document.querySelector('.bt-watchlater-watch').click()")
        page.wait_for_function('__fixture.writes.length===5')
        assert page.evaluate('__fixture.writes.at(-1).aid') == 33
        page.close()

        home=open_page(url='https://www.bilibili.com/')
        quick=home.locator('.bt-watchlater-quick').first
        expect(quick).to_have_attribute('aria-pressed','true')
        home.locator('.bt-video-card').first.hover()
        quick.click()
        expect(quick).to_have_attribute('aria-pressed','false')
        assert home.evaluate('__fixture.writes.at(-1).aid') == 11
        home.close()

        library=open_page(url='https://www.bilibili.com/list/watchlater')
        row=library.locator('.bt-library-row:not(.bt-skeleton-library-row)')
        expect(row).to_have_count(1)
        expect(row).to_contain_text('BVfirst')
        row.locator('.bt-library-remove').click()
        expect(row).to_have_count(0)
        assert library.evaluate('__fixture.writes.at(-1).aid') == 11
        library.close()

        failed=open_page('?fail=1')
        failed_button=failed.locator('.bt-watchlater-watch')
        expect(failed_button).to_be_visible()
        failed_button.click()
        expect(failed.locator('#bilitube-core-toast')).to_contain_text('读取失败')
        expect(failed_button).not_to_have_attribute('aria-busy','true')
        assert failed.evaluate("__fixture.requests.filter(r=>r.type==='watchlater-toggle').length") == 0
        assert failed.evaluate('__fixture.writes.length') == 0
        context.close()
        browser.close()
    print('PASS: same-site fallback, add/remove, video navigation, delayed response, and failed reads')


if __name__ == '__main__':
    main()
