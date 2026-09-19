(() => {
  'use strict';
  const defaults = {
    enabled:true, theme:'system', sidebarCollapsed:false, showSubscriptions:true,
    homeFollowedShelf:true, homeLiveShelf:true, homeBangumiShelf:true, homePopularShelf:true,
    hoverPreview:true, hoverPreviewDelay:500, watchLaterQuick:true, searchSuggestions:true, hideAds:true,
  };
  const ids = ['enabled','theme','sidebarCollapsed','showSubscriptions','homeFollowedShelf','homeLiveShelf','homeBangumiShelf','homePopularShelf','hoverPreview','hoverPreviewDelay','watchLaterQuick','searchSuggestions','hideAds'];
  const checkboxIds = new Set(['enabled','sidebarCollapsed','showSubscriptions','homeFollowedShelf','homeLiveShelf','homeBangumiShelf','homePopularShelf','hoverPreview','watchLaterQuick','searchSuggestions','hideAds']);
  const status = document.getElementById('status');
  function apply(settings) {
    for (const id of ids) {
      const node=document.getElementById(id); if(!node) continue;
      if(checkboxIds.has(id)) node.checked=Boolean(settings[id]);
      else node.value=String(settings[id] ?? defaults[id]);
    }
  }
  function save() {
    const settings={};
    for(const id of ids){const node=document.getElementById(id);if(!node)continue;settings[id]=checkboxIds.has(id)?node.checked:(id==='hoverPreviewDelay'?Number(node.value):node.value);}
    chrome.storage.local.set({ bilitubeCoreSettings: settings }, () => {
      status.textContent = chrome.runtime.lastError ? '保存失败' : '已保存，已打开的 Bilibili 页面会同步更新';
      setTimeout(() => { status.textContent = ''; }, 1800);
    });
  }
  chrome.storage.local.get(['bilitubeCoreSettings'], (result) => apply({ ...defaults, ...(result.bilitubeCoreSettings || {}) }));
  for (const id of ids) document.getElementById(id).addEventListener('change', save);

  const navLinks = Array.from(document.querySelectorAll('.settings-nav a[href^="#"]'));
  const navSections = navLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  function syncNav() {
    if (!navLinks.length) return;
    const y = window.scrollY + 100;
    let active = navSections[0] || null;
    for (const section of navSections) if (section.offsetTop <= y) active = section;
    navLinks.forEach(link => link.classList.toggle('is-active', active && link.getAttribute('href') === `#${active.id}`));
  }
  window.addEventListener('scroll', syncNav, { passive:true });
  navLinks.forEach(link => link.addEventListener('click', () => setTimeout(syncNav, 0)));
  syncNav();
})();
