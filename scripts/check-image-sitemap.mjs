// Pure mocked regression: no database writes, uploads, network requests or external services.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const localRequire = createRequire(import.meta.url);
const project = new URL("../", import.meta.url);
function loadSource(file, stubs = {}) {
  const source = readFileSync(new URL(file, project), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { exports: module.exports, module, URL, Date, console, process: { env: {} }, require: (id) => Object.hasOwn(stubs, id) ? stubs[id] : localRequire(id) }, { filename: file });
  return module.exports;
}

let assertions = 0;
const check = (condition, label) => { assert.ok(condition, label); assertions++; };
const utils = loadSource("lib/utils.ts");
const seo = loadSource("lib/seo.ts", { "server-only": {}, "@/lib/db": { db: {} }, "@/lib/utils": utils, "@/lib/image-seo-data": { resolveSeoImage: async (src) => src } });
const dates = { updatedAt: new Date("2026-10-14T00:00:00Z") };
const rows = {
  product: [
    { ...dates, slug: "power-bank", name: "Power Bank", status: "PUBLISHED", noIndex: false, canonical: null, coverImage: "/old-cover.jpg", hoverImage: "http://localhost:3000/old-cover.jpg", category: { isVisible: true }, images: [{ url: "/detail.jpg" }, { url: "/uploads/private.jpg" }, { url: "/api/private/chat.png" }, { url: "javascript:alert(1)" }, { url: "//unsafe.example/image.jpg" }, { url: "https://user:secret@unsafe.example/image.jpg" }, { url: "/download.pdf" }, { url: "/film.mp4" }] },
    { ...dates, slug: "large-gallery", name: "Power Bank Gallery", status: "PUBLISHED", noIndex: false, canonical: null, coverImage: "/gallery-cover.jpg", hoverImage: "/gallery-cover.jpg", category: { isVisible: true }, images: Array.from({ length: 1100 }, (_, index) => ({ url: `/gallery-${index}.webp` })) },
    { ...dates, slug: "draft", name: "Draft", status: "DRAFT", noIndex: false, coverImage: "/draft.jpg", images: [], category: { isVisible: true } },
    { ...dates, slug: "noindex", name: "Noindex", status: "PUBLISHED", noIndex: true, coverImage: "/noindex.jpg", images: [], category: { isVisible: true } },
    { ...dates, slug: "duplicate", name: "Canonical duplicate", status: "PUBLISHED", noIndex: false, canonical: "/products/power-bank", coverImage: "/duplicate.jpg", images: [], category: { isVisible: true } },
  ],
  news: [
    { ...dates, slug: "guide", status: "PUBLISHED", noIndex: false, canonical: "/news/guide", coverImage: "/guide.jpg", category: { slug: "industry-guides" } },
    { ...dates, slug: "announcement", status: "PUBLISHED", noIndex: false, coverImage: "https://images.example.com/article.jpg", category: { slug: "company-news" } },
    { ...dates, slug: "draft-post", status: "DRAFT", noIndex: false, coverImage: "/draft-post.jpg", category: { slug: "industry-guides" } },
    { ...dates, slug: "noindex-post", status: "PUBLISHED", noIndex: true, coverImage: "/noindex-post.jpg", category: { slug: "industry-guides" } },
  ],
  seoMeta: [{ route: "/contact", noIndex: true }, { route: "/factory", noIndex: false, canonical: "/about" }],
  banner: [{ page: "home", image: "/hero.jpg", status: "PUBLISHED" }, { page: "home", image: "/hidden-banner.jpg", status: "DRAFT" }, { page: "not-a-public-route", image: "/phantom.jpg", status: "PUBLISHED" }],
  pageSection: [
    { id: "home-products", page: "home", key: "products", isVisible: true, image: "/section.jpg", items: JSON.stringify([{ image: "/item.jpg" }, { image: "/old-cover.jpg" }]) },
    { id: "equipment", page: "home", key: "equipment", isVisible: true, image: null, items: "[]" },
    { id: "workshop", page: "home", key: "workshop", isVisible: true, image: null, items: "[]" },
    { id: "quality-certificates", page: "quality", key: "certifications", isVisible: true, image: null, items: "[]" },
    { id: "quality-workshop", page: "quality", key: "workshop", isVisible: true, image: null, items: "[]" },
    { id: "hidden", page: "home", key: "hidden", isVisible: false, image: "/hidden-section.jpg", items: "[]" },
  ],
  productCategory: [{ isVisible: true, image: "/category.jpg" }, { isVisible: false, image: "/hidden-category.jpg" }],
  factoryEquipment: [{ isVisible: true, image: "/equipment.jpg" }, { isVisible: false, image: "/hidden-equipment.jpg" }],
  workshop: [{ isVisible: true, image: "/workshop.jpg" }],
  certificate: [{ isVisible: true, image: "/certificate.jpg" }, { isVisible: false, image: "/hidden-certificate.jpg" }, { isVisible: true, image: null }],
  media: [{ isPrivate: true, path: "/uploads/private.jpg" }],
  translation: [{ entityType: "PageSection", entityId: "home-products", field: "items", value: JSON.stringify([{ image: "/translated-item.jpg" }]), locale: { isActive: true } }],
};
const matches = (row, where = {}) => Object.entries(where).every(([key, expected]) => {
  if (expected && typeof expected === "object") {
    if ("in" in expected) return expected.in.includes(row[key]);
    return matches(row[key] || {}, expected);
  }
  return row[key] === expected;
});
const queryChecks = [];
const db = Object.fromEntries(Object.entries(rows).map(([model, values]) => [model, { findMany: async ({ where = {} } = {}) => { queryChecks.push({ model, where }); return values.filter((row) => matches(row, where)); } }]));
const content = loadSource("lib/page-content.ts", { "@/lib/db": { db }, "@/lib/i18n": {} });
let manifestReads = 0;
const sitemap = loadSource("app/sitemap.ts", {
  "@/lib/db": { db }, "@/lib/utils": utils, "@/lib/seo": seo,
  "@/lib/seo-landings": { seoLandings: { "power-bank-manufacturer": {} }, seoLandingContent: { "power-bank-manufacturer": { en: { productTerms: ["power bank"] } } } },
  "@/lib/blog": { isBlogCategorySlug: (slug) => slug === "industry-guides" },
  "@/lib/page-content": content,
  "@/lib/image-seo-data": { getImageSeoMap: async () => { manifestReads++; return { "/old-cover.jpg": { src: "/optimized/power-bank.webp", width: 1200, height: 800 } }; } },
});
const result = JSON.parse(JSON.stringify(await sitemap.default()));
const byPath = new Map(result.map((item) => [new URL(item.url).pathname, item]));
const allImages = result.flatMap((item) => item.images || []);
check(manifestReads === 1, "Read image manifest only once per sitemap request");
check(byPath.get("/products/power-bank").images.includes("https://shanzesz.com/optimized/power-bank.webp"), "Map legacy cover to optimized production URL");
check(byPath.get("/products/power-bank").images.includes("https://shanzesz.com/detail.jpg"), "Include product detail gallery");
check(byPath.get("/products/power-bank").images.filter((image) => image.endsWith("/power-bank.webp")).length === 1, "Deduplicate mapped relative and localhost image aliases");
check(byPath.get("/products/large-gallery").images.length === 1000, "Limit large detail gallery to 1,000 images");
for (const item of result) {
  check((item.images || []).length <= 1000, `Image limit on ${new URL(item.url).pathname}`);
  check(new Set(item.images || []).size === (item.images || []).length, `Deduplicated images on ${new URL(item.url).pathname}`);
}
check(!allImages.some((image) => /private|hidden|draft|noindex|duplicate|phantom|unsafe|film|download|localhost/.test(image)), "Do not leak private, hidden, draft, noindex, duplicate or invalid media");
check(!["/products/draft", "/products/noindex", "/products/duplicate", "/blog/draft-post", "/blog/noindex-post", "/contact", "/factory"].some((path) => byPath.has(path)), "Keep noindex, draft and noncanonical pages out of sitemap");
check(byPath.has("/blog/guide") && !byPath.has("/news/guide"), "Keep blog canonical route despite legacy news canonical");
check(byPath.get("/blog").images.includes("https://shanzesz.com/guide.jpg"), "Include published blog cover on listing");
check(byPath.get("/news/announcement").images.includes("https://images.example.com/article.jpg"), "Keep safe external image URL without fetching it");
for (const filename of ["section", "item", "category", "equipment", "workshop", "translated-item"]) check(byPath.get("/").images.includes(`https://shanzesz.com/${filename}.jpg`), `Include visible home ${filename} image`);
check(byPath.get("/quality").images.includes("https://shanzesz.com/certificate.jpg"), "Include visible certification image");
check(queryChecks.find((query) => query.model === "product").where.status === "PUBLISHED" && queryChecks.find((query) => query.model === "product").where.noIndex === false, "Database product query excludes drafts and noindex before collecting images");
check(queryChecks.find((query) => query.model === "news").where.status === "PUBLISHED" && queryChecks.find((query) => query.model === "news").where.noIndex === false, "Database article query excludes drafts and noindex before collecting images");
console.log(`Image sitemap checks passed: ${assertions} assertions, ${result.length} public routes; no real database or network access.`);
