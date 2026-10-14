import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getPublicConversation } from "@/lib/public-chat";
import { verifyCsrf } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  conversationId: z.string().min(1).max(100),
  messageId: z.string().min(1).max(100),
});

/** Acknowledge only sales messages that the authenticated visitor has displayed. */
export async function POST(request: Request) {
  const token = request.headers.get("x-chat-token");
  if (!token) return NextResponse.json({ error: "Conversation credentials are required." }, { status: 400 });
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "The secure chat token has expired. Please refresh and try again." }, { status: 403 });
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "A conversation and displayed message are required." }, { status: 400 });

  const conversation = await getPublicConversation(body.data.conversationId, token);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const message = conversation.messages.find((item) => item.id === body.data.messageId && item.direction === "OUTBOUND");
  if (!message) return NextResponse.json({ error: "Displayed sales message not found." }, { status: 404 });

  await db.conversationMessage.updateMany({
    where: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      readAt: null,
      OR: [{ createdAt: { lt: message.createdAt } }, { createdAt: message.createdAt, id: { lte: message.id } }],
    },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
