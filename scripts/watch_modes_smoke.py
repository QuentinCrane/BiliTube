from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BROWSER = Path(os.environ.get("BROWSER_EXECUTABLE", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"))
OUTPUT = ROOT / "output" / "playwright"
USE_EXTENSION = os.environ.get("SMOKE_USE_EXTENSION", "1") != "0"


def wait_page(page, url: str) -> None:
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    except PlaywrightTimeoutError:
        print(json.dumps({"event": "navigation-timeout", "url": page.url}, ensure_ascii=False))
    page.wait_for_timeout(8_000)


def inspect(page, label: str) -> dict:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    if os.environ.get('SMOKE_NO_SCREEN') != '1':
        try:
            page.screenshot(path=str(OUTPUT / f"modes-{label}.png"), full_page=False)
        except PlaywrightTimeoutError:
            print(json.dumps({"event":"screenshot-timeout","label":label},ensure_ascii=False), flush=True)
    result = page.evaluate(
        """
        () => {
          const player = document.querySelector('.bpx-player-container, #bilibili-player, #bilibiliPlayer');
          const layer = document.querySelector('#bilitube-watch-layer');
          const rect = player?.getBoundingClientRect();
          const probe = rect ? document.elementFromPoint(Math.round(rect.left + Math.min(80, rect.width / 2)), Math.round(rect.top + Math.max(20, rect.height - 32))) : null;
          return {
            url: location.href,
            htmlClass: document.documentElement.className,
            screen: [...document.querySelectorAll('[data-screen]')].map(node => node.getAttribute('data-screen')).filter(Boolean),
            player: Boolean(player),
            layer: layer ? {
              display: getComputedStyle(layer).display,
              pointerEvents: getComputedStyle(layer).pointerEvents,
              rect: (() => { const r=layer.getBoundingClientRect(); return {left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)}; })(),
            } : null,
            probe: probe ? {tag:probe.tagName, id:probe.id, cls:String(probe.className||'').slice(0,180)} : null,
            modeButtons: [...document.querySelectorAll('button,[role="button"],[class*="bpx-player-ctrl"]')]
              .map(node => ({tag:node.tagName, cls:String(node.className||''), title:node.getAttribute('title')||'', aria:node.getAttribute('aria-label')||'', text:(node.textContent||'').trim().slice(0,40)}))
              .filter(item => /wide|web|full|宽屏|全屏/i.test(`${item.cls} ${item.title} ${item.aria} ${item.text}`))
              .slice(0,20),
          };
        }
        """
    )
    print(json.dumps({"event":"state","label":label,**result},ensure_ascii=False,indent=2), flush=True)
    return result


def click_mode(page, mode: str) -> bool:
    selectors = {
        "wide": 'button.bpx-player-ctrl-wide, [aria-label*="宽屏"], [title*="宽屏"], [class*="ctrl-wide"]',
        "web": 'button.bpx-player-ctrl-web, [aria-label*="网页全屏"], [title*="网页全屏"], [class*="ctrl-web"]',
    }
    page.locator('.bpx-player-container, #bilibili-player, #bilibiliPlayer').first.hover()
    if mode == 'web' and os.environ.get('SMOKE_RELEASE_WEB_GEOMETRY') == '1':
        page.add_style_tag(content='''
          html.bt-watch-decorated.bt-player-web-fullscreen .bt-native-watch-player-host,
          html.bt-watch-decorated.bt-player-browser-fullscreen .bt-native-watch-player-host { width:auto!important; max-width:none!important; height:auto!important; min-height:0!important; aspect-ratio:auto!important; margin:0!important; border-radius:0!important; overflow:visible!important; }
          html.bt-watch-decorated.bt-player-web-fullscreen .bt-native-watch-player-host :is(#bilibili-player,#bilibiliPlayer,.bpx-player-container,.bilibili-player),
          html.bt-watch-decorated.bt-player-browser-fullscreen .bt-native-watch-player-host :is(#bilibili-player,#bilibiliPlayer,.bpx-player-container,.bilibili-player) { width:auto!important; max-width:none!important; height:auto!important; min-height:0!important; aspect-ratio:auto!important; border-radius:0!important; overflow:visible!important; }
        ''')
    target = page.locator(selectors[mode]).first
    if not target.count():
        print(json.dumps({"event":"mode-button-missing","mode":mode},ensure_ascii=False), flush=True)
        return False
    print(json.dumps({"event":"mode-button","mode":mode,"title":target.get_attribute('title'),'aria':target.get_attribute('aria-label'),'class':target.get_attribute('class')},ensure_ascii=False), flush=True)
    try:
        target.click(timeout=5_000)
    except PlaywrightTimeoutError as error:
        print(json.dumps({"event":"mode-click-timeout","mode":mode,"error":str(error).splitlines()[-1]},ensure_ascii=False), flush=True)
    page.wait_for_timeout(1_500)
    return True


def main() -> None:
    if not BROWSER.exists():
        raise SystemExit(f"Browser executable not found: {BROWSER}")
    user_data_dir = tempfile.mkdtemp(prefix="bilitube-watch-modes-")
    with sync_playwright() as playwright:
        launch_args = ["--no-first-run", "--no-default-browser-check"]
        if USE_EXTENSION:
            launch_args.extend([
                f"--disable-extensions-except={ROOT}",
                f"--load-extension={ROOT}",
                "--enable-extensions",
            ])
        context = playwright.chromium.launch_persistent_context(
            user_data_dir,
            executable_path=str(BROWSER),
            headless=False,
            ignore_default_args=(["--disable-extensions", "--disable-component-extensions-with-background-pages"] if USE_EXTENSION else None),
            viewport={"width":1440,"height":900},
            args=launch_args,
        )
        page = context.pages[0] if context.pages else context.new_page()
        console=[]; errors=[]
        page.on("console", lambda message: console.append({"type":message.type,"text":message.text}))
        page.on("pageerror", lambda error: errors.append(str(error)))
        wait_page(page, "https://www.bilibili.com/video/BV1eKem6VErq")
        inspect(page, "initial")
        if click_mode(page, "wide"):
            inspect(page, "wide-entered")
            click_mode(page, "wide")
            inspect(page, "wide-exited")
        if click_mode(page, "web"):
            inspect(page, "web-entered")
            if os.environ.get('SMOKE_CLEAR_WEB_CLASS') == '1':
                page.evaluate("document.documentElement.classList.remove('bt-player-web-fullscreen','bt-player-browser-fullscreen')")
                page.wait_for_timeout(200)
                print(json.dumps({"event":"cleared-web-class"},ensure_ascii=False),flush=True)
            click_mode(page, "web")
            inspect(page, "web-exited")
        print(json.dumps({"event":"diagnostics","useExtension":USE_EXTENSION,"serviceWorkers":[worker.url for worker in context.service_workers],"pageErrors":errors[-20:],"consoleTail":console[-30:]},ensure_ascii=False,indent=2))
        context.close()


if __name__ == "__main__":
    main()
