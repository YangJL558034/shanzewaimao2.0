import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import env from "@next/env";

env.loadEnvConfig(process.cwd());
const db = new PrismaClient();
const base = process.env.CHAT_TEST_URL || "http://localhost:3000";
const runId = randomUUID();
const notificationKeys = ["customer_admin_notification_email", "customer_sales_notification_emails", "customer_whatsapp_number", "customer_linkedin_url", "customer_support_email", "customer_catalog_url", "customer_welcome_message"];
let savedSettings = [];
let settingsChanged = false;
let userId;
let conversationId;
let inquiryId;
let contactId;
let streamReader;
let streamController;
let streamBuffer = "";
const streamDecoder = new TextDecoder();
const publicHeaders = { "user-agent": "Shanze CRM integration check", "x-real-ip": `chat-check-${runId}` };

async function credentials(extraCookie = "") {
  const response = await fetch(`${base}/api/csrf`, { headers: { ...publicHeaders, cookie: extraCookie } });
  assert.equal(response.status, 200);
  const { token } = await response.json();
  return { ...publicHeaders, cookie: `${extraCookie}${extraCookie ? "; " : ""}enercore_csrf_v2=${token}`, "x-csrf-token": token, "content-type": "application/json" };
}

async function jsonRequest(path, headers, body, method = "POST") {
  const response = await fetch(`${base}${path}`, { method, headers, body: JSON.stringify(body) });
  const payload = await response.json();
  assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

async function nextStreamSnapshot(predicate) {
  const timeout = setTimeout(() => streamController?.abort(), 12000);
  try {
    while (true) {
      let boundary;
      while ((boundary = streamBuffer.indexOf("\n\n")) !== -1) {
        const frame = streamBuffer.slice(0, boundary);
        streamBuffer = streamBuffer.slice(boundary + 2);
        if (!frame.includes("event: messages")) continue;
        const payload = JSON.parse(frame.split("\n").find((line) => line.startsWith("data: ")).slice(6));
        if (predicate(payload)) return payload;
      }
      const chunk = await streamReader.read();
      assert.equal(chunk.done, false, "Live stream closed before the expected reply.");
      streamBuffer += streamDecoder.decode(chunk.value, { stream: true });
    }
  } finally { clearTimeout(timeout); }
}

try {
  // Never send integration-check messages through a real configured mail account.
  const smtpRows = await db.setting.findMany({ where: { key: { in: ["smtp_host", "smtp_user", "smtp_password"] } } });
  const smtp = Object.fromEntries(smtpRows.map((row) => [row.key, row.value]));
  assert.equal(Boolean((smtp.smtp_host || process.env.SMTP_HOST) && (smtp.smtp_user || process.env.SMTP_USER) && (smtp.smtp_password || process.env.SMTP_PASSWORD)), false, "Run this check on a local instance without configured SMTP.");
  const role = await db.role.findFirst({ where: { permissions: { some: { permission: { key: "*" } } } } });
  assert.ok(role, "Seed an administrator role before running the integration check.");
  const user = await db.user.create({ data: { email: `crm-check-${runId}@example.invalid`, name: "CRM integration check", passwordHash: "disabled-test-login", roles: { create: { roleId: role.id } } } });
  userId = user.id;
  const sessionToken = randomBytes(32).toString("base64url");
  await db.session.create({ data: { userId, tokenHash: createHash("sha256").update(sessionToken).digest("hex"), expiresAt: new Date(Date.now() + 300000) } });
  const adminHeaders = await credentials(`enercore_session=${sessionToken}`);
  const configResponse = await fetch(`${base}/api/admin/customer-channels`, { headers: adminHeaders });
  assert.equal(configResponse.status, 200);
  const config = await configResponse.json();
  savedSettings = await db.setting.findMany({ where: { key: { in: notificationKeys } } });
  settingsChanged = true;
  const adminEmail = `admin-${runId}@example.invalid`;
  const salesEmail = `sales-${runId}@example.invalid`;
  await jsonRequest("/api/admin/customer-channels", adminHeaders, { ...config.data, adminNotificationEmail: adminEmail, salesNotificationEmails: `${salesEmail},${adminEmail}` }, "PUT");

  const visitorHeaders = await credentials();
  const sessionId = randomUUID();
  const first = await jsonRequest("/api/customer-chat", visitorHeaders, { sessionId, fullName: "Integration visitor", email: `visitor-${runId}@example.invalid`, companyName: "Integration Company", message: "Can you quote OEM power banks?" });
  conversationId = first.conversationId;
  const conversation = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
  inquiryId = conversation.inquiryId;
  contactId = conversation.contactId;
  assert.ok(inquiryId, "Chat must create a CRM inquiry.");
  assert.ok(first.token, "Chat must return visitor credentials.");

  const invalidWrite = await fetch(`${base}/api/customer-chat`, { method: "POST", headers: visitorHeaders, body: JSON.stringify({ sessionId, message: "Unauthorized continuation" }) });
  assert.equal(invalidWrite.status, 403, "Knowing only the session ID must not authorize a message.");
  const second = await jsonRequest("/api/customer-chat", visitorHeaders, { sessionId, token: first.token, message: "We need 1000 units." });
  assert.equal(second.conversationId, conversationId, "Subsequent messages must reuse the CRM conversation.");

  const invalidStream = await fetch(`${base}/api/customer-chat/stream?conversation=${conversationId}`, { headers: { "x-chat-token": "invalid-conversation-token" } });
  assert.equal(invalidStream.status, 404);
  streamController = new AbortController();
  const stream = await fetch(`${base}/api/customer-chat/stream?conversation=${conversationId}`, { headers: { ...publicHeaders, "x-chat-token": first.token }, signal: streamController.signal });
  assert.equal(stream.status, 200);
  assert.ok(stream.headers.get("content-type").includes("text/event-stream"));
  streamReader = stream.body.getReader();
  const initialSnapshot = await nextStreamSnapshot((snapshot) => snapshot.data.length === 2);
  assert.equal(initialSnapshot.conversation.id, conversationId);
  const reply = await jsonRequest(`/api/admin/inbox/${conversationId}/messages`, adminHeaders, { content: "Our sales team can quote 1000 OEM units." });
  assert.equal(reply.message.direction, "OUTBOUND");
  await db.conversationMessage.create({ data: { conversationId, direction: "INTERNAL", content: "Private sales note" } });
  const liveReply = await nextStreamSnapshot((snapshot) => snapshot.data.some((message) => message.id === reply.message.id));
  assert.equal(liveReply.data.length, 3);
  assert.ok(liveReply.data.every((message) => message.direction !== "INTERNAL"));
  assert.equal(liveReply.data.find((message) => message.id === reply.message.id).authorName, "CRM integration check");
  assert.equal(liveReply.data.find((message) => message.id === reply.message.id).readAt, null, "Receiving a message must not mark a closed widget as read.");
  assert.ok(!JSON.stringify(liveReply).includes(first.token), "Live event must never expose visitor credentials.");
  const history = await fetch(`${base}/api/customer-chat?conversation=${conversationId}`, { headers: { ...publicHeaders, "x-chat-token": first.token } });
  assert.equal(history.status, 200);
  const messages = (await history.json()).data;
  assert.equal(messages.length, 3);
  assert.ok(messages.some((message) => message.id === reply.message.id && message.content === "Our sales team can quote 1000 OEM units."));
  assert.ok(messages.every((message) => message.direction !== "INTERNAL"));
  const invalidRead = await fetch(`${base}/api/customer-chat?conversation=${conversationId}`, { headers: { "x-chat-token": "invalid-conversation-token" } });
  assert.equal(invalidRead.status, 404);
  const nextReply = await jsonRequest(`/api/admin/inbox/${conversationId}/messages`, adminHeaders, { content: "Do you have a target delivery date?" });
  const readHeaders = { ...visitorHeaders, "x-chat-token": first.token };
  const missingCsrf = await fetch(`${base}/api/customer-chat/read`, { method: "POST", headers: { "content-type": "application/json", "x-chat-token": first.token }, body: JSON.stringify({ conversationId, messageId: reply.message.id }) });
  assert.equal(missingCsrf.status, 403);
  const invalidAck = await fetch(`${base}/api/customer-chat/read`, { method: "POST", headers: { ...readHeaders, "x-chat-token": "invalid-conversation-token" }, body: JSON.stringify({ conversationId, messageId: reply.message.id }) });
  assert.equal(invalidAck.status, 404);
  await jsonRequest("/api/customer-chat/read", readHeaders, { conversationId, messageId: reply.message.id });
  const readReply = await db.conversationMessage.findUniqueOrThrow({ where: { id: reply.message.id } });
  const unreadReply = await db.conversationMessage.findUniqueOrThrow({ where: { id: nextReply.message.id } });
  assert.ok(readReply.readAt);
  assert.equal(unreadReply.readAt, null, "A later reply must stay unread until it is displayed.");
  const updatedSnapshot = await nextStreamSnapshot((snapshot) => snapshot.data.some((message) => message.id === reply.message.id && message.readAt));
  assert.equal(updatedSnapshot.data.length, 4);
  const stillPrivate = await db.conversationMessage.findMany({ where: { conversationId, direction: { in: ["INBOUND", "INTERNAL"] } } });
  assert.ok(stillPrivate.every((message) => !message.readAt), "Read receipt must only mark sales messages.");
  const notices = await db.emailQueue.findMany({ where: { templateKey: "live_chat_notice", payloadJson: { contains: conversationId } } });
  assert.equal(notices.length, 4, "Two visitor messages must notify two distinct recipients each.");
  assert.equal(notices.filter((job) => job.to === adminEmail).length, 2);
  assert.equal(notices.filter((job) => job.to === salesEmail).length, 2);
  const contactPage = await fetch(`${base}/contact`).then((response) => response.text());
  assert.ok(!contactPage.includes(adminEmail), "Private notification recipients must not be exposed on the website.");
  assert.ok(!contactPage.includes('class="customer-chat-trigger'), "Duplicate Contact us trigger must be removed.");
  console.log("PASS: CRM inquiry creation, authenticated continuation, live sales-reply stream, closed-widget unread state, read receipts, internal-note privacy, admin/sales notifications and private configuration.");
} finally {
  streamController?.abort();
  if (streamReader) await streamReader.cancel().catch(() => undefined);
  if (conversationId) {
    await db.emailQueue.deleteMany({ where: { payloadJson: { contains: conversationId } } });
    await db.conversation.deleteMany({ where: { id: conversationId } });
  }
  if (inquiryId) await db.inquiry.deleteMany({ where: { id: inquiryId } });
  if (contactId) await db.customerContact.deleteMany({ where: { id: contactId } });
  if (settingsChanged) {
    for (const key of notificationKeys) {
      const previous = savedSettings.find((row) => row.key === key);
      if (previous) await db.setting.update({ where: { key }, data: { value: previous.value, group: previous.group, type: previous.type, isPublic: previous.isPublic } });
      else await db.setting.deleteMany({ where: { key } });
    }
  }
  if (userId) {
    await db.auditLog.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
  }
  await db.rateLimit.deleteMany({ where: { key: `customer-chat:chat-check-${runId}` } });
  await db.$disconnect();
}
