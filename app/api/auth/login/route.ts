import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp, hashToken, sameToken, secureCookieForRequest } from "@/lib/security";
import { createSession, SESSION_COOKIE, verifyPassword } from "@/lib/auth";

const schema = z.object({ username: z.string().min(2).max(254), password: z.string().min(8).max(128), captcha: z.string().regex(/^\d{4}$/) });

function loginChallengeIsValid(request: Request, code: string) {
  const [expiresAtRaw, nonce, expected] = (request.headers.get("x-login-token") || "").split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!expiresAt || expiresAt < Date.now() || expiresAt > Date.now() + 6 * 60_000 || !nonce || !expected) return false;
  const secret = process.env.AUTH_SECRET || process.env.CSRF_SECRET || "local-development-captcha-secret";
  return sameToken(expected, hashToken(`${secret}:login:${expiresAtRaw}.${nonce}:${code}`));
}

function originIsAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  // Browsers set this protected header for a same-origin form submission. It
  // remains reliable when Next.js is reached through a LAN address or reverse
  // proxy whose internal request URL uses a different host.
  if (request.headers.get("sec-fetch-site") === "same-origin") return true;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const requestHost = forwardedHost || request.headers.get("host");
    const configured = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : null;
    return (
      originUrl.host === requestHost ||
      originUrl.hostname === requestUrl.hostname ||
      originUrl.origin === configured?.origin
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!originIsAllowed(request)) return NextResponse.json({ error: "登录来源无效" }, { status: 403 });
  const ip = getClientIp(request);
  const rate = await checkRateLimit(`login:${ip}`, 5, 900);
  if (!rate.allowed) return NextResponse.json({ error: "登录尝试过多，请稍后再试" }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "请输入用户名、密码和四位数字验证码" }, { status: 400 });
  if (!loginChallengeIsValid(request, parsed.data.captcha)) return NextResponse.json({ error: "验证码错误或已过期，请刷新验证码" }, { status: 401 });
  const identifier = parsed.data.username.trim();
  const directUser = await db.user.findFirst({ where: { OR: [{ email: identifier.toLowerCase() }, { name: identifier }] } });
  const user = directUser || (await db.user.findMany()).find((item) => item.name.toLowerCase() === identifier.toLowerCase());
  const email = user?.email || identifier.toLowerCase();
  const meta = { email, ip, userAgent: request.headers.get("user-agent")?.slice(0, 500) };
  if (!user || !user.isActive) {
    await db.loginLog.create({ data: { ...meta, success: false, reason: "INVALID_CREDENTIALS" } });
    return NextResponse.json({ error: "用户名或密码不正确" }, { status: 401 });
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await db.loginLog.create({ data: { ...meta, userId: user.id, success: false, reason: "ACCOUNT_LOCKED" } });
    return NextResponse.json({ error: "账号已临时锁定，请稍后再试" }, { status: 423 });
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    const failures = user.failedLoginCount + 1;
    await db.user.update({ where: { id: user.id }, data: { failedLoginCount: failures >= 5 ? 0 : failures, lockedUntil: failures >= 5 ? new Date(Date.now() + 15 * 60_000) : null } });
    await db.loginLog.create({ data: { ...meta, userId: user.id, success: false, reason: "INVALID_CREDENTIALS" } });
    return NextResponse.json({ error: "用户名或密码不正确" }, { status: 401 });
  }
  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await db.loginLog.create({ data: { ...meta, userId: user.id, success: true } });
  const session = await createSession(user.id, request);
  const response = NextResponse.json({ ok: true, userName: user.name });
  response.cookies.set(SESSION_COOKIE, session.token, { httpOnly: true, sameSite: "lax", secure: secureCookieForRequest(request), path: "/", expires: session.expiresAt });
  return response;
}
