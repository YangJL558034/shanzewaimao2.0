// Isolated production UI regression. This script refuses live databases and port 3000.
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const base = process.env.INBOX_TEST_URL;
const databaseUrl = process.env.INBOX_TEST_DATABASE_URL;
assert.ok(base && databaseUrl, "Pass the isolated production URL and snapshot database URL explicitly.");
const target = new URL(base);
assert.equal(target.hostname, "127.0.0.1");
assert.ok(target.port && target.port !== "3000");
assert.ok(databaseUrl.startsWith("file:"));
const databaseFile = path.resolve(databaseUrl.slice(5));
const testRoot = path.dirname(databaseFile);
assert.equal(path.dirname(testRoot).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
assert.ok(path.basename(testRoot).startsWith("shanze-release-check-"));
assert.equal(path.basename(databaseFile), "snapshot.db");
await access(databaseFile);
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const profile = await mkdtemp(path.join(tmpdir(), "shanze-inbox-ui-"));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browserProcess, socket, userId;
let deniedUserId;
const contactIds = [];
let sequence = 0;
const pending = new Map();
const results = [];
const check = (label) => { results.push(label); console.log(`PASS: ${label}`); };
let summaryRequests = 0;
async function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 12_000);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(predicate, label = "browser condition", duration = 18_000) {
  const end = Date.now() + duration;
  while (Date.now() < end) { if (typeof predicate === "string" ? await evaluate(`Boolean(${predicate})`) : await predicate()) return; await pause(150); }
  const diagnostics = await evaluate("({url:location.href,rows:document.querySelectorAll('.inbox-row').length,pagination:document.querySelector('.inbox-pagination')?.innerText,disabled:document.querySelector('.inbox-load-more')?.disabled,errors:Array.from(document.querySelectorAll('.support-sync-error')).map(el=>el.innerText),requests:performance.getEntriesByType('resource').filter(entry=>entry.name.includes('/api/admin/inbox?')).slice(-6).map(entry=>entry.name)})");
  throw new Error(`Timed out: ${label}; ${JSON.stringify(diagnostics)}`);
}
async function screenshot(name) {
  const { data } = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(path.resolve("outputs", name), Buffer.from(data, "base64"));
}
const unread = (id) => db.conversationMessage.count({ where: { conversationId: id, direction: "INBOUND", readAt: null } });
async function selectConversation(name) {
  await evaluate(`Array.from(document.querySelectorAll('.inbox-row')).find(element=>element.innerText.includes(${JSON.stringify(name)})).click()`);
}

