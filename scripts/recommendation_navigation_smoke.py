"""Check recommendation and search navigation using the unpacked extension.

Visits public Bilibili pages in a temporary, logged-out Edge profile.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output' / 'playwright' / 'recommendation-navigation'
RELATED = '.right-container a[href*="/video/"]'
HOME_CARD = '.bt-home-recommendation .bt-card-title'
SEARCH_URL = re.compile(r'^https://search\.bilibili\.com/')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', default=os.environ.get('BROWSER_EXECUTABLE', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'))
    parser.add_argument('--url', default='https://www.bilibili.com/video/BV1cU4y1A7ud/')
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    checks = []
    with tempfile.TemporaryDirectory(prefix='bilitube-navigation-') as profile:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                profile, executable_path=args.browser, headless=True, viewport={'width': 1440, 'height': 900},
                args=[f'--disable-extensions-except={ROOT}', f'--load-extension={ROOT}'],
                ignore_default_args=['--disable-extensions', '--disable-component-extensions-with-background-pages'])
            try:
                workers = [worker for worker in context.service_workers if '/src/background.js' in worker.url]
                worker = workers[0] if workers else context.wait_for_event('serviceworker', predicate=lambda item: '/src/background.js' in item.url, timeout=15000)
                # Existing installations may have the old shared setting enabled.
                worker.evaluate("() => chrome.storage.local.set({bilitubeCoreSettings:{openRecommendationsInNewTab:true}})")
                options = context.new_page()
                options.goto(f'chrome-extension://{urlsplit(worker.url).netloc}/src/options/options.html', wait_until='load')
                home_setting = options.locator('#openHomeRecommendationsInNewTab')
                watch_setting = options.locator('#openWatchRecommendationsInNewTab')
                expect(home_setting).to_be_checked()
                expect(watch_setting).not_to_be_checked()
                checks.append('The former shared preference yields separate defaults: home new tab, Watch current tab')

                page = context.new_page()

                def wait_for_setting(key, value):
                    options.wait_for_function("([key,value])=>new Promise(resolve=>chrome.storage.local.get('bilitubeCoreSettings', data=>resolve(data.bilitubeCoreSettings?.[key]===value)))", arg=[key, value])
                    page.wait_for_timeout(300)

                def wait_for_related():
                    expect(page.locator(RELATED).filter(visible=True).first).to_be_visible(timeout=30000)
                    page.wait_for_function("document.documentElement.classList.contains('bt-watch-ready')", timeout=30000)
                    return page.locator(RELATED).filter(visible=True).first

                def new_tab(action, url_pattern):
                    source = page.url
                    with context.expect_page(timeout=10000) as popup_info:
                        action()
                    popup = popup_info.value
                    popup.wait_for_url(url_pattern, timeout=20000)
                    assert page.url == source, (source, page.url)
                    return popup

                def check_search_url(tab, keyword):
                    assert parse_qs(urlsplit(tab.url).query).get('keyword') == [keyword], tab.url

                page.goto(args.url, wait_until='domcontentloaded', timeout=30000)
                link = wait_for_related()
                search = page.locator('#bilitube-watch-layer .bt-search-input')
                unfocused = search.evaluate('e=>getComputedStyle(e).borderColor')
                search.focus()
                search.fill('changey')
                focus = search.evaluate("e=>({border:getComputedStyle(e).borderColor,outline:getComputedStyle(e).outlineStyle,filter:getComputedStyle(e.parentElement).filter,visible:e.matches(':focus-visible')})")
                assert focus['visible'] and focus['outline'] == 'none' and focus['filter'] == 'none' and focus['border'] != unfocused, focus
                page.screenshot(path=str(OUTPUT / 'search-focus.png'))
                checks.append('Search focus uses one visible border without an offset outline or whole-form glow')
                # A modified click keeps the browser's normal new-tab action.
                popup = new_tab(lambda: link.click(modifiers=['Control']), '**/video/**')
                popup.close()
                link = wait_for_related()
                popup = new_tab(lambda: link.click(button='middle'), '**/video/**')
                popup.close()
                link = wait_for_related()
                # Even when the native site requests _blank, a normal click follows
                # the Watch current-tab preference.
                link.evaluate("el=>el.setAttribute('target','_blank')")
                source_path = urlsplit(page.url).path
                count = len(context.pages)
                link.click()
                page.wait_for_function('old=>location.pathname!==old', arg=source_path, timeout=20000)
                assert len(context.pages) == count
                wait_for_related()
                checks.append('Watch recommendations open in the current tab by default; Ctrl-click and middle-click open new tabs')

                watch_setting.check()
                wait_for_setting('openWatchRecommendationsInNewTab', True)
                expect(home_setting).to_be_checked()
                link = wait_for_related()
                popup = new_tab(lambda: link.click(), '**/video/**')
                popup.close()
                popup = new_tab(lambda: link.press('Enter'), '**/video/**')
                popup.close()
                popup = new_tab(lambda: link.click(modifiers=['Control']), '**/video/**')
                popup.close()
                watch_setting.uncheck()
                wait_for_setting('openWatchRecommendationsInNewTab', False)
                link = wait_for_related()
                link.evaluate("el=>el.setAttribute('target','_blank')")
                source_path = urlsplit(page.url).path
                count = len(context.pages)
                link.click()
                page.wait_for_function('old=>location.pathname!==old', arg=source_path, timeout=20000)
                assert len(context.pages) == count
                wait_for_related()
                checks.append('The Watch setting can be changed live without changing the home setting; mouse and Enter open a new tab when enabled')

                search = page.locator('#bilitube-watch-layer .bt-search-input')
                for method in ('enter', 'button'):
                    keyword = f'BiliTube watch {method}'
                    search.fill(keyword)
                    action = (lambda: search.press('Enter')) if method == 'enter' else (lambda: page.locator('#bilitube-watch-layer .bt-search-button').click())
                    popup = new_tab(action, SEARCH_URL)
                    check_search_url(popup, keyword)
                    popup.close()
                search.fill('')
                search.focus()
                history = page.locator('#bilitube-watch-layer .bt-search-history-item').first
                expect(history).to_be_visible(timeout=5000)
                popup = new_tab(lambda: history.click(), SEARCH_URL)
                assert parse_qs(urlsplit(popup.url).query).get('keyword')
                popup.close()
                checks.append('Watch searches from Enter, the search button and history open new tabs with the expected keyword')

                def goto_home():
                    page.goto('https://www.bilibili.com/', wait_until='domcontentloaded', timeout=30000)
                    expect(page.locator(HOME_CARD).first).to_be_visible(timeout=30000)

                goto_home()
                card = page.locator(HOME_CARD).first
                expect(card).to_have_attribute('target', '_blank')
                assert page.locator('.bt-home-recommendation .bt-card-author').first.get_attribute('target') is None
                popup = new_tab(lambda: card.click(), '**/video/**')
                popup.close()
                home_setting.uncheck()
                wait_for_setting('openHomeRecommendationsInNewTab', False)
                expect(watch_setting).not_to_be_checked()
                expect(card).not_to_have_attribute('target', '_blank')
                popup = new_tab(lambda: card.click(modifiers=['Control']), '**/video/**')
                popup.close()
                count = len(context.pages)
                card.click()
                page.wait_for_url('**/video/**', timeout=20000)
                assert len(context.pages) == count
                checks.append('Home recommendations default to a new tab; the independent setting and Ctrl-click work in the current tab')

                for method in ('enter', 'button'):
                    goto_home()
                    keyword = f'BiliTube home {method}'
                    search = page.locator('.bt-topbar .bt-search-input').first
                    search.fill(keyword)
                    count = len(context.pages)
                    if method == 'enter':
                        search.press('Enter')
                    else:
                        page.locator('.bt-topbar .bt-search-button').first.click()
                    page.wait_for_url(SEARCH_URL, timeout=20000)
                    check_search_url(page, keyword)
                    assert len(context.pages) == count
                options.reload(wait_until='load')
                expect(home_setting).not_to_be_checked()
                expect(watch_setting).not_to_be_checked()
                checks.append('Home searches from Enter and the search button use the current tab; both settings persist')
            finally:
                context.close()
    report = {'checks': checks, 'environment': 'unpacked extension; public Bilibili pages; temporary logged-out profile'}
    (OUTPUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
