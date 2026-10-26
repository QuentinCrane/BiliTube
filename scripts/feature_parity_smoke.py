"""Deterministic browser interactions using fixture API responses (no account)."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "feature-parity"
MOCK = r"""(() => {
  window.__requests = [];
  window.__hold = false;
  window.__pending = [];
  window.__watchlater = Array.from({length:3}, (_, i) => ({
    bvid:`BVfixture${i}`, aid:i+1, title:`Queue ${i}`, duration:120,
    owner:{mid:123,name:'Fixture uploader'}
  }));
  const videos = page => Array.from({length:42}, (_, i) => ({
    bvid:`BVfixture${(page-1)*42+i}`, title:`Video ${(page-1)*42+i}`,
    duration:'2:00', mid:123, author:'Fixture uploader', play:1000
  }));
  window.chrome = {
    storage:{local:{get:(_,done)=>done({bilitubeCoreSettings:{glassMode:false,motionMode:'reduced'}}),set:()=>{}},onChanged:{addListener:()=>{}}},
    runtime:{sendMessage:(message,done)=>{
      const {type,params={}}=message;window.__requests.push({type,params});
      let data={code:0,data:{}};
      if(type==='account')data={code:0,data:{mid:123,uname:'Fixture',isLogin:true}};
      if(type==='search')data={code:0,data:{numPages:20,result:videos(params.page||1)}};
      if(type==='home')data={code:0,data:{item:videos(params.page||1).map(v=>({...v,owner:{mid:123,name:v.author}}))}};
      if(type==='home-sections')data={};
      if(type==='dynamic')data={code:0,data:{has_more:false,items:[{id_str:'123456789',modules:{module_author:{mid:123,name:'Fixture',pub_time:'Now'},module_dynamic:{desc:{text:'Fixture post'},major:{draw:{items:[{src:'https://fixture.invalid/image.svg'}]}}}}}]}};
      if(type==='watchlater')data={code:0,data:{list:window.__watchlater}};
      if(type==='watchlater-toggle'){window.__watchlater=window.__watchlater.filter(v=>v.bvid!==params.bvid);data={code:0,bvid:params.bvid,aid:params.aid};}
      if(type==='favorites')data={mediaId:'42',page:params.page||1,hasMore:true,folders:{code:0,data:{list:[{id:42,title:'Fixture folder',media_count:1000}]}},resources:{code:0,data:{medias:videos(params.page||1)}}};
      if(type==='space-profile')data={code:0,data:{card:{mid:123,name:'Fixture uploader'}}};
      if(type==='space-archives')data={code:0,data:{page:{count:1000},list:{vlist:videos(params.page||1)}}};
      const reply=()=>done({ok:true,data});
      if(window.__hold&&params.append)window.__pending.push(reply);else setTimeout(reply,5);
    }}
  };
})();
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", default=os.environ.get("BROWSER_EXECUTABLE", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"))
    args = parser.parse_args()
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    content = next(item for item in manifest["content_scripts"] if "src/core/app.js" in item.get("js", []))
    # Fixture API runs in the page realm; this does not claim extension packaging
    # or logged-in Bilibili acceptance.
    sources = "\n;\n".join((ROOT / name).read_text(encoding="utf-8") for name in content["js"])
    css = "\n".join((ROOT / name).read_text(encoding="utf-8") for name in content["css"])
    OUTPUT.mkdir(parents=True, exist_ok=True)
    errors = []
    evidence = {"kind": "isolated browser fixture", "checks": []}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.browser, headless=True)
        context = browser.new_context(viewport={"width":1440,"height":900}, reduced_motion="reduce")
        context.route("**/*", lambda route: route.fulfill(
            content_type="image/svg+xml" if route.request.resource_type == "image" else "text/html",
            body='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#bbb"/></svg>' if route.request.resource_type == "image" else '<!doctype html><html><head></head><body><section id="native-business"><button id="native-comment">Native comment</button></section></body></html>'
        ))
        context.add_init_script(MOCK + "\naddEventListener('DOMContentLoaded',()=>{\n" + sources + "\n},{once:true});")
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))

        def go(url):
            page.goto(url, wait_until="networkidle")
            page.add_style_tag(content=css)
            if errors:
                raise AssertionError(errors)

        go("https://search.bilibili.com/video?keyword=demo&order=click&duration=2")
        expect(page.locator(".bt-search-row")).to_have_count(42)
        expect(page.locator(".bt-filter-group .is-active")).to_have_text(["最多播放", "10–30 分钟"])
        page.locator(".bt-site-directory summary").click()
        expect(page.locator(".bt-site-directory")).to_have_attribute("open", "")
        assert page.locator(".bt-site-directory a").count() == 19
        native = page.locator(".bt-page-tools a").first.get_attribute("href")
        assert "order=click" in native and "duration=2" in native and "bilitube_native=1" in native
        page.locator(".bt-search-input").fill("unfinished draft")
        page.evaluate("window.__first=document.querySelector('.bt-search-row');window.__hold=true")
        page.locator("[data-bt-feed]").scroll_into_view_if_needed()
        page.wait_for_function("window.__pending.length===1")
        expect(page.locator(".bt-search-row")).to_have_count(42)
        assert page.evaluate("window.__first===document.querySelector('.bt-search-row')&&window.__first.isConnected")
        page.evaluate("window.__hold=false;window.__pending.splice(0).forEach(done=>done())")
        expect(page.locator(".bt-search-row")).to_have_count(84)
        assert page.evaluate("window.__first===document.querySelector('.bt-search-row')&&window.__first.isConnected")
        expect(page.locator(".bt-search-input")).to_have_value("unfinished draft")
        expect(page.locator(".bt-site-directory")).to_have_attribute("open", "")
        evidence["checks"].append("sort/duration, directory, original page link, draft and card identity during pagination")

        for count in range(126, 337, 42):
            page.locator("[data-bt-feed]").scroll_into_view_if_needed()
            expect(page.locator(".bt-search-row")).to_have_count(count)
        expect(page.locator("[data-bt-feed]")).to_have_attribute("data-bt-manual", "true")
        request_count = page.evaluate("window.__requests.filter(r=>r.type==='search').length")
        page.wait_for_timeout(250)
        assert page.evaluate("window.__requests.filter(r=>r.type==='search').length") == request_count
        page.get_by_role("button", name="加载更多", exact=True).click()
        expect(page.locator(".bt-search-row")).to_have_count(378)
        evidence["checks"].append("automatic pagination stops after 336 items; manual load appends 42")
        page.locator(".bt-search-input").fill("demo")
        page.get_by_role("link", name="最新发布", exact=True).click()
        expect(page.locator(".bt-search-row")).to_have_count(42)
        assert "order=pubdate" in page.url and "duration=2" in page.url
        go(page.url)
        page.screenshot(path=str(OUTPUT / "search.png"))
        page.locator('.bt-search-tabs').get_by_role("link", name="直播", exact=True).click()
        expect(page.locator("#bilitube-native-layer")).to_have_count(1)
        assert "search.bilibili.com/live" in page.url
        evidence["checks"].append("sort click preserves duration; live search uses native adapter")

        go("https://t.bilibili.com/")
        expect(page.locator(".bt-dynamic-discussion")).to_have_count(1)
        expect(page.locator(".bt-dynamic-image-link")).to_have_attribute("href", "https://t.bilibili.com/123456789")
        page.locator(".bt-dynamic-discussion").click()
        expect(page.locator("#bilitube-native-layer")).to_have_count(1)
        expect(page.locator("#bilitube-root")).to_have_count(0)
        expect(page.locator("#native-comment")).to_be_visible()
        page.locator("#native-comment").click()
        evidence["checks"].append("dynamic image and discussion links reach an intact native detail page")

        go("https://www.bilibili.com/list/watchlater")
        page.evaluate("document.cookie='bili_jct=fixture;path=/'")
        expect(page.locator(".bt-library-row")).to_have_count(3)
        page.locator(".bt-library-remove").first.click()
        expect(page.locator(".bt-library-row")).to_have_count(2)
        assert page.evaluate("window.__requests.filter(r=>r.type==='watchlater-toggle').length") == 1
        evidence["checks"].append("Watch Later remove calls the fixture API once and synchronizes the list")

        # Measure append work separately from full rendering and assert that
        # existing rows and preview bindings survive the append.
        evidence["append_benchmarks"] = page.evaluate(r"""
        () => {
          document.querySelector('#bilitube-root')?.remove();
          const results=[];
          for(const route of ['home','search-video','favorites','space-upload']){
            let resets=0,bindings=0;
            const shell=BiliTubeShell.createController(document);
            shell.ensure({}, {beforeRender:()=>{resets++},bindPreview:()=>{bindings++}});
            const items=Array.from({length:1000},(_,i)=>({kind:'video',bvid:`BVbench${i}`,title:`Bench ${i}`,href:`https://www.bilibili.com/video/BVbench${i}`}));
            const data={category:route==='home'?'all':'video',query:'bench',videos:items,results:route==='search-video'?items:undefined,shelves:[],users:[],mid:'123',selectedId:'42',folders:[],hasMore:true};
            const start=performance.now();shell.render(route,data);const fullMs=performance.now()-start;
            const root=shell.getRoot(),first=root.querySelector('.bt-video-card,.bt-search-row');
            const added=Array.from({length:42},(_,i)=>({kind:'video',bvid:`BVappend${i}`,title:`Append ${i}`,href:`https://www.bilibili.com/video/BVappend${i}`}));
            const next=items.concat(added),beforeBindings=bindings,startAppend=performance.now();
            shell.render(route,{...data,append:true,videos:next,results:route==='search-video'?next:undefined});
            const appendMs=performance.now()-startAppend;
            if(!first.isConnected||first!==root.querySelector('.bt-video-card,.bt-search-row')||resets!==1||bindings-beforeBindings!==42)throw new Error(`Append rebuilt ${route}`);
            results.push({route,existing:1000,added:42,fullMs,appendMs,previewBindingsAdded:42});shell.destroy();
          }return results;
        }
        """)
        assert not errors, errors
        evidence["page_errors"] = errors
        evidence["browser"] = browser.version
        browser.close()
    (OUTPUT / "report.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(evidence, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
