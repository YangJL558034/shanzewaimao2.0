// Production GA4 QA: copied SQLite database, fresh headless profile, all external requests intercepted.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, realpath, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync, backup } from "node:sqlite";
import env from "@next/env";

const workspace = path.resolve(process.cwd());
env.loadEnvConfig(workspace);
const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl?.startsWith("file:"), "This test requires a local SQLite DATABASE_URL.");
const databaseName = decodeURIComponent(databaseUrl.slice(5).split("?")[0]);
const sourceDatabase = path.isAbsolute(databaseName) ? path.resolve(databaseName) : path.resolve(workspace, "prisma", databaseName);
await access(sourceDatabase);
await access(path.join(workspace, ".next", "BUILD_ID"));
const testDirectory = await mkdtemp(path.join(tmpdir(), "shanze-ga4-qa-"));
const snapshotDatabase = path.join(testDirectory, "snapshot.db");
const browserProfile = path.join(testDirectory, "browser");
const measurementId = "G-TEST1234";
const verificationToken = "isolated_google_verification_1234";
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const pending = new Map();
const interceptedGoogle = [];
const blockedExternal = [];
const runtimeErrors = [];
let serverProcess;
let browserProcess;
let socket;
let sequence = 0;
let serverOutput = "";
let documentCsp = "";
let initialSourceSettings;

function sourceSettings() {
  const database = new DatabaseSync(sourceDatabase, { readOnly: true });
  try { return database.prepare('SELECT key,value FROM "Setting" WHERE key IN (?,?) ORDER BY key').all("google_analytics_id", "google_site_verification"); }
  finally { database.close(); }
}
async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evaluate(expression)) return;
    await pause(200);
  }
  throw new Error(`Browser condition not reached: ${expression}`);
}
async function shutdown(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), pause(1500)]);
}
const pageViewExpression = "(window.dataLayer || []).map(item => Array.from(item)).filter(item => item[0] === 'event' && item[1] === 'page_view')";

