import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export function formatDate(value: Date | string | null | undefined, locale = "en") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric", month: "short", day: "numeric",
  }).format(new Date(value));
}

export function absoluteUrl(path = "") {
  const productionOrigin = "https://shanzesz.com";
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  let base = productionOrigin;

  if (configured) {
    try {
      const candidate = new URL(configured);
      const localHost = /^(localhost$|127\.|0\.0\.0\.0$|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i.test(candidate.hostname) || /\.(localhost|local|internal)$/i.test(candidate.hostname) || !candidate.hostname.includes(".");
      // Canonicals, structured data and email links must never point at a development server.
      if (candidate.protocol === "https:" && !localHost) base = candidate.origin;
    } catch {
      base = productionOrigin;
    }
  }

  return new URL(path, `${base}/`).toString();
}

export function referenceImage(page: string) {
  const map: Record<string, string> = {
    home: "/references/home.png",
    about: "/references/about.png",
    products: "/references/products.png",
    factory: "/references/factory.png",
    quality: "/references/quality.png",
    news: "/references/news.png",
    contact: "/references/contact.png",
    "product-detail": "/references/product-detail.png",
  };
  return map[page] ?? map.home;
}
