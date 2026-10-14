import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/utils";
import { JsonLd } from "@/components/public/JsonLd";
import { resolveSeoImage } from "@/lib/image-seo-data";

export async function SiteSchema() {
  const settings = await db.setting.findMany({ where: { isPublic: true, key: { in: ["site_name", "company_name", "logo_url", "social_linkedin", "social_facebook", "social_youtube", "social_tiktok"] } } }).catch(() => []);
  const map = Object.fromEntries(settings.map((item) => [item.key, item.value]));
  const sameAs = ["social_linkedin", "social_facebook", "social_youtube", "social_tiktok"].map((key) => map[key]).filter((value) => { try { const url = new URL(value); return url.protocol === "https:" && url.pathname !== "/"; } catch { return false; } });
  const origin = absoluteUrl("/");
  const orgId = `${origin}#organization`;
  const logo = absoluteUrl(await resolveSeoImage(map.logo_url || "/shanze-brand-icon.png"));
  return <JsonLd data={{ "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", "@id": orgId, name: map.company_name || "Shanze New Energy Technology Co., Ltd.", alternateName: map.site_name || "Shanze", url: origin, logo, ...(sameAs.length ? { sameAs } : {}) },
    { "@type": "WebSite", "@id": `${origin}#website`, url: origin, name: map.site_name || "Shanze", publisher: { "@id": orgId }, inLanguage: ["en", "zh-CN"] },
  ] }} />;
}
