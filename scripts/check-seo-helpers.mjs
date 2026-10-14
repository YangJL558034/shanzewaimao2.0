import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const localRequire = createRequire(import.meta.url);
const project = new URL("../", import.meta.url);
let assertions = 0;
function check(actual, expected, message) { assert.deepEqual(actual, expected, message); assertions++; }

function loadSource(path, stubs = {}, globals = {}) {
  const source = readFileSync(new URL(path, project), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const exports = {};
  const sandbox = { exports, module: { exports }, URL, Request, Response, Date, console, process: { env: {} }, ...globals };
  sandbox.require = (id) => Object.hasOwn(stubs, id) ? stubs[id] : localRequire(id);
  vm.runInNewContext(compiled, sandbox, { filename: path });
  return sandbox.module.exports;
}

const environment = {};
const utils = loadSource("lib/utils.ts", {}, { process: { env: environment } });
const seo = loadSource("lib/seo.ts", { "server-only": {}, "@/lib/db": { db: {} }, "@/lib/utils": utils, "@/lib/image-seo-data": { resolveSeoImage: async (src) => src } });
check(utils.absoluteUrl("/products"), "https://shanzesz.com/products", "Default SEO origin");
for (const origin of ["http://localhost:3000", "https://localhost", "https://127.0.0.1", "https://10.0.0.1", "https://192.168.2.1", "https://172.17.0.2", "https://[::1]", "https://demo.localhost", "https://169.254.1.1"]) {
  environment.NEXT_PUBLIC_SITE_URL = origin;
  check(utils.absoluteUrl("/products"), "https://shanzesz.com/products", `Reject development origin ${origin}`);
}
environment.NEXT_PUBLIC_SITE_URL = "https://shanzesz.com";
check(utils.absoluteUrl("https://images.example.com/product.webp"), "https://images.example.com/product.webp", "Keep external media URLs");
check(seo.safeCanonicalUrl("/products?category=magnetic#models"), "https://shanzesz.com/products", "Strip canonical query and fragment");
check(seo.safeCanonicalUrl("/products", "https://shanzesz.com/products?utm_source=test#top"), "https://shanzesz.com/products", "Strip configured canonical tracking");
for (const candidate of ["https://evil.example/products", "//evil.example/products", "http://localhost:3000/products", "javascript:alert(1)", "https://user:password@shanzesz.com/products"]) {
  check(seo.safeCanonicalUrl("/products", candidate), "https://shanzesz.com/products", `Reject unsafe canonical ${candidate}`);
}
check(new URL(seo.safeCanonicalUrl("//evil.example/products")).origin, "https://shanzesz.com", "Canonical fallback cannot escape public origin");
check(new URL(seo.safeCanonicalUrl("https://evil.example/products")).origin, "https://shanzesz.com", "Absolute fallback cannot escape public origin");

let settingsRows = [];
const integration = loadSource("lib/seo-settings.ts", {
  "server-only": {}, react: { cache: (callback) => callback },
  "@/lib/db": { db: { setting: { findMany: async () => settingsRows } } },
}, { process: { env: { NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-TEST1234", GOOGLE_SITE_VERIFICATION: "verification_token_1234" } } });
check(JSON.parse(JSON.stringify(await integration.getSeoIntegrationConfig())), { ga4Id: "G-TEST1234", searchConsoleToken: "verification_token_1234" }, "Environment integration fallback");
settingsRows = [{ key: "google_analytics_id", value: "" }, { key: "google_site_verification", value: "" }];
check(JSON.parse(JSON.stringify(await integration.getSeoIntegrationConfig())), { ga4Id: "", searchConsoleToken: "" }, "Explicit saved blank disables environment integrations");
settingsRows = [{ key: "google_analytics_id", value: "G-<script>bad</script>" }, { key: "google_site_verification", value: '<meta name="google-site-verification" />' }];
check(JSON.parse(JSON.stringify(await integration.getSeoIntegrationConfig())), { ga4Id: "", searchConsoleToken: "" }, "Invalid database integration strings are suppressed");

let permitted = false;
let csrfValid = false;
let saved = 0;
let audited = 0;
const permissions = [];
const api = loadSource("app/api/admin/seo-tools/route.ts", {
  "next/server": { NextResponse: { json: (data, options) => new Response(JSON.stringify(data), { status: options?.status || 200, headers: options?.headers }) } },
  "@/lib/auth": { requireApiUser: async (permission) => { permissions.push(permission); return permitted ? { user: { id: "test-user" } } : { error: new Response("Forbidden", { status: 403 }) }; } },
  "@/lib/security": { verifyCsrf: async () => csrfValid },
  "@/lib/db": { db: { product: { count: async () => 2 }, news: { count: async () => 3 }, seoMeta: { findMany: async () => [] }, auditLog: { create: async () => { audited++; } } } },
  "@/lib/utils": utils,
  "@/lib/seo-settings": { ...integration, getSeoIntegrationConfig: async () => ({ ga4Id: "", searchConsoleToken: "" }), saveSeoIntegrationConfig: async () => { saved++; } },
});
const putRequest = (data) => new Request("https://shanzesz.com/api/admin/seo-tools", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
check((await api.GET()).status, 403, "GET requires SEO read permission");
check((await api.PUT(putRequest({}))).status, 403, "PUT requires SEO write permission");
check(permissions, ["seo.read", "seo.write"], "Integration API checks the specific SEO permissions");
permitted = true;
check((await api.PUT(putRequest({ ga4Id: "G-TEST1234", searchConsoleToken: "" }))).status, 403, "CSRF required before saving");
check(saved, 0, "Rejected requests cannot save settings");
csrfValid = true;
check((await api.PUT(putRequest({ ga4Id: "bad-id", searchConsoleToken: "" }))).status, 400, "Malformed GA4 ID rejected");
check((await api.PUT(putRequest({ ga4Id: "G-TEST1234", searchConsoleToken: '<meta content="bad" />' }))).status, 400, "Full verification HTML rejected");
check((await api.PUT(putRequest({ ga4Id: "G-TEST1234", searchConsoleToken: "verification_token_1234" }))).status, 200, "Valid integrations accepted by mocked API");
check(saved, 1, "Single mocked configuration save");
check(audited, 1, "Configuration change creates mocked audit record");
check((await api.GET()).headers.get("cache-control"), "no-store", "Admin integration response cannot be cached");

const consent = new Map();
const listeners = new Map();
const mockWindow = { addEventListener: (name, callback) => { listeners.set(name, callback); }, removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name); } };
const localStorage = { getItem: (key) => consent.get(key) || null };
const location = { origin: "https://shanzesz.com", hostname: "shanzesz.com", href: "https://shanzesz.com/contact?email=private@example.com#secret" };
const document = { title: "Contact Shanze", cookie: "", referrer: "https://search.example.com/search?email=private@example.com" };
const navigator = { doNotTrack: "0" };
let pathname = "/contact";
let accepted = false;
let dirty = false;
let effectIndex = 0;
let effects = [];
const previousEffects = [];
const reference = { current: "" };
const react = {
  useState: () => [accepted, (value) => { if (accepted !== value) { accepted = value; dirty = true; } }],
  useRef: () => reference,
  useEffect: (callback, dependencies) => {
    const index = effectIndex++;
    const previous = previousEffects[index];
    if (!previous || dependencies.some((value, position) => !Object.is(value, previous.dependencies[position]))) {
      effects.push(() => { previous?.cleanup?.(); previousEffects[index] = { dependencies, cleanup: callback() }; });
    }
  },
};
const ga = loadSource("components/public/GoogleAnalytics.tsx", {
  react, "next/script": () => {}, "next/navigation": { usePathname: () => pathname },
  "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
}, { window: mockWindow, location, document, navigator, localStorage });
const measurementId = "G-TEST1234";
function render() {
  let element;
  let iterations = 0;
  do {
    dirty = false; effects = []; effectIndex = 0;
    element = ga.GoogleAnalytics({ measurementId, nonce: "test-nonce", enabled: true });
    effects.forEach((callback) => callback());
    assert.ok(++iterations < 5, "Mock hook rendering must settle");
  } while (dirty);
  return element;
}
const commands = () => (mockWindow.dataLayer || []).map((item) => Array.from(item));
const pageViews = () => commands().filter((item) => item[0] === "event" && item[1] === "page_view");
check(render(), null, "GA script absent before consent");
check(commands().length, 0, "No tracking queued before consent");
consent.set("enercore_cookie_consent", "accepted");
listeners.get("enercore-consent-change")?.();
check(render()?.props.src, `https://www.googletagmanager.com/gtag/js?id=${measurementId}`, "GA script loads after consent");
check(pageViews().length, 1, "Exactly one initial manual pageview");
check(commands().find((item) => item[0] === "config")[2].send_page_view, false, "Automatic initial pageview is disabled");
check(commands().find((item) => item[0] === "config")[2].allow_google_signals, false, "Google advertising signals are disabled");
check(pageViews()[0][2].page_location, "https://shanzesz.com/contact", "Customer query values omitted from page location");
check(pageViews()[0][2].send_to, measurementId, "Manual pageview targets only the configured GA destination");
check(pageViews()[0][2].page_referrer, "https://search.example.com", "Referrer query and path omitted");
render();
check(pageViews().length, 1, "Repeated render cannot duplicate pageviews");
listeners.get("shanze-analytics-event")?.({ detail: { name: "generate_lead", channel: "website_form", email: "private@example.com", text: "confidential inquiry" } });
const lead = commands().find((item) => item[0] === "event" && item[1] === "generate_lead");
check(Object.keys(lead[2]).sort(), ["channel", "page_location", "send_to"], "Lead event only contains allowed fields");
check(lead[2].send_to, measurementId, "Lead event targets only the configured GA destination");
const beforeInvalidEvent = commands().length;
listeners.get("shanze-analytics-event")?.({ detail: { name: "private@example.com", channel: "website_form" } });
listeners.get("shanze-analytics-event")?.({ detail: { name: "generate_lead", channel: "private@example.com" } });
check(commands().length, beforeInvalidEvent, "Unknown event and channel rejected");
pathname = "/products/magnetic-power-bank-10000"; render();
check(pageViews().length, 2, "SPA navigation generates one pageview");
pathname = "/admin/inbox";
check(render(), null, "No GA script element on admin route");
check(mockWindow[`ga-disable-${measurementId}`], true, "Previously loaded GA disabled on admin route");
check(pageViews().length, 2, "Admin pageview never generated");
pathname = "/unsubscribe";
check(render(), null, "Unsubscribe token flow excluded");
consent.set("enercore_cookie_consent", "necessary");
listeners.get("enercore-consent-change")?.();
pathname = "/contact";
check(render(), null, "Consent withdrawal removes script element");
check(mockWindow[`ga-disable-${measurementId}`], true, "Consent withdrawal disables measurement");
navigator.doNotTrack = "1";
consent.set("enercore_cookie_consent", "accepted");
listeners.get("enercore-consent-change")?.();
check(render(), null, "Do Not Track prevents script loading even with stored consent");
console.log(`SEO and analytics checks passed: ${assertions} assertions. No real database writes or Google requests were made.`);
