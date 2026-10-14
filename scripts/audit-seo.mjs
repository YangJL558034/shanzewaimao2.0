import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import env from "@next/env";

env.loadEnvConfig(process.cwd());
const db = new PrismaClient();
const base = process.env.SEO_TEST_URL || "http://localhost:3000";
const label = process.argv[2] === "before" ? "before" : "after";
const clean = (value = "") => value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1] || "";

try {
  const [products, posts] = await Promise.all([
    db.product.findMany({ where: { status: "PUBLISHED" }, select: { slug: true } }),
    db.news.findMany({ where: { status: "PUBLISHED" }, include: { category: true } }),
  ]);
  const blogCategories = new Set(["industry-insights", "industry-guides", "oem-guides", "buying-guides"]);
  const routes = ["/", "/about", "/products", "/factory", "/quality", "/contact", "/news", "/blog", "/privacy-policy", "/terms-of-use", "/site-map",
    ...["power-bank-manufacturer", "magnetic-power-bank-manufacturer", "semi-solid-state-power-bank", "power-bank-oem-odm", "wireless-charger-manufacturer", "custom-power-bank", "power-bank-factory-china", "magnetic-power-bank-oem", "custom-power-bank-supplier"].map((slug) => `/${slug}`),
    ...products.map((product) => `/products/${product.slug}`),
    ...posts.map((post) => `/${blogCategories.has(post.category.slug) && label !== "before" ? "blog" : "news"}/${post.slug}`),
  ];
  const pages = [];
  // Small batches avoid competing with the development compiler.
  for (let offset = 0; offset < routes.length; offset += 3) {
    pages.push(...await Promise.all(routes.slice(offset, offset + 3).map(async (route) => {
      const response = await fetch(`${base}${route}`, { headers: { "user-agent": "Googlebot" }, redirect: "manual" });
      const html = await response.text();
      const tags = [...html.matchAll(/<(?:meta|link|img)\b[^>]*>/gi)].map((match) => match[0]);
      const description = tags.find((tag) => attr(tag, "name") === "description");
      const canonical = tags.find((tag) => attr(tag, "rel") === "canonical");
      const robots = tags.find((tag) => attr(tag, "name") === "robots");
      const images = tags.filter((tag) => /^<img/i.test(tag));
      const schemas = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => { try { return JSON.parse(match[1]); } catch { return { invalid: true }; } });
      const types = schemas.flatMap((data) => data["@graph"] || [data]).map((data) => data["@type"] || "INVALID");
      return { route, status: response.status, title: clean(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]), description: attr(description || "", "content"), canonical: attr(canonical || "", "href"), robots: attr(robots || "", "content"), h1: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => clean(match[1])), h2Count: [...html.matchAll(/<h2\b/gi)].length, images: images.length, missingAlt: images.filter((tag) => !/\balt=["']/i.test(tag)).length, schemaTypes: types, invalidSchema: schemas.some((data) => data.invalid) };
    })));
  }
  const duplicates = (key) => {
    const values = new Map();
    for (const page of pages.filter((page) => page.status === 200)) {
      const value = page[key];
      if (value) values.set(value, [...(values.get(value) || []), page.route]);
    }
    return [...values.entries()].filter(([, routes]) => routes.length > 1).map(([value, routes]) => ({ value, routes }));
  };
  const sitemap = await fetch(`${base}/sitemap.xml`).then((response) => response.text());
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const issues = pages.flatMap((page) => [
    ...(page.status !== 200 ? [`${page.route}: HTTP ${page.status}`] : []),
    ...(page.status === 200 && page.h1.length !== 1 ? [`${page.route}: ${page.h1.length} H1 elements`] : []),
    ...(page.status === 200 && (!page.title || !page.description || !page.canonical) ? [`${page.route}: missing title, description or canonical`] : []),
    ...(page.canonical && new URL(page.canonical).origin !== "https://shanzesz.com" ? [`${page.route}: non-production canonical`] : []),
    ...(page.missingAlt ? [`${page.route}: ${page.missingAlt} missing image ALT attributes`] : []),
    ...(page.invalidSchema ? [`${page.route}: invalid JSON-LD`] : []),
  ]);
  const result = { generatedAt: new Date().toISOString(), origin: "https://shanzesz.com", pages, duplicates: { titles: duplicates("title"), descriptions: duplicates("description") }, sitemapUrls, issues };
  await mkdir("outputs", { recursive: true });
  await writeFile(`outputs/seo-audit-${label}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ result: issues.length || result.duplicates.titles.length || result.duplicates.descriptions.length ? "ISSUES" : "PASS", pages: pages.length, sitemapUrls: sitemapUrls.length, issues, duplicateTitles: result.duplicates.titles, duplicateDescriptions: result.duplicates.descriptions, report: `outputs/seo-audit-${label}.json` }, null, 2));
  if (label === "after" && (issues.length || result.duplicates.titles.length || result.duplicates.descriptions.length)) process.exitCode = 1;
} finally {
  await db.$disconnect();
}
