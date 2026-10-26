"""Exercise refresh/retry and inspect responsive feed layouts with fixture data."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright
from feature_parity_smoke import MOCK

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output' / 'playwright' / 'refresh-experience'

FIXTURE = r"""
window.__holdKind='';window.__heldReads=[];window.__version=0;window.__failReads=false;window.__empty=false;
window.__suggestionReply=null;window.__refreshRequests=[];
const titles=['带着相机去山里，记录秋天的一天','给桌面留一点空白：我的工作空间','花了三个月，终于做出了这段动画','城市散步计划｜找一家街角咖啡馆','从零开始理解光线与色彩','如果周末只有一天，你会去哪里？','一个人的厨房，也要认真吃饭','那些让人忍不住循环的现场','在家就能完成的摄影练习','走进博物馆，看看时间留下的痕迹','关于一台老相机的故事','慢下来，听听生活的声音'];
const names=['山野记录','桌面研究所','帧间漫游','周末去哪里','光线笔记','一路向南'];
const videos=page=>Array.from({length:12},(_,i)=>({
 bvid:`BVfixture${(page-1)*12+i}`,aid:(page-1)*12+i+1,title:`${window.__version?'新内容 · ':''}${titles[i]}`,
 pic:`https://fixture.invalid/cover/${i}.svg`,duration:'08:32',mid:123,author:names[i%6],play:23500+i*831,
 description:'记录、创作与发现。用自己的方式，留下一些值得分享的瞬间。',
 owner:{mid:123,name:names[i%6],face:`https://fixture.invalid/avatar/${i}.svg`}
}));
const baseSend=chrome.runtime.sendMessage;
chrome.runtime.sendMessage=(message,done)=>{
 const {type,params={}}=message;
 if(type==='search-suggest'){window.__suggestionReply=()=>done({ok:true,data:{code:0,data:{result:{tag:[{value:'相机摄影'},{value:'相机入门'}]}}}});return;}
 const handled=['home','home-sections','search','watchlater','favorites','space-archives','dynamic'];
 if(!handled.includes(type))return baseSend(message,done);
 window.__refreshRequests.push({type,params});
 let data={code:0,data:{}};const list=window.__empty?[]:videos(params.page||1);
 if(type==='home')data={code:0,data:{item:list.map(item=>({...item,duration:512,stat:{view:item.play},pubdate:Math.floor(Date.now()/1000)-3600}))}};
 if(type==='search')data={code:0,data:{numPages:4,result:list}};
 if(type==='home-sections')data={popular:{code:0,data:{list:videos(1)}}};
 if(type==='watchlater')data={code:0,data:{list:list.slice(0,5).map(item=>({...item,duration:512}))}};
 if(type==='favorites')data={mediaId:'42',page:params.page||1,hasMore:true,folders:{code:0,data:{list:[{id:42,title:'值得反复观看',media_count:58,cover:'https://fixture.invalid/cover/2.svg'},{id:43,title:'周末慢慢看',media_count:12}]}},resources:{code:0,data:{medias:list.map(item=>({...item,cover:item.pic,upper:{mid:123,name:item.author,face:item.owner.face},cnt_info:{play:item.play},duration:512}))}}};
 if(type==='space-archives')data={code:0,data:{page:{count:48},list:{vlist:list}}};
 if(type==='dynamic')data={code:0,data:{has_more:false,items:[{id_str:'123456789',modules:{module_author:{mid:123,name:'山野记录',pub_time:'今天 10:24'},module_dynamic:{desc:{text:'走了一整天，终于在日落之前到达山顶。把今天的风景分享给你。'},major:{draw:{items:[{src:'https://fixture.invalid/cover/0.svg'},{src:'https://fixture.invalid/cover/5.svg'}]}}}}}]}};
 if(window.__failReads)data={code:-500};
 const reply=()=>done({ok:true,data});
 if(window.__holdKind==='all'||window.__holdKind==='append'&&params.append||window.__holdKind==='refresh'&&params.forceFresh)window.__heldReads.push({type,params,reply});
 else setTimeout(reply,35);
};
"""


def artwork(url: str) -> str:
    index = int(Path(urlparse(url).path).stem or '0')
    palettes = [('#b9c6bb','#667b70','#344c45'),('#e1d8c6','#a29680','#625746'),('#c5cce2','#858fb5','#4a517a'),('#e8c7b2','#bf8b6e','#815946'),('#c7d6d8','#7c9da5','#3e6977'),('#d4cfc3','#959c86','#5f6e53')]
    bg, mid, fg = palettes[index % len(palettes)]
    if '/avatar/' in url:
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="{bg}"/><circle cx="40" cy="32" r="14" fill="{fg}"/><ellipse cx="40" cy="77" rx="28" ry="25" fill="{fg}"/></svg>'
    motifs = [
        f'<circle cx="490" cy="90" r="45" fill="#f5ead2"/><path d="M0 270 150 95 340 310 450 140 640 310V360H0" fill="{mid}"/><path d="M0 360 230 200 420 360 550 240 640 320V360" fill="{fg}"/>',
        f'<rect x="160" y="50" width="310" height="195" rx="10" fill="{fg}"/><rect x="174" y="64" width="282" height="165" rx="3" fill="{mid}"/><rect x="303" y="240" width="24" height="40" fill="{fg}"/><rect x="245" y="276" width="140" height="8" rx="4" fill="{fg}"/><path d="M0 290H640V360H0" fill="{mid}"/>',
        f'<circle cx="320" cy="175" r="112" fill="{mid}"/><rect x="248" y="106" width="144" height="144" rx="26" transform="rotate(20 320 175)" fill="{fg}"/><path d="m300 142 60 34-60 35Z" fill="{bg}"/>',
        f'<path d="M150 140h210v120a60 60 0 0 1-60 60h-90a60 60 0 0 1-60-60Z" fill="{fg}"/><circle cx="380" cy="207" r="55" fill="none" stroke="{fg}" stroke-width="20"/><path d="M220 90q-25-30 0-60M285 90q-25-30 0-60" fill="none" stroke="{mid}" stroke-width="10"/><ellipse cx="260" cy="325" rx="155" ry="12" fill="{mid}"/>',
        f'<rect x="156" y="112" width="328" height="192" rx="24" fill="{fg}"/><path d="M210 112v-30h110v30" fill="{fg}"/><circle cx="328" cy="204" r="75" fill="{mid}"/><circle cx="328" cy="204" r="51" fill="{bg}"/><circle cx="443" cy="143" r="10" fill="{bg}"/>',
        f'<circle cx="310" cy="140" r="65" fill="#efe0be"/><path d="M0 210Q180 100 320 230T640 210V360H0" fill="{mid}"/><path d="M0 300Q220 190 420 305T640 260V360H0" fill="{fg}"/>',
    ]
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><rect width="640" height="360" fill="{bg}"/>{motifs[index%6]}</svg>'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser',default=os.environ.get('BROWSER_EXECUTABLE',r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'))
    args=parser.parse_args()
    OUTPUT.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
    content=next(entry for entry in manifest['content_scripts'] if 'src/core/app.js' in entry.get('js',[]))
    sources='\n;\n'.join((ROOT/name).read_text(encoding='utf-8') for name in content['js'])
    css='\n'.join((ROOT/name).read_text(encoding='utf-8') for name in content['css'])
    mock=MOCK.replace("glassMode:false,motionMode:'reduced'","glassMode:true,motionMode:'reduced',theme:'light'")+FIXTURE
    errors=[]
    report={'kind':'isolated Edge fixture; no live account or production API acceptance','checks':[]}
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=args.browser,headless=True)
        context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
        def respond(route):
            if route.request.resource_type=='image':route.fulfill(content_type='image/svg+xml',body=artwork(route.request.url))
            else:route.fulfill(content_type='text/html',body=f'<!doctype html><html><head><meta charset="utf-8"><style>body{{margin:0}}{css}</style></head><body><div id="native-business"></div></body></html>')
        context.route('**/*',respond)
        context.add_init_script(mock+'\naddEventListener("DOMContentLoaded",()=>{\n'+sources+'\n},{once:true});')
        page=context.new_page()
        page.on('pageerror',lambda error:errors.append(str(error)))
        def go(url):
            page.goto(url,wait_until='networkidle')
            expect(page.locator('.bt-refresh-button')).to_be_visible()
        def check(label):
            assert not errors, errors
            report['checks'].append(label)
        def screenshot(name):
            page.screenshot(path=str(OUTPUT/f'{name}.png'))

        go('https://search.bilibili.com/video?keyword=相机&order=pubdate&duration=2')
        expect(page.locator('.bt-search-row')).to_have_count(12)
        screenshot('search-light')
        page.locator('.bt-search-input').fill('尚未提交的搜索')
        page.evaluate("window.__first=document.querySelector('.bt-search-row');window.__media=__first.querySelector('img');window.__holdKind='append'")
        page.locator('[data-bt-feed]').scroll_into_view_if_needed()
        page.wait_for_function('__heldReads.some(item=>item.params.append)')
        page.evaluate("window.scrollTo(0,0);window.__version=1;window.__holdKind='refresh'")
        page.locator('.bt-refresh-button').click()
        expect(page.locator('.bt-refresh-button')).to_be_disabled()
        expect(page.locator('.bt-search-row')).to_have_count(12)
        assert page.evaluate('__first===document.querySelector(".bt-search-row")&&__media.isConnected')
        page.evaluate("__heldReads.filter(item=>item.params.append).forEach(item=>item.reply())")
        expect(page.locator('.bt-search-row')).to_have_count(12)
        page.evaluate("window.__holdKind='';__heldReads.filter(item=>item.params.forceFresh).forEach(item=>item.reply());__heldReads=[]")
        expect(page.locator('.bt-refresh-status')).to_have_text('内容已更新')
        expect(page.locator('.bt-search-title').first).to_contain_text('新内容')
        expect(page.locator('.bt-search-input')).to_have_value('尚未提交的搜索')
        assert page.evaluate('__media===document.querySelector(".bt-search-row img")&&__media.isConnected')
        check('Refresh retains cards, image nodes and search draft; stale append cannot overwrite fresh content')

        page.evaluate('window.__failReads=true')
        page.locator('[data-bt-feed]').scroll_into_view_if_needed()
        expect(page.locator('.bt-retry-button')).to_be_visible()
        count=page.evaluate('__refreshRequests.filter(item=>item.type==="search").length')
        page.wait_for_timeout(400)
        assert page.evaluate('__refreshRequests.filter(item=>item.type==="search").length')==count
        expect(page.locator('.bt-search-row')).to_have_count(12)
        screenshot('pagination-error')
        page.evaluate('window.__failReads=false')
        page.locator('.bt-retry-button').click()
        expect(page.locator('.bt-search-row')).to_have_count(24)
        check('Pagination failure has an explicit retry; retries page two once and preserves earlier content')

        page.evaluate('window.scrollTo(0,0)')
        field=page.locator('.bt-search-input')
        field.fill('相机');page.wait_for_function('__suggestionReply!==null');field.press('Escape')
        page.evaluate('__suggestionReply()')
        expect(page.locator('.bt-search-suggestions')).to_be_hidden()
        field.fill('摄影');page.wait_for_timeout(220);page.evaluate('__suggestionReply()')
        expect(page.locator('.bt-search-suggestions')).to_be_visible()
        field.press('ArrowDown')
        expect(field).to_have_attribute('aria-activedescendant','bt-search-suggestions-0')
        field.dispatch_event('compositionstart');field.dispatch_event('keydown',{'key':'Enter','isComposing':True})
        assert 'keyword=' in page.url
        check('Search suggestions stay closed after Escape and expose keyboard selection; IME confirmation remains in the field')

        go('https://www.bilibili.com/list/watchlater')
        expect(page.locator('.bt-library-row')).to_have_count(5)
        screenshot('watchlater-light')
        page.evaluate('window.__failReads=true');page.locator('.bt-refresh-button').click()
        expect(page.locator('.bt-refresh-status')).to_contain_text('未更新')
        expect(page.locator('.bt-library-row')).to_have_count(5)
        page.evaluate('window.__failReads=false;window.__empty=true');page.locator('.bt-refresh-button').click()
        expect(page.locator('.bt-library-row')).to_have_count(0)
        expect(page.locator('.bt-empty')).to_contain_text('稍后再看列表为空')
        expect(page.get_by_role('link',name='去首页发现视频')).to_have_attribute('href','https://www.bilibili.com/')
        expect(page.get_by_role('link',name='播放全部')).to_have_count(0)
        screenshot('watchlater-empty')
        check('Failed Watch Later refresh preserves its list; successful empty response clears it')

        go('https://www.bilibili.com/')
        expect(page.locator('.bt-home-shelf')).to_have_count(1)
        screenshot('home-light')
        # Reconciliation used to leave arrow handlers pointing at a detached row.
        page.locator('.bt-refresh-button').click();expect(page.locator('.bt-refresh-status')).to_have_text('内容已更新')
        shelf=page.locator('.bt-home-shelf');shelf.scroll_into_view_if_needed()
        shelf.get_by_role('button',name='下一组视频').click()
        page.wait_for_function("document.querySelector('.bt-home-shelf-row').scrollLeft>100")
        check('Shelf navigation scrolls the connected row after a refresh')
        page.evaluate('window.scrollTo(0,0)');page.locator('.bt-theme-button').click()
        expect(page.locator('html')).to_have_attribute('data-bt-theme','dark');screenshot('home-dark')

        go('https://space.bilibili.com/123/favlist?fid=42');expect(page.locator('.bt-favorite-folder')).to_have_count(2);screenshot('favorites-light')
        go('https://t.bilibili.com/');expect(page.locator('.bt-dynamic-card')).to_have_count(1);screenshot('dynamic-light')
        check('Home, search, favorites, dynamic and Watch Later render with shared visual hierarchy')

        go('https://www.bilibili.com/')
        page.evaluate("const start=Date.now();Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Date.now=()=>start+61000;Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))")
        expect(page.locator('.bt-refresh-status')).to_have_text('页面可能有更新')
        check('Returning after a minute offers a refresh without replacing the current content')
        page.set_viewport_size({'width':390,'height':844})
        screenshot('home-narrow')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        page.get_by_role('button',name='切换侧栏').click()
        expect(page.locator('.bt-sidebar-drawer-backdrop')).to_have_attribute('aria-hidden','false')
        expect(page.locator('.bt-sidebar.is-drawer')).to_be_visible()
        expect(page.locator('.bt-sidebar.is-drawer .bt-nav-label').first).to_be_visible()
        screenshot('navigation-narrow')
        page.keyboard.press('Escape')
        expect(page.locator('.bt-sidebar-drawer-backdrop')).to_have_attribute('aria-hidden','true')
        expect(page.get_by_role('button',name='切换侧栏')).to_be_focused()
        check('390px layout has no horizontal overflow; navigation drawer opens, closes with Escape and restores focus')
        report['page_errors']=errors;report['browser']=browser.version
        browser.close()
    (OUTPUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=='__main__':main()
