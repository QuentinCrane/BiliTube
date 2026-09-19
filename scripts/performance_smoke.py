from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BROWSER = Path(os.environ.get("BROWSER_EXECUTABLE", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"))


def goto(page, url: str) -> None:
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    except PlaywrightTimeoutError:
        pass
    page.wait_for_timeout(7_000)


def start_probe(page) -> None:
    page.evaluate(
        """
        () => {
          window.__btPerf = {longTasks: [], mutations: 0, attributeMutations: 0, childMutations: 0, btMutations: 0};
          if (window.PerformanceObserver) {
            const observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) window.__btPerf.longTasks.push({duration: entry.duration, startTime: entry.startTime});
            });
            try { observer.observe({entryTypes:['longtask']}); } catch {}
          }
          const observer = new MutationObserver((records) => {
            for (const record of records) {
              window.__btPerf.mutations += 1;
              if (record.type === 'attributes') window.__btPerf.attributeMutations += 1;
              else window.__btPerf.childMutations += 1;
              const target = record.target instanceof Element ? record.target : null;
              if (target?.closest?.('#bilitube-root, #bilitube-watch-layer')) window.__btPerf.btMutations += 1;
            }
          });
          observer.observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['class','style','data-screen']});
        }
        """
    )


def read_probe(page, label: str) -> None:
    page.wait_for_timeout(5_000)
    result = page.evaluate("(label) => ({label, url:location.href, htmlClass:document.documentElement.className, ...window.__btPerf})", label)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def main() -> None:
    if not BROWSER.exists():
        raise SystemExit(f"Browser executable not found: {BROWSER}")
    user_data_dir = tempfile.mkdtemp(prefix="bilitube-perf-")
    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir,
            executable_path=str(BROWSER),
            headless=False,
            ignore_default_args=["--disable-extensions", "--disable-component-extensions-with-background-pages"],
            viewport={"width":1440,"height":900},
            args=[
                f"--disable-extensions-except={ROOT}",
                f"--load-extension={ROOT}",
                "--enable-extensions",
                "--no-first-run",
                "--no-default-browser-check",
            ],
        )
        page = context.pages[0] if context.pages else context.new_page()
        for label, url in [
            ('home','https://www.bilibili.com/'),
            ('dynamic','https://t.bilibili.com/?bilitube_dynamic=videos'),
            ('watch','https://www.bilibili.com/video/BV1eKem6VErq'),
        ]:
            goto(page, url)
            start_probe(page)
            if label == 'watch':
                page.locator('.bpx-player-container, #bilibili-player, #bilibiliPlayer').first.hover()
            read_probe(page, label)
        context.close()


if __name__ == "__main__":
    main()
