/** Read-only Linux portability check: verifies the real casing of local module imports.
 * This is not a Linux runtime test, and does not install packages or read any .env/DB.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const root = process.cwd();
const files = execFileSync("rg", ["--files", "-g", "*.ts", "-g", "*.tsx", "-g", "*.mjs", "-g", "*.cjs", "-g", "*.css", "-g", "!next-env.d.ts"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
const issues = [];
let checkedImports = 0;

function exactPath(candidate) {
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  let current = root;
  let mismatch = false;
  for (const part of relative.split(path.sep)) {
    if (!part) continue;
    if (!fs.existsSync(current) || !fs.statSync(current).isDirectory()) return null;
    const entries = fs.readdirSync(current);
    const actual = entries.includes(part) ? part : entries.find((entry) => entry.toLowerCase() === part.toLowerCase());
    if (!actual) return null;
    mismatch ||= actual !== part;
    current = path.join(current, actual);
  }
  return fs.statSync(current).isFile() ? { mismatch, actual: path.relative(root, current) } : null;
}

function checkImport(file, name) {
  if (!(name.startsWith("@/") || name.startsWith("./") || name.startsWith("../"))) return;
  const source = name.split(/[?#]/)[0];
  const candidate = source.startsWith("@/") ? path.join(root, source.slice(2)) : path.resolve(root, path.dirname(file), source);
  const suffixes = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", "/index.ts", "/index.tsx", "/index.js", "/index.mjs", "/index.cjs"];
  const resolved = suffixes.map((suffix) => exactPath(candidate + suffix)).find(Boolean);
  checkedImports++;
  if (!resolved) issues.push({ file, import: name, problem: "unresolved-local-import" });
  else if (resolved.mismatch) issues.push({ file, import: name, problem: "case-mismatch", actual: resolved.actual });
}

for (const file of files) {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  if (file.endsWith(".css")) {
    for (const match of content.matchAll(/@import\s+["']([^"']+)["']/g)) checkImport(file, match[1]);
    continue;
  }
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) checkImport(file, node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0]) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) checkImport(file, node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const packages = Object.entries(lock.packages || {});
const platformDependencies = packages.filter(([name]) => /^node_modules\/(?:@img\/sharp.*linux.*|@next\/swc-linux.*|@prisma\/engines)$/.test(name)).map(([name, metadata]) => ({ name, version: metadata.version, os: metadata.os, cpu: metadata.cpu, optional: metadata.optional }));
console.log(JSON.stringify({ files: files.length, checkedImports, issues, platformDependencies }, null, 2));
if (issues.length) process.exitCode = 1;
