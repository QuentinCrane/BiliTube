"""Verify live media continuity and compositor theme fades in Edge."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess

from playwright.sync_api import expect, sync_playwright
from feature_parity_smoke import MOCK

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "media-continuity"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", default=os.environ.get("BROWSER_EXECUTABLE", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"))
    parser.add_argument("--ffmpeg", default="ffmpeg")
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    video = OUTPUT / "test.webm"
    if not video.exists():
        subprocess.run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=160x90:rate=12", "-t", "5", "-c:v", "libvpx", "-b:v", "100k", "-an", str(video)], check=True)
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    content = next(item for item in manifest["content_scripts"] if "src/core/app.js" in item.get("js", []))
    sources = "\n;\n".join((ROOT / name).read_text(encoding="utf-8") for name in content["js"])
    css = "\n".join((ROOT / name).read_text(encoding="utf-8") for name in content["css"])
    mock = MOCK.replace("motionMode:'reduced'", "motionMode:'full',theme:'light'").replace("duration:'2:00', mid:123", "pic:'https://fixture.invalid/thumb.svg',duration:'2:00', mid:123")
    mock += r"""
    window.__settingsListener=null;window.__loadStarts=0;window.__imageLoads=0;window.__revealRecords=[];window.__pauseReveal=false;
    chrome.storage.onChanged.addListener=listener=>{window.__settingsListener=listener};
    chrome.storage.local.set=values=>{
      const value=JSON.parse(JSON.stringify(values.bilitubeCoreSettings));window.__savedSettings=value;
      setTimeout(()=>window.__settingsListener?.({bilitubeCoreSettings:{newValue:value}},'local'),5);
    };
    const send=chrome.runtime.sendMessage;
    chrome.runtime.sendMessage=(message,done)=>{
      if(message.type==='home-sections'){window.__deliverShelves=()=>done({ok:true,data:{popular:{code:0,data:{list:[{bvid:'BVshelf',title:'Late shelf',pic:'https://fixture.invalid/shelf.svg',owner:{mid:123,name:'Fixture'}}]}}}});return;}
      if(message.type==='space-profile'){window.__deliverProfile=()=>send(message,done);return;}
      if(message.type==='preview'){done({ok:true,data:{url:'https://fixture.invalid/preview.webm'}});return;}
      send(message,done);
    };
    document.addEventListener('loadstart',event=>{if(event.target.tagName==='VIDEO')window.__loadStarts++},true);
    document.addEventListener('load',event=>{if(event.target.matches?.('.bt-thumb-image'))window.__imageLoads++},true);
    addEventListener('DOMContentLoaded',()=>{
      const animate=document.documentElement.animate.bind(document.documentElement);
      document.documentElement.animate=(frames,options)=>{
        const animation=animate(frames,options);
        if(options?.pseudoElement==='::view-transition-old(root)'){
          window.__revealRecords.push({frames,options});window.__revealAnimation=animation;
          if(window.__pauseReveal){animation.pause();animation.currentTime=70;}
        }
        return animation;
      };
    },{once:true});
    """
    errors = []
    report = {"kind": "isolated browser with real image/video fixtures", "checks": []}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.browser, headless=True)
        context = browser.new_context(viewport={"width":1440,"height":900}, reduced_motion="no-preference")

        def respond(route):
            if route.request.resource_type == "media":
                route.fulfill(path=str(video), content_type="video/webm")
            elif route.request.resource_type == "image":
                route.fulfill(content_type="image/svg+xml", body='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#aa6677"/></svg>')
            else:
                body='<!doctype html><html><body><div id="native-business"></div></body></html>'
                if '/video/BVnative' in route.request.url:
                    body='<!doctype html><html><body><div class="video-container-v1"><div class="left-container"><div id="playerWrap"><div class="bpx-player-container" data-screen="normal"><video id="native-video" src="https://fixture.invalid/preview.webm" muted autoplay loop></video></div></div><div class="video-info-container"><h1>Native fixture</h1></div><div id="arc_toolbar_report"><button>Like</button></div><div id="comment-module">Comments</div></div><div class="right-container"><div class="right-container-inner">Recommendations</div></div></div></body></html>'
                route.fulfill(content_type="text/html", body=body)
        context.route("**/*", respond)
        context.add_init_script(mock + "\naddEventListener('DOMContentLoaded',()=>{\n" + sources + "\n},{once:true});")
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))

        def go(url):
            page.goto(url, wait_until="networkidle")
            page.add_style_tag(content=css)
        go("https://www.bilibili.com/")
        expect(page.locator('.bt-video-card')).to_have_count(42)
        page.evaluate("window.__image=document.querySelector('.bt-thumb-image');window.__card=document.querySelector('.bt-video-card');window.__hold=true")
        page.locator('.bt-video-card').first.hover()
        page.wait_for_function("document.querySelector('.bt-preview-video')?.currentTime>0.2")
        page.evaluate("window.__video=document.querySelector('.bt-preview-video');window.__time=window.__video.currentTime;window.__initialLoads=window.__loadStarts;window.__initialImageLoads=window.__imageLoads;window.__deliverShelves()")
        expect(page.locator('.bt-home-shelf')).to_have_count(1)
        page.wait_for_timeout(200)
        assert page.evaluate("window.__video===document.querySelector('.bt-preview-video')&&window.__video.currentTime>window.__time&&window.__image===document.querySelector('.bt-thumb-image')&&window.__loadStarts===window.__initialLoads&&window.__imageLoads===window.__initialImageLoads")
        report["checks"].append("late home shelves retain loaded image, playing video, and media load counts")

        # Keyboard activation keeps the pointer on the preview card so its
        # normal pointer-leave cleanup does not confuse the theme test.
        page.locator('.bt-theme-button').focus()
        for expected_theme in ['dark', 'light']:
            count = page.evaluate('window.__revealRecords.length')
            page.evaluate("window.__pauseReveal=true;window.__time=window.__video.currentTime")
            page.keyboard.press('Enter')
            page.wait_for_function('(count)=>window.__revealRecords.length>count', arg=count)
            expect(page.locator('html')).to_have_attribute('data-bt-theme', expected_theme)
            record = page.evaluate('window.__revealRecords.at(-1)')
            assert record['frames'] == {'opacity': [1, 0]}, record
            assert record['options']['duration'] <= 200, record
            page.screenshot(path=str(OUTPUT / f"reveal-{expected_theme}-midpoint.png"))
            assert page.evaluate("window.__video===document.querySelector('.bt-preview-video')&&window.__image===document.querySelector('.bt-thumb-image')&&window.__loadStarts===window.__initialLoads"),page.evaluate("({theme:document.documentElement.dataset.btTheme,classes:document.documentElement.className,videoConnected:window.__video.isConnected,videoError:window.__video.error?.message,imageSame:window.__image===document.querySelector('.bt-thumb-image'),loads:window.__loadStarts,initial:window.__initialLoads,hover:window.__card.matches(':hover')})")
            page.evaluate('window.__revealAnimation.finish()')
            page.wait_for_function("!document.documentElement.classList.contains('bt-theme-reveal')")
        report["checks"].append("both themes fade one snapshot using opacity only within 200ms; storage echoes retain media")

        page.evaluate("window.__pauseReveal=false")
        for _ in range(3):
            page.keyboard.press('Enter')
            page.wait_for_timeout(20)
        page.wait_for_function("!document.documentElement.classList.contains('bt-theme-reveal')")
        expect(page.locator('html')).to_have_attribute('data-bt-theme','dark')
        assert page.evaluate("window.__video===document.querySelector('.bt-preview-video')&&window.__loadStarts===window.__initialLoads")
        report["checks"].append("rapid theme reversal ends in the last requested theme without restarting video")
        page.emulate_media(reduced_motion='reduce')
        count = page.evaluate('window.__revealRecords.length')
        page.keyboard.press('Enter')
        expect(page.locator('html')).to_have_attribute('data-bt-theme','light')
        assert page.evaluate('window.__revealRecords.length') == count
        report["checks"].append("reduced-motion switches immediately without a reveal")
        page.emulate_media(reduced_motion='no-preference')
        page.evaluate("window.__settingsListener({bilitubeCoreSettings:{newValue:{...window.__savedSettings,motionMode:'none'}}},'local')")
        page.keyboard.press('Enter')
        expect(page.locator('html')).to_have_attribute('data-bt-theme','dark')
        assert page.evaluate('window.__revealRecords.length') == count
        report["checks"].append("the extension's motion-off setting skips the snapshot even when the OS permits motion")

        go('https://space.bilibili.com/123/upload')
        expect(page.locator('.bt-video-card')).to_have_count(42)
        page.evaluate("window.__image=document.querySelector('.bt-thumb-image');window.__deliverProfile()")
        expect(page.locator('.bt-channel-text h1')).to_have_text('Fixture uploader')
        page.wait_for_timeout(1000)
        assert page.evaluate("window.__image===document.querySelector('.bt-thumb-image')&&window.__image.isConnected")
        page.evaluate("window.postMessage({source:'bilitube-bridge-core',type:'navigation',payload:{}},'*')")
        page.wait_for_timeout(100)
        assert page.evaluate("window.__image===document.querySelector('.bt-thumb-image')")
        report["checks"].append("late profile, the 900ms fallback and same-URL navigation retain the existing image")
        page.evaluate(r"""
        async () => {
          document.querySelector('#bilitube-root').remove();
          const shell=BiliTubeShell.createController(document);shell.ensure();
          const videos=Array.from({length:20},(_,i)=>({kind:'video',bvid:`BVmove${i}`,title:`Move ${i}`,href:`https://www.bilibili.com/video/BVmove${i}`,thumbnail:'https://fixture.invalid/thumb.svg'}));
          const data={href:location.href,category:'all',videos,shelves:[],hasMore:false};shell.render('home',data);
          const card=[...shell.getRoot().querySelectorAll('article')].find(node=>node.__btCardKey==='BVmove18');
          const video=document.createElement('video');video.muted=true;video.loop=true;video.src='https://fixture.invalid/preview.webm';card.querySelector('.bt-thumb').append(video);await video.play();
          window.__move={shell,card,video,parent:card.parentElement,data,loads:window.__loadStarts};
        }
        """)
        page.wait_for_function('window.__move.video.currentTime>0.1')
        page.evaluate("window.__move.time=window.__move.video.currentTime;window.__move.shell.render('home',{...window.__move.data,shelves:[{key:'late',title:'Late',items:[{kind:'video',bvid:'BVmoveshelf',title:'Shelf',href:'https://www.bilibili.com/video/BVmoveshelf'}]}]})")
        page.wait_for_timeout(200)
        assert page.evaluate("window.__move.card.parentElement!==window.__move.parent&&window.__move.video.isConnected&&window.__move.video.currentTime>window.__move.time&&window.__loadStarts===window.__move.loads")
        report["checks"].append("home shelf redistribution moves a playing video between grids without disconnecting or reloading it")
        go('https://www.bilibili.com/video/BVnative')
        page.wait_for_function("document.querySelector('#native-video').currentTime>0.1")
        page.evaluate("window.__native=document.querySelector('#native-video');window.__layer=document.querySelector('#bilitube-watch-layer');window.__initialLoads=window.__loadStarts;window.__time=window.__native.currentTime;history.replaceState({},'',location.pathname+'?spm_id_from=fixture');window.postMessage({source:'bilitube-bridge-core',type:'navigation',payload:{}},'*')")
        page.wait_for_timeout(200)
        assert page.evaluate("window.__native===document.querySelector('#native-video')&&window.__layer===document.querySelector('#bilitube-watch-layer')&&window.__native.currentTime>window.__time&&window.__loadStarts===window.__initialLoads")
        page.locator('.bt-theme-button').click()
        expect(page.locator('html')).to_have_attribute('data-bt-theme','dark')
        assert page.evaluate("window.__native===document.querySelector('#native-video')&&window.__loadStarts===window.__initialLoads")
        report["checks"].append("native video and Watch chrome retain identity and playback through tracking URL and theme changes")
        assert not errors, errors
        report['page_errors'] = errors
        report['browser'] = browser.version
        browser.close()
    (OUTPUT / 'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True,indent=2))


if __name__ == '__main__':
    main()
