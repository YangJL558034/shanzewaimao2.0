// Read-only public-site QA. Uses a new browser profile, never existing user sessions or Prisma.
// Usage: node scripts/check-site-images.mjs [--seo] [--allow-pending] [--routes=/news,/quality]
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import path from "node:path";

const base = new URL(process.env.SITE_IMAGE_TEST_URL || process.env.ADMIN_TEST_URL || "http://localhost:3000").origin;
const allowPending = process.argv.includes("--allow-pending");
const seoChecks = process.argv.includes("--seo");
const selectedRoutes = process.argv.find((argument) => argument.startsWith("--routes="))?.slice(9).split(",").filter(Boolean);
const routes = selectedRoutes || ["/", "/about", "/products", "/factory", "/quality", "/news", "/blog", "/contact", "/power-bank-manufacturer", "/magnetic-power-bank-oem", "/wireless-charger-manufacturer", "/custom-power-bank-supplier", "/products/magnetic-power-bank-10000", "/news/next-gen-magsafe-power-bank", "/blog/how-to-choose-power-bank-manufacturer"];
assert.ok(routes.every((route) => route.startsWith("/") && !route.startsWith("//") && !route.includes("\\") && !route.startsWith("/admin")), "Only public, same-origin route paths are supported.");
const profile = await mkdtemp(path.join(tmpdir(), "shanze-site-images-"));
await mkdir(path.resolve("outputs"), { recursive: true });
const output = await mkdtemp(path.join(path.resolve("outputs"), "site-images-"));
const pending = new Map();
const failures = [];
const warnings = [];
const results = [];
const blockedWrites = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser;
let socket;
let sequence = 0;

async function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 15000);
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
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error(`Browser condition not reached: ${expression}`);
}

function check(condition, message, context) {
  if (!condition) failures.push({ context, message });
}

function missing(message, context) {
  (allowPending ? warnings : failures).push({ context, message });
}

