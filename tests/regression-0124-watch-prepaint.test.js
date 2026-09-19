const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('document-start preflight marks ordinary video pages before Watch runtime mount', () => {
  const preflight = read('src/page/preflight.js');
  assert.match(preflight, /const\s+watch\s*=\s*[^;]*\^\\\/video\\\//);
  assert.match(preflight, /classList\.add\(['"]bilitube-watch-preflight['"]\)/);
  assert.match(preflight, /saved\.enabled\s*===\s*false[\s\S]*classList\.remove\(['"]bilitube-watch-preflight['"]\)/);
});

test('Watch preflight reserves the final two-column geometry before native content paints', () => {
  const css = read('src/styles/preflight.css');
  assert.match(css, /html\.bilitube-watch-preflight\s+body\{[^}]*padding-top\s*:\s*var\(--bt-topbar-h,\s*56px\)!important/s);
  assert.match(css, /html\.bilitube-watch-preflight\s+:is\([^)]*\.video-container-v1[^)]*\)\{[^}]*display\s*:\s*grid!important[^}]*grid-template-columns\s*:\s*minmax\(0,1fr\)\s+minmax\(320px,var\(--bt-watch-related-w,\s*402px\)\)/s);
  assert.match(css, /html\.bilitube-watch-preflight\s+:is\([^)]*\.left-container[^)]*\)\{[^}]*display\s*:\s*flex!important[^}]*flex-direction\s*:\s*column!important/s);
  assert.match(css, /html\.bilitube-watch-preflight\s+:is\([^)]*#playerWrap[^)]*\)\{[^}]*order\s*:\s*0!important[^}]*aspect-ratio\s*:\s*16\s*\/\s*9!important/s);
  assert.match(css, /html\.bilitube-watch-preflight\s+:is\([^)]*\.video-info-container[^)]*#viewbox_report[^)]*\)\{[^}]*order\s*:\s*1!important/s);
});

test('Watch runtime swaps preflight for ready without a second page-geometry phase', () => {
  const watch = read('src/core/watch.js');
  assert.match(watch, /classList\.add\(['"]bt-watch-decorated['"],['"]bt-watch-ready['"]\)/);
  assert.match(watch, /classList\.remove\(['"]bilitube-watch-preflight['"]\)/);
});

test('native title/info box is collapsed to content height and author row stays tight', () => {
  const css = read('src/styles/core.css');
  assert.match(css, /\.bt-native-watch-info\{[^}]*height\s*:\s*auto!important[^}]*min-height\s*:\s*0!important[^}]*max-height\s*:\s*none!important/s);
  assert.match(css, /\.bt-native-watch-info\{[^}]*margin\s*:\s*0 0 4px!important/s);
});


test('Watch preflight executes before the heavier core modules at document_start', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const isolated = manifest.content_scripts.find(entry => Array.isArray(entry.js) && entry.js.includes('src/core/app.js'));
  assert.ok(isolated, 'isolated-world content script missing');
  assert.equal(isolated.run_at, 'document_start');
  assert.ok(isolated.js.indexOf('src/page/preflight.js') < isolated.js.indexOf('src/core/policy.js'));
  assert.ok(isolated.js.indexOf('src/page/preflight.js') < isolated.js.indexOf('src/core/watch.js'));
});
