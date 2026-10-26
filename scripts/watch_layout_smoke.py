"""Check Watch prepaint, delayed hydration, fallback and native-node continuity."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright
from feature_parity_smoke import MOCK

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output' / 'watch-layout'
REGIONS = {'player': '#playerWrap', 'title': '.video-info-container',
           'toolbar': '#arc_toolbar_report', 'description': '#v_desc'}
FIXTURE = """<!doctype html><html class="bilitube-watch-preflight bt-glass-mode" data-bt-theme="light">
<head><meta charset="utf-8"><style>__CSS__</style><style>
body{margin:0;font-family:Arial,sans-serif}.bili-header{height:64px}
.video-container-v1{display:flex;width:1200px;margin:auto}
.left-container{width:820px}.right-container{width:350px;margin-left:30px}
.video-info-container{height:90px}.video-info-container h1{font-size:24px;margin:12px 0}
.video-info-detail-list{height:24px}.player-wrap{width:820px;height:460px}
.bpx-player-container{background:#101820}video{display:block;width:100%;height:100%}
.up-info-container{height:104px}.recommend-list-v1{margin-top:12px}
.video-page-card-small{height:95px}.pic-box{background:#b4c5ce}.card-box{display:flex}
.video-toolbar-left{height:40px}.video-desc{height:80px}
</style></head><body><header class="bili-header">Native header</header><div id="app">
<div id="mirror-vdcon" class="video-container-v1"><div class="left-container">
<div class="video-info-container"><h1>沿着海岸线，记录日落前的最后一束光</h1><div class="video-info-detail-list">12.8 万播放 · 2 天前</div></div>
<div id="playerWrap" class="player-wrap"><div class="bpx-player-container" data-screen="normal"><video id="native-video" muted></video></div></div>
<div id="arc_toolbar_report" class="video-toolbar-container"><div class="video-toolbar-left"><button>点赞</button><button>收藏</button></div></div>
<div id="v_desc" class="video-desc">傍晚的海风与远处的灯塔</div><div id="comment-module">评论</div>
</div><aside class="right-container"><div class="right-container-inner">
<div class="up-info-container"><a class="up-name" href="https://space.bilibili.com/123">海岸手记</a><button>关注</button></div>
<div class="recommend-list-v1">__CARDS__</div></div></aside></div></div></body></html>"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', default=os.environ.get('BROWSER_EXECUTABLE', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'))
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
    content = next(entry for entry in manifest['content_scripts'] if 'src/core/app.js' in entry.get('js', []))
    css = '\n'.join((ROOT / name).read_text(encoding='utf-8') for name in content['css'])
    sources = '\n;\n'.join((ROOT / name).read_text(encoding='utf-8') for name in content['js'] if name not in ['src/core/app.js', 'src/page/preflight.js'])
    card = '<div class="video-page-card-small"><a class="card-box" href="/video/BVrelated"><div class="pic-box"></div><div class="info"><span class="title">旅行中的片刻宁静</span><span class="upname">海岸手记</span><span class="playinfo">2.4 万播放</span></div></a></div>'
    fixture = FIXTURE.replace('__CSS__', css).replace('__CARDS__', card * 4)
    errors = []
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.browser, headless=True)
        context = browser.new_context()
        context.route('**/*', lambda route: route.fulfill(body=fixture, content_type='text/html') if route.request.resource_type == 'document' else route.abort())
        context.add_init_script(MOCK + "\nwindow.__shifts=[];new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)__shifts.push(e.value)}).observe({type:'layout-shift',buffered:true});")

        def settle(page):
            page.evaluate('() => new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')

        def geometry(page):
            return page.evaluate("regions=>Object.fromEntries(Object.entries(regions).map(([key,selector])=>{const r=document.querySelector(selector).getBoundingClientRect();return [key,{x:r.x,y:r.y,width:r.width,height:r.height}]}))", REGIONS)

        def same(before, after):
            for name in before:
                for dimension in before[name]:
                    assert abs(before[name][dimension] - after[name][dimension]) < .1, (name, dimension, before, after)

        def setup(width, theme='light'):
            page = context.new_page()
            page.set_viewport_size({'width': width, 'height': 1000})
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto('https://www.bilibili.com/video/BVfixture', wait_until='load')
            page.evaluate('(theme)=>document.documentElement.dataset.btTheme=theme', theme)
            page.add_script_tag(content=sources)
            page.evaluate("window.__native=document.querySelector('#native-video');window.__toolbar=document.querySelector('#arc_toolbar_report');window.__hydrated=false;window.__watch=BiliTubeWatch.createDecorator(document)")
            settle(page)
            return page

        def mount(page, theme):
            page.evaluate("theme=>__watch.mount({bvid:'BVfixture',creator:{name:'海岸手记',href:'https://space.bilibili.com/123'}},{canDecorateAuthor:()=>__hydrated,toggleWatchLater:async()=>true,followSpace:async()=>true},theme,{href:location.href})", theme)
            settle(page)

        for width, theme in [(390,'light'), (1000,'dark'), (1440,'light'), (1920,'dark')]:
            page = setup(width, theme)
            before = geometry(page)
            assert before['player']['y'] == 72, before
            page.screenshot(path=str(OUTPUT / f'{width}-prepaint.png'))
            mount(page, theme)
            same(before, geometry(page))
            assert page.locator('.bt-watch-author-row').count() == 0
            assert page.locator('.recommend-list-v1').is_hidden()
            page.wait_for_timeout(250)
            page.evaluate('window.__hydrated=true;__watch.updateContext({})')
            settle(page)
            same(before, geometry(page))
            assert page.locator('.bt-watch-author-row').count() == 1
            assert page.evaluate("__native===document.querySelector('#native-video')&&__toolbar===document.querySelector('#arc_toolbar_report')")
            if width > 900:
                assert page.locator('.recommend-list-v1').is_visible()
                assert page.locator('.recommend-list-v1').bounding_box()['y'] == 72
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
            page.screenshot(path=str(OUTPUT / f'{width}-ready.png'))
            score = page.evaluate('__shifts.reduce((a,b)=>a+b,0)')
            assert score < .001, (width, score)
            results.append({'width': width, 'theme': theme, 'geometry': before, 'layoutShiftScore': score, 'checks': 'prepaint / mount / hydration geometry identical; native nodes retained; no horizontal overflow'})
            # Vue resets the reused player's classes when a recommendation opens.
            # Its native height can briefly be zero during the new media load.
            page.evaluate("document.querySelector('#playerWrap').className='player-wrap';document.querySelector('#playerWrap').style.height='0px'")
            settle(page)
            same(before, geometry(page))
            assert page.evaluate("__native===document.querySelector('#native-video')&&__native.isConnected")
            assert page.locator('#playerWrap').evaluate("node=>getComputedStyle(node).order") == '0'

            # Some route updates replace the outer host. Follow the new host,
            # including subsequent class rewrites and native player mode changes.
            page.evaluate("""() => {
              const old=document.querySelector('#playerWrap'), next=document.createElement('div');
              next.id=old.id;next.className='player-wrap';
              next.append(...old.childNodes);old.replaceWith(next);
              const comments=document.createElement('div');comments.id='comment-module';comments.textContent='New comments';
              document.querySelector('#comment-module').replaceWith(comments);
            }""")
            settle(page)
            page.evaluate("document.querySelector('#playerWrap').className='player-wrap';document.querySelector('#playerWrap').style.height='0px'")
            settle(page)
            same(before, geometry(page))
            assert page.locator('#comment-module').evaluate("node=>getComputedStyle(node).order") == '5'
            for mode, root_class in [('mini','bt-player-mini'), ('wide','bt-player-wide'), ('web','bt-player-web-fullscreen')]:
                page.evaluate("mode=>document.querySelector('.bpx-player-container').dataset.screen=mode", mode)
                settle(page)
                assert page.evaluate('name=>document.documentElement.classList.contains(name)', root_class)
                page.evaluate("document.querySelector('.bpx-player-container').dataset.screen='normal'")
                settle(page)
                same(before, geometry(page))
            assert page.evaluate("__native===document.querySelector('#native-video')&&__native.isConnected")
            results.append({'width': width, 'checks': 'player class rewrite / replacement stays above title; observer rebinds; late comments ordered; mini / wide / web exit restores geometry; native video retained'})
            page.evaluate('__watch.destroy()')
            settle(page)
            assert page.locator('.recommend-list-v1').is_visible()
            assert page.locator('.up-info-container').is_visible()
            page.evaluate("document.querySelector('#playerWrap').className='player-wrap'")
            settle(page)
            assert page.locator('.bt-native-watch-player-host').count() == 0
            page.close()

        page = setup(1440)
        mount(page, 'light')
        before = geometry(page)
        page.wait_for_function("document.documentElement.classList.contains('bt-watch-author-fallback')", timeout=8000)
        same(before, geometry(page))
        assert page.locator('.up-info-container').is_visible()
        related_before = page.locator('.recommend-list-v1').bounding_box()
        page.evaluate('window.__hydrated=true;__watch.updateContext({})')
        settle(page)
        assert page.locator('.bt-watch-author-row').count() == 0
        assert related_before == page.locator('.recommend-list-v1').bounding_box()
        results.append({'checks': 'hydration timeout reveals native author and recommendations; late hydration retains the visible layout'})
        page.set_viewport_size({'width':390,'height':1000})
        settle(page)
        before = geometry(page)
        page.evaluate('__watch.updateContext({})')
        settle(page)
        same(before, geometry(page))
        assert page.locator('.bt-watch-author-row').count() == 1
        results.append({'checks': 'after narrowing a fallback page, late author data fills the reserved slot without shifting content'})
        page.close()
        assert not errors, errors
        report = {'kind': 'isolated Watch layout fixtures', 'browser': browser.version, 'results': results, 'page_errors': errors}
        browser.close()
    (OUTPUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=True, indent=2))


if __name__ == '__main__':
    main()
