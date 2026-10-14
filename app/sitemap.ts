import type { MetadataRoute } from "next";

import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/utils";
import { safeCanonicalUrl } from "@/lib/seo";
import { seoLandings, seoLandingContent, type SeoLandingSlug } from "@/lib/seo-landings";
import { isBlogCategorySlug } from "@/lib/blog";
import { getImageSeoMap } from "@/lib/image-seo-data";
import { parsePageItems } from "@/lib/page-content";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Read the manifest once: route handlers do not necessarily share a React cache dispatcher.
  const [products, posts, seoRecords, banners, sections, categories, equipment, workshops, certificates, privateMedia, imageMap] = await Promise.all([
    db.product.findMany({ where: { status: "PUBLISHED", noIndex: false }, orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }], select: { slug: true, name: true, updatedAt: true, coverImage: true, hoverImage: true, canonical: true, images: { select: { url: true }, orderBy: { sortOrder: "asc" } }, category: { select: { isVisible: true } } } }),
    db.news.findMany({ where: { status: "PUBLISHED", noIndex: false }, select: { slug: true, updatedAt: true, coverImage: true, canonical: true, category: { select: { slug: true } } } }),
    db.seoMeta.findMany({ select: { route: true, noIndex: true, canonical: true } }),
    db.banner.findMany({ where: { status: "PUBLISHED" }, select: { page: true, image: true } }),
    db.pageSection.findMany({ where: { isVisible: true }, select: { id: true, page: true, key: true, image: true, items: true } }),
    db.productCategory.findMany({ where: { isVisible: true }, select: { image: true } }),
    db.factoryEquipment.findMany({ where: { isVisible: true }, select: { image: true } }),
    db.workshop.findMany({ where: { isVisible: true }, select: { image: true } }),
    db.certificate.findMany({ where: { isVisible: true }, select: { image: true } }),
    db.media.findMany({ where: { isPrivate: true }, select: { path: true } }),
    getImageSeoMap(),
  ]);
  const legalRoutes = new Set(["privacy-policy", "terms-of-use", "site-map"]);
  const landingRoutes = Object.keys(seoLandings);
  const routeSeo = new Map(seoRecords.map((item) => [item.route, item]));
  const pageSlugs = ["", "about", "products", "factory", "quality", "news", "blog", "contact", ...landingRoutes, ...legalRoutes];
  const publicPaths = new Set(pageSlugs.map((slug) => `/${slug}`));
  const pageImages = new Map<string, Set<string>>();
  const publicOrigin = new URL(absoluteUrl("/"));
  const ownHosts = new Set([publicOrigin.hostname, "shanzesz.com", "www.shanzesz.com", "localhost", "127.0.0.1", "127.0.0.2", "192.168.0.208"]);
  const normalizedPath = (value: string) => {
    try { return decodeURIComponent(new URL(value, publicOrigin).pathname); } catch { return value; }
  };
  const privatePaths = new Set(privateMedia.map((item) => normalizedPath(item.path)));
  const blockedPath = (path: string) => privatePaths.has(normalizedPath(path)) || /^\/(?:api|admin|storage|private)(?:\/|$)/i.test(normalizedPath(path));
  const imageUrl = (source?: string | null) => {
    const src = source?.trim();
    if (!src || /[\u0000-\u001f\\]/.test(src) || src.startsWith("//")) return null;
    try {
      const original = new URL(src, publicOrigin);
      if (!["http:", "https:"].includes(original.protocol) || original.username || original.password) return null;
      const local = ownHosts.has(original.hostname);
      if (local && blockedPath(original.pathname)) return null;
      const mapped = local ? imageMap[original.pathname]?.src : undefined;
      const result = new URL(mapped || (local ? original.pathname + original.search : original.toString()), publicOrigin);
      if (!/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(result.pathname) || (local && blockedPath(result.pathname))) return null;
      result.hash = "";
      return result.toString();
    } catch { return null; }
  };
  const addImages = (path: string, sources: Array<string | null | undefined>) => {
    const images = pageImages.get(path) || new Set<string>();
    for (const source of sources) {
      const image = imageUrl(source);
      if (image && images.size < 1000) images.add(image);
    }
    pageImages.set(path, images);
  };
  const imageProperties = (path: string) => {
    const images = [...(pageImages.get(path) || [])];
    return images.length ? { images } : {};
  };
  const pagePath = (page: string) => page === "home" ? "/" : `/${page}`;
  const hasSection = (page: string, key: string) => sections.some((section) => section.page === page && section.key === key);
  for (const banner of banners) {
    const path = pagePath(banner.page);
    if (publicPaths.has(path)) addImages(path, [banner.image]);
  }
  for (const page of ["home", "about", "products", "factory", "quality", "news", "contact"]) {
    if (!banners.some((banner) => banner.page === page)) addImages(pagePath(page), [`/references/${page}.png`]);
  }
  for (const section of sections) {
    const path = pagePath(section.page);
    if (publicPaths.has(path)) addImages(path, [section.image, ...parsePageItems(section.items).map((item) => item.image)]);
  }
  // A translated item can contain a different public image; never read private CMS translations.
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const itemTranslations = await db.translation.findMany({ where: { entityType: "PageSection", entityId: { in: sections.map((section) => section.id) }, field: "items", locale: { isActive: true } }, select: { entityId: true, value: true } });
  for (const item of itemTranslations) {
    const section = sectionById.get(item.entityId);
    if (section && publicPaths.has(pagePath(section.page))) addImages(pagePath(section.page), parsePageItems(item.value).map((entry) => entry.image));
  }
  if (hasSection("home", "products")) addImages("/", categories.map((item) => item.image));
  addImages("/products", categories.map((item) => item.image));
  for (const page of ["home", "factory"]) {
    if (hasSection(page, "equipment")) addImages(pagePath(page), equipment.map((item) => item.image));
    if (hasSection(page, "workshop")) addImages(pagePath(page), workshops.map((item) => item.image));
  }
  if (hasSection("quality", "workshop")) addImages("/quality", workshops.map((item) => item.image));
  if (hasSection("quality", "certifications")) addImages("/quality", certificates.map((item) => item.image));
  const indexableProducts = products.filter((product) => safeCanonicalUrl(`/products/${product.slug}`, product.canonical) === absoluteUrl(`/products/${product.slug}`));
  for (const product of indexableProducts) {
    addImages(`/products/${product.slug}`, [product.coverImage, product.hoverImage, ...product.images.map((image) => image.url)]);
    addImages("/products", [product.coverImage, product.hoverImage]);
  }
  for (const slug of landingRoutes as SeoLandingSlug[]) {
    const matchesTopic = (product: typeof products[number]) => {
      if (!product.category.isVisible) return false;
      const name = `${product.name} ${product.slug}`.toLowerCase();
      const bank = /power\s*bank|powerbank|充电宝|移动电源/.test(name);
      if (slug === "wireless-charger-manufacturer") return /wireless|无线|充电支架|充电板/.test(name) && !bank;
      if (slug.startsWith("magnetic-power-bank")) return /magnetic|磁吸/.test(name) && bank;
      return seoLandingContent[slug].en.productTerms.some((term) => name.includes(term));
    };
    addImages(`/${slug}`, indexableProducts.filter(matchesTopic).slice(0, 6).map((product) => product.coverImage));
  }
  const indexablePosts = posts.filter((post) => isBlogCategorySlug(post.category.slug) || safeCanonicalUrl(`/news/${post.slug}`, post.canonical) === absoluteUrl(`/news/${post.slug}`));
  for (const post of indexablePosts) {
    const base = isBlogCategorySlug(post.category.slug) ? "/blog" : "/news";
    addImages(`${base}/${post.slug}`, [post.coverImage]);
    addImages(base, [post.coverImage]);
  }
  const pages = pageSlugs.filter((slug) => {
    const path = `/${slug}`;
    const seo = routeSeo.get(path);
    return !seo?.noIndex && safeCanonicalUrl(path, seo?.canonical) === absoluteUrl(path);
  }).map((slug) => ({
    url: absoluteUrl(`/${slug}`),
    changeFrequency: slug === "" ? "weekly" as const : "monthly" as const,
    priority: slug === "" ? 1 : legalRoutes.has(slug) ? 0.4 : landingRoutes.includes(slug) ? 0.85 : 0.8,
    ...imageProperties(`/${slug}`),
  }));
  return [
    ...pages,
    ...indexableProducts.map((product) => ({ url: absoluteUrl(`/products/${product.slug}`), lastModified: product.updatedAt, changeFrequency: "monthly" as const, priority: 0.7, ...imageProperties(`/products/${product.slug}`) })),
    ...indexablePosts.map((post) => ({ url: absoluteUrl(`/${isBlogCategorySlug(post.category.slug) ? "blog" : "news"}/${post.slug}`), lastModified: post.updatedAt, changeFrequency: "monthly" as const, priority: 0.6, ...imageProperties(`/${isBlogCategorySlug(post.category.slug) ? "blog" : "news"}/${post.slug}`) })),
  ];
}
