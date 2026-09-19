const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('manifest loads core modules in dependency order and main-world bridge', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  const mainWorld = manifest.content_scripts.find(x => x.world === 'MAIN');
  assert.ok(mainWorld.js.includes('src/page/bridge.js'));
  const isolated = manifest.content_scripts.find(x => !x.world && x.js && x.js.includes('src/core/app.js'));
  const order = isolated.js;
  assert.ok(order.indexOf('src/core/policy.js') < order.indexOf('src/core/app.js'));
  assert.ok(order.indexOf('src/core/watch.js') < order.indexOf('src/core/app.js'));
  assert.ok(order.indexOf('src/core/native-adapter.js') < order.indexOf('src/core/app.js'));
  assert.ok(order.indexOf('src/page/preflight.js') < order.indexOf('src/core/app.js'));
});

test('app guarantees passthrough cleanup and theme-only updates', () => {
  const src = read('src/core/app.js');
  assert.match(src, /strategy\s*===\s*['"]passthrough['"]/);
  assert.match(src, /guard\.restore\(\)/);
  assert.match(src, /updateTheme/);
  assert.match(src, /AbortController|generation/);
});

test('preflight only targets replace routes, not watch', () => {
  const src = read('src/page/preflight.js');
  assert.match(src, /replace/);
  assert.doesNotMatch(src, /\/video\//);
});


test('preflight applies saved theme token before the full shell mounts', () => {
  const src = read('src/page/preflight.js');
  assert.match(src, /chrome\.storage\.local\.get/);
  assert.match(src, /data-bt-theme|dataset\.btTheme/);
});


test('replace-route mount has a hard native fallback on runtime exceptions', () => {
  const src = read('src/core/app.js');
  assert.match(src, /catch\s*\([^)]*\)\s*\{[^}]*restoreNativePage\(\)/s);
});


test('main-world bridge has a route change fallback beyond history wrappers', () => {
  const src = read('src/page/bridge.js');
  assert.match(src, /lastHref/);
  assert.match(src, /setInterval|navigation\.addEventListener/);
});

test('manifest routes API work through an extension background service worker', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.background && manifest.background.service_worker, 'src/background.js');
  const isolated = manifest.content_scripts.find(x => !x.world && x.js && x.js.includes('src/core/app.js'));
  assert.ok(isolated.js.includes('src/core/api-client.js'));
  assert.ok(isolated.js.indexOf('src/core/api-client.js') < isolated.js.indexOf('src/core/app.js'));
});

test('content API client uses runtime messaging instead of page-world fetch', () => {
  const src = read('src/core/api-client.js');
  assert.match(src, /chrome\.runtime\.sendMessage/);
  assert.match(src, /bilitube-api/);
  const bridge = read('src/page/bridge.js');
  assert.doesNotMatch(bridge, /requestDynamic\(|requestWatchLater\(|requestFavorites\(/);
});
