import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const pass = (message) => console.log(`PASS: ${message}`);
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const manifest = JSON.parse(read('manifest.json'));
if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
else pass('Manifest V3');

const refs = new Set();
for (const script of manifest.content_scripts || []) {
  for (const rel of script.js || []) refs.add(rel);
  for (const rel of script.css || []) refs.add(rel);
}
if (manifest.options_page) refs.add(manifest.options_page);
if (manifest.background?.service_worker) refs.add(manifest.background.service_worker);
for (const rel of Object.values(manifest.icons || {})) refs.add(rel);
for (const rel of refs) {
  if (!fs.existsSync(path.join(root, rel))) fail(`missing manifest resource: ${rel}`);
}
if (!process.exitCode) pass(`${refs.size} manifest resources exist`);

const backgroundText = read(manifest.background.service_worker);
for (const match of backgroundText.matchAll(/importScripts\(['"]([^'"]+)['"]\)/g)) {
  const imported = path.join(path.dirname(manifest.background.service_worker), match[1]);
  if (!fs.existsSync(path.join(root, imported))) fail(`missing background import: ${imported}`);
}
if (!process.exitCode) pass('background importScripts resources exist');

const jsFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) jsFiles.push(full);
  }
}
walk(path.join(root, 'src'));
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) fail(`syntax error in ${path.relative(root, file)}\n${result.stderr}`);
}
if (!process.exitCode) pass(`${jsFiles.length} JavaScript files pass node --check`);

const coreFiles = [
  'src/core/native-visibility.js', 'src/core/native-adapter.js', 'src/core/shell.js', 'src/core/ui.js',
  'src/core/watch.js', 'src/core/app.js'
];
const core = coreFiles.map(read).join('\n');
const forbidden = [
  /bilitube-player-slot/i,
  /handoffNative/,
  /slot\.appendChild\s*\(\s*player/,
  /appendChild\s*\(\s*player/,
  /replaceWith\s*\(\s*player/,
];
for (const pattern of forbidden) if (pattern.test(core)) fail(`forbidden handoff pattern: ${pattern}`);
if (!process.exitCode) pass('no legacy player/native-region handoff patterns');

const css = read('src/styles/core.css');
for (const token of ['--bt-bg','--bt-surface','--bt-surface-hover','--bt-text-primary','--bt-text-secondary','--bt-border','--bt-chip','--bt-accent']) {
  if (!css.includes(token)) fail(`missing theme token ${token}`);
}
if (!process.exitCode) pass('semantic theme token set is complete');

const policy = read('src/core/policy.js');
if (!policy.includes("strategy: 'decorate'") || !policy.includes("strategy: 'adapt'") || !policy.includes("strategy: 'passthrough'")) fail('route policy lacks explicit decorate/adapt/passthrough strategies');
else pass('route policy contains explicit safety strategies');

if (process.exitCode) process.exit(process.exitCode);
console.log('Verification complete.');
