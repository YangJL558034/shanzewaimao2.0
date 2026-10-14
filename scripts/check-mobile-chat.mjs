// Native mobile-touch QA over LAN HTTP. All chat requests are intercepted, never sent to CRM/email.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import path from "node:path";

const base = new URL(process.env.MOBILE_CHAT_TEST_URL || "http://192.168.0.208:3000").origin;
assert.equal(new URL(base).protocol, "http:", "This regression deliberately tests ordinary LAN HTTP.");
const profile = await mkdtemp(path.join(tmpdir(), "shanze-mobile-chat-"));
await mkdir(path.resolve("outputs"), { recursive: true });
const output = await mkdtemp(path.join(path.resolve("outputs"), "mobile-chat-"));
const pending = new Map();
const posts = [];
const acceptedMessages = [];
const blockedMutations = [];
const checks = [];
const token = "mobile-qa-mock-token-no-real-conversation";
const conversationId = "mobile-qa-mock-conversation";
const salesReply = { id: "qa-sales-1", direction: "OUTBOUND", content: "Hello from the mock Shanze sales team. Your message is visible here.", authorName: "Mock Shanze sales", createdAt: new Date().toISOString(), readAt: null };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let replyEnabled = false;
let reads = 0;
let snapshots = 0;
let browser;
let socket;
let sequence = 0;
let environment;