try {
  assert.notEqual(path.resolve(snapshotDatabase), sourceDatabase, "Snapshot must not overwrite live database.");
  assert.equal(path.dirname(snapshotDatabase), testDirectory);
  initialSourceSettings = sourceSettings();
  const source = new DatabaseSync(sourceDatabase, { readOnly: true });
  try { await backup(source, snapshotDatabase); } finally { source.close(); }
  const snapshot = new DatabaseSync(snapshotDatabase);
  try {
    const statement = snapshot.prepare('INSERT INTO "Setting" (id,"group",key,value,type,isPublic,updatedAt) VALUES (?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,isPublic=excluded.isPublic');
    statement.run(randomUUID(), "seo", "google_analytics_id", measurementId, "text", 1, Date.now());
    statement.run(randomUUID(), "seo", "google_site_verification", verificationToken, "text", 1, Date.now());
  } finally { snapshot.close(); }

  const applicationPort = await freePort();
  const base = `http://127.0.0.1:${applicationPort}`;
  serverProcess = spawn(process.execPath, [path.join(workspace, "node_modules", "next", "dist", "bin", "next"), "start", "--hostname", "127.0.0.1", "--port", String(applicationPort)], {
    cwd: workspace, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production", DATABASE_URL: `file:${snapshotDatabase.replaceAll("\\", "/")}`, NEXT_PUBLIC_SITE_URL: "https://shanzesz.com", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "", GOOGLE_SITE_VERIFICATION: "", GEOIP_LOOKUP_ENABLED: "false", SMTP_HOST: "", SMTP_USER: "", SMTP_PASSWORD: "" },
  });
  serverProcess.stdout.on("data", (chunk) => { serverOutput = (serverOutput + chunk.toString()).slice(-12000); });
  serverProcess.stderr.on("data", (chunk) => { serverOutput = (serverOutput + chunk.toString()).slice(-12000); });
  let initialHtml = "";
  for (let attempt = 0; attempt < 80; attempt++) {
    assert.equal(serverProcess.exitCode, null, `Production test server exited: ${serverOutput}`);
    try {
      const response = await fetch(`${base}/contact`, { headers: { "User-Agent": "Googlebot" } });
      if (response.status === 200) { initialHtml = await response.text(); break; }
    } catch { /* Wait for our private production instance. */ }
    await pause(200);
  }
  assert.ok(initialHtml.includes(`<meta name="google-site-verification" content="${verificationToken}"`), "Copied database verification token must appear in the initial production HTML.");
  assert.ok(initialHtml.indexOf("google-site-verification") < initialHtml.indexOf("</head>"), "Google verification belongs in the initial head.");

  const executables = [process.env.SEO_TEST_BROWSER, "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].filter(Boolean);
  let executable;
  for (const candidate of executables) { try { await access(candidate); executable = candidate; break; } catch { /* Try the next installed browser. */ } }
  assert.ok(executable, "Set SEO_TEST_BROWSER to an installed Chrome or Edge executable.");
  const debuggingPort = await freePort();
  browserProcess = spawn(executable, ["--headless=new", `--remote-debugging-port=${debuggingPort}`, `--user-data-dir=${browserProfile}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-default-apps", "--disable-background-networking", "--disable-component-update", "--disable-domain-reliability", "--window-size=1440,1050", "about:blank"], { windowsHide: true, stdio: "ignore" });
  let target;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { target = (await fetch(`http://127.0.0.1:${debuggingPort}/json/list`).then((response) => response.json())).find((item) => item.type === "page"); if (target) break; } catch { /* Wait for our isolated browser. */ }
    await pause(200);
  }
  assert.ok(target?.webSocketDebuggerUrl);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const handler = pending.get(message.id);
      if (!handler) return;
      pending.delete(message.id);
      if (message.error) handler.reject(new Error(message.error.message)); else handler.resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === "Network.responseReceived" && message.params.type === "Document" && message.params.response.url.startsWith(base)) {
      const header = Object.entries(message.params.response.headers).find(([name]) => name.toLowerCase() === "content-security-policy");
      documentCsp = header?.[1] || documentCsp;
    }
    if (message.method === "Fetch.requestPaused") {
      const { requestId, request, resourceType } = message.params;
      const url = new URL(request.url);
      if (url.origin === base || !["http:", "https:"].includes(url.protocol)) {
        command("Fetch.continueRequest", { requestId }).catch((error) => runtimeErrors.push(error.message));
      } else if (/(^|\.)(googletagmanager\.com|google-analytics\.com|analytics\.google\.com|google\.com)$/.test(url.hostname)) {
        interceptedGoogle.push({ host: url.hostname, pathname: url.pathname, resourceType });
        const isScript = resourceType === "Script";
        const content = isScript ? "window.__gaTestScriptLoaded = (window.__gaTestScriptLoaded || 0) + 1;" : "";
        command("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: isScript ? "application/javascript" : "text/plain" }], body: Buffer.from(content).toString("base64") }).catch((error) => runtimeErrors.push(error.message));
      } else {
        blockedExternal.push({ host: url.hostname, resourceType });
        command("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" }).catch((error) => runtimeErrors.push(error.message));
      }
    }
  });
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Network.enable");
  await command("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  await command("Page.addScriptToEvaluateOnNewDocument", { source: "window.__seoCspViolations=[];document.addEventListener('securitypolicyviolation',event=>window.__seoCspViolations.push({blockedURI:event.blockedURI,directive:event.effectiveDirective}));window.__seoSpaMarker=crypto.randomUUID();" });
  await command("Page.navigate", { url: `${base}/contact?email=private@example.invalid&token=private_token#quote` });
  await waitFor("Boolean(document.querySelector('.cookie-consent')) && document.readyState === 'complete'");
  await pause(300);
  assert.equal(await evaluate("document.querySelectorAll('script[src*=googletagmanager]').length"), 0, "No GA script before analytics consent.");
  assert.equal(interceptedGoogle.filter((item) => item.host.includes("googletagmanager") && item.pathname === "/gtag/js").length, 0, "No Google tag request before consent.");
  assert.equal(await evaluate(`${pageViewExpression}.length`), 0);

  await evaluate("document.querySelector('.cookie-consent-actions .btn-primary').click()");
  await waitFor("window.__gaTestScriptLoaded === 1");
  await waitFor(`${pageViewExpression}.length === 1`);
  const initialPageView = await evaluate(`${pageViewExpression}[0][2]`);
  assert.equal(initialPageView.page_location, `${base}/contact`, "Pageview must omit customer query and hash.");
  assert.equal(initialPageView.send_to, measurementId);
  const nonce = await evaluate("document.querySelector('script[src*=googletagmanager]').nonce");
  assert.ok(nonce && documentCsp.includes(`'nonce-${nonce}'`), "Loaded GA Script carries the production CSP nonce.");
  assert.equal(await evaluate("window.__seoCspViolations.filter(item=>/googletagmanager|google-analytics/.test(item.blockedURI)).length"), 0, "CSP must permit the configured analytics tag.");

  const documentMarker = await evaluate("window.__seoSpaMarker");
  await evaluate("document.querySelector('a[href=\"/products\"]').click()");
  await waitFor("location.pathname === '/products' && document.querySelectorAll('main h1').length === 1");
  await waitFor(`${pageViewExpression}.length === 2`);
  assert.equal(await evaluate("window.__seoSpaMarker"), documentMarker, "Navigation should retain the SPA document.");
  assert.equal(await evaluate("window.__gaTestScriptLoaded"), 1, "SPA navigation reuses the Google tag.");
  await evaluate("history.pushState(null,'','/products?email=private@example.invalid#secret');window.dispatchEvent(new CustomEvent('shanze-analytics-event',{detail:{name:'generate_lead',channel:'website_form',email:'private@example.invalid',text:'private inquiry'}}))");
  const lead = await evaluate("(window.dataLayer||[]).map(item=>Array.from(item)).find(item=>item[0]==='event'&&item[1]==='generate_lead')");
  assert.deepEqual(Object.keys(lead[2]).sort(), ["channel", "page_location", "send_to"]);
  assert.equal(lead[2].page_location, `${base}/products`);
  assert.equal(lead[2].send_to, measurementId);
  assert.ok(!JSON.stringify(lead).includes("private@"));
  const beforeInvalid = await evaluate("window.dataLayer.length");
  await evaluate("window.dispatchEvent(new CustomEvent('shanze-analytics-event',{detail:{name:'private@example.invalid',channel:'website_form'}}));window.dispatchEvent(new CustomEvent('shanze-analytics-event',{detail:{name:'generate_lead',channel:'private@example.invalid'}}))");
  assert.equal(await evaluate("window.dataLayer.length"), beforeInvalid, "Unsupported analytics values are ignored.");

  await evaluate("document.cookie='_ga=isolated-test;path=/';document.cookie='_ga_TEST1234=isolated-test;path=/';document.querySelector('#cookie-preferences-trigger').click()");
  await waitFor("Boolean(document.querySelector('.cookie-consent'))");
  await evaluate("document.querySelector('.cookie-consent-actions .btn-outline').click()");
  await waitFor(`window['ga-disable-${measurementId}'] === true && !document.querySelector('.cookie-consent')`);
  assert.equal(await evaluate("document.cookie.split(';').some(cookie=>/^_ga(?:_|=)/.test(cookie.trim()))"), false, "Consent withdrawal clears the isolated GA cookies.");
  await evaluate("document.querySelector('a[href=\"/about\"]').click()");
  await waitFor("location.pathname === '/about'");
  await pause(300);
  assert.equal(await evaluate(`${pageViewExpression}.length`), 2, "Withdrawal prevents subsequent pageviews.");
  assert.equal(await evaluate("(window.dataLayer||[]).map(item=>Array.from(item)).filter(item=>item[0]==='consent'&&item[1]==='update').at(-1)[2].analytics_storage"), "denied");
  assert.deepEqual(runtimeErrors, [], "Production browser must have no runtime exceptions.");
  assert.deepEqual(sourceSettings(), initialSourceSettings, "Live Google configuration remains unchanged.");
  console.log(JSON.stringify({ result: "PASS", productionConsent: true, initialGoogleVerification: true, cspNonce: true, spaPageviews: 2, personalDataOmitted: true, withdrawal: true, liveDatabaseUnchanged: true, mockedGoogleRequests: interceptedGoogle, blockedExternalRequests: blockedExternal.length, realGoogleRequests: 0 }));
} catch (error) {
  if (serverOutput && serverProcess?.exitCode !== null) console.error(serverOutput);
  throw error;
} finally {
  if (socket?.readyState === WebSocket.OPEN) await command("Browser.close").catch(() => undefined);
  socket?.close();
  await shutdown(browserProcess);
  await shutdown(serverProcess);
  const resolvedTemporary = await realpath(testDirectory).catch(() => path.resolve(testDirectory));
  const resolvedParent = await realpath(tmpdir());
  assert.ok(path.dirname(resolvedTemporary).toLowerCase() === resolvedParent.toLowerCase() && path.basename(resolvedTemporary).startsWith("shanze-ga4-qa-"), "Cleanup target must be the exact owned temporary directory.");
  await rm(resolvedTemporary, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 });
}
