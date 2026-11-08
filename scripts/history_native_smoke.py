"""Exercise current native Bilibili History with isolated, intercepted history data."""
from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
import time
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output' / 'history-native'
DEFAULT_BROWSER = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', default=os.environ.get('BROWSER_EXECUTABLE', DEFAULT_BROWSER))
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    now = int(time.time())
    names = ['相机与光影：记录一天的故事', '一台轻薄笔记本的使用体验', '城市里的周末散步', '从零开始的摄影练习', '一段值得重看的旅行']
    items = [{'kid':i+1, 'title':title, 'cover':f'https://fixture.invalid/cover/{i}.svg',
              'duration':899, 'progress':70*i+30, 'view_at':now-(i//3)*86400-60*i,
              'author_mid':100+i, 'author_name':f'创作者 {i+1}', 'is_fav':0,
              'history':{'business':'archive', 'bvid':f'BVfixture{i}', 'oid':i+1, 'page':1, 'dt':2}}
             for i, title in enumerate(names)]
    requests, errors, checks = [], [], []
    with sync_playwright() as playwright, tempfile.TemporaryDirectory(prefix='history-fixture-',dir=str(OUTPUT)) as profile:
        context = playwright.chromium.launch_persistent_context(
            profile, executable_path=args.browser, headless=True,
            ignore_default_args=['--disable-extensions','--disable-component-extensions-with-background-pages'],
            args=[f'--disable-extensions-except={ROOT}',f'--load-extension={ROOT}','--no-first-run'],
            viewport={'width':1920,'height':1080}, reduced_motion='reduce')
        try:
            context.add_cookies([{'name':'historyviewmode','value':'grid','domain':'.bilibili.com','path':'/'}])
            page = context.new_page()
            page.on('pageerror', lambda error:errors.append(str(error)))

            def history_api(route):
                req = route.request
                path = urlparse(req.url).path
                query = parse_qs(urlparse(req.url).query)
                requests.append({'path':path,'method':req.method,'query':query})
                headers = {'access-control-allow-origin':'https://www.bilibili.com',
                           'access-control-allow-credentials':'true',
                           'access-control-allow-methods':'GET,POST,OPTIONS',
                           'access-control-allow-headers':'*'}
                if req.method == 'OPTIONS':
                    return route.fulfill(status=204,headers=headers,body='')
                if path.endswith('/history/cursor'):
                    data = {'code':0,'data':{'list':items if not int(query.get('max',['0'])[0] or 0) else [],
                                             'cursor':{'max':1,'view_at':now-86400,'business':'archive'}}}
                elif path.endswith('/history/search'):
                    data = {'code':0,'data':{'list':items[:2],'has_more':False}}
                elif path.endswith('/history/shadow'):
                    data = {'code':0,'data':0}
                else:
                    data = {'code':0,'data':{}}
                route.fulfill(status=200,headers=headers,content_type='application/json',body=json.dumps(data,ensure_ascii=False))

            # All private-history reads and writes are fulfilled locally; this
            # temporary browser profile never accesses the user's account.
            page.route('**/x/web-interface/history/**',history_api)
            page.route('**/x/v2/history/**',history_api)
            page.route('https://fixture.invalid/**',lambda route:route.fulfill(
                content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><rect width="640" height="360" fill="#56728b"/><circle cx="420" cy="130" r="80" fill="#dbba82"/><path d="M0 320 L210 110 390 320 520 175 640 300 V360 H0" fill="#263f4d"/></svg>'))

            page.goto('https://www.bilibili.com/history',wait_until='domcontentloaded',timeout=30000)
            expect(page.locator('.history-card').first).to_be_visible(timeout=20000)
            expect(page.locator('.history-card.grid-mode').first).to_be_visible()
            first,second = page.locator('.history-card').nth(0),page.locator('.history-card').nth(1)
            cover = first.locator('.bili-video-card__cover').bounding_box()
            detail = first.locator('.bili-video-card__details').bounding_box()
            first_box, second_box = first.bounding_box(),second.bounding_box()
            actions = page.locator('.breadcrumbs.normal .right').bounding_box()
            assert detail['x'] > cover['x']+cover['width'] and second_box['y'] > first_box['y']
            assert first_box['x']+first_box['width'] < actions['x']
            assert abs(cover['width']/cover['height']-16/9)<.01
            assert page.locator('.section-title').first.inner_text() == '今天'
            page.screenshot(path=str(OUTPUT/'history-light.png'))
            checks.append('Native grid cards render as dated single-column rows with separate management controls')

            page.mouse.wheel(0,700)
            expect(page.locator('.history-card')).to_have_count(5,timeout=10000)
            checks.append('Native lazy sections render when their date group reaches the viewport')

            page.locator('.lists-view-mode__action').click()
            expect(page.locator('.history-card.list-mode').first).to_be_visible()
            cover=page.locator('.history-card.list-mode .history-card__left').first.bounding_box()
            info=page.locator('.history-card.list-mode .history-card__right').first.bounding_box()
            assert info['x'] >= cover['x']+cover['width']
            page.locator('.lists-view-mode__action').click()
            expect(page.locator('.history-card.grid-mode').first).to_be_visible()
            grid_a,grid_b=page.locator('.history-card').nth(0).bounding_box(),page.locator('.history-card').nth(1).bounding_box()
            assert abs(grid_a['y']-grid_b['y'])<2 and grid_b['x']>grid_a['x']
            grid_cover=page.locator('.history-card.grid-mode .bili-video-card__cover').first.bounding_box()
            assert grid_cover and grid_cover['width']>100 and grid_cover['height']>50
            page.reload(wait_until='domcontentloaded')
            expect(page.locator('html')).to_have_class(re.compile('bt-history-view-chosen'))
            expect(page.locator('.history-card.grid-mode').first).to_be_visible(timeout=20000)
            grid_a,grid_b=page.locator('.history-card').nth(0).bounding_box(),page.locator('.history-card').nth(1).bounding_box()
            assert abs(grid_a['y']-grid_b['y'])<2 and grid_b['x']>grid_a['x']
            checks.append('Native view switch restores a real grid and remembers the user choice after reload')

            page.locator('.radio-tabs__item').filter(has_text='视频').click()
            page.wait_for_timeout(300)
            assert any(r['path'].endswith('/history/cursor') and r['query'].get('type')==['archive'] for r in requests)
            page.locator('.radio-tabs__item').filter(has_text='综合').click()
            checks.append('Native history category tabs continue to request their selected type')

            page.locator('.filter-switcher').click()
            expect(page.locator('.breadcrumbs__bottom .filters')).to_be_visible()
            page.locator('.radio-filter__item').filter(has_text='10-30分钟').first.click()
            page.wait_for_function("() => document.querySelector('.radio-filter__item--active')?.textContent.includes('10-30')")
            assert any(r['path'].endswith('/history/search') and r['query'].get('arc_min_duration')==['600'] and r['query'].get('arc_max_duration')==['1800'] for r in requests)
            checks.append('Native advanced duration filter sends the expected search parameters')

            field=page.locator('.search-bar-input');field.fill('相机');field.press('Enter')
            page.wait_for_timeout(300)
            assert any(r['path'].endswith('/history/search') and r['query'].get('keyword')==['相机'] for r in requests)
            checks.append('Native history search remains interactive')

            page.reload(wait_until='domcontentloaded');expect(page.locator('.history-card').first).to_be_visible(timeout=20000)
            page.locator('.batch-manage-btn').click()
            expect(page.locator('.breadcrumbs.editing')).to_be_visible()
            page.locator('.history-card .checkbox-mask').first.click()
            expect(page.locator('.selected-tips')).not_to_contain_text('0')
            page.locator('.breadcrumbs.editing .batch-manage-btn').click()
            expect(page.locator('.breadcrumbs.normal')).to_be_visible()
            checks.append('Native batch management opens, selects a record and cancels')

            page.locator('button.clear-btn').click()
            expect(page.locator('.history-confirm-modal .vui_dialog--content')).to_be_visible()
            page.locator('.history-confirm-modal .vui_dialog--btn-cancel').click()
            assert not any(r['path'].endswith('/history/clear') and r['method']=='POST' for r in requests)
            page.locator('.record-switcher .vui_switch-core').click()
            expect(page.locator('.history-confirm-modal .vui_dialog--content')).to_be_visible()
            page.locator('.history-confirm-modal .vui_dialog--btn-cancel').click()
            expect(page.locator('.record-switcher .vui_switch--switch')).to_have_attribute('aria-checked','true')
            page.locator('.record-switcher .vui_switch-core').click()
            page.locator('.history-confirm-modal .vui_dialog--btn-confirm').click()
            expect(page.locator('.record-switcher .vui_switch--switch')).to_have_attribute('aria-checked','false')
            page.locator('.record-switcher .vui_switch-core').click()
            expect(page.locator('.record-switcher .vui_switch--switch')).to_have_attribute('aria-checked','true')
            assert len([r for r in requests if r['path'].endswith('/history/shadow/set') and r['method']=='POST'])==2
            page.locator('button.clear-btn').click()
            page.locator('.history-confirm-modal .vui_dialog--btn-confirm').click()
            page.wait_for_timeout(300)
            assert any(r['path'].endswith('/history/clear') and r['method']=='POST' for r in requests)
            expect(page.locator('.history-card').first).to_be_visible()
            checks.append('Native clear-history and pause/resume confirmations reach isolated fixture endpoints')

            page.locator('.history-card.grid-mode .bili-card-aside-action').first.click()
            page.wait_for_timeout(300)
            assert any(r['path'].endswith('/history/delete') and r['method']=='POST' for r in requests)
            checks.append('Native per-record delete reaches the isolated fixture endpoint')

            page.locator('.bt-theme-button').click()
            expect(page.locator('html')).to_have_attribute('data-bt-theme','dark')
            active=page.locator('.radio-tabs__item--active .content').first
            assert active.evaluate("n=>getComputedStyle(n).color!==getComputedStyle(n.parentElement).backgroundColor")
            page.screenshot(path=str(OUTPUT/'history-dark.png'))
            page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(500)
            mobile=page.evaluate('''() => ({width:innerWidth,scroll:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('body *')].map(n=>({tag:n.tagName,cls:typeof n.className==='string'?n.className:'',right:n.getBoundingClientRect().right,width:n.getBoundingClientRect().width,position:getComputedStyle(n).position})).filter(n=>n.width>0&&n.right>innerWidth+1).slice(0,16)})''')
            assert mobile['scroll']<=mobile['width']+1,mobile
            expect(page.locator('.filter-switcher')).to_be_visible()
            expect(page.locator('.batch-manage-btn')).to_be_visible()
            page.screenshot(path=str(OUTPUT/'history-narrow.png'))
            field=page.locator('.search-bar-input');expect(field).to_be_visible();field.fill('窄屏');field.press('Enter')
            page.wait_for_timeout(300)
            assert any(r['path'].endswith('/history/search') and r['query'].get('keyword')==['窄屏'] for r in requests)
            page.locator('.batch-manage-btn').click()
            expect(page.locator('.breadcrumbs.editing .select-all')).to_be_visible()
            expect(page.locator('.breadcrumbs.editing .batch-manage-btn')).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            page.locator('.breadcrumbs.editing .batch-manage-btn').click()
            checks.append('Dark theme and narrow viewport keep controls accessible without horizontal page overflow')
            assert not errors,errors
            report={'kind':'current Bilibili page with intercepted synthetic history data','browser':context.browser.version,
                    'checks':checks,'page_errors':errors}
            (OUTPUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
            print(json.dumps(report,ensure_ascii=True,indent=2))
        finally:
            context.close()


if __name__=='__main__':
    main()
