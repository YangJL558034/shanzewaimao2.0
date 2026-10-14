// A deliberately bounded baseline for the existing 2026-10-14 database.
// No migration SQL is ever executed against the target database.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, realpath, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';
import { resolveSQLiteDatabasePath } from '../../lib/sqlite-path.mjs';

const approved = [
  ['20260822000000_init', 'dadb8dc5d9cd82f04c27c51bebcfec8b7485c479ea13455b47b3b7dfc36f473f'],
  ['20260822093041_add_page_sections', '5e830098cf766f1fa346538c455155aa7177f628fa939a066ca71c4c1ea660aa'],
  ['20260824085623_crm_analytics', '52b7917e06d473914df3668fbd23151daec88e502e970480b98769163ab97574'],
  ['20260824092641_visit_geo', '0baefb30b9d690eddc368f5c90215e2ccc523ce30c6fad57bc5b14c00bbf9403'],
  ['20260824150000_add_page_section_items', '5a48c46810b60672cdd1546e6d02d0a8fc6a69bcf346639e59b8140477254dd2'],
  ['20260824184500_audit_actor_snapshot', '896242269daa5a0b16b56f4b0a58667d9e339e042df6acae52300354ed70bda0'],
  ['20260825013124_add_product_hover_image', '449a09138daf0e7a6a82f23d772b76e45486ec49aad6269ba8d8f6b851176d3e'],
  ['20260919090000_add_entity_seo_fields', 'fcc3b4be1a33707ba0c309a8fda7096a23029a60ec527ec09de3595125802c17'],
  ['20260919093000_seo_data_cleanup', '223800741a4552e7094346a8f7a9d873990e9e91fdb6f2f24f722d3e57c7a1bd'],
  ['20260919100000_refresh_public_seo', '56131e083dbde4d38c170723929cf0eaabc30da862bfcd19b79b527d6c6328e0'],
  ['20261014000000_unified_customer_center', '764bbdcca78316c9765f3e59662059b1e7598a990f63846560091f3425fac1a5'],
  ['20261014010000_conversation_public_token', 'cfdfb96c3890a11d81a782294efc8074714280375be1e76a09853f7cbf7de590'],
  ['20261014020000_certificate_categories', '4cde73a9bd72b31438f2cefcebc8d437315287d77412cef2df43adc541c7127f'],
];
export const baselineBoundary = approved.at(-1)[0];
const digest = value => createHash('sha256').update(value).digest('hex');
const quote = value => `"${value.replaceAll('"', '""')}"`;
const json = value => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? { sqliteInteger: String(item) } : item instanceof Uint8Array ? { sqliteBlob: Buffer.from(item).toString('hex') } : item);

