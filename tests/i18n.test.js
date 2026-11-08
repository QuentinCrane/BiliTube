const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const catalogs = () => ({
  zh: JSON.parse(read('_locales/zh_CN/messages.json')),
  en: JSON.parse(read('_locales/en/messages.json')),
});

function sourceFiles(dir = 'src') {
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(relative));
    else if (/\.(js|html)$/.test(entry.name)) out.push(relative);
  }
  return out;
}

// 代码里所有会走 chrome.i18n 的键：T('key') / t('key') / data-i18n / data-i18n-attr
function referencedKeys() {
  const keys = new Map();
  const add = (key, file) => keys.set(key, [...(keys.get(key) || []), file]);
  for (const file of sourceFiles()) {
    const code = read(file);
    for (const match of code.matchAll(/\b[Tt]\(\s*'([A-Za-z0-9_]+)'/g)) add(match[1], file);
    for (const match of code.matchAll(/data-i18n="([A-Za-z0-9_]+)"/g)) add(match[1], file);
    for (const match of code.matchAll(/data-i18n-attr="([^"]*)"/g)) {
      for (const definition of match[1].split(';')) {
        const separator = definition.indexOf(':');
        if (separator > 0) add(definition.slice(separator + 1).trim(), file);
      }
    }
  }
  return keys;
}

test('manifest declares the default locale and loads the shared i18n runtime first', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.default_locale, 'zh_CN');
  const content = manifest.content_scripts.find(entry => Array.isArray(entry.js) && entry.js.includes('src/core/app.js'));
  assert.ok(content);
  assert.equal(content.js[0], 'src/core/i18n.js');
  assert.match(read('src/options/options.html'), /\.\.\/core\/i18n\.js/);
});

test('Chinese and English locale catalogs contain the same messages', () => {
  const { zh, en } = catalogs();
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const catalog of [zh, en]) {
    for (const [key, value] of Object.entries(catalog)) {
      assert.equal(typeof value.message, 'string', `${key} must define a message`);
      assert.ok(value.message.length > 0, `${key} must not be empty`);
    }
  }
});

test('every message key referenced by the source exists in both catalogs', () => {
  const { zh, en } = catalogs();
  for (const [key, files] of referencedKeys()) {
    assert.ok(zh[key], `${key} is used by ${files.join(', ')} but missing from zh_CN`);
    assert.ok(en[key], `${key} is used by ${files.join(', ')} but missing from en`);
  }
});

test('the English catalog is fully translated and keeps placeholder parity with Chinese', () => {
  const { zh, en } = catalogs();
  for (const [key, value] of Object.entries(en)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(value.message), `${key} still contains Chinese text: ${value.message}`);
    const zhPlaceholders = Object.keys((zh[key] && zh[key].placeholders) || {}).map(name => name.toLowerCase()).sort();
    const enPlaceholders = Object.keys(value.placeholders || {}).map(name => name.toLowerCase()).sort();
    assert.deepEqual(enPlaceholders, zhPlaceholders, `${key} declares different placeholders across locales`);
  }
});

test('count-based English messages ship a singular variant', () => {
  const { zh, en } = catalogs();
  const pluralKeys = [
    'minutes_ago', 'hours_ago', 'days_ago', 'months_ago', 'years_ago',
    'video_count', 'favorite_video_count', 'watch_later_summary',
    'loaded_result_count', 'loaded_video_count', 'loaded_update_count',
  ];
  for (const key of pluralKeys) {
    assert.ok(en[`${key}_one`], `${key} needs an English singular variant to avoid "1 videos"`);
    assert.ok(zh[`${key}_one`], `${key} needs a zh_CN singular variant so both catalogs stay in sync`);
    assert.notEqual(en[`${key}_one`].message, en[key].message, `${key}_one must differ from ${key} in English`);
  }
});

test('the runtime prefers the singular variant only when the count is one', () => {
  const seen = [];
  global.chrome = {
    i18n: {
      getUILanguage: () => 'en-US',
      getMessage: (key) => {
        seen.push(key);
        return key.endsWith('_one') ? 'SINGULAR' : 'PLURAL';
      },
    },
  };
  const i18nPath = require.resolve('../src/core/i18n.js');
  delete require.cache[i18nPath];
  const i18n = require(i18nPath);
  try {
    assert.equal(i18n.t('minutes_ago', '', [1]), 'SINGULAR');
    assert.equal(i18n.t('minutes_ago', '', [2]), 'PLURAL');
    assert.equal(i18n.t('minutes_ago', '', ['1']), 'SINGULAR');
    assert.equal(i18n.t('no_results', 'no results'), 'PLURAL');
    assert.deepEqual(seen.slice(0, 2), ['minutes_ago_one', 'minutes_ago']);
  } finally {
    delete global.chrome;
    delete globalThis.BiliTubeI18n;
    delete require.cache[i18nPath];
  }
});

test('compact numbers follow the UI language instead of mixing 万 with K', () => {
  const dataPath = require.resolve('../src/core/data.js');
  const previous = globalThis.BiliTubeI18n;
  delete require.cache[dataPath];
  try {
    globalThis.BiliTubeI18n = { t: (key, fallback) => fallback, getUILanguage: () => 'en-US' };
    const en = require(dataPath);
    assert.equal(en.compactNumber(999), '999');
    assert.equal(en.compactNumber(12345), '12.3K');
    assert.equal(en.compactNumber(1234567), '1.2M');
    assert.equal(en.compactNumber(1500000000), '1.5B');

    globalThis.BiliTubeI18n = { t: (key, fallback) => fallback, getUILanguage: () => 'zh-CN' };
    const zh = require(dataPath);
    assert.equal(zh.compactNumber(12000), '1.2万');
    assert.equal(zh.compactNumber(120000000), '1.2亿');
  } finally {
    globalThis.BiliTubeI18n = previous;
    delete require.cache[dataPath];
  }
});

test('README presents the extension icon from the tracked assets directory', () => {
  assert.ok(fs.existsSync(path.join(root, 'assets/icon.svg')));
  assert.match(read('README.md'), /assets\/icon\.svg/);
});
