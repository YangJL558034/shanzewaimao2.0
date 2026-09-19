import type { MetadataRoute } from "next";

import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, posts] = await Promise.all([
    db.product.findMany({ where: { status: "PUBLISHED", noIndex: false }, select: { slug: true, updatedAt: true, coverImage: true } }),
    db.news.findMany({ where: { status: "PUBLISHED", noIndex: false }, select: { slug: true, updatedAt: true, coverImage: true } }),
  ]);
  const legalRoutes = new Set(["privacy-policy", "terms-of-use", "site-map"]);
  const landingRoutes = ["power-bank-manufacturer","magnetic-power-bank-manufacturer","semi-solid-state-power-bank","power-bank-oem-odm","wireless-charger-manufacturer","custom-power-bank","power-bank-factory-china"];
  const pages = ["", "about", "products", "factory", "quality", "news", "contact", ...landingRoutes, ...legalRoutes].map((slug) => ({
    url: absoluteUrl(`/${slug}`),
    changeFrequency: slug === "" ? "weekly" as const : "monthly" as const,
    priority: slug === "" ? 1 : legalRoutes.has(slug) ? 0.4 : landingRoutes.includes(slug) ? 0.85 : 0.8,
    ...(slug === "" ? { images: [absoluteUrl("/references/home.png")] } : {}),
  }));
  return [
    ...pages,
    ...products.map((product) => ({ url: absoluteUrl(`/products/${product.slug}`), lastModified: product.updatedAt, changeFrequency: "monthly" as const, priority: 0.7, ...(product.coverImage ? { images: [absoluteUrl(product.coverImage)] } : {}) })),
    ...posts.map((post) => ({ url: absoluteUrl(`/news/${post.slug}`), lastModified: post.updatedAt, changeFrequency: "monthly" as const, priority: 0.6, ...(post.coverImage ? { images: [absoluteUrl(post.coverImage)] } : {}) })),
  ];
}
