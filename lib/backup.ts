import "server-only";
import { copyFile, mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { db } from "@/lib/db";

const BACKUP_LIMIT = 5;
export const MAX_BACKUP_UPLOAD_BYTES = 256 * 1024 * 1024;

export function safeBackupPath(filePath: string) {
  const directory = path.resolve(process.cwd(), "backups");
  const resolved = path.resolve(filePath);
  return resolved.startsWith(`${directory}${path.sep}`) ? resolved : null;
}

export function validateSQLiteBackup(filePath: string, buffer?: Buffer) {
  if (buffer && (buffer.length < 100 || buffer.subarray(0, 16).toString("binary") !== "SQLite format 3\u0000")) {
    throw new Error("所选文件不是有效的 SQLite 数据库备份");
  }

  const database = new DatabaseSync(filePath, { readOnly: true });
  try {
    const integrity = database.prepare("PRAGMA quick_check").get() as Record<string, unknown> | undefined;
    if (!integrity || String(Object.values(integrity)[0] || "").toLowerCase() !== "ok") {
      throw new Error("SQLite 完整性检查失败，禁止导入");
    }
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => String((row as Record<string, unknown>).name));
    const requiredTables = ["User", "Product", "Setting", "AuditLog"];
    if (requiredTables.some((table) => !tables.includes(table))) {
      throw new Error("该 SQLite 文件不是本系统生成的完整数据库备份");
    }
  } finally {
    database.close();
  }
}

export async function createDatabaseBackup(createdBy?: string | null) {
  await db.$queryRawUnsafe("PRAGMA wal_checkpoint(FULL)").catch(() => undefined);
  const source = path.join(process.cwd(), "prisma", "dev.db");
  const directory = path.join(process.cwd(), "backups");
  await mkdir(directory, { recursive: true });
  const fileName = `enercore-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
  const target = path.join(directory, fileName);
  await copyFile(source, target);
  const [buffer, info] = await Promise.all([readFile(target), stat(target)]);
  const record = await db.backupRecord.create({
    data: {
      fileName,
      path: target,
      size: info.size,
      checksum: createHash("sha256").update(buffer).digest("hex"),
      createdBy: createdBy || null,
    },
  });
  await pruneDatabaseBackups(BACKUP_LIMIT);
  return record;
}

export async function pruneDatabaseBackups(limit = BACKUP_LIMIT) {
  const records = await db.backupRecord.findMany({ orderBy: { createdAt: "desc" } });
  const extras = records.slice(Math.max(1, Math.min(limit, BACKUP_LIMIT)));
  const backupDirectory = path.resolve(process.cwd(), "backups");
  for (const record of extras) {
    const resolved = path.resolve(record.path);
    if (resolved.startsWith(`${backupDirectory}${path.sep}`)) {
      await unlink(resolved).catch(() => undefined);
    }
    await db.backupRecord.delete({ where: { id: record.id } }).catch(() => undefined);
  }
  return extras.length;
}

export async function importDatabaseBackup(file: File, createdBy: string) {
  if (!file.name || !/\.(db|sqlite|sqlite3)$/i.test(file.name)) {
    throw new Error("仅支持本系统下载的 .db、.sqlite 或 .sqlite3 数据库文件");
  }
  if (file.size <= 0 || file.size > MAX_BACKUP_UPLOAD_BYTES) {
    throw new Error("数据库备份文件不能为空，且不得超过 256MB");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const directory = path.join(process.cwd(), "backups");
  await mkdir(directory, { recursive: true });
  const originalBase = path.basename(file.name, path.extname(file.name))
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "database";
  const fileName = `import-${new Date().toISOString().replace(/[:.]/g, "-")}-${originalBase}.db`;
  const target = path.join(directory, fileName);

  await writeFile(target, buffer, { flag: "wx" });
  try {
    validateSQLiteBackup(target, buffer);
    const record = await db.backupRecord.create({
      data: {
        fileName,
        path: target,
        size: buffer.length,
        checksum: createHash("sha256").update(buffer).digest("hex"),
        status: "imported",
        createdBy,
      },
    });
    await pruneDatabaseBackups(BACKUP_LIMIT);
    return record;
  } catch (error) {
    await unlink(target).catch(() => undefined);
    throw error;
  }
}

export async function runScheduledBackupIfDue() {
  const settings = await db.setting.findMany({
    where: {
      key: {
        in: ["backup_enabled", "backup_interval_hours", "backup_last_run"],
      },
    },
  });
  const map = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
  if (map.backup_enabled === "false") return { status: "disabled" as const };
  const intervalHours = Math.max(1, Math.min(168, Number(map.backup_interval_hours) || 24));
  const lastRun = map.backup_last_run ? new Date(map.backup_last_run).getTime() : 0;
  if (Date.now() - lastRun < intervalHours * 3_600_000) {
    return { status: "not-due" as const };
  }
  const record = await createDatabaseBackup(null);
  await db.setting.upsert({
    where: { key: "backup_last_run" },
    update: { value: new Date().toISOString() },
    create: {
      group: "backup",
      key: "backup_last_run",
      value: new Date().toISOString(),
      type: "datetime",
      isPublic: false,
    },
  });
  return { status: "created" as const, record };
}
