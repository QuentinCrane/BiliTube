const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('ordinary BiliTube anchors keep native browser navigation and are never prevented by bindLink', () => {
  const ui = read('src/core/ui.js');
  const m = ui.match(/function bindLink\(node,href,callbacks\)\{([\s\S]*?)\}\n\s*function avatar/);
  assert.ok(m, 'bindLink helper should exist');
  assert.doesNotMatch(m[1], /preventDefault\(/);
  assert.doesNotMatch(m[1], /callbacks\.navigate/);
  assert.match(m[1], /node\.href=href/);
});

test('topbar and sidebar anchors do not depend on the MAIN-world navigation bridge', () => {
  const ui = read('src/core/ui.js');
  const navLine = ui.split('\n').find(line => line.includes('function navLink(')) || '';
  const brandLine = ui.split('\n').find(line => line.includes('function brand(')) || '';
  assert.ok(navLine, 'navLink should exist');
  assert.ok(brandLine, 'brand should exist');
  assert.doesNotMatch(navLine, /preventDefault\(/);
  assert.doesNotMatch(brandLine, /preventDefault\(/);
  assert.doesNotMatch(ui, /account\.addEventListener\('click',[^\n]*preventDefault/);
  assert.doesNotMatch(ui, /bt-sub-item[^\n]*addEventListener\('click',[^\n]*preventDefault/);
});

test('watch keeps Bilibili recommendation business DOM in its original column', () => {
  const watch = read('src/core/watch.js');
  assert.match(watch, /bt-native-watch-related/);
  assert.doesNotMatch(watch, /bt-watch-related-column|append\([^)]*related|appendChild\([^)]*related/);
});

test('watch may restyle native toolbar geometry but never disables native hit testing', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /\.bt-native-watch-toolbar/);
  assert.doesNotMatch(css, /\.bt-native-watch-toolbar[^}]*pointer-events\s*:\s*none/is);
  assert.doesNotMatch(css, /\.bt-native-watch-toolbar[^}]*visibility\s*:\s*hidden/is);
});

test('watch keeps native title creator and toolbar visible instead of hiding duplicate metadata', () => {
  const watch = read('src/core/watch.js');
  const css = read('src/styles/core.css');
  assert.match(watch, /bt-native-watch-info/);
  assert.match(watch, /bt-native-watch-up/);
  assert.match(watch, /bt-native-watch-toolbar/);
  assert.doesNotMatch(watch, /bt-watch-hide-native-meta/);
  assert.doesNotMatch(css, /bt-watch-hide-native-meta/);
});

test('preview overlay lets normal thumbnail clicks pass through except the scrubber itself', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /\.bt-preview-layer\{[^}]*pointer-events:none/);
  assert.match(css, /\.bt-preview-progress\{[^}]*pointer-events:auto/);
});

test('watch styles the marked native toolbar only and leaves raw Bilibili toolbar hit testing unforced', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /\.bt-native-watch-toolbar/);
  assert.doesNotMatch(css, /\.video-toolbar-container[^}]*pointer-events\s*:\s*(?:none|auto)!important/is);
});

