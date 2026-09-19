import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/utils";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/api/", "/unsubscribe"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: new URL(absoluteUrl("/")).origin,
  };
}
