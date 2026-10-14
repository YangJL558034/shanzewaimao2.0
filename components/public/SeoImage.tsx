"use client";

import type { CSSProperties, ImgHTMLAttributes } from "react";
import { IMAGE_VARIANT_WIDTHS, imageVariantPath } from "@/lib/image-seo";
import { useImageSeo } from "./ImageSeoProvider";

export type SeoImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string; fill?: boolean; priority?: boolean };

function localPath(source: string) {
  try {
    const url = new URL(source, "https://shanzesz.com");
    const host = url.hostname.toLowerCase();
    const siteHost = ["shanzesz.com", "www.shanzesz.com", "localhost", "0.0.0.0", "[::1]"].includes(host)
      || /^(?:127\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(host);
    return siteHost ? url.pathname : source;
  }
  catch { return source; }
}

function imageDescription(source: string) {
  if (/^(?:data:|blob:)/i.test(source)) return "Shanze image";
  let name = localPath(source).split("/").at(-1)?.replace(/\.[a-z0-9]+$/i, "") || "";
  try { name = decodeURIComponent(name); } catch { /* A malformed escape still has a safe text fallback. */ }
  name = name.replace(/[._-][a-f0-9]{12,}(?:[._-]\d+w)?$/i, "").replace(/[._-]\d+w$/i, "").replace(/[._-]+/g, " ").trim();
  if (!name || /^[a-f0-9\s]{20,}$/i.test(name)) return "Shanze image";
  return /^shanze\b/i.test(name) ? name : `Shanze ${name}`;
}

/** Plain responsive images work in standalone production without Next's runtime optimizer. */
export function SeoImage({ src, alt, title, fill, priority, width, height, loading, decoding, fetchPriority, srcSet, sizes, style, ...props }: SeoImageProps) {
  const images = useImageSeo();
  const source = src || "";
  const metadata = images[source] || images[localPath(source)];
  const resolvedSource = metadata?.src || source;
  const description = alt ?? metadata?.alt ?? metadata?.title ?? imageDescription(resolvedSource);
  const imageTitle = title ?? (alt !== undefined && alt !== "" ? alt : metadata?.title ?? (description || undefined));
  const masterWidth = metadata?.width || 0;
  const optimized = !!metadata && /^\/(?:uploads\/)?optimized\//.test(resolvedSource);
  const candidates = optimized && masterWidth > 0
    ? [...IMAGE_VARIANT_WIDTHS.filter((candidate) => candidate < masterWidth), masterWidth]
    : [];
  const responsiveSources = srcSet || (candidates.length ? candidates.map((candidate) => `${candidate === masterWidth ? resolvedSource : imageVariantPath(resolvedSource, candidate)} ${candidate}w`).join(", ") : undefined);
  const imageStyle: CSSProperties | undefined = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style }
    : style;
  const imageSizes = sizes || (responsiveSources ? props.className?.includes("brand-logo-image") ? "48px" : "100vw" : undefined);
  return <img {...props} src={resolvedSource || undefined} alt={description} title={imageTitle}
    width={width ?? metadata?.width} height={height ?? metadata?.height}
    srcSet={responsiveSources} sizes={imageSizes} loading={priority ? "eager" : loading || "lazy"}
    decoding={decoding || "async"} fetchPriority={priority ? "high" : fetchPriority || "auto"} style={imageStyle} />;
}
