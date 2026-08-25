import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { cleanText, verifyCsrf } from "@/lib/security";

const userSchema = z.object({
  type: z.literal("user"),
  name: z.string().min(2).max(100),
  email: z.string().email().max(254),
  password: z.string().min(10).max(128),
  roleId: z.string().min(1),
});
const roleSchema = z.object({
  type: z.literal("role"),
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional(),
  permissionIds: z.array(z.string()).default([]),
});

export async function GET() {
  const auth = await requireApiUser("security.read");
  if ("error" in auth) return auth.error;
  const [users, roles, permissions] = await Promise.all([
    db.user.findMany({
      select: {
        id: true, name: true, email: true, isActive: true, lastLoginAt: true,
        lockedUntil: true, createdAt: true, roles: { include: { role: true } },
        _count: { select: { sessions: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.role.findMany({
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    }),
    db.permission.findMany({ orderBy: { key: "asc" } }),
  ]);
  return NextResponse.json({ users, roles, permissions, currentUserId: auth.user.id });
}

export async function POST(request: Request) {
  const auth = await requireApiUser("security.write");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "安全令牌无效，请刷新后重试" }, { status: 403 });
  const raw = await request.json();
  if (raw.type === "user") {
    const parsed = userSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    try {
      const user = await db.user.create({
        data: {
          name: cleanText(parsed.data.name, 100),
          email: parsed.data.email.toLowerCase(),
          passwordHash: await bcrypt.hash(parsed.data.password, 12),
          roles: { create: { roleId: parsed.data.roleId } },
        },
      });
      await db.auditLog.create({
        data: { userId: auth.user.id, action: "CREATE_ADMIN", entityType: "user", entityId: user.id, afterJson: JSON.stringify({ name: user.name, email: user.email }) },
      });
      return NextResponse.json({ data: { id: user.id } }, { status: 201 });
    } catch {
      return NextResponse.json({ error: "邮箱已存在或账号创建失败" }, { status: 409 });
    }
  }
  const parsed = roleSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const role = await db.role.create({
    data: {
      name: cleanText(parsed.data.name, 80),
      description: cleanText(parsed.data.description, 300),
      permissions: { create: parsed.data.permissionIds.map((permissionId) => ({ permissionId })) },
    },
  });
  await db.auditLog.create({ data: { userId: auth.user.id, action: "CREATE_ROLE", entityType: "role", entityId: role.id } });
  return NextResponse.json({ data: role }, { status: 201 });
}

export async function PUT(request: Request) {
  const auth = await requireApiUser("security.write");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "安全令牌无效，请刷新后重试" }, { status: 403 });
  const raw = await request.json();
  if (raw.type === "user") {
    const parsed = z.object({
      type: z.literal("user"), id: z.string(), isActive: z.boolean().optional(),
      roleId: z.string().optional(), unlock: z.boolean().optional(),
      revokeSessions: z.boolean().optional(), password: z.string().min(10).max(128).optional(),
    }).safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "密码至少需要 10 位，或提交内容无效" }, { status: 400 });
    if (parsed.data.id === auth.user.id && parsed.data.isActive === false) return NextResponse.json({ error: "不能停用当前登录账号" }, { status: 400 });
    const data: Record<string, unknown> = {};
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
    if (parsed.data.unlock) Object.assign(data, { lockedUntil: null, failedLoginCount: 0 });
    if (parsed.data.password) data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: parsed.data.id }, data });
      if (parsed.data.roleId) {
        await tx.userRole.deleteMany({ where: { userId: parsed.data.id } });
        await tx.userRole.create({ data: { userId: parsed.data.id, roleId: parsed.data.roleId } });
      }
      if (parsed.data.revokeSessions || parsed.data.password) {
        await tx.session.deleteMany({ where: { userId: parsed.data.id, ...(parsed.data.id === auth.user.id && !parsed.data.password ? { id: { not: auth.user.sessionId } } : {}) } });
      }
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: parsed.data.password ? "CHANGE_ADMIN_PASSWORD" : "UPDATE_ADMIN",
          entityType: "user", entityId: parsed.data.id,
          afterJson: JSON.stringify({ isActive: parsed.data.isActive, roleId: parsed.data.roleId, unlock: parsed.data.unlock, revokeSessions: parsed.data.revokeSessions || Boolean(parsed.data.password) }),
        },
      });
    });
    return NextResponse.json({ ok: true, signedOut: Boolean(parsed.data.password && parsed.data.id === auth.user.id) });
  }
  const parsed = z.object({ type: z.literal("role"), id: z.string(), name: z.string().min(2).max(80), description: z.string().max(300).optional(), permissionIds: z.array(z.string()) }).safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "角色数据无效" }, { status: 400 });
  await db.$transaction(async (tx) => {
    await tx.role.update({ where: { id: parsed.data.id }, data: { name: cleanText(parsed.data.name, 80), description: cleanText(parsed.data.description, 300) } });
    await tx.rolePermission.deleteMany({ where: { roleId: parsed.data.id } });
    await tx.rolePermission.createMany({ data: parsed.data.permissionIds.map((permissionId) => ({ roleId: parsed.data.id, permissionId })) });
    await tx.auditLog.create({ data: { userId: auth.user.id, action: "UPDATE_ROLE", entityType: "role", entityId: parsed.data.id } });
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser("security.delete");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "安全令牌无效，请刷新后重试" }, { status: 403 });
  const parsed = z.object({ id: z.string().min(1) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "账号参数无效" }, { status: 400 });
  if (parsed.data.id === auth.user.id) return NextResponse.json({ error: "不能删除当前登录账号" }, { status: 400 });
  const target = await db.user.findUnique({
    where: { id: parsed.data.id },
    include: { roles: { include: { role: true } }, _count: { select: { inquiryNotes: true } } },
  });
  if (!target) return NextResponse.json({ error: "账号不存在" }, { status: 404 });
  if (target._count.inquiryNotes > 0) return NextResponse.json({ error: "该账号包含销售跟进记录，请先停用账号以保留审计归属" }, { status: 409 });
  const isSuperAdmin = target.roles.some((item) => item.role.name === "超级管理员");
  if (target.isActive && isSuperAdmin) {
    const activeSuperAdmins = await db.user.count({ where: { isActive: true, roles: { some: { role: { name: "超级管理员" } } } } });
    if (activeSuperAdmins <= 1) return NextResponse.json({ error: "不能删除最后一个启用的超级管理员" }, { status: 409 });
  }
  await db.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: { userId: auth.user.id, action: "DELETE_ADMIN", entityType: "user", entityId: target.id, beforeJson: JSON.stringify({ name: target.name, email: target.email, isActive: target.isActive }) },
    });
    await tx.user.delete({ where: { id: target.id } });
  });
  return NextResponse.json({ ok: true });
}
