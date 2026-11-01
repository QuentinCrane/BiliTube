"""Resource audit: image bytes, preview lookups and long-feed mount cost.

Three independent measurements, no npm dependencies:

1. `images`  - fetches real Bilibili covers/avatars at original size and at the
   variant the cards now request, and reports transferred bytes.
2. `preview` - compares the lookup endpoints the Hover Preview can use for the
   first page id (`view` vs `pagelist`) and whether the feed already carries it.
3. `layout`  - renders 500 cards in headless Chromium and records mount time,
   node count and heap, as a regression guard rather than a micro benchmark.

Network measurements degrade gracefully: without connectivity they are skipped
and the script still reports the local layout numbers.

Usage:
    python scripts/resource_audit.py
    python scripts/resource_audit.py --runs 5 --json output/perf-audit/report.json
"""

from __future__ import annotations

import argparse
import base64
import html as html_module
import json
import os
from pathlib import Path
import re
import statistics
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from ui_preview import DEFAULT_BROWSER, build_page, dump  # noqa: E402

UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
      'Referer': 'https://www.bilibili.com/'}
COVER_VARIANT = '@672w_378h_1c.webp'
POPULAR = 'https://api.bilibili.com/x/web-interface/popular?ps={ps}&pn=1'
PAGES = 'https://api.bilibili.com/x/player/pagelist?bvid={bvid}'
VIEW = 'https://api.bilibili.com/x/web-interface/view?bvid={bvid}'


def fetch(url: str, timeout: float = 15.0) -> tuple[int, bytes, float]:
    started = time.perf_counter()
    request = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read()
    return response.status, body, (time.perf_counter() - started) * 1000


def image_report(limit: int = 6) -> dict:
    try:
        _, body, _ = fetch(POPULAR.format(ps=limit))
    except (urllib.error.URLError, OSError, ValueError) as error:
        return {'skipped': f'network unavailable: {error}'}
    items = json.loads(body.decode('utf-8')).get('data', {}).get('list', [])[:limit]
    rows = []
    for item in items:
        pic = str(item.get('pic') or '').replace('http:', 'https:')
        if not pic:
            continue
        try:
            _, original, ms_original = fetch(pic)
            _, sized, ms_sized = fetch(pic + COVER_VARIANT)
        except (urllib.error.URLError, OSError) as error:
            rows.append({'bvid': item.get('bvid'), 'error': str(error)})
            continue
        rows.append({
            'bvid': item.get('bvid'),
            'originalBytes': len(original),
            'sizedBytes': len(sized),
            'ratio': round(1 - len(sized) / len(original), 3) if original else 0,
            'originalMs': round(ms_original),
            'sizedMs': round(ms_sized),
        })
    usable = [row for row in rows if 'originalBytes' in row]
    return {
        'variant': COVER_VARIANT,
        'samples': rows,
        'originalTotal': sum(row['originalBytes'] for row in usable),
        'sizedTotal': sum(row['sizedBytes'] for row in usable),
        'savedRatio': round(1 - sum(row['sizedBytes'] for row in usable) / max(1, sum(row['originalBytes'] for row in usable)), 3),
    }


def preview_report(limit: int = 6) -> dict:
    try:
        _, body, _ = fetch(POPULAR.format(ps=limit))
    except (urllib.error.URLError, OSError, ValueError) as error:
        return {'skipped': f'network unavailable: {error}'}
    items = json.loads(body.decode('utf-8')).get('data', {}).get('list', [])[:limit]
    rows = []
    for item in items:
        bvid = item.get('bvid')
        if not bvid:
            continue
        try:
            _, pages, pages_ms = fetch(PAGES.format(bvid=bvid))
            _, view, view_ms = fetch(VIEW.format(bvid=bvid))
        except (urllib.error.URLError, OSError) as error:
            rows.append({'bvid': bvid, 'error': str(error)})
            continue
        rows.append({
            'bvid': bvid,
            'feedCid': bool(item.get('cid')),
            'pagelistBytes': len(pages),
            'viewBytes': len(view),
            'pagelistMs': round(pages_ms),
            'viewMs': round(view_ms),
        })
    usable = [row for row in rows if 'pagelistBytes' in row]
    return {
        'samples': rows,
        'feedCarriesCid': all(row['feedCid'] for row in usable) if usable else None,
        'pagelistTotal': sum(row['pagelistBytes'] for row in usable),
        'viewTotal': sum(row['viewBytes'] for row in usable),
        'savedRatio': round(1 - sum(row['pagelistBytes'] for row in usable) / max(1, sum(row['viewBytes'] for row in usable)), 3),
    }


