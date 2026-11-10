"""Exercise folder-scoped favorites search in an isolated browser fixture."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from feature_parity_smoke import MOCK

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output' / 'playwright' / 'favorites-search'
FIXTURE = r"""(() => {
  window.IntersectionObserver=undefined;
  window.__favoriteRequests=[];window.__heldFavorites=[];
  const base=chrome.runtime.sendMessage;
  const folders=[{id:42,title:'我的收藏',media_count:5},{id:43,title:'其他收藏',media_count:1}];
  const records={
    42:[['BVall','全部视频'],['BVcam1','相机 第一页'],['BVcam2','相机 第二页'],['BVslow','慢镜头'],['BVfast','快门练习']],
    43:[['BVother','其他收藏的视频']]
  };
  chrome.runtime.sendMessage=(message,done)=>{
    if(message.type!=='favorites')return base(message,done);
    const params=message.params||{},folder=String(params.mediaId||'42'),keyword=String(params.keyword||''),page=Number(params.page||1);
    __favoriteRequests.push({folder,keyword,page,forceFresh:Boolean(params.forceFresh)});
    const matches=(records[folder]||[]).filter(([,title])=>title.includes(keyword));
    const item=matches[page-1];
    const medias=item?[{bvid:item[0],title:item[1],duration:60,upper:{mid:7,name:'作者'},cnt_info:{play:120}}]:[];
    const data={mediaId:folder,page,hasMore:page<matches.length,folders:{code:0,data:{list:folders}},resources:{code:0,data:{medias}}};
    const reply=()=>done({ok:true,data});
    if(keyword==='慢'||keyword==='相机'&&page===1) __heldFavorites.push({keyword,reply});
    else setTimeout(reply,25);
  };
})();"""


def main() -> None:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser',default=os.environ.get('BROWSER_EXECUTABLE',r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'))
    args=parser.parse_args()
    manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
    content=next(entry for entry in manifest['content_scripts'] if 'src/core/app.js' in entry.get('js',[]))
    sources='\n;\n'.join((ROOT/name).read_text(encoding='utf-8') for name in content['js'])
    css='\n'.join((ROOT/name).read_text(encoding='utf-8') for name in content['css'])
    OUTPUT.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=args.browser,headless=True)
        context=browser.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce')
        context.route('**/*',lambda route:route.fulfill(content_type='text/html',body='<!doctype html><html><head></head><body><main>Native page</main></body></html>') if route.request.resource_type=='document' else route.abort())
        context.add_init_script(MOCK+'\n'+FIXTURE+"\naddEventListener('DOMContentLoaded',()=>{\n"+sources+"\n},{once:true});")
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto('https://space.bilibili.com/123/favlist?fid=42&ftype=create',wait_until='load')
        page.add_style_tag(content=css)
        field=page.get_by_role('searchbox',name='搜索当前收藏夹')
        expect(field).to_be_visible()
        expect(page.locator('.bt-favorite-videos .bt-card-title')).to_have_text(['全部视频'])

        field.fill('相机');field.press('Enter')
        page.wait_for_function("__heldFavorites.some(item=>item.keyword==='相机')")
        assert page.evaluate("__favoriteRequests.at(-1).folder==='42'&&__favoriteRequests.at(-1).keyword==='相机'")
        field.fill('相机 草稿')
        page.evaluate("__heldFavorites.splice(__heldFavorites.findIndex(item=>item.keyword==='相机'),1)[0].reply()")
        expect(page.locator('.bt-favorite-videos .bt-card-title')).to_have_text(['相机 第一页'])
        expect(field).to_have_value('相机 草稿');expect(field).to_be_focused()
        page.get_by_role('button',name='加载更多').click()
        expect(page.locator('.bt-favorite-videos .bt-card-title')).to_have_text(['相机 第一页','相机 第二页'])
        assert page.evaluate("__favoriteRequests.at(-1).keyword==='相机'&&__favoriteRequests.at(-1).page===2")
        expect(field).to_have_value('相机 草稿')

        field.fill('找不到');field.press('Enter')
        expect(page.locator('.bt-favorite-videos .bt-empty')).to_have_text('当前收藏夹没有匹配的视频')
        page.get_by_role('button',name='清除收藏夹搜索').click()
        expect(page.locator('.bt-favorite-videos .bt-card-title')).to_have_text(['全部视频'])
        expect(field).to_have_value('')

        field.fill('慢');field.press('Enter')
        page.wait_for_function("__heldFavorites.some(item=>item.keyword==='慢')")
        field.fill('快');field.press('Enter')
        expect(page.locator('.bt-favorite-videos .bt-card-title')).to_have_text(['快门练习'])
        page.evaluate("__heldFavorites.splice(__heldFavorites.findIndex(item=>item.keyword==='慢'),1)[0].reply()")
        page.wait_for_timeout(120)
        expect(page.locator('.bt-favorite-videos .bt-card-title')).to_have_text(['快门练习'])

        field.fill('未提交的草稿')
        page.get_by_role('button',name='刷新内容').click()
        page.wait_for_function("__favoriteRequests.some(item=>item.keyword==='快'&&item.forceFresh)")
        expect(field).to_have_value('未提交的草稿')
        expect(page.locator('.bt-favorite-videos .bt-card-title')).to_have_text(['快门练习'])
        assert page.locator('.bt-search-input').input_value()==''

        field.fill('相');field.dispatch_event('compositionstart')
        before=page.evaluate('__favoriteRequests.length')
        page.locator('.bt-favorite-search').evaluate('form=>form.requestSubmit()')
        assert page.evaluate('__favoriteRequests.length')==before
        field.dispatch_event('compositionend')

        page.screenshot(path=str(OUTPUT/'desktop.png'))
        page.locator('.bt-favorite-folder').nth(1).click()
        page.wait_for_url('**/favlist?fid=43&ftype=create')
        page.add_style_tag(content=css)
        field=page.get_by_role('searchbox',name='搜索当前收藏夹')
        expect(field).to_have_value('')
        expect(page.locator('.bt-favorite-videos .bt-card-title')).to_have_text(['其他收藏的视频'])
        assert page.evaluate("__favoriteRequests.at(-1).folder==='43'&&__favoriteRequests.at(-1).keyword==='' ")
        page.set_viewport_size({'width':390,'height':844})
        page.evaluate("document.documentElement.dataset.btTheme='dark'")
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        expect(field).to_be_visible()
        page.screenshot(path=str(OUTPUT/'mobile-dark.png'))
        assert not errors,errors
        context.close();browser.close()
    print('PASS: current folder, paging, clear, empty results, races, drafts, IME, refresh, and folder switching')


if __name__=='__main__':
    main()
