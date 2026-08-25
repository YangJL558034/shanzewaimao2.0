import type { MetadataRoute } from "next";

import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, posts] = await Promise.all([
    db.product.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    db.news.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
  ]);
  const legalRoutes = new Set(["privacy-policy", "terms-of-use", "site-map"]);
  const pages = ["", "about", "products", "factory", "quality", "news", "contact", ...legalRoutes].map((slug) => ({
    url: absoluteUrl(`/${slug}`),
    lastModified: new Date(),
    changeFrequency: slug === "" ? "weekly" as const : "monthly" as const,
    priority: slug === "" ? 1 : legalRoutes.has(slug) ? 0.4 : 0.8,
  }));
  return [
    ...pages,
    ...products.map((product) => ({ url: absoluteUrl(`/products/${product.slug}`), lastModified: product.updatedAt, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...posts.map((post) => ({ url: absoluteUrl(`/news/${post.slug}`), lastModified: post.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
