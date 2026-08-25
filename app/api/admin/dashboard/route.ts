import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/security";
import { dashboardDefaults, dashboardSettingKey } from "@/lib/dashboard";

const schema = z.object({
  version: z.literal(2),
  stats: z.array(z.enum(["products", "news", "inquiries", "pending", "visits", "subscribers", "admins", "media"])),
  quick: z.array(z.enum(["products", "news", "inquiries", "media", "seo", "security"])),
  panels: z.array(z.enum(["traffic", "subscriptions", "trend", "sources", "recent", "quick", "system", "audit"])),
});

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const setting = await db.setting.findUnique({ where: { key: dashboardSettingKey(auth.user.id) } });
  if (!setting) return NextResponse.json({ data: dashboardDefaults });
  try {
    return NextResponse.json({ data: schema.parse(JSON.parse(setting.value)) });
  } catch {
    return NextResponse.json({ data: dashboardDefaults });
  }
}

export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "安全令牌无效，请刷新后重试" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "控制台配置无效" }, { status: 400 });
  await db.$transaction([
    db.setting.upsert({
      where: { key: dashboardSettingKey(auth.user.id) },
      update: { value: JSON.stringify(parsed.data) },
      create: { group: "dashboard", key: dashboardSettingKey(auth.user.id), value: JSON.stringify(parsed.data), type: "json", isPublic: false },
    }),
    db.auditLog.create({ data: { userId: auth.user.id, action: "CUSTOMIZE_DASHBOARD", entityType: "settings", entityId: dashboardSettingKey(auth.user.id), afterJson: JSON.stringify(parsed.data) } }),
  ]);
  return NextResponse.json({ data: parsed.data });
}
