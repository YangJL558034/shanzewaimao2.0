import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync, backup } from 'node:sqlite';
import env from '@next/env';
import { contentSnapshot, reconcileHistory, resolveDatabase } from './lib/migration-history.mjs';

env.loadEnvConfig(process.cwd());
const root = process.cwd();
const directory = await mkdtemp(path.join(tmpdir(), 'shanze-migration-test-'));
const sourcePath = await resolveDatabase(root, process.env.DATABASE_URL);
const report = { tests: [], sourceDatabaseReadOnly: true };
const pass = name => { report.tests.push(name); console.log(`PASS: ${name}`); };
const url = file => `file:${file.replaceAll('\\', '/')}`;
async function copy(source, destination) {
  const db = new DatabaseSync(source, { readOnly: true });
  try { await backup(db, destination); } finally { db.close(); }
}
function inspect(file, callback) {
  const db = new DatabaseSync(file, { readOnly: true });
  try { return callback(db); } finally { db.close(); }
}
function mutate(file, callback) {
  const db = new DatabaseSync(file);
  try { return callback(db); } finally { db.close(); }
}
async function prisma(file, command) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', command], { cwd: root, env: { ...process.env, DATABASE_URL: url(file) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject); child.once('exit', code => resolve({ code, output }));
  });
}
try {
  for (const name of ['literal%20name.db', 'literal name.db', 'literal%GG.db']) {
    const file = path.join(directory, name);
    new DatabaseSync(file).close();
    assert.equal(await resolveDatabase(root, `${url(file)}?connection_limit=1`), file);
    assert.equal(await resolveDatabase(directory, `file:../${name}`), file);
  }
  await assert.rejects(resolveDatabase(root, 'file::memory:'), /local SQLite file/);
  await assert.rejects(resolveDatabase(root, 'file://unknown.db'), /local SQLite file/);
  await assert.rejects(resolveDatabase(root, url(path.join(directory, 'missing.db'))), /ENOENT/);
  pass('Database paths preserve literal percent escapes, distinguish spaces, and never create missing files');
  const snapshot = path.join(directory, 'snapshot.db');
  await copy(sourcePath, snapshot);
  // Make the test repeatable after the real ledger has been repaired.
  mutate(snapshot, db => db.exec("DELETE FROM _prisma_migrations WHERE migration_name != '20261014020000_certificate_categories'"));
  const before = inspect(snapshot, contentSnapshot);
  const originalLedger = inspect(snapshot, db => db.prepare('SELECT * FROM _prisma_migrations').all());
  const options = { root, databaseUrl: url(snapshot), backupDirectory: path.join(directory, 'backups') };
  const dryRun = await reconcileHistory(options);
  assert.equal(dryRun.missing.length, 12);
  assert.equal(dryRun.changed, false);
  assert.deepEqual(inspect(snapshot, db => db.prepare('SELECT * FROM _prisma_migrations').all()), originalLedger);
  pass('Dry-run verifies all 96 schema objects and never modifies the copied ledger');
  await assert.rejects(reconcileHistory({ ...options, apply: true }), /adopt-existing-content/);
  pass('Application requires explicit adoption of existing content');
  await assert.rejects(reconcileHistory({ ...options, apply: true, adoptExistingContent: true, backupDirectory: path.join(root, 'public/migration-test-forbidden') }), /outside public/);
  pass('Private database backups cannot be written under public/');
  const result = await reconcileHistory({ ...options, apply: true, adoptExistingContent: true });
  assert.equal(result.changed, true);
  assert.deepEqual(inspect(snapshot, contentSnapshot), before);
  assert.deepEqual(inspect(result.backupPath, contentSnapshot), before);
  assert.deepEqual(inspect(result.backupPath, db => db.prepare('SELECT * FROM _prisma_migrations').all()), originalLedger);
  const adopted = inspect(snapshot, db => db.prepare('SELECT * FROM _prisma_migrations WHERE migration_name != ?').all('20261014020000_certificate_categories'));
  assert.equal(adopted.length, 12);
  assert.ok(adopted.every(row => row.applied_steps_count === 0 && JSON.parse(row.logs).sqlExecuted === false && JSON.parse(row.logs).policy === 'adopt-existing-content'));
  pass('Consistent backup + atomic ledger-only adoption preserve every business row');
  for (const command of ['status', 'deploy']) {
    const process = await prisma(snapshot, command);
    assert.equal(process.code, 0, process.output);
    assert.deepEqual(inspect(snapshot, contentSnapshot), before);
    pass(`Prisma migrate ${command} succeeds on repaired snapshot without replaying data migrations`);
  }
  assert.equal((await reconcileHistory({ ...options, apply: true, adoptExistingContent: true })).changed, false);
  pass('Repeated repair is an idempotent no-op');
  const invalidCases = [
    ['missing index', db => db.exec('DROP INDEX Conversation_status_lastMessageAt_idx'), /Schema drift/],
    ['missing audit trigger', db => db.exec('DROP TRIGGER AuditLog_actor_snapshot_after_insert'), /Schema drift/],
    ['extra schema', db => db.exec('CREATE TABLE unreviewed (id TEXT)'), /Schema drift/],
    ['misleading SQLite-like object name', db => db.exec('CREATE TABLE sqliteXunreviewed (id TEXT)'), /Schema drift/],
    ['ledger mutation trigger', db => db.exec('CREATE TRIGGER "_prisma_migrations" AFTER INSERT ON "_prisma_migrations" BEGIN DELETE FROM "Setting"; END'), /Schema drift/],
    ['missing ledger', db => db.exec('DROP TABLE _prisma_migrations'), /existing Prisma migration ledger/],
    ['edited historical checksum', db => db.exec("UPDATE _prisma_migrations SET checksum='invalid' WHERE migration_name='20260822000000_init'"), /checksum differs/],
    ['unfinished migration', db => db.exec('UPDATE _prisma_migrations SET finished_at=NULL'), /Unfinished\/rolled-back/],
    ['unknown migration', db => db.exec("UPDATE _prisma_migrations SET migration_name='unreviewed' WHERE migration_name='20260822000000_init'"), /Unknown or later/],
  ];
  for (const [name, alteration, pattern] of invalidCases) {
    const file = path.join(directory, `invalid-${report.tests.length}.db`);
    await copy(snapshot, file);
    mutate(file, alteration);
    const business = inspect(file, contentSnapshot);
    await assert.rejects(reconcileHistory({ ...options, databaseUrl: url(file), apply: true, adoptExistingContent: true }), pattern);
    assert.deepEqual(inspect(file, contentSnapshot), business);
    pass(`Fail-closed for ${name}`);
  }
  const fresh = path.join(directory, 'fresh.db');
  new DatabaseSync(fresh).close();
  const freshResult = await prisma(fresh, 'deploy');
  assert.equal(freshResult.code, 0, freshResult.output);
  assert.equal(inspect(fresh, db => db.prepare('SELECT count(*) AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL').get().n), 13);
  pass('All unchanged SQL migrations deploy normally to a fresh database');
  report.result = 'PASS';
  console.log(JSON.stringify(report, null, 2));
} finally {
  assert.ok(path.resolve(directory).startsWith(path.join(tmpdir(), 'shanze-migration-test-')));
  await rm(directory, { recursive: true, force: true });
}