try {
  const role = await db.role.findFirst({ where: { permissions: { some: { permission: { key: "*" } } } } });
  assert.ok(role);
  const user = await db.user.create({ data: { email: `inbox-ui-${randomUUID()}@example.invalid`, name: "Inbox UI QA", passwordHash: "test-disabled-password", roles: { create: { roleId: role.id } } } });
  userId = user.id;
  const token = randomBytes(32).toString("hex");
  await db.session.create({ data: { userId, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600_000) } });
  async function fixture(name, messages) {
    const contact = await db.customerContact.create({ data: { fullName: name, email: `${randomUUID()}@example.invalid` } });
    contactIds.push(contact.id);
    return db.conversation.create({ data: { contactId: contact.id, channel: "WEBSITE", lastMessageAt: new Date(Date.now() + 60_000), messages: { create: messages.map((message, index) => ({ ...message, createdAt: new Date(Date.now() + index * 1000) })) } }, include: { messages: true } });
  }
  const first = await fixture("QA 阅读验证", [{ direction: "INBOUND", content: "First visible customer message" }, { direction: "INBOUND", content: "Second visible customer message" }, { direction: "OUTBOUND", content: "Customer receipt must remain unread" }]);
  const second = await fixture("QA 未打开", [{ direction: "INBOUND", content: "Do not mark another conversation read" }]);
  const long = await fixture("QA 长会话", [{ direction: "INBOUND", content: "Visible first unread message" }, ...Array.from({ length: 15 }, (_, i) => ({ direction: "INBOUND", readAt: new Date(), content: `Historical message ${i}\n${"Long chat record\n".repeat(6)}` })), { direction: "INBOUND", content: "Unread message below the fold" }]);
  const candidates = [process.env.ADMIN_TEST_BROWSER, "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].filter(Boolean);
  let executable;
  for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch {} }
  assert.ok(executable);
  const portServer = createServer();
  await new Promise((resolve) => portServer.listen(0, "127.0.0.1", resolve));
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  browserProcess = spawn(executable, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-default-apps", "--window-size=1440,1050", "about:blank"], { windowsHide: true, stdio: "ignore" });
  let page;
  for (let attempt = 0; attempt < 70; attempt++) {
    try { page = (await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())).find((item) => item.type === "page"); if (page) break; } catch {}
    await pause(150);
  }
  assert.ok(page?.webSocketDebuggerUrl);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Network.requestWillBeSent" && message.params.request.url.endsWith("/api/admin/inbox/summary")) summaryRequests++;
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message)); else handler.resolve(message.result);
  });
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  await command("Network.enable");
  const blocked = ["*://www.googletagmanager.com/*", "*://www.google-analytics.com/*", "*://client.crisp.chat/*", "*/api/analytics/visit"];
  await command("Network.setBlockedURLs", { urls: blocked });
  await command("Page.enable");
  await command("Page.addScriptToEvaluateOnNewDocument", { source: "window.__inboxErrors=[];window.addEventListener('error',event=>window.__inboxErrors.push(event.message));window.addEventListener('unhandledrejection',event=>window.__inboxErrors.push(String(event.reason)))" });
  await command("Network.setCookie", { name: "enercore_session", value: token, url: base, httpOnly: true, sameSite: "Lax" });
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  await mkdir(path.resolve("outputs"), { recursive: true });
  if (!process.argv.includes("--pagination-only")) {
  await command("Page.navigate", { url: `${base}/admin/inbox` });
  await waitFor("document.querySelector('.support-nav-badge') && document.querySelector('.inbox-row') && document.querySelector('.inbox-select-placeholder')", "inbox and unread badge render");
  await pause(700);
  assert.equal(await unread(first.id), 2);
  assert.equal(await unread(second.id), 1);
  assert.equal(await unread(long.id), 2);
  check("Opening the inbox does not implicitly read any conversation");
  await evaluate("document.querySelector('.admin-notifications button').click()");
  await waitFor("document.querySelector('.support-notification-panel')?.innerText.includes('QA 阅读验证')", "notification details");
  assert.ok(await evaluate("document.querySelector('.support-bell-badge').innerText === document.querySelector('.support-nav-badge').innerText"));
  await screenshot("inbox-notifications-desktop.png");
  await evaluate("document.querySelector('.admin-notifications button').click()");
  check("Sidebar and bell share unread counts and real customer message previews");
  await selectConversation("QA 阅读验证");
  await waitFor(async () => await unread(first.id) === 0, "visible messages read");
  assert.equal(await db.conversationMessage.count({ where: { conversationId: first.id, direction: "OUTBOUND", readAt: null } }), 1);
  assert.equal(await unread(second.id), 1);
  check("Reading the selected conversation does not clear other chats or customer read receipts");
  await selectConversation("QA 长会话");
  await waitFor(async () => await unread(long.id) === 1, "only visible history read");
  const unseen = long.messages.find((message) => message.content === "Unread message below the fold");
  assert.equal((await db.conversationMessage.findUnique({ where: { id: unseen.id } })).readAt, null);
  await evaluate("const chat=document.querySelector('.inbox-messages');chat.scrollTop=chat.scrollHeight");
  await waitFor(async () => await unread(long.id) === 0, "scroll-to-visible message read");
  check("Messages below the fold remain unread until scrolled into view");
  await evaluate("document.querySelector('.inbox-unread-filter').click()");
  await waitFor("document.querySelector('.inbox-unread-filter').getAttribute('aria-pressed')==='true'");
  assert.ok(await evaluate("Array.from(document.querySelectorAll('.inbox-row')).every(row=>row.querySelector('.support-unread-badge'))"));
  check("Unread-only filtering contains only conversations that still need reading");
  await evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'))");
  await selectConversation("QA 未打开");
  await pause(1000);
  assert.equal(await unread(second.id), 1);
  await evaluate("delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));document.querySelector('.inbox-messages').scrollTop=0");
  await waitFor(async () => await unread(second.id) === 0, "visible-tab acknowledgement resumes");
  check("Hidden-tab visibility guard prevents read acknowledgements until the page is visible");
  await db.conversationMessage.create({ data: { conversationId: first.id, direction: "INBOUND", content: "Live notification refresh fixture" } });
  await db.conversation.update({ where: { id: first.id }, data: { lastMessageAt: new Date(Date.now() + 120_000) } });
  await waitFor("document.querySelector('.support-message-toast')?.innerText.includes('QA 阅读验证')", "new-message toast");
  assert.equal(await unread(first.id), 1);
  const requestsBefore = summaryRequests;
  await pause(5600);
  assert.ok(summaryRequests - requestsBefore <= 2, "One shared summary poll rather than one poll per consumer");
  check("New messages refresh the badge and accessible notification without browser permission prompts");
  const beforeErrorBadge = await evaluate("document.querySelector('.support-nav-badge').innerText");
  await command("Network.setBlockedURLs", { urls: [...blocked, "*/api/admin/inbox/summary"] });
  await evaluate("document.querySelector('.admin-notifications button').click()");
  await waitFor("Boolean(document.querySelector('.support-notification-panel .support-sync-error'))", "offline feedback");
  assert.equal(await evaluate("document.querySelector('.support-nav-badge').innerText"), beforeErrorBadge);
  await command("Network.setBlockedURLs", { urls: blocked });
  await evaluate("document.querySelector('.support-notification-panel .support-sync-error button').click()");
  await waitFor("!document.querySelector('.support-notification-panel .support-sync-error')", "offline recovery");
  check("Sync failures display an error and preserve last-known unread counts");
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await command("Page.navigate", { url: `${base}/admin/inbox?unread=1` });
  await waitFor("document.querySelector('.inbox-unread-filter')?.getAttribute('aria-pressed')==='true' && document.querySelector('.inbox-row')", "mobile filtered inbox");
  assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth+1"), "Mobile has no horizontal overflow");
  assert.equal(await unread(first.id), 1);
  await screenshot("inbox-notifications-mobile.png");
  check("Mobile inbox fits the viewport and unread dashboard links retain their filter");
  assert.deepEqual(await evaluate("window.__inboxErrors"), []);
  }
  const older = await fixture("QA 分页旧未读", [{ direction: "INBOUND", content: "An older conversation beyond the former 150-row cap" }]);
  await db.conversation.update({ where: { id: older.id }, data: { lastMessageAt: new Date("2000-01-01") } });
  const archive = await db.customerContact.create({ data: { fullName: "QA 分页历史记录" } });
  contactIds.push(archive.id);
  await db.conversation.createMany({ data: Array.from({ length: 155 }, (_, index) => ({ contactId: archive.id, channel: "WEBSITE", lastMessageAt: new Date(Date.UTC(2025, 0, 1, 0, index)) })) });
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  await command("Page.navigate", { url: `${base}/admin/inbox?unread=1` });
  await waitFor("Array.from(document.querySelectorAll('.inbox-row')).some(row=>row.innerText.includes('QA 分页旧未读'))", "old unread row found beyond 150 records");
  assert.equal(await unread(older.id), 1);
  await command("Page.navigate", { url: `${base}/admin/inbox` });
  await waitFor("document.querySelectorAll('.inbox-row').length === 50 && document.querySelector('.inbox-load-more')", "first cursor page");
  await waitFor("!document.querySelector('.inbox-load-more').disabled", "load-more button enabled");
  await evaluate("document.querySelector('.inbox-load-more').click()");
  await waitFor("document.querySelectorAll('.inbox-row').length === 100", "load another cursor page");
  await evaluate("const input=document.querySelector('input[aria-label=\"搜索客服会话\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'  QA 分页旧未读  ');input.dispatchEvent(new Event('input',{bubbles:true}))");
  await waitFor("document.querySelectorAll('.inbox-row').length === 1 && document.querySelector('.inbox-row').innerText.includes('QA 分页旧未读')", "server-wide search including padded query");
  await command("Page.navigate", { url: `${base}/admin/inbox?conversation=${encodeURIComponent(older.id)}` });
  await waitFor("document.querySelector('.inbox-thread h3')?.innerText.includes('QA 分页旧未读')", "deep-linked older conversation");
  assert.ok(await evaluate("!Array.from(document.querySelectorAll('.inbox-row')).some(row=>row.innerText.includes('QA 分页旧未读'))"), "Deep-linked detail can open outside the first page");
  check("Old unread conversations beyond 150 rows are searchable, cursor pages load, and deep links open independently");
  const deniedUser = await db.user.create({ data: { email: `inbox-denied-${randomUUID()}@example.invalid`, name: "No support permission QA", passwordHash: "test-disabled-password" } });
  deniedUserId = deniedUser.id;
  const deniedToken = randomBytes(32).toString("hex");
  await db.session.create({ data: { userId: deniedUserId, tokenHash: createHash("sha256").update(deniedToken).digest("hex"), expiresAt: new Date(Date.now() + 3600_000) } });
  await command("Network.setCookie", { name: "enercore_session", value: deniedToken, url: base, httpOnly: true, sameSite: "Lax" });
  await command("Page.navigate", { url: `${base}/admin` });
  await waitFor("document.querySelector('.admin-profile')?.textContent.includes('No support permission QA')", "permission-limited dashboard");
  const deniedRequestsBefore = summaryRequests;
  await pause(5600);
  assert.equal(summaryRequests, deniedRequestsBefore, "No summary poll for users without inquiries.read");
  assert.ok(await evaluate("!document.querySelector('.admin-nav a[href=\"/admin/inbox\"]')"));
  await evaluate("document.querySelector('.admin-notifications button').click()");
  await waitFor("document.querySelector('.support-notification-panel')?.innerText.includes('没有客服消息查看权限')", "permission explanation");
  assert.equal(summaryRequests, deniedRequestsBefore);
  check("Accounts without support permission neither request customer messages nor expose inbox navigation");
  console.log(JSON.stringify({ result: "PASS", checks: results.length, results }));
} finally {
  try { await command("Browser.close"); } catch {}
  socket?.close(); browserProcess?.kill();
  if (contactIds.length) {
    const conversations = await db.conversation.findMany({ where: { contactId: { in: contactIds } }, select: { id: true } });
    const ids = conversations.map((item) => item.id);
    await db.conversationMessage.deleteMany({ where: { conversationId: { in: ids } } });
    await db.auditLog.deleteMany({ where: { userId } });
    await db.conversation.deleteMany({ where: { id: { in: ids } } });
    await db.customerContact.deleteMany({ where: { id: { in: contactIds } } });
  }
  if (userId) { await db.session.deleteMany({ where: { userId } }); await db.userRole.deleteMany({ where: { userId } }); await db.user.delete({ where: { id: userId } }); }
  if (deniedUserId) { await db.session.deleteMany({ where: { userId: deniedUserId } }); await db.user.delete({ where: { id: deniedUserId } }); }
  await db.$disconnect();
  assert.equal(path.dirname(path.resolve(profile)).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
  assert.ok(path.basename(profile).startsWith("shanze-inbox-ui-"));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  await writeFile(path.resolve("outputs/inbox-notifications-ui.json"), JSON.stringify({ results, checks: results.length }, null, 2));
}
