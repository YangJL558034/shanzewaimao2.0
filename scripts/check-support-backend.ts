/** Real Prisma/SQLite + real route handlers, with isolated auth and a new temporary DB.
 * Run: node --conditions=react-server --import tsx scripts/check-support-backend.ts
 * Never reads the configured DATABASE_URL, user DB, sessions, contacts or email queue.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";
import { PrismaClient } from "@prisma/client";

async function main() {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "shanze-support-check-"));
  const client = new PrismaClient({ datasources: { db: { url: `file:${path.join(temporaryRoot, "support.db").replaceAll("\\", "/")}` } } });
  let authStatus = 200;
  const scope = globalThis as typeof globalThis & { __supportCheck?: Record<string, unknown> };
  scope.__supportCheck = {
    db: client,
    requireApiUser: async (permission: string) => {
      assert.equal(permission, "inquiries.read");
      return authStatus !== 200 ? { error: Response.json({ error: "Not allowed" }, { status: authStatus }) } : { user: { id: "isolated-agent" } };
    },
  };
  const hook = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/db" || specifier === "@/lib/auth") return { shortCircuit: true, url: pathToFileURL(path.join(process.cwd(), "scripts/fixtures/support-services.cjs")).href };
    if (specifier === "server-only") return { shortCircuit: true, url: pathToFileURL(path.join(process.cwd(), "node_modules/next/dist/compiled/server-only/empty.js")).href };
    return nextResolve(specifier, context);
  } });
  const originalTimezone = process.env.TZ;
  try {
    // Only tables used by these read/acknowledgement routes; no mail worker can run.
    await client.$executeRawUnsafe(`CREATE TABLE CustomerContact (id TEXT PRIMARY KEY, fullName TEXT, companyName TEXT, email TEXT UNIQUE, phone TEXT UNIQUE, country TEXT, source TEXT NOT NULL DEFAULT 'website', createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL)`);
    await client.$executeRawUnsafe(`CREATE TABLE User (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, isActive BOOLEAN NOT NULL DEFAULT true)`);
    await client.$executeRawUnsafe(`CREATE TABLE Conversation (id TEXT PRIMARY KEY, publicToken TEXT UNIQUE NOT NULL, contactId TEXT NOT NULL REFERENCES CustomerContact(id), channel TEXT NOT NULL, externalId TEXT, subject TEXT, status TEXT NOT NULL DEFAULT 'OPEN', sourceUrl TEXT, assignedToId TEXT, inquiryId TEXT, lastMessageAt DATETIME NOT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL)`);
    await client.$executeRawUnsafe(`CREATE TABLE ConversationMessage (id TEXT PRIMARY KEY, conversationId TEXT NOT NULL REFERENCES Conversation(id), direction TEXT NOT NULL, content TEXT NOT NULL, externalId TEXT, authorId TEXT, metadataJson TEXT, deliveredAt DATETIME, readAt DATETIME, createdAt DATETIME NOT NULL)`);
    const { getSupportAnalytics, getInboxSummary, supportDayKey } = await import("../lib/support-analytics");
    const summaryRoute = await import("../app/api/admin/inbox/summary/route");
    const analyticsRoute = await import("../app/api/admin/support-analytics/route");
    const inboxRoute = await import("../app/api/admin/inbox/route");
    const readRoute = await import("../app/api/admin/inbox/[id]/read/route");
    const now = new Date("2026-10-14T04:00:00.000Z");
    const previousDay = new Date("2026-10-13T15:59:59.999Z");
    const todayStart = new Date("2026-10-13T16:00:00.000Z");
    const earlier = new Date("2026-07-01T00:00:00.000Z");
    assert.equal(supportDayKey(previousDay), "2026-10-13");
    assert.equal(supportDayKey(todayStart), "2026-10-14");
    for (const id of ["customer-a", "customer-b", "empty-contact"]) await client.customerContact.create({ data: { id, fullName: id } });
    await client.conversation.createMany({ data: [
      { id: "a", contactId: "customer-a", channel: "WEBSITE", status: "OPEN", createdAt: earlier, lastMessageAt: now },
      { id: "a2", contactId: "customer-a", channel: "WHATSAPP", status: "PENDING", createdAt: todayStart, lastMessageAt: now },
      { id: "b", contactId: "customer-b", channel: "EMAIL", status: "RESOLVED", createdAt: todayStart, lastMessageAt: now },
      { id: "empty", contactId: "empty-contact", channel: "LINKEDIN", status: "OPEN", createdAt: earlier, lastMessageAt: earlier },
    ] });
    await client.conversationMessage.createMany({ data: [
      { id: "a-old", conversationId: "a", direction: "INBOUND", content: "Yesterday", createdAt: previousDay, readAt: previousDay },
      { id: "a-new", conversationId: "a", direction: "INBOUND", content: "Today unread A", createdAt: todayStart },
      { id: "a2-new", conversationId: "a2", direction: "INBOUND", content: "Same customer, another channel", createdAt: todayStart },
      { id: "b-new", conversationId: "b", direction: "INBOUND", content: "Today unread B", createdAt: now },
      { id: "b-outbound", conversationId: "b", direction: "OUTBOUND", content: "Reply, not a customer message", createdAt: now },
      { id: "a-internal", conversationId: "a", direction: "INTERNAL", content: "Not a customer message", createdAt: now },
    ] });
    process.env.TZ = "UTC";
    const data = await getSupportAnalytics(client, now);
    process.env.TZ = "America/Los_Angeles";
    assert.deepEqual(await getSupportAnalytics(client, now), data, "Linux/Windows process timezone must not change the reporting day");
    assert.equal(data.timezone, "Asia/Shanghai");
    assert.equal(data.daily.length, 90);
    assert.deepEqual(data.daily.at(-1), { key: "2026-10-14", label: "10-14", conversations: 2, customers: 2, inbound: 3, outbound: 1 });
    assert.equal(data.daily.at(-2)?.inbound, 1);
    assert.equal(data.daily[0].customers, 0);
    assert.deepEqual(data.summary, { todayCustomers: 2, todayConversations: 2, todayInbound: 3, totalConversations: 4, totalCustomers: 2, totalInbound: 4, totalOutbound: 1, unreadMessages: 3, unreadConversations: 3, openConversations: 2, pendingConversations: 1, resolvedConversations: 1 });
    assert.equal(data.channels.length, 5);
    assert.equal(data.channels.find((row) => row.channel === "WEBSITE")?.inbound, 2);
    const beforeGet = await client.conversationMessage.findMany({ orderBy: { id: "asc" } });
    const summary = await getInboxSummary(client);
    assert.deepEqual([summary.unreadMessages, summary.unreadConversations], [3, 3]);
    assert.ok(summary.recent.every((row) => row.unreadCount === 1));
    assert.ok(summary.recent.some((row) => row.preview === "Today unread B"));
    assert.ok(!JSON.stringify(summary).includes("publicToken"));
    const inbox = await inboxRoute.GET();
    assert.ok(inbox);
    const inboxData = await inbox.json();
    assert.equal(inboxData.data.find((row: { id: string }) => row.id === "b").unreadCount, 1);
    assert.ok(!JSON.stringify(inboxData).includes("publicToken"));
    assert.equal((await summaryRoute.GET())?.status, 200);
    assert.equal((await analyticsRoute.GET())?.status, 200);
    assert.deepEqual(await client.conversationMessage.findMany({ orderBy: { id: "asc" } }), beforeGet, "GET and polling must never clear unread state");
    const request = (messageIds: unknown, csrf = true) => new Request("http://localhost:3000/api/admin/inbox/a/read", {
      method: "POST", headers: { "content-type": "application/json", ...(csrf ? { origin: "http://localhost:3000", cookie: "enercore_csrf_v2=isolated-support", "x-csrf-token": "isolated-support" } : {}) }, body: JSON.stringify({ messageIds }),
    });
    const acknowledge = async (ids: unknown, conversationId = "a", csrf = true) => {
      const response = await readRoute.POST(request(ids, csrf), { params: Promise.resolve({ id: conversationId }) });
      assert.ok(response); return response;
    };
    for (const status of [401, 403]) {
      authStatus = status;
      assert.equal((await summaryRoute.GET())?.status, status);
      assert.equal((await analyticsRoute.GET())?.status, status);
      assert.equal((await inboxRoute.GET())?.status, status);
      assert.equal((await acknowledge(["a-new"])).status, status);
    }
    authStatus = 200;
    assert.equal((await acknowledge(["a-new"], "a", false)).status, 403);
    assert.equal((await acknowledge([])).status, 400);
    assert.equal((await acknowledge(["not-a-message"])).status, 400);
    assert.equal((await acknowledge(["b-new"])).status, 400, "Cannot acknowledge another conversation's message");
    assert.equal((await acknowledge(["b-outbound"], "b")).status, 400, "Cannot change a customer's outbound read receipt");
    assert.equal((await acknowledge(["a-internal"])).status, 400);
    assert.equal((await acknowledge(["a-new"], "missing")).status, 404);
    await client.conversationMessage.create({ data: { id: "arrived-later", conversationId: "a", direction: "INBOUND", content: "Arrived after the page rendered", createdAt: now } });
    const marked = await acknowledge(["a-new"]);
    assert.equal(marked.status, 200);
    const markedData = (await marked.json()).data;
    assert.equal(markedData.markedRead, 1);
    assert.equal(markedData.unreadCount, 1, "Concurrent new messages stay unread");
    const firstReadAt = (await client.conversationMessage.findUniqueOrThrow({ where: { id: "a-new" } })).readAt;
    assert.ok(firstReadAt);
    assert.equal((await (await acknowledge(["a-new", "a-new"])).json()).data.markedRead, 0);
    assert.deepEqual((await client.conversationMessage.findUniqueOrThrow({ where: { id: "a-new" } })).readAt, firstReadAt, "Idempotent read acknowledgement preserves the first read timestamp");
    assert.equal((await client.conversationMessage.findUniqueOrThrow({ where: { id: "b-outbound" } })).readAt, null);
    assert.equal((await client.conversationMessage.findUniqueOrThrow({ where: { id: "arrived-later" } })).readAt, null);
    assert.deepEqual([(await getInboxSummary(client)).unreadMessages, (await getInboxSummary(client)).unreadConversations], [3, 3]);
    console.log("PASS: isolated SQLite: exact unread counts, side-effect-free GET, message ownership, inbound/outbound separation, explicit acknowledgement, concurrent arrival, repeated acknowledgement, auth/CSRF rejection, Shanghai midnight, 90-day zero-fill, unique customer counts, statuses and channels. No live DB or email accessed.");
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ; else process.env.TZ = originalTimezone;
    await client.$disconnect(); hook.deregister(); delete scope.__supportCheck;
    assert.equal(path.dirname(path.resolve(temporaryRoot)).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
    assert.ok(path.basename(temporaryRoot).startsWith("shanze-support-check-"));
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
