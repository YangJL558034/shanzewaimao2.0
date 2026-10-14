import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

export const ga4IdPattern = /^G-[A-Z0-9]{4,20}$/;
export const googleTokenPattern = /^[a-zA-Z0-9_-]{10,200}$/;

export const getSeoIntegrationConfig = cache(async () => {
  const settings = await db.setting.findMany({ where: { key: { in: ["google_analytics_id", "google_site_verification"] } } }).catch(() => []);
  const map = Object.fromEntries(settings.map((item) => [item.key, item.value]));
  const ga4Id = (Object.hasOwn(map, "google_analytics_id") ? map.google_analytics_id : process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || "").trim();
  const searchConsoleToken = (Object.hasOwn(map, "google_site_verification") ? map.google_site_verification : process.env.GOOGLE_SITE_VERIFICATION || "").trim();
  return { ga4Id: ga4IdPattern.test(ga4Id) ? ga4Id : "", searchConsoleToken: googleTokenPattern.test(searchConsoleToken) ? searchConsoleToken : "" };
});

export async function saveSeoIntegrationConfig(data: { ga4Id: string; searchConsoleToken: string }) {
  await db.$transaction([
    db.setting.upsert({ where: { key: "google_analytics_id" }, create: { key: "google_analytics_id", value: data.ga4Id, group: "seo", type: "text", isPublic: true }, update: { value: data.ga4Id, isPublic: true } }),
    db.setting.upsert({ where: { key: "google_site_verification" }, create: { key: "google_site_verification", value: data.searchConsoleToken, group: "seo", type: "text", isPublic: true }, update: { value: data.searchConsoleToken, isPublic: true } }),
  ]);
}
