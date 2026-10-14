import { after, NextResponse } from "next/server";
import { z } from "zod";
import { recordInboundMessage } from "@/lib/customer-center";
import { checkRateLimit, cleanText, getClientIp, verifyCsrf } from "@/lib/security";
import { db } from "@/lib/db";
import { getCustomerNotificationConfig } from "@/lib/customer-channel-settings";
import { processEmailQueue } from "@/lib/email";
import { getPublicConversation, serializePublicConversation } from "@/lib/public-chat";

export const runtime = "nodejs";

const schema = z.object({ fullName: z.string().min(2).max(100).optional(), email: z.string().email().max(254).optional(), phone: z.string().max(50).optional(), companyName: z.string().max(150).optional(), message: z.string().trim().min(1).max(5000), sessionId: z.string().uuid(), token: z.string().min(20).max(100).optional() });

export async function POST(request: Request) {
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "The secure chat token has expired. Please refresh and try again." }, { status: 403 });
  const ip = getClientIp(request);
  const rate = await checkRateLimit(`customer-chat:${ip}`, 60, 60);
  if (!rate.allowed) return NextResponse.json({ error: "Too many messages from this connection. Please try again later." }, { status: 429 });
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Please provide your name, a valid email address and a message." }, { status: 400 });
  const data = body.data;
  const existing = await db.conversation.findUnique({ where: { channel_externalId: { channel: "WEBSITE", externalId: `live-chat:${data.sessionId}` } }, include: { contact: true } });
  if (existing && existing.publicToken !== data.token) return NextResponse.json({ error: "Invalid conversation credentials." }, { status: 403 });
  if (!existing && (!data.fullName || !data.email)) return NextResponse.json({ error: "Please provide your name and business email to start the chat." }, { status: 400 });
  const email = existing?.contact.email || cleanText(data.email, 254).toLowerCase();
  const fullName = existing?.contact.fullName || cleanText(data.fullName, 100);
  const result = await recordInboundMessage({
    channel: "WEBSITE", externalId: `live-chat:${data.sessionId}`, messageId: `live-chat:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    fullName, companyName: existing?.contact.companyName || cleanText(data.companyName, 150), email, phone: existing?.contact.phone || cleanText(data.phone, 50), content: cleanText(data.message), subject: "Website live chat", sourceUrl: request.headers.get("referer") || "/", metadata: { entry: "website_chat" },
  });
  const notifications = await getCustomerNotificationConfig();
  const recipients = [...new Set(`${notifications.adminNotificationEmail},${notifications.salesNotificationEmails}`.split(/[,;\s]+/).filter(Boolean).map((item) => item.toLowerCase()))];
  const escaped = cleanText(data.message).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  await db.emailQueue.createMany({ data: recipients.map((to) => ({ templateKey: "live_chat_notice", to, subject: `New Live Chat — ${fullName}`, html: `<h2>New Live Chat message</h2><p><strong>${fullName.replace(/&/g, "&amp;")}</strong> · ${email.replace(/&/g, "&amp;")}</p><p>${escaped}</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/admin/inbox?conversation=${result.conversation.id}">Open customer conversation</a></p>`, text: `New Live Chat from ${fullName} (${email})\n\n${data.message}`, payloadJson: JSON.stringify({ conversationId: result.conversation.id, inquiryId: result.conversation.inquiryId }) })) });
  after(async () => { await processEmailQueue(Math.max(4, recipients.length)); });
  return NextResponse.json({ ok: true, conversationId: result.conversation.id, token: result.conversation.publicToken, message: { id: result.message.id, direction: result.message.direction, content: result.message.content, createdAt: result.message.createdAt } }, { status: 201, headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("conversation");
  const token = request.headers.get("x-chat-token");
  if (!id || !token) return NextResponse.json({ error: "Conversation credentials are required." }, { status: 400 });
  const conversation = await getPublicConversation(id, token);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  return NextResponse.json(serializePublicConversation(conversation), { headers: { "cache-control": "no-store" } });
}
