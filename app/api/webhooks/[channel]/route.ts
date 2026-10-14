import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { ConversationChannel } from "@prisma/client";
import { recordInboundMessage } from "@/lib/customer-center";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const channels: Record<string, ConversationChannel> = { crisp: "CRISP", whatsapp: "WHATSAPP", linkedin: "LINKEDIN", email: "EMAIL" };
function equals(a: string | null, b?: string) { if (!a || !b) return false; const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); }
function signature(raw: string, secret?: string) { return secret ? `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}` : ""; }

export async function GET(request: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params;
  if (channel !== "whatsapp") return NextResponse.json({ ok: true });
  const url = new URL(request.url);
  if (url.searchParams.get("hub.mode") === "subscribe" && equals(url.searchParams.get("hub.verify_token"), process.env.WHATSAPP_VERIFY_TOKEN)) return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
  return NextResponse.json({ error: "Webhook verification failed." }, { status: 403 });
}

export async function POST(request: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel: rawChannel } = await params;
  const channel = channels[rawChannel];
  if (!channel) return NextResponse.json({ error: "Unknown channel." }, { status: 404 });
  const raw = await request.text();
  if (rawChannel === "whatsapp" && !process.env.WHATSAPP_APP_SECRET) return NextResponse.json({ error: "WhatsApp webhook is not configured." }, { status: 503 });
  if (rawChannel === "whatsapp" && !equals(request.headers.get("x-hub-signature-256"), signature(raw, process.env.WHATSAPP_APP_SECRET))) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  const expectedSecret = rawChannel === "crisp" ? process.env.CRISP_WEBHOOK_SECRET : rawChannel === "linkedin" ? process.env.LINKEDIN_WEBHOOK_SECRET : process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  if (rawChannel !== "whatsapp" && !expectedSecret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  if (rawChannel !== "whatsapp" && !equals(request.headers.get("x-shanze-webhook-secret") || request.headers.get("x-crisp-signature"), expectedSecret) && !equals(request.headers.get("x-crisp-signature"), signature(raw, expectedSecret))) return NextResponse.json({ error: "Invalid webhook secret." }, { status: 401 });
  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Expected JSON payload." }, { status: 400 }); }
  try {
    if (channel === "WHATSAPP") {
      const value = body.entry?.[0]?.changes?.[0]?.value;
      const contact = value?.contacts?.[0];
      const item = value?.messages?.[0];
      if (!item) return NextResponse.json({ ok: true, ignored: true });
      const content = item.text?.body || item.button?.text || item.interactive?.button_reply?.title || "[Unsupported WhatsApp message]";
      await recordInboundMessage({ channel, externalId: item.from, messageId: item.id, phone: item.from, fullName: contact?.profile?.name, content, metadata: { type: item.type, payload: body } });
    } else {
      const sender = body.sender || body.contact || body.from || {};
      await recordInboundMessage({
        channel, externalId: String(body.conversationId || body.session_id || body.threadId || sender.id || sender.email || body.id || ""), messageId: body.messageId || body.message_id || body.id,
        fullName: sender.name || sender.fullName || body.name, companyName: sender.company || body.company, email: sender.email || body.email || (typeof body.from === "string" ? body.from : undefined), phone: sender.phone || body.phone,
        subject: body.subject || body.topic, content: body.content || body.message || body.text || body.body, sourceUrl: body.sourceUrl || body.url, metadata: { event: body.event || body.type },
      });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process webhook." }, { status: 400 }); }
}
