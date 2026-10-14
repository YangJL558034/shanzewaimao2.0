// Visual QA uses a fresh, isolated headless browser profile, never a user's browser session.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import path from "node:path";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import env from "@next/env";

env.loadEnvConfig(process.cwd());
const db = new PrismaClient();
const base = process.env.ADMIN_TEST_URL || "http://localhost:3000";
const profile = await mkdtemp(path.join(tmpdir(), "shanze-admin-ui-"));
let browserProcess;
let socket;
let userId;
let certificateTestId;
const pending = new Map();
let sequence = 0;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 10000);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await evaluate(expression)) return;
    await pause(250);
  }
  throw new Error(`Browser condition not reached: ${expression}`);
}
async function screenshot(name) {
  const { data } = await command("Page.captureScreenshot", { format: "png" });
  await writeFile(path.resolve("outputs", name), Buffer.from(data, "base64"));
}

try {
  const candidates = [process.env.ADMIN_TEST_BROWSER, "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].filter(Boolean);
  let executable;
  for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch { /* Try another installed executable. */ } }
  assert.ok(executable, "Set ADMIN_TEST_BROWSER to an installed Chrome or Edge executable.");
  const portServer = createServer();
  await new Promise((resolve) => portServer.listen(0, "127.0.0.1", resolve));
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  browserProcess = spawn(executable, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-default-apps", "--window-size=1440,1050", "about:blank"], { windowsHide: true, stdio: "ignore" });
  let page;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json()); page = pages.find((target) => target.type === "page"); if (page) break; } catch { /* Wait for our own browser instance. */ }
    await pause(200);
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
  if (process.argv.includes("--support")) {
    await command("Network.enable");
    await command("Network.setBlockedURLs", { urls: ["*://www.googletagmanager.com/*", "*://www.google-analytics.com/*", "*://client.crisp.chat/*", "*/api/analytics/visit"] });
    await command("Page.enable");
    await command("Page.addScriptToEvaluateOnNewDocument", {source:"window.__supportErrors=[];window.addEventListener('error',event=>window.__supportErrors.push(event.message))"});
    await mkdir(path.resolve("outputs"), { recursive: true });
    async function supportBox() {
      return evaluate("(() => {const box=document.querySelector('.customer-support').getBoundingClientRect();return {left:box.left,right:box.right,top:box.top,bottom:box.bottom,width:box.width,height:box.height};})()");
    }
    async function clickSupport(selector) {
      const point = await evaluate(`(() => {const box=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:box.left+box.width/2,y:box.top+box.height/2};})()`);
      await command("Input.dispatchMouseEvent", { type:"mouseMoved",x:point.x,y:point.y });
      await command("Input.dispatchMouseEvent", { type:"mousePressed",button:"left",buttons:1,clickCount:1,x:point.x,y:point.y });
      await command("Input.dispatchMouseEvent", { type:"mouseReleased",button:"left",buttons:0,clickCount:1,x:point.x,y:point.y });
    }
    async function dragSupport(dx, dy, released = true, touch = false, selector = ".customer-support-drag-handle") {
      const point = await evaluate(`(() => {const box=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:box.left+box.width/2,y:box.top+box.height/2};})()`);
      if (touch) await command("Input.dispatchTouchEvent", { type:"touchStart",touchPoints:[{x:point.x,y:point.y,id:1}] });
      else {
        await command("Input.dispatchMouseEvent", { type:"mouseMoved",x:point.x,y:point.y });
        await command("Input.dispatchMouseEvent", { type:"mousePressed",button:"left",buttons:1,clickCount:1,x:point.x,y:point.y });
      }
      for (const progress of [.25,.5,.75,1]) {
        if (touch) await command("Input.dispatchTouchEvent", { type:"touchMove",touchPoints:[{x:point.x+dx*progress,y:point.y+dy*progress,id:1}] });
        else await command("Input.dispatchMouseEvent", { type:"mouseMoved",button:"left",buttons:1,x:point.x+dx*progress,y:point.y+dy*progress });
      }
      // Touch moves are dispatched/coalesced on animation frames; inspect after the final frame.
      await pause(50);
      const held = await supportBox();
      if (released) {
        if (touch) await command("Input.dispatchTouchEvent", { type:"touchEnd",touchPoints:[] });
        else await command("Input.dispatchMouseEvent", { type:"mouseReleased",button:"left",buttons:0,clickCount:1,x:point.x+dx,y:point.y+dy });
        await pause(300);
      }
      return { point, held, final:released ? await supportBox() : held };
    }
    for (const locale of ["en", "zh"]) {
      await command("Network.setCookie", { name:"locale",value:locale,url:base,sameSite:"Lax" });
      for (const width of process.argv.includes("--mobile-only") ? [390] : [1440,390]) {
        await command("Storage.clearDataForOrigin", { origin:base,storageTypes:"local_storage" });
        await command("Emulation.setDeviceMetricsOverride", { width,height:width===390?844:1050,deviceScaleFactor:1,mobile:width===390 });
        await command("Emulation.setTouchEmulationEnabled", { enabled:width===390,maxTouchPoints:1 });
        await command("Page.navigate", { url:`${base}/` });
        await waitFor("Boolean(document.querySelector('.cookie-consent') && document.querySelector('.customer-support-close'))");
        await waitFor("parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--customer-support-consent-offset')) > 0");
        await waitFor("parseFloat(document.querySelector('.customer-support').style.getPropertyValue('--customer-support-visible-width')) > 0");
        assert.equal(await evaluate("document.querySelectorAll('.customer-channel-item').length"), 4, "Only Live Chat, WhatsApp, LinkedIn and Email remain.");
        assert.equal(await evaluate("document.querySelectorAll('.customer-support .catalog').length"), 0);
        const cookieText = await evaluate("document.querySelector('.cookie-consent').innerText");
        if (locale === "en") assert.ok(!/[\p{Script=Han}]/u.test(cookieText), "The English cookie banner contains only English copy.");
        else assert.ok(!/[A-Za-z]/.test(cookieText), "The Chinese privacy banner contains only Chinese copy.");
        assert.ok(await evaluate("document.querySelector('.customer-support').getBoundingClientRect().bottom <= document.querySelector('.cookie-consent').getBoundingClientRect().top - 8"), "Support does not obscure privacy settings or consent buttons.");
        if (width === 390) {
          assert.ok(await evaluate("getComputedStyle(document.querySelector('.customer-channel-menu')).display === 'none'"), "Mobile begins with a compact launcher.");
          await evaluate("document.querySelector('.customer-mobile-launcher').click()");
          await waitFor("document.querySelector('.customer-channel-menu').classList.contains('expanded')");
        }
        const initial = await supportBox();
        const moved = await dragSupport(width===390?-80:-240,-90,true,width===390);
        assert.ok(moved.held.left < initial.left - (width===390 ? 30 : 150), `Mouse/touch freely moves horizontally: ${JSON.stringify({initial,moved})}`);
        assert.ok(moved.held.top < initial.top - 40, "Mouse/touch freely moves vertically.");
        assert.ok(Math.abs(moved.final.right - initial.right) < 3, "Releasing snaps the panel back to the right edge.");
        assert.ok(Math.abs(moved.final.top - moved.held.top) < 4, `Right-edge docking preserves dragged height: ${JSON.stringify({initial,moved})}`);
        const bounded = await dragSupport(-30,width===390?150:900,true,width===390);
        assert.ok(await evaluate("document.querySelector('.customer-support').getBoundingClientRect().bottom <= document.querySelector('.cookie-consent').getBoundingClientRect().top - 8"), "Dragging toward the bottom is constrained above the privacy banner.");
        assert.ok(bounded.final.top >= 0);
        assert.ok(await evaluate("!document.querySelector('.customer-chat-panel')"), "Dragging must not accidentally start Live Chat.");
        assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "The drag widget does not introduce page overflow.");
        await screenshot(`support-consent-${locale}-${width}.png`);
        await evaluate("document.querySelector('.cookie-consent .btn-outline').click()");
        await waitFor("!document.querySelector('.cookie-consent') && localStorage.getItem('enercore_cookie_consent') === 'necessary'");
        await waitFor("parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--customer-support-consent-offset')) === 0");
        await pause(300);
        await clickSupport(".customer-channel-item.live");
        await waitFor("Boolean(document.querySelector('.customer-chat-panel'))");
        assert.ok(await evaluate("document.querySelector('.customer-support').getBoundingClientRect().top >= 0 && document.querySelector('.customer-support').getBoundingClientRect().bottom <= innerHeight"), "Opening chat clamps the bigger window to the viewport.");
        await evaluate("document.querySelector('.customer-support-close').click(); window.__supportNavigationMarker='same-document'");
        await waitFor("!document.querySelector('.customer-support')");
        await evaluate("document.querySelector('.main-nav a[href=\"/about\"]').click()");
        await waitFor("location.pathname === '/about' && document.querySelector('main h1')?.textContent.length > 0");
        assert.ok(await evaluate("window.__supportNavigationMarker === 'same-document' && !document.querySelector('.customer-support')"), "Closing stays hidden through client-side navigation.");
        await evaluate("document.querySelector('#cookie-preferences-trigger').click()");
        await waitFor("Boolean(document.querySelector('.cookie-consent'))");
        assert.ok(await evaluate("!document.querySelector('.customer-support')"), "Changing privacy settings does not wake the closed widget.");
        await evaluate("document.querySelector('.cookie-consent .btn-primary').click()");
        await waitFor("localStorage.getItem('enercore_cookie_consent') === 'accepted' && !document.querySelector('.cookie-consent')");
        assert.equal(await evaluate("document.querySelectorAll('script[src*=googletagmanager]').length"), 0, "Development tests must not load Google Analytics.");
        await command("Page.reload");
        await waitFor("Boolean(document.querySelector('.customer-support-close'))");
        await waitFor("parseFloat(document.querySelector('.customer-support').style.getPropertyValue('--customer-support-visible-width')) > 0");
        await pause(50);
        assert.ok(await evaluate("!document.querySelector('.cookie-consent')"), "Refreshing restores support but retains the privacy choice.");
        await evaluate("document.querySelector('#cookie-preferences-trigger').click()");
        await waitFor("Boolean(document.querySelector('.cookie-consent'))");
        await waitFor("document.querySelector('.customer-support').getBoundingClientRect().bottom <= document.querySelector('.cookie-consent').getBoundingClientRect().top - 8");
        assert.deepEqual(await evaluate("window.__supportErrors"), [], "Support interactions must not raise browser errors.");
        console.log(`${locale} ${width}: PASS 2D drag/right dock, close/navigation/refresh, localized privacy and no overlap`);
      }
    }
    console.log(JSON.stringify({result:"PASS",support:"four channels, two-dimensional drag and right-edge docking",dismiss:"in-memory across routes; refresh-only restore",privacy:"English/Chinese and desktop/mobile, no overlap",liveDatabaseWrites:false}));
  } else if (process.argv.includes("--certificates")) {
    await command("Network.enable");
    await command("Page.enable");
    await mkdir(path.resolve("outputs"), { recursive: true });
    const originalCertificates = await db.certificate.findMany();
    let visibleCertificates = originalCertificates.filter((row) => row.isVisible);
    assert.equal((await fetch(`${base}/api/admin/certificates`)).status, 401, "Certificate management requires authentication.");
    const role = await db.role.findFirst({ where: { permissions: { some: { permission: { key: "*" } } } } });
    assert.ok(role);
    const user = await db.user.create({ data: { name: "Certificate UI review", email: `certificate-ui-${randomUUID()}@example.invalid`, passwordHash: "disabled-test-login", roles: { create: { roleId: role.id } } } });
    userId = user.id;
    const token = randomBytes(32).toString("base64url");
    await db.session.create({ data: { userId, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 300000) } });
    await command("Network.setCookie", { name: "enercore_session", value: token, url: base, httpOnly: true, sameSite: "Lax" });
    await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
    await command("Page.navigate", { url: `${base}/admin/certificates` });
    await waitFor("document.querySelectorAll('.certificate-admin-category').length > 0");
    assert.equal(await evaluate("document.querySelectorAll('.certificate-admin-category').length"), originalCertificates.length);
    await screenshot("certificates-admin-desktop.png");
    await evaluate("document.querySelectorAll('.certificate-admin-filter')[1].click()");
    await waitFor(`document.querySelectorAll('.certificate-admin-category').length === ${originalCertificates.filter((row) => row.category === "MANAGEMENT").length}`);
    await evaluate("[...document.querySelectorAll('.admin-toolbar button')].find(button => button.textContent.includes('新增证书')).click()");
    await waitFor("document.querySelector('select[name=category]')?.value === 'MANAGEMENT'");
    assert.equal(await evaluate("[...document.querySelector('select[name=category]').options].filter(option => option.value).length"), 2);
    await evaluate("[...document.querySelectorAll('.modal-foot button')].find(button => button.textContent === '取消').click()");
    await waitFor("!document.querySelector('.modal-backdrop')");
    const apiTest = await evaluate(`(async () => {
      const { token } = await fetch('/api/csrf').then(response => response.json());
      const write = async (url, method, body) => { const response = await fetch(url, { method, headers: {'content-type':'application/json','x-csrf-token':token}, body:JSON.stringify(body) }); return { status:response.status, body:await response.json() }; };
      const invalid = await write('/api/admin/certificates', 'POST', { name:'Invalid category test', category:'INVALID' });
      const result = await write('/api/admin/certificates', 'POST', { name:${JSON.stringify(`Certificate test ${randomUUID()}`)}, category:'MANAGEMENT', image:'', fileUrl:'', isVisible:false, sortOrder:9999 });
      return { invalid:invalid.status, result };
    })()`);
    certificateTestId = apiTest.result.body.data?.id;
    assert.equal(apiTest.invalid, 400, "The API must reject invalid categories.");
    assert.equal(apiTest.result.status, 201, JSON.stringify(apiTest.result.body));
    assert.ok(certificateTestId);
    const changed = await evaluate(`(async () => { const {token} = await fetch('/api/csrf').then(response=>response.json()); const response = await fetch('/api/admin/certificates/${certificateTestId}', {method:'PUT',headers:{'content-type':'application/json','x-csrf-token':token},body:JSON.stringify({category:'PRODUCT',isVisible:true})}); return {status:response.status,body:await response.json()}; })()`);
    assert.equal(changed.status, 200);
    assert.equal((await db.certificate.findUniqueOrThrow({ where: { id: certificateTestId } })).category, "PRODUCT", "Edited category persists in SQLite.");
    const testPublicHtml = await fetch(`${base}/quality`, { headers: { "User-Agent": "Googlebot", Cookie: "locale=en" } }).then(response => response.text());
    const testProductGroup = testPublicHtml.match(/<section\b[^>]*class="certificate-document-group"[^>]*data-document-count="\d+"[^>]*>[\s\S]*?<\/section>/g)?.find(group => group.includes("Product Reports"));
    assert.ok(testProductGroup?.includes(apiTest.result.body.data.name), "New no-image record appears in the explicitly selected public group.");
    await db.certificate.delete({ where: { id: certificateTestId } });
    certificateTestId = undefined;
    for (const locale of ["en", "zh"]) {
      await command("Network.setCookie", { name: "locale", value: locale, url: base, sameSite: "Lax" });
      for (const width of [1440, 390]) {
        visibleCertificates = await db.certificate.findMany({ where: { isVisible: true } });
        await command("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 1050, deviceScaleFactor: 1, mobile: width === 390 });
        await command("Page.navigate", { url: `${base}/quality` });
        await waitFor(`document.querySelectorAll('.certificate-document-card').length === ${visibleCertificates.length} && document.querySelectorAll('.certificate-document-group .auto-carousel-arrow').length === 4`);
        await waitFor("Boolean(document.querySelector('.cookie-consent') || localStorage.getItem('enercore_cookie_consent'))");
        await evaluate("document.querySelector('.cookie-consent .btn-outline')?.click()");
        await waitFor("!document.querySelector('.cookie-consent') && localStorage.getItem('enercore_cookie_consent') === 'necessary'");
        assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `${locale} ${width}: page overflow`);
        assert.equal(await evaluate("document.querySelectorAll('.certificate-document-expiry').length"), 0);
        assert.equal(await evaluate("document.querySelectorAll('.certificate-document-request').length"), visibleCertificates.filter(row => !row.image || row.image.startsWith("/references/")).length);
        const groups = await evaluate("[...document.querySelectorAll('.certificate-document-group')].map(group => ({count:Number(group.dataset.documentCount), width:group.querySelector('.auto-carousel-viewport').clientWidth, cardWidth:group.querySelector('.auto-carousel-item').getBoundingClientRect().width}))");
        if (width === 1440) assert.ok(groups.every(group => group.cardWidth / group.width < .26 && group.cardWidth / group.width > .2), "Desktop uses compact four-column certificate cards even when only three exist.");
        for (const index of [0, 1]) {
          const selector = `document.querySelectorAll('.certificate-document-group')[${index}]`;
          await evaluate(`${selector}.scrollIntoView({behavior:'instant',block:'start'}); document.activeElement?.blur()`);
          const before = await evaluate(`({left:${selector}.querySelector('.auto-carousel-viewport').scrollLeft,first:${selector}.querySelector('h4').textContent})`);
          await evaluate(`${selector}.querySelector('.auto-carousel-arrow.is-next').click()`);
          await waitFor(`Math.abs(${selector}.querySelector('.auto-carousel-viewport').scrollLeft - ${before.left}) > 15 || ${selector}.querySelector('h4').textContent !== ${JSON.stringify(before.first)}`);
          const manual = await evaluate(`({left:${selector}.querySelector('.auto-carousel-viewport').scrollLeft,first:${selector}.querySelector('h4').textContent})`);
          await evaluate(`${selector}.querySelector('.auto-carousel-arrow.is-previous').click()`);
          await waitFor(`Math.abs(${selector}.querySelector('.auto-carousel-viewport').scrollLeft - ${manual.left}) > 15 || ${selector}.querySelector('h4').textContent !== ${JSON.stringify(manual.first)}`);
          await pause(450);
          if (width === 390) {
            await evaluate(`${selector}.querySelector('.auto-carousel-viewport').scrollTo({left:0,behavior:'instant'})`);
            const gesture = await evaluate(`(() => { const viewport=${selector}.querySelector('.auto-carousel-viewport'); const box=viewport.getBoundingClientRect(); return {x:box.right-40,y:Math.max(110,box.top+120),left:viewport.scrollLeft,first:${selector}.querySelector('h4').textContent}; })()`);
            await command("Input.dispatchTouchEvent", { type:"touchStart", touchPoints:[{x:gesture.x,y:gesture.y,id:1}] });
            for (const distance of [35, 70, 105, 140]) await command("Input.dispatchTouchEvent", { type:"touchMove",touchPoints:[{x:gesture.x-distance,y:gesture.y,id:1}] });
            await command("Input.dispatchTouchEvent", { type:"touchEnd",touchPoints:[] });
            await waitFor(`Math.abs(${selector}.querySelector('.auto-carousel-viewport').scrollLeft - ${gesture.left}) > 20 || ${selector}.querySelector('h4').textContent !== ${JSON.stringify(gesture.first)}`);
            assert.ok(await evaluate("!document.querySelector('.certificate-preview-dialog').open"), "Swiping must not accidentally open a document preview.");
          }
          await evaluate("document.activeElement?.blur()");
          await command("Input.dispatchMouseEvent", { type:"mouseMoved", x:1, y:1 });
          const automatic = await evaluate(`({left:${selector}.querySelector('.auto-carousel-viewport').scrollLeft,first:${selector}.querySelector('h4').textContent})`);
          await waitFor(`Math.abs(${selector}.querySelector('.auto-carousel-viewport').scrollLeft - ${automatic.left}) > 15 || ${selector}.querySelector('h4').textContent !== ${JSON.stringify(automatic.first)}`);
        }
        await evaluate("document.querySelector('.certificate-document-group').scrollIntoView({behavior:'instant',block:'start'}); window.scrollBy(0,-110)");
        await screenshot(`certificates-quality-${locale}-${width}.png`);
        await evaluate("document.querySelector('.certificate-document-preview').click()");
        await waitFor("document.querySelector('.certificate-preview-dialog').open && document.querySelector('.certificate-preview-body img').naturalWidth > 0");
        assert.ok(await evaluate("document.body.style.overflow === 'hidden' && [...document.querySelectorAll('.certificate-document-group .auto-carousel')].every(carousel=>carousel.dataset.autoplayPaused==='true')"), "Opening a document pauses both carousels and locks background scrolling.");
        assert.ok(await evaluate("(() => { const box=document.querySelector('.certificate-preview-dialog').getBoundingClientRect();return box.left>=0 && box.right<=innerWidth && box.top>=0 && box.bottom<=innerHeight; })()"), "Preview stays within the viewport.");
        await screenshot(`certificates-preview-${locale}-${width}.png`);
        await command("Input.dispatchKeyEvent", { type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27 });
        await waitFor("!document.querySelector('.certificate-preview-dialog').open && document.body.style.overflow !== 'hidden'");
        assert.ok(await evaluate("document.activeElement.classList.contains('certificate-document-preview')"), "Closing restores keyboard focus to the original document.");
      }
    }
    console.log(JSON.stringify({result:"PASS",certificates:visibleCertificates.length,classification:"CMS create/edit/filter + persisted categories + API validation",public:"all visible records including no-image placeholders",carousel:"four-column desktop, both groups manual + autoplay + mobile touch swipe",preview:"English/Chinese, 1440px/390px, escape/focus/modal pause",userRecordsChanged:false}));
  } else if (process.argv.includes("--company")) {
    await command("Network.enable");
    await command("Page.enable");
    await mkdir(path.resolve("outputs"), { recursive: true });
    for (const locale of ["en", "zh"]) {
      await command("Network.setCookie", { name: "locale", value: locale, url: base, sameSite: "Lax" });
      for (const width of [1440, 390]) {
        await command("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 1050, deviceScaleFactor: 1, mobile: width === 390 });
        for (const route of ["/about", "/", "/factory"]) {
          await command("Page.navigate", { url: `${base}${route}` });
          await waitFor(`location.pathname === ${JSON.stringify(route)} && document.readyState === 'complete' && document.querySelectorAll('main h1').length === 1`);
          assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `${locale} ${route} width ${width}: horizontal overflow`);
          if (route === "/about") {
            await waitFor("document.querySelectorAll('.company-timeline-milestone').length === 4");
            const years = await evaluate("[...document.querySelectorAll('.company-timeline-date')].map(element => element.textContent)");
            assert.deepEqual(years, ["1999", "2003", "2014", "2022"]);
            await evaluate("document.querySelector('.cookie-consent .btn-outline')?.click(); document.getElementById('company-history').scrollIntoView({behavior:'instant'})");
            await waitFor("document.querySelector('.company-history-image img').naturalWidth > 0");
            if (width === 390) await evaluate("document.querySelector('.company-timeline').scrollIntoView({behavior:'instant'})");
            await screenshot(`company-history-${locale}-${width}.png`);
            assert.equal(await evaluate("getComputedStyle(document.querySelector('.company-timeline')).gridTemplateColumns.split(' ').length"), width === 390 ? 1 : 4);
            const images = await evaluate("[...document.querySelectorAll('img[src^=\"/company-profile/\"]')].map(image => ({alt:image.alt,src:image.getAttribute('src')}))");
            assert.ok(images.length >= 3 && images.every(image => image.alt), "Source photographs and market image need descriptive ALT.");
          }
        }
      }
    }
    console.log(JSON.stringify({ result: "PASS", companyProfile: "English and Chinese, 1440px and 390px", timeline: [1999, 2003, 2014, 2022], overflow: false, liveDatabaseWrites: false, screenshots: ["company-history-en-1440.png", "company-history-en-390.png", "company-history-zh-1440.png", "company-history-zh-390.png"] }));
  } else {
  const role = await db.role.findFirst({ where: { permissions: { some: { permission: { key: "*" } } } } });
  assert.ok(role);
  const user = await db.user.create({ data: { name: "Shanze UI review", email: `admin-ui-${randomUUID()}@example.invalid`, passwordHash: "disabled-test-login", roles: { create: { roleId: role.id } } } });
  userId = user.id;
  const token = randomBytes(32).toString("base64url");
  await db.session.create({ data: { userId, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 300000) } });
  await command("Network.enable");
  await command("Network.setCookie", { name: "enercore_session", value: token, url: base, httpOnly: true, sameSite: "Lax" });
  await command("Page.enable");
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  await command("Page.navigate", { url: `${base}/admin/system` });
  await waitFor("Boolean(document.querySelector('.sc-heading'))");
  await mkdir(path.resolve("outputs"), { recursive: true });
  const desktop = await evaluate("({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,sidebar:Math.round(document.querySelector('.admin-sidebar').getBoundingClientRect().width),groups:document.querySelectorAll('.admin-nav-group').length})");
  assert.equal(desktop.sidebar, 232);
  assert.ok(desktop.scrollWidth <= desktop.viewport, "Desktop page must not overflow horizontally.");
  await screenshot("admin-security-desktop.png");
  await evaluate("document.querySelector('.admin-sidebar-toggle').click()");
  await waitFor("Math.round(document.querySelector('.admin-sidebar').getBoundingClientRect().width) === 72");
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await waitFor("document.querySelector('.admin-sidebar-toggle').getAttribute('aria-label') === '打开导航菜单'");
  await waitFor("document.querySelector('.admin-sidebar').getBoundingClientRect().right <= 0");
  const mobile = await evaluate("({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,sidebarRight:document.querySelector('.admin-sidebar').getBoundingClientRect().right})");
  assert.ok(mobile.sidebarRight <= 0, "Mobile sidebar should be hidden initially.");
  assert.ok(mobile.scrollWidth <= mobile.viewport, "Mobile page must not overflow horizontally.");
  await screenshot("admin-security-mobile.png");
  await evaluate("document.querySelector('.admin-sidebar-toggle').click()");
  await waitFor("document.querySelector('.admin-shell').dataset.sidebarOpen === 'true' && document.querySelector('.admin-main').inert");
  await pause(250);
  await screenshot("admin-navigation-mobile.png");
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor("document.querySelector('.admin-shell').dataset.sidebarOpen === 'false' && !document.querySelector('.admin-main').inert");
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  await command("Page.navigate", { url: `${base}/admin/inbox` });
  await waitFor("Boolean(document.querySelector('.inbox-thread-head .inbox-channel'))");
  const inbox = await evaluate("({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,channelWidth:Math.round(document.querySelector('.inbox-thread-head .inbox-channel').getBoundingClientRect().width)})");
  assert.ok(inbox.channelWidth > 40, "Conversation channel label must not be squeezed into the old icon circle.");
  assert.ok(inbox.scrollWidth <= inbox.viewport);
  await screenshot("admin-inbox-desktop.png");
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await waitFor("document.querySelector('.admin-sidebar-toggle').getAttribute('aria-label') === '打开导航菜单'");
  await waitFor("document.querySelector('.admin-sidebar').getBoundingClientRect().right <= 0");
  assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "Mobile inbox must not overflow horizontally.");
  await screenshot("admin-inbox-mobile.png");
  if (process.argv.includes("--seo")) {
    await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
    await command("Page.navigate", { url: `${base}/admin/seo-tools` });
    await waitFor("Boolean(document.querySelector('input[placeholder=\"G-XXXXXXXXXX\"]'))");
    await waitFor("!document.querySelector('button.btn-primary').disabled");
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "SEO config desktop must not overflow.");
    await screenshot("admin-seo-desktop.png");
    await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await pause(250);
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "SEO config mobile must not overflow.");
    await screenshot("admin-seo-mobile.png");
    const publicRoutes = ["/blog", "/blog/how-to-choose-power-bank-manufacturer", "/power-bank-manufacturer", "/magnetic-power-bank-oem", "/wireless-charger-manufacturer", "/custom-power-bank-supplier", "/products/magnetic-power-bank-10000"];
    for (const route of publicRoutes) {
      await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
      await command("Page.navigate", { url: `${base}${route}` });
      await waitFor(`location.pathname === ${JSON.stringify(route)} && document.readyState === 'complete' && document.querySelectorAll('main h1').length === 1`);
      await pause(150);
      assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `${route}: desktop horizontal overflow`);
      const canonical = await evaluate("document.querySelector('link[rel=canonical]').href");
      assert.equal(new URL(canonical).origin, "https://shanzesz.com");
      assert.equal(new URL(canonical).pathname, route);
      if (route === "/blog") {
        await evaluate("document.querySelector('.cookie-consent-actions .btn-outline')?.click()");
        await waitFor("!document.querySelector('.cookie-consent')");
        assert.equal(await evaluate("document.querySelectorAll('script[src*=googletagmanager]').length"), 0, "Rejecting analytics must not load Google.");
        await screenshot("seo-blog-desktop.png");
      }
      await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await pause(200);
      assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `${route}: mobile horizontal overflow`);
      assert.ok(await evaluate("!document.querySelector('.customer-channel-menu') || document.querySelector('.customer-channel-menu').getBoundingClientRect().width === 0"), "Mobile customer channel panel should start collapsed.");
      if (route === "/blog" || route === "/magnetic-power-bank-oem" || route.includes("how-to-choose")) await screenshot(`seo-${route.split("/").filter(Boolean).at(-1)}-mobile.png`);
    }
    await evaluate("document.querySelector('#cookie-preferences-trigger').click()");
    await waitFor("Boolean(document.querySelector('.cookie-consent'))");
    await evaluate("document.querySelector('.cookie-consent-actions .btn-primary').click()");
    await waitFor("!document.querySelector('.cookie-consent')");
    assert.equal(await evaluate("document.querySelectorAll('script[src*=googletagmanager]').length"), 0, "Development builds must not send Google analytics.");
    await command("Network.setCookie", { name: "locale", value: "zh", url: base, sameSite: "Lax" });
    await command("Page.navigate", { url: `${base}/about` });
    await waitFor("Boolean(document.querySelector('main h1')?.textContent.includes('山泽新能源科技'))");
    assert.equal(await evaluate("document.querySelector('.site-header .brand-name').textContent"), "山泽新能源科技");
    assert.ok(await evaluate("!/(能核科技|核能科技)/.test(document.body.innerText)"), "Legacy editable branding must not remain visible.");
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "Renamed Chinese brand must fit mobile layout.");
    await screenshot("shanze-renamed-about-mobile.png");
    console.log(JSON.stringify({ seoUi: "PASS", responsiveRoutes: publicRoutes, consent: "PASS", googleNetwork: "disabled in development" }));
  }
  console.log(JSON.stringify({ result: "PASS", desktop, mobile, inbox, screenshots: ["outputs/admin-security-desktop.png", "outputs/admin-security-mobile.png", "outputs/admin-navigation-mobile.png", "outputs/admin-inbox-desktop.png", "outputs/admin-inbox-mobile.png"] }));
  }
} finally {
  if (socket?.readyState === WebSocket.OPEN) await command("Browser.close").catch(() => undefined);
  socket?.close();
  if (browserProcess && browserProcess.exitCode === null) { browserProcess.kill(); await pause(300); }
  if (certificateTestId) await db.certificate.deleteMany({ where: { id: certificateTestId } });
  if (userId) { await db.auditLog.deleteMany({ where: { userId } }); await db.user.delete({ where: { id: userId } }); }
  await db.$disconnect();
  const resolvedProfile = path.resolve(profile);
  if (path.dirname(resolvedProfile) === path.resolve(tmpdir()) && path.basename(resolvedProfile).startsWith("shanze-admin-ui-")) await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
