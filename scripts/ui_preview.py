"""Offline visual fixtures for the BiliTube core UI.

Renders the shipped stylesheet and core modules in headless Chromium with
deterministic SVG artwork, so visual review and before/after diffs never touch
the network, a Bilibili account or the installed extension.

The fixture page is generated next to the screenshots (output/ is ignored by
git) and then captured with the Chrome headless CLI, which keeps the workflow
dependency-free.

Usage:
    python scripts/ui_preview.py --tag before
    python scripts/ui_preview.py --tag after --scenario home --theme dark
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BROWSER = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

MODULES = ['i18n', 'ui', 'reconcile', 'shell', 'motion', 'preview-model', 'preview', 'theme']

FIXTURE = r"""
const params = new URLSearchParams(location.search);
const scenario = params.get('scenario') || 'home';
const theme = params.get('theme') || 'light';
const palettes = [
  ['#0d2137', '#255b78'], ['#3a1c4f', '#6b4a80'], ['#123b34', '#3f8f7a'],
  ['#2b1b45', '#4a2c6b'], ['#232526', '#4a4f52'], ['#43203f', '#8a4a6d'],
  ['#0b3a52', '#c2652d'], ['#141e30', '#2c4463'], ['#2b4560', '#5f4f7a'],
];
const thumb = (index, label) => {
  const [a, b] = palettes[index % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
    </linearGradient></defs>
    <rect width="640" height="360" fill="url(#g)"/>
    <circle cx="${90 + (index * 37) % 460}" cy="${80 + (index * 53) % 190}" r="${64 + (index * 13) % 66}" fill="#ffffff" opacity="0.08"/>
    <rect x="0" y="240" width="640" height="120" fill="#000000" opacity="0.18"/>
    <text x="34" y="315" fill="#ffffff" opacity="0.94" font-family="Segoe UI, sans-serif" font-size="34" font-weight="600">${label}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};
const avatar = index => {
  const hues = [8, 28, 190, 210, 260, 320];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">
    <rect width="96" height="96" fill="hsl(${hues[index % hues.length]} 52% 46%)"/>
    <text x="48" y="62" text-anchor="middle" fill="#fff" font-family="Segoe UI, sans-serif" font-size="40">${'ABCDEF'[index % 6]}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};
const titles = [
  '把 8 小时直播剪成 12 分钟，我到底删掉了什么',
  '从零搭一套家用 NAS：硬件选型、系统与备份一次讲完',
  '这可能是今年最被低估的独立游戏',
  '实测 12 款降噪耳机，只有 3 款值得买',
  '在县城开书店的第 700 天',
  '一口气看完《三体》里的物理学',
  '用 300 行代码写一个能跑的浏览器',
  '为什么你的 CSS 布局总是差 2px',
  '骑行 1200 公里，我拍到了这样的风景',
  '拆解一台十年前的旗舰手机',
  '把老房子改成工作室，预算 8 万',
  '深夜食堂：一个人也要好好吃饭',
];
const authors = ['影视飓风', '老师好我叫何同学', '小约翰可汗', '罗翔说刑法', 'IC实验室', '硬核的半佛仙人', '木鱼水心', '老番茄', '机核网', '食贫道', '稚晖君', '影视飓风'];
const metas = ['324.1 万播放 · 2 天前', '86.4 万播放 · 5 天前', '12.7 万播放 · 1 周前', '512.3 万播放 · 3 周前', '9.8 万播放 · 1 天前', '241.6 万播放 · 4 天前', '77.2 万播放 · 6 天前', '43.9 万播放 · 2 周前', '198.5 万播放 · 1 个月前', '66.1 万播放 · 5 天前', '31.4 万播放 · 3 天前', '120.8 万播放 · 2 周前'];
const durations = ['12:04', '08:31', '24:19', '15:42', '06:20', '38:07', '11:55', '19:03', '27:48', '09:12', '33:30', '17:26'];
const make = count => Array.from({length: count}, (_, i) => ({
  bvid: `BV1fixture${i}`, kind: 'video', title: titles[i % titles.length],
  href: `https://www.bilibili.com/video/BV1fixture${i}`,
  author: authors[i % authors.length], authorHref: `https://space.bilibili.com/${1000 + i}`,
  meta: metas[i % metas.length], duration: durations[i % durations.length],
  thumbnail: thumb(i, `EP ${String(i + 1).padStart(2, '0')}`), avatar: avatar(i),
}));
const pool = make(48);
const cards = pool.slice(0, 24);
const shelves = [
  {key: 'following', title: '来自你的关注', href: 'https://t.bilibili.com/', items: make(10).map((item, i) => ({...item, bvid: `BVfollow${i}`}))},
  {key: 'popular', title: '热门', href: 'https://www.bilibili.com/v/popular/all/', items: make(10).map((item, i) => ({...item, bvid: `BVpop${i}`}))},
  {key: 'live', title: '正在直播', href: 'https://live.bilibili.com/', items: make(8).map((item, i) => ({...item, bvid: `BVlive${i}`, kind: 'live', duration: ''}))},
];
const noop = () => () => {};
const handlers = {
  bindPreview: noop, afterReconcile: () => {}, beforeRender: () => {},
  showCardAuthor: () => true, showCardMeta: () => true, showWatchLaterQuick: () => true,
  isWatchLater: () => false, toggleWatchLater: async () => false,
  loadMore: () => {}, retryFeed: () => {}, refreshCurrent: () => {},
  toggleTheme: () => {}, toggleVisualStyle: () => {}, toggleSidebar: () => {},
  openSettings: () => {}, followSpace: async () => false, requestSearchSuggestions: async () => [],
};
const chromeData = {
  href: 'https://www.bilibili.com/', renderKey: 'fixture',
  user: {mid: '12345', name: '示例用户', face: avatar(2)},
  subscriptions: [
    {name: '影视飓风', avatar: avatar(0), href: 'https://space.bilibili.com/1'},
    {name: '老师好我叫何同学', avatar: avatar(1), href: 'https://space.bilibili.com/2'},
    {name: '罗翔说刑法', avatar: avatar(3), href: 'https://space.bilibili.com/3'},
  ],
  settings: {showSubscriptions: true, glassMode: true, motionMode: 'full'},
};
const motion = typeof BiliTubeMotion === 'undefined' ? null
  : BiliTubeMotion.createController(document, {previewActive: () => window.__previewActive === true});
const shell = BiliTubeShell.createController(document, {motion});
const render = (route, payload) => {
  const data = {...chromeData, ...payload};
  if (!shell.getRoot()) shell.ensure(data, handlers);
  shell.render(route, data);
};
document.documentElement.dataset.btTheme = theme;
document.documentElement.dataset.btMotion = params.get('motion') || 'full';
document.documentElement.classList.toggle('bt-glass-mode', params.get('glass') !== '0');
const scenarios = {
  home: () => render('home', {route: 'home', category: 'all', videos: cards, shelves, loading: false, hasMore: true}),
  'home-category': () => render('home', {route: 'home', category: 'tech', videos: cards.slice(0, 8), shelves: [], loading: false, hasMore: false}),
  search: () => render('search-video', {route: 'search-video', query: '降噪耳机 实测', category: 'video',
    filters: {order: 'totalrank', duration: 0}, results: cards.slice(0, 6), users: [], loading: false, hasMore: true}),
  dynamic: () => render('dynamic', {route: 'dynamic', mode: 'all', loading: false, hasMore: true, items: [
    ...cards.slice(0, 5).map((video, i) => ({id: String(i), video})),
    ...cards.slice(5, 8).map((video, i) => ({id: 'p' + i, author: video.author, authorHref: video.authorHref,
      avatar: video.avatar, time: '2 小时前', href: video.href,
      text: '新的视频已经上传，这次把整个流程重新梳理了一遍，希望能帮到准备入坑的朋友。'})),
  ]}),
  watchlater: () => render('watchlater', {route: 'watchlater', loading: false, hasMore: false,
    videos: cards.slice(0, 6).map((item, i) => ({...item, progress: (i % 4) / 4}))}),
  favorites: () => render('favorites', {route: 'favorites', mid: '12345', selectedId: '9001', loading: false, hasMore: true,
    folders: [{id: '9001', title: '稍后再看的替代品', count: 24}, {id: '9002', title: '摄影与剪辑', count: 18}, {id: '9003', title: '硬核技术', count: 7}],
    selectedFolder: {id: '9001', title: '稍后再看的替代品', count: 24, cover: cards[0].thumbnail},
    videos: cards.slice(0, 8)}),
  skeleton: () => render('home', {route: 'home', category: 'all', videos: [], shelves: [], loading: true, hasMore: true}),
  space: () => render('space-upload', {route: 'space-upload', mid: '12345', loading: false, hasMore: true, videos: cards.slice(0, 8),
    profile: {mid: '12345', name: '影视飓风', avatar: '', sign: '这里是影视飓风，一个认真做视频的团队。', stats: '428.6 万粉丝 · 612 个视频', following: false}}),
};

const startDemo = () => {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147483600;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px;border-radius:14px;background:rgba(20,24,28,.9);box-shadow:0 12px 32px rgba(0,0,0,.35);font:12px/1 "Segoe UI",sans-serif;color:#f4f7fa';
  const button = (label, onClick) => {
    const node = document.createElement('button');
    node.type = 'button'; node.textContent = label;
    node.style.cssText = 'height:28px;padding:0 10px;border:0;border-radius:999px;background:rgba(255,255,255,.12);color:inherit;font:inherit;cursor:pointer';
    node.addEventListener('click', onClick);
    bar.append(node);
    return node;
  };
  const reveal = BiliTubeTheme.createRevealController(document);
  let list = cards.slice();
  const draw = extra => render('home', {route: 'home', category: 'all', videos: list, shelves: [], loading: false, hasMore: true, ...extra});
  draw();
  button('打乱顺序', () => {
    list = list.map(item => [Math.random(), item]).sort((a, b) => a[0] - b[0]).map(pair => pair[1]);
    draw();
  });
  button('追加 8 个', () => {
    const next = pool.slice(list.length, list.length + 8);
    if (!next.length) return;
    list = list.concat(next);
    draw({append: true});
  });
  button('只改标题', () => {
    list = list.map((item, index) => index === 0 ? {...item, title: item.title + '（已更新）'} : item);
    draw();
  });
  button('切换主题', () => {
    const next = document.documentElement.dataset.btTheme === 'dark' ? 'light' : 'dark';
    motion.cancel();
    reveal.run(() => { document.documentElement.dataset.btTheme = next; shell.updateTheme(next); }, null, true);
  });
  for (const mode of ['full', 'subtle', 'none']) {
    const node = button(`动效 ${mode}`, () => {
      document.documentElement.dataset.btMotion = mode;
      for (const other of bar.querySelectorAll('button')) if (other.textContent.startsWith('动效')) other.style.background = 'rgba(255,255,255,.12)';
      node.style.background = 'rgba(84,202,255,.9)'; node.style.color = '#06202b';
      motion.cancel();
    });
    if (mode === 'full') { node.style.background = 'rgba(84,202,255,.9)'; node.style.color = '#06202b'; }
  }
  document.body.append(bar);
};

const probe = async () => {
  const results = {};
  const baseData = {route: 'home', category: 'all', shelves: [], loading: false, hasMore: true};
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const settle = async () => { await sleep(600); await sleep(0); };
  const draw = (videos, extra = {}) => {
    render('home', {...baseData, videos, ...extra});
    document.body.offsetHeight; // flush layout so the next rect read is real
  };
  const cardAnimations = () => document.getAnimations().filter(animation => {
    const target = animation.effect && animation.effect.target;
    return target && target.classList && target.classList.contains('bt-video-card');
  });
  const list = cards.slice(0, 12);
  const reversed = [...list].reverse();

  // 1. Same-route reorder: every visible card is inverted.
  draw(list);
  let nodes = [...document.querySelectorAll('.bt-video-card')];
  results.registered = nodes.length;
  draw(reversed);
  let running = cardAnimations();
  results.flip = {
    animated: running.length,
    duration: running.length ? running[0].effect.getTiming().duration : 0,
    firstKeyframe: running.length ? running[0].effect.getKeyframes()[0].transform : null,
  };
  await settle();
  results.flip.clearedAfter = cardAnimations().length;
  results.flip.leftoverTransform = [...document.querySelectorAll('.bt-video-card')]
    .filter(node => getComputedStyle(node).transform !== 'none').length;
  results.flip.retainedNodes = nodes.every(node => document.contains(node));

  // 2. motionMode=none must update instantly.
  document.documentElement.dataset.btMotion = 'none';
  draw(list);
  draw(reversed);
  results.motionNone = {animated: cardAnimations().length};
  await settle();
  document.documentElement.dataset.btMotion = 'full';

  // 3. A playing hover preview owns the frame.
  window.__previewActive = true;
  draw(list);
  draw(reversed);
  results.previewActive = {animated: cardAnimations().length};
  window.__previewActive = false;
  await settle();

  // 4. The theme reveal owns the root View Transition.
  document.documentElement.classList.add('bt-theme-reveal');
  draw(list);
  draw(reversed);
  results.themeReveal = {animated: cardAnimations().length};
  document.documentElement.classList.remove('bt-theme-reveal');
  await settle();

  // 5. Pagination appends: only the new cards fade in, the list grows.
  motion.cancel();
  draw(list);
  await settle();
  motion.cancel(); // the reorder above must not leak into this frame
  const beforeCount = document.querySelectorAll('.bt-video-card').length;
  draw([...list, ...cards.slice(12, 16)], {append: true});
  results.append = {
    animated: cardAnimations().length,
    before: beforeCount,
    after: document.querySelectorAll('.bt-video-card').length,
  };
  await settle();

  // 6. Subtle keeps the same geometry with a shorter curve.
  document.documentElement.dataset.btMotion = 'subtle';
  draw(list);
  draw(reversed);
  running = cardAnimations();
  results.subtle = {animated: running.length, duration: running.length ? running[0].effect.getTiming().duration : 0};
  document.documentElement.dataset.btMotion = 'full';
  await settle();

  document.documentElement.dataset.btMetrics = btoa(unescape(encodeURIComponent(JSON.stringify(results))));
};
window.addEventListener('error', event => { document.documentElement.dataset.btError = String(event.message); });
try {
  (scenarios[scenario] || scenarios.home)();
  if (params.get('collapsed') === '1') shell.setCollapsed(true);
  window.__fixture = {cards, shelves, shell, motion, handlers, render};
  document.documentElement.dataset.btReady = '1';
  if (params.get('demo') === '1') { try { startDemo(); } catch (error) { document.documentElement.dataset.btError = String(error && error.stack || error); } }
  if (params.get('probe') === 'flip') {
    probe().catch(error => { document.documentElement.dataset.btError = String(error && error.stack || error); });
  }
} catch (error) {
  document.documentElement.dataset.btError = String(error && error.stack || error);
}
"""


ERROR_PROBE = """<script>window.addEventListener('error', function (event) {
  document.documentElement.dataset.btError = String(event.message || event.error);
});
window.addEventListener('unhandledrejection', function (event) {
  document.documentElement.dataset.btError = 'rejection: ' + String(event.reason && event.reason.stack || event.reason);
});</script>"""


def build_page(source: Path, target: Path) -> None:
    modules = [f'src/core/{name}.js' for name in MODULES if (source / f'src/core/{name}.js').exists()]
    scripts = '\n'.join(
        f'<script src="{Path(os.path.relpath(source / m, target.parent)).as_posix()}"></script>' for m in modules
    )
    styles = '\n'.join(
        f'<link rel="stylesheet" href="{Path(os.path.relpath(source / s, target.parent)).as_posix()}">'
        for s in ('src/styles/preflight.css', 'src/styles/core.css')
    )
    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>BiliTube UI preview</title>
{styles}
</head>
<body>
{ERROR_PROBE}
{scripts}
<script>{FIXTURE}</script>
</body>
</html>
"""
    target.write_text(html, encoding='utf-8')


def capture(browser: str, url: str, output: Path, width: int, height: int, scale: float, wait: int) -> None:
    profile = Path(tempfile.gettempdir()) / 'bilitube-ui-preview-profile'
    profile.mkdir(parents=True, exist_ok=True)
    command = [
        browser, '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
        f'--user-data-dir={profile}', f'--window-size={width},{height}',
        f'--force-device-scale-factor={scale}', f'--virtual-time-budget={wait}',
        f'--screenshot={output}', url,
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=180)
    if not output.exists():
        raise SystemExit(f'screenshot failed for {url}\n{result.stdout}\n{result.stderr}')


def dump(browser: str, url: str, wait: int) -> str:
    profile = Path(tempfile.gettempdir()) / 'bilitube-ui-preview-profile'
    command = [
        browser, '--headless=new', '--disable-gpu', '--no-sandbox',
        f'--user-data-dir={profile}', f'--virtual-time-budget={wait}', '--dump-dom', url,
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=180)
    return result.stdout


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', default=os.environ.get('BROWSER_EXECUTABLE', DEFAULT_BROWSER))
    parser.add_argument('--tag', default='current', help='output sub-folder, e.g. before/after')
    parser.add_argument('--scenario', action='append', default=None, help='repeatable; defaults to all')
    parser.add_argument('--theme', default='light', choices=['light', 'dark'])
    parser.add_argument('--glass', default='1', help='1 = glass mode, 0 = YouTube desktop style')
    parser.add_argument('--collapsed', default='0')
    parser.add_argument('--width', type=int, default=1600)
    parser.add_argument('--height', type=int, default=1000)
    parser.add_argument('--scale', type=float, default=1)
    parser.add_argument('--wait', type=int, default=2000, help='virtual time budget in ms')
    parser.add_argument('--dump', action='store_true', help='print the rendered DOM for the first scenario')
    parser.add_argument('--out', default=str(ROOT / 'output' / 'ui-preview'))
    parser.add_argument('--source-dir', default=str(ROOT))
    args = parser.parse_args()

    source = Path(args.source_dir).resolve()
    out_dir = Path(args.out) / args.tag
    out_dir.mkdir(parents=True, exist_ok=True)
    page_path = out_dir / 'fixture.html'
    build_page(source, page_path)
    names = args.scenario or ['home', 'home-category', 'search', 'dynamic', 'watchlater', 'favorites', 'skeleton', 'space']

    url_base = page_path.as_uri()
    for name in names:
        suffix = [] if args.glass == '1' else ['glass=0']
        if args.collapsed == '1':
            suffix.append('collapsed=1')
        query = '&'.join([f'scenario={name}', f'theme={args.theme}', *suffix])
        url = f'{url_base}?{query}'
        target = out_dir / f'{name}-{args.theme}{"-original" if args.glass == "0" else ""}.png'
        capture(args.browser, url, target, args.width, args.height, args.scale, args.wait)
        print(f'{name:14s} {target.stat().st_size:>8d} bytes  {target}')
    if args.dump:
        query = f'scenario={names[0]}&theme={args.theme}'
        print(dump(args.browser, f'{url_base}?{query}', args.wait)[:4000])


if __name__ == '__main__':
    main()
