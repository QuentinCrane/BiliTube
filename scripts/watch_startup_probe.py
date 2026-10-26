"""Compare public native/decorated Watch startup; record media events without URL query tokens."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import tempfile

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'output'/'watch-startup'
PROBE=r"""
(() => {
  const ids=new WeakMap();let next=0;
  const id=video=>{if(!ids.has(video))ids.set(video,++next);return ids.get(video)};
  const path=value=>{try{const url=new URL(value,location.href);return url.protocol==='blob:'?'blob':url.origin+url.pathname}catch{return ''}};
  window.__watchProbe={events:[],sizes:[],sources:[],lifecycle:[],geometry:[],layoutShifts:[]};
  const log=(list,item)=>{if(list.length<200)list.push({at:Math.round(performance.now()),...item})};
  const stack=()=>String(new Error().stack||'').split('\n').slice(2,7).map(line=>line.replace(/\?[^\s)]*/g,''));
  for(const event of ['DOMContentLoaded','load'])addEventListener(event,()=>log(window.__watchProbe.lifecycle,{event}),{once:true});
  for(const type of ['loadstart','emptied','loadedmetadata','loadeddata','canplay','play','playing','pause','waiting','stalled','error']){
    document.addEventListener(type,event=>{const v=event.target;if(v.tagName==='VIDEO')log(window.__watchProbe.events,{type,id:id(v),preview:v.classList.contains('bt-preview-video'),time:Math.round(v.currentTime*100)/100,source:path(v.currentSrc||v.src),ready:v.readyState})},true);
  }
  const load=HTMLMediaElement.prototype.load;
  HTMLMediaElement.prototype.load=function(){log(window.__watchProbe.sources,{method:'load',id:id(this),stack:stack()});return load.apply(this,arguments)};
  const descriptor=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');
  Object.defineProperty(HTMLMediaElement.prototype,'src',{...descriptor,set(value){log(window.__watchProbe.sources,{method:'src',id:id(this),source:path(value),stack:stack()});return descriptor.set.call(this,value)}});
  const seen=new WeakSet();
  const resize=new ResizeObserver(entries=>{for(const entry of entries){const r=entry.target.getBoundingClientRect();log(window.__watchProbe.sizes,{width:Math.round(r.width),height:Math.round(r.height),class:String(entry.target.className),preflight:document.documentElement.classList.contains('bilitube-watch-preflight'),ready:document.documentElement.classList.contains('bt-watch-ready')})}});
  function scan(){const host=document.querySelector('#playerWrap,#bilibili-player-wrap');if(host&&!seen.has(host)){seen.add(host);resize.observe(host)}}
  const observer=new MutationObserver(scan);observer.observe(document,{childList:true,subtree:true});addEventListener('DOMContentLoaded',scan,{once:true});
  const regions={player:'#playerWrap,#bilibili-player-wrap',title:'.video-info-container,#viewbox_report',author:'.bt-watch-author-row',toolbar:'#arc_toolbar_report,.video-toolbar-container',aside:'.right-container',related:'.recommend-list-v1,.recommend-list',nativeAuthor:'.up-panel-container,.up-info-container'};
  let previous='';
  function frame(){
    const rects={};
    for(const [name,selector] of Object.entries(regions)){
      const node=document.querySelector(selector);if(!node)continue;
      const r=node.getBoundingClientRect(),style=getComputedStyle(node);
      rects[name]={x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height),visible:style.visibility!=='hidden'&&style.display!=='none'};
    }
    const signature=JSON.stringify(rects);if(signature!==previous){previous=signature;log(window.__watchProbe.geometry,{rects,preflight:document.documentElement.classList.contains('bilitube-watch-preflight'),ready:document.documentElement.classList.contains('bt-watch-ready')});}
    if(performance.now()<15000)requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  try{new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)log(window.__watchProbe.layoutShifts,{value:entry.value,sources:(entry.sources||[]).map(source=>({node:source.node?.id||String(source.node?.className||''),before:source.previousRect.toJSON(),after:source.currentRect.toJSON()}))})}).observe({type:'layout-shift',buffered:true});}catch{}
})();
"""


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='https://www.bilibili.com/video/BV1GJ411x7h7')
    parser.add_argument('--browser',default=os.environ.get('BROWSER_EXECUTABLE',r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'))
    parser.add_argument('--seconds',type=int,default=10)
    parser.add_argument('--extension-dir',default=str(ROOT))
    parser.add_argument('--decorated-only',action='store_true')
    parser.add_argument('--output',default=str(OUTPUT))
    args=parser.parse_args();args.extension_dir=str(Path(args.extension_dir).resolve());output=Path(args.output);output.mkdir(parents=True,exist_ok=True);results=[]
    with sync_playwright() as p:
        with tempfile.TemporaryDirectory(prefix='watch-probe-',dir=str(ROOT/'output')) as profile:
            assert Path(profile).resolve().is_relative_to(ROOT/'output')
            context=p.chromium.launch_persistent_context(profile,executable_path=args.browser,headless=True,ignore_default_args=['--disable-extensions','--disable-component-extensions-with-background-pages'],args=[f'--disable-extensions-except={args.extension_dir}',f'--load-extension={args.extension_dir}','--no-first-run'],viewport={'width':1440,'height':900})
            try:
                context.add_init_script(PROBE)
                for native in ([False] if args.decorated_only else [True,False]):
                    page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
                    url=args.url+('?' if '?' not in args.url else '&')+'bilitube_native=1' if native else args.url
                    page.goto(url,wait_until='domcontentloaded',timeout=25000);page.wait_for_timeout(args.seconds*1000)
                    result=page.evaluate("() => ({...window.__watchProbe,title:document.title,href:location.pathname,authorRows:document.querySelectorAll('.bt-watch-author-row').length,framework:[...document.querySelectorAll('#app,.video-container-v1,.left-container')].map(n=>({class:n.className,keys:Object.keys(n).filter(k=>/vue|react/i.test(k)),vueMounted:n.__vue__?._isMounted,vue3Mounted:n.__vueParentComponent?.isMounted})),watch:!!document.querySelector('#bilitube-watch-layer'),videos:[...document.querySelectorAll('video')].map(v=>({time:v.currentTime,ready:v.readyState,paused:v.paused,preview:v.classList.contains('bt-preview-video')}))})")
                    result.update({'native':native,'errors':errors,'browser':context.browser.version if context.browser else 'Edge'});results.append(result)
                    page.screenshot(path=str(output/('native.png' if native else 'decorated.png')));page.close()
            finally:context.close()
    (output/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps([{'native':r['native'],'errors':r['errors'],'sizes':r['sizes'],'geometry':r['geometry'],'layoutShiftScore':sum(s['value'] for s in r['layoutShifts'])} for r in results],ensure_ascii=True,indent=2))


if __name__=='__main__':main()