async function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 12000);
    pending.set(id, { resolve: (result) => { clearTimeout(timer); resolve(result); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) { if (await evaluate(expression)) return; await pause(60); }
  throw new Error(`Condition not reached: ${expression}`);
}

async function waitForPost(count) {
  const started = Date.now();
  while (Date.now() - started < 8000) { if (posts.length === count) return posts[count - 1]; await pause(30); }
  throw new Error(`Expected ${count} intercepted chat POSTs, received ${posts.length}.`);
}

async function tap(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest',behavior:'instant'})`);
  const point = await evaluate(`(() => {const box=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:box.left+box.width/2,y:box.top+box.height/2};})()`);
  assert.ok(point.x > 0 && point.x < 390 && point.y > 0 && point.y < 844, `Touch target must be visible: ${selector} ${JSON.stringify(point)}`);
  await command("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, id: 1 }] });
  await pause(35);
  await command("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function type(selector, text) {
  await tap(selector);
  await command("Input.insertText", { text });
  await waitFor(`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(text)}`);
}

async function fulfill(requestId, status, body) {
  await command("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "content-type", value: "application/json; charset=utf-8" }, { name: "cache-control", value: "no-store" }], body: Buffer.from(JSON.stringify(body)).toString("base64") });
}

async function confirm(post) {
  const message = { id: `qa-visitor-${acceptedMessages.length + 1}`, direction: "INBOUND", content: post.body.message, createdAt: new Date().toISOString(), readAt: null, authorName: "You" };
  acceptedMessages.push(message);
  await fulfill(post.requestId, 201, { ok: true, conversationId, token, message });
}

async function screenshot(filename) {
  const { data } = await command("Page.captureScreenshot", { format: "png" });
  await writeFile(path.join(output, filename), Buffer.from(data, "base64"), { flag: "wx" });
}

try {
  const candidates = [process.env.MOBILE_CHAT_TEST_BROWSER, process.env.ADMIN_TEST_BROWSER, "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].filter(Boolean);
  let executable;
  for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch { /* Try another installed browser. */ } }
  assert.ok(executable, "Set MOBILE_CHAT_TEST_BROWSER to an installed Edge or Chrome executable.");
  const portServer = createServer();
  await new Promise((resolve) => portServer.listen(0, "127.0.0.1", resolve));
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  browser = spawn(executable, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-default-apps", "about:blank"], { windowsHide: true, stdio: "ignore" });
  let page;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { page = (await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json())).find((entry) => entry.type === "page"); if (page) break; } catch { /* Wait only for this isolated browser. */ }
    await pause(100);
  }
  assert.ok(page?.webSocketDebuggerUrl);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Fetch.requestPaused") {
      const { requestId, request } = message.params;
      const url = new URL(request.url);
      if (url.pathname === "/api/customer-chat" && request.method === "POST") {
        const csrfHeader = Object.entries(request.headers).find(([name]) => name.toLowerCase() === "x-csrf-token")?.[1];
        posts.push({ requestId, body: JSON.parse(request.postData || "{}"), hasCsrf: !!csrfHeader });
        return; // Test explicitly releases the response after checking the pending draft.
      }
      if (url.pathname === "/api/customer-chat" && request.method === "GET") {
        snapshots++;
        fulfill(requestId, 200, { data: [...acceptedMessages, ...(replyEnabled ? [salesReply] : [])], conversation: { id: conversationId, status: "OPEN" } }).catch(() => undefined);
        return;
      }
      if (url.pathname === "/api/customer-chat/stream") { fulfill(requestId, 503, { error: "Mock stream outage: exercise polling fallback." }).catch(() => undefined); return; }
      if (url.pathname === "/api/customer-chat/read") { reads++; fulfill(requestId, 200, { ok: true }).catch(() => undefined); return; }
      const block = !["GET", "HEAD"].includes(request.method) || url.pathname.startsWith("/api/analytics/") || url.pathname.startsWith("/api/customer-chat/");
      if (block) blockedMutations.push({ method: request.method, path: url.pathname });
      command(block ? "Fetch.failRequest" : "Fetch.continueRequest", block ? { requestId, errorReason: "BlockedByClient" } : { requestId }).catch(() => undefined);
      return;
    }
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message)); else handler.resolve(message.result);
  });
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  await command("Network.enable");
  await command("Network.setBlockedURLs", { urls: ["*://*.googletagmanager.com/*", "*://*.google-analytics.com/*", "*://*.doubleclick.net/*", "*://client.crisp.chat/*", "*/api/analytics/*"] });
  await command("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  await command("Page.enable");
  await command("Page.addScriptToEvaluateOnNewDocument", { source: "localStorage.setItem('enercore_cookie_consent','necessary');window.__mobileChatErrors=[];window.addEventListener('error',event=>{if(event.message)window.__mobileChatErrors.push(event.message)})" });
  await command("Network.setCookie", { name: "locale", value: "en", url: base, sameSite: "Lax" });
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await command("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await command("Emulation.setFocusEmulationEnabled", { enabled: true });
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await command("Page.navigate", { url: `${base}/about` });
  await waitFor("document.readyState==='complete' && Boolean(document.querySelector('.customer-mobile-launcher'))");
  environment = await evaluate("(() => {let legacyError='';try{window.crypto.randomUUID()}catch(error){legacyError=error.message}return {isSecureContext,randomUUID:typeof window.crypto.randomUUID,getRandomValues:typeof window.crypto.getRandomValues,legacyError};})()");
  assert.equal(environment.isSecureContext, false, "The test must use genuine non-secure LAN HTTP, not localhost's secure-context exemption.");
  assert.equal(environment.randomUUID, "undefined");
  assert.equal(environment.getRandomValues, "function");
  assert.ok(environment.legacyError.includes("randomUUID"));
  checks.push("Legacy randomUUID call reproduces the LAN HTTP TypeError.");
  console.log("LAN HTTP reproduced: non-secure context, randomUUID unavailable, getRandomValues available.");

  await tap(".customer-mobile-launcher");
  await waitFor("document.querySelector('.customer-channel-menu')?.classList.contains('expanded')");
  await tap(".customer-channel-item.live");
  await waitFor("Boolean(document.querySelector('.customer-chat-panel'))");
  await type(".customer-chat-panel input[name=fullName]", "Mobile QA fixture");
  await type(".customer-chat-panel input[name=email]", "mobile-qa@example.invalid");
  const initialDraft = "Mobile HTTP test — intercepted, not stored in CRM.";
  await type(".customer-chat-compose textarea", initialDraft);
  await tap(".customer-chat-submit");
  const first = await waitForPost(1);
  assert.match(first.body.sessionId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(first.body.fullName, "Mobile QA fixture");
  assert.equal(first.body.email, "mobile-qa@example.invalid");
  assert.equal(first.body.message, initialDraft);
  assert.ok(first.hasCsrf, "Submission must still include a freshly fetched CSRF token.");
  assert.equal(await evaluate("document.querySelector('.customer-chat-compose textarea').value"), initialDraft);
  assert.ok(await evaluate("document.querySelector('.customer-chat-submit').disabled"));
  await tap(".customer-chat-submit");
  await pause(100);
  assert.equal(posts.length, 1, "A second tap during a pending send cannot submit a duplicate.");
  checks.push("Touch-send creates a valid UUID v4 and POST; pending response preserves the draft and blocks duplicates.");
  await confirm(first);
  await waitFor("document.querySelector('.customer-chat-compose textarea').value==='' && !document.querySelector('.customer-chat-submit').textContent.includes('Sending')");
  await waitFor(`Boolean([...document.querySelectorAll('.customer-chat-message.visitor p')].find(node=>node.textContent===${JSON.stringify(initialDraft)}))`);
  assert.equal(await evaluate("Boolean(document.querySelector('.customer-chat-start'))"), false);
  checks.push("The draft clears only after the mock 201; confirmed inbound text appears in the same chat.");

  salesReply.createdAt = new Date(Date.parse(acceptedMessages[0].createdAt) + 1).toISOString();
  replyEnabled = true;
  await evaluate("window.dispatchEvent(new Event('focus'))");
  await waitFor(`Boolean([...document.querySelectorAll('.customer-chat-message.sales p')].find(node=>node.textContent===${JSON.stringify(salesReply.content)}))`);
  await waitFor("document.querySelector('.customer-chat-sync')?.textContent.includes('syncing')", 6000);
  checks.push("A mocked sales reply displays through HTTP polling when the stream is unavailable.");

  const retryDraft = "Preserve this draft on an HTTP 503, then retry.";
  await type(".customer-chat-compose textarea", retryDraft);
  await tap(".customer-chat-submit");
  const failed = await waitForPost(2);
  assert.equal(failed.body.sessionId, first.body.sessionId);
  assert.equal(failed.body.token, token);
  assert.equal(failed.body.fullName, undefined, "Continuing an existing chat must not require identity fields again.");
  await fulfill(failed.requestId, 503, { error: "Mock server unavailable. Your draft was not sent." });
  await waitFor("document.querySelector('.customer-chat-notice')?.textContent.includes('Mock server unavailable') && !document.querySelector('.customer-chat-submit').disabled");
  assert.equal(await evaluate("document.querySelector('.customer-chat-compose textarea').value"), retryDraft);
  assert.equal(await evaluate("document.querySelectorAll('.customer-chat-message.visitor').length"), 1);
  await screenshot("mobile-chat-failed-draft.png");
  checks.push("A failed POST preserves the draft, displays the error and does not invent an inbound message.");
  await tap(".customer-chat-submit");
  const retry = await waitForPost(3);
  assert.equal(retry.body.sessionId, first.body.sessionId);
  assert.equal(retry.body.message, retryDraft);
  await confirm(retry);
  await waitFor("document.querySelector('.customer-chat-compose textarea').value==='' && document.querySelectorAll('.customer-chat-message.visitor').length===2");
  checks.push("Retry sends the preserved draft using the existing conversation and access token.");

  await command("Page.reload");
  await waitFor("document.readyState==='complete' && Boolean(document.querySelector('.customer-mobile-launcher'))");
  await tap(".customer-mobile-launcher");
  await waitFor("document.querySelector('.customer-channel-menu')?.classList.contains('expanded')");
  await tap(".customer-channel-item.live");
  await waitFor("document.querySelectorAll('.customer-chat-message.visitor').length===2 && Boolean(document.querySelector('.customer-chat-message.sales'))");
  assert.equal(await evaluate("Boolean(document.querySelector('.customer-chat-start'))"), false);
  assert.equal(JSON.parse(await evaluate("localStorage.getItem('shanze-live-chat')")).sessionId, first.body.sessionId);
  assert.deepEqual(await evaluate("window.__mobileChatErrors"), []);
  await screenshot("mobile-chat-confirmed-reply.png");
  checks.push("Refreshing restores the same conversation, both visitor messages and the sales reply without recollecting identity.");
  const report = { result: "PASS", base, viewport: "390 x 844", input: "CDP native touch", environment, databaseWrites: false, emailsSent: false, chatRequestsIntercepted: true, checks, posts: posts.map(({ body, hasCsrf }) => ({ body, hasCsrf })), snapshots, mockReadReceipts: reads, blockedMutations, reportDirectory: output };
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ ...report, posts: undefined }, null, 2));
} catch (error) {
  const report = { result: "FAIL", base, environment, databaseWrites: false, emailsSent: false, chatRequestsIntercepted: true, checks, error: error.message, postCount: posts.length, reportDirectory: output };
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
  await screenshot("mobile-chat-failure.png").catch(() => undefined);
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) await command("Browser.close").catch(() => undefined);
  socket?.close();
  if (browser && browser.exitCode === null) { browser.kill(); await pause(150); }
  const target = path.resolve(profile);
  if (path.dirname(target) === path.resolve(tmpdir()) && path.basename(target).startsWith("shanze-mobile-chat-")) await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
