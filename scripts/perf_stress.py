"""Brute-force stress benchmark across every BiliTube page pipeline.

Covers all render strategies with heavy fixtures: replace routes (home, search,
dynamic, watchlater, favorites, space) at 300-1000 cards with dozens of
consecutive reconciles, the watch decorator under comment storms, native
adapt chrome updates, preview bind lifecycles and the DOM-extract fallback.

Each scenario records sync wall time plus deterministic workload counters
(createElement, querySelector(All), matches, getBoundingClientRect). Run the
same script against a source snapshot with --source-dir to compare.
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

SETUP = r"""() => {
  window.counts = {created:0, queries:0, matches:0, rects:0};
  const create = document.createElement.bind(document);
  document.createElement = (...args) => {counts.created++; return create(...args)};
  for (const proto of [Document.prototype, Element.prototype]) {
    for (const name of ['querySelector', 'querySelectorAll']) {
      const original = proto[name];
      proto[name] = function(...args) {
        counts.queries++;
        return original.apply(this, args);
      };
    }
    const matches = proto.matches;
    if (matches) proto.matches = function(...args) { counts.matches++; return matches.apply(this, args); };
  }
  const rect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function() { counts.rects++; return rect.apply(this, arguments); };
  window.makeCards = (n, prefix='BVperf') => Array.from({length:n},(_,i)=>({bvid:`${prefix}${i}`,kind:'video',
    title:`Video ${i} with a reasonably long fixture title`,href:`https://www.bilibili.com/video/${prefix}${i}`,
    author:'Fixture',authorHref:'https://space.bilibili.com/123',meta:'1.2万播放 · 3 天前',
    thumbnail:'https://fixture.invalid/thumb.svg',duration:'12:34',description:'Fixture description'}));
  window.cards = makeCards(500);
  window.preview = BiliTubePreview.createController();
  window.motion = BiliTubeMotion.createController(document, {
    previewActive: () => Boolean(preview && preview.isActive && preview.isActive()),
    shouldMeasure: card => !(preview && preview.isKnownOffscreen && preview.isKnownOffscreen(card)),
  });
  window.handlers = {bindPreview:preview.bind, afterReconcile:preview.prune,
    beforeRender:preview.destroy, showCardAuthor:()=>true, showCardMeta:()=>true};
  window.shell = BiliTubeShell.createController(document, {motion});
  window.chromeData = () => ({user:{mid:'123',name:'Fixture',face:''}, subscriptions:[], settings:{}, route:'home'});
  window.resetCounts = () => {counts.created=counts.queries=counts.matches=counts.rects=0};
  window.readCounts = () => ({created:counts.created, queries:counts.queries, matches:counts.matches, rects:counts.rects});
  window.settle = ms => new Promise(resolve => setTimeout(resolve, ms));
  // MutationObserver deliveries are microtasks; awaiting one settled promise
  // flushes them without setTimeout latency polluting the measured window.
  window.flush = () => Promise.resolve();
  window.hardReset = () => {
    try { shell.destroy(); } catch {}
    try { preview.destroy(); } catch {}
    try { motion.destroy(); } catch {}
    document.body.replaceChildren();
    document.documentElement.className = '';
    window.shell = BiliTubeShell.createController(document, {motion});
    window.preview = BiliTubePreview.createController();
    window.handlers = {bindPreview:preview.bind, afterReconcile:preview.prune,
      beforeRender:preview.destroy, showCardAuthor:()=>true, showCardMeta:()=>true};
  };
}"""

SCENARIOS = r"""() => {
  const scenarios = {};
  const stats = (start, counts) => ({ms: performance.now() - start, ...counts});

  // ---- replace: home -------------------------------------------------
  const homePayload = (videos=window.cards, shelves=[]) => ({
    ...chromeData(), href:'https://www.bilibili.com/', category:'all',
    videos, shelves, hasMore:false, loading:false});
  const mountHome = (videos=window.cards) => {
    hardReset();
    const payload = homePayload(videos);
    resetCounts();
    const start = performance.now();
    shell.ensure(payload, handlers);
    shell.render('home', payload);
    return {sample: stats(start, readCounts()), payload};
  };
  scenarios.home_cold_500 = async () => {
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const {sample} = mountHome();
      samples.push(sample);
      await settle(40);
    }
    return {samples};
  };
  scenarios.home_rerender_unchanged_500 = async () => {
    const {payload} = mountHome();
    await settle(60);
    const samples = [];
    for (let i = 0; i < 50; i++) {
      shell.updateChrome(chromeData());
      resetCounts();
      const start = performance.now();
      shell.render('home', homePayload());
      samples.push(stats(start, readCounts()));
      if (i === 0) await settle(30); // let observers bind once
    }
    return {samples};
  };
  scenarios.home_rerender_metadata_500 = async () => {
    const {payload} = mountHome();
    await settle(60);
    const samples = [];
    for (let i = 0; i < 30; i++) {
      const videos = [{...window.cards[0], title:`Changed ${i}`}, ...window.cards.slice(1)];
      resetCounts();
      const start = performance.now();
      shell.render('home', homePayload(videos));
      samples.push(stats(start, readCounts()));
      const shown = document.querySelector('.bt-card-title').textContent;
      if (!shown.includes(`Changed ${i}`)) throw Error(`Stale metadata: ${shown}`);
    }
    return {samples};
  };
  scenarios.home_thumbnail_change = async () => {
    const {payload} = mountHome();
    await settle(60);
    const samples = [];
    for (let i = 0; i < 10; i++) {
      const videos = [{...window.cards[0], thumbnail:`https://fixture.invalid/changed${i}.svg`}, ...window.cards.slice(1)];
      resetCounts();
      const start = performance.now();
      shell.render('home', homePayload(videos));
      samples.push(stats(start, readCounts()));
      const img = document.querySelector('.bt-video-card .bt-thumb-image');
      if (!img || !String(img.getAttribute('src') || img.src || '').includes(`changed${i}`)) {
        throw Error(`Thumbnail not updated: src=${img && img.getAttribute('src')}`);
      }
    }
    return {samples};
  };
  scenarios.home_shelf_swap_500 = async () => {
    const {payload} = mountHome();
    await settle(60);
    const samples = [];
    for (let i = 0; i < 30; i++) {
      const shelves = i % 2 === 0
        ? [{key:'popular', title:'Popular shelf', items: window.cards.slice(20, 32)}] : [];
      resetCounts();
      const start = performance.now();
      shell.render('home', homePayload(window.cards, shelves));
      samples.push(stats(start, readCounts()));
    }
    return {samples};
  };
  scenarios.home_append_30 = async () => {
    const {payload} = mountHome();
    await settle(60);
    const samples = [];
    for (let i = 0; i < 10; i++) {
      const added = makeCards(30, `BVadd${i}`);
      const first = document.querySelector('.bt-video-card');
      const image = first && first.querySelector('img');
      resetCounts();
      const start = performance.now();
      shell.render('home', {...homePayload([...window.cards, ...added]), append:true});
      samples.push(stats(start, readCounts()));
      const firstNow = document.querySelector('.bt-video-card');
      if (first !== firstNow) throw Error('append replaced the first card');
      if (image && first.querySelector('img') !== image) throw Error('append replaced the first image');
      hardReset();
      const rebuilt = homePayload();
      shell.ensure(rebuilt, handlers);
      shell.render('home', rebuilt);
      await settle(20);
    }
    return {samples};
  };
  scenarios.home_sustained_1000 = async () => {
    const big = makeCards(1000, 'BVbig');
    const {payload} = mountHome(big);
    await settle(60);
    const samples = [];
    for (let i = 0; i < 100; i++) {
      resetCounts();
      const start = performance.now();
      shell.render('home', homePayload(big));
      samples.push(stats(start, readCounts()));
    }
    return {samples};
  };

  // ---- replace: other routes ----------------------------------------
  const routeRerender = (route, build, iterations) => async () => {
    hardReset();
    const data = build();
    const payload = {...data};
    shell.ensure(payload, handlers);
    shell.render(route, payload);
    await settle(60);
    const samples = [];
    for (let i = 0; i < iterations; i++) {
      shell.updateChrome(chromeData());
      resetCounts();
      const start = performance.now();
      shell.render(route, build());
      samples.push(stats(start, readCounts()));
      if (i === 0) await settle(30);
    }
    return {samples};
  };
  scenarios.search_rerender_300 = routeRerender('search-video', () => ({
    ...chromeData(), href:'https://search.bilibili.com/video', query:'fixture', category:'video',
    filters:{order:'totalrank', duration:0}, results: window.cards.slice(0, 300), videos: window.cards.slice(0, 300),
    users:[], hasMore:true, loading:false}), 30);
  scenarios.dynamic_rerender = routeRerender('dynamic', () => ({
    ...chromeData(), href:'https://t.bilibili.com/', mode:'all',
    items: window.cards.slice(0, 150).map((video, i) => ({id:String(i), video, ...(!i ? {author:'Fixture', text:'A dynamic post', time:'3 小时前'} : {})}))
      .concat(Array.from({length: 80}, (_, i) => ({id:`post${i}`, author:'Fixture', authorHref:'https://space.bilibili.com/123',
        time:'1 小时前', text:`Post ${i} with some fixture text`.repeat(2), images:[], href:'https://t.bilibili.com/1'}))),
    hasMore:true, loading:false}), 30);
  scenarios.watchlater_rerender_200 = routeRerender('watchlater', () => ({
    ...chromeData(), href:'https://www.bilibili.com/list/watchlater',
    videos: window.cards.slice(0, 200).map((item, i) => ({...item, progress: i % 3 ? 0.4 : 0})),
    hasMore:false, loading:false}), 30);
  scenarios.favorites_rerender_200 = routeRerender('favorites', () => ({
    ...chromeData(), href:'https://space.bilibili.com/123/favlist', mid:'123',
    folders: Array.from({length: 8}, (_, i) => ({id:String(200+i), title:`Folder ${i}`, count:50})),
    videos: window.cards.slice(0, 200), selectedId:'200',
    selectedFolder:{id:'200', title:'Folder 0', count:50, cover:''}, hasMore:false, loading:false}), 30);
  scenarios.space_rerender_200 = routeRerender('space-upload', () => ({
    ...chromeData(), href:'https://space.bilibili.com/123/upload', mid:'123',
    profile:{mid:'123', name:'Fixture', avatar:'', banner:'', stats:'1.2万粉丝', sign:'Fixture sign', following:false},
    videos: window.cards.slice(0, 200), hasMore:false, loading:false}), 30);

  // ---- decorate: watch ------------------------------------------------
  const mountWatch = () => {
    document.body.replaceChildren();
    document.body.innerHTML = '<div id="app"><div class="video-container-v1"><div class="left-container">'
      + '<div id="playerWrap"><div class="bpx-player-container" data-screen="normal"><div id="danmaku"></div></div></div>'
      + '<div class="video-info-container"><h1>Fixture</h1></div><div id="arc_toolbar_report"></div>'
      + '<div class="up-panel-container"><a href="https://space.bilibili.com/123" class="up-name">Fixture</a></div>'
      + '<div id="v_desc"></div><div id="comment-module"></div></div>'
      + '<div class="right-container"><div class="right-container-inner"><div class="recommend-list-v1"></div></div></div>'
      + '</div></div>';
    window.watch = BiliTubeWatch.createDecorator(document);
    watch.mount({}, {canDecorateAuthor: () => false}, 'light', {});
  };
  scenarios.watch_comment_storm = async () => {
    mountWatch();
    await settle(250);
    const samples = [];
    const comments = document.querySelector('#comment-module');
    for (let batch = 0; batch < 10; batch++) {
      const entries = Array.from({length: 200}, (_, i) => {
        const entry = document.createElement('div');
        entry.className = 'comment-item';
        entry.innerHTML = `<span class="user">User ${i}</span><span class="reply">Comment body ${i}</span>`;
        return entry;
      });
      const fragment = document.createElement('div');
      fragment.innerHTML = '<div class="recommend-list"><span>New related list</span></div>';
      const aside = document.querySelector('.right-container-inner');
      resetCounts();
      const start = performance.now();
      comments.append(...entries);
      if (batch % 3 === 2) aside.append(fragment);
      await flush();
      samples.push(stats(start, readCounts()));
      if (batch % 3 === 2 && !fragment.firstChild.classList.contains('bt-native-watch-related')) {
        throw Error('Missed late region during comment storm');
      }
    }
    watch.destroy();
    return {samples};
  };
  scenarios.watch_class_storm = async () => {
    mountWatch();
    await settle(250);
    const samples = [];
    const info = document.querySelector('.video-info-container');
    for (let i = 0; i < 50; i++) {
      info.className = 'video-info-container';
      resetCounts();
      const start = performance.now();
      info.className = 'video-info-container is-rewritten';
      await flush();
      samples.push(stats(start, readCounts()));
      if (!info.classList.contains('bt-native-watch-info')) throw Error('Lost info marker');
    }
    watch.destroy();
    return {samples};
  };

  // ---- adapt: native adapter -----------------------------------------
  const mountAdapter = () => {
    document.body.replaceChildren();
    const nativeHeader = document.createElement('div');
    nativeHeader.className = 'bili-header';
    document.body.append(nativeHeader);
    const adapter = BiliTubeNativeAdapter.createAdapter(document);
    adapter.mount({route:'live', settings:{}}, {}, 'light', {route:'live'});
    return {adapter, nativeHeader};
  };
  scenarios.adapt_chrome_identical = async () => {
    const {adapter} = mountAdapter();
    await settle(80);
    const data = {route:'live', settings:{}, user:{mid:'1', name:'Fixture'}, subscriptions:[]};
    const samples = [];
    for (let i = 0; i < 50; i++) {
      resetCounts();
      const start = performance.now();
      adapter.updateChrome({...data});
      samples.push(stats(start, readCounts()));
    }
    adapter.restore();
    return {samples};
  };
  scenarios.adapt_chrome_changing = async () => {
    const {adapter} = mountAdapter();
    await settle(80);
    const samples = [];
    for (let i = 0; i < 50; i++) {
      const data = {route:'live', settings:{}, user:{mid:'1', name:`Fixture ${i}`},
        subscriptions:[{mid:String(i), name:`Sub ${i}`, href:'https://space.bilibili.com/1', avatar:''}]};
      resetCounts();
      const start = performance.now();
      adapter.updateChrome(data);
      samples.push(stats(start, readCounts()));
    }
    adapter.restore();
    return {samples};
  };
  scenarios.adapt_native_inserts = async () => {
    const {adapter} = mountAdapter();
    await settle(80);
    const samples = [];
    for (let batch = 0; batch < 10; batch++) {
      const section = document.createElement('section');
      section.innerHTML = Array.from({length: 50}, (_, i) => `<div class="bili-header-v2"><span>Item ${i}</span></div>`).join('');
      resetCounts();
      const start = performance.now();
      document.body.append(section);
      await flush();
      samples.push(stats(start, readCounts()));
    }
    adapter.restore();
    return {samples};
  };

  // ---- preview lifecycle ---------------------------------------------
  scenarios.preview_bind_cycle = async () => {
    hardReset();
    const payload = homePayload();
    shell.ensure(payload, handlers);
    shell.render('home', payload);
    await settle(60);
    const samples = [];
    for (let i = 0; i < 10; i++) {
      const cardList = [...document.querySelectorAll('#bilitube-outlet article')].filter(node => node.__btCardItem);
      resetCounts();
      const start = performance.now();
      for (const card of cardList) preview.bind(card, card.__btCardItem, card.__btPreviewHost);
      for (const card of cardList) preview.destroy();
      samples.push(stats(start, readCounts()));
    }
    return {samples};
  };

  // ---- extract fallback ----------------------------------------------
  scenarios.extract_search_cards = async () => {
    document.body.replaceChildren();
    const host = document.createElement('div');
    host.innerHTML = Array.from({length: 500}, (_, i) => `
      <div class="bili-video-card"><div class="bili-video-card__info">
        <a href="https://www.bilibili.com/video/BVext${i}"><h3 title="Extracted ${i}">Extracted ${i}</h3></a>
        <a href="https://space.bilibili.com/123"><img src="https://fixture.invalid/a.svg">Fixture</a>
        <span class="bili-video-card__stats--item">1.2万</span>
        <span class="bili-video-card__stats__duration">3:21</span>
      </div></div>`).join('');
    document.body.append(host);
    const samples = [];
    for (let i = 0; i < 10; i++) {
      resetCounts();
      const start = performance.now();
      const items = BiliTubeExtract.extractSearchCards(document);
      samples.push(stats(start, readCounts()));
      if (items.length !== 60) throw Error(`extract found ${items.length} items`);
    }
    document.body.replaceChildren();
    return {samples};
  };

  window.scenarios = scenarios;
  return Object.keys(scenarios);
}"""


def summarize(samples: list[dict]) -> dict:
    def agg(key: str) -> dict:
        values = [s[key] for s in samples]
        return {
            'median': round(statistics.median(values), 3),
            'p95': round(sorted(values)[max(0, int(len(values) * 0.95) - 1)], 3),
            'max': round(max(values), 3),
        }
    return {
        'iterations': len(samples),
        'ms': agg('ms'),
        'created': agg('created'),
        'queries': agg('queries'),
        'matches': agg('matches'),
        'rects': agg('rects'),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', default=os.environ.get(
        'BROWSER_EXECUTABLE', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'))
    parser.add_argument('--output', default=str(ROOT / 'output' / 'perf-stress' / 'report.json'))
    parser.add_argument('--source-dir', default=str(ROOT), help='Source snapshot the benchmark runs against')
    parser.add_argument('--measure-only', action='store_true', help='Record failures without failing the run')
    parser.add_argument('--label', default='')
    args = parser.parse_args()
    source_root = Path(args.source_dir).resolve()
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    report = {
        'kind': 'isolated headless Edge brute-force stress; sync wall time and workload counters, not display FPS',
        'label': args.label,
        'sourceDir': str(source_root),
        'scenarios': {},
        'checks': [],
        'failures': [],
    }
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.browser, headless=True)
        report['browser'] = browser.version
        context = browser.new_context(viewport={'width': 1920, 'height': 1080}, device_scale_factor=2)
        context.route('**/*', lambda route: route.fulfill(
            content_type='image/svg+xml',
            body='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#789"/></svg>'))
        page = context.new_page()
        errors: list[str] = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.set_content('<!doctype html><html><body></body></html>')
        page.add_style_tag(path=str(source_root / 'src/styles/core.css'))
        for module in ['data', 'ui', 'reconcile', 'shell', 'preview-model', 'preview', 'motion',
                       'extract', 'watch', 'native-adapter']:
            page.add_script_tag(path=str(source_root / f'src/core/{module}.js'))
        page.evaluate(SETUP)
        page.wait_for_timeout(300)
        scenarios = page.evaluate(SCENARIOS)
        for name in scenarios:
            try:
                result = page.evaluate(f'async () => await window.scenarios["{name}"]()')
                report['scenarios'][name] = summarize(result['samples'])
                report['checks'].append(name)
            except Exception as error:  # noqa: BLE001 - record and continue the sweep
                report['failures'].append({'scenario': name, 'error': str(error)})
            page.wait_for_timeout(60)
        if errors:
            report['failures'].append({'scenario': 'pageerror', 'error': '; '.join(errors)})
        browser.close()
    Path(args.output).write_text(json.dumps(report, indent=2), encoding='utf-8')
    if report['failures'] and not args.measure_only:
        raise SystemExit(f"scenario failures: {report['failures']}")
    print(json.dumps({name: {'ms': data['ms']['median'], 'queries': data['queries']['median'],
                             'matches': data['matches']['median'], 'created': data['created']['median'],
                             'rects': data['rects']['median']}
                      for name, data in report['scenarios'].items()}, indent=2))
    print(f"report: {args.output}")


if __name__ == '__main__':
    main()
