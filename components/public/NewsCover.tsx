import { Newspaper } from "lucide-react";
import { SeoImage } from "@/components/public/SeoImage";
import "./news-cover.css";

/** Legacy page reference images are website screenshots, not article artwork. */
export function newsCoverSource(value: string | null | undefined) {
  const source = value?.trim() || "";
  if (!source) return "";
  try {
    const url = new URL(source, "https://shanzesz.com");
    if (!["https:", "http:"].includes(url.protocol)) return "";
    if (/^\/references\/(?:home|about|products|factory|quality|news|contact|product-detail)\.png$/i.test(url.pathname)) return "";
    return source;
  } catch { return ""; }
}

export function NewsCover({ src, alt, priority = false, className = "" }: { src?: string | null; alt: string; priority?: boolean; className?: string }) {
  const source = newsCoverSource(src);
  return <figure className={`news-cover ${className}`.trim()}>
    {source ? <SeoImage src={source} alt={alt} width="1200" height="675" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" sizes={priority ? "(max-width: 700px) 100vw, 70vw" : "(max-width: 700px) 100vw, (max-width: 1000px) 50vw, 33vw"} /> : <div className="news-cover-placeholder" aria-hidden="true"><Newspaper size={44} strokeWidth={1.25} /></div>}
  </figure>;
}