FIXTURE = r"""
const params = new URLSearchParams(location.search);
const theme = params.get('theme') || 'light';
const cover = index => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
    <rect width="640" height="360" fill="hsl(${(index * 37) % 360} 42% 42%)"/>
    <text x="24" y="330" fill="#fff" font-size="28" font-family="Segoe UI, sans-serif">CARD ${index}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};
const total = Number(params.get('cards') || 500);
const videos = Array.from({ length: total }, (_, index) => ({
  bvid: `BVperf${index}`, kind: 'video', title: `性能夹具 ${index}：一张足够长的标题用来触发两行截断`,
  href: `https://www.bilibili.com/video/BVperf${index}`,
  author: 'Fixture', authorHref: 'https://space.bilibili.com/1', meta: '100 万播放 · 1 天前',
  thumbnail: cover(index), duration: '12:34',
}));
const noop = () => () => {};
const handlers = { bindPreview: noop, afterReconcile: () => {}, beforeRender: () => {}, showCardAuthor: () => true, showCardMeta: () => true };
const data = {
  href: 'https://www.bilibili.com/', renderKey: 'perf', user: { mid: '1', name: 'Perf' },
  subscriptions: [], settings: { showSubscriptions: false }, route: 'home',
  category: 'all', videos, shelves: [], loading: false, hasMore: true,
};
document.documentElement.dataset.btTheme = theme;
document.documentElement.dataset.btMotion = 'none';
const shell = BiliTubeShell.createController(document);
const longTasks = [];
if (typeof PerformanceObserver === 'function') {
  try { new PerformanceObserver(list => { for (const entry of list.getEntries()) longTasks.push(entry.duration); }).observe({ entryTypes: ['longtask'] }); } catch {}
}
const round = value => Math.round(value * 100) / 100;
(() => {
  const out = { total };
  const mountStart = performance.now();
  shell.ensure(data, handlers);
  shell.render('home', data);
  out.mountMs = round(performance.now() - mountStart);
  out.nodes = document.querySelectorAll('#bilitube-outlet *').length;
  out.layoutMs = round((() => { const started = performance.now(); document.body.offsetHeight; return performance.now() - started; })());
  out.longTaskAtMount = longTasks.length;
  if (performance.memory) out.heapMb = Math.round(performance.memory.usedJSHeapSize / 1048576);
  document.documentElement.dataset.btMetrics = btoa(unescape(encodeURIComponent(JSON.stringify(out))));
})();
"""


def layout_report(browser: str, runs: int, out_dir: Path) -> dict:
    page = out_dir / 'fixture.html'
    build_page(ROOT, page, FIXTURE)
    samples = []
    for _ in range(runs):
        dom = dump(browser, f'{page.as_uri()}?cards=500', 4000)
        encoded = re.search(r'data-bt-metrics="([^"]+)"', dom)
        if not encoded:
            raise SystemExit('layout fixture produced no metrics')
        samples.append(json.loads(base64.b64decode(html_module.unescape(encoded.group(1))).decode('utf-8')))
    keys = ['mountMs', 'layoutMs', 'nodes', 'longTaskAtMount']
    report = {key: statistics.median(sample[key] for sample in samples) for key in keys}
    if all('heapMb' in sample for sample in samples):
        report['heapMb'] = statistics.median(sample['heapMb'] for sample in samples)
    report['samples'] = samples
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', default=os.environ.get('BROWSER_EXECUTABLE', DEFAULT_BROWSER))
    parser.add_argument('--runs', type=int, default=3)
    parser.add_argument('--json', default=str(ROOT / 'output' / 'perf-audit' / 'resource-report.json'))
    parser.add_argument('--skip-network', action='store_true')
    args = parser.parse_args()

    out_dir = Path(args.json).parent
    out_dir.mkdir(parents=True, exist_ok=True)
    report = {'measuredAt': time.strftime('%Y-%m-%d %H:%M'), 'runs': args.runs}
    report['images'] = {'skipped': 'requested'} if args.skip_network else image_report()
    report['preview'] = {'skipped': 'requested'} if args.skip_network else preview_report()
    report['layout'] = layout_report(args.browser, args.runs, out_dir)
    Path(args.json).write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
