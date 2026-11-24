import { existsSync } from "node:fs";
import path from "node:path";

/**
 * A product gets a 3D viewer when a file named after its SKU exists at
 * `public/3d/<sku>.html`. The SKU is lower-cased and stripped of anything that
 * is not a letter, digit or dash, so `SZ68DBGB26` maps to `/3d/sz68dbgb26.html`.
 *
 * The viewer reads `?lang=zh|en` (falling back to the site's `locale` cookie),
 * so the link carries the page language and the 3D UI always matches.
 *
 * To add a model: drop the offline viewer HTML into public/3d/ with that name.
 * Nothing else needs changing — the product card and detail page pick it up.
 */
export function product3dPath(sku?: string | null, locale?: string | null) {
  const key = (sku || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!key) return "";
  const relative = `/3d/${key}.html`;
  try {
    if (!existsSync(path.join(process.cwd(), "public", relative))) return "";
  } catch {
    return "";
  }
  const lang = locale === "zh" ? "zh" : "en";
  return `${relative}?lang=${lang}`;
}

/** Attach the viewer path to a list of products, leaving other fields untouched. */
export function withProduct3d<T extends { sku?: string | null }>(products: T[], locale?: string | null) {
  return products.map((product) => ({ ...product, href: product3dPath(product.sku, locale) }));
}
