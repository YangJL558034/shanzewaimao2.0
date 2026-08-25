import "server-only";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken, randomToken } from "@/lib/security";

export const SESSION_COOKIE = "enercore_session";
const SESSION_DAYS = 7;

export async function createSession(userId: string, request: Request) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.session.create({ data: {
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: request.headers.get("user-agent")?.slice(0, 500),
  }});
  return { token, expiresAt };
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive) return null;
  const permissions = new Set(session.user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.key)));
  return { ...session.user, sessionId: session.id, permissions };
}

export async function requireUser(permission?: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (permission && !user.permissions.has("*") && !user.permissions.has(permission)) redirect("/admin?denied=1");
  return user;
}

export async function requireApiUser(permission?: string) {
  const user = await getCurrentUser();
  if (!user) return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } }) } as const;
  if (permission && !user.permissions.has("*") && !user.permissions.has(permission)) return { error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "content-type": "application/json" } }) } as const;
  return { user } as const;
}

export async function audit(action: string, entityType: string, entityId?: string, before?: unknown, after?: unknown) {
  const user = await getCurrentUser();
  const h = await headers();
  await db.auditLog.create({ data: {
    userId: user?.id,
    action,
    entityType,
    entityId,
    beforeJson: before ? JSON.stringify(before) : undefined,
    afterJson: after ? JSON.stringify(after) : undefined,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim(),
  }});
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
