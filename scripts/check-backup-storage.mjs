/** Run: node --conditions=react-server --import tsx scripts/check-backup-storage.mjs
 * Isolated fixtures only: never reads or changes the configured application DB. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { resolveSQLiteDatabasePath } from "../lib/sqlite-path.mjs";
import sqliteSnapshot from "../lib/sqlite-snapshot.ts";
const { createSQLiteSnapshot, restoreSQLiteSnapshot } = sqliteSnapshot;

const projectRoot = process.cwd();
const temporary = await mkdtemp(path.join(os.tmpdir(), "shanze-backup-storage-"));
const checks = [];
const pass = (name) => { checks.push(name); console.log(`PASS ${name}`); };
const exists = async (file) => Boolean(await stat(file).catch(() => null));
const fixture = (file, value, pageSize = 4096, wal = false) => {
  const database = new DatabaseSync(file);
  database.exec(`PRAGMA page_size = ${pageSize}`);
  if (wal) database.exec("PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0");
  database.exec("CREATE TABLE fixture(value TEXT NOT NULL)");
  database.prepare("INSERT INTO fixture(value) VALUES (?)").run(value);
  return database;
};
const readValue = (file) => {
  const database = new DatabaseSync(file, { readOnly: true });
  try { return database.prepare("SELECT value FROM fixture").get().value; }
  finally { database.close(); }
};

try {
  assert.equal(resolveSQLiteDatabasePath("file:./dev.db", "/srv/shanze", "linux"), "/srv/shanze/prisma/dev.db");
  assert.equal(resolveSQLiteDatabasePath("file:../data/site.db?connection_limit=1", "/srv/shanze", "linux"), "/srv/shanze/data/site.db");
  assert.equal(resolveSQLiteDatabasePath("file:/var/lib/shanze/site.db", "/srv/shanze", "linux"), "/var/lib/shanze/site.db");
  assert.equal(resolveSQLiteDatabasePath("file:./percent%20space%GG.db", "/srv/shanze", "linux"), "/srv/shanze/prisma/percent%20space%GG.db");
  assert.equal(resolveSQLiteDatabasePath("file:./dev.db", "C:\\shanze", "win32"), "C:\\shanze\\prisma\\dev.db");
  assert.equal(resolveSQLiteDatabasePath("file:D:/persistent/site.db?connection_limit=1", "C:\\shanze", "win32"), "D:\\persistent\\site.db");
  for (const invalid of ["", "postgresql://db/site", "file:", "file::memory:", "file://remote/share.db", "file:///srv/site.db", "file:./", "file:.", "file:..", "file:a.db#part", "file:./bad\0.db"]) {
    assert.throws(() => resolveSQLiteDatabasePath(invalid, "/srv/shanze", "linux"), /DATABASE_URL/);
  }
  assert.throws(() => resolveSQLiteDatabasePath("file:C:/site.db", "/srv/shanze", "linux"), /Windows path/);
  assert.throws(() => resolveSQLiteDatabasePath("file:C:site.db", "C:\\shanze", "win32"), /absolute drive/);
  pass("Linux / Windows path parsing, query parameters, literal percent escapes and malformed URLs");

  for (const [name, envFile, override, expected] of [
    ["default", null, null, "prisma/dev.db"],
    ["env-file", 'DATABASE_URL="file:../data/from-env.db"\n', null, "data/from-env.db"],
    ["env-precedence", 'DATABASE_URL="file:../data/not-used.db"\n', "file:../data/override.db", "data/override.db"],
    ["encoded-literal", 'DATABASE_URL="file:../data/name%20with%GG.db?connection_limit=1"\n', null, "data/name%20with%GG.db"],
  ]) {
    const root = path.join(temporary, name);
    await mkdir(root);
    if (envFile) await writeFile(path.join(root, ".env"), envFile);
    const env = { ...process.env, NODE_ENV: "production" };
    delete env.DATABASE_URL;
    delete env.__NEXT_PROCESSED_ENV;
    if (override) env.DATABASE_URL = override;
    const result = spawnSync(process.execPath, [path.join(projectRoot, "scripts/prepare-storage.mjs")], { cwd: root, env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const expectedFile = path.join(root, expected);
    assert.ok(await exists(expectedFile), `${name}: expected configured file`);
    if (name !== "default") assert.equal(await exists(path.join(root, "prisma/dev.db")), false, "No stray default database");
    await writeFile(expectedFile, "existing database content");
    const repeated = spawnSync(process.execPath, [path.join(projectRoot, "scripts/prepare-storage.mjs")], { cwd: root, env, encoding: "utf8" });
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.equal(await readFile(expectedFile, "utf8"), "existing database content", "Storage prepare must never truncate an existing DB");
    pass(`storage:prepare ${name}, repeat is non-destructive`);
  }

  const invalidRoot = path.join(temporary, "invalid-config");
  await mkdir(invalidRoot);
  const invalid = spawnSync(process.execPath, [path.join(projectRoot, "scripts/prepare-storage.mjs")], { cwd: invalidRoot, env: { ...process.env, DATABASE_URL: "postgres://wrong", NODE_ENV: "production" }, encoding: "utf8" });
  assert.notEqual(invalid.status, 0);
  assert.deepEqual(await readdir(invalidRoot), []);
  pass("Invalid storage configuration fails before creating any files");

  for (const filename of ["custom.db", "space name.db", "percent%20name.db", "literal%GG.db"]) {
    const databaseUrl = `file:${path.join(temporary, filename).replaceAll("\\", "/")}?connection_limit=1`;
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      const databases = await client.$queryRawUnsafe("PRAGMA database_list");
      assert.equal(path.resolve(databases.find((row) => row.name === "main").file), resolveSQLiteDatabasePath(databaseUrl));
    } finally { await client.$disconnect(); }
  }
  pass("Resolved custom paths match actual Prisma SQLite connection paths, including percent characters");

  const livePath = path.join(temporary, "wal-live.db");
  const snapshotPath = path.join(temporary, "wal-snapshot.db");
  const live = fixture(livePath, "committed in WAL", 4096, true);
  try {
    assert.ok((await stat(`${livePath}-wal`)).size > 0);
    await createSQLiteSnapshot(livePath, snapshotPath);
    assert.equal(readValue(snapshotPath), "committed in WAL");
    live.exec("BEGIN IMMEDIATE");
    live.prepare("UPDATE fixture SET value = ?").run("not committed");
    const uncommittedSnapshot = path.join(temporary, "uncommitted-snapshot.db");
    await createSQLiteSnapshot(livePath, uncommittedSnapshot);
    assert.equal(readValue(uncommittedSnapshot), "committed in WAL");
    live.exec("ROLLBACK");
    await assert.rejects(createSQLiteSnapshot(livePath, snapshotPath), /EEXIST/);
    assert.equal(readValue(snapshotPath), "committed in WAL");
    live.prepare("UPDATE fixture SET value = ?").run("newer live value");
    const safety = path.join(temporary, "pre-restore.db");
    await createSQLiteSnapshot(livePath, safety);
    await restoreSQLiteSnapshot(snapshotPath, livePath);
    assert.equal(live.prepare("SELECT value FROM fixture").get().value, "committed in WAL", "An already open WAL connection sees the restored database");
    assert.equal(readValue(safety), "newer live value");
    pass("Snapshot includes committed WAL only, prevents overwrite, restore works with open WAL connection and preserves safety copy");

    const largePagePath = path.join(temporary, "incompatible-page-size.db");
    const differentPages = fixture(largePagePath, "must not replace live data", 8192);
    differentPages.close();
    await assert.rejects(restoreSQLiteSnapshot(largePagePath, livePath));
    assert.equal(live.prepare("SELECT value FROM fixture").get().value, "committed in WAL");
    const brokenPath = path.join(temporary, "broken.db");
    await writeFile(brokenPath, "not a sqlite database");
    await assert.rejects(restoreSQLiteSnapshot(brokenPath, livePath));
    await assert.rejects(restoreSQLiteSnapshot(snapshotPath, path.join(temporary, "missing.db")));
    await assert.rejects(restoreSQLiteSnapshot(livePath, livePath));
    assert.equal(live.prepare("SELECT value FROM fixture").get().value, "committed in WAL");
    pass("Restore failures / corrupt source / wrong page size / absent destination leave original DB intact");
  } finally { live.close(); }

  const serviceRoot = path.join(temporary, "backup-service");
  await mkdir(path.join(serviceRoot, "persistent"), { recursive: true });
  const serviceFile = path.join(serviceRoot, "persistent", "custom%20database.db");
  const client = new PrismaClient({ datasourceUrl: `file:${serviceFile.replaceAll("\\", "/")}` });
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalPrisma = globalThis.prisma;
  const hook = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { shortCircuit: true, url: pathToFileURL(path.join(projectRoot, "node_modules/next/dist/compiled/server-only/empty.js")).href };
    return nextResolve(specifier, context);
  } });
  process.env.DATABASE_URL = `file:${serviceFile.replaceAll("\\", "/")}?connection_limit=1`;
  globalThis.prisma = client;
  try {
    for (const table of ["User", "Product", "Setting", "AuditLog"]) await client.$executeRawUnsafe(`CREATE TABLE "${table}" (id TEXT PRIMARY KEY)`);
    await client.$executeRawUnsafe("CREATE TABLE BackupRecord (id TEXT PRIMARY KEY, fileName TEXT NOT NULL, path TEXT NOT NULL, size INTEGER NOT NULL, checksum TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'completed', createdBy TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    await client.$executeRawUnsafe("INSERT INTO Product (id) VALUES ('isolated-product')");
    const module = await import("../lib/backup.ts");
    const backupHelpers = module.default || module;
    process.chdir(serviceRoot);
    const record = await backupHelpers.createDatabaseBackup("test-admin");
    assert.equal(path.dirname(record.path), path.join(serviceRoot, "backups"));
    assert.equal(await client.backupRecord.count(), 1);
    backupHelpers.validateSQLiteBackup(record.path);
    const saved = new DatabaseSync(record.path, { readOnly: true });
    try { assert.equal(saved.prepare("SELECT id FROM Product").get().id, "isolated-product"); }
    finally { saved.close(); }
    assert.equal(await exists(path.join(serviceRoot, "prisma/dev.db")), false);
    const otherDatabase = path.join(serviceRoot, "other.db");
    fixture(otherDatabase, "must not back up this file").close();
    process.env.DATABASE_URL = `file:${otherDatabase.replaceAll("\\", "/")}`;
    await assert.rejects(backupHelpers.createDatabaseBackup("test-admin"), /DATABASE_URL/);
    assert.equal(await client.backupRecord.count(), 1);
    pass("Real backup service writes record and snapshot for custom database, rejects runtime/config mismatch");
  } finally {
    process.chdir(projectRoot);
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalPrisma === undefined) delete globalThis.prisma;
    else globalThis.prisma = originalPrisma;
    await client.$disconnect();
    hook.deregister();
  }

  console.log(JSON.stringify({ ok: true, checks: checks.length, isolated: true }));
} finally {
  const resolved = path.resolve(temporary);
  assert.ok(path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("shanze-backup-storage-"));
  await rm(resolved, { recursive: true, force: true });
}
