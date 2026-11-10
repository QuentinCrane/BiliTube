"""Measure homepage refresh and motion work in an isolated browser fixture."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import statistics

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', default=str(ROOT))
    parser.add_argument('--output', default=str(ROOT / 'output' / 'homepage-performance' / 'report.json'))
    parser.add_argument('--runs', type=int, default=5)
    parser.add_argument('--browser', default=os.environ.get('BROWSER_EXECUTABLE', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'))
    args = parser.parse_args()
    source = Path(args.source_dir).resolve()
    report = {'kind': 'isolated headless browser; 500 homepage cards, not live network or display FPS', 'runs': args.runs}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.browser, headless=True)
        report['browser'] = browser.version
        context = browser.new_context(viewport={'width': 1920, 'height': 1080}, device_scale_factor=2)
        context.route('**/*', lambda route: route.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"/>'))
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.set_content('<!doctype html><html><body></body></html>')
        page.add_style_tag(path=str(source / 'src/styles/core.css'))
        for module in ['ui', 'reconcile', 'motion', 'shell', 'preview-model', 'preview']:
            page.add_script_tag(path=str(source / f'src/core/{module}.js'))
        page.evaluate(r"""() => {
          document.documentElement.dataset.btTheme='light';
          document.documentElement.dataset.btMotion='full';
          window.cards=Array.from({length:500},(_,i)=>({bvid:`BVhome${i}`,kind:'video',
            title:`Homepage ${i}`,href:`https://www.bilibili.com/video/BVhome${i}`,
            author:'Fixture',authorHref:'https://space.bilibili.com/1',
            thumbnail:'https://fixture.invalid/thumb.svg',meta:'100 views'}));
          window.preview=BiliTubePreview.createController();
          window.motion=BiliTubeMotion.createController(document,{previewActive:()=>preview.isActive(),
            shouldMeasure:node=>!preview.isKnownOffscreen?.(node)});
          window.handlers={bindPreview:preview.bind,afterReconcile:preview.prune,beforeRender:preview.destroy,
            showCardAuthor:()=>true,showCardMeta:()=>true};
          window.shell=BiliTubeShell.createController(document,{motion});
          window.payload={href:'https://www.bilibili.com/',category:'all',videos:cards,shelves:[],hasMore:true};
          shell.ensure(payload,handlers);shell.render('home',payload);
        }""")
        page.wait_for_timeout(900)
        report['positions'] = {}
        for position, fraction in [('top', 0), ('middle', 0.5), ('bottom', 1)]:
            page.evaluate('(fraction)=>scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*fraction)', fraction)
            page.wait_for_timeout(250)
            samples = []
            for _ in range(args.runs):
                samples.append(page.evaluate(r"""() => {
                  const first=document.querySelector('.bt-video-card'),image=first.querySelector('img');
                  const cards=[...document.querySelectorAll('#bilitube-outlet article')].filter(node=>node.__btCardKey);
                  const skipped=typeof Element.prototype.checkVisibility==='function'
                    ?cards.filter(node=>!node.checkVisibility({contentVisibilityAuto:true})).length:null;
                  const previewOffscreen=preview.isKnownOffscreen?cards.filter(node=>preview.isKnownOffscreen(node)).length:null;
                  let rectReads=0;
                  const rect=Element.prototype.getBoundingClientRect;
                  Element.prototype.getBoundingClientRect=function(){if(this.tagName==='ARTICLE')rectReads++;return rect.call(this);};
                  const start=performance.now();
                  try{shell.render('home',{...payload});}finally{Element.prototype.getBoundingClientRect=rect;}
                  return {ms:performance.now()-start,rectReads,skipped,previewOffscreen,cardCount:document.querySelectorAll('.bt-video-card').length,
                    cardRetained:first===document.querySelector('.bt-video-card'),imageRetained:image===first.querySelector('img')};
                }"""))
                page.wait_for_timeout(80)
            assert all(sample['cardCount'] == 500 and sample['cardRetained'] and sample['imageRetained'] for sample in samples), samples
            report['positions'][position] = {'medianMs': statistics.median(sample['ms'] for sample in samples),
                'medianRectReads': statistics.median(sample['rectReads'] for sample in samples), 'samples': samples}
        page.evaluate('()=>scrollTo(0,0)')
        page.wait_for_timeout(250)
        report['reorder'] = page.evaluate(r"""() => {
          const before=[...document.querySelectorAll('.bt-video-card')];
          const image=before[0].querySelector('img');
          const reordered=[cards[1],cards[0],...cards.slice(2)];
          const animated=[],animate=Element.prototype.animate;
          Element.prototype.animate=function(...args){const animation=animate.apply(this,args);animated.push({node:this,animation});return animation;};
          try{shell.render('home',{...payload,videos:reordered});}finally{Element.prototype.animate=animate;}
          const after=[...document.querySelectorAll('.bt-video-card')];
          window.reorderAnimations=animated;
          return {swapped:after[0]===before[1]&&after[1]===before[0],
            imageRetained:before[0].querySelector('img')===image,
            animatedBoth:animated.some(entry=>entry.node===before[0])&&animated.some(entry=>entry.node===before[1])};
        }""")
        assert all(report['reorder'].values()), report['reorder']
        page.wait_for_timeout(700)
        report['reorder']['animationsFinished'] = page.evaluate("()=>reorderAnimations.every(entry=>entry.animation.playState==='finished')")
        assert report['reorder']['animationsFinished'], report['reorder']
        report['withoutPreview'] = page.evaluate(r"""() => {
          preview.destroy();
          const cards=[...document.querySelectorAll('#bilitube-outlet article')].filter(node=>node.__btCardKey);
          return {allEligible:!preview.isKnownOffscreen||cards.every(node=>!preview.isKnownOffscreen(node)),
            frameAvailable:Boolean(motion.measure(document.querySelector('#bilitube-outlet')))};
        }""")
        assert all(report['withoutPreview'].values()), report['withoutPreview']
        assert not errors, errors
        page.evaluate('()=>{shell.destroy();motion.destroy();preview.destroy()}')
        context.close()
        browser.close()
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
