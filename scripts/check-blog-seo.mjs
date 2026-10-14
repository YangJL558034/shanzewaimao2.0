import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

// Read-only integration check. Start the site first: npm run dev or npm start.
const base = new URL(process.env.SEO_CHECK_BASE_URL || "http://localhost:3000");
const publicOrigin = process.env.NEXT_PUBLIC_SITE_URL && !/localhost|127\.0\.0\.1/.test(process.env.NEXT_PUBLIC_SITE_URL)
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
  : "https://shanzesz.com";
const blogCategories = ["industry-insights", "industry-guides", "oem-guides", "buying-guides"];
const db = new PrismaClient();
const headers = { "User-Agent": "Googlebot" };
async function request(path, redirect = "follow") {
  return fetch(new URL(path, base), { headers, redirect, signal: AbortSignal.timeout(30000) });
}
function metadata(html, name) {
  return [...html.matchAll(/<meta\b[^>]*>/g)].map((match) => match[0]).find((tag) => new RegExp(`\\bname="${name}"`).test(tag))?.match(/\bcontent="([^"]*)"/)?.[1] || "";
}
function canonical(html) {
  return [...html.matchAll(/<link\b[^>]*>/g)].map((match) => match[0]).find((tag) => /\brel="canonical"/.test(tag))?.match(/\bhref="([^"]*)"/)?.[1] || "";
}
const checks = [];
try {
  const posts = await db.news.findMany({ where: { category: { slug: { in: blogCategories } } }, include: { category: true } });
  const published = posts.filter((post) => post.status === "PUBLISHED");
  assert.ok(published.length, "At least one blog guide must be published for this check.");
  const titles = new Set();
  const descriptions = new Set();
  const internalLinks = new Set(["/blog", "/products", "/contact#quote"]);
  const sitemapResponse = await request("/sitemap.xml");
  assert.equal(sitemapResponse.status, 200);
  const sitemap = await sitemapResponse.text();

  for (const post of published) {
    const route = `/blog/${post.slug}`;
    const response = await request(route);
    assert.equal(response.status, 200, route);
    const html = await response.text();
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${route}: one H1`);
    assert.equal(canonical(html), `${publicOrigin}${route}`, `${route}: production canonical`);
    const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
    const description = metadata(html, "description");
    assert.ok(title && !titles.has(title), `${route}: unique title`);
    assert.ok(description && !descriptions.has(description), `${route}: unique description`);
    titles.add(title); descriptions.add(description);
    assert.ok(html.includes('"@type":"BlogPosting"'), `${route}: BlogPosting`);
    assert.ok(html.includes('"@type":"BreadcrumbList"'), `${route}: BreadcrumbList`);
    if (post.noIndex) assert.ok(metadata(html, "robots").includes("noindex"), `${route}: respect noIndex`);
    assert.equal(sitemap.includes(`${publicOrigin}${route}</loc>`), !post.noIndex, `${route}: sitemap visibility`);
    assert.ok(!sitemap.includes(`${publicOrigin}/news/${post.slug}</loc>`), `${route}: no legacy sitemap duplicate`);
    const legacy = await request(`/news/${post.slug}`, "manual");
    assert.equal(legacy.status, 308, `${route}: permanent legacy redirect`);
    assert.equal(new URL(legacy.headers.get("location"), base).pathname, route, `${route}: correct redirect target`);
    for (const match of post.content.matchAll(/\[[^\]]+\]\((\/[^\s)]+)\)/g)) internalLinks.add(match[1]);
    checks.push(`PASS ${route}: metadata, H1, schema, sitemap and legacy redirect`);
  }

  for (const path of internalLinks) {
    const response = await request(path);
    assert.equal(response.status, 200, `Internal link ${path}`);
    await response.body?.cancel();
  }
  checks.push(`PASS ${internalLinks.size} distinct blog body/resource links return 200`);

  const newsResponse = await request("/news");
  assert.equal(newsResponse.status, 200);
  const newsListing = await newsResponse.text();
  for (const post of published) assert.ok(!newsListing.includes(`href="/news/${post.slug}"`), `${post.slug}: excluded from company news listing`);
  const categoryRedirect = await request("/news?category=oem-guides", "manual");
  assert.equal(categoryRedirect.status, 308, "Legacy blog category listing redirect");
  const categoryTarget = new URL(categoryRedirect.headers.get("location"), base);
  assert.equal(categoryTarget.pathname, "/blog");
  assert.equal(categoryTarget.searchParams.get("category"), "oem-guides");
  checks.push("PASS company news listing excludes blog posts; legacy blog category redirects permanently");

  for (const path of ["/blog?category=buying-guides", "/blog?q=OEM", "/blog?q=OEM&q=charger"]) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.equal(canonical(html), `${publicOrigin}/blog`, `${path}: canonical`);
    assert.ok(metadata(html, "robots").includes("noindex"), `${path}: noindex`);
  }
  checks.push("PASS category/search/duplicate-query filters: noindex and /blog canonical");

  for (const path of ["/blog/not-a-published-guide", "/blog?category=not-a-blog-category", "/blog?page=10000"]) {
    const response = await request(path);
    assert.equal(response.status, 404, path);
    await response.body?.cancel();
  }
  const companyPost = await db.news.findFirst({ where: { status: "PUBLISHED", category: { slug: { notIn: blogCategories } } } });
  if (companyPost) {
    const response = await request(`/blog/${companyPost.slug}`);
    assert.equal(response.status, 404, "Non-blog company article must not have a duplicate blog URL");
    await response.body?.cancel();
  }
  const draftPosts = posts.filter((post) => post.status !== "PUBLISHED");
  for (const post of draftPosts) {
    const response = await request(`/blog/${post.slug}`);
    assert.equal(response.status, 404, `Draft ${post.slug} must not be public`);
    await response.body?.cancel();
  }
  checks.push(`PASS unknown/category/pagination/non-blog URL visibility; ${draftPosts.length ? `${draftPosts.length} existing drafts hidden` : "no existing draft rows to request (no data mutation)"}`);
  console.log(checks.join("\n"));
} finally {
  await db.$disconnect();
}
