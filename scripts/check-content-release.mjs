// Meaningful isolated deployment regression; never changes the development DB.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createContentRelease, contentTables, importContentRelease } from './lib/content-release.mjs';

const root = process.cwd();
const temporary = await mkdtemp(path.join(tmpdir(), 'shanze-content-release-'));
const release = JSON.parse(await readFile(path.join(root, 'content/site-content.json'), 'utf8'));
const testRoot = path.join(temporary, 'project');
const databasePath = path.join(temporary, 'fresh.db');
const checks = [];
const check = label => { checks.push(label); console.log(`PASS: ${label}`); };
const privateTables = ['User', 'Session', 'CustomerContact', 'Conversation', 'ConversationMessage', 'Inquiry', 'EmailQueue', 'NewsletterSubscriber', 'AuditLog'];
const digest = text => createHash('sha256').update(text).digest('hex');
function readPrivate(db) {
  return digest(JSON.stringify([...privateTables.map(table => [table, db.prepare(`SELECT * FROM "${table}" ORDER BY id`).all()]),
    ['Setting', db.prepare("SELECT * FROM Setting WHERE key='smtp_password' ORDER BY id").all()]]));
}
const clone = value => JSON.parse(JSON.stringify(value));
const seal = value => createContentRelease(value.tables, value.assets);
try {
  await mkdir(path.join(testRoot, 'public'), { recursive: true });
  for (const asset of release.assets) {
    const destination = path.join(testRoot, 'public', asset.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(root, 'public', asset.path), destination);
  }
  const db = new DatabaseSync(databasePath);
  try {
    const directory = path.join(root, 'prisma/migrations');
    for (const item of (await readdir(directory, { withFileTypes: true })).filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      db.exec(await readFile(path.join(directory, item.name, 'migration.sql'), 'utf8'));
    }
  } finally { db.close(); }
  const args = { root: testRoot, databasePath, release };
  const preview = await importContentRelease(args);
  assert.ok(preview.created > 500);
  const previewDb = new DatabaseSync(databasePath, { readOnly: true });
  try { assert.equal(previewDb.prepare('SELECT count(*) AS n FROM News').get().n, 0); } finally { previewDb.close(); }
  check('Preview lists the full release and writes no content');

  // Start with production ids different from the exported ids.
  const alternative = clone(release);
  const ids = Object.fromEntries(Object.entries(alternative.tables).map(([table, rows]) => [table, new Map(rows.map(row => [row.id, `production-${row.id}`]))]));
  const refs = { Product: { categoryId: 'ProductCategory' }, ProductImage: { productId: 'Product' }, ProductDownload: { productId: 'Product' }, News: { categoryId: 'NewsCategory' }, NavigationItem: { parentId: 'NavigationItem' }, Translation: { localeId: 'Locale' } };
  for (const [table, rows] of Object.entries(alternative.tables)) for (const row of rows) {
    for (const [field, target] of Object.entries(refs[table] || {})) if (row[field] !== null) row[field] = ids[target].get(row[field]);
    if (table === 'Translation') row.entityId = ids[row.entityType].get(row.entityId);
    row.id = ids[table].get(row.id);
  }
  await importContentRelease({ ...args, release: seal(alternative), apply: true });
  check('A completely empty database restores every website content model and its assets');
  const prod = new DatabaseSync(databasePath);
  let before;
  try {
    const now = Date.now();
    prod.exec('PRAGMA foreign_keys=ON');
    const product = prod.prepare('SELECT id FROM Product LIMIT 1').get().id;
    prod.prepare('INSERT INTO User(id,email,name,passwordHash,updatedAt) VALUES (?,?,?,?,?)').run('keep-user', 'keep@example.invalid', 'Keep account', 'fixture-password-hash', now);
    prod.prepare('INSERT INTO CustomerContact(id,fullName,email,updatedAt) VALUES (?,?,?,?)').run('keep-contact', 'Keep customer', 'customer@example.invalid', now);
    prod.prepare('INSERT INTO Conversation(id,contactId,channel,publicToken,updatedAt) VALUES (?,?,?,?,?)').run('keep-conversation', 'keep-contact', 'WEBSITE', 'fixture-session-token', now);
    prod.prepare('INSERT INTO ConversationMessage(id,conversationId,direction,content) VALUES (?,?,?,?)').run('keep-message', 'keep-conversation', 'INBOUND', 'Private customer message');
    prod.prepare('INSERT INTO Inquiry(id,referenceNo,fullName,companyName,email,country,productInterest,message,consentAt,updatedAt,productId) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('keep-inquiry', 'KEEP-001', 'Customer', 'Company', 'customer@example.invalid', 'UK', 'Power bank', 'Private inquiry', now, now, product);
    prod.prepare('INSERT INTO EmailQueue(id,templateKey,"to",subject,html,updatedAt) VALUES (?,?,?,?,?,?)').run('keep-mail', 'fixture', 'mail@example.invalid', 'Private mail', '<p>Private</p>', now);
    prod.prepare('INSERT INTO Setting(id,"group",key,value,type,isPublic,updatedAt) VALUES (?,?,?,?,?,?,?)').run('keep-smtp', 'smtp', 'smtp_password', 'private-fixture-value', 'password', 0, now);
    before = readPrivate(prod);
    prod.prepare('UPDATE Product SET slug=? WHERE id=?').run('production-edited-product-slug', product);
    // Pretend the original server still has old company history and no certificate image.
    prod.prepare('UPDATE PageSection SET items=? WHERE page=? AND key=?').run('[{"value":"2012","title":"Old history"}]', 'about', 'story');
    prod.prepare('UPDATE Certificate SET image=NULL WHERE name=?').run('ISO 9001');
  } finally { prod.close(); }
  const applied = await importContentRelease({ ...args, apply: true });
  assert.ok(applied.updated >= 2);
  const actual = new DatabaseSync(databasePath, { readOnly: true });
  try {
    assert.equal(readPrivate(actual), before);
    assert.deepEqual(actual.prepare('PRAGMA foreign_key_check').all(), []);
    for (const [table, rows] of Object.entries(release.tables)) assert.equal(actual.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n, table === 'Setting' ? rows.length + 2 : rows.length);
    assert.ok(actual.prepare("SELECT items FROM PageSection WHERE page='about' AND key='story'").get().items.includes('1999'));
    assert.ok(actual.prepare("SELECT image FROM Certificate WHERE name='ISO 9001'").get().image);
    for (const article of release.tables.News) {
      const row = actual.prepare('SELECT content,title,coverImage,publishedAt,status,categoryId,id FROM News WHERE slug=?').get(article.slug);
      for (const field of ['content', 'title', 'coverImage', 'publishedAt', 'status']) assert.equal(row[field], article[field]);
      const translation = release.tables.Translation.find(item => item.entityType === 'News' && item.entityId === article.id && item.field === 'content');
      if (translation) assert.equal(actual.prepare('SELECT value FROM Translation WHERE entityType=? AND entityId=? AND field=?').get('News', row.id, 'content').value, translation.value);
    }
  } finally { actual.close(); }
  check('Existing ids and CRM product links survive; old history, certificates, all article bodies, covers, dates and translations are restored');
  check('Customers, private messages, inquiries, user passwords, email queue and SMTP secret are unchanged');
  assert.equal((await importContentRelease({ ...args, apply: true })).unchanged, true);
  check('Repeated deploy/start is idempotent and does not overwrite later website edits');

  const edit = new DatabaseSync(databasePath);
  const article = release.tables.News[0];
  try { edit.prepare('UPDATE News SET content=? WHERE slug=?').run('Edited by production administrator', article.slug); } finally { edit.close(); }
  const next = clone(release);
  next.tables.News[0].content = 'New development release';
  next.tables.Page[0].excerpt = 'New page release';
  const newRelease = seal(next);
  const merged = await importContentRelease({ ...args, release: newRelease, apply: true });
  assert.equal(merged.conflicts.filter(item => item.table === 'News').length, 1);
  const edited = new DatabaseSync(databasePath, { readOnly: true });
  try { assert.equal(edited.prepare('SELECT content FROM News WHERE slug=?').get(article.slug).content, 'Edited by production administrator'); assert.equal(readPrivate(edited), before); } finally { edited.close(); }
  check('New releases preserve conflicting production edits while updating unchanged content');
  const forced = await importContentRelease({ ...args, release: newRelease, apply: true, force: true });
  assert.equal(forced.conflicts.length, 0);
  assert.ok(forced.backupPath);
  check('Explicit content-only force creates a private SQLite backup before applying the chosen release');

  const invalid = clone(release);
  invalid.tables.Setting.push({ id: 'bad', key: 'smtp_password', value: 'do-not-export', isPublic: 0 });
  await assert.rejects(importContentRelease({ ...args, release: seal(invalid), apply: true }), /Non-public setting/);
  const unknown = clone(release); unknown.tables.User = [];
  await assert.rejects(importContentRelease({ ...args, release: seal(unknown), apply: true }), /reviewed website tables/);
  const broken = clone(release); broken.tables.News[0].categoryId = 'unknown-category';
  await assert.rejects(importContentRelease({ ...args, release: seal(broken), apply: true, force: true }), /Missing content relation/);
  const corrupted = clone(release); corrupted.assets[0].sha256 = '0'.repeat(64);
  await assert.rejects(importContentRelease({ ...args, release: seal(corrupted), apply: true }), /Asset checksum/);
  const final = new DatabaseSync(databasePath, { readOnly: true });
  try { assert.equal(readPrivate(final), before); assert.deepEqual(final.prepare('PRAGMA foreign_key_check').all(), []); } finally { final.close(); }
  check('Private tables/settings, invalid relationships and altered assets are rejected without partial business changes');
  assert.ok(release.tables.News.length === 13 && release.tables.Translation.length >= 329);
  assert.ok(!JSON.stringify(release).includes('/uploads/'));
  assert.ok(!release.tables.Setting.some(row => /smtp_|notification_email|security_|backup_|analytics/i.test(row.key)));
  check('The published package contains all current articles and translations, portable assets, and no operational configuration');
  console.log(JSON.stringify({ result: 'PASS', checks: checks.length, models: Object.keys(contentTables).length, assets: release.assets.length, liveDatabaseWrites: false }));
} finally {
  const resolved = await realpath(temporary);
  assert.equal(path.dirname(resolved).toLowerCase(), (await realpath(tmpdir())).toLowerCase());
  assert.ok(path.basename(resolved).startsWith('shanze-content-release-'));
  await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
}
