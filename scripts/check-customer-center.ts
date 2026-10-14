/** Run: node --conditions=react-server --import tsx scripts/check-customer-center.ts
 * Builds a brand-new temporary SQLite database. Never reads live data or sends email.
 */
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

async function main() {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "shanze-customer-center-check-"));
  const databasePath = path.join(temporaryRoot, "isolated.db");
  let connection: DatabaseSync | undefined;
  let disconnect: (() => Promise<void>) | undefined;
  const serverOnlyHook = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: pathToFileURL(path.resolve("node_modules/next/dist/compiled/server-only/empty.js")).href, shortCircuit: true };
    return nextResolve(specifier, context);
  } });
  try {
    // Set isolation before importing any application module or Prisma client.
    Object.assign(process.env, { DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`, NODE_ENV: "test" });
    for (const key of Object.keys(process.env)) {
      if (/^(SMTP_|CRISP_|WHATSAPP_)/.test(key)) delete process.env[key];
    }
    globalThis.fetch = (() => { throw new Error("External network requests are prohibited in this isolated check."); }) as typeof fetch;
    connection = new DatabaseSync(databasePath);
    const migrationRoot = path.resolve("prisma", "migrations");
    const directories = (await readdir(migrationRoot, { withFileTypes: true })).filter((item) => item.isDirectory()).map((item) => item.name).sort();
    for (const directory of directories) connection.exec(await readFile(path.join(migrationRoot, directory, "migration.sql"), "utf8"));
    connection.close(); connection = undefined;

    const { db } = await import("../lib/db");
    disconnect = () => db.$disconnect();
    const { recordInboundMessage, recordOutboundMessage } = await import("../lib/customer-center");
    const sessionId = randomUUID();
    const identity = { channel: "WEBSITE" as const, externalId: `live-chat:${sessionId}`, fullName: "Isolated Mobile Buyer", companyName: "Integration Test", email: "isolated@example.invalid", sourceUrl: "http://192.168.0.208:3000/about", subject: "Website live chat" };
    const first = await recordInboundMessage({ ...identity, messageId: "isolated-first", content: "First mobile message", metadata: { entry: "website_chat" } });
    assert.ok(first.conversation.inquiryId, "The first message creates an associated CRM inquiry.");
    assert.ok(first.conversation.publicToken && first.conversation.publicToken.length >= 20, "The visitor gets a server-issued conversation credential.");
    assert.equal(first.conversation.contactId, first.contact.id);
    assert.equal(first.message.conversationId, first.conversation.id);
    const second = await recordInboundMessage({ ...identity, messageId: "isolated-second", content: "Follow-up from the same visitor" });
    assert.equal(second.contact.id, first.contact.id, "A follow-up does not duplicate the contact.");
    assert.equal(second.conversation.id, first.conversation.id, "A follow-up reuses the conversation.");
    assert.equal(second.conversation.inquiryId, first.conversation.inquiryId, "A follow-up reuses the CRM inquiry.");

    // Match the admin inbox and CRM query rules without creating a real admin/session.
    const inbox = await db.conversation.findMany({ include: { contact: true, assignedTo: { select: { id: true, name: true, email: true } }, messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true } } } } }, orderBy: { lastMessageAt: "desc" }, take: 150 });
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].status, "OPEN");
    assert.equal(inbox[0].messages.length, 2);
    const inquiries = await db.inquiry.findMany({ orderBy: { id: "desc" }, take: 200 });
    assert.equal(inquiries.length, 1);
    assert.equal(inquiries[0].id, first.conversation.inquiryId);
    assert.equal(inquiries[0].source, "website");
    assert.equal(await db.customerContact.count(), 1);
    assert.equal(await db.emailQueue.count(), 0, "Inbound persistence alone never sends/queues real email.");
    const sales = await db.user.create({ data: { name: "Isolated Sales", email: "sales@example.invalid", passwordHash: "not-a-login-password" } });
    const reply = await recordOutboundMessage(first.conversation.id, sales.id, "A sales reply visible to the customer");
    assert.equal(reply.delivery, "website_available");
    await db.conversationMessage.create({ data: { conversationId: first.conversation.id, authorId: sales.id, direction: "INTERNAL", content: "Private sales note must remain hidden" } });
    const { getPublicConversation, serializePublicConversation } = await import("../lib/public-chat");
    assert.equal(await getPublicConversation(first.conversation.id, "incorrect-token"), null, "Wrong visitor credentials never expose history.");
    const visible = await getPublicConversation(first.conversation.id, first.conversation.publicToken!);
    assert.ok(visible);
    const snapshot = serializePublicConversation(visible);
    assert.equal(snapshot.data.length, 3);
    assert.equal(snapshot.data.filter((message) => message.direction === "OUTBOUND").length, 1);
    assert.ok(!JSON.stringify(snapshot).includes("Private sales note"), "Internal CRM notes stay private.");
    const { processEmailQueue } = await import("../lib/email");
    const delivery = await processEmailQueue();
    assert.equal(delivery.configured, false);
    assert.equal(delivery.sent, 0);
    const queued = await db.emailQueue.findMany({ select: { to: true, status: true } });
    assert.equal(queued.length, 1);
    assert.ok(queued.every((item) => item.to.endsWith("@example.invalid") && item.status === "PENDING"));
    console.log("PASS: isolated first message + follow-up persist one customer/inquiry/conversation; both admin queries return them; authenticated visitor sees sales reply, not INTERNAL notes; wrong token rejected; no real email or network requests.");
  } finally {
    connection?.close();
    await disconnect?.();
    serverOnlyHook.deregister();
    const absoluteTemporaryRoot = path.resolve(temporaryRoot);
    assert.equal(path.dirname(absoluteTemporaryRoot).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
    assert.ok(path.basename(absoluteTemporaryRoot).startsWith("shanze-customer-center-check-"));
    await rm(absoluteTemporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
