// Production smoke test on a SQLite snapshot. Never run mutations against live data.
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { DatabaseSync, backup } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import env from '@next/env';
import { resolveSQLiteDatabasePath } from '../lib/sqlite-path.mjs';

const root = process.cwd();
env.loadEnvConfig(root);
assert.ok(process.env.DATABASE_URL?.startsWith('file:'), 'This snapshot test requires the existing SQLite database');
const temporary = await mkdtemp(path.join(tmpdir(), 'shanze-release-check-'));
const databasePath = path.join(temporary, 'snapshot.db');
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`;
const sourcePath = resolveSQLiteDatabasePath(process.env.DATABASE_URL, root);
const report = { startedAt: new Date().toISOString(), platform: process.platform, node: process.version, checks: [], warnings: [], result: 'RUNNING' };
const check = (name, details = {}) => { report.checks.push({ name, ...details }); console.log(`PASS: ${name}`); };
let db, server;
let serverLog = '';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const childEnv = { ...process.env, NODE_ENV: 'production', DATABASE_URL: databaseUrl, TZ: 'Asia/Shanghai', NEXT_PUBLIC_SITE_URL: 'https://shanzesz.com', GEOIP_LOOKUP_ENABLED: 'false', SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '', CRISP_IDENTIFIER: '', CRISP_KEY: '', WHATSAPP_ACCESS_TOKEN: '', INBOUND_EMAIL_WEBHOOK_SECRET: '', LINKEDIN_WEBHOOK_SECRET: '', NEXT_PUBLIC_GA4_MEASUREMENT_ID: '' };
async function runNode(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env: childEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject); child.once('exit', code => resolve({ code, output }));
  });
}
async function stopServer() {
  if (!server || server.exitCode !== null) return;
  if (process.platform === 'win32') {
    await new Promise(resolve => { const killer = spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); killer.once('exit', resolve); killer.once('error', resolve); });
  } else { try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill(); } }
}
try {
  assert.notEqual(path.resolve(databasePath), path.resolve(sourcePath));
  await access(path.join(root, '.next/BUILD_ID'));
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  try { await backup(source, databasePath); } finally { source.close(); }
  db = new PrismaClient({ datasourceUrl: databaseUrl });
  // Disable all scheduled external effects in the copied database as well as env.
  await db.setting.deleteMany({ where: { OR: [{ key: { startsWith: 'smtp_' } }, { key: { startsWith: 'crisp_' } }, { key: { startsWith: 'whatsapp_' } }] } });
  for (const [key, value] of [['backup_enabled', 'false'], ['google_analytics_id', ''], ['google_site_verification', '']]) {
    await db.setting.upsert({ where: { key }, update: { value }, create: { key, value, group: 'release-test', isPublic: false } });
  }
  await db.emailQueue.deleteMany();
  const freshUrl = `file:${path.join(temporary, 'fresh.db').replaceAll('\\', '/')}`;
  // Match the repository's db:deploy prepare-storage step before Prisma starts.
  new DatabaseSync(path.join(temporary, 'fresh.db')).close();
  const migrations = await runNode(['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: { ...childEnv, DATABASE_URL: freshUrl } });
  assert.equal(migrations.code, 0, migrations.output);
  check('All migrations apply to a new isolated SQLite database');
  const status = await runNode(['node_modules/prisma/build/index.js', 'migrate', 'status']);
  report.migrationStatus = { code: status.code, output: status.output };
  if (status.code) report.warnings.push('Existing database migration history needs review; see migrationStatus. Never reset or replace the production database.');
  else check('Current database snapshot migration history is up to date');
  const role = await db.role.findFirst({ where: { permissions: { some: { permission: { key: '*' } } } } });
  assert.ok(role, 'An administrator role must exist in the snapshot');
  const password = `Qa-${randomUUID()}!`;
  const admin = await db.user.create({ data: { email: `release-${randomUUID()}@example.invalid`, name: 'Release QA', passwordHash: await bcrypt.hash(password, 10), roles: { create: { roleId: role.id } } } });
  const portServer = createServer();
  await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
  const port = portServer.address().port;
  await new Promise(resolve => portServer.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  report.base = base;
  const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  server = spawn(process.execPath, [npmCli, 'start', '--', '--port', String(port)], { cwd: root, env: childEnv, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => { serverLog = (serverLog + chunk).slice(-20000); });
  server.stderr.on('data', chunk => { serverLog = (serverLog + chunk).slice(-20000); });
  for (let attempt = 0; attempt < 100; attempt++) {
    assert.equal(server.exitCode, null, serverLog);
    try { if ((await fetch(`${base}/admin/login`)).status === 200) break; } catch { /* startup */ }
    await delay(200);
  }
  check('npm start runs the production build on an isolated port');
  const publicPaths = ['/', '/about', '/products', '/factory', '/quality', '/news', '/blog', '/contact', '/power-bank-manufacturer', '/magnetic-power-bank-oem', '/wireless-charger-manufacturer', '/custom-power-bank-supplier', '/privacy-policy', '/terms-of-use', '/site-map', '/robots.txt', '/sitemap.xml'];
  const product = await db.product.findFirst({ where: { status: 'PUBLISHED' }, select: { slug: true } });
  const articles = await db.news.findMany({ where: { status: 'PUBLISHED' }, include: { category: true } });
  if (product) publicPaths.push(`/products/${product.slug}`);
  const blogCategories = new Set(['industry-insights', 'industry-guides', 'oem-guides', 'buying-guides']);
  const news = articles.find(item => !blogCategories.has(item.category?.slug));
  const blog = articles.find(item => blogCategories.has(item.category?.slug));
  if (news) publicPaths.push(`/news/${news.slug}`); if (blog) publicPaths.push(`/blog/${blog.slug}`);
  for (const route of publicPaths) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, `${route}: ${response.status}`);
    const html = await response.text();
    if (!route.endsWith('.txt') && !route.endsWith('.xml')) assert.ok(html.includes('<h1'), `${route} has its content`);
  }
  check('Public pages, product/article details, SEO landing pages, robots and sitemap return 200', { count: publicPaths.length });
  for (const route of ['/api/admin/inbox', '/api/admin/inbox/summary', '/api/admin/support-analytics', '/api/admin/products', '/api/admin/system']) {
    assert.equal((await fetch(base + route)).status, 401, `${route} blocks anonymous access`);
  }
  assert.ok([302, 303, 307, 308].includes((await fetch(`${base}/admin`, { redirect: 'manual' })).status));
  check('Admin pages and APIs reject anonymous access');
  const challenge = await fetch(`${base}/api/auth/captcha`).then(response => response.json());
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base, 'x-login-token': challenge.loginToken }, body: JSON.stringify({ username: admin.email, password, captcha: challenge.code }) });
  assert.equal(login.status, 200, 'Production login works');
  const sessionCookie = login.headers.getSetCookie().find(cookie => cookie.startsWith('enercore_session='));
  assert.ok(sessionCookie?.includes('HttpOnly'));
  const csrf = await fetch(`${base}/api/csrf`).then(response => response.json());
  const headers = { cookie: `${sessionCookie.split(';')[0]}; enercore_csrf_v2=${csrf.token}`, 'x-csrf-token': csrf.token, origin: base, 'content-type': 'application/json' };
  check('Production login, session cookie and CSRF token work');
  const adminPages = ['/admin', '/admin/inbox', '/admin/products', '/admin/news', '/admin/inquiries', '/admin/certificates', '/admin/media', '/admin/content?page=about', '/admin/customer-channels', '/admin/smtp', '/admin/system', '/admin/security', '/admin/seo-tools'];
  for (const route of adminPages) assert.equal((await fetch(base + route, { headers })).status, 200, route);
  check('Existing CMS, CRM, configuration, certificates, security and new dashboard pages return 200', { count: adminPages.length });
  const summary = await fetch(`${base}/api/admin/inbox/summary`, { headers }).then(response => response.json());
  const stats = await fetch(`${base}/api/admin/support-analytics`, { headers }).then(response => response.json());
  assert.equal(stats.data.timezone, 'Asia/Shanghai');
  assert.equal(stats.data.daily.length, 90);
  assert.equal(stats.data.summary.unreadMessages, summary.data.unreadMessages);
  check('Support dashboard and inbox share accurate unread counts and 90-day statistics');
  const contact = await db.customerContact.create({ data: { fullName: 'Isolated release test' } });
  const conversation = await db.conversation.create({ data: { contactId: contact.id, channel: 'WEBSITE', messages: { create: [{ direction: 'INBOUND', content: 'Unread fixture 1' }, { direction: 'INBOUND', content: 'Unread fixture 2' }, { direction: 'OUTBOUND', content: 'Unread visitor receipt fixture' }] } }, include: { messages: true } });
  const first = conversation.messages.find(message => message.direction === 'INBOUND');
  const readPath = `${base}/api/admin/inbox/${conversation.id}/read`;
  assert.equal((await fetch(readPath, { method: 'POST', headers: { cookie: headers.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ messageIds: [first.id] }) })).status, 403);
  assert.equal((await fetch(readPath, { method: 'POST', headers, body: JSON.stringify({ messageIds: [first.id] }) })).status, 200);
  assert.equal(await db.conversationMessage.count({ where: { conversationId: conversation.id, direction: 'INBOUND', readAt: null } }), 1);
  assert.equal(await db.conversationMessage.count({ where: { conversationId: conversation.id, direction: 'OUTBOUND', readAt: null } }), 1);
  check('Read acknowledgements require CSRF and do not clear unseen inbound messages or outbound customer receipts');
  const existingChat = await runNode(['scripts/check-live-chat.mjs'], { env: { ...childEnv, CHAT_TEST_URL: base } });
  assert.equal(existingChat.code, 0, existingChat.output);
  check('Existing Live Chat/CRM creation, reply SSE, customer read receipts and notification queue regression', { output: existingChat.output.trim() });
  const imageManifest = JSON.parse(await readFile(path.join(root, 'public/optimized/image-seo-manifest.json'), 'utf8'));
  const representative = [...new Set(Object.values(imageManifest).map(item => item.src))].slice(0, 5);
  for (const image of representative) { const response = await fetch(base + image); assert.equal(response.status, 200); assert.ok(response.headers.get('content-type')?.includes('image/webp')); }
  check('Optimized WebP assets are served correctly in production');
  report.result = 'PASS';
  if (process.argv.includes('--serve')) {
    console.log(JSON.stringify({ productionTestReady: true, base, databaseUrl, stopFile: path.join(temporary, 'stop'), testRoot: temporary }));
    // Allows the parent agent to run isolated browser checks, then create this exact stop file.
    const deadline = Date.now() + 20 * 60_000;
    while (Date.now() < deadline) { try { await access(path.join(temporary, 'stop')); break; } catch { await delay(1000); } }
  }
} catch (error) {
  report.result = 'FAIL'; report.error = error.stack; console.error(error); process.exitCode = 1;
} finally {
  await stopServer(); await db?.$disconnect();
  report.finishedAt = new Date().toISOString(); report.serverLog = serverLog;
  await mkdir(path.join(root, 'outputs'), { recursive: true });
  await writeFile(path.join(root, 'outputs/production-release-check.json'), JSON.stringify(report, null, 2));
  assert.equal(path.dirname(path.resolve(temporary)).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
  assert.ok(path.basename(temporary).startsWith('shanze-release-check-'));
  await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  console.log(JSON.stringify({ result: report.result, checks: report.checks.length, warnings: report.warnings, report: path.join(root, 'outputs/production-release-check.json') }));
}
