const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('global chrome uses the YouTube desktop geometry baseline', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /--bt-topbar-h\s*:\s*56px/);
  assert.match(css, /--bt-sidebar-w\s*:\s*240px/);
  assert.match(css, /--bt-sidebar-compact-w\s*:\s*72px/);
  assert.match(css, /--bt-media-radius\s*:\s*12px/);
  assert.match(css, /\.bt-sidebar\{[^}]*width:var\(--bt-sidebar-w\)/s);
  assert.match(css, /\.bt-sidebar\.is-collapsed\{[^}]*width:var\(--bt-sidebar-compact-w\)/s);
  assert.match(css, /\.bt-sidebar-drawer\{[^}]*width:var\(--bt-sidebar-w\)/s);
});

test('video cards preserve YouTube-like media and quick watch later affordance', () => {
  const ui = read('src/core/ui.js');
  const css = read('src/styles/core.css');
  assert.match(ui, /bt-watchlater-quick/);
  assert.match(ui, /bt-card-media/);
  assert.match(css, /\.bt-thumb\{[^}]*aspect-ratio\s*:\s*16\s*\/\s*9/s);
  assert.match(css, /\.bt-thumb\{[^}]*border-radius\s*:\s*var\(--bt-media-radius\)/s);
  assert.match(css, /\.bt-card-title\{[^}]*-webkit-line-clamp\s*:\s*2/s);
  assert.match(css, /\.bt-preview-layer\{[^}]*pointer-events\s*:\s*none/s);
});

test('hover watch-later preserves the click event after pointer press', () => {
  const ui = read('src/core/ui.js');
  assert.match(ui, /const stopPointer=\(ev\)=>\{ev\.stopPropagation\(\);\}/);
  assert.match(ui, /button\.addEventListener\('pointerdown',stopPointer\);button\.addEventListener\('click',handleClick\)/);
  assert.match(ui, /const handleClick=async\(ev\)=>\{ev\.preventDefault\(\);ev\.stopPropagation\(\)/);
  assert.doesNotMatch(ui, /addEventListener\('pointerdown',[^;]+preventDefault\(\)/);
});

test('watch surface defines a YouTube-like native two-column composition', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /--bt-watch-related-w\s*:\s*402px/);
  assert.match(css, /\.bt-watch-native-layout/);
  assert.match(css, /grid-template-columns\s*:\s*minmax\(0,1fr\)\s+minmax\(320px,var\(--bt-watch-related-w\)\)/);
  assert.match(css, /\.bt-native-watch-player-host/);
  assert.match(css, /\.bt-native-watch-description/);
});

test('search, channel, history, and library keep dedicated YouTube-like surfaces', () => {
  const css = read('src/styles/core.css');
  for (const selector of ['.bt-search-row','.bt-channel-hero','.bt-history-layout','.bt-library-layout','.bt-favorites-layout']) {
    assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
});

test('sidebar group dividers and closed drawer hit testing match YouTube behavior', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /\.bt-side-section\+\.bt-side-section\{[^}]*border-top\s*:\s*1px solid var\(--bt-border\)/s);
  assert.match(css, /\.bt-sidebar-drawer-backdrop\{[^}]*pointer-events\s*:\s*none/s);
  assert.match(css, /\.bt-sidebar-drawer-backdrop\.is-open\{[^}]*pointer-events\s*:\s*auto/s);
});

