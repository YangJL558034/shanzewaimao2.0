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
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return new URL(path, base).toString();
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
