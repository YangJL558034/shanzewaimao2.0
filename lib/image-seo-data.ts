import "server-only";
import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { isOptimizedImagePath, type ImageSeoMap } from "@/lib/image-seo";

export const getImageSeoMap = cache(async (): Promise<ImageSeoMap> => {
  let manifest: ImageSeoMap = {};
  try {
    const parsed = JSON.parse(await readFile(path.join(process.cwd(), "public/optimized/image-seo-manifest.json"), "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      const item = value as ImageSeoMap[string];
      if (item && isOptimizedImagePath(item.src) && item.width > 0 && item.height > 0) manifest[key] = item;
    }
  } catch { /* The first upload works before a legacy migration has run. */ }
  const media = await db.media.findMany({ where: { isPrivate: false, mimeType: "image/webp", OR: [{ path: { startsWith: "/uploads/optimized/" } }, { path: { startsWith: "/optimized/" } }] }, select: { path: true, width: true, height: true, alt: true, name: true } });
  for (const item of media) {
    if (item.width && item.height && isOptimizedImagePath(item.path)) manifest[item.path] = { src: item.path, width: item.width, height: item.height, alt: item.alt || item.name, title: item.alt || item.name };
  }
  // Keep legacy source aliases in sync with later edits in the Media manager.
  for (const [key, item] of Object.entries(manifest)) {
    if (manifest[item.src] && key !== item.src) manifest[key] = manifest[item.src];
  }
  return manifest;
});

/** Resolve only our own aliases. External images are never fetched server-side. */
export async function resolveSeoImage(src: string): Promise<string> {
  const images = await getImageSeoMap();
  let key = src;
  try {
    const url = new URL(src);
    if (!["shanzesz.com", "www.shanzesz.com", "localhost", "127.0.0.1", "127.0.0.2", "192.168.0.208"].includes(url.hostname)) return src;
    key = url.pathname;
  } catch { key = src.split(/[?#]/)[0]; }
  return images[key]?.src || src;
}

/** Existing display rules can identify a source after its SEO filename changes. */
export async function getOriginalImageSourceLookup() {
  const images = await getImageSeoMap();
  const originals = new Map<string, string>();
  for (const [source, item] of Object.entries(images)) {
    if (!isOptimizedImagePath(source) && !originals.has(item.src)) originals.set(item.src, source);
  }
  return (src: string) => {
    let key = src.split(/[?#]/)[0];
    if (/^https?:\/\//i.test(src)) {
      try {
        const url = new URL(src);
        if (!["shanzesz.com", "www.shanzesz.com", "localhost", "127.0.0.1", "127.0.0.2", "192.168.0.208"].includes(url.hostname)) return src;
        key = url.pathname;
      } catch { return src; }
    }
    return originals.get(key) || key;
  };
}
