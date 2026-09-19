from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BROWSER = Path(os.environ.get("BROWSER_EXECUTABLE", r"C:\Program Files\Google\Chrome\Application\chrome.exe"))
OUTPUT = ROOT / "output" / "playwright"
USE_EXTENSION = os.environ.get("SMOKE_USE_EXTENSION", "1") != "0"


def wait_page(page, url: str) -> None:
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    except PlaywrightTimeoutError:
        print(json.dumps({"event": "navigation-timeout", "url": page.url}, ensure_ascii=False))
    page.wait_for_timeout(8_000)


def inspect_page(page, label: str) -> dict:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(OUTPUT / f"{label}.png"), full_page=False)
    result = page.evaluate(
        """
        () => ({
          url: location.href,
          title: document.title,
          htmlClass: document.documentElement.className,
          root: Boolean(document.querySelector('#bilitube-root')),
          outletRoute: document.querySelector('#bilitube-outlet')?.dataset.route || '',
          topbar: Boolean(document.querySelector('.bt-topbar')),
          sidebar: Boolean(document.querySelector('.bt-sidebar')),
          chips: [...document.querySelectorAll('.bt-chip')].slice(0, 12).map((node) => ({
            text: node.textContent?.trim() || '',
            href: node.href || '',
            active: node.classList.contains('is-active'),
          })),
          cards: document.querySelectorAll('.bt-video-card, .bt-search-row').length,
          firstCard: (() => {
            const node = document.querySelector('.bt-card-title, .bt-search-title');
            return node ? { title: node.textContent?.trim() || '', href: node.href || '' } : null;
          })(),
          nativePlayer: Boolean(document.querySelector('#bilibili-player, .bpx-player-container, .bilibili-player')),
          watchLayer: Boolean(document.querySelector('#bilitube-watch-layer')),
          watchSelectorCounts: Object.fromEntries([
            '.video-container-v1', '#mirror-vdcon.video-container-v1', '.video-page-container', '.video-container',
            '.left-container', '.right-container', '#playerWrap', '#bilibili-player-wrap', '.video-player-container',
            '.video-info-container', '#viewbox_report', '.video-info-v1', '.bt-watch-native-layout',
            '.bt-native-watch-main', '.bt-native-watch-aside', '.bt-native-watch-player-host', '.bt-native-watch-info',
          ].map((selector) => [selector, document.querySelectorAll(selector).length])),
          watchLayoutChildren: [...document.querySelector('.bt-watch-native-layout')?.children || []].map((node) => ({
            tag: node.tagName, cls: node.className, order: getComputedStyle(node).order,
            top: Math.round(node.getBoundingClientRect().top), height: Math.round(node.getBoundingClientRect().height),
          })),
          watchMainChildren: [...document.querySelector('.bt-native-watch-main')?.children || []].map((node) => ({
            tag: node.tagName, cls: node.className, order: getComputedStyle(node).order,
            top: Math.round(node.getBoundingClientRect().top), height: Math.round(node.getBoundingClientRect().height),
          })),
        })
        """
    )
    print(json.dumps({"event": "page", "label": label, **result}, ensure_ascii=False, indent=2))
    return result


