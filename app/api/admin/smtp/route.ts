import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyCsrf } from "@/lib/security";
import { getSmtpConfig, saveSmtpConfig } from "@/lib/smtp-settings";

const schema = z.object({
  host: z.string().min(2).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string().min(2).max(255),
  password: z.string().max(500).optional(),
  from: z.string().min(3).max(320),
  notifyTo: z.string().email().max(254),
});

export async function GET() {
  const auth = await requireApiUser("settings.read");
  if ("error" in auth) return auth.error;
  const config = await getSmtpConfig();
  return NextResponse.json({
    data: {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      from: config.from,
      notifyTo: config.notifyTo,
      passwordConfigured: Boolean(config.password),
    },
  });
}

export async function PUT(request: Request) {
  const auth = await requireApiUser("settings.write");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "安全令牌无效，请刷新页面重试" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "请检查 SMTP 配置" }, { status: 400 });
  await saveSmtpConfig(parsed.data);
  await db.auditLog.create({ data: { userId: auth.user.id, action: "UPDATE_SMTP", entityType: "Setting", afterJson: JSON.stringify({ ...parsed.data, password: parsed.data.password ? "[UPDATED]" : "[UNCHANGED]" }) } });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const auth = await requireApiUser("settings.write");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "安全令牌无效，请刷新页面重试" }, { status: 403 });
  const config = await getSmtpConfig();
  if (!config.host || !config.user || !config.password) return NextResponse.json({ error: "请先保存完整的 SMTP 服务器、账号和授权密码" }, { status: 400 });
  try {
    const transporter = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.password } });
    await transporter.verify();
    return NextResponse.json({ ok: true, message: "SMTP 连接和账号认证成功" });
  } catch (error) {
    return NextResponse.json({ error: `SMTP 连接失败：${error instanceof Error ? error.message : String(error)}` }, { status: 400 });
  }
}
