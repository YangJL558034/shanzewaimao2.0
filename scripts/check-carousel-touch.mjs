// Read-only native touch QA in a fresh browser profile; no accounts or CRM data are created.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import path from "node:path";

const base = new URL(process.env.ADMIN_TEST_URL || "http://localhost:3000").origin;
const profile = await mkdtemp(path.join(tmpdir(), "shanze-carousel-touch-"));
const pending = new Map();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser;
let socket;
let sequence = 0;

async function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(id, {
      resolve: (result) => { clearTimeout(timer); resolve(result); },
      reject: (error) => { clearTimeout(timer); reject(error); },
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, limit = 10000) {
  const started = Date.now();
  while (Date.now() - started < limit) {
    if (await evaluate(expression)) return;
    await pause(35);
  }
  throw new Error(`Condition timed out (${limit} ms): ${expression}`);
}

// Native touch ends before kinetic scrolling and CSS scroll-snap finish. A new
// gesture must not mistake that residual horizontal movement for vertical panning.
async function waitForScrollIdle(viewportExpression) {
  let stableSamples = 0;
  let previous;
  const started = Date.now();
  while (Date.now() - started < 3000) {
    const current = await evaluate(`({left:(${viewportExpression}).scrollLeft,page:scrollY})`);
    if (previous && Math.abs(current.left - previous.left) < 0.5 && Math.abs(current.page - previous.page) < 0.5) stableSamples++;
    else stableSamples = 0;
    if (stableSamples >= 5) return;
    previous = current;
    await pause(50);
  }
  throw new Error("Previous touch momentum or scroll-snap did not settle before the next gesture.");
}

async function nativeSwipe(viewportExpression, targetExpression, dx, dy, vertical = false) {
  await waitForScrollIdle(viewportExpression);
  await evaluate(`(() => { document.documentElement.style.scrollBehavior='auto'; const viewport=${viewportExpression}; viewport.scrollTo({left:0,behavior:'auto'}); (${targetExpression}).scrollIntoView({behavior:'auto',block:'center',inline:'center'}); viewport.focus({preventScroll:true}); })()`);
  await waitFor(`(${targetExpression}).tagName!=='IMG' || (${targetExpression}).naturalWidth>0`);
  await waitForScrollIdle(viewportExpression);
  const before = await evaluate(`(() => { const viewport=${viewportExpression}; const target=${targetExpression}; const box=target.getBoundingClientRect(); return { left:viewport.scrollLeft,page:scrollY,x:box.left+box.width/2,y:box.top+box.height/2,paused:viewport.closest('.auto-carousel').dataset.autoplayPaused,touchAction:getComputedStyle(viewport).touchAction }; })()`);
  assert.equal(before.paused, "true", "Autoplay must be disabled so it cannot falsely pass a swipe assertion.");
  assert.ok(before.x > 10 && before.x < 380 && before.y > 80 && before.y < 770, `Swipe starts on a visible target: ${JSON.stringify(before)}`);
  const started = Date.now();
  await command("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: before.x, y: before.y, id: 1 }] });
  let duringDelta = 0;
  for (let step = 1; step <= 6; step++) {
    await command("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: before.x + dx * step / 6, y: before.y + dy * step / 6, id: 1 }] });
    await pause(20);
    const value = await evaluate(vertical ? "scrollY" : `${viewportExpression}.scrollLeft`);
    duringDelta = Math.max(duringDelta, Math.abs(value - (vertical ? before.page : before.left)));
  }
  await command("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await waitFor(vertical ? `Math.abs(scrollY-${before.page})>20` : `Math.abs(${viewportExpression}.scrollLeft-${before.left})>20`, 800);
  const after = await evaluate(`({left:${viewportExpression}.scrollLeft,page:scrollY,preview:!!document.querySelector('.certificate-preview-dialog')?.open})`);
  assert.ok(Date.now() - started < 1000, "Movement must come from the finger gesture, within one second, not a later autoplay tick.");
  assert.ok(duringDelta > 20, "The content must move during the actual touch gesture.");
  assert.equal(after.preview, false, "Swiping on a photo or text must not open the document preview.");
  if (vertical) assert.ok(Math.abs(after.left - before.left) < 4, `A vertical swipe scrolls the page, not the carousel: ${JSON.stringify({ before, after })}`);
  return { duringDelta: Math.round(duringDelta), scrollDelta: Math.round(after.left - before.left), pageDelta: Math.round(after.page - before.page), durationMs: Date.now() - started, touchAction: before.touchAction };
}

try {
  const candidates = [process.env.ADMIN_TEST_BROWSER, "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].filter(Boolean);
  let executable;
  for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch { /* Try the next installed browser. */ } }
  assert.ok(executable, "Set ADMIN_TEST_BROWSER to an installed Edge or Chrome executable.");
  const portServer = createServer();
  await new Promise((resolve) => portServer.listen(0, "127.0.0.1", resolve));
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  browser = spawn(executable, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { windowsHide: true, stdio: "ignore" });
  let page;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { page = (await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json())).find((entry) => entry.type === "page"); if (page) break; } catch { /* Await this isolated browser. */ }
    await pause(100);
  }
  assert.ok(page?.webSocketDebuggerUrl);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message)); else handler.resolve(message.result);
  });
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  await command("Network.enable");
  await command("Network.setBlockedURLs", { urls: ["*://www.googletagmanager.com/*", "*://www.google-analytics.com/*", "*://client.crisp.chat/*", "*/api/analytics/visit"] });
  await command("Network.setCookie", { name: "locale", value: "en", url: base, sameSite: "Lax" });
  await command("Page.enable");
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await command("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await command("Page.navigate", { url: `${base}/quality` });
  await waitFor("document.querySelectorAll('.certificate-document-group').length===2 && [...document.querySelectorAll('.certificate-document-group .auto-carousel')].every(node=>node.dataset.scrollable==='true' && node.dataset.autoplayPaused==='true')");
  await waitFor("!!document.querySelector('.cookie-consent')");
  await evaluate("document.querySelector('.cookie-consent .btn-outline').click(); document.querySelector('.customer-support-close')?.click()");
  await waitFor("!document.querySelector('.cookie-consent')");
  const results = [];
  for (let index = 0; index < 2; index++) {
    const group = `document.querySelectorAll('.certificate-document-group')[${index}]`;
    const viewport = `${group}.querySelector('.auto-carousel-viewport')`;
    const image = `${group}.querySelector('.certificate-document-preview img')`;
    const text = `${group}.querySelector('.certificate-document-copy h4')`;
    results.push({ group: index, target: "photo", ...(await nativeSwipe(viewport, image, -180, 0)) });
    results.push({ group: index, target: "text", ...(await nativeSwipe(viewport, text, -180, 0)) });
    results.push({ group: index, target: "vertical page", ...(await nativeSwipe(viewport, image, 0, -150, true)) });
  }
  await command("Page.navigate", { url: `${base}/factory` });
  await waitFor("[...document.querySelectorAll('.auto-carousel')].some(node=>node.dataset.scrollable==='true' && node.dataset.autoplayPaused==='true')");
  const factory = "[...document.querySelectorAll('.auto-carousel')].find(node=>node.dataset.scrollable==='true')";
  const factoryViewport = `${factory}.querySelector('.auto-carousel-viewport')`;
  results.push({ group: "factory", target: "shared carousel", ...(await nativeSwipe(factoryViewport, `${factory}.querySelector('.auto-carousel-item h3')`, -180, 0)) });
  console.log(JSON.stringify({ result: "PASS", viewport: "390 x 844", input: "CDP native touch events", autoplay: "disabled by reduced motion", databaseWrites: false, results }, null, 2));
} finally {
  if (socket?.readyState === WebSocket.OPEN) await command("Browser.close").catch(() => undefined);
  socket?.close();
  if (browser && browser.exitCode === null) { browser.kill(); await pause(150); }
  const target = path.resolve(profile);
  if (path.dirname(target) === path.resolve(tmpdir()) && path.basename(target).startsWith("shanze-carousel-touch-")) await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
