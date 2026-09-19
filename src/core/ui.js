(function init(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BiliTubeUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createUI() {
  const SVG = 'http://www.w3.org/2000/svg';
  const paths = {
    menu:'M4 6h16M4 12h16M4 18h16', search:'m21 21-4.5-4.5m2.5-5.5a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    home:'m3 11 9-7 9 7v9h-6v-6H9v6H3Z', dynamic:'M4 5h16v11H8l-4 4Zm4 4h8M8 12h5', hot:'M12 3c2 4-2 5 1 8 2-2 3-4 3-6 4 4 5 8 3 12-2 4-7 5-11 2-4-4-2-9 2-12 0 3 2 5 4 6-1-4 2-6 2-10Z',
    history:'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2', later:'M5 4h14v16H5ZM9 4v5l3-2 3 2V4', watchLater:'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm0 4v5l3.5 2', library:'M4 5h16v14H4ZM8 9h8M8 13h8',
    live:'M8 8a6 6 0 0 0 0 8M16 8a6 6 0 0 1 0 8M12 10v4', anime:'M4 6h16v12H4ZM9 10l6 2-6 2Z', knowledge:'M4 6 12 3l8 3-8 3Zm2 3v6l6 3 6-3V9', tech:'M9 4h6v4h4v8h-4v4H9v-4H5V8h4Z', game:'M7 9h10l3 7-3 2-2-3H9l-2 3-3-2Zm2 3H6m1-1v2m9-1h.01',
    message:'M4 5h16v12H8l-4 3Zm4 4h8M8 12h5', plus:'M12 5v14M5 12h14', bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 20h4', theme:'M12 3a9 9 0 1 0 9 9c0-.4-.03-.8-.08-1.18A7 7 0 0 1 12 3Z', user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0', settings:'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 3 2-1-2-4-2 1a8 8 0 0 0-2-1l-1-3h-6L8 7a8 8 0 0 0-2 1L4 7l-2 4 2 1v2l-2 1 2 4 2-1a8 8 0 0 0 2 1l1 3h6l1-3a8 8 0 0 0 2-1l2 1 2-4-2-1Z',
    premium:'m12 3 2.6 5.3 5.9.9-4.3 4.2 1 5.9L12 17.5 6.8 20.3l1-5.9-4.3-4.2 5.9-.9Z',
    like:'M7 10v10H4V10h3Zm0 10h8.2a2 2 0 0 0 1.95-1.55l1.35-6A2 2 0 0 0 16.55 10H13l.65-3.1A2.4 2.4 0 0 0 11.3 4L7 10Z',
    coin:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-3 6h6v6H9Z',
    favorite:'M6 4h12v16l-6-4-6 4Z',
    triple:'M13 2 5 14h6l-1 6 8-11h-6l-2-7Z',
    share:'M5 12v7h14v-7M12 16V4m0 0L8 8m4-4 4 4',
    charge:'M13 2 6 13h5l-1 9 8-12h-5V2Z',
    layers:'M12 3 3 8l9 5 9-5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  };
  function e(tag, cls, text) { const n=document.createElement(tag); if(cls)n.className=cls; if(text!=null)n.textContent=text; return n; }
  function icon(name, cls='bt-icon') { const s=document.createElementNS(SVG,'svg'); s.setAttribute('viewBox','0 0 24 24'); s.setAttribute('class',cls); s.setAttribute('aria-hidden','true'); const p=document.createElementNS(SVG,'path'); p.setAttribute('d',paths[name]||paths.user); p.setAttribute('fill','none'); p.setAttribute('stroke','currentColor'); p.setAttribute('stroke-width','1.85'); p.setAttribute('stroke-linecap','round'); p.setAttribute('stroke-linejoin','round'); s.append(p); return s; }
  function createDialog(title='') {
    const backdrop=e('div','bt-dialog-backdrop');
    const dialog=e('section','bt-dialog');
    dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true');
    const head=e('header','bt-dialog-head');
    const heading=e('h2','',title);
    const headingId=`bt-dialog-title-${Math.random().toString(36).slice(2,9)}`;
    heading.id=headingId; dialog.setAttribute('aria-labelledby',headingId);
    const closeButton=e('button','bt-icon-button'); closeButton.type='button'; closeButton.title='关闭'; closeButton.setAttribute('aria-label','关闭对话框'); closeButton.textContent='×';
    const body=e('div','bt-dialog-body');
    const footer=e('footer','bt-dialog-footer');
    head.append(heading,closeButton); dialog.append(head,body,footer); backdrop.append(dialog);
    const previousFocus=document.activeElement;
    let closed=false;
    const onKey=(event)=>{ if(event.key==='Escape') close(); };
    function close(){
      if(closed)return;
      closed=true;
      document.removeEventListener('keydown',onKey,true);
      const finish=()=>{backdrop.remove();if(previousFocus&&typeof previousFocus.focus==='function'){try{previousFocus.focus({preventScroll:true});}catch{previousFocus.focus();}}};
      if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
      backdrop.classList.add('is-closing');
      setTimeout(finish,160);
    }
    closeButton.addEventListener('click',close);
    backdrop.addEventListener('mousedown',(event)=>{ if(event.target===backdrop) close(); });
    document.addEventListener('keydown',onKey,true);
    requestAnimationFrame(()=>{try{closeButton.focus({preventScroll:true});}catch{closeButton.focus();}});
    return { backdrop, dialog, body, footer, close };
  }
  function navLink(href,label,iconName,callbacks,cls='bt-nav-item',active=false) {
    const a=e('a',cls); a.href=href; a.append(icon(iconName),e('span','bt-nav-label',label));
    if(active){a.classList.add('is-active');a.setAttribute('aria-current','page');}
    return a;
  }
  function brand(callbacks){const a=e('a','bt-brand');a.href='https://www.bilibili.com/';const mark=e('span','bt-brand-mark');mark.textContent='▶';a.append(mark,e('strong','','BiliTube'));return a;}
  const topbarUpdates = new WeakMap();
  function updateTopbar(header,data={},callbacks) {
    const update = topbarUpdates.get(header);
    if(update)update(data,callbacks);
  }
  function createTopbar(data={},callbacks={}) {
    const h=e('header','bt-topbar'); h.dataset.role='header'; const left=e('div','bt-topbar-left');
    const menu=e('button','bt-icon-button');menu.type='button';menu.title='切换侧栏';menu.append(icon('menu'));menu.addEventListener('click',()=>callbacks.toggleSidebar&&callbacks.toggleSidebar());left.append(menu,brand(callbacks));
    const form=e('form','bt-search');form.action='https://search.bilibili.com/all';form.method='get';const input=e('input','bt-search-input');input.type='search';input.name='keyword';input.placeholder='搜索';input.autocomplete='off';input.value=data.query||'';input.setAttribute('aria-autocomplete','list');
    const btn=e('button','bt-search-button');btn.type='submit';btn.append(icon('search'));
    const suggestions=e('div','bt-search-suggestions');suggestions.id='bt-search-suggestions';suggestions.hidden=true;suggestions.setAttribute('role','listbox');
    input.setAttribute('aria-controls',suggestions.id);input.setAttribute('aria-expanded','false');
    let suggestionTimer=null,suggestionSeq=0,suggestionItems=[],activeIndex=-1;
    const hideSuggestions=()=>{suggestions.hidden=true;input.setAttribute('aria-expanded','false');activeIndex=-1;};
    const searchFor=(value)=>{const q=String(value||'').trim();if(!q)return;input.value=q;hideSuggestions();if(typeof form.requestSubmit==='function')form.requestSubmit();else form.submit();};
    const setActive=(next)=>{if(!suggestionItems.length)return;activeIndex=(next+suggestionItems.length)%suggestionItems.length;Array.from(suggestions.children).forEach((node,index)=>{const active=index===activeIndex;node.classList.toggle('is-active',active);node.setAttribute('aria-selected',String(active));});};
    const renderSuggestions=(items)=>{suggestionItems=Array.isArray(items)?items.slice(0,10):[];suggestions.replaceChildren();activeIndex=-1;if(!suggestionItems.length){hideSuggestions();return;}for(const value of suggestionItems){const row=e('button','bt-search-suggestion');row.type='button';row.setAttribute('role','option');row.setAttribute('aria-selected','false');row.append(icon('search'),e('span','',value));row.addEventListener('mousedown',ev=>ev.preventDefault());row.addEventListener('click',()=>{input.value=value;hideSuggestions();searchFor(value);});suggestions.append(row);}suggestions.hidden=false;input.setAttribute('aria-expanded','true');};
    input.addEventListener('input',()=>{if(suggestionTimer)clearTimeout(suggestionTimer);const q=input.value.trim();if(!q||!callbacks.requestSearchSuggestions){hideSuggestions();return;}const seq=++suggestionSeq;suggestionTimer=setTimeout(async()=>{let items=[];try{items=await callbacks.requestSearchSuggestions(q);}catch{}if(seq!==suggestionSeq||input.value.trim()!==q)return;renderSuggestions(items);}, 180);});
    input.addEventListener('keydown',(ev)=>{if(ev.key==='ArrowDown'&&!suggestions.hidden){ev.preventDefault();setActive(activeIndex+1);}else if(ev.key==='ArrowUp'&&!suggestions.hidden){ev.preventDefault();setActive(activeIndex-1);}else if(ev.key==='Escape'){hideSuggestions();}else if(ev.key==='Enter'&&!suggestions.hidden&&activeIndex>=0){ev.preventDefault();const value=suggestionItems[activeIndex];input.value=value;hideSuggestions();searchFor(value);}});
    input.addEventListener('focus',()=>{if(suggestionItems.length){suggestions.hidden=false;input.setAttribute('aria-expanded','true');}});input.addEventListener('blur',()=>setTimeout(hideSuggestions,120));
    form.append(input,btn,suggestions);form.addEventListener('submit',()=>hideSuggestions());
    const right=e('div','bt-topbar-right');
    const create=navLink('https://t.bilibili.com/','动态','dynamic',callbacks,'bt-create-button');create.title='动态';right.append(create);
    const notice=navLink('https://message.bilibili.com/','消息','bell',callbacks,'bt-icon-button bt-notification-button');notice.title='消息';right.append(notice);
    const theme=e('button','bt-icon-button bt-theme-button');theme.type='button';theme.title='切换主题';theme.dataset.action='theme';theme.append(icon('theme'));theme.addEventListener('click',()=>callbacks.toggleTheme&&callbacks.toggleTheme());right.append(theme);
    const glassMode=!(data.settings&&data.settings.glassMode===false);const style=e('button','bt-icon-button bt-style-button');style.type='button';style.title=glassMode?'切换到原版 YouTube Desktop 风格':'切换到毛玻璃界面';style.setAttribute('aria-label',style.title);style.setAttribute('aria-pressed',String(glassMode));style.dataset.action='visual-style';style.append(icon('layers'));style.addEventListener('click',()=>callbacks.toggleVisualStyle&&callbacks.toggleVisualStyle());right.append(style);
    const account=e('a','bt-account');account.href=data.user&&data.user.mid?`https://space.bilibili.com/${data.user.mid}`:'https://passport.bilibili.com/login';account.title=data.user&&data.user.name?data.user.name:'登录';if(data.user&&data.user.face){const img=e('img','bt-account-avatar');img.src=data.user.face;img.alt=data.user.name||'账号';img.decoding='async';account.append(img);}else account.append(icon('user'));right.append(account);
    let renderedQuery=String(data.query||'');
    let accountSignature=JSON.stringify(data.user||null);
    topbarUpdates.set(h,(next,nextCallbacks)=>{
      if(nextCallbacks)callbacks=nextCallbacks;
      const query=String(next.query||'');
      if(query!==renderedQuery){
        renderedQuery=query;input.value=query;
        suggestionSeq+=1;clearTimeout(suggestionTimer);suggestionItems=[];hideSuggestions();
      }
      if(next.settings&&next.settings.searchSuggestions===false){
        suggestionSeq+=1;clearTimeout(suggestionTimer);suggestionItems=[];hideSuggestions();
      }
      const glass=!(next.settings&&next.settings.glassMode===false);
      style.title=glass?'切换到原版 YouTube Desktop 风格':'切换到毛玻璃界面';
      style.setAttribute('aria-label',style.title);style.setAttribute('aria-pressed',String(glass));
      const signature=JSON.stringify(next.user||null);
      if(signature!==accountSignature){
        accountSignature=signature;
        const user=next.user||{};
        account.href=user.mid?`https://space.bilibili.com/${user.mid}`:'https://passport.bilibili.com/login';
        account.title=user.name||'登录';account.replaceChildren();
        if(user.face){const img=e('img','bt-account-avatar');img.src=user.face;img.alt=user.name||'账号';img.decoding='async';account.append(img);}
        else account.append(icon('user'));
      }
    });
    h.append(left,form,right);return h;
  }
  function routeMatches(route,target){
    if(!target)return false;
    const routes=Array.isArray(target)?target:[target];
    return routes.some(key=>key==='search'?String(route||'').startsWith('search-'):key==='space'?String(route||'').startsWith('space-'):key===route);
  }
  function sideSection(title, items, callbacks, route='') {
    const section=e('section','bt-side-section'); section.dataset.btGroup=title||'primary'; if(title)section.append(e('h2','bt-side-title',title));
    for(const item of items){
      const active=routeMatches(route,item.route);
      if(item.action&&callbacks&&typeof callbacks[item.action]==='function'){
        const b=e('button',`bt-nav-item bt-nav-button${active?' is-active':''}`);b.type='button';b.append(icon(item.icon),e('span','bt-nav-label',item.label));if(active)b.setAttribute('aria-current','page');b.addEventListener('click',callbacks[item.action]);section.append(b);
      } else {
        const link=navLink(item.href,item.label,item.icon,callbacks,'bt-nav-item',active);section.append(link);
      }
    }
    return section;
  }
  function attachSidebarScrollIndicator(aside, scroller, thumb) {
    let hideTimer = null;
    function updateThumb() {
      const viewport = Math.max(0, scroller.clientHeight || 0);
      const content = Math.max(viewport, scroller.scrollHeight || 0);
      const maxScroll = Math.max(0, content - viewport);
      if (!viewport || maxScroll <= 1) {
        thumb.style.height = '0px';
        aside.classList.remove('is-scrolling');
        return;
      }
      const thumbHeight = Math.max(36, Math.round(viewport * viewport / content));
      const travel = Math.max(0, viewport - thumbHeight - 8);
      const top = 4 + Math.round((Math.max(0, scroller.scrollTop || 0) / maxScroll) * travel);
      thumb.style.height = `${thumbHeight}px`;
      thumb.style.transform = `translateY(${top}px)`;
    }
    function revealThumb() {
      updateThumb();
      if (!thumb.style.height || thumb.style.height === '0px') return;
      aside.classList.add('is-scrolling');
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => aside.classList.remove('is-scrolling'), 720);
    }
    scroller.addEventListener('scroll', revealThumb, { passive:true });
    scroller.addEventListener('wheel', revealThumb, { passive:true });
    scroller.addEventListener('touchmove', revealThumb, { passive:true });
    queueMicrotask(updateThumb);
  }
  function createSidebar(data={},callbacks={}) {
    const aside=e('aside','bt-sidebar');aside.dataset.role='sidebar';
    const scroller=e('div','bt-sidebar-scroll');
    scroller.append(sideSection('',[
      {label:'首页',icon:'home',href:'https://www.bilibili.com/',route:'home'},{label:'动态',icon:'dynamic',href:'https://t.bilibili.com/',route:'dynamic'},{label:'热门',icon:'hot',href:'https://www.bilibili.com/v/popular/all/',route:'popular'},
    ],callbacks,data.route),sideSection('你的内容',[
      {label:'历史记录',icon:'history',href:'https://www.bilibili.com/history',route:'history'},{label:'稍后再看',icon:'later',href:'https://www.bilibili.com/list/watchlater',route:'watchlater'},{label:'收藏夹',icon:'library',href:data.user&&data.user.mid?`https://space.bilibili.com/${data.user.mid}/favlist`:'https://www.bilibili.com/',route:'favorites'},
    ],callbacks,data.route));
    const showSubscriptions=!(data.settings&&data.settings.showSubscriptions===false);
    if(showSubscriptions){const subs=e('section','bt-side-section');subs.dataset.role='subscriptions';subs.append(e('h2','bt-side-title','订阅')); renderSubscriptions(subs,data.subscriptions||[],callbacks);scroller.append(subs);}
    scroller.append(sideSection('探索',[
      {label:'直播',icon:'live',href:'https://live.bilibili.com/',route:'live'},{label:'番剧影视',icon:'anime',href:'https://www.bilibili.com/anime/'},{label:'知识',icon:'knowledge',href:'https://www.bilibili.com/v/knowledge/'},{label:'科技',icon:'tech',href:'https://www.bilibili.com/v/tech/'},{label:'游戏',icon:'game',href:'https://www.bilibili.com/v/game/'},
    ],callbacks,data.route),sideSection('更多',[
      {label:'消息',icon:'message',href:'https://message.bilibili.com/',route:'message'},{label:'大会员',icon:'premium',href:'https://account.bilibili.com/big',route:'account'},{label:'设置',icon:'settings',action:'openSettings',route:'settings'},
    ],callbacks,data.route));
    const thumb=e('div','bt-sidebar-scroll-thumb'); thumb.setAttribute('aria-hidden','true');
    aside.append(scroller,thumb); attachSidebarScrollIndicator(aside,scroller,thumb); return aside;
  }
  function createSidebarDrawer(data={},callbacks={}) {
    const backdrop=e('div','bt-sidebar-drawer-backdrop');backdrop.dataset.role='sidebar-drawer';backdrop.setAttribute('aria-hidden','true');
    const drawer=e('div','bt-sidebar-drawer');const sidebar=createSidebar(data,callbacks);sidebar.classList.add('is-drawer');drawer.append(sidebar);backdrop.append(drawer);
    const close=()=>{backdrop.classList.remove('is-open');backdrop.setAttribute('aria-hidden','true');};
    const toggle=()=>{const open=!backdrop.classList.contains('is-open');backdrop.classList.toggle('is-open',open);backdrop.setAttribute('aria-hidden',open?'false':'true');};
    backdrop.addEventListener('mousedown',(event)=>{if(event.target===backdrop)close();});
    drawer.addEventListener('click',(event)=>{const a=event.target&&event.target.closest&&event.target.closest('a[href]');if(a)close();});
    return { backdrop, toggle, close, isOpen:()=>backdrop.classList.contains('is-open') };
  }
  function renderSubscriptions(section,items,callbacks){section.querySelectorAll('.bt-sub-item').forEach(n=>n.remove());if(!items.length){const p=e('p','bt-side-muted bt-sub-item','登录后显示近期订阅');section.append(p);return;}for(const item of items.slice(0,8)){const a=e('a','bt-nav-item bt-sub-item');a.href=item.href;const wrap=e('span',`bt-sub-avatar${item.live?' is-live':''}`);if(item.avatar){const img=e('img','');img.src=item.avatar;img.alt='';wrap.append(img);}else wrap.append(icon('user'));if(item.unread&&!item.live)wrap.append(e('i','bt-unread-dot'));a.append(wrap,e('span','bt-sub-name',item.name||`UID ${item.mid}`));if(item.live)a.append(e('span','bt-live-label','LIVE'));section.append(a);}}
  function updateChrome(root,data,callbacks){const oldHeader=root.querySelector('[data-role="header"]');if(oldHeader)updateTopbar(oldHeader,data,callbacks);const oldSide=root.querySelector('[data-role="sidebar"]');if(oldSide){const next=createSidebar(data,callbacks);if(oldSide.classList.contains('is-collapsed'))next.classList.add('is-collapsed');oldSide.replaceWith(next);}}
  const imageLoadStates = new Map();
  function progressiveImage(src,box,priority=false){
    const full=String(src||'');
    const settled=imageLoadStates.get(full);
    const img=e('img',settled?'bt-thumb-image is-loaded':'bt-thumb-image is-loading is-preview');
    const eager=priority===true||priority==='high'||priority==='low';
    img.alt='';img.loading=eager?'eager':'lazy';img.fetchPriority=priority===true||priority==='high'?'high':priority==='low'?'low':'auto';img.decoding='async';img.dataset.btFullSrc=full;
    const finish=(state='settled')=>{imageLoadStates.set(full,state);box.classList.remove('is-image-loading');box.classList.add('is-image-loaded');img.classList.remove('is-loading','is-preview','is-promoting');img.classList.add('is-loaded');};
    if(!settled){img.addEventListener('load',()=>finish('loaded'),{once:true});img.addEventListener('error',()=>finish('failed'),{once:true});}
    box.classList.add('bt-thumb-progressive',settled?'is-image-loaded':'is-image-loading');
    img.src=full;
    return img;
  }
  function imageBox(item){const box=e('div','bt-thumb');if(item.thumbnail){const img=progressiveImage(item.thumbnail,box,item.imagePriority);box.append(img,e('span','bt-thumb-progress-shimmer'));}else box.append(e('div','bt-thumb-placeholder','BiliTube'));if(item.duration)box.append(e('span','bt-duration',''+item.duration));return box;}
  function bindLink(node,href,callbacks){if(!node||!href)return;node.href=href;}
  function watchLaterPlayHref(item){
    const bvid=String(item&&item.bvid||'').trim();
    if(/^BV[0-9A-Za-z]+$/.test(bvid)) return `https://www.bilibili.com/video/${bvid}`;
    const source=String(item&&item.playHref||item&&item.href||'');
    const match=source.match(/[?&]bvid=(BV[0-9A-Za-z]+)/i);
    return match ? `https://www.bilibili.com/video/${match[1]}` : source;
  }
  function avatar(item){if(item.avatar){const img=e('img','bt-card-avatar');img.src=item.avatar;img.alt=item.author||'';img.loading='lazy';return img;}const p=e('span','bt-card-avatar bt-avatar-placeholder');p.append(icon('user'));return p;}
  function watchLaterQuick(item,callbacks={}){
    if(!item||!item.bvid||!callbacks||typeof callbacks.toggleWatchLater!=='function')return null;
    if(typeof callbacks.showWatchLaterQuick==='function'&&!callbacks.showWatchLaterQuick())return null;
    const active=typeof callbacks.isWatchLater==='function'&&callbacks.isWatchLater(item);
    const button=e('button',`bt-watchlater-quick${active?' is-active':''}`);button.type='button';button.dataset.bvid=String(item.bvid||'');button.dataset.aid=String(item.aid||'');button.title=active?'从稍后再看移除':'稍后再看';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(Boolean(active)));button.append(icon('watchLater'));
    const stopPointer=(ev)=>{ev.stopPropagation();};const handleClick=async(ev)=>{ev.preventDefault();ev.stopPropagation();if(button.classList.contains('is-loading'))return;button.classList.add('is-loading');button.setAttribute('aria-busy','true');const next=await callbacks.toggleWatchLater(item,button);button.classList.remove('is-loading');button.removeAttribute('aria-busy');if(typeof next==='boolean'){button.classList.toggle('is-active',next);button.setAttribute('aria-pressed',String(next));button.title=next?'从稍后再看移除':'稍后再看';button.setAttribute('aria-label',button.title);}};button.addEventListener('pointerdown',stopPointer);button.addEventListener('click',handleClick);return button;
  }
  function createCard(item,callbacks={}){const card=e('article','bt-video-card');const media=e('div','bt-card-media');const thumbLink=e('a','bt-thumb-link');bindLink(thumbLink,item.href,callbacks);const thumb=imageBox(item);thumbLink.append(thumb);media.append(thumbLink);const quick=watchLaterQuick(item,callbacks);if(quick)media.append(quick);card.append(media);const row=e('div','bt-card-row');const avLink=e('a','bt-avatar-link');bindLink(avLink,item.authorHref||item.href,callbacks);avLink.append(avatar(item));const info=e('div','bt-card-info');const title=e('a','bt-card-title',item.title||'未命名视频');bindLink(title,item.href,callbacks);info.append(title);const showAuthor=!callbacks.showCardAuthor||callbacks.showCardAuthor();const showMeta=!callbacks.showCardMeta||callbacks.showCardMeta();if(showAuthor&&item.author){const author=e('a','bt-card-author',item.author);bindLink(author,item.authorHref||item.href,callbacks);info.append(author);}if(showMeta&&item.meta)info.append(e('div','bt-card-meta',item.meta));row.append(avLink,info);card.append(row);if(callbacks.bindPreview)callbacks.bindPreview(card,item,thumb);return card;}
  function withImagePriority(item,index,state){const rank=state?state.next++:index;const priority=rank<4?'high':rank<8?'low':false;return priority?{...item,imagePriority:priority}:item;}
  function heading(title,sub){const h=e('div','bt-page-heading');h.append(e('h1','',title));if(sub)h.append(e('p','',sub));return h;}
  function skeletonCard(){const card=e('article','bt-video-card bt-skeleton-card');const media=e('div','bt-card-media');media.append(e('div','bt-thumb bt-skeleton-block'));card.append(media);const row=e('div','bt-card-row');row.append(e('span','bt-card-avatar bt-skeleton-circle'));const info=e('div','bt-card-info');info.append(e('span','bt-skeleton-line is-wide'),e('span','bt-skeleton-line is-short'),e('span','bt-skeleton-line is-meta'));row.append(info);card.append(row);return card;}
  function renderSkeletonGrid(outlet,count=8){const grid=e('section','bt-video-grid bt-skeleton-grid');for(let index=0;index<count;index++)grid.append(skeletonCard());outlet.append(grid);return grid;}
  function renderSkeletonSearchList(outlet,count=4){const list=e('section','bt-search-list bt-skeleton-list');for(let index=0;index<count;index++){const row=e('article','bt-search-row bt-skeleton-search-row');const media=e('div','bt-search-media');media.append(e('div','bt-thumb bt-skeleton-block'));const info=e('div','bt-search-info');info.append(e('span','bt-skeleton-line is-wide'),e('span','bt-skeleton-line is-short'),e('span','bt-skeleton-line is-meta'));row.append(media,info);list.append(row);}outlet.append(list);return list;}
  function renderSkeletonLibraryList(outlet,count=4){const list=e('section','bt-library-list bt-skeleton-list');for(let index=0;index<count;index++){const row=e('article','bt-library-row bt-skeleton-library-row');row.append(e('div','bt-thumb bt-skeleton-block'));const info=e('div','bt-library-info');info.append(e('span','bt-skeleton-line is-wide'),e('span','bt-skeleton-line is-short'),e('span','bt-skeleton-line is-meta'));row.append(info);list.append(row);}outlet.append(list);return list;}
  function renderGrid(outlet,items,callbacks,options={}){if(!items||!items.length){if(options.loading){renderSkeletonGrid(outlet,options.count||8);return;}outlet.append(e('div','bt-empty',options.empty||'暂时没有读取到内容'));return;}const grid=e('section','bt-video-grid');const priorityState={next:0};for(const [index,item] of items.entries())grid.append(createCard(withImagePriority(item,index,priorityState),callbacks));outlet.append(grid);}
  function feedSentinel(feed,loading,hasMore){const n=e('div',`bt-feed-sentinel${loading?' is-loading':''}`);n.dataset.btFeed=feed;n.setAttribute('aria-live','polite');n.textContent=loading?'正在加载更多…':hasMore===false?'已经到底了':'继续向下浏览';return n;}
  function createShelfCard(item,callbacks={}){
    const card=createCard(item,callbacks);card.classList.add('bt-special-card',`is-${item.kind||'video'}`);
    const thumb=card.querySelector('.bt-thumb');
    if(thumb&&item.kind==='live'){const badge=e('span','bt-special-badge is-live','LIVE');thumb.append(badge);}
    else if(thumb&&item.kind==='bangumi'){const badge=e('span','bt-special-badge','番剧');thumb.append(badge);}
    return card;
  }
  function renderHomeShelf(outlet,section,callbacks,priorityState){
    if(!section||!Array.isArray(section.items)||!section.items.length)return;
    const shelf=e('section','bt-home-shelf');
    const head=e('div','bt-home-shelf-head');const title=e('div','bt-home-shelf-title');title.append(e('h2','',section.title||''));
    if(section.href){const more=e('a','bt-home-shelf-more','查看全部');bindLink(more,section.href,callbacks);title.append(more);}head.append(title);
    const controls=e('div','bt-home-shelf-controls');const prev=e('button','bt-shelf-arrow','‹');const next=e('button','bt-shelf-arrow','›');prev.type=next.type='button';controls.append(prev,next);head.append(controls);
    const row=e('div','bt-home-shelf-row');for(const [index,item] of section.items.entries())row.append(createShelfCard(withImagePriority(item,index,priorityState),callbacks));
    const slide=dir=>row.scrollBy({left:dir*Math.max(280,row.clientWidth*.82),behavior:'smooth'});prev.addEventListener('click',()=>slide(-1));next.addEventListener('click',()=>slide(1));
    shelf.append(head,row);outlet.append(shelf);
  }
  function renderHomeVideoBlock(outlet,items,callbacks,label='',priorityState){
    if(!items||!items.length)return;if(label)outlet.append(e('h2','bt-home-block-title',label));const grid=e('section','bt-video-grid bt-home-grid');for(const [index,item] of items.entries())grid.append(createCard(withImagePriority(item,index,priorityState),callbacks));outlet.append(grid);
  }
  const homeCategoryDefs=[['全部','all'],['直播','live'],['番剧','anime'],['知识','knowledge'],['科技','tech'],['游戏','game'],['音乐','music'],['影视','film']];
  function homeCategoryHref(key){return key==='all'?'https://www.bilibili.com/':`https://www.bilibili.com/?bilitube_category=${encodeURIComponent(key)}`;}
  function renderHome(outlet,data,callbacks){
    const category=String(data.category||'all');const chips=e('nav','bt-chip-row');for(const [label,key] of homeCategoryDefs){const a=e('a',`bt-chip${category===key?' is-active':''}`,label);a.href=homeCategoryHref(key);a.setAttribute('aria-current',category===key?'page':'false');chips.append(a);}outlet.append(chips);
    const videos=data.videos||[];const shelves=Array.isArray(data.shelves)?data.shelves:[];const priorityState={next:0};let cursor=0;
    if(data.loading&&!videos.length&&!shelves.length){outlet.append(e('div','bt-loading-state','正在为你准备内容'));renderSkeletonGrid(outlet,8);outlet.append(feedSentinel('home',true,data.hasMore));return;}
    renderHomeVideoBlock(outlet,videos.slice(cursor,cursor+8),callbacks,'为你推荐',priorityState);cursor+=8;
    for(const shelf of shelves){renderHomeShelf(outlet,shelf,callbacks,priorityState);renderHomeVideoBlock(outlet,videos.slice(cursor,cursor+8),callbacks,'继续为你推荐',priorityState);cursor+=8;}
    renderHomeVideoBlock(outlet,videos.slice(cursor),callbacks,cursor?'继续为你推荐':'为你推荐',priorityState);
    if(!videos.length&&!shelves.length)outlet.append(e('div','bt-empty',data.error||'暂时没有读取到内容'));
    outlet.append(feedSentinel('home',Boolean(data.loading),data.hasMore));
  }
  function renderSearch(outlet,data,callbacks){
    const q=String(data.query||'');const category=String(data.category||'all');outlet.append(heading(q?`“${q}”的搜索结果`:'搜索','来自 Bilibili 的视频、UP主、番剧与影视内容'));
    const tabs=e('nav','bt-search-tabs');
    const tabDefs=[['全部',`https://search.bilibili.com/all?keyword=${encodeURIComponent(q)}`,'all'],['视频',`https://search.bilibili.com/video?keyword=${encodeURIComponent(q)}`,'video'],['用户',`https://search.bilibili.com/upuser?keyword=${encodeURIComponent(q)}`,'user'],['番剧',`https://search.bilibili.com/bangumi?keyword=${encodeURIComponent(q)}`,'bangumi'],['影视',`https://search.bilibili.com/media_ft?keyword=${encodeURIComponent(q)}`,'media']];
    for(const [label,href,key] of tabDefs){const a=e('a',`bt-chip${category===key?' is-active':''}`,label);bindLink(a,href,callbacks);tabs.append(a);}outlet.append(tabs);
    const users=Array.isArray(data.users)?data.users:[];const visibleUsers=category==='all'?users.slice(0,1):users;
    if(visibleUsers.length){const channels=e('section','bt-search-channels');for(const item of visibleUsers){const row=e('article','bt-search-channel');const av=e('a','bt-search-channel-avatar');bindLink(av,item.href,callbacks);if(item.avatar){const img=e('img','');img.src=item.avatar;img.alt=item.name||'';img.loading='lazy';av.append(img);}else av.append(icon('user'));const info=e('div','bt-search-channel-info');const name=e('a','bt-search-channel-name',item.name||'UP主');bindLink(name,item.href,callbacks);info.append(name,e('div','bt-search-channel-meta',item.meta||`@${item.mid||''}`));if(item.sign)info.append(e('p','bt-search-channel-sign',item.sign));const follow=e('button',`bt-subscribe${item.following?' is-following':''}`,item.following?'已关注':'关注');follow.type='button';follow.addEventListener('click',()=>callbacks.followSpace&&callbacks.followSpace(String(item.mid||''),Boolean(item.following)));row.append(av,info,follow);channels.append(row);}outlet.append(channels);}
    const results=Array.isArray(data.results)?data.results:Array.isArray(data.videos)?data.videos:[];
    if(results.length){const list=e('section','bt-search-list');const priorityState={next:0};for(const [index,raw] of results.entries()){const item=withImagePriority(raw,index,priorityState);const row=e('article',`bt-search-row kind-${item.kind||'video'}`);const media=e('div','bt-search-media');const a=e('a','bt-search-thumb');bindLink(a,item.href,callbacks);const thumb=imageBox(item);a.append(thumb);media.append(a);if(item.kind==='video'){const quick=watchLaterQuick(item,callbacks);if(quick)media.append(quick);}const info=e('div','bt-search-info');const title=e('a','bt-search-title',item.title);bindLink(title,item.href,callbacks);info.append(title);if((!callbacks.showCardMeta||callbacks.showCardMeta())&&item.meta)info.append(e('div','bt-card-meta',item.meta));if((!callbacks.showCardAuthor||callbacks.showCardAuthor())&&item.author){const au=e('a','bt-search-author');bindLink(au,item.authorHref||item.href,callbacks);au.append(avatar(item),e('span','',item.author));info.append(au);}if(item.description)info.append(e('p','bt-search-description',item.description));row.append(media,info);if(item.kind==='video'&&callbacks.bindPreview)callbacks.bindPreview(row,item,thumb);list.append(row);}outlet.append(list);}
    if(!visibleUsers.length&&!results.length){if(data.loading){outlet.append(e('div','bt-loading-state','正在从 Bilibili 搜索…'));renderSkeletonSearchList(outlet,4);}else outlet.append(e('div','bt-empty',data.error||'没有找到结果'));}
    outlet.append(feedSentinel('search',Boolean(data.loading),data.hasMore));
  }
  function renderHistory(outlet,data,callbacks){
    const header=e('div','bt-history-header');
    header.append(heading('历史记录',''));
    outlet.append(header);
    const layout=e('div','bt-history-layout');
    const list=e('section','bt-history-list');
    let last='';const priorityState={next:0};
    for(const [index,raw] of (data.videos||[]).entries()){
      const item=withImagePriority(raw,index,priorityState);
      const day=dayLabel(item.viewedAt);
      if(day!==last){list.append(e('h2','bt-history-day',day));last=day;}
      const row=e('article','bt-history-row');
      row.dataset.search=`${item.title||''} ${item.author||''}`.toLowerCase();
      const a=e('a','bt-history-thumb');bindLink(a,item.href,callbacks);
      const thumb=imageBox(item);
      if(item.progress>0){const p=e('div','bt-history-progress');const f=e('span');f.style.width=`${Math.round(item.progress*100)}%`;p.append(f);thumb.append(p);}
      a.append(thumb);
      const info=e('div','bt-history-info');
      const title=e('a','bt-history-title',item.title);bindLink(title,item.href,callbacks);info.append(title);
      if(item.author){const au=e('a','bt-card-author',item.author);bindLink(au,item.authorHref||item.href,callbacks);info.append(au);}
      if(item.meta)info.append(e('div','bt-card-meta',item.meta));
      row.append(a,info);list.append(row);
    }
    if(!list.querySelector('.bt-history-row')) list.append(e('div','bt-empty',data.error||'暂时没有读取到观看记录'));
    else list.append(feedSentinel('history',Boolean(data.loading),data.hasMore));

    const tools=e('aside','bt-history-tools');
    const searchWrap=e('div','bt-history-search-wrap'); searchWrap.append(icon('search'));
    const search=e('input','bt-history-search');search.type='search';search.placeholder='搜索观看记录';
    search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();list.querySelectorAll('.bt-history-row').forEach(n=>n.hidden=Boolean(q&&!n.dataset.search.includes(q)));});
    searchWrap.append(search);tools.append(searchWrap);

    const clear=e('button','bt-history-tool-button');clear.type='button';clear.append(icon('history'),e('span','','清除观看记录'));
    clear.addEventListener('click',()=>callbacks&&callbacks.clearHistory&&callbacks.clearHistory());
    const pause=e('button','bt-history-tool-button');pause.type='button';pause.append(icon('history'),e('span','',data.paused?'开启观看记录':'暂停观看记录'));
    pause.addEventListener('click',()=>callbacks&&callbacks.toggleHistoryPause&&callbacks.toggleHistoryPause());
    const native=navLink('https://www.bilibili.com/history?bilitube_native=1','管理全部观看记录','settings',callbacks,'bt-history-tool-button bt-history-native');
    tools.append(clear,pause,native);
    layout.append(list,tools);outlet.append(layout);
  }
  function renderDynamic(outlet,data,callbacks){
    const items=data.items||[];const mode=String(data.mode||'all');const videos=items.filter(item=>item.video).map(item=>item.video);const others=items.filter(item=>!item.video);const priorityState={next:0};
    const top=e('div','bt-subscriptions-heading');top.append(e('h1','','最新'));
    const filters=e('nav','bt-chip-row');[['全部动态','all'],['投稿视频','videos'],['只看动态','updates']].forEach(([label,key])=>{const a=e('a',`bt-chip${mode===key?' is-active':''}`,label);a.href=`https://t.bilibili.com/?bilitube_dynamic=${key}`;a.setAttribute('aria-current',mode===key?'page':'false');filters.append(a);});top.append(filters);outlet.append(top);
    if(mode!=='updates'&&videos.length){const grid=e('section','bt-video-grid bt-dynamic-video-grid');for(const [index,video] of videos.entries())grid.append(createCard(withImagePriority(video,index,priorityState),callbacks));outlet.append(grid);}else if(mode==='videos')outlet.append(e('div','bt-empty',data.error||'暂时没有投稿视频'));
    if(mode!=='videos'&&others.length){outlet.append(e('h2','bt-dynamic-section-title','其他动态'));const feed=e('section','bt-dynamic-feed bt-dynamic-secondary');for(const item of others){const card=e('article','bt-dynamic-card');const head=e('div','bt-dynamic-head');const au=e('a','bt-dynamic-author');bindLink(au,item.authorHref,callbacks);au.append(avatar(item),e('strong','',item.author||'UP主'));head.append(au);if(item.time)head.append(e('span','bt-dynamic-time',item.time));card.append(head);if(item.text)card.append(e('p','bt-dynamic-text',item.text));if(item.images&&item.images.length){const images=e('div',`bt-dynamic-images count-${Math.min(item.images.length,3)}`);for(const src of item.images.slice(0,9)){const img=e('img','');img.src=src;img.loading='lazy';img.alt='';images.append(img);}card.append(images);}feed.append(card);}outlet.append(feed);}
    if(!videos.length&&!others.length){if(data.loading){outlet.append(e('div','bt-loading-state','正在读取动态…'));renderSkeletonGrid(outlet,6);}else outlet.append(e('div','bt-empty',data.error||'暂时没有读取到动态'));}
    outlet.append(feedSentinel('dynamic',Boolean(data.loading),data.hasMore));
  }
  function renderWatchLater(outlet,data,callbacks){
    const videos=data.videos||[];
    const layout=e('div','bt-library-layout');
    const summary=e('section','bt-library-summary');const cover=e('div','bt-library-cover');if(videos[0]&&videos[0].thumbnail){const img=e('img','');img.src=videos[0].thumbnail;img.alt='';cover.append(img);}else cover.append(icon('later'));const detail=e('div','bt-library-summary-info');detail.append(e('h1','','稍后再看'),e('p','',`${videos.length} 个视频 · 保留 B站观看进度`));const play=navLink('https://www.bilibili.com/list/watchlater?bilitube_native=1', '播放全部','later',callbacks,'bt-primary-button');detail.append(play);summary.append(cover,detail);layout.append(summary);
    if(!videos.length){if(data.loading){layout.append(e('div','bt-loading-state','正在读取稍后再看…'));renderSkeletonLibraryList(layout,4);}else layout.append(e('div','bt-empty','稍后再看列表为空'));outlet.append(layout);return;}
    const list=e('section','bt-library-list');const priorityState={next:0};for(const [index,raw] of videos.entries()){const item=withImagePriority(raw,index,priorityState);const row=e('article','bt-library-row');const playHref=watchLaterPlayHref(item);const a=e('a','bt-library-thumb');bindLink(a,playHref,callbacks);const thumb=imageBox(item);if(item.progress>0){const p=e('div','bt-history-progress');const f=e('span');f.style.width=`${Math.round(item.progress*100)}%`;p.append(f);thumb.append(p);}a.append(thumb);const info=e('div','bt-library-info');const title=e('a','bt-history-title',item.title);bindLink(title,playHref,callbacks);info.append(title);if(item.author){const au=e('a','bt-card-author',item.author);bindLink(au,item.authorHref,callbacks);info.append(au);}if(item.meta)info.append(e('div','bt-card-meta',item.meta));row.append(a,info);list.append(row);}layout.append(list);outlet.append(layout);
  }
  function renderFavorites(outlet,data,callbacks){
    const selectedFolder=data.selectedFolder||null;outlet.append(heading('收藏夹','像播放列表一样浏览 B站收藏'));
    const layout=e('div','bt-favorites-layout');const folders=e('aside','bt-favorite-folders');const videos=e('section','bt-favorite-videos');
    if(selectedFolder){const summary=e('section','bt-favorite-summary');const cover=e('div','bt-favorite-summary-cover');if(selectedFolder.cover){const img=e('img','');img.src=selectedFolder.cover;img.alt='';cover.append(img);}else cover.append(icon('library'));const info=e('div','bt-favorite-summary-info');info.append(e('h2','',selectedFolder.title||'收藏夹'),e('p','',`${selectedFolder.count||data.videos&&data.videos.length||0} 个视频`));const first=data.videos&&data.videos[0];if(first){const play=e('a','bt-primary-button');play.append(icon('anime'),e('span','','播放全部'));const playlistHref=selectedFolder&&selectedFolder.id?`https://www.bilibili.com/medialist/play/ml${selectedFolder.id}`:first.href;bindLink(play,playlistHref,callbacks);info.append(play);}summary.append(cover,info);folders.append(summary);}
    for(const folder of data.folders||[]){const a=e('a',`bt-favorite-folder${String(folder.id)===String(data.selectedId||'')?' is-active':''}`);a.href=`https://space.bilibili.com/${data.mid}/favlist?fid=${encodeURIComponent(folder.id)}&ftype=create`;a.append(e('strong','',folder.title),e('span','',`${folder.count||0} 个视频`));folders.append(a);}if(!folders.children.length)folders.append(e('div','bt-empty','没有读取到收藏夹'));
    if(data.videos&&data.videos.length){const grid=e('div','bt-video-grid');const priorityState={next:0};for(const [index,item] of data.videos.entries())grid.append(createCard(withImagePriority(item,index,priorityState),callbacks));videos.append(grid);}else if(data.loading){videos.append(e('div','bt-loading-state','正在读取收藏夹…'));renderSkeletonGrid(videos,6);}else videos.append(e('div','bt-empty',data.error||'这个收藏夹暂时没有读取到视频'));videos.append(feedSentinel('favorites',Boolean(data.loading),data.hasMore));layout.append(folders,videos);outlet.append(layout);
  }
  function renderSpace(outlet,data,callbacks){const p=data.profile||{};const hero=e('section','bt-channel-hero');if(p.banner){const b=e('img','bt-channel-banner');b.src=p.banner;b.alt='';hero.append(b);}const info=e('div','bt-channel-info');const av=e('div','bt-channel-avatar');if(p.avatar){const img=e('img','');img.src=p.avatar;img.alt=p.name||'';av.append(img);}else av.append(icon('user'));const text=e('div','bt-channel-text');text.append(e('h1','',p.name||`UID ${data.mid||''}`));if(p.mid)text.append(e('p','bt-channel-meta',`@${p.mid}${p.stats?' · '+p.stats:''}`));if(p.sign)text.append(e('p','bt-channel-sign',p.sign));const follow=e('button',`bt-subscribe${p.following?' is-following':''}`,p.following?'已关注':'关注');follow.type='button';follow.setAttribute('aria-pressed',String(Boolean(p.following)));follow.addEventListener('click',async()=>{if(!callbacks.followSpace||follow.disabled)return;follow.disabled=true;follow.classList.add('is-loading');const result=await callbacks.followSpace(String(data.mid||p.mid||''),Boolean(p.following));follow.disabled=false;follow.classList.remove('is-loading');if(result){p.following=!p.following;follow.classList.toggle('is-following',p.following);follow.textContent=p.following?'已关注':'关注';follow.setAttribute('aria-pressed',String(p.following));}});info.append(av,text,follow);hero.append(info);outlet.append(hero);const tabs=e('nav','bt-tabs');const base=`https://space.bilibili.com/${data.mid||p.mid||''}`;for(const [label,href] of [['主页',base],['视频',`${base}/upload`],['动态',`${base}/dynamic`],['合集',`${base}/lists`],['收藏',`${base}/favlist`]]){const active=(data.route==='space-home'&&label==='主页')||(data.route==='space-upload'&&label==='视频');const a=e('a',`bt-tab${active?' is-active':''}`,label);bindLink(a,href,callbacks);tabs.append(a);}outlet.append(tabs);if(data.error)outlet.append(e('div','bt-inline-notice',data.error));renderGrid(outlet,data.videos||[],callbacks,{loading:Boolean(data.loading),count:8});if(data.route==='space-upload')outlet.append(feedSentinel('space',Boolean(data.loading),data.hasMore));}
  return { e, icon, createDialog, createTopbar, updateTopbar, createSidebar, createSidebarDrawer, updateChrome, createCard, renderHome, renderHistory, renderSearch, renderDynamic, renderWatchLater, renderFavorites, renderSpace };
});
