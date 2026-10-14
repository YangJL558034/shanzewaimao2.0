import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import { starterBlogArticles, starterBlogCategories } from "../lib/blog-articles";
import { seoLandings } from "../lib/seo-landings";
import { seoPageDefaults } from "../lib/seo-defaults";

loadEnvConfig(process.cwd());
const db = new PrismaClient();
const genericSeedDescription = "Shanze provides power bank and wireless charger OEM/ODM manufacturing support for global B2B customers.";
async function main() {
  const before = await db.seoMeta.findMany();
  await mkdir("outputs", { recursive: true });
  await writeFile(`outputs/seo-metadata-backup-${Date.now()}.json`, JSON.stringify(before, null, 2));
  let updatedMeta = 0;
  let createdArticles = 0;
  const zhLocale = await db.locale.findUnique({ where: { code: "zh" } });
  for (const [route, defaults] of Object.entries(seoPageDefaults)) {
    const existing = before.find((item) => item.route === route);
    if (!existing) {
      await db.seoMeta.create({ data: { route, ...defaults, canonical: `https://shanzesz.com${route}` } }); updatedMeta++;
    } else if (existing.description === genericSeedDescription) {
      // Upgrade only the known duplicated bootstrap metadata, preserving custom copy/noindex/OG.
      await db.seoMeta.update({ where: { id: existing.id }, data: { ...defaults, canonical: `https://shanzesz.com${route}` } }); updatedMeta++;
    }
  }
  for (const [slug, page] of Object.entries(seoLandings)) {
    const route = `/${slug}`;
    await db.seoMeta.upsert({ where: { route }, create: { route, title: page.title, description: page.description, canonical: `https://shanzesz.com${route}` }, update: {} });
  }
  // Old demo news reused the same excerpt; create a distinct summary without fabricating news facts.
  const placeholderExcerpt = "Discover the people, engineering and systems behind Shanze's latest manufacturing and product development milestone.";
  const placeholders = await db.news.findMany({ where: { excerpt: placeholderExcerpt, metaDescription: null }, include: { category: true } });
  for (const post of placeholders) {
    const description = `${post.title}. Read this ${post.category.name.toLowerCase()} update and contact Shanze for product information.`.slice(0, 160);
    await db.news.update({ where: { id: post.id }, data: { metaDescription: description } });
  }
  for (const category of starterBlogCategories) {
    const row = await db.newsCategory.upsert({ where: { slug: category.slug }, create: { slug: category.slug, name: category.name, sortOrder: category.sortOrder }, update: {} });
    if (zhLocale) await db.translation.upsert({ where: { localeId_entityType_entityId_field: { localeId: zhLocale.id, entityType: "NewsCategory", entityId: row.id, field: "name" } }, create: { localeId: zhLocale.id, entityType: "NewsCategory", entityId: row.id, field: "name", value: category.zhName }, update: {} });
  }
  for (const article of starterBlogArticles) {
    if (await db.news.findUnique({ where: { slug: article.slug }, select: { id: true } })) continue;
    const category = await db.newsCategory.findUniqueOrThrow({ where: { slug: article.categorySlug } });
    await db.$transaction(async (tx) => {
      const post = await tx.news.create({ data: { categoryId: category.id, slug: article.slug, title: article.title, excerpt: article.excerpt, content: article.content, seoTitle: article.seoTitle, metaDescription: article.metaDescription, author: article.author, canonical: `https://shanzesz.com/blog/${article.slug}`, status: "PUBLISHED", publishedAt: new Date() } });
      if (zhLocale) for (const [field, value] of Object.entries(article.zh)) await tx.translation.create({ data: { localeId: zhLocale.id, entityType: "News", entityId: post.id, field, value } });
    });
    // Publishing editorial starters does not authorize sending newsletter campaigns.
    createdArticles++;
  }
  console.log(JSON.stringify({ updatedMeta, createdArticles, blogCategories: starterBlogCategories.length, preservedExistingArticles: true, newsletterSent: false }));
}
main().finally(() => db.$disconnect());
