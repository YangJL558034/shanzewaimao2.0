/** Read-only GET regression against 165 conversations in a new temporary SQLite DB.
 * Run: node --conditions=react-server --import tsx scripts/check-inbox-pagination.ts
 * Auth is isolated; the real Prisma client and inbox handler run unchanged.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";
import { PrismaClient, type ConversationChannel, type ConversationStatus } from "@prisma/client";

async function main() {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "shanze-inbox-page-check-"));
  const client = new PrismaClient({ datasources: { db: { url: `file:${path.join(temporaryRoot, "inbox.db").replaceAll("\\", "/")}` } } });
  let authStatus = 200;
  const scope = globalThis as typeof globalThis & { __supportCheck?: Record<string, unknown> };
  scope.__supportCheck = {
    db: client,
    requireApiUser: async (permission: string) => {
      assert.equal(permission, "inquiries.read");
      return authStatus === 200 ? { user: { id: "isolated-agent" } } : { error: Response.json({ error: "Denied" }, { status: authStatus }) };
    },
  };
  const hook = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/db" || specifier === "@/lib/auth") return { shortCircuit: true, url: pathToFileURL(path.join(process.cwd(), "scripts/fixtures/support-services.cjs")).href };
    if (specifier === "server-only") return { shortCircuit: true, url: pathToFileURL(path.join(process.cwd(), "node_modules/next/dist/compiled/server-only/empty.js")).href };
    return nextResolve(specifier, context);
  } });
  try {
    await client.$executeRawUnsafe(`CREATE TABLE CustomerContact (id TEXT PRIMARY KEY, fullName TEXT, companyName TEXT, email TEXT UNIQUE, phone TEXT UNIQUE, country TEXT, source TEXT NOT NULL DEFAULT 'website', createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL)`);
    await client.$executeRawUnsafe(`CREATE TABLE User (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, isActive BOOLEAN NOT NULL DEFAULT true)`);
    await client.$executeRawUnsafe(`CREATE TABLE Conversation (id TEXT PRIMARY KEY, publicToken TEXT UNIQUE NOT NULL, contactId TEXT NOT NULL REFERENCES CustomerContact(id), channel TEXT NOT NULL, externalId TEXT, subject TEXT, status TEXT NOT NULL DEFAULT 'OPEN', sourceUrl TEXT, assignedToId TEXT, inquiryId TEXT, lastMessageAt DATETIME NOT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL)`);
    await client.$executeRawUnsafe(`CREATE TABLE ConversationMessage (id TEXT PRIMARY KEY, conversationId TEXT NOT NULL REFERENCES Conversation(id), direction TEXT NOT NULL, content TEXT NOT NULL, externalId TEXT, authorId TEXT, metadataJson TEXT, deliveredAt DATETIME, readAt DATETIME, createdAt DATETIME NOT NULL)`);
    await client.customerContact.createMany({ data: [
      { id: "old-contact", fullName: "Archive Buyer", companyName: "Oldest Manufacturer", email: "oldest-buyer@example.invalid" },
      { id: "general-contact", fullName: "General buyer" },
    ] });
    const statuses: ConversationStatus[] = ["OPEN", "PENDING", "RESOLVED"];
    const channels: ConversationChannel[] = ["WEBSITE", "EMAIL", "WHATSAPP", "LINKEDIN", "CRISP"];
    const rows = Array.from({ length: 165 }, (_, index) => ({
      id: `conversation-${String(index).padStart(3, "0")}`,
      publicToken: `private-secret-${index}`, contactId: index === 0 ? "old-contact" : "general-contact",
      subject: index === 0 ? "Deep archive quotation" : `Request ${index}`,
      status: statuses[index % statuses.length], channel: channels[index % channels.length],
      lastMessageAt: new Date(Date.UTC(2026, 9, 14, 0, Math.floor(index / 3))),
    }));
    await client.conversation.createMany({ data: rows });
    const beforeRead = new Date("2026-10-13T00:00:00Z");
    const unreadIndexes = new Set([0, 10, 164]);
    await client.conversationMessage.createMany({ data: rows.flatMap((row, index) => [
      { id: `in-${index}`, conversationId: row.id, direction: "INBOUND" as const, content: `Message ${index}`, readAt: unreadIndexes.has(index) ? null : beforeRead },
      { id: `out-${index}`, conversationId: row.id, direction: "OUTBOUND" as const, content: "Reply awaiting customer read", readAt: null },
    ]) });
    const { GET } = await import("../app/api/admin/inbox/route");
    const fetchInbox = async (parameters: Record<string, string> = {}, expectedStatus = 200) => {
      const response = await GET(new Request(`http://localhost:3000/api/admin/inbox?${new URLSearchParams(parameters)}`));
      assert.ok(response);
      assert.equal(response.status, expectedStatus, `Request ${JSON.stringify(parameters)}`);
      const result = await response.json();
      assert.ok(!JSON.stringify(result).includes("publicToken"), "List/detail responses omit token field");
      assert.ok(!JSON.stringify(result).includes("private-secret-"), "List/detail responses omit token values");
      return result;
    };
    const before = await client.conversationMessage.findMany({ orderBy: { id: "asc" } });
    const initial = await fetchInbox();
    assert.equal(initial.data.length, 50);
    assert.deepEqual(initial.page, { total: 165, hasMore: true, nextCursor: "conversation-115", limit: 50 });
    assert.deepEqual(initial.totals, { open: 55, pending: 55, resolved: 55, channels: 5 });
    assert.equal(initial.selectedConversation, null);
    assert.equal((await fetchInbox({ limit: "150" })).data.length, 150);
    const collected: string[] = [];
    let cursor = "";
    const pageSizes: number[] = [];
    do {
      const page = await fetchInbox({ limit: "60", ...(cursor ? { cursor } : {}) });
      pageSizes.push(page.data.length);
      collected.push(...page.data.map((row: { id: string }) => row.id));
      cursor = page.page.nextCursor || "";
      assert.equal(Boolean(cursor), page.page.hasMore);
      assert.ok(pageSizes.length < 5, "Cursor must progress");
    } while (cursor);
    assert.deepEqual(pageSizes, [60, 60, 45]);
    assert.equal(new Set(collected).size, 165, "Stable cursor never repeats rows, including equal timestamps");
    assert.deepEqual(collected, rows.map((row) => row.id).reverse(), "Stable lastMessageAt/id ordering includes all historical rows");
    const unread = await fetchInbox({ unread: "1" });
    assert.equal(unread.page.total, 3);
    assert.deepEqual(unread.data.map((row: { id: string }) => row.id), [rows[164].id, rows[10].id, rows[0].id]);
    assert.ok(unread.data.every((row: { unreadCount: number }) => row.unreadCount === 1), "Outbound unread receipts are not staff unread messages");
    for (const query of ["Archive Buyer", "Oldest Manufacturer", "oldest-buyer@example.invalid", "Deep archive quotation"]) {
      const result = await fetchInbox({ query });
      assert.equal(result.page.total, 1);
      assert.equal(result.data[0].id, rows[0].id, "Search is applied before pagination, including the oldest record");
    }
    assert.equal((await fetchInbox({ query: "   " })).page.total, 165);
    for (const status of statuses) assert.equal((await fetchInbox({ status })).page.total, 55);
    for (const channel of channels) assert.equal((await fetchInbox({ channel })).page.total, 33);
    const combined = await fetchInbox({ status: "OPEN", channel: "EMAIL" });
    assert.equal(combined.page.total, rows.filter((row) => row.status === "OPEN" && row.channel === "EMAIL").length);
    assert.ok(combined.data.every((row: { status: string; channel: string }) => row.status === "OPEN" && row.channel === "EMAIL"));
    const deepLink = await fetchInbox({ conversation: rows[0].id, channel: "EMAIL", limit: "1" });
    assert.equal(deepLink.selectedConversation.id, rows[0].id, "A notification deep link loads beyond the first page and current filters");
    assert.equal(deepLink.selectedConversation.messages.length, 2);
    assert.equal(deepLink.selectedConversation.unreadCount, 1);
    assert.equal((await fetchInbox({ conversation: "missing-conversation" })).selectedConversation, null);
    assert.equal((await fetchInbox({ cursor: "missing-cursor" })).data.length, 0, "Unknown cursor does not produce a server error");
    const invalidParameters: Record<string, string>[] = [{ limit: "0" }, { limit: "-1" }, { limit: "151" }, { limit: "1.5" }, { limit: "NaN" }, { query: "x".repeat(161) }, { status: "BOGUS" }, { channel: "BOGUS" }, { unread: "true" }, { cursor: "" }, { conversation: "" }];
    for (const invalid of invalidParameters) await fetchInbox(invalid, 400);
    for (const status of [401, 403]) {
      authStatus = status;
      await fetchInbox({}, status);
      await fetchInbox({ conversation: rows[0].id }, status);
    }
    authStatus = 200;
    assert.deepEqual(await client.conversationMessage.findMany({ orderBy: { id: "asc" } }), before, "Listing/search/filter/paging/deep links never change message readAt");
    console.log("PASS: isolated SQLite / 165 conversations: all pages without duplicates, tied timestamps, oldest unread/search, status/channel filters, deep-link detail beyond filters, no publicToken exposure, no GET read effects, invalid parameters and permissions.");
  } finally {
    await client.$disconnect(); hook.deregister(); delete scope.__supportCheck;
    assert.equal(path.dirname(path.resolve(temporaryRoot)).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
    assert.ok(path.basename(temporaryRoot).startsWith("shanze-inbox-page-check-"));
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
