"""Check recommendation-tab settings against the real extension and a public video.

Uses a temporary logged-out Edge profile; it never uses a user's browser profile.
"""
from __future__ import annotations

import argparse
import json
import os
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output' / 'playwright' / 'recommendation-navigation'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser',default=os.environ.get('BROWSER_EXECUTABLE',r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'))
    parser.add_argument('--url',default='https://www.bilibili.com/video/BV1cU4y1A7ud/')
    args=parser.parse_args()
    OUTPUT.mkdir(parents=True,exist_ok=True)
    checks=[]
    with tempfile.TemporaryDirectory(prefix='bilitube-recommendations-') as profile:
        with sync_playwright() as p:
            context=p.chromium.launch_persistent_context(profile,executable_path=args.browser,headless=True,viewport={'width':1440,'height':900},
                args=[f'--disable-extensions-except={ROOT}',f'--load-extension={ROOT}'],
                ignore_default_args=['--disable-extensions','--disable-component-extensions-with-background-pages'])
            try:
                workers=[worker for worker in context.service_workers if '/src/background.js' in worker.url]
                worker=workers[0] if workers else context.wait_for_event('serviceworker',predicate=lambda item:'/src/background.js' in item.url,timeout=15000)
                extension_id=urlsplit(worker.url).netloc
                options=context.new_page()
                options.goto(f'chrome-extension://{extension_id}/src/options/options.html',wait_until='load')
                setting=options.locator('#openRecommendationsInNewTab')
                expect(setting).to_be_checked()

                page=context.pages[0]
                page.goto(args.url,wait_until='domcontentloaded',timeout=30000)
                page.wait_for_selector('.bt-native-watch-related a[href*="/video/"]',timeout=30000)
                page.wait_for_function("document.documentElement.classList.contains('bt-watch-ready')")
                search=page.locator('#bilitube-watch-layer .bt-search-input')
                unfocused=search.evaluate('e=>getComputedStyle(e).borderColor')
                search.focus();search.fill('changey')
                focus=search.evaluate('''e=>({border:getComputedStyle(e).borderColor,outline:getComputedStyle(e).outlineStyle,
                    shadow:getComputedStyle(e).boxShadow,filter:getComputedStyle(e.parentElement).filter,visible:e.matches(':focus-visible')})''')
                assert focus['visible'] and focus['outline']=='none' and focus['filter']=='none' and focus['border']!=unfocused,focus
                page.screenshot(path=str(OUTPUT/'search-focus.png'))
                checks.append('Search focus uses one visible border without an offset outline or whole-form glow')

                link=page.locator('.bt-native-watch-related a[href*="/video/"]').filter(visible=True).first
                old_target=link.get_attribute('target')
                source=page.url
                with page.expect_popup(timeout=10000) as popup_info:link.click()
                popup=popup_info.value
                popup.wait_for_url('**/video/**',timeout=20000)
                page.wait_for_timeout(300)
                assert page.url==source,(source,page.url)
                popup.close()
                checks.append('With the default enabled, a native related-video click opens one new tab without changing the original video')

                setting.uncheck()
                page.wait_for_function('([selector,target])=>document.querySelector(selector)?.getAttribute("target")===target',arg=['.bt-native-watch-related a[href*="/video/"]',old_target])
                link=page.locator('.bt-native-watch-related a[href*="/video/"]').filter(visible=True).first
                source=page.url
                with context.expect_page(timeout=10000) as popup_info:link.click(modifiers=['Control'])
                popup=popup_info.value;popup.wait_for_url('**/video/**',timeout=20000)
                assert page.url==source
                popup.close()
                # Some native recommendation variants supply target=_blank.
                # A plain click must still follow the user's same-tab setting.
                link.evaluate("el=>el.setAttribute('target','_blank')")
                before_path=urlsplit(page.url).path.rstrip('/')
                page_count=len(context.pages)
                link=page.locator('.bt-native-watch-related a[href*="/video/"]').filter(visible=True).first
                link.click()
                page.wait_for_function(r'old=>location.pathname.replace(/\/$/,"")!==old',arg=before_path,timeout=20000)
                assert len(context.pages)==page_count
                checks.append('Turning the preference off restores the original target and native same-tab navigation')

                setting.check()
                page.wait_for_timeout(500)
                page.wait_for_selector('.bt-native-watch-related a[href*="/video/"]',timeout=20000)
                page.wait_for_timeout(500)
                source=page.url
                link=page.locator('.bt-native-watch-related a[href*="/video/"]').filter(visible=True).first
                with page.expect_popup(timeout=10000) as popup_info:link.click()
                popup=popup_info.value;popup.wait_for_url('**/video/**',timeout=20000)
                page.wait_for_timeout(300)
                assert page.url==source
                popup.close()
                page.evaluate('''()=>{window.__recKeyEvents=[];for(const type of ['keydown','click'])document.addEventListener(type,e=>window.__recKeyEvents.push({type,key:e.key||'',button:e.button,ctrl:e.ctrlKey,target:e.target?.outerHTML?.slice(0,300),defaultPrevented:e.defaultPrevented}),true)}''')
                link.focus()
                try:
                    with page.expect_popup(timeout=10000) as popup_info:link.press('Enter')
                except Exception:
                    print(json.dumps({'keyEvents':page.evaluate('window.__recKeyEvents'),'active':page.evaluate('document.activeElement?.outerHTML.slice(0,400)'),'source':page.url},ensure_ascii=False))
                    raise
                popup=popup_info.value;popup.wait_for_url('**/video/**',timeout=20000)
                assert page.url==source
                popup.close()
                try:
                    with context.expect_page(timeout=10000) as popup_info:link.click(modifiers=['Control'])
                except Exception:
                    print(json.dumps({'ctrlEvents':page.evaluate('window.__recKeyEvents.slice(-4)'),'pages':[tab.url for tab in context.pages],'source':page.url},ensure_ascii=False))
                    raise
                popup=popup_info.value;popup.wait_for_url('**/video/**',timeout=20000)
                assert page.url==source
                popup.close()
                checks.append('Re-enabling after a native video transition supports mouse, keyboard and Ctrl-click without navigating the source')

                page.goto('https://www.bilibili.com/',wait_until='domcontentloaded',timeout=30000)
                card=page.locator('.bt-home-recommendation .bt-card-title').first
                expect(card).to_be_visible(timeout=30000)
                expect(card).to_have_attribute('target','_blank')
                assert page.locator('.bt-home-recommendation .bt-card-author').first.get_attribute('target') is None
                source=page.url
                with page.expect_popup(timeout=10000) as popup_info:card.click()
                popup=popup_info.value;popup.wait_for_url('**/video/**',timeout=20000)
                assert page.url==source
                popup.close()
                setting.uncheck()
                page.wait_for_function("document.querySelector('.bt-home-recommendation .bt-card-title')?.getAttribute('target')===null")
                page_count=len(context.pages)
                card.click()
                page.wait_for_url('**/video/**',timeout=20000)
                assert len(context.pages)==page_count
                options.reload(wait_until='load')
                expect(options.locator('#openRecommendationsInNewTab')).not_to_be_checked()
                checks.append('Home recommendation links follow live settings changes and the preference persists; creator links stay independent')
            finally:
                context.close()
    report={'checks':checks,'environment':'unpacked extension; public Bilibili pages; temporary logged-out profile'}
    (OUTPUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=='__main__':main()
