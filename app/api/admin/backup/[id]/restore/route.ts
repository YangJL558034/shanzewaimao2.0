import { createHash } from "node:crypto";
import { copyFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { safeBackupPath, validateSQLiteBackup } from "@/lib/backup";
import { verifyCsrf } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("settings.write");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) {
    return NextResponse.json({ error: "安全令牌无效，请刷新页面后重试" }, { status: 403 });
  }
  if (request.headers.get("x-restore-confirmation") !== "RESTORE DATABASE") {
    return NextResponse.json({ error: "请输入恢复确认文字后再继续" }, { status: 400 });
  }

  const { id } = await params;
  const backup = await db.backupRecord.findUnique({ where: { id } });
  if (!backup) return NextResponse.json({ error: "数据库备份不存在" }, { status: 404 });
  const backupPath = safeBackupPath(backup.path);
  if (!backupPath) return NextResponse.json({ error: "数据库备份路径无效" }, { status: 409 });

  try {
    const buffer = await readFile(backupPath);
    if (createHash("sha256").update(buffer).digest("hex") !== backup.checksum) {
      return NextResponse.json({ error: "数据库备份校验失败，禁止恢复" }, { status: 409 });
    }
    validateSQLiteBackup(backupPath, buffer);
    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "RESTORE_BACKUP",
        entityType: "database",
        entityId: backup.id,
        afterJson: JSON.stringify({ fileName: backup.fileName, size: backup.size }),
      },
    });
    await db.$queryRawUnsafe("PRAGMA wal_checkpoint(FULL)").catch(() => undefined);

    const target = path.join(process.cwd(), "prisma", "dev.db");
    const safetyCopy = path.join(process.cwd(), "backups", `pre-restore-${Date.now()}.db`);
    await copyFile(target, safetyCopy);
    await db.$disconnect();
    await Promise.all([
      unlink(`${target}-wal`).catch(() => undefined),
      unlink(`${target}-shm`).catch(() => undefined),
    ]);
    try {
      await copyFile(backupPath, target);
    } catch (error) {
      await copyFile(safetyCopy, target).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({
      ok: true,
      restartRequired: true,
      message: "数据库已恢复。为确保连接完全刷新，请重启网站服务。",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "数据库恢复失败" },
      { status: 400 },
    );
  }
}
