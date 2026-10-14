import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/security";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const listSchema = z.object({
  query: z.string().max(160).optional(),
  status: z.enum(["OPEN", "PENDING", "RESOLVED"]).optional(),
  channel: z.enum(["WEBSITE", "EMAIL", "WHATSAPP", "LINKEDIN", "CRISP"]).optional(),
  unread: z.enum(["1", "0"]).optional(),
  cursor: z.string().min(1).max(160).optional(),
  conversation: z.string().min(1).max(160).optional(),
  limit: z.coerce.number().int().min(1).max(150).default(50),
});
const conversationInclude = { contact: true, assignedTo: { select: { id: true, name: true, email: true } }, messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { author: { select: { id: true, name: true } } } } } satisfies Prisma.ConversationInclude;
type InboxConversation = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;
function publicConversation({ publicToken: _publicToken, ...conversation }: InboxConversation) {
  return { ...conversation, unreadCount: conversation.messages.filter((message) => message.direction === "INBOUND" && !message.readAt).length };
}

export async function GET(request?: Request) {
  const auth = await requireApiUser("inquiries.read");
  if ("error" in auth) return auth.error;
  const parsed = listSchema.safeParse(Object.fromEntries(request ? new URL(request.url).searchParams : []));
  if (!parsed.success) return NextResponse.json({ error: "Invalid inbox filters." }, { status: 400 });
  const { query, status, channel, unread, cursor, conversation, limit } = parsed.data;
  const where: Prisma.ConversationWhereInput = {
    ...(status ? { status } : {}), ...(channel ? { channel } : {}),
    ...(unread === "1" ? { messages: { some: { direction: "INBOUND", readAt: null } } } : {}),
    ...(query?.trim() ? { OR: [{ subject: { contains: query.trim() } }, { contact: { fullName: { contains: query.trim() } } }, { contact: { companyName: { contains: query.trim() } } }, { contact: { email: { contains: query.trim() } } }] } : {}),
  };
  const [conversations, agents, total, selected, statuses, channels] = await Promise.all([
    db.conversation.findMany({
      where, include: conversationInclude,
      orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }], take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    db.user.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    db.conversation.count({ where }),
    conversation ? db.conversation.findUnique({ where: { id: conversation }, include: conversationInclude }) : null,
    db.conversation.groupBy({ by: ["status"], _count: { _all: true } }),
    db.conversation.groupBy({ by: ["channel"] }),
  ]);
  const hasMore = conversations.length > limit;
  const data = conversations.slice(0, limit).map(publicConversation);
  const totals = { open: statuses.find((item) => item.status === "OPEN")?._count._all || 0, pending: statuses.find((item) => item.status === "PENDING")?._count._all || 0, resolved: statuses.find((item) => item.status === "RESOLVED")?._count._all || 0, channels: channels.length };
  return NextResponse.json({ data, agents, totals, selectedConversation: selected ? publicConversation(selected) : null, page: { total, hasMore, nextCursor: hasMore ? data.at(-1)?.id : null, limit } }, { headers: { "Cache-Control": "private, no-store" } });
}

const updateSchema = z.object({ status: z.enum(["OPEN", "PENDING", "RESOLVED"]).optional(), assignedToId: z.string().nullable().optional() });
export async function PATCH(request: Request) {
  const auth = await requireApiUser("inquiries.write");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  const body = updateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid conversation update." }, { status: 400 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Conversation id is required." }, { status: 400 });
  const conversation = await db.conversation.update({ where: { id }, data: body.data });
  await db.auditLog.create({ data: { userId: auth.user.id, action: "CONVERSATION_UPDATE", entityType: "conversation", entityId: id, afterJson: JSON.stringify(body.data) } });
  return NextResponse.json({ data: conversation });
}
