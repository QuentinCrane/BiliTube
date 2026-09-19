const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('core implementation has no native-region/player handoff architecture', () => {
  const files = ['src/core/native-visibility.js','src/core/shell.js','src/core/ui.js','src/core/watch.js','src/core/app.js'];
  const combined = files.map(read).join('\n');
  assert.doesNotMatch(combined, /bilitube-player-slot|handoffNative|moveElement\s*\(|slot\.appendChild\s*\(\s*player|appendChild\s*\(\s*player/);
});

test('semantic theme tokens are defined', () => {
  const css = read('src/styles/core.css');
  for (const token of ['--bt-bg','--bt-surface','--bt-surface-hover','--bt-text-primary','--bt-text-secondary','--bt-border','--bt-chip','--bt-accent']) {
    assert.match(css, new RegExp(token.replace('--','\\-\\-')));
  }
});

test('visibility guard records and restores native children instead of moving them', () => {
  const src = read('src/core/native-visibility.js');
  assert.match(src, /restore/);
  assert.doesNotMatch(src, /appendChild|insertBefore|replaceChild/);
});


test('visibility guard also isolates native children appended after SPA updates', () => {
  const src = read('src/core/native-visibility.js');
  assert.match(src, /MutationObserver/);
  assert.match(src, /observer\.disconnect/);
});


test('visibility guard preserves pre-existing visibility state as well as display', () => {
  const src = read('src/core/native-visibility.js');
  assert.match(src, /visibility:/);
  assert.match(src, /visibilityPriority/);
  assert.match(src, /removeProperty\(['"]visibility['"]\)/);
});
