"""Probe actual related-video clicks with the unpacked extension in temporary Edge."""
from __future__ import annotations
import argparse,json,os,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
SNAPSHOT=r"""() => {
 const rect=node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return {id:node.id,class:node.className,x:r.x,y:r.y,width:r.width,height:r.height,order:s.order,display:s.display,position:s.position,visibility:s.visibility}};
 const host=document.querySelector('#playerWrap,#bilibili-player-wrap'),info=document.querySelector('.video-info-container,#viewbox_report');
 const videos=[...(host||document).querySelectorAll('video')];
 return {path:location.pathname,title:document.title,root:document.documentElement.className,timeOrigin:performance.timeOrigin,
   playerAboveTitle:!!(host&&info&&host.getBoundingClientRect().height>100&&host.getBoundingClientRect().bottom<=info.getBoundingClientRect().top+1),
   children:[...document.querySelectorAll('.left-container>*')].map(rect),
   players:[...document.querySelectorAll('#playerWrap,#bilibili-player-wrap,#bilibili-player,.bpx-player-container')].map(rect),
   videos:videos.map(v=>({time:v.currentTime,ready:v.readyState,paused:v.paused,connected:v.isConnected})),
   events:window.__playerMutations||[],
   related:[...document.querySelectorAll('.right-container a[href*="/video/"]')].filter(a=>a.getBoundingClientRect().width>0).map(a=>({href:a.href,text:(a.textContent||'').trim().slice(0,100)})).filter((a,i,all)=>all.findIndex(b=>b.href===a.href)===i).slice(0,8)};
}"""
MUTATIONS=r"""(()=>{window.__playerMutations=[];new MutationObserver(list=>{for(const m of list){const n=m.target;if(n.nodeType!==1)continue;if((n.id==='playerWrap'||n.id==='bilibili-player'||n.classList.contains('player-wrap'))&&__playerMutations.length<80)__playerMutations.push({at:Math.round(performance.now()),type:m.type,id:n.id,cls:n.className,attr:m.attributeName,old:m.oldValue,style:n.getAttribute('style'),children:n.childElementCount});}}).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style'],attributeOldValue:true});})()"""

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='https://www.bilibili.com/video/BV1cU4y1A7ud/')
    parser.add_argument('--clicks',type=int,default=3)
    parser.add_argument('--output',default=str(ROOT/'output'/'watch-navigation'))
    parser.add_argument('--browser',default=os.environ.get('BROWSER_EXECUTABLE',r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'))
    args=parser.parse_args();output=Path(args.output);output.mkdir(parents=True,exist_ok=True);steps=[]
    report={'kind':'actual unpacked extension, public related-video clicks, temporary logged-out profile','steps':steps}
    with sync_playwright() as p:
        with tempfile.TemporaryDirectory(prefix='watch-navigation-',dir=ROOT/'output') as profile:
            context=p.chromium.launch_persistent_context(profile,executable_path=args.browser,headless=True,ignore_default_args=['--disable-extensions','--disable-component-extensions-with-background-pages'],args=[f'--disable-extensions-except={ROOT}',f'--load-extension={ROOT}'],viewport={'width':1440,'height':900})
            try:
                report['browser']=context.browser.version
                context.add_init_script(MUTATIONS)
                page=context.new_page();page.goto(args.url,wait_until='domcontentloaded',timeout=25000)
                for step in range(args.clicks+1):
                    page.wait_for_timeout(5000)
                    result=page.evaluate(SNAPSHOT);result['step']=step;steps.append(result)
                    result['sameDocumentAsPrevious']=bool(step and result['timeOrigin']==steps[step-1]['timeOrigin'])
                    page.screenshot(path=str(output/f'step-{step}.png'))
                    (output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
                    print(json.dumps({'step':step,'path':result['path'],'playerAboveTitle':result['playerAboveTitle'],'sameDocumentAsPrevious':result['sameDocumentAsPrevious'],'videos':result['videos']},ensure_ascii=True),flush=True)
                    if step==args.clicks or not result['related']:break
                    href=next((r['href'] for r in result['related'] if not any(s['path'].strip('/') in r['href'] for s in steps)),None)
                    if not href:break
                    count=len(context.pages)
                    link=page.locator('.right-container a[href]').filter(visible=True)
                    candidates=link.all()
                    for candidate in candidates:
                        if candidate.evaluate('(n)=>n.href')==href:
                            candidate.click();break
                    page.wait_for_timeout(800)
                    if len(context.pages)>count:page=context.pages[-1]
                    page.mouse.move(10,10)
                    page.wait_for_function('previous=>location.pathname!==previous',arg=result['path'],timeout=15000)
                report['passed']=len(steps)==args.clicks+1 and all(s['playerAboveTitle'] for s in steps)
                (output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
                if not report['passed']:raise AssertionError('Missing navigation steps or player displaced; see report.json')
            finally:context.close()

if __name__=='__main__':main()
