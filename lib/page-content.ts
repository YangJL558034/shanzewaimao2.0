import { db } from "@/lib/db";
import { translateEntities } from "@/lib/i18n";

export type PageContentItem = {
  title?: string;
  text?: string;
  value?: string;
  image?: string;
  label?: string;
  href?: string;
};

export function parsePageItems(value: unknown, fallback: PageContentItem[] = []): PageContentItem[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed)
      ? parsed.map((item) => ({
          title: String(item?.title || ""), text: String(item?.text || ""), value: String(item?.value || ""),
          image: String(item?.image || ""), label: String(item?.label || ""), href: String(item?.href || ""),
        }))
      : fallback;
  } catch {
    return fallback;
  }
}

export async function getPageSectionMap(page: string, locale: string) {
  const rows = await db.pageSection.findMany({ where: { page, isVisible: true }, orderBy: { sortOrder: "asc" } });
  const localized = await translateEntities("PageSection", rows, ["title", "subtitle", "content", "buttonLabel", "items"], locale);
  const sourceById = new Map(rows.map((row) => [row.id, row]));
  return Object.fromEntries(localized.map((row) => {
    const source = sourceById.get(row.id);
    return [row.key, {
      ...row,
      sourceTitle: source?.title || row.title,
      sourceSubtitle: source?.subtitle || row.subtitle,
      parsedItems: parsePageItems(row.items),
    }];
  }));
}
