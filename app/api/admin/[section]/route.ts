import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { coerceCmsData, getCmsSection } from "@/lib/cms";
import { attachInlineTranslations, saveInlineTranslations } from "@/lib/cms-translations";
import { requireApiUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/security";
import { getMediaUsageMap, usageFromMap } from "@/lib/media-usage";
import { ensureNewsletterTemplates, queuePublicationNotification } from "@/lib/newsletter";
import { pruneOperationalLogs } from "@/lib/log-retention";
import { prepareAuditRow } from "@/lib/audit-display";

function model(name: string) {
  return (db as unknown as Record<string, { findMany: Function; create: Function }>)[name];
}

export async function GET(request: Request, { params }: { params: Promise<{ section: string }> }) {
  const { section: key } = await params;
  const section = getCmsSection(key);
  if (!section) return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  const auth = await requireApiUser(`${section.permission}.read`);
  if ("error" in auth) return auth.error;
  if (key === "website-visits" || key === "audit") await pruneOperationalLogs();
  if (key === "email-templates" || key === "newsletter-subscribers") await ensureNewsletterTemplates();
  const url = new URL(request.url);
  const allowedFilters = new Set(section.fields.map((field) => field.key));
  const where = Object.fromEntries(
    [...url.searchParams.entries()].filter(([field, value]) => allowedFilters.has(field) && value !== ""),
  );
  const orderBy = ["website-visits", "audit", "login-logs"].includes(key)
    ? { createdAt: "desc" }
    : section.fields.some((field) => field.key === "sortOrder")
      ? { sortOrder: "asc" }
      : { id: "desc" };
  const rawData = await model(section.model).findMany({
    ...(Object.keys(where).length ? { where } : {}),
    orderBy,
    take: key === "website-visits" || key === "audit" ? 5000 : 200,
    ...(key === "inquiries"
      ? { include: {
          attachments: true,
          notes: { orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, name: true } } } },
          assignedTo: { select: { id: true, name: true, email: true } },
          assignmentHistory: {
            orderBy: { createdAt: "desc" },
            include: {
              fromAssignee: { select: { id: true, name: true } },
              toAssignee: { select: { id: true, name: true } },
              assignedBy: { select: { id: true, name: true } },
            },
          },
        } }
      : {}),
    ...(key === "products"
      ? { include: { images: { orderBy: { sortOrder: "asc" } } } }
      : {}),
    ...(key === "audit"
      ? { include: { user: { select: { name: true, email: true } } } }
      : {}),
  });
  let preparedData = key === "products" ? rawData.map((row: Record<string, unknown>) => ({ ...row, galleryImages: JSON.stringify(row.images || []) })) : rawData;
  if (key === "audit") {
    const actorSnapshots = await db.$queryRawUnsafe<Array<{ id: string; actorName: string | null; actorEmail: string | null }>>(
      'SELECT "id", "actorName", "actorEmail" FROM "AuditLog"',
    );
    const snapshotMap = new Map(actorSnapshots.map((snapshot) => [snapshot.id, snapshot]));
    preparedData = rawData.map((row: Record<string, unknown>) =>
      prepareAuditRow({ ...row, ...snapshotMap.get(String(row.id)) }),
    );
  }
  if (key === "media") {
    const usageMap = await getMediaUsageMap(rawData.map((row: Record<string, unknown>) => String(row.path || "")));
    preparedData = rawData.map((row: Record<string, unknown>) => ({ ...row, ...usageFromMap(usageMap, String(row.path || "")) }));
  }
  if (key === "trash") {
    preparedData = rawData.map((row: Record<string, unknown>) => {
      let deletedContent: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(String(row.dataJson || "{}"));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) deletedContent = parsed;
      } catch {
        deletedContent = {};
      }
      const displayName = String(deletedContent.name || deletedContent.title || deletedContent.key || deletedContent.fileName || row.entityId || "已删除内容");
      const summary = Object.entries(deletedContent)
        .filter(([key]) => !["dataJson", "content", "description", "specifications", "features", "applications", "faqs"].includes(key))
        .slice(0, 4)
        .map(([key, value]) => `${key}: ${String(value ?? "").slice(0, 80)}`)
        .join(" · ");
      return { ...row, displayName, deletedSummary: summary || "已保存删除前内容", deletedContent };
    });
  }
  const data = await attachInlineTranslations(section, preparedData);
  const relations: Record<string, unknown> = {};
  if (section.fields.some((f) => f.relation === "categories")) relations.categories = await db.productCategory.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } });
  if (section.fields.some((f) => f.relation === "news-categories")) relations["news-categories"] = await db.newsCategory.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } });
  if (section.fields.some((f) => f.relation === "admins")) relations.admins = await db.user.findMany({ select: { id: true, name: true }, where: { isActive: true } });
  if (section.fields.some((f) => f.relation === "products")) relations.products = await db.product.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  if (section.fields.some((f) => f.relation === "locales")) relations.locales = await db.locale.findMany({ select: { id: true, name: true }, where: { isActive: true } });
  if (key === "settings" || section.fields.some((f) => ["media", "mediaGallery", "visualMedia", "visualGallery", "file"].includes(f.type || ""))) relations.media = await db.media.findMany({ select: { id: true, name: true, path: true, mimeType: true, alt: true }, orderBy: { createdAt: "desc" }, take: 200 });
  if (section.fields.some((f) => f.translatable)) relations.translationLocales = await db.locale.findMany({ select: { id: true, name: true, code: true }, where: { isActive: true, isDefault: false }, orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ data, section, relations });
}

export async function POST(request: Request, { params }: { params: Promise<{ section: string }> }) {
  const { section: key } = await params;
  const section = getCmsSection(key);
  if (!section || section.readonly) return NextResponse.json({ error: "Not editable" }, { status: 405 });
  const auth = await requireApiUser(`${section.permission}.write`);
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  try {
    const input = await request.json();
    const data = coerceCmsData(section, input);
    if (section.key === "inquiries") Object.assign(data, { referenceNo: `ENQ-${Date.now()}`, consentAt: new Date() });
    const created = await model(section.model).create({ data });
    if (section.key === "products" && input.galleryImages) {
      const gallery = parseGalleryImages(input.galleryImages);
      if (gallery.length) await db.productImage.createMany({ data: gallery.map((image, index) => ({ productId: String(created.id), url: image.url, alt: image.alt, sortOrder: index })) });
    }
    await saveInlineTranslations(section, String(created.id), input._translations);
    await db.auditLog.create({ data: { userId: auth.user.id, action: "CREATE", entityType: section.model, entityId: created.id, afterJson: JSON.stringify(created) } });
    const createdRecord = created as Record<string, unknown>;
    const notification = (section.key === "products" || section.key === "news") && createdRecord.status === "PUBLISHED"
      ? await queuePublicationNotification(section.key === "news" ? "news" : "product", String(createdRecord.id))
      : null;
    return NextResponse.json({ data: created, notification }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Create failed" }, { status: 400 });
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
