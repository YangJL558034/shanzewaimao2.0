/**
 * Local, fail-closed mitigation for GHSA-vfj7-8cjw-p6xm in braces 3.0.3.
 * Upstream has not published a patched npm version. This does NOT change the
 * package version or suppress npm audit. Remove only after testing an upstream
 * fix. Scope: a bounded AST depth (128 including the root) for build-time globs.
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(projectRoot, 'package.json'));
const fingerprints = {
  'parse.js': ['e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310', '9e0f7f4ea4bdf64143c31ea1f32991831e87ae2576f13d3beedf1178c2601795'],
  'compile.js': ['dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f', 'ded368a45261352934ebf89d1eb3e3aa3cb22ffce5c09e5793e861237ba33ab6'],
  'expand.js': ['41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7', 'dfeffcb71ef882ee5f3991ee9749f534bfc4c20575f39c0b70e6593b0d52aa07'],
  'stringify.js': ['379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a', '166e0dfd7ced2c53eb4bc961d7ddee8730d0a212d10953634a3bb9483738741f'],
};
export const fingerprint = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');

function replaceExactly(source, from, to, count = 1) {
  if (source.split(from).length - 1 !== count) {
    throw new Error(`Unexpected braces source: required ${count} occurrence(s) of ${JSON.stringify(from)}`);
  }
  return source.split(from).join(to);
}

export function patchedSource(name, original) {
  let source = original.replace(/\r\n/g, '\n');
  const guard = "    if (depth > 128) throw new RangeError('braces nesting exceeds the local build safety limit (128)');\n";
  if (name === 'parse.js') {
    source = replaceExactly(source, '      stack.push(block);',
      "      // Local GHSA-vfj7-8cjw-p6xm mitigation; count the root in AST depth.\n" +
      "      if (stack.length >= 128) throw new RangeError('braces nesting exceeds the local build safety limit (128)');\n" +
      '      stack.push(block);', 2);
  } else if (name === 'compile.js' || name === 'expand.js') {
    source = replaceExactly(source, '  const walk = (node, parent = {}) => {\n',
      '  const walk = (node, parent = {}, depth = 0) => {\n' + guard);
    source = replaceExactly(source, 'walk(child, node);', 'walk(child, node, depth + 1);');
    if (name === 'expand.js') {
      source = replaceExactly(source, "    while (p.type !== 'brace' && p.type !== 'root' && p.parent) {\n",
        "    let parentDepth = 0;\n" +
        "    while (p.type !== 'brace' && p.type !== 'root' && p.parent) {\n" +
        "      if (++parentDepth > 128) throw new RangeError('braces parent nesting exceeds the local build safety limit (128)');\n");
      source = replaceExactly(source, "    while (block.type !== 'brace' && block.type !== 'root' && block.parent) {\n",
        "    let blockDepth = 0;\n" +
        "    while (block.type !== 'brace' && block.type !== 'root' && block.parent) {\n" +
        "      if (++blockDepth > 128) throw new RangeError('braces parent nesting exceeds the local build safety limit (128)');\n");
    }
  } else if (name === 'stringify.js') {
    source = replaceExactly(source, '  const stringify = (node, parent = {}) => {\n',
      '  const stringify = (node, parent = {}, depth = 0) => {\n' + guard);
    // Preserve upstream parent semantics; changing them alters escapeInvalid.
    source = replaceExactly(source, 'stringify(child);', 'stringify(child, {}, depth + 1);');
  } else {
    throw new Error(`Unsupported braces file: ${name}`);
  }
  return source;
}

export async function patchBraces(packageDirectory, { check = false } = {}) {
  const metadata = JSON.parse(await readFile(path.join(packageDirectory, 'package.json'), 'utf8'));
  if (metadata.name !== 'braces' || metadata.version !== '3.0.3') {
    throw new Error(`Local braces mitigation must be reviewed for ${metadata.name}@${metadata.version}`);
  }
  const changes = [];
  // Validate EVERY input and expected output before writing anything. An npm
  // upgrade, unknown modification, or partially installed package fails closed.
  for (const [name, [originalHash, patchedHash]] of Object.entries(fingerprints)) {
    const file = path.join(packageDirectory, 'lib', name);
    const source = await readFile(file, 'utf8');
    const actualHash = fingerprint(source);
    if (actualHash === patchedHash) continue;
    if (actualHash !== originalHash) throw new Error(`Unknown braces source checksum: ${name}`);
    if (check) throw new Error(`Required braces safety mitigation missing: ${name}; run npm install without --ignore-scripts`);
    const result = patchedSource(name, source);
    if (fingerprint(result) !== patchedHash) throw new Error(`Unexpected braces patch checksum: ${name}`);
    changes.push({ file, result });
  }
  for (const { file, result } of changes) await writeFile(file, result, 'utf8');
  return { checked: 4, patched: changes.length };
}

async function main() {
  const check = process.argv.includes('--check');
  let packageDirectory;
  try {
    packageDirectory = path.dirname(require.resolve('braces/package.json'));
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    // An intentional production-only install has no Tailwind/braces. A damaged
    // full install must not silently proceed without the mitigation.
    let tailwindPresent = false;
    try { require.resolve('tailwindcss/package.json'); tailwindPresent = true; }
    catch (nested) { if (nested.code !== 'MODULE_NOT_FOUND') throw nested; }
    if (tailwindPresent) throw new Error('Tailwind is installed but braces is missing; reinstall build dependencies');
    console.log('Build dependency mitigation skipped: optional build-time Tailwind/braces dependencies are not installed.');
    return;
  }
  const result = await patchBraces(packageDirectory, { check });
  console.log(`braces 3.0.3 local nesting mitigation: ${result.checked} checksums verified; ${result.patched} files patched. Upstream npm audit advisory remains visible.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
