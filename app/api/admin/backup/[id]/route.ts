import { createHash } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { contentDisposition, verifyCsrf } from "@/lib/security";
import { safeBackupPath } from "@/lib/backup";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("settings.read");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const backup = await db.backupRecord.findUnique({ where: { id } });
  if (!backup) return NextResponse.json({ error: "备份不存在" }, { status: 404 });
  const filePath = safeBackupPath(backup.path);
  if (!filePath) return NextResponse.json({ error: "备份路径无效" }, { status: 409 });
  try {
    const buffer = await readFile(filePath);
    const checksum = createHash("sha256").update(buffer).digest("hex");
    if (checksum !== backup.checksum) return NextResponse.json({ error: "备份校验失败，禁止下载" }, { status: 409 });
    await db.auditLog.create({
      data: { userId: auth.user.id, action: "DOWNLOAD_BACKUP", entityType: "database", entityId: backup.id },
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/vnd.sqlite3",
        "content-length": String(buffer.length),
        "content-disposition": contentDisposition(backup.fileName),
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "备份文件不存在或无法读取" }, { status: 404 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("settings.delete");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "安全令牌无效，请刷新后重试" }, { status: 403 });
  const { id } = await params;
  const backup = await db.backupRecord.findUnique({ where: { id } });
  if (!backup) return NextResponse.json({ error: "备份不存在" }, { status: 404 });
  const filePath = safeBackupPath(backup.path);
  if (!filePath) return NextResponse.json({ error: "备份路径无效" }, { status: 409 });
  await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  await db.$transaction([
    db.backupRecord.delete({ where: { id } }),
    db.auditLog.create({ data: { userId: auth.user.id, action: "DELETE_BACKUP", entityType: "database", entityId: id, beforeJson: JSON.stringify({ fileName: backup.fileName, size: backup.size, checksum: backup.checksum }) } }),
  ]);
  return NextResponse.json({ ok: true });
}
