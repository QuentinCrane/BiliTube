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
  const css = read('src/styles/core.css');
  assert.match(css, /html\.bilitube-watch-preflight\s+body,\s*html\.bt-watch-decorated\s+body\{[^}]*padding-top:var\(--bt-topbar-h\)!important/s);
  assert.match(css, /html\.bilitube-watch-preflight\s+:where\([^)]*\.video-container-v1[^)]*\),\s*\.bt-watch-native-layout\{[^}]*display:grid!important[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(320px,var\(--bt-watch-related-w\)\)/s);
  assert.match(css, /html\.bilitube-watch-preflight\s+:where\([^)]*\.left-container[^)]*\),\s*\.bt-native-watch-main\{[^}]*display:flex!important[^}]*flex-direction:column!important/s);
  assert.match(css, /html\.bilitube-watch-preflight\s+:where\([^)]*#playerWrap[^)]*\),\s*\.bt-native-watch-player-host\{[^}]*order:0!important[^}]*aspect-ratio:16 \/ 9!important/s);
  assert.match(css, /html\.bilitube-watch-preflight\s+:where\([^)]*#viewbox_report[^)]*\),\s*\.bt-native-watch-info\{[^}]*order:1!important/s);
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