test('settings page uses a YouTube-like two-column settings composition with grouped navigation', () => {
  const html = read('src/options/options.html');
  const css = read('src/options/options.css');
  assert.match(html, /class="settings-shell"/);
  assert.match(html, /class="settings-nav"/);
  for (const id of ['appearance','home','playback','search']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(css, /\.settings-shell\{[^}]*grid-template-columns\s*:\s*240px minmax\(0,1fr\)/s);
  assert.match(css, /\.settings-nav\{[^}]*position\s*:\s*sticky/s);
  assert.match(css, /\.settings-nav a\.is-active/);
});

test('all principal replacement pages retain explicit YouTube-like composition primitives', () => {
  const ui = read('src/core/ui.js');
  const css = read('src/styles/core.css');
  for (const token of ['bt-chip-row','bt-home-shelf','bt-search-channel','bt-search-row','bt-channel-hero','bt-tabs','bt-history-layout','bt-history-tools','bt-library-layout','bt-favorites-layout','bt-subscriptions-heading']) {
    assert.match(ui + css, new RegExp(token));
  }
});

test('adapt and watch pages use the same topbar and overlay drawer components as replacement pages', () => {
  const watch = read('src/core/watch.js');
  const adapter = read('src/core/native-adapter.js');
  assert.match(watch, /UI\.createTopbar/);
  assert.match(watch, /UI\.createSidebarDrawer/);
  assert.match(adapter, /UI\.createTopbar/);
  assert.match(adapter, /UI\.createSidebarDrawer/);
});

test('topbar mirrors YouTube desktop action hierarchy with dynamic, notification, and avatar controls', () => {
  const ui = read('src/core/ui.js');
  const css = read('src/styles/core.css');
  assert.match(ui, /bt-create-button/);
  assert.match(ui, /'动态','dynamic'/);
  assert.match(ui, /https:\/\/t\.bilibili\.com\//);
  assert.match(ui, /bt-notification-button/);
  assert.match(ui, /'消息','bell'/);
  assert.match(css, /\.bt-create-button\{/);
  assert.match(css, /\.bt-notification-button/);
});

test('topbar keeps a direct YouTube style switch entry', () => {
  const ui = read('src/core/ui.js');
  const options = read('src/options/options.html');
  const css = read('src/styles/core.css');
  assert.match(ui, /bt-style-button/);
  assert.match(ui, /切换到原版 YouTube Desktop 风格/);
  assert.match(ui, /callbacks\.toggleVisualStyle/);
  assert.match(options, /id="glassMode"/);
  assert.match(options, /毛玻璃界面/);
  assert.match(css, /html\.bt-glass-mode \.bt-topbar/);
});

test('compact sidebar uses YouTube mini-guide labels instead of icon-only ambiguity', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /\.bt-sidebar\.is-collapsed \.bt-nav-item\{[^}]*flex-direction:column/s);
  assert.match(css, /\.bt-sidebar\.is-collapsed \.bt-nav-item>span\.bt-nav-label/);
  assert.doesNotMatch(css, /\.bt-sidebar\.is-collapsed \.bt-nav-item>span\.bt-nav-label[^}]*display:none/s);
});

test('watch-later state synchronizes every matching card button after one toggle', () => {
  const ui = read('src/core/ui.js');
  const app = read('src/core/app.js');
  assert.match(ui, /button\.dataset\.bvid/);
  assert.match(ui, /button\.dataset\.aid/);
  assert.match(app, /function syncWatchLaterButtons/);
  assert.match(app, /querySelectorAll\('\.bt-watchlater-quick/);
  assert.match(app, /syncWatchLaterButtons\(item,next\)/);
});

test('the desktop baseline is declared once and never overridden by a restyle pass', () => {
  const css = read('src/styles/core.css');
  // A later :root block that redeclares these tokens silently moves the whole
  // layout away from the YouTube baseline while the tests above still pass.
  assert.deepEqual([...css.matchAll(/--bt-media-radius\s*:\s*([^;}]+)/g)].map(match => match[1].trim()), ['12px']);
  assert.match(css, /\.bt-card-avatar\{[^}]*width:36px/s);
  assert.match(css, /\.bt-chip\{[^}]*border-radius:8px/s);
  // Chips stay 8px rectangles; a pill radius would be a different design system.
  for (const block of css.match(/\.[^{}]*bt-chip[^{}]*\{[^}]*\}/g) || []) {
    assert.doesNotMatch(block, /border-radius:\s*999px/, block.slice(0, 48));
  }
});

test('the guide expands by animating its track instead of snapping', () => {
  const css = read('src/styles/core.css');
  // The track and the guide element move together, so the content column slides.
  assert.match(css, /\.bt-body\{transition:grid-template-columns \.2s/s);
  assert.match(css, /\.bt-sidebar\{transition:width \.2s/s);
  assert.match(css, /\.bt-sidebar-drawer\{transition:transform \.2s/s);
  // A style-switch opacity fade must never take over those shorthands again;
  // that is what silently disabled the collapse animation.
  assert.doesNotMatch(css, /:is\(\.bt-topbar,\.bt-sidebar,\.bt-sidebar-drawer,\.bt-chip-row\)\{transition:opacity/);
  // Restoring a saved collapsed state on mount stays instant instead of
  // playing the collapse on every page load.
  assert.match(css, /\.bt-root\.is-layout-instant/);
  assert.match(read('src/core/app.js'), /shell\.setCollapsed\(settings\.sidebarCollapsed,\{instant:true\}\)/);
});
