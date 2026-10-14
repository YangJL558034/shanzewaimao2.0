import { open, realpath, stat, unlink } from "node:fs/promises";
import { backup, DatabaseSync } from "node:sqlite";
import path from "node:path";

/** Native SQLite transactions include committed WAL pages; a raw copy does not. */
export async function createSQLiteSnapshot(sourcePath: string, targetPath: string) {
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  let created = false;
  try {
    const file = await open(targetPath, "wx", 0o600);
    created = true;
    await file.close();
    await backup(source, targetPath);
  } catch (error) {
    // Only remove the new snapshot owned by this call, never an existing file.
    if (created) await unlink(targetPath).catch(() => undefined);
    throw error;
  } finally {
    source.close();
  }
}

/**
 * SQLite's backup API replaces the destination in a write transaction. A failed
 * copy rolls back; existing WAL/SHM files must NEVER be unlinked by application
 * code while SQLite connections can still be open.
 */
export async function restoreSQLiteSnapshot(sourcePath: string, targetPath: string) {
  const [sourceReal, targetReal, targetInfo] = await Promise.all([realpath(sourcePath), realpath(targetPath), stat(targetPath)]);
  const samePath = process.platform === "win32" ? sourceReal.toLowerCase() === targetReal.toLowerCase() : sourceReal === targetReal;
  if (samePath || !targetInfo.isFile()) throw new Error("恢复来源和目标必须是不同的现有数据库文件");
  const source = new DatabaseSync(sourceReal, { readOnly: true });
  try {
    const check = source.prepare("PRAGMA quick_check").get();
    if (!check || Object.values(check)[0] !== "ok") throw new Error("SQLite 完整性检查失败，禁止恢复");
    await backup(source, path.resolve(targetReal));
  } finally {
    source.close();
  }
}
