const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('manifest declares the default locale and loads the shared i18n runtime first', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.default_locale, 'zh_CN');
  const content = manifest.content_scripts.find(entry => Array.isArray(entry.js) && entry.js.includes('src/core/app.js'));
  assert.ok(content);
  assert.equal(content.js[0], 'src/core/i18n.js');
  assert.match(read('src/options/options.html'), /\.\.\/core\/i18n\.js/);
});

test('Chinese and English locale catalogs contain the same messages', () => {
  const zh = JSON.parse(read('_locales/zh_CN/messages.json'));
  const en = JSON.parse(read('_locales/en/messages.json'));
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const catalog of [zh, en]) {
    for (const [key, value] of Object.entries(catalog)) {
      assert.equal(typeof value.message, 'string', `${key} must define a message`);
      assert.ok(value.message.length > 0, `${key} must not be empty`);
    }
  }
});

test('README presents the extension icon from the tracked assets directory', () => {
  assert.ok(fs.existsSync(path.join(root, 'assets/icon.svg')));
  assert.match(read('README.md'), /assets\/icon\.svg/);
});
