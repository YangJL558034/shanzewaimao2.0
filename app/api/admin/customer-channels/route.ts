import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/security";
import { db } from "@/lib/db";
import { getCustomerChannelConfig, saveCustomerChannelConfig, getCustomerNotificationConfig, saveCustomerNotificationConfig } from "@/lib/customer-channel-settings";
import { getSmtpConfig } from "@/lib/smtp-settings";

const emailList = z.string().max(2000).refine((value) => value.split(/[,;\s]+/).filter(Boolean).every((email) => z.string().email().safeParse(email).success));
const schema = z.object({ whatsappNumber: z.string().max(50), linkedinUrl: z.string().max(500), supportEmail: z.string().email().max(254), catalogUrl: z.string().min(1).max(500), welcomeMessage: z.string().min(5).max(1200), adminNotificationEmail: z.string().email().max(254), salesNotificationEmails: emailList.refine((value) => value.trim().length > 0) });
export async function GET() {
  const auth = await requireApiUser("settings.read"); if ("error" in auth) return auth.error;
  const [channels, notifications, smtp] = await Promise.all([getCustomerChannelConfig(), getCustomerNotificationConfig(), getSmtpConfig()]);
  return NextResponse.json({ data: { ...channels, ...notifications }, smtpConfigured: Boolean(smtp.host && smtp.user && smtp.password) });
}
export async function PUT(request: Request) {
  const auth = await requireApiUser("settings.write"); if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "请检查渠道配置及管理员、销售通知邮箱。" }, { status: 400 });
  await saveCustomerChannelConfig(parsed.data);
  await saveCustomerNotificationConfig(parsed.data);
  await db.auditLog.create({ data: { userId: auth.user.id, action: "UPDATE_CUSTOMER_CHANNELS", entityType: "Setting", afterJson: JSON.stringify(parsed.data) } });
  return NextResponse.json({ ok: true });
}
