// Run the documented deployment commands with an empty, disposable database.
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
const temporary = await mkdtemp(path.join(tmpdir(), 'shanze-content-clone-'));
const databasePath = path.join(temporary, 'clone.db');
const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const testEnv = { ...process.env, DATABASE_URL: `file:${databasePath.replaceAll('\\', '/')}`, NODE_ENV: 'production', DEFAULT_ADMIN_EMAIL: 'clone-qa@example.invalid', DEFAULT_ADMIN_PASSWORD: `Qa-${randomUUID()}`, SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '', CRISP_KEY: '', WHATSAPP_ACCESS_TOKEN: '', GEOIP_LOOKUP_ENABLED: 'false' };
let server;
let log = '';
async function npm(args) {
  return new Promise((resolve, reject) => {
    const process = spawn(globalThis.process.execPath, [npmCli, ...args], { cwd: root, env: testEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    process.stdout.on('data', bytes => { output += bytes; }); process.stderr.on('data', bytes => { output += bytes; });
    process.once('error', reject); process.once('exit', code => code === 0 ? resolve(output) : reject(new Error(output)));
  });
}
try {
  await access(path.join(root, '.next/BUILD_ID'));
  await npm(['run', 'db:deploy']);
  await npm(['run', 'db:seed']);
  const release = JSON.parse(await readFile(path.join(root, 'content/site-content.json'), 'utf8'));
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    assert.equal(db.prepare('SELECT count(*) AS n FROM User').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM News').get().n, release.tables.News.length);
    assert.equal(db.prepare('SELECT count(*) AS n FROM Certificate').get().n, release.tables.Certificate.length);
    assert.equal(db.prepare('SELECT count(*) AS n FROM Translation').get().n, release.tables.Translation.length);
    assert.equal(db.prepare('SELECT count(*) AS n FROM CustomerContact').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM Conversation').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM _prisma_migrations').get().n, 13);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
  console.log('PASS: db:deploy + db:seed initialize a new database with actual content, translations and a new local administrator');
  const portServer = createServer();
  await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
  const port = portServer.address().port;
  await new Promise(resolve => portServer.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [npmCli, 'start', '--', '--port', String(port)], { cwd: root, env: testEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  server.stdout.on('data', bytes => { log = (log + bytes).slice(-8000); }); server.stderr.on('data', bytes => { log = (log + bytes).slice(-8000); });
  for (let attempt = 0; attempt < 80; attempt++) {
    assert.equal(server.exitCode, null, log);
    try { if ((await fetch(`${base}/admin/login`)).status === 200) break; } catch { /* Startup only. */ }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  for (const locale of ['en', 'zh']) {
    for (const route of ['/', '/about', '/quality', '/news', '/blog', '/products', '/factory', '/contact']) {
      const response = await fetch(base + route, { headers: { cookie: `locale=${locale}` } });
      assert.equal(response.status, 200, `${locale} ${route}`);
      const html = await response.text();
      if (route === '/about') assert.ok(html.includes('1999') && html.includes('2022'), 'Actual company history is present');
      if (route === '/quality') assert.ok(html.includes('ISO 9001') && html.includes('ISO 14001') && html.includes('ISO 45001'), 'Actual certificates are present');
      assert.ok(html.includes('<h1'), `${route} renders its page`);
    }
  }
  for (const article of release.tables.News.filter(row => row.status === 'PUBLISHED')) {
    const category = release.tables.NewsCategory.find(row => row.id === article.categoryId)?.slug;
    const isBlog = ['industry-insights', 'industry-guides', 'oem-guides', 'buying-guides'].includes(category);
    assert.equal((await fetch(`${base}/${isBlog ? 'blog' : 'news'}/${article.slug}`)).status, 200, article.slug);
  }
  for (const asset of release.assets) assert.equal((await fetch(base + asset.path, { method: 'HEAD' })).status, 200, asset.path);
  console.log(JSON.stringify({ result: 'PASS', bilingualPages: 16, articles: release.tables.News.length, assets: release.assets.length, productionStart: true, liveDatabaseWrites: false }));
} finally {
  if (server?.exitCode === null) {
    if (process.platform === 'win32') await new Promise(resolve => { const stop = spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); stop.once('exit', resolve); stop.once('error', resolve); });
    else { try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill(); } }
  }
  const resolved = await realpath(temporary);
  assert.equal(path.dirname(resolved).toLowerCase(), (await realpath(tmpdir())).toLowerCase());
  assert.ok(path.basename(resolved).startsWith('shanze-content-clone-'));
  await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
}
