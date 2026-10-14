import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/security";

const schema = z.object({ messageIds: z.array(z.string().min(1).max(200)).min(1).max(500) }).strict();

/** Only acknowledge the messages the agent actually rendered. A concurrently arriving
 * message must remain unread, and outbound readAt continues to mean customer-read. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("inquiries.read");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  const payload = schema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: "Provide 1–500 visible inbound message IDs." }, { status: 400 });
  const { id } = await params;
  const messageIds = [...new Set(payload.data.messageIds)];
  const readAt = new Date();
  const result = await db.$transaction(async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id }, select: { id: true } });
    if (!conversation) return { error: "Conversation not found.", status: 404 } as const;
    const ownedCount = await tx.conversationMessage.count({ where: { id: { in: messageIds }, conversationId: id, direction: "INBOUND" } });
    if (ownedCount !== messageIds.length) return { error: "Messages must belong to this conversation and be inbound.", status: 400 } as const;
    const updated = await tx.conversationMessage.updateMany({
      where: { id: { in: messageIds }, conversationId: id, direction: "INBOUND", readAt: null }, data: { readAt },
    });
    const unreadCount = await tx.conversationMessage.count({ where: { conversationId: id, direction: "INBOUND", readAt: null } });
    return { data: { conversationId: id, markedRead: updated.count, unreadCount, readAt: readAt.toISOString() } };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