async function click(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
  const point = await evaluate(`(() => {const box=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:box.left+box.width/2,y:box.top+box.height/2};})()`);
  await command("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
  await command("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", buttons: 1, clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", buttons: 0, clickCount: 1 });
}

async function screenshot(filename, fullPage = true) {
  const { cssContentSize } = await command("Page.getLayoutMetrics");
  const width = await evaluate("innerWidth");
  const options = fullPage ? { captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.min(Math.ceil(cssContentSize.height), 16000), scale: 1 } } : {};
  const { data } = await command("Page.captureScreenshot", { format: "png", ...options });
  await writeFile(path.join(output, filename), Buffer.from(data, "base64"), { flag: "wx" });
}

async function navigate(route) {
  const result = await command("Page.navigate", { url: `${base}${route}` });
  if (result.errorText) throw new Error(result.errorText);
  await waitFor(`location.pathname===${JSON.stringify(route.split("?")[0])} && document.readyState==='complete' && Boolean(document.querySelector('main h1'))`);
  await evaluate("document.documentElement.style.scrollBehavior='auto'");
  await pause(160);
}

// Inspect complete rendered media, including carousel items currently outside its clipped viewport.
// Eager loading here only fetches existing image files; it changes no CMS settings or database state.
async function inspectPage() {
  const main = document.querySelector("main");
  const visible = (node) => { const style = getComputedStyle(node); const box = node.getBoundingClientRect(); return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0; };
  const imagePath = (source) => {
    try { const url = new URL(source, location.origin); const original = url.pathname === "/_next/image" ? url.searchParams.get("url") : ""; return original ? new URL(original, location.origin).pathname : url.pathname; } catch { return source; }
  };
  const images = [...main.querySelectorAll("img")].filter(visible);
  const originalAttributes = new Map(images.map((image) => [image, { alt: image.getAttribute("alt"), title: image.getAttribute("title"), loading: image.getAttribute("loading"), decoding: image.getAttribute("decoding"), fetchPriority: image.getAttribute("fetchpriority"), srcSet: image.getAttribute("srcset"), sizes: image.getAttribute("sizes"), isHero: image.classList.contains("hero-seo-image"), objectFit: getComputedStyle(image).objectFit, objectPosition: getComputedStyle(image).objectPosition }]));
  images.forEach((image) => { image.loading = "eager"; });
  const backgrounds = new Map();
  for (const node of main.querySelectorAll("*")) {
    if (!visible(node)) continue;
    for (const pseudo of [null, "::before", "::after"]) {
      const style = getComputedStyle(node, pseudo);
      if (pseudo && (style.content === "none" || style.display === "none")) continue;
      for (const match of style.backgroundImage.matchAll(/url\(["']?(.*?)["']?\)/g)) backgrounds.set(match[1], { source: match[1], class: node.getAttribute("class") || node.tagName, pseudo });
    }
  }
  const loadImage = (image) => new Promise((resolve) => {
    if (image.complete) { resolve(image.naturalWidth > 0); return; }
    const finish = () => { image.removeEventListener("load", finish); image.removeEventListener("error", finish); resolve(image.naturalWidth > 0); };
    image.addEventListener("load", finish, { once: true }); image.addEventListener("error", finish, { once: true });
    setTimeout(finish, 7000);
  });
  const backgroundChecks = [...backgrounds.values()].map(async (background) => { const image = new Image(); image.src = background.source; const loaded = await loadImage(image); return { ...background, path: imagePath(background.source), loaded, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight }; });
  await Promise.all([Promise.all(images.map(loadImage)), Promise.all(backgroundChecks), document.fonts.ready]);
  const dimensions = (selector) => [...main.querySelectorAll(selector)].filter(visible).map((node) => ({ class: node.getAttribute("class"), width: Number(node.getBoundingClientRect().width.toFixed(2)), height: Number(node.getBoundingClientRect().height.toFixed(2)), heading: node.closest("article")?.querySelector("h2,h3,h4")?.textContent.trim() || "" }));
  // Article "More sourcing guides" cards deliberately contain text only, unlike blog listing covers.
  const pendingCards = [...main.querySelectorAll(".category-card,.product-card,.gallery-card,.seo-product-card,.news-card,.blog-listing .blog-card")].filter((node) => visible(node) && !node.querySelector("img,video,iframe")).map((node) => ({ class: node.getAttribute("class"), heading: node.querySelector("h2,h3,h4")?.textContent.trim() || "" }));
  const hero = main.querySelector(".page-hero");
  const heroMissing = !!hero && !hero.querySelector(".hero-image-layer,.hero-media-layer");
  const productGalleryMissing = !!main.querySelector(".product-detail-top") && !main.querySelector(".product-gallery-main img,.product-gallery-main video,.product-gallery-main iframe");
  return {
    h1: main.querySelector("h1")?.textContent.trim(), language: document.documentElement.lang,
    width: innerWidth, documentWidth: document.documentElement.scrollWidth,
    images: images.map((image) => { const box = image.getBoundingClientRect(); const parent = image.parentElement.getBoundingClientRect(); return { ...originalAttributes.get(image), sourcePath: imagePath(image.src), path: imagePath(image.currentSrc || image.src), loaded: image.complete && image.naturalWidth > 0, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, width: Number(box.width.toFixed(2)), parentWidth: Number(parent.width.toFixed(2)) }; }),
    backgrounds: await Promise.all(backgroundChecks), pendingCards, heroMissing, productGalleryMissing,
    newsFrames: dimensions(".news-card .news-cover"), galleryFrames: dimensions(".gallery-card .card-art:not(.factory-equipment-fallback):not(.factory-workshop-art)"),
    factoryFrames: dimensions(".factory-equipment-media,.factory-equipment-fallback,.factory-workshop-art,.factory-workshop-placeholder"),
    runtimeErrors: window.__siteImageErrors || [], analyticsScripts: [...document.scripts].filter((script) => /googletagmanager|google-analytics/.test(script.src)).map((script) => script.src),
  };
}

try {
  const candidates = [process.env.SITE_IMAGE_TEST_BROWSER, process.env.ADMIN_TEST_BROWSER, "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].filter(Boolean);
  let executable;
  for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch { /* Try another installed browser. */ } }
  assert.ok(executable, "Set SITE_IMAGE_TEST_BROWSER to an installed Edge or Chrome executable.");
  const portServer = createServer();
  await new Promise((resolve) => portServer.listen(0, "127.0.0.1", resolve));
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  browser = spawn(executable, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-default-apps", "--window-size=1440,1050", "about:blank"], { windowsHide: true, stdio: "ignore" });
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
      const blocked = !["GET", "HEAD"].includes(request.method) || /\/api\/(?:analytics|customer-chat|inquiries|newsletter|webhooks)(?:\/|\?|$)/.test(url.pathname);
      if (blocked) blockedWrites.push({ method: request.method, path: url.pathname });
      command(blocked ? "Fetch.failRequest" : "Fetch.continueRequest", blocked ? { requestId, errorReason: "BlockedByClient" } : { requestId }).catch(() => undefined);
      return;
    }
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message)); else handler.resolve(message.result);
  });
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  await command("Network.enable");
  await command("Network.setBlockedURLs", { urls: ["*://*.googletagmanager.com/*", "*://*.google-analytics.com/*", "*://*.analytics.google.com/*", "*://*.doubleclick.net/*", "*://client.crisp.chat/*", "*/api/analytics/*", "*/api/customer-chat*", "*/api/customer-events*"] });
  await command("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  await command("Page.enable");
  await command("Page.addScriptToEvaluateOnNewDocument", { source: "window.__siteImageErrors=[];window.addEventListener('error',event=>{if(event.message)window.__siteImageErrors.push(event.message)})" });
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });

  for (const locale of ["en", "zh"]) {
    for (const width of [1440, 390]) {
      const context = `${locale} ${width}`;
      const height = width === 390 ? 844 : 1050;
      await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width === 390 });
      await command("Emulation.setTouchEmulationEnabled", { enabled: width === 390, maxTouchPoints: 1 });
      await command("Network.setCookie", { name: "locale", value: locale, url: base, sameSite: "Lax" });
      await command("Page.navigate", { url: `${base}/` });
      await waitFor("location.pathname==='/' && document.readyState==='complete' && Boolean(document.querySelector('main h1'))");
      await evaluate("localStorage.removeItem('enercore_cookie_consent')");
      await command("Page.reload");
      await waitFor("Boolean(document.querySelector('.cookie-consent'))");
      const cookie = await evaluate("({text:document.querySelector('.cookie-consent').textContent,buttons:[...document.querySelectorAll('.cookie-consent button')].map(node=>node.textContent.trim()),width:document.querySelector('.cookie-consent').getBoundingClientRect().width})");
      check(locale === "en" ? !/[\u3400-\u9fff]/.test(cookie.text) && cookie.buttons.includes("Necessary only") : cookie.buttons.includes("仅必要功能") && cookie.buttons.includes("同意统计"), "Cookie dialog and controls must match the selected language.", context);
      check(cookie.width <= width, "Cookie dialog must fit the viewport.", context);
      await screenshot(`${locale}-${width}-cookie.png`, false);
      await click(".cookie-consent .btn-outline");
      await waitFor("!document.querySelector('.cookie-consent') && localStorage.getItem('enercore_cookie_consent')==='necessary'");
      await command("Page.reload");
      await waitFor("document.readyState==='complete' && Boolean(document.querySelector('#cookie-preferences-trigger'))");
      await pause(180);
      check(!await evaluate("Boolean(document.querySelector('.cookie-consent'))"), "Consent choice must remain after refresh.", context);
      await click("#cookie-preferences-trigger");
      await waitFor("Boolean(document.querySelector('.cookie-consent'))");
      check((await evaluate("document.querySelector('.cookie-consent strong').textContent")).includes(locale === "en" ? "Privacy" : "隐私"), "Footer preferences must reopen the localized dialog.", context);
      await click(".cookie-consent .btn-primary");
      await waitFor("!document.querySelector('.cookie-consent') && localStorage.getItem('enercore_cookie_consent')==='accepted'");
      await command("Page.reload");
      await waitFor("document.readyState==='complete' && Boolean(document.querySelector('#cookie-preferences-trigger'))");
      await pause(180);
      check(!await evaluate("Boolean(document.querySelector('.cookie-consent'))"), "Analytics choice must remain after refresh.", context);
      // Continue all image checks with necessary-only consent and all analytics requests blocked.
      await click("#cookie-preferences-trigger");
      await waitFor("Boolean(document.querySelector('.cookie-consent'))");
      await click(".cookie-consent .btn-outline");
      await waitFor("!document.querySelector('.cookie-consent')");

      for (const route of routes) {
        const label = `${context} ${route}`;
        try {
          await navigate(route);
          await evaluate("document.querySelector('.customer-support-close')?.click();scrollTo({top:0,behavior:'instant'})");
          const metrics = await evaluate(`(${inspectPage.toString()})()`);
          check(metrics.language.startsWith(locale), "Document language must follow the locale cookie.", label);
          check(metrics.documentWidth <= width + 2, `Horizontal overflow: document ${metrics.documentWidth}px > viewport ${width}px.`, label);
          for (const image of metrics.images) {
            // Historical URLs are intentionally preserved, but their old tall screenshots were replaced.
            if (image.path.startsWith("/references/")) check(image.naturalWidth >= image.naturalHeight, `Historical image URL still contains a tall website screenshot: ${image.path}`, label);
            check(image.loaded, `Image did not load: ${image.path}`, label);
            check(image.width <= image.parentWidth + 2, `Image overflows its ${image.parentWidth}px frame: ${image.path}`, label);
            if (seoChecks) {
              check(image.alt !== null && image.title?.trim(), `Image needs an ALT attribute and descriptive title: ${image.path}`, label);
              check(image.decoding === "async", `Image must use asynchronous decoding: ${image.path}`, label);
              if (/^\/(?:uploads\/)?optimized\//.test(image.sourcePath)) check(image.srcSet && image.sizes, `Optimized image needs a static responsive srcset and sizes: ${image.path}`, label);
              if (image.isHero) {
                check(image.loading === "eager" && image.fetchPriority === "high", "The initial hero must load eagerly at high priority.", label);
                check(image.objectFit === "cover" && image.objectPosition === (width === 390 ? "50% 100%" : "50% 50%"), "Hero image must retain its original cover/position styling.", label);
                if (width === 390) check(image.path !== image.sourcePath && /-(?:320|640|960)w\.webp$/.test(image.path), `Mobile hero must select a smaller static WebP variant: ${image.path}`, label);
              }
            }
          }
          for (const background of metrics.backgrounds) {
            if (background.path.startsWith("/references/")) check(background.naturalWidth >= background.naturalHeight, `Historical background URL still contains a tall website screenshot: ${background.path}`, label);
            if (background.class.split(" ").includes("hero-image-layer")) check(background.path.startsWith("/generated/site/"), `Hero must use the new standalone artwork: ${background.path}`, label);
            check(background.loaded, `Background did not load: ${background.path}`, label);
          }
          for (const frame of metrics.newsFrames) check(Math.abs(frame.height - 190) < 1, `News media box changed from 190px to ${frame.height}px.`, label);
          for (const frame of metrics.galleryFrames) check(Math.abs(frame.height - 155) < 1, `Gallery media box changed from 155px to ${frame.height}px (${frame.heading}).`, label);
          // The existing .gallery-card .card-art rule keeps workshop photographs at 155px,
          // including mobile. Equipment and neutral workshop placeholders are 200px on mobile.
          for (const frame of metrics.factoryFrames) {
            const expectedHeight = width === 390 && !frame.class.split(" ").includes("factory-workshop-art") ? 200 : 155;
            check(Math.abs(frame.height - expectedHeight) < 1, `Factory media box changed from ${expectedHeight}px to ${frame.height}px (${frame.heading}).`, label);
          }
          for (const card of metrics.pendingCards) missing(`Image pending: ${card.heading || card.class}`, label);
          if (metrics.heroMissing) missing("Hero artwork is pending.", label);
          if (metrics.productGalleryMissing) missing("Product detail artwork is pending.", label);
          check(metrics.runtimeErrors.length === 0, `Browser errors: ${metrics.runtimeErrors.join(" | ")}`, label);
          await evaluate(`(async () => {
            await Promise.all([...document.querySelectorAll('main img')].map(image=>image.decode().catch(()=>undefined)));
            const sections=[...new Set([...document.querySelectorAll('main .gallery-card img')].map(image=>image.closest('section')).filter(Boolean))];
            for(const section of sections){section.scrollIntoView({block:'center',behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}
          })()`);
          if (route === "/factory") {
            await evaluate("document.querySelector('.factory-workshop-card')?.closest('section')?.scrollIntoView({block:'center',behavior:'instant'})");
            await pause(100);
            await screenshot(`${locale}-${width}-factory-workshop-viewport.png`, false);
          }
          await evaluate("scrollTo({top:0,behavior:'instant'})");
          await pause(80);
          const filename = `${locale}-${width}-${route === "/" ? "home" : route.slice(1).replace(/[^a-z0-9-]+/gi, "-")}.png`;
          await screenshot(filename);
          results.push({ context: label, imageCount: metrics.images.length, backgroundCount: metrics.backgrounds.length, pending: metrics.pendingCards.length + Number(metrics.heroMissing) + Number(metrics.productGalleryMissing), documentWidth: metrics.documentWidth, screenshot: filename, ...(seoChecks ? { hero: metrics.images.find((image) => image.isHero), responsiveImages: metrics.images.filter((image) => image.srcSet).length } : {}) });
          console.log(`${label}: ${metrics.images.length} images, ${metrics.backgrounds.length} backgrounds, ${results.at(-1).pending} pending`);
        } catch (error) { failures.push({ context: label, message: error.message }); console.log(`${label}: FAIL ${error.message}`); }
      }
    }
  }
  const report = { result: failures.length ? "FAIL" : warnings.length ? "PASS_WITH_PENDING" : "PASS", base, allowPending, databaseWrites: false, analyticsRequestsBlocked: true, screenshotDirectory: output, routeChecks: results.length, failures, warnings, blockedWrites, results };
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
  if (failures.length) process.exitCode = 1;
} catch (error) {
  const report = { result: "FAIL", base, allowPending, databaseWrites: false, analyticsRequestsBlocked: true, screenshotDirectory: output, routeChecks: results.length, failures: [...failures, { context: "Browser setup / privacy checks", message: error.message }], warnings, results };
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
  console.error(JSON.stringify({ result: "FAIL", base, message: error.message, report: path.join(output, "report.json") }, null, 2));
  process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) await command("Browser.close").catch(() => undefined);
  socket?.close();
  if (browser && browser.exitCode === null) { browser.kill(); await pause(150); }
  const target = path.resolve(profile);
  // Delete only this newly created, validated temporary profile; never another browser profile.
  if (path.dirname(target) === path.resolve(tmpdir()) && path.basename(target).startsWith("shanze-site-images-")) await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
