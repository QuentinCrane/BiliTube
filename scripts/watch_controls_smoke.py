"""Exercise native-style Watch control hit testing and player-mode CSS isolation.

The default run is an offline BPX-shaped fixture. --live additionally checks a
public Bilibili video with the unpacked extension in a temporary browser profile.
"""
from __future__ import annotations

import argparse
import json
import os
import tempfile
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output' / 'playwright' / 'watch-controls'
BROWSER = os.environ.get('BROWSER_EXECUTABLE', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')

FIXTURE = r'''<!doctype html><html class="bt-watch-decorated"><head><meta charset="utf-8">
<style>
body{margin:0;padding:28px;background:#eee;font-family:Arial,sans-serif}
.bpx-player-container{position:relative;width:min(calc(100vw - 400px),1100px);min-width:650px;height:390px;background:linear-gradient(145deg,#567080,#b3aaa0)}
.bpx-player-control-wrap{position:absolute;bottom:0;left:0;right:0;color:white}
.bpx-player-control-top{height:16px;padding:0 12px}.bpx-player-progress-area{height:12px;cursor:pointer}
.bpx-player-progress-schedule{background:#aaa}.bpx-player-progress-schedule-current{width:22%}
.bpx-player-control-bottom{display:flex;justify-content:space-between;align-items:center;height:40px}
.bpx-player-control-bottom-left,.bpx-player-control-bottom-right{display:flex;align-items:center}
.bpx-player-ctrl-btn{position:relative;width:36px;height:36px;cursor:pointer;text-align:center;line-height:36px}
.bpx-player-ctrl-eplist{visibility:hidden;width:0;padding:0}
.bpx-player-pc-app[data-screen="normal"] .bpx-player-ctrl-eplist{visibility:visible;width:36px}
.bpx-player-ctrl-time-label{position:absolute;inset:0;white-space:nowrap}.bpx-player-ctrl-time-seek{display:none;position:absolute;left:8px;top:8px;width:80px}
.bpx-player-ctrl-quality-menu-wrap,.bpx-player-ctrl-setting-menu{display:none;position:absolute;bottom:40px;left:0;padding:12px;background:#222;color:white}
.is-open .bpx-player-ctrl-quality-menu-wrap,.is-open .bpx-player-ctrl-setting-menu{display:block}
</style><style>__CSS__</style></head><body>
<div class="bpx-player-container" data-screen="normal"><div class="bpx-player-control-wrap">
 <div class="bpx-player-control-top"><div class="bpx-player-progress-area"><div class="bpx-player-progress-schedule"><div class="bpx-player-progress-schedule-current"></div></div></div></div>
 <div class="bpx-player-control-bottom"><div class="bpx-player-control-bottom-left">
  <div class="bpx-player-ctrl-btn bpx-player-ctrl-prev" style="display:none" role="button">上一段</div>
  <div class="bpx-player-ctrl-btn bpx-player-ctrl-play" role="button" tabindex="0" aria-label="播放">▶</div>
  <div class="bpx-player-ctrl-btn bpx-player-ctrl-time" role="button"><input class="bpx-player-ctrl-time-seek"><div class="bpx-player-ctrl-time-label">00:12 / 33:06</div></div>
 </div><div class="bpx-player-control-bottom-right">
  <div class="bpx-player-ctrl-btn bpx-player-ctrl-quality" role="button"><span>720P 准高清</span><div class="bpx-player-ctrl-quality-menu-wrap"><div class="bpx-player-ctrl-quality-menu"><button>自动</button></div></div></div>
  <div class="bpx-player-ctrl-btn bpx-player-ctrl-eplist" role="button">选集</div>
  <div class="bpx-player-ctrl-btn bpx-player-ctrl-playbackrate" role="button">倍速</div>
  <div class="bpx-player-ctrl-btn bpx-player-ctrl-volume" role="button">音量</div>
  <div class="bpx-player-ctrl-btn bpx-player-ctrl-setting" role="button">设置<div class="bpx-player-ctrl-setting-menu"><label><input type="checkbox">循环</label></div></div>
  <div class="bpx-player-ctrl-btn bpx-player-ctrl-wide" role="button">宽屏</div>
  <div class="bpx-player-ctrl-btn bpx-player-ctrl-web" role="button">网页</div>
  <div class="bpx-player-ctrl-btn bpx-player-ctrl-full" role="button">全屏</div>
 </div></div>
</div></div><script>
const play=document.querySelector('.bpx-player-ctrl-play'), volume=document.querySelector('.bpx-player-ctrl-volume');
window.fixtureNodes={play,volume,setting:document.querySelector('.bpx-player-ctrl-setting')};
window.fixtureEvents={play:0,volume:0};
play.addEventListener('click',()=>fixtureEvents.play++);volume.addEventListener('click',()=>fixtureEvents.volume++);
document.querySelector('.bpx-player-ctrl-time').addEventListener('click',()=>{const input=document.querySelector('.bpx-player-ctrl-time-seek');input.style.display='block';input.focus()});
for(const selector of ['.bpx-player-ctrl-quality','.bpx-player-ctrl-setting']){
 const node=document.querySelector(selector);node.addEventListener('click',event=>{if(!event.target.closest('.bpx-player-ctrl-quality-menu-wrap,.bpx-player-ctrl-setting-menu'))node.classList.toggle('is-open')});
}
</script></body></html>'''


def offline(playwright, checks):
    css = (ROOT / 'src/styles/core.css').read_text(encoding='utf-8')
    browser = playwright.chromium.launch(executable_path=BROWSER, headless=True)
    page = browser.new_page(viewport={'width':1600,'height':800})
    page.set_content(FIXTURE.replace('__CSS__', css))
    left = page.locator('.bpx-player-control-bottom-left')
    right = page.locator('.bpx-player-control-bottom-right')
    prev = page.locator('.bpx-player-ctrl-prev')
    eplist = page.locator('.bpx-player-ctrl-eplist')
    expect(prev).to_be_hidden()
    assert eplist.evaluate("el=>getComputedStyle(el).visibility==='hidden' && el.getBoundingClientRect().width===0")
    assert left.evaluate("el=>getComputedStyle(el,'::before').backgroundColor!=='rgba(0, 0, 0, 0)'")
    assert page.locator('.bpx-player-ctrl-play').evaluate("el=>getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)'")
    for width in (1600, 1100, 950):
        page.set_viewport_size({'width':width,'height':800})
        a, b = left.bounding_box(), right.bounding_box()
        assert a['x'] + a['width'] <= b['x'], (width, a, b)
        assert right.evaluate("el=>getComputedStyle(el).borderRadius==='999px' && getComputedStyle(el).backgroundColor!=='rgba(0, 0, 0, 0)'")
    page.locator('.bpx-player-ctrl-play').click()
    page.locator('.bpx-player-ctrl-volume').click()
    assert page.evaluate('fixtureEvents.play===1 && fixtureEvents.volume===1 && fixtureNodes.play===document.querySelector(".bpx-player-ctrl-play")')
    page.locator('.bpx-player-ctrl-time').click()
    expect(page.locator('.bpx-player-ctrl-time-seek')).to_be_focused()
    page.locator('.bpx-player-ctrl-quality').click()
    expect(page.locator('.bpx-player-ctrl-quality-menu-wrap')).to_be_visible()
    page.locator('.bpx-player-ctrl-quality-menu button').click()
    page.locator('.bpx-player-ctrl-setting').click()
    page.locator('.bpx-player-ctrl-setting-menu input').check()
    assert page.locator('.bpx-player-ctrl-setting-menu input').is_checked()
    assert page.locator('.bpx-player-ctrl-setting-menu').evaluate("el=>getComputedStyle(el).borderRadius==='12px'")
    page.locator('.bpx-player-container').evaluate("el=>el.classList.add('bpx-player-pc-app')")
    assert eplist.evaluate("el=>getComputedStyle(el).visibility==='visible' && el.getBoundingClientRect().width===36")
    for mode in ('bt-player-wide', 'bt-player-mini', 'bt-player-web-fullscreen', 'bt-player-browser-fullscreen'):
        page.evaluate("mode=>document.documentElement.classList.add(mode)", mode)
        assert right.evaluate("el=>getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)'")
        page.evaluate("mode=>document.documentElement.classList.remove(mode)", mode)
    page.screenshot(path=str(OUTPUT/'fixture.png'))
    checks.append('Offline desktop control hit testing, native hidden/visible states, menus, and wide/mini/fullscreen style isolation')
    browser.close()


def live(playwright, checks):
    with tempfile.TemporaryDirectory(prefix='bilitube-watch-controls-') as profile:
        context = playwright.chromium.launch_persistent_context(
            profile, executable_path=BROWSER, headless=True, viewport={'width':1600,'height':1000},
            args=[f'--disable-extensions-except={ROOT}',f'--load-extension={ROOT}','--enable-extensions'],
            ignore_default_args=['--disable-extensions','--disable-component-extensions-with-background-pages'])
        page = context.pages[0] if context.pages else context.new_page()
        page.goto('https://www.bilibili.com/video/BV1eKem6VErq',wait_until='domcontentloaded',timeout=30000)
        page.wait_for_selector('.bt-native-watch-player-host .bpx-player-control-bottom',timeout=30000)
        page.wait_for_function("document.querySelector('video') && document.querySelector('video').readyState >= 2",timeout=30000)
        page.locator('.bpx-player-container').first.hover(position={'x':100,'y':100})
        page.wait_for_function("document.documentElement.classList.contains('bt-watch-ready')")
        video = page.locator('video').first
        play = page.locator('.bpx-player-ctrl-play').first
        time_alignment=page.locator('.bpx-player-ctrl-time').first.evaluate('''el=>{
          const a=el.getBoundingClientRect(),label=el.querySelector('.bpx-player-ctrl-time-label'),range=document.createRange();
          range.selectNodeContents(label);const b=range.getBoundingClientRect();
          return {horizontal:Math.abs((a.left+a.width/2)-(b.left+b.width/2)),vertical:Math.abs((a.top+a.height/2)-(b.top+b.height/2))};
        }''')
        assert time_alignment['horizontal']<1.5 and time_alignment['vertical']<3,time_alignment
        paused = video.evaluate('v=>v.paused')
        play.click()
        page.wait_for_function('before=>document.querySelector("video").paused!==before', arg=paused)
        play.click()
        page.wait_for_function('before=>document.querySelector("video").paused===before', arg=paused)
        volume = page.locator('.bpx-player-ctrl-volume').first
        initial_volume = video.evaluate('v=>v.volume')
        volume.click()
        page.wait_for_function('before=>document.querySelector("video").volume!==before', arg=initial_volume)
        volume.click()
        page.locator('.bpx-player-ctrl-time').first.click()
        expect(page.locator('.bpx-player-ctrl-time-seek').first).to_be_focused()
        edit_alignment=page.locator('.bpx-player-ctrl-time').first.evaluate('''el=>{
          const a=el.getBoundingClientRect(),b=el.querySelector('.bpx-player-ctrl-time-seek').getBoundingClientRect();
          return {horizontal:Math.abs((a.left+a.width/2)-(b.left+b.width/2)),vertical:Math.abs((a.top+a.height/2)-(b.top+b.height/2))};
        }''')
        assert edit_alignment['horizontal']<1.5 and edit_alignment['vertical']<1.5,edit_alignment
        page.keyboard.press('Escape')
        page.locator('.bpx-player-ctrl-quality').first.hover()
        expect(page.locator('.bpx-player-ctrl-quality-menu').first).to_be_visible()
        page.locator('.bpx-player-ctrl-setting').first.hover()
        expect(page.locator('.bpx-player-ctrl-setting-menu').first).to_be_visible()
        alignment=page.evaluate('''()=>[...document.querySelectorAll('.bpx-player-control-bottom .bpx-player-ctrl-btn > .bpx-player-ctrl-btn-icon')].map(icon=>{
          const parent=icon.parentElement,a=icon.getBoundingClientRect(),b=parent.getBoundingClientRect(),s=getComputedStyle(icon);
          return {visible:s.display!=='none'&&s.visibility!=='hidden'&&a.height>0,difference:Math.abs((a.top+a.height/2)-(b.top+b.height/2))};
        }).filter(item=>item.visible)''')
        assert alignment and all(item['difference']<1.1 for item in alignment), alignment
        assert page.locator('.bpx-player-control-bottom-left').first.evaluate("el=>getComputedStyle(el,'::before').backgroundColor!=='rgba(0, 0, 0, 0)'")
        toggle = page.locator('.bpx-player-ctrl-setting-loop input').first
        before = toggle.is_checked()
        page.locator('.bpx-player-ctrl-setting-loop .bui-switch-label').first.click()
        assert toggle.is_checked() != before
        page.screenshot(path=str(OUTPUT/'live-setting.png'))
        assert page.locator('.bpx-player-ctrl-eplist').first.evaluate("el=>getComputedStyle(el).visibility!=='hidden' || el.getBoundingClientRect().width===0")
        for width in (1600,1100,950):
            page.set_viewport_size({'width':width,'height':1000})
            page.wait_for_timeout(250)
            positions=page.evaluate('''()=>{const l=document.querySelector('.bpx-player-control-bottom-left').getBoundingClientRect(),r=document.querySelector('.bpx-player-control-bottom-right').getBoundingClientRect();return {left:l.right,right:r.left}}''')
            assert positions['left']<=positions['right'], (width,positions)
        page.set_viewport_size({'width':1600,'height':1000})
        for button,mode in [('.bpx-player-ctrl-wide','bt-player-wide'),('.bpx-player-ctrl-web','bt-player-web-fullscreen')]:
            page.locator('.bpx-player-container').first.hover(position={'x':100,'y':100})
            page.locator(button).first.click()
            page.wait_for_function('mode=>document.documentElement.classList.contains(mode)', arg=mode)
            page.locator('.bpx-player-container').first.hover(position={'x':100,'y':100})
            page.locator(button).first.click()
            page.wait_for_function('mode=>!document.documentElement.classList.contains(mode)', arg=mode)
        checks.append('Public video in an isolated, logged-out browser: play/pause, volume, time entry, quality menu, settings switch, desktop sizing, wide and web fullscreen')
        context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live',action='store_true')
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True,exist_ok=True)
    checks = []
    with sync_playwright() as playwright:
        offline(playwright, checks)
        if args.live:
            live(playwright, checks)
    report = {'checks':checks,'live_account':'temporary logged-out profile' if args.live else 'not run'}
    (OUTPUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
