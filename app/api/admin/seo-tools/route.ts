import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/security";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/utils";
import { ga4IdPattern, googleTokenPattern, getSeoIntegrationConfig, saveSeoIntegrationConfig } from "@/lib/seo-settings";

const schema = z.object({ ga4Id: z.string().trim().refine((value) => value === "" || ga4IdPattern.test(value)), searchConsoleToken: z.string().trim().refine((value) => value === "" || googleTokenPattern.test(value)) });
export async function GET() {
  const auth = await requireApiUser("seo.read"); if ("error" in auth) return auth.error;
  const [data, products, posts, noIndexRoutes] = await Promise.all([
    getSeoIntegrationConfig(),
    db.product.count({ where: { status: "PUBLISHED", noIndex: false } }),
    db.news.count({ where: { status: "PUBLISHED", noIndex: false } }),
    db.seoMeta.findMany({ where: { noIndex: true }, select: { route: true } }),
  ]);
  return NextResponse.json({ data, origin: new URL(absoluteUrl("/")).origin, stats: { products, posts, noIndexRoutes: noIndexRoutes.map((item) => item.route) }, analyticsEnabled: process.env.NODE_ENV === "production" }, { headers: { "Cache-Control": "no-store" } });
}
export async function PUT(request: Request) {
  const auth = await requireApiUser("seo.write"); if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "请填写有效的 G- 衡量 ID 和 HTML 验证 token（仅 content 的值，不要粘贴完整标签）。" }, { status: 400 });
  const before = await getSeoIntegrationConfig();
  await saveSeoIntegrationConfig(parsed.data);
  await db.auditLog.create({ data: { userId: auth.user.id, action: "UPDATE_SEO_INTEGRATIONS", entityType: "Setting", beforeJson: JSON.stringify(before), afterJson: JSON.stringify(parsed.data) } });
  return NextResponse.json({ ok: true });
}
