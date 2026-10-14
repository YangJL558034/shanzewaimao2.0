import "server-only";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/utils";
import { resolveSeoImage } from "@/lib/image-seo-data";

/** Only accept a canonical on the configured public origin, without tracking parameters. */
export function safeCanonicalUrl(path: string, candidate?: string | null) {
  const origin = new URL(absoluteUrl("/"));
  const fallback = new URL(path, origin);
  if (fallback.origin !== origin.origin || fallback.username || fallback.password) return origin.toString();
  fallback.search = "";
  fallback.hash = "";
  if (!candidate?.trim()) return fallback.toString();
  try {
    const configured = new URL(candidate, absoluteUrl("/"));
    if (configured.origin !== fallback.origin || configured.username || configured.password) return fallback.toString();
    configured.search = "";
    configured.hash = "";
    return configured.toString();
  } catch { return fallback.toString(); }
}

export async function getSeoMetadata(route: string, fallback: { title: string; description: string }): Promise<Metadata> {
  const seo = await db.seoMeta.findUnique({ where: { route } }).catch(() => null);
  const title = seo?.title || fallback.title;
  const description = seo?.description || fallback.description;
  const canonical = safeCanonicalUrl(route, seo?.canonical);
  const ogTitle = seo?.ogTitle || title;
  const ogDescription = seo?.ogDescription || description;
  const socialImage = absoluteUrl(await resolveSeoImage(seo?.ogImage || "/generated/site/hero-home.webp"));
  return {
    title: { absolute: title }, description, keywords: seo?.keywords || undefined,
    alternates: { canonical }, robots: { index: !seo?.noIndex, follow: true },
    openGraph: { type: "website", siteName: "Shanze", title: ogTitle, description: ogDescription, url: canonical, images: [{ url: socialImage, alt: title }] },
    twitter: { card: "summary_large_image", title: ogTitle, description: ogDescription, images: [socialImage] },
  };
}
