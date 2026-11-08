"""Repeatable Edge fixtures for feed rendering, theme paint and Watch observer work."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import statistics

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SETUP = r"""() => {
  window.counts = {created:0, queries:0};
  const create = document.createElement.bind(document);
  document.createElement = (...args) => {counts.created++; return create(...args)};
  for (const proto of [Document.prototype, Element.prototype]) {
    for (const name of ['querySelector', 'querySelectorAll']) {
      const original = proto[name];
      proto[name] = function(...args) {counts.queries++; return original.apply(this,args)};
    }
  }
  window.cards = Array.from({length:500}, (_,i)=>({bvid:`BVperf${i}`,kind:'video',
    title:`Video ${i}`,href:`https://www.bilibili.com/video/BVperf${i}`,
    author:'Fixture',authorHref:'https://space.bilibili.com/123',meta:'100 views',
    thumbnail:'https://fixture.invalid/thumb.svg',duration:'2:00'}));
  window.preview = BiliTubePreview.createController();
  window.handlers = {bindPreview:preview.bind,afterReconcile:preview.prune,
    beforeRender:preview.destroy,showCardAuthor:()=>true,showCardMeta:()=>true};
  window.shell = BiliTubeShell.createController(document);
  window.payload = {href:'https://www.bilibili.com/',videos:cards,hasMore:false,shelves:[]};
  shell.ensure(payload,handlers); shell.render('home',payload);
  document.documentElement.dataset.btTheme='light';
  document.documentElement.dataset.btMotion='full';
  window.reveal = BiliTubeTheme.createRevealController(document);
} """


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', default=os.environ.get('BROWSER_EXECUTABLE', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'))
    parser.add_argument('--output', default=str(ROOT/'output'/'performance-audit'/'report.json'))
    parser.add_argument('--runs', type=int, default=5)
    parser.add_argument('--source-dir', default=str(ROOT), help='Source snapshot to compare using the same fixture')
    parser.add_argument('--measure-only', action='store_true', help='Record old-source functional failures without failing the comparison')
    args = parser.parse_args()
    source_root=Path(args.source_dir).resolve()
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    report = {'kind':'isolated headless Edge, 500-card fixture; not live account or display FPS', 'checks':[]}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.browser, headless=True)
        report.update(browser=browser.version,viewport=[1920,1080],deviceScaleFactor=2,runs=args.runs)
        context = browser.new_context(viewport={'width':1920,'height':1080}, device_scale_factor=2)
        context.route('**/*', lambda route: route.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#789"/></svg>'))
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.set_content('<!doctype html><html><body></body></html>')
        page.add_style_tag(path=str(source_root/'src/styles/core.css'))
        for module in ['ui','reconcile','shell','preview-model','preview','theme','extract','watch','native-adapter']:
            page.add_script_tag(path=str(source_root/f'src/core/{module}.js'))
        page.evaluate(SETUP)
        page.wait_for_timeout(700)
        report['render'] = {}
        for mode in ['unchanged','metadata','shelves']:
            samples = []
            for index in range(args.runs):
                samples.append(page.evaluate(r"""({mode,index}) => {
                  const first=document.querySelector('.bt-video-card');
                  const image=first.querySelector('img');
                  const videos=cards.map(item=>({...item}));
                  if(mode==='metadata')videos[0].title=`Changed ${index}`;
                  const shelves=mode==='shelves'&&index%2===0?[{key:'popular',title:'Popular',items:videos.slice(20,32)}]:[];
                  counts.created=counts.queries=0;
                  const start=performance.now();shell.render('home',{...payload,videos,shelves});
                  const ms=performance.now()-start;
                  const result={ms,created:counts.created,queries:counts.queries,
                    cardRetained:first===document.querySelector('.bt-video-card'),
                    imageRetained:image===document.querySelector('.bt-video-card img')};
                  if(mode==='metadata'&&!document.querySelector('.bt-card-title').textContent.includes(`Changed ${index}`))throw Error('Stale metadata');
                  if(document.querySelectorAll('.bt-video-card').length!==500+(shelves.length?12:0))throw Error('Lost or duplicate cards');
                  return result;
                }""", {'mode':mode,'index':index}))
                page.wait_for_timeout(80)
            assert all(s['cardRetained'] and s['imageRetained'] for s in samples)
            report['render'][mode] = {'medianMs':statistics.median(s['ms'] for s in samples),'medianCreated':statistics.median(s['created'] for s in samples),'samples':samples}
        report['checks'].append('Refresh, metadata changes and shelf insertion retain existing cards and images')
        report['loadedThumbnailAnimations'] = page.evaluate("() => [...document.querySelectorAll('.bt-thumb.is-image-loaded .bt-thumb-progress-shimmer')].filter(node=>getComputedStyle(node).animationName!=='none').length")
        report['listRefresh'] = page.evaluate(r"""() => {
          const result={};
          for(const route of ['search-video','favorites','space-upload','watchlater','dynamic']){
            try {
            const videos=cards.slice(0,100);
            const data={...payload,mid:'123',query:'fixture',category:'video',results:videos,videos,
              items:videos.map((video,i)=>({id:String(i),video})),shelves:[],folders:[]};
            shell.render(route,data);
            const first=document.querySelector('#bilitube-outlet article');
            const image=first.querySelector('img');counts.created=0;
            const start=performance.now();shell.render(route,{...data});
            result[route]={ms:performance.now()-start,created:counts.created,
              cardRetained:first===document.querySelector('#bilitube-outlet article'),imageRetained:image===first.querySelector('img')};
            if(!result[route].cardRetained||!result[route].imageRetained)throw Error(`Lost ${route} card`);
            } catch(error){result[route]={error:String(error)};}
          }
          shell.render('home',payload);
          // Duplicate keys, a changed copy and removals must never steal a
          // reserved unchanged card or leave an empty staging placeholder.
          const duplicate=[cards[0],{...cards[0],title:'Duplicate'},cards[1]];
          shell.render('home',{...payload,videos:duplicate});
          const original=[...document.querySelectorAll('.bt-video-card')];
          shell.render('home',{...payload,videos:[{...duplicate[1],title:'Changed duplicate'},duplicate[0]]});
          const current=[...document.querySelectorAll('.bt-video-card')];
          result.duplicates={passed:current.length===2&&current[1]===original[0]&&current[0].querySelector('.bt-card-title')?.textContent==='Changed duplicate'};
          shell.render('home',payload);return result;
        }""")
        if not args.measure_only:
            assert all('error' not in value for value in report['listRefresh'].values()), report['listRefresh']
            assert report['listRefresh']['duplicates']['passed'], report['listRefresh']
            report['checks'].append('Search, favorites, channels, Watch Later and dynamic lists retain cards; duplicate keys and deletions reconcile correctly')
        page.wait_for_timeout(500)
        report['theme'] = []
        session = context.new_cdp_session(page)
        events = []
        done = {'value':False}
        session.on('Tracing.dataCollected',lambda message:events.extend(message['value']))
        session.on('Tracing.tracingComplete',lambda _:done.update(value=True))
        for _ in range(args.runs):
            events.clear(); done['value']=False
            session.send('Tracing.start',{'categories':'devtools.timeline,blink.user_timing','transferMode':'ReportEvents'})
            sample = page.evaluate(r"""async () => {
              const frames=[];let running=true;
              function frame(t){frames.push(t);if(running)requestAnimationFrame(frame)}
              requestAnimationFrame(frame);
              const start=performance.now();
              await reveal.run(()=>{const next=document.documentElement.dataset.btTheme==='dark'?'light':'dark';shell.updateTheme(next)},null,true);
              running=false;
              const intervals=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);
              return {ms:performance.now()-start,maxFrameMs:Math.max(0,...intervals),framesOver33ms:intervals.filter(ms=>ms>33.4).length};
            }""")
            session.send('Tracing.end')
            for _ in range(200):
                if done['value']: break
                page.wait_for_timeout(50)
            assert done['value'], 'Trace flush timed out'
            sample['paintMs']=sum(event.get('dur',0) for event in events if event.get('name')=='Paint')/1000
            for name in ['UpdateLayoutTree','Layout','PrePaint']:
                sample[name+'Ms']=sum(event.get('dur',0) for event in events if event.get('name')==name)/1000
            report['theme'].append(sample)
        page.screenshot(path=str(Path(args.output).with_suffix('.png')))
        page.evaluate(r"""() => {
          shell.destroy();preview.destroy();
          document.body.innerHTML='<div id="app"><div class="video-container-v1"><div class="left-container"><div id="playerWrap"><div class="bpx-player-container" data-screen="normal"><div id="danmaku"></div></div></div><div class="video-info-container"><h1>Fixture</h1></div><div id="arc_toolbar_report"></div><div id="comment-module"></div></div><div class="right-container"><div class="right-container-inner"><div class="recommend-list-v1"></div></div></div></div></div>';
          window.watch=BiliTubeWatch.createDecorator(document);watch.mount({}, {canDecorateAuthor:()=>false},'light',{});
        }""")
        page.wait_for_timeout(250)
        report['watch'] = page.evaluate(r"""async () => {
          const host=document.getElementById('danmaku');
          const nodes=Array.from({length:200},()=>document.createElement('span'));
          counts.queries=0;host.append(...nodes);await new Promise(resolve=>setTimeout(resolve,0));
          const playerQueries=counts.queries;
          const related=document.querySelector('.recommend-list-v1');
          const fragment=document.createElement('div');fragment.innerHTML='<div class="recommend-list"><span>New related list</span></div>';
          document.querySelector('.right-container-inner').append(fragment);
          await new Promise(resolve=>setTimeout(resolve,0));
          if(!fragment.firstChild.classList.contains('bt-native-watch-related'))throw Error('Missed late region');
          const info=document.querySelector('.video-info-container');info.className='video-info-container';
          await new Promise(resolve=>setTimeout(resolve,0));
          if(!info.classList.contains('bt-native-watch-info'))throw Error('Lost info marker');
          watch.destroy();return {playerMutationQueries:playerQueries,lateRegions:true,classRestoration:true};
        }""")
        assert not errors, errors
        report['adapter'] = page.evaluate(r"""async () => {
          const nativeHeader=document.createElement('div');nativeHeader.className='bili-header';nativeHeader.style.color='red';document.body.append(nativeHeader);
          const adapter=BiliTubeNativeAdapter.createAdapter(document),data={route:'live',settings:{}};
          adapter.mount(data,{},'light',{route:'live'});adapter.updateChrome(data);adapter.toggleSidebar();
          const drawer=document.querySelector('#bilitube-native-layer .bt-sidebar-drawer-backdrop'),focused=document.activeElement;
          counts.created=0;for(let i=0;i<10;i++)adapter.updateChrome({...data});
          const created=counts.created,drawerRetained=drawer===document.querySelector('#bilitube-native-layer .bt-sidebar-drawer-backdrop'),focusRetained=focused===document.activeElement;
          await new Promise(resolve=>setTimeout(resolve,0));
          const liveDrawer=document.querySelector('#bilitube-native-layer .bt-sidebar-drawer-backdrop');
          const decoration=document.createElement('span');counts.queries=0;liveDrawer.append(decoration);
          await new Promise(resolve=>setTimeout(resolve,0));const ownMutationQueries=counts.queries;
          const late=document.createElement('section');late.innerHTML='<div class="bili-header-v2"></div>';document.body.append(late);
          await new Promise(resolve=>setTimeout(resolve,0));
          const lateHidden=late.firstChild.style.display==='none';adapter.restore();
          const restored=nativeHeader.style.display===''&&nativeHeader.style.color==='red'&&late.firstChild.style.display==='';
          return {created,drawerRetained,focusRetained,ownMutationQueries,lateHidden,restored};
        }""")
        if not args.measure_only:
            assert report['loadedThumbnailAnimations']==0, 'Loaded thumbnails still animate invisibly'
            assert report['watch']['playerMutationQueries']==0, 'Player-only changes triggered region scans'
            assert report['adapter']==dict(created=0,drawerRetained=True,focusRetained=True,ownMutationQueries=0,lateHidden=True,restored=True), report['adapter']
        report['checks'].append('Watch ignores player churn while discovering late regions and restoring Vue class changes')
        context.close();browser.close()
    output = Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))


if __name__=='__main__':main()
