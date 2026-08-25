import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/security";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("settings.delete");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });

  const { id } = await params;
  const item = await db.trashItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let deletedContent: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(item.dataJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) deletedContent = parsed;
  } catch {
    // Keep purging the trash record even when an old snapshot is malformed.
  }

  await db.$transaction(async (tx) => {
    await tx.trashItem.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "PURGE_TRASH",
        entityType: item.entityType,
        entityId: item.entityId,
        beforeJson: item.dataJson,
      },
    });
  });

  // Physical files are retained while in the recycle bin so restore remains
  // safe. Once permanently purged, remove only files inside public/uploads.
  if (item.entityType === "media" && typeof deletedContent.path === "string") {
    const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
    const candidate = path.resolve(/* turbopackIgnore: true */ process.cwd(), deletedContent.path.replace(/^\/+/, ""));
    if (candidate === uploadsRoot || candidate.startsWith(`${uploadsRoot}${path.sep}`)) {
      await unlink(candidate).catch(() => undefined);
    }
  }

  return NextResponse.json({ ok: true });
}
