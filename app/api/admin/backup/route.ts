import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/security";
import { createDatabaseBackup } from "@/lib/backup";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiUser("settings.write");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) {
    return NextResponse.json({ error: "安全令牌无效，请刷新页面后重试" }, { status: 403 });
  }
  const record = await createDatabaseBackup(auth.user.id);
  await db.auditLog.create({
    data: {
      userId: auth.user.id,
      action: "BACKUP",
      entityType: "database",
      entityId: record.id,
    },
  });
  return NextResponse.json({ data: record }, { status: 201 });
}
