"""Measure first feed rendering with a deliberately slow deferred page script.

This isolated fixture mocks extension messages and network responses; it is
not a measurement of Bilibili's live servers or a signed-in browser session.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import statistics
import time

from playwright.sync_api import sync_playwright
from feature_parity_smoke import MOCK

ROOT = Path(__file__).resolve().parents[1]
PROBE = r"""
window.__startupProbe={requests:[]};
const sendOriginal=chrome.runtime.sendMessage;
const category=new URL(location.href).searchParams.get('bilitube_category')||'all';
const requestType=category==='all'?'home':['live','anime'].includes(category)?'home-sections':'home-category';
chrome.runtime.sendMessage=(message,reply)=>{
  if(message.type!==requestType)return sendOriginal(message,reply);
  window.__startupProbe.requests.push(Math.round(performance.now()));
  const items=Array.from({length:12},(_,i)=>({bvid:`BVfixture${i}`,title:`Fixture ${i}`,duration:120,owner:{mid:1,name:'Fixture'}}));
  const data=category==='all'?{code:0,data:{item:items}}
    :category==='live'?{live:{code:0,data:{recommend_room_list:items.map((item,i)=>({roomid:i+1,title:item.title,uname:'Fixture'}))}}}
    :category==='anime'?{bangumi:{code:0,result:[{episodes:items.map((item,i)=>({episode_id:i+1,title:item.title}))}]}}
    :{code:0,data:{list:items}};
  setTimeout(()=>reply({ok:true,data}),350);
};
document.addEventListener('DOMContentLoaded',()=>{window.__startupProbe.domContentLoaded=Math.round(performance.now())},{once:true});
const startupObserver=new MutationObserver(()=>{
  if(!window.__startupProbe.shell&&document.querySelector('#bilitube-root'))window.__startupProbe.shell=Math.round(performance.now());
  if(document.querySelector('.bt-video-card:not(.bt-skeleton-card)')){
    window.__startupProbe.firstCard=Math.round(performance.now());startupObserver.disconnect();
  }
});
startupObserver.observe(document,{childList:true,subtree:true});
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', default=os.environ.get('BROWSER_EXECUTABLE', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'))
    parser.add_argument('--source-dir', default=str(ROOT))
    parser.add_argument('--runs', type=int, default=3)
    parser.add_argument('--category', choices=['all','tech','live','anime'], default='all')
    parser.add_argument('--output', default=str(ROOT / 'output' / 'startup-performance' / 'report.json'))
    args = parser.parse_args()
    source_root = Path(args.source_dir).resolve()
    manifest = json.loads((source_root / 'manifest.json').read_text(encoding='utf-8'))
    entry = next(item for item in manifest['content_scripts'] if 'src/core/app.js' in item.get('js', []))
    sources = '\n;\n'.join((source_root / name).read_text(encoding='utf-8') for name in entry['js'])
    css = '\n'.join((source_root / name).read_text(encoding='utf-8') for name in entry['css'])
    document = f'<!doctype html><html><head><meta charset="utf-8"><style>{css}</style><script>{MOCK}\n{PROBE}\n{sources}</script><script defer src="/slow.js"></script></head><body><div id="native-business"></div></body></html>'
    samples = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.browser, headless=True)
        for _ in range(args.runs):
            context = browser.new_context(viewport={'width':1440,'height':900}, reduced_motion='reduce')
            def respond(route):
                if route.request.url.endswith('/slow.js'):
                    time.sleep(1.2)
                    route.fulfill(content_type='application/javascript', body='')
                else:
                    route.fulfill(content_type='text/html', body=document)
            context.route('**/*', respond)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            url='https://www.bilibili.com/' + (f'?bilitube_category={args.category}' if args.category!='all' else '')
            page.goto(url, wait_until='domcontentloaded')
            page.wait_for_function('window.__startupProbe && window.__startupProbe.firstCard', timeout=5000)
            sample = page.evaluate('window.__startupProbe')
            assert len(sample['requests']) == 1, sample
            assert not errors, errors
            samples.append(sample)
            context.close()
        browser.close()
    report = {'kind':'isolated headless browser; 1200 ms deferred script and 350 ms mock API response', 'category':args.category,
              'runs':args.runs,'samples':samples,
              'medianMs':{key:statistics.median(sample[key] for sample in samples) for key in ('domContentLoaded','shell','firstCard')}}
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
