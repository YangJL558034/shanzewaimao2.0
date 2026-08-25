import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { cleanText, verifyCsrf } from "@/lib/security";

const schema = z.object({
  toAssigneeId: z.string().min(1).nullable(),
  reason: z.string().max(500).optional().default(""),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("inquiries.write");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "安全令牌无效，请刷新后重试" }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "请选择交接负责人" }, { status: 400 });
  const inquiry = await db.inquiry.findUnique({ where: { id }, select: { assignedToId: true, status: true } });
  if (!inquiry) return NextResponse.json({ error: "询盘不存在" }, { status: 404 });
  if (parsed.data.toAssigneeId) {
    const target = await db.user.findFirst({ where: { id: parsed.data.toAssigneeId, isActive: true }, select: { id: true } });
    if (!target) return NextResponse.json({ error: "目标负责人不存在或已停用" }, { status: 400 });
  }
  if (inquiry.assignedToId === parsed.data.toAssigneeId) return NextResponse.json({ error: "该负责人已经在处理此询盘" }, { status: 409 });

  const nextStatus = parsed.data.toAssigneeId && inquiry.status === "NEW" ? "ASSIGNED" : inquiry.status;
  const [assignment] = await db.$transaction([
    db.inquiryAssignment.create({
      data: {
        inquiryId: id,
        fromAssigneeId: inquiry.assignedToId,
        toAssigneeId: parsed.data.toAssigneeId,
        assignedById: auth.user.id,
        reason: cleanText(parsed.data.reason, 500) || null,
      },
      include: {
        fromAssignee: { select: { id: true, name: true } },
        toAssignee: { select: { id: true, name: true } },
        assignedBy: { select: { id: true, name: true } },
      },
    }),
    db.inquiry.update({ where: { id }, data: { assignedToId: parsed.data.toAssigneeId, status: nextStatus } }),
    db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: inquiry.assignedToId ? "CRM_HANDOFF" : "CRM_ASSIGN",
        entityType: "inquiry",
        entityId: id,
        beforeJson: JSON.stringify({ assignedToId: inquiry.assignedToId }),
        afterJson: JSON.stringify({ assignedToId: parsed.data.toAssigneeId, reason: parsed.data.reason }),
      },
    }),
  ]);
  return NextResponse.json({ data: assignment }, { status: 201 });
}