def main() -> None:
    if not BROWSER.exists():
        raise SystemExit(f"Browser executable not found: {BROWSER}")

    console: list[dict[str, str]] = []
    page_errors: list[str] = []
    user_data_dir = tempfile.mkdtemp(prefix="bilitube-smoke-")
    with sync_playwright() as playwright:
        launch_args = [
            "--no-first-run",
            "--no-default-browser-check",
        ]
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
            viewport={"width": 1440, "height": 900},
            args=launch_args,
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.on("console", lambda message: console.append({"type": message.type, "text": message.text}))
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        extension_page = context.new_page()
        try:
            extension_page.goto("chrome://extensions/", wait_until="domcontentloaded", timeout=20_000)
            extension_page.wait_for_timeout(1_000)
            extension_text = extension_page.evaluate(
                """
                () => {
                  const visit = (node) => {
                    if (!node) return '';
                    let text = node.innerText || node.textContent || '';
                    if (node.shadowRoot) text += ' ' + visit(node.shadowRoot);
                    for (const child of node.children || []) text += ' ' + visit(child);
                    return text;
                  };
                  return visit(document.body).replace(/\\s+/g, ' ').trim();
                }
                """
            )
            print(json.dumps({"event": "extensions-page", "text": extension_text[:8000]}, ensure_ascii=False))
            extension_items = extension_page.evaluate(
                """
                () => {
                  const out = [];
                  const visit = (root) => {
                    if (!root) return;
                    for (const node of root.querySelectorAll ? root.querySelectorAll('*') : []) {
                      if (node.tagName === 'EXTENSIONS-ITEM') {
                        out.push({id: node.id || '', text: (node.shadowRoot?.innerText || node.innerText || '').slice(0, 1200)});
                      }
                      if (node.shadowRoot) visit(node.shadowRoot);
                    }
                  };
                  visit(document);
                  return out;
                }
                """
            )
            print(json.dumps({"event": "extensions-items", "items": extension_items}, ensure_ascii=False))
        except Exception as error:
            print(json.dumps({"event": "extensions-page-error", "error": str(error)}, ensure_ascii=False))
        extension_page.close()

        wait_page(page, "https://www.bilibili.com/")
        home = inspect_page(page, "home")
        for worker in context.service_workers:
            if "/src/background.js" in worker.url:
                try:
                    feed_debug = worker.evaluate(
                        """
                        async () => {
                          const payload = await handle('home', {page:1});
                          const items = payload?.data?.item || [];
                          const first = items[0] || {};
                          const archive = first.business_info?.archive || first;
                          return {
                            code: payload?.code,
                            count: items.length,
                            rawKeys: Object.keys(first).slice(0, 80),
                            rawCategory: {tname:first.tname, tid:first.tid, type_name:first.type_name, category:first.category},
                            archiveCategory: {tname:archive.tname, tid:archive.tid, type_name:archive.type_name, category:archive.category},
                          };
                        }
                        """
                    )
                    print(json.dumps({"event": "home-feed-debug", **feed_debug}, ensure_ascii=False))
                    region_debug = worker.evaluate(
                        """
                        async () => {
                          const response = await fetch('https://api.bilibili.com/x/web-interface/ranking/v2?rid=188&type=all', {credentials:'include'});
                          const payload = await response.json();
                          const items = payload?.data?.list || [];
                          return {http:response.status, code:payload?.code, count:items.length, first:items[0] ? {bvid:items[0].bvid, title:items[0].title, pic:items[0].pic, owner:items[0].owner} : null};
                        }
                        """
                    )
                    print(json.dumps({"event": "region-feed-debug", **region_debug}, ensure_ascii=False))
                except Exception as error:
                    print(json.dumps({"event": "home-feed-debug-error", "error": str(error)}, ensure_ascii=False))

        first_card = page.locator('.bt-card-title').first
        if first_card.count():
            with page.expect_navigation(timeout=60_000):
                first_card.click()
            page.wait_for_timeout(6_000)
            inspect_page(page, "watch-after-home-card-click")
            wait_page(page, "https://www.bilibili.com/")

        tech = page.locator('a.bt-chip[href*="bilitube_category=tech"]').first
        if tech.count():
            tech.click()
            page.wait_for_timeout(8_000)
            inspect_page(page, "home-tech-after-click")

        wait_page(page, "https://www.bilibili.com/dynamic?bilitube_dynamic=videos")
        inspect_page(page, "dynamic-www-videos")

        wait_page(page, "https://t.bilibili.com/?bilitube_dynamic=videos")
        inspect_page(page, "dynamic-videos")

        wait_page(page, "https://www.bilibili.com/video/BV1eKem6VErq")
        inspect_page(page, "watch")

        drawer = {"button": False, "open": False, "closed": False}
        menu = page.locator('#bilitube-watch-layer button[title="切换侧栏"]').first
        if menu.count():
            drawer["button"] = True
            menu.click()
            page.wait_for_timeout(500)
            drawer["open"] = page.locator('#bilitube-watch-layer .bt-sidebar-drawer-backdrop.is-open').count() > 0
            if drawer["open"]:
                page.locator('#bilitube-watch-layer .bt-sidebar-drawer-backdrop').click(position={"x": 700, "y": 100})
                page.wait_for_timeout(300)
                drawer["closed"] = page.locator('#bilitube-watch-layer .bt-sidebar-drawer-backdrop.is-open').count() == 0
        print(json.dumps({"event": "watch-drawer", **drawer}, ensure_ascii=False))

        print(json.dumps({
            "event": "diagnostics",
            "browser": str(BROWSER),
            "useExtension": USE_EXTENSION,
            "userDataDir": user_data_dir,
            "serviceWorkers": [worker.url for worker in context.service_workers],
            "consoleTail": console[-25:],
            "pageErrors": page_errors[-25:],
            "homeRootObserved": home["root"],
        }, ensure_ascii=False, indent=2))
        context.close()


if __name__ == "__main__":
    main()