// Tokenize instead of stripping whitespace inside SQL string literals.
function canonicalSql(sql) {
  return (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|--[^\r\n]*|\/\*[\s\S]*?\*\/|[A-Za-z_][A-Za-z_0-9$]*|\d+(?:\.\d+)?|>=|<=|<>|!=|==|\|\||[^\s]/g) || [])
    .filter(token => !token.startsWith('--') && !token.startsWith('/*')).join(' ');
}
export function schemaSnapshot(db) {
  return db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' AND NOT(type='table' AND name='_prisma_migrations') ORDER BY type,name").all()
    .map(row => ({ ...row, sql: canonicalSql(row.sql || '') }));
}
export function contentSnapshot(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB 'sqlite_*' AND name != '_prisma_migrations' ORDER BY name").all().map(({ name }) => {
    const columns = db.prepare(`PRAGMA table_info(${quote(name)})`).all().map(column => column.name).sort();
    const statement = db.prepare(`SELECT ${columns.map(quote).join(',')} FROM ${quote(name)} ORDER BY ${columns.map(quote).join(',')}`);
    statement.setReadBigInts(true);
    const hash = createHash('sha256');
    let rows = 0;
    for (const row of statement.iterate()) { hash.update(json(row)); hash.update('\n'); rows++; }
    return { table: name, rows, sha256: hash.digest('hex') };
  });
}
export async function resolveDatabase(root, databaseUrl) {
  assert.ok(databaseUrl?.startsWith('file:'), 'DATABASE_URL must identify an existing SQLite file');
  // Use exactly the same Prisma 6 path semantics as backup/restore/storage.
  // Percent escapes are literal filename characters, not URI encoding.
  return realpath(resolveSQLiteDatabasePath(databaseUrl, root));
}
export async function loadBaseline(root) {
  const directory = path.join(root, 'prisma/migrations');
  const names = (await readdir(directory, { withFileTypes: true })).filter(item => item.isDirectory()).map(item => item.name).sort();
  assert.deepEqual(names.filter(name => name <= baselineBoundary), approved.map(([name]) => name), 'Baseline migration list differs from the reviewed release');
  const migrations = [];
  for (const [name, approvedChecksum] of approved) {
    const sql = await readFile(path.join(directory, name, 'migration.sql'), 'utf8');
    assert.equal(digest(sql.replaceAll('\r\n', '\n')), approvedChecksum, `Unreviewed historical SQL modification: ${name}`);
    migrations.push({ name, sql, checksum: digest(sql), validChecksums: new Set([digest(sql), digest(sql.replaceAll('\r\n', '\n')), digest(sql.replace(/\r?\n/g, '\r\n'))]) });
  }
  const reference = new DatabaseSync(':memory:');
  let expected;
  try {
    for (const migration of migrations) reference.exec(migration.sql);
    expected = schemaSnapshot(reference);
  } finally { reference.close(); }
  return { migrations, expected, futureMigrations: names.filter(name => name > baselineBoundary) };
}
export function inspectDatabase(db, baseline) {
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok', 'SQLite integrity check failed');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [], 'Foreign-key violations require manual review');
  assert.deepEqual(schemaSnapshot(db), baseline.expected, 'Schema drift: tables, columns, defaults, constraints, indexes, views or triggers differ; no baseline is allowed');
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'").get();
  assert.ok(table, 'This bounded repair requires the existing Prisma migration ledger; do not use it to initialize an unknown database');
  const rows = db.prepare('SELECT * FROM "_prisma_migrations" ORDER BY migration_name').all();
  const names = new Set();
  for (const row of rows) {
    assert.ok(!names.has(row.migration_name), `Duplicate migration history: ${row.migration_name}`);
    names.add(row.migration_name);
    const migration = baseline.migrations.find(item => item.name === row.migration_name);
    assert.ok(migration, `Unknown or later migration requires manual review: ${row.migration_name}`);
    assert.ok(row.finished_at !== null && row.rolled_back_at === null, `Unfinished/rolled-back migration requires manual review: ${row.migration_name}`);
    assert.ok(migration.validChecksums.has(row.checksum), `Migration checksum differs: ${row.migration_name}`);
  }
  return { existing: rows.map(row => row.migration_name), missing: baseline.migrations.filter(migration => !names.has(migration.name)).map(migration => migration.name), schemaSha256: digest(json(baseline.expected)), schemaObjects: baseline.expected.length };
}
export async function reconcileHistory({ root, databaseUrl, apply = false, adoptExistingContent = false, backupDirectory }) {
  assert.ok(!apply || adoptExistingContent, 'Applying a baseline requires --adopt-existing-content: historical data migrations will NOT be replayed');
  const databasePath = await resolveDatabase(root, databaseUrl);
  const baseline = await loadBaseline(root);
  const reader = new DatabaseSync(databasePath, { readOnly: true });
  reader.exec('PRAGMA busy_timeout=5000');
  let inspection, backupPath, before;
  const operationId = randomUUID();
  const createdAt = new Date().toISOString();
  const report = { version: 1, operationId, createdAt, mode: apply ? 'apply' : 'dry-run', policy: 'adopt-existing-content', baselineBoundary, databasePath, futureMigrations: baseline.futureMigrations, migrationSqlExecutedAgainstTarget: false };
  try {
    inspection = inspectDatabase(reader, baseline);
    Object.assign(report, inspection);
    if (!apply || !inspection.missing.length) return { ...report, changed: false };
    const directory = path.resolve(backupDirectory || path.join(root, 'storage/private/migration-history'));
    // These snapshots contain private customer records: never place them in public/.
    const publicRoot = path.resolve(root, 'public');
    const relative = path.relative(publicRoot, directory);
    assert.ok(relative.startsWith('..') || path.isAbsolute(relative), 'Migration backups must be outside public/');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    backupPath = path.join(directory, `before-baseline-${createdAt.replace(/[:.]/g, '-')}-${operationId}.db`);
    await backup(reader, backupPath);
    if (process.platform !== 'win32') await chmod(backupPath, 0o600);
    const saved = new DatabaseSync(backupPath, { readOnly: true });
    try { assert.deepEqual(inspectDatabase(saved, baseline), inspection, 'Migration history changed while making backup'); before = contentSnapshot(saved); }
    finally { saved.close(); }
  } finally { reader.close(); }
  const writer = new DatabaseSync(databasePath);
  let transaction = false;
  try {
    writer.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
    transaction = true;
    assert.deepEqual(inspectDatabase(writer, baseline), inspection, 'Schema/history changed after backup; retry with the service stopped');
    assert.deepEqual(contentSnapshot(writer), before, 'Business data changed after backup; retry with the service stopped');
    const insert = writer.prepare('INSERT INTO "_prisma_migrations" (id,checksum,finished_at,migration_name,logs,rolled_back_at,started_at,applied_steps_count) VALUES (?,?,?,?,?,NULL,?,0)');
    const timestamp = Date.now();
    for (const name of inspection.missing) {
      const migration = baseline.migrations.find(item => item.name === name);
      insert.run(randomUUID(), migration.checksum, timestamp, name, json({ baseline: true, policy: 'adopt-existing-content', sqlExecuted: false, operationId, verifiedSchemaSha256: inspection.schemaSha256 }), timestamp);
    }
    assert.equal(inspectDatabase(writer, baseline).missing.length, 0);
    assert.deepEqual(contentSnapshot(writer), before, 'Business data changed; the ledger repair has been rolled back');
    const auditPath = `${backupPath}.json`;
    const complete = { ...report, changed: true, backupPath, auditPath, contentPreserved: true, contentFingerprints: before };
    // Audit creation failure rolls back the transaction. The record says prepared;
    // the ledger's operationId is authoritative evidence that commit completed.
    await writeFile(auditPath, JSON.stringify({ ...complete, transactionState: 'prepared; verify operationId in migration ledger' }, null, 2), { flag: 'wx', mode: 0o600 });
    writer.exec('COMMIT');
    transaction = false;
    return complete;
  } catch (error) {
    if (transaction) writer.exec('ROLLBACK');
    throw error;
  } finally { writer.close(); }
}
