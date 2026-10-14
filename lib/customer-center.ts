import "server-only";
import { ConversationChannel, MessageDirection } from "@prisma/client";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { processEmailQueue } from "@/lib/email";

export type InboundMessage = {
  channel: ConversationChannel;
  externalId?: string;
  messageId?: string;
  fullName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  country?: string;
  subject?: string;
  content: string;
  sourceUrl?: string;
  inquiryId?: string;
  metadata?: Record<string, unknown>;
};

function clean(value?: string | null, max = 5000) {
  return String(value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").trim().slice(0, max);
}

function normalizedPhone(value?: string) {
  const phone = clean(value, 50).replace(/[^\d+]/g, "");
  return phone.length >= 6 ? phone : undefined;
}

export async function recordInboundMessage(input: InboundMessage) {
  const email = clean(input.email, 254).toLowerCase() || undefined;
  const phone = normalizedPhone(input.phone);
  const fullName = clean(input.fullName, 100) || undefined;
  const companyName = clean(input.companyName, 150) || undefined;
  const country = clean(input.country, 100) || undefined;
  const content = clean(input.content);
  if (!content) throw new Error("A message body is required.");

  return db.$transaction(async (tx) => {
    const contact = await tx.customerContact.findFirst({
      where: { OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
    }) || await tx.customerContact.create({ data: { email, phone, fullName, companyName, country, source: input.channel.toLowerCase() } });

    if (contact.id && (fullName || companyName || country || email || phone)) {
      await tx.customerContact.update({
        where: { id: contact.id },
        data: { fullName: fullName || contact.fullName, companyName: companyName || contact.companyName, country: country || contact.country, email: email || contact.email, phone: phone || contact.phone },
      });
    }

    const externalId = clean(input.externalId, 200) || undefined;
    const conversation = externalId
      ? await tx.conversation.upsert({
          where: { channel_externalId: { channel: input.channel, externalId } },
          update: { lastMessageAt: new Date(), status: "OPEN", subject: clean(input.subject, 200) || undefined, sourceUrl: clean(input.sourceUrl, 1000) || undefined },
          create: { contactId: contact.id, channel: input.channel, externalId, subject: clean(input.subject, 200) || undefined, sourceUrl: clean(input.sourceUrl, 1000) || undefined, inquiryId: input.inquiryId, lastMessageAt: new Date() },
        })
      : await tx.conversation.create({ data: { contactId: contact.id, channel: input.channel, subject: clean(input.subject, 200) || undefined, sourceUrl: clean(input.sourceUrl, 1000) || undefined, inquiryId: input.inquiryId, lastMessageAt: new Date() } });

    let linkedConversation = conversation;
    if (!conversation.inquiryId && !input.inquiryId) {
      const inquiry = await tx.inquiry.create({ data: {
        referenceNo: `CRM-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`,
        fullName: fullName || contact.fullName || "Website visitor", companyName: companyName || contact.companyName || "Individual buyer",
        email: email || contact.email || `unknown-${contact.id}@customer.invalid`, phone: phone || contact.phone,
        country: country || contact.country || "Unknown", productInterest: clean(input.subject, 150) || "Customer message", message: content,
        source: input.channel.toLowerCase(), consentAt: new Date(),
      } });
      linkedConversation = await tx.conversation.update({ where: { id: conversation.id }, data: { inquiryId: inquiry.id } });
    }
    const messageId = clean(input.messageId, 200) || undefined;
    const message = messageId
      ? await tx.conversationMessage.upsert({
          where: { conversationId_externalId: { conversationId: linkedConversation.id, externalId: messageId } },
          update: {},
          create: { conversationId: linkedConversation.id, direction: MessageDirection.INBOUND, content, externalId: messageId, metadataJson: input.metadata ? JSON.stringify(input.metadata).slice(0, 5000) : undefined },
        })
      : await tx.conversationMessage.create({ data: { conversationId: linkedConversation.id, direction: MessageDirection.INBOUND, content, metadataJson: input.metadata ? JSON.stringify(input.metadata).slice(0, 5000) : undefined } });
    return { contact, conversation: linkedConversation, message };
  });
}

export async function recordOutboundMessage(conversationId: string, authorId: string, content: string) {
  const body = clean(content);
  if (!body) throw new Error("Reply cannot be empty.");
  const conversation = await db.conversation.findUnique({ where: { id: conversationId }, include: { contact: true } });
  if (!conversation) throw new Error("Conversation not found.");
  const message = await db.$transaction(async (tx) => {
    const created = await tx.conversationMessage.create({ data: { conversationId, authorId, direction: MessageDirection.OUTBOUND, content: body } });
    await tx.conversation.update({ where: { id: conversationId }, data: { status: "PENDING", lastMessageAt: new Date() } });
    return created;
  });

  if ((conversation.channel === "EMAIL" || conversation.channel === "WEBSITE") && conversation.contact.email) {
    await db.emailQueue.create({ data: {
      templateKey: "customer_center_reply", to: conversation.contact.email,
      subject: conversation.subject || "Re: Your message to Shanze",
      html: `<p>${body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`,
      text: body, payloadJson: JSON.stringify({ conversationId, messageId: message.id }),
    } });
    processEmailQueue(2).catch(() => undefined);
    return conversation.channel === "WEBSITE"
      ? { message, delivery: "website_available" as const }
      : { message, delivery: "email_queued" as const };
  }
  if (conversation.channel === "CRISP" && conversation.externalId && process.env.CRISP_WEBSITE_ID && process.env.CRISP_IDENTIFIER && process.env.CRISP_KEY) {
    try {
      const auth = Buffer.from(`${process.env.CRISP_IDENTIFIER}:${process.env.CRISP_KEY}`).toString("base64");
      const response = await fetch(`https://api.crisp.chat/v1/website/${encodeURIComponent(process.env.CRISP_WEBSITE_ID)}/conversation/${encodeURIComponent(conversation.externalId)}/message`, {
        method: "POST", headers: { authorization: `Basic ${auth}`, "content-type": "application/json", "x-crisp-tier": "website" },
        body: JSON.stringify({ type: "text", from: "operator", origin: "chat", content: body }),
      });
      if (!response.ok) throw new Error(`Crisp returned ${response.status}`);
      await db.conversationMessage.update({ where: { id: message.id }, data: { deliveredAt: new Date() } });
      return { message, delivery: "crisp_sent" as const };
    } catch (error) { return { message, delivery: "saved" as const, transportError: error instanceof Error ? error.message : "Crisp delivery failed." }; }
  }
  if (conversation.channel === "WHATSAPP" && conversation.contact.phone && process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_GRAPH_API_VERSION) {
    try {
      const response = await fetch(`https://graph.facebook.com/${encodeURIComponent(process.env.WHATSAPP_GRAPH_API_VERSION)}/${encodeURIComponent(process.env.WHATSAPP_PHONE_NUMBER_ID)}/messages`, {
        method: "POST", headers: { authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: conversation.contact.phone.replace(/\D/g, ""), type: "text", text: { body } }),
      });
      if (!response.ok) throw new Error(`WhatsApp returned ${response.status}`);
      await db.conversationMessage.update({ where: { id: message.id }, data: { deliveredAt: new Date() } });
      return { message, delivery: "whatsapp_sent" as const };
    } catch (error) { return { message, delivery: "saved" as const, transportError: error instanceof Error ? error.message : "WhatsApp delivery failed." }; }
  }
  const whatsappUrl = conversation.channel === "WHATSAPP" && conversation.contact.phone
    ? `https://wa.me/${conversation.contact.phone.replace(/\D/g, "")}?text=${encodeURIComponent(body)}` : undefined;
  return { message, delivery: "saved" as const, whatsappUrl };
}

export const channelLabels: Record<ConversationChannel, string> = {
  WEBSITE: "Website form",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp Business",
  LINKEDIN: "LinkedIn",
  CRISP: "Crisp Live Chat",
};
