import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { cleanText, verifyCsrf } from "@/lib/security";

const statuses = ["NEW", "ASSIGNED", "CONTACTED", "QUALIFIED", "QUOTED", "WON", "LOST", "SPAM"] as const;
const schema = z.object({
  content: z.string().min(2).max(3000),
  type: z.enum(["note", "call", "email", "meeting", "quote", "task"]).default("note"),
  result: z.string().max(500).optional().default(""),
  statusAfter: z.enum(statuses).optional(),
  contactedAt: z.string().datetime().optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("inquiries.write");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "安全令牌无效，请刷新后重试" }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "跟进记录不完整" }, { status: 400 });
  const inquiry = await db.inquiry.findUnique({ where: { id } });
  if (!inquiry) return NextResponse.json({ error: "询盘不存在" }, { status: 404 });

  const contactedAt = parsed.data.contactedAt ? new Date(parsed.data.contactedAt) : new Date();
  const nextActionAt = parsed.data.nextActionAt ? new Date(parsed.data.nextActionAt) : null;
  const nextStatus = parsed.data.statusAfter || (["NEW", "ASSIGNED"].includes(inquiry.status) ? "CONTACTED" : inquiry.status);
  const clearNextAction = ["WON", "LOST", "SPAM"].includes(nextStatus);
  const [note] = await db.$transaction([
    db.inquiryNote.create({
      data: {
        inquiryId: id,
        userId: auth.user.id,
        type: parsed.data.type,
        content: cleanText(parsed.data.content, 3000),
        result: cleanText(parsed.data.result, 500) || null,
        statusAfter: nextStatus,
        contactedAt,
        nextActionAt: clearNextAction ? null : nextActionAt,
      },
      include: { user: { select: { id: true, name: true } } },
    }),
    db.inquiry.update({
      where: { id },
      data: { lastContactAt: contactedAt, nextFollowUpAt: clearNextAction ? null : nextActionAt, status: nextStatus },
    }),
    db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "CRM_FOLLOW_UP",
        entityType: "inquiry",
        entityId: id,
        afterJson: JSON.stringify({ ...parsed.data, statusAfter: nextStatus }),
      },
    }),
  ]);
  return NextResponse.json({ data: note }, { status: 201 });
}
