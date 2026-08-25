import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { importDatabaseBackup } from "@/lib/backup";
import { verifyCsrf } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiUser("settings.write");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) {
    return NextResponse.json({ error: "安全令牌无效，请刷新页面后重试" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请选择需要导入的数据库备份文件" }, { status: 400 });
    }
    const record = await importDatabaseBackup(file, auth.user.id);
    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "IMPORT_BACKUP",
        entityType: "database",
        entityId: record.id,
        afterJson: JSON.stringify({ fileName: record.fileName, size: record.size }),
      },
    });
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "数据库备份导入失败" },
      { status: 400 },
    );
  }
}
