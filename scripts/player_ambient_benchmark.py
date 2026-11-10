"""Compare player-margin rendering using the same decoded local video.

Requires Edge, Python Playwright and FFmpeg. Use --baseline-dir with a source
snapshot to compare two implementations; results are hardware-dependent.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright
try:
    import psutil
except ImportError:
    psutil = None

ROOT = Path(__file__).resolve().parents[1]
HTML = """<!doctype html><html><head><style>
html,body{margin:0;background:#000}.bpx-player-video-area,.bpx-player-video-perch,.bpx-player-video-wrap{width:100vw;height:100vh}
.bpx-player-video-area{position:relative;overflow:hidden}.bpx-player-video-perch{position:relative}
.bpx-player-video-wrap video{display:block;width:100%;height:100%;object-fit:contain}
</style></head><body><div id="playerWrap"><div class="bpx-player-video-area"><div class="bpx-player-video-perch">
<div class="bpx-player-video-wrap"><video muted playsinline loop></video></div></div></div></div></body></html>"""
INSTRUMENT = r"""() => {
  const original=CanvasRenderingContext2D.prototype.drawImage;
  window.__ambientSamples=[];window.__lastAmbientDraw=null;
  CanvasRenderingContext2D.prototype.drawImage=function(...args){
    if(!this.canvas.classList.contains('bt-player-ambient'))return original.apply(this,args);
    const start=performance.now(),result=original.apply(this,args),end=performance.now();
    window.__lastAmbientDraw=end;
    window.__ambientSamples.push({at:end,cost:end-start,pixels:this.canvas.width*this.canvas.height});
    return result;
  };
  window.__measure=async (ms)=>{
    const video=document.querySelector('video'),start=performance.now(),quality=video.getVideoPlaybackQuality();
    const beginFrames=quality.totalVideoFrames,beginDropped=quality.droppedVideoFrames,ages=[],rafIntervals=[];
    let stopped=false,lastRaf=0;
    function onFrame(now){
      if(stopped)return;
      if(window.__lastAmbientDraw!=null)ages.push(Math.max(0,now-window.__lastAmbientDraw));
      video.requestVideoFrameCallback(onFrame);
    }
    function onRaf(now){if(stopped)return;if(lastRaf)rafIntervals.push(now-lastRaf);lastRaf=now;requestAnimationFrame(onRaf);}
    video.requestVideoFrameCallback(onFrame);requestAnimationFrame(onRaf);
    await new Promise(resolve=>setTimeout(resolve,ms));stopped=true;
    const end=performance.now(),q=video.getVideoPlaybackQuality();
    const draws=window.__ambientSamples.filter(sample=>sample.at>=start&&sample.at<=end);
    const percentile=(items,p)=>{if(!items.length)return null;const sorted=[...items].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]};
    return {seconds:(end-start)/1000,videoFrames:q.totalVideoFrames-beginFrames,droppedFrames:q.droppedVideoFrames-beginDropped,
      draws:draws.length,canvasPixelsPerDraw:draws[0]?.pixels||0,drawCostMs:draws.reduce((sum,item)=>sum+item.cost,0),
      drawP95Ms:percentile(draws.map(item=>item.cost),.95),videoCallbackSamples:ages.length,
      ageAtVideoCallbackMedianMs:percentile(ages,.5),ageAtVideoCallbackP95Ms:percentile(ages,.95),
      animationFrames:rafIntervals.length,animationIntervalP95Ms:percentile(rafIntervals,.95)};
  };
}"""


def browser_cpu_times(executable):
    """CPU time of browser processes in this benchmark, excluding the driver."""
    if psutil is None:
        return None
    result = {}
    for process in psutil.Process().children(recursive=True):
        try:
            if process.name().lower() != Path(executable).name.lower():
                continue
            times = process.cpu_times()
            result[process.pid] = times.user + times.system
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', default=os.environ.get('BROWSER_EXECUTABLE', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'))
    parser.add_argument('--source-dir', type=Path, default=ROOT)
    parser.add_argument('--baseline-dir', type=Path)
    parser.add_argument('--seconds', type=float, default=4)
    parser.add_argument('--runs', type=int, default=2)
    parser.add_argument('--fps', type=int, choices=[30, 60], default=30)
    parser.add_argument('--output', type=Path, default=ROOT / 'output' / 'player-ambient' / 'benchmark.json')
    args = parser.parse_args()
    if args.seconds <= 0 or args.runs < 1:
        parser.error('--seconds and --runs must be positive')
    sources = [('baseline', args.baseline_dir)] if args.baseline_dir else []
    sources.append(('current', args.source_dir))
    results = {label: [] for label, _ in sources}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='bilitube-ambient-benchmark-') as temporary:
        clip = Path(temporary) / 'portrait.mp4'
        duration = max(8, int(args.seconds + 4))
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
                        f'testsrc2=size=720x1280:rate={args.fps}:duration={duration}', '-c:v', 'libx264',
                        '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(clip)], check=True)
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=args.browser, headless=True, args=['--autoplay-policy=no-user-gesture-required'])
            for run in range(args.runs):
                for label, directory in sources:
                    context = browser.new_context(viewport={'width': 1920, 'height': 1080})
                    def route_request(route):
                        if route.request.url.endswith('/fixture.mp4'):
                            route.fulfill(path=str(clip), content_type='video/mp4')
                        else:
                            route.fulfill(body=HTML, content_type='text/html')
                    context.route('**/*', route_request)
                    page = context.new_page()
                    page.goto('https://www.bilibili.com/video/BVfixture', wait_until='load')
                    page.add_style_tag(content=(directory / 'src/styles/core.css').read_text(encoding='utf-8'))
                    page.add_script_tag(content=(directory / 'src/core/player-ambient.js').read_text(encoding='utf-8'))
                    page.evaluate(INSTRUMENT)
                    page.evaluate("""async()=>{
                      const video=document.querySelector('video');video.src='/fixture.mp4';await video.play();
                      window.__controller=BiliTubePlayerAmbient.createController(document);
                      __controller.mount(document.querySelector('#playerWrap'),true);
                    }""")
                    page.wait_for_selector('.bt-player-ambient-active canvas', timeout=10000)
                    page.wait_for_timeout(500)
                    cdp = context.new_cdp_session(page)
                    cdp.send('Performance.enable')
                    before = {item['name']: item['value'] for item in cdp.send('Performance.getMetrics')['metrics']}
                    cpu_before = browser_cpu_times(args.browser)
                    result = page.evaluate('ms=>__measure(ms)', args.seconds * 1000)
                    cpu_after = browser_cpu_times(args.browser)
                    after = {item['name']: item['value'] for item in cdp.send('Performance.getMetrics')['metrics']}
                    result['rendererTaskMs'] = (after['TaskDuration'] - before['TaskDuration']) * 1000
                    if cpu_before is not None and cpu_after is not None:
                        result['browserCpuMs'] = sum(max(0, total - cpu_before.get(pid, total)) for pid, total in cpu_after.items()) * 1000
                    if run == 0:
                        page.screenshot(path=str(args.output.parent / f'benchmark-{label}.png'))
                    results[label].append(result)
                    print(json.dumps({'run': run + 1, 'implementation': label, **result}), flush=True)
                    context.close()
            report = {'browser': browser.version, 'viewport': '1920x1080', 'source': f'local 720x1280, {args.fps} fps H.264 video',
                      'cpu_note': 'Browser process CPU time, not GPU engine utilization', 'runs': results}
            browser.close()
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
