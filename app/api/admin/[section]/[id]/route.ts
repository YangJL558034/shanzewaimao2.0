import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { coerceCmsData, getCmsSection } from "@/lib/cms";
import { saveInlineTranslations } from "@/lib/cms-translations";
import { requireApiUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/security";
import { getMediaUsageMap } from "@/lib/media-usage";
import { queuePublicationNotification } from "@/lib/newsletter";

function model(name: string) {
  return (db as unknown as Record<string, { findUnique: Function; update: Function; delete: Function }>)[name];
}

export async function PUT(request: Request, { params }: { params: Promise<{ section: string; id: string }> }) {
  const { section: key, id } = await params;
  const section = getCmsSection(key);
  if (!section || section.readonly) return NextResponse.json({ error: "Not editable" }, { status: 405 });
  const auth = await requireApiUser(`${section.permission}.write`);
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  try {
    const before = await model(section.model).findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const input = await request.json();
    const data = coerceCmsData(section, input);
    if (section.key === "newsletter-subscribers" && "isActive" in data) {
      data.unsubscribedAt = data.isActive ? null : new Date();
    }
    const updated = await model(section.model).update({ where: { id }, data });
    if (section.key === "products" && "galleryImages" in input) {
      const gallery = parseGalleryImages(input.galleryImages);
      await db.$transaction([
        db.productImage.deleteMany({ where: { productId: id } }),
        ...(gallery.length
          ? [db.productImage.createMany({ data: gallery.map((image, index) => ({ productId: id, url: image.url, alt: image.alt, sortOrder: index })) })]
          : []),
      ]);
    }
    await saveInlineTranslations(
      section,
      id,
      input._translations,
      {
        before: before as Record<string, unknown>,
        after: updated as Record<string, unknown>,
      },
    );
    await db.auditLog.create({ data: { userId: auth.user.id, action: "UPDATE", entityType: section.model, entityId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(updated) } });
    const beforeRecord = before as Record<string, unknown>;
    const updatedRecord = updated as Record<string, unknown>;
    const notification = (section.key === "products" || section.key === "news") && beforeRecord.status !== "PUBLISHED" && updatedRecord.status === "PUBLISHED"
      ? await queuePublicationNotification(section.key === "news" ? "news" : "product", id)
      : null;
    return NextResponse.json({ data: updated, notification });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 400 });
  }
}

function parseGalleryImages(value: unknown) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed)
      ? parsed
          .map((item) => ({
            url: String(item?.url || "").trim(),
            alt: String(item?.alt || "").trim() || null,
          }))
          .filter((item) => item.url)
      : [];
  } catch {
    return [];
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ section: string; id: string }> }) {
  const { section: key, id } = await params;
  const section = getCmsSection(key);
  if (!section || (section.readonly && section.key !== "media")) return NextResponse.json({ error: "Not editable" }, { status: 405 });
  const auth = await requireApiUser(`${section.permission}.delete`);
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const before = await model(section.model).findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (section.key === "media") {
    const usage = await getMediaUsageMap([String(before.path || "")]);
    const references = usage.get(String(before.path || "")) || [];
    if (references.length) {
      return NextResponse.json({ error: "媒体文件正在使用中，不能删除", references }, { status: 409 });
    }
  }
  await db.$transaction(async (tx) => {
    await tx.trashItem.create({ data: { entityType: section.model, entityId: id, dataJson: JSON.stringify(before), deletedBy: auth.user.id, expiresAt: new Date(Date.now() + 30 * 86400_000) } });
    await (tx as unknown as Record<string, { delete: Function }>)[section.model].delete({ where: { id } });
    await tx.auditLog.create({ data: { userId: auth.user.id, action: "DELETE", entityType: section.model, entityId: id, beforeJson: JSON.stringify(before) } });
  });
  return NextResponse.json({ ok: true });
}
