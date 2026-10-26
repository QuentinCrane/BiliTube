"""Measure theme frame intervals and Paint work in a real extension session."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import statistics
import tempfile
import time

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'output'/'theme-performance'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='https://search.bilibili.com/video?keyword=音乐')
    parser.add_argument('--browser',default=os.environ.get('BROWSER_EXECUTABLE',r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'))
    parser.add_argument('--runs',type=int,default=3)
    parser.add_argument('--scale',type=float,default=2)
    args=parser.parse_args();OUTPUT.mkdir(parents=True,exist_ok=True);reports=[]
    with sync_playwright() as p:
        with tempfile.TemporaryDirectory(prefix='theme-performance-',dir=str(ROOT/'output')) as profile:
            assert Path(profile).resolve().is_relative_to(ROOT/'output')
            context=p.chromium.launch_persistent_context(profile,executable_path=args.browser,headless=True,ignore_default_args=['--disable-extensions','--disable-component-extensions-with-background-pages'],args=[f'--disable-extensions-except={ROOT}',f'--load-extension={ROOT}'],viewport={'width':1920,'height':1080},device_scale_factor=args.scale)
            try:
                page=context.new_page();page.goto(args.url,wait_until='domcontentloaded',timeout=25000)
                page.wait_for_selector('.bt-theme-button',timeout=15000);page.wait_for_timeout(2500)
                session=context.new_cdp_session(page);events=[]
                trace_status={'done':True}
                session.on('Tracing.dataCollected',lambda message:events.extend(message['value']))
                session.on('Tracing.tracingComplete',lambda _:trace_status.update(done=True))
                for index in range(max(1,min(5,args.runs))):
                    events.clear();trace_status['done']=False
                    session.send('Tracing.start',{'categories':'devtools.timeline,disabled-by-default-devtools.timeline.frame,blink.animations,blink.user_timing','transferMode':'ReportEvents'})
                    # Dispatch after tracing starts, without including Playwright's
                    # pointer/actionability wait in the measured Paint interval.
                    page.evaluate("() => {window.__themeFrames=[];window.__themeMeasure=true;function tick(t){if(document.documentElement.classList.contains('bt-theme-reveal'))window.__themeFrames.push(t);if(window.__themeMeasure)requestAnimationFrame(tick)}requestAnimationFrame(tick);performance.mark('bt-theme-probe-start');document.querySelector('.bt-theme-button').click()}")
                    page.wait_for_function("!document.documentElement.classList.contains('bt-theme-reveal')")
                    frames=page.evaluate("() => {window.__themeMeasure=false;performance.mark('bt-theme-probe-end');return window.__themeFrames}")
                    session.send('Tracing.end')
                    deadline=time.monotonic()+10
                    while not trace_status['done'] and time.monotonic()<deadline:
                        page.wait_for_timeout(50)
                    if not trace_status['done']:
                        raise RuntimeError('Chrome did not finish flushing the performance trace')
                    intervals=sorted(b-a for a,b in zip(frames,frames[1:]))
                    start=max(event['ts'] for event in events if event.get('name')=='bt-theme-probe-start')
                    end=max(event['ts'] for event in events if event.get('name')=='bt-theme-probe-end')
                    measured=[event for event in events if start<=event.get('ts',0)<=end]
                    reports.append({'run':index+1,'samples':len(intervals),'requestToFinishMs':(end-start)/1000,'medianFrameMs':statistics.median(intervals) if intervals else None,'p95FrameMs':intervals[int((len(intervals)-1)*.95)] if intervals else None,'maxFrameMs':max(intervals) if intervals else None,'framesOver33ms':sum(value>33.4 for value in intervals),'paintCount':sum(event.get('name')=='Paint' for event in measured),'paintMs':sum(event.get('dur',0) for event in measured if event.get('name')=='Paint')/1000})
                    (OUTPUT/f'run-{index+1}.trace.json').write_text(json.dumps({'traceEvents':events}),encoding='utf-8')
                result={'kind':'headless Edge RAF timing and Chrome Paint trace; not monitor refresh rate','browser':context.browser.version if context.browser else 'Edge','viewport':[1920,1080],'deviceScaleFactor':args.scale,'runs':reports}
                (OUTPUT/'report.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))
            finally:context.close()


if __name__=='__main__':main()
