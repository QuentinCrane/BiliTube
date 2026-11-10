"""Exercise blurred player margins with a running native-style video fixture."""
from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path

from PIL import Image
from playwright.sync_api import expect, sync_playwright

from feature_parity_smoke import MOCK

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "player-ambient"

HTML = r"""<!doctype html><html><head><style>
  .bpx-player-container,.bpx-player-video-area,.bpx-player-video-perch,.bpx-player-video-wrap { width:100%;height:100% }
  .bpx-player-video-area { position:relative;background:#000;overflow:hidden }
  .bpx-player-video-perch { position:relative }
  .bpx-player-video-wrap video { display:block;width:100%;height:100%;object-fit:contain }
  .bpx-player-container[data-screen="web"] { position:fixed;inset:0;width:100vw!important;height:100vh!important;z-index:100 }
  .fixture-control { position:absolute;z-index:75;right:10px;bottom:10px }
</style></head><body>
<div class="video-container-v1"><div class="left-container">
  <div id="playerWrap"><div class="bpx-player-container" data-screen="normal"><div class="bpx-player-video-area">
    <div class="bpx-player-video-perch"><div class="bpx-player-video-wrap"><video id="native-video" muted autoplay playsinline></video></div></div>
    <button class="fixture-control" onclick="window.__clicks++">Native control</button>
  </div></div></div>
  <div class="video-info-container"><h1>Fixture</h1></div><div id="arc_toolbar_report"></div><div id="comment-module"></div>
</div><div class="right-container"><div class="right-container-inner"></div></div></div>
</body></html>"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", default=os.environ.get("BROWSER_EXECUTABLE", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"))
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    content = next(item for item in manifest["content_scripts"] if "src/core/app.js" in item.get("js", []))
    sources = "\n;\n".join((ROOT / name).read_text(encoding="utf-8") for name in content["js"])
    css = "\n".join((ROOT / name).read_text(encoding="utf-8") for name in content["css"])
    mock = MOCK + r"""
      window.__clicks=0;window.__draws=0;window.__settingsListener=null;
      chrome.storage.onChanged.addListener=listener=>window.__settingsListener=listener;
      const originalDraw=CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage=function(...args){
        if(this.canvas.classList.contains('bt-player-ambient')){window.__draws++;if(window.__failDrawing)throw new DOMException('Unavailable','SecurityError');}
        return originalDraw.apply(this,args);
      };
      window.__useFrame=async (video,width,height)=>{
        if(window.__sourceTimer)clearInterval(window.__sourceTimer);
        const source=document.createElement('canvas');source.width=width;source.height=height;
        const ctx=source.getContext('2d');let frame=0;
        const paint=()=>{ctx.fillStyle='#ec4024';ctx.fillRect(0,0,width,height);ctx.fillStyle='#1776dd';ctx.fillRect((frame++%10)*width/20,height*.2,width*.2,height*.2)};
        paint();window.__sourceTimer=setInterval(paint,80);window.__source=source;
        video.srcObject=source.captureStream(15);await video.play();
      };
    """
    checks: list[str] = []
    errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.browser, headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        context.route("**/*", lambda route: route.fulfill(content_type="text/html", body=HTML))
        context.add_init_script(mock + "\naddEventListener('DOMContentLoaded',()=>{\n" + sources + "\n},{once:true});")
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto("https://www.bilibili.com/video/BVfixture", wait_until="domcontentloaded")
        page.add_style_tag(content=css)
        expect(page.locator("html")).to_have_class(re.compile(r"bt-watch-decorated"))
        page.evaluate("window.__video=document.querySelector('#native-video');window.__useFrame(window.__video,180,320)")
        expect(page.locator(".bt-player-ambient-active canvas.bt-player-ambient")).to_have_count(1)
        page.wait_for_function("window.__draws>=3")
        frame = OUTPUT / "portrait.png"
        page.locator(".bpx-player-video-area").screenshot(path=str(frame))
        with Image.open(frame) as image:
            margin = image.convert("RGB").getpixel((int(image.width * .08), int(image.height * .55)))
            assert margin[0] > 40 and margin[0] > margin[1] * 1.4, margin
        assert page.evaluate("document.querySelector('#native-video')===window.__video && window.__video.videoWidth===180 && window.__video.videoHeight===320")
        page.locator(".fixture-control").click()
        assert page.evaluate("window.__clicks") == 1
        checks.append("portrait video keeps its native element and controls while colored blurred margins are visible")

        page.evaluate("window.__video.pause()")
        page.wait_for_timeout(150)
        draws = page.evaluate("window.__draws")
        page.wait_for_timeout(350)
        assert page.evaluate("window.__draws") == draws
        page.evaluate("window.__video.play()")
        page.wait_for_function("count=>window.__draws>count", arg=draws)
        checks.append("pause stops frame updates and playback resumes them")

        page.evaluate("window.__settingsListener({bilitubeCoreSettings:{newValue:{playerAmbient:false}}},'local')")
        expect(page.locator("canvas.bt-player-ambient")).to_have_count(0)
        assert page.evaluate("document.querySelector('#native-video')===window.__video && !window.__video.paused")
        page.evaluate("window.__settingsListener({bilitubeCoreSettings:{newValue:{playerAmbient:true}}},'local')")
        expect(page.locator(".bt-player-ambient-active canvas.bt-player-ambient")).to_have_count(1)
        checks.append("storage preference takes effect immediately without restarting the native video")

        page.evaluate("document.querySelector('canvas.bt-player-ambient').remove()")
        expect(page.locator(".bt-player-ambient-active canvas.bt-player-ambient")).to_have_count(1)
        page.evaluate("window.__failDrawing=true")
        expect(page.locator("canvas.bt-player-ambient")).to_have_count(0)
        page.evaluate("window.__failDrawing=false;window.__video.dispatchEvent(new Event('playing'))")
        expect(page.locator(".bt-player-ambient-active canvas.bt-player-ambient")).to_have_count(1)
        checks.append("removed backgrounds are recreated and unavailable video frames fall back cleanly")

        page.evaluate("window.__useFrame(window.__video,320,180)")
        expect(page.locator("canvas.bt-player-ambient")).to_have_count(0)
        page.evaluate("window.__useFrame(window.__video,320,100)")
        expect(page.locator(".bt-player-ambient-active canvas.bt-player-ambient")).to_have_count(1)
        landscape = OUTPUT / "landscape.png"
        page.locator(".bpx-player-video-area").screenshot(path=str(landscape))
        with Image.open(landscape) as image:
            margin = image.convert("RGB").getpixel((int(image.width * .5), int(image.height * .08)))
            assert margin[0] > 40 and margin[0] > margin[1] * 1.4, margin
        page.evaluate("window.__useFrame(window.__video,180,320)")
        expect(page.locator(".bt-player-ambient-active canvas.bt-player-ambient")).to_have_count(1)
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
        expect(page.locator("canvas.bt-player-ambient")).to_have_count(0)
        page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
        expect(page.locator(".bt-player-ambient-active canvas.bt-player-ambient")).to_have_count(1)
        checks.append("ultrawide video fills top and bottom margins; matching aspect ratios and hidden tabs stop the effect")

        page.evaluate("""async()=>{
          const old=window.__video, replacement=document.createElement('video');
          replacement.id='native-video';replacement.muted=true;replacement.autoplay=true;
          old.replaceWith(replacement);window.__video=replacement;await window.__useFrame(replacement,180,320);
        }""")
        expect(page.locator(".bt-player-ambient-active canvas.bt-player-ambient")).to_have_count(1)
        page.evaluate("document.querySelector('.bpx-player-container').dataset.screen='web'")
        expect(page.locator("html")).to_have_class(re.compile(r"bt-player-web-fullscreen"))
        expect(page.locator(".bt-player-ambient-active canvas.bt-player-ambient")).to_have_count(1)
        page.evaluate("document.querySelector('.bpx-player-container').dataset.screen='normal'")
        expect(page.locator("html")).not_to_have_class(re.compile(r"bt-player-web-fullscreen"))
        checks.append("video replacement and web fullscreen transitions retain the effect")

        page.evaluate("window.__settingsListener({bilitubeCoreSettings:{newValue:{enabled:false}}},'local')")
        expect(page.locator("canvas.bt-player-ambient")).to_have_count(0)
        assert not errors, errors
        checks.append("disabling BiliTube removes the background cleanly")
        print(json.dumps({"kind": "isolated browser fixture", "browser": browser.version, "checks": checks, "page_errors": errors}, ensure_ascii=False, indent=2))
        browser.close()


if __name__ == "__main__":
    main()
