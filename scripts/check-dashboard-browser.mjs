// Local production QA only. Use a temporary session or an explicitly isolated DB copy.
// No writes to live application data and no access to existing browser profiles.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import path from "node:path";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const base = process.env.ADMIN_TEST_URL;
let token = process.env.ADMIN_TEST_SESSION;
const databaseUrl = process.env.ADMIN_TEST_DATABASE;
assert.ok(base && (token || databaseUrl), "Set ADMIN_TEST_URL and ADMIN_TEST_SESSION or ADMIN_TEST_DATABASE for a disposable production test server.");
assert.ok(["127.0.0.1", "127.0.0.2", "localhost", "[::1]"].includes(new URL(base).hostname), "Only a local isolated test server is supported.");
const profile = await mkdtemp(path.join(tmpdir(), "shanze-dashboard-qa-"));
const output = path.resolve(process.env.ADMIN_TEST_OUTPUT || "outputs/dashboard-qa");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pending = new Map();
const errors = [];
const supportResponses = [];
let browser;
let socket;
let sequence = 0;
let testDb;
let testUserId;

async function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 15_000);
    pending.set(id, { resolve: (result) => { clearTimeout(timeout); resolve(result); }, reject: (error) => { clearTimeout(timeout); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression) {
  for (let index = 0; index < 80; index++) { if (await evaluate(expression)) return; await pause(250); }
  throw new Error(`Condition timed out: ${expression}`);
}
async function screenshot(name) {
  const result = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(path.join(output, name), Buffer.from(result.data, "base64"));
}

try {
  if (!token) {
    assert.ok(databaseUrl.startsWith("file:"));
    const dbPath = await realpath(databaseUrl.slice(5));
    assert.equal(path.basename(dbPath), "snapshot.db");
    assert.ok(path.basename(path.dirname(dbPath)).startsWith("shanze-release-check-"), "Only the release-test database copy may receive a QA session.");
    assert.equal(path.dirname(path.dirname(dbPath)).toLowerCase(), (await realpath(tmpdir())).toLowerCase());
    testDb = new PrismaClient({ datasourceUrl: databaseUrl });
    const role = await testDb.role.findFirst({ where: { permissions: { some: { permission: { key: "*" } } } } });
    assert.ok(role, "Test DB must contain an administrator role.");
    const user = await testDb.user.create({ data: { name: "Dashboard QA", email: `dashboard-qa-${randomUUID()}@example.invalid`, passwordHash: "disabled-test-login", roles: { create: { roleId: role.id } } } });
    testUserId = user.id;
    token = randomBytes(32).toString("base64url");
    await testDb.session.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 600_000) } });
  }
  let executable;
  for (const candidate of [process.env.ADMIN_TEST_BROWSER, "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/chromium", "/usr/bin/google-chrome"].filter(Boolean)) {
    try { await access(candidate); executable = candidate; break; } catch { /* Check next executable. */ }
  }
  assert.ok(executable, "Set ADMIN_TEST_BROWSER to an installed Chromium browser executable.");
  const portServer = createServer();
  await new Promise((resolve) => portServer.listen(0, "127.0.0.1", resolve));
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  browser = spawn(executable, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--window-size=1440,1100", "about:blank"], { windowsHide: true, stdio: "ignore" });
  let page;
  for (let index = 0; index < 60; index++) {
    try { page = (await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json())).find((item) => item.type === "page"); if (page) break; } catch { /* Wait for isolated browser. */ }
    await pause(150);
  }
  assert.ok(page?.webSocketDebuggerUrl);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === "Network.responseReceived" && new URL(message.params.response.url).pathname === "/api/admin/support-analytics") supportResponses.push(message.params.response.status);
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message)); else handler.resolve(message.result);
  });
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Network.enable");
  await command("Network.setBlockedURLs", { urls: ["*://www.googletagmanager.com/*", "*://www.google-analytics.com/*", "*://client.crisp.chat/*", "*/api/analytics/visit"] });
  await command("Network.setCookie", { name: "enercore_session", value: token, url: base, sameSite: "Lax", httpOnly: true });
  await mkdir(output, { recursive: true });
  const report = [];

  for (const width of [1440, 390]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
    await command("Page.navigate", { url: `${base}/admin` });
    await waitFor("Boolean(document.querySelector('.support-dashboard .recharts-surface')) && !document.querySelector('.support-dashboard-refresh')?.disabled");
    assert.ok(await evaluate("document.querySelector('.support-dashboard').innerText.includes('客服工作概览')"));
    assert.equal(await evaluate("document.querySelectorAll('.support-dashboard .support-dashboard-stat').length"), 4);
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), `No horizontal page overflow at ${width}px`);
    assert.ok(await evaluate("document.querySelector('.support-dashboard').getBoundingClientRect().right <= innerWidth + 1"), `Support panel fits at ${width}px`);
    await screenshot(`dashboard-${width}.png`);
    for (const days of [7, 90, 30]) {
      await evaluate(`Array.from(document.querySelectorAll('.support-dashboard .dashboard-periods button')).find(button => button.textContent === '近${days}天').click()`);
      await waitFor(`document.querySelectorAll('.support-dashboard details tbody tr').length === ${days}`);
      assert.equal(await evaluate(`document.querySelector('.support-dashboard .dashboard-periods button[aria-pressed="true"]').textContent`), `近${days}天`);
    }
    await evaluate("document.querySelector('.support-dashboard details summary').click()");
    assert.ok(await evaluate("document.querySelector('.support-dashboard details').open"), "Daily history opens");
    await evaluate("document.querySelector('.support-dashboard details summary').click(); document.querySelector('.support-dashboard .dashboard-rechart').scrollIntoView({block:'center'})");
    const bounds = await evaluate("(()=>{const r=document.querySelector('.support-dashboard .dashboard-rechart').getBoundingClientRect(); return {x:r.left+r.width*.75,y:r.top+r.height*.45}})()");
    await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: bounds.x, y: bounds.y });
    await pause(350);
    assert.ok(await evaluate("Boolean(document.querySelector('.support-dashboard .recharts-tooltip-wrapper'))"), "Interactive Recharts tooltip is present");
    await screenshot(`dashboard-charts-${width}.png`);
    report.push({ viewport: width, chartCount: await evaluate("document.querySelectorAll('.recharts-surface').length"), periodSwitching: true, dailyDetails: true, horizontalOverflow: false });
  }

  const priorResponses = supportResponses.length;
  await evaluate("window.__dashboardQaMarker='no-full-page-reload'; document.querySelector('.support-dashboard-refresh').click()");
  await waitFor("!document.querySelector('.support-dashboard-refresh').disabled");
  assert.ok(supportResponses.length > priorResponses, "Refresh requests the statistics endpoint");
  const beforePoll = supportResponses.length;
  for (let index = 0; index < 75 && supportResponses.length <= beforePoll; index++) await pause(250);
  assert.ok(supportResponses.length > beforePoll, "Automatic polling updates statistics");
  assert.equal(await evaluate("window.__dashboardQaMarker"), "no-full-page-reload", "Manual and automatic updates do not reload page");
  assert.ok(supportResponses.every((status) => status === 200), "Support statistics requests succeed");
  assert.deepEqual(errors, [], "No runtime JavaScript exceptions");
  await writeFile(path.join(output, "report.json"), JSON.stringify({ report, supportRequests: supportResponses.length, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, report, supportRequests: supportResponses.length, screenshots: output }));
} finally {
  if (socket?.readyState === WebSocket.OPEN) { try { await command("Browser.close"); } catch { /* Already exited. */ } socket.close(); }
  browser?.kill();
  if (testDb) { if (testUserId) await testDb.user.delete({ where: { id: testUserId } }); await testDb.$disconnect(); }
  const resolvedTemp = await realpath(tmpdir());
  const resolvedProfile = await realpath(profile);
  assert.equal(path.dirname(resolvedProfile).toLowerCase(), resolvedTemp.toLowerCase(), "Only remove our temporary profile directory");
  assert.ok(path.basename(resolvedProfile).startsWith("shanze-dashboard-qa-"));
  await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
