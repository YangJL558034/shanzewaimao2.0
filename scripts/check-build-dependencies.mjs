import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { patchBraces, fingerprint } from './patch-build-dependencies.mjs';

const require = createRequire(import.meta.url);
const directory = path.dirname(require.resolve('braces/package.json'));
await patchBraces(directory, { check: true });
const braces = require('braces');
let assertions = 0;
const safeReject = fn => {
  assert.throws(fn, error => error instanceof RangeError && /local build safety limit/.test(error.message));
  assertions++;
};

// The parser rejects before recursive walkers can reach the JS stack limit.
for (const [open, close] of [['{', '}'], ['(', ')'], ['{(', ')}']]) {
  for (const closing of [true, false]) {
    const value = open.repeat(2000) + 'x' + (closing ? close.repeat(2000) : '');
    for (const method of ['parse', 'compile', 'expand', 'stringify']) safeReject(() => braces[method](value));
  }
}
safeReject(() => braces.parse('{'.repeat(128) + 'a' + '}'.repeat(128)));
assert.equal(braces.stringify('('.repeat(127) + 'x' + ')'.repeat(127)), '('.repeat(127) + 'x' + ')'.repeat(127));
assert.equal(braces.stringify('\\{'.repeat(5000)), '{'.repeat(5000));
assert.equal(braces.stringify('"' + '{'.repeat(5000) + '"'), '{'.repeat(5000));
assert.equal(braces.stringify('[[' + '{'.repeat(5000) + ']]'), '[[' + '{'.repeat(5000) + ']]');
assertions += 4;

for (const method of ['compile', 'expand', 'stringify']) {
  const ast = { type: 'root', nodes: [] };
  let node = ast;
  for (let i = 0; i < 200; i++) {
    const child = { type: 'root', nodes: [], parent: node };
    node.nodes.push(child);
    node = child;
  }
  node.nodes.push({ type: 'text', value: 'x' });
  safeReject(() => braces[method](ast));
  const cycle = { type: 'root', nodes: [] };
  cycle.nodes.push(cycle);
  safeReject(() => braces[method](cycle));
}
const parentCycle = { type: 'paren', nodes: [{ type: 'text', value: 'x' }] };
parentCycle.parent = parentCycle;
safeReject(() => braces.expand(parentCycle));

assert.deepEqual(braces.expand('app/{admin,api}/page.{ts,tsx}'), ['app/admin/page.ts', 'app/admin/page.tsx', 'app/api/page.ts', 'app/api/page.tsx']);
assert.deepEqual(braces.expand('image-{01..03}.webp'), ['image-01.webp', 'image-02.webp', 'image-03.webp']);
assert.deepEqual(braces.expand('item-{a..e..2}'), ['item-a', 'item-c', 'item-e']);
assert.equal(braces.compile('a/{b,c}/d'), 'a/(b|c)/d');
assert.equal(braces.stringify(braces.parse('a/{b,{c,d}}/e')), 'a/{b,{c,d}}/e');
assert.equal(braces.stringify('a/{b,c'), 'a/{b,c');
assert.deepEqual(braces.expand('a/\\{b,c\\}'), ['a/{b,c}']);
assertions += 7;

const micromatch = require('micromatch');
assert.deepEqual(micromatch(['app/admin/page.tsx', 'components/a.ts', 'public/test.webp'], '{app,components}/**/*.{ts,tsx}'), ['app/admin/page.tsx', 'components/a.ts']);
assert.deepEqual(micromatch.braces('{app,components}/**/*.{ts,tsx}', { expand: true }), ['app/**/*.ts', 'app/**/*.tsx', 'components/**/*.ts', 'components/**/*.tsx']);
assertions += 2;

// Real Tailwind/PostCSS compilation exercises the dependency chain. Keep the
// compiler isolated so a regression cannot exhaust this test runner's stack.
const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
  import assert from 'node:assert/strict';
  import postcss from 'postcss';
  import tailwind from 'tailwindcss';
  const result = await postcss([tailwind({ content: [{ raw: '<div class="flex p-4 text-blue-600 md:grid-cols-4"></div>' }], corePlugins: { preflight: false } })]).process('@tailwind utilities;', { from: undefined });
  for (const rule of ['.flex', '.p-4', '.text-blue-600', '.md\\\\:grid-cols-4']) assert.ok(result.css.includes(rule), rule);
`], { cwd: path.resolve(directory, '../..'), encoding: 'utf8', timeout: 30000 });
assert.equal(result.status, 0, result.stderr || result.error?.message);
assertions++;

// Verify idempotence, LF/CRLF portability, version pinning and fail-closed
// validation on an isolated fixture, never corrupt the installed dependency.
const fixture = await mkdtemp(path.join(os.tmpdir(), 'shanze-braces-guard-'));
try {
  await mkdir(path.join(fixture, 'lib'));
  await cp(path.join(directory, 'package.json'), path.join(fixture, 'package.json'));
  for (const name of ['parse.js', 'compile.js', 'expand.js', 'stringify.js']) {
    const text = await readFile(path.join(directory, 'lib', name), 'utf8');
    await writeFile(path.join(fixture, 'lib', name), text.replace(/\r?\n/g, '\r\n'));
  }
  assert.deepEqual(await patchBraces(fixture), { checked: 4, patched: 0 });
  assert.deepEqual(await patchBraces(fixture, { check: true }), { checked: 4, patched: 0 });
  const parseFile = path.join(fixture, 'lib', 'parse.js');
  const installedParse = (await readFile(parseFile, 'utf8')).replace(/\r\n/g, '\n');
  const originalParse = installedParse.split("      // Local GHSA-vfj7-8cjw-p6xm mitigation; count the root in AST depth.\n      if (stack.length >= 128) throw new RangeError('braces nesting exceeds the local build safety limit (128)');\n").join('');
  assert.notEqual(fingerprint(originalParse), fingerprint(installedParse));
  await writeFile(parseFile, originalParse);
  await assert.rejects(patchBraces(fixture, { check: true }), /mitigation missing/);
  const stringifyFile = path.join(fixture, 'lib', 'stringify.js');
  const installedStringify = await readFile(stringifyFile, 'utf8');
  await writeFile(stringifyFile, installedStringify + '\n// unexpected source modification\n');
  await assert.rejects(patchBraces(fixture), /Unknown braces source checksum/);
  assert.equal(await readFile(parseFile, 'utf8'), originalParse, 'All files must be validated before any file is changed');
  await writeFile(stringifyFile, installedStringify);
  assert.deepEqual(await patchBraces(fixture), { checked: 4, patched: 1 });
  assert.deepEqual(await patchBraces(fixture, { check: true }), { checked: 4, patched: 0 });
  await writeFile(path.join(fixture, 'package.json'), JSON.stringify({ name: 'braces', version: '3.0.4' }));
  await assert.rejects(patchBraces(fixture), /must be reviewed/);
  assertions += 9;
} finally {
  if (path.dirname(fixture) !== os.tmpdir() || !path.basename(fixture).startsWith('shanze-braces-guard-')) throw new Error('Unsafe test cleanup path');
  await rm(fixture, { recursive: true, force: true });
}
console.log(`PASS: ${assertions} build dependency safety and compatibility assertions (local mitigation; upstream audit advisory is not suppressed).`);
