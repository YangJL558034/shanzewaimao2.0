/**
 * Product categories that have their own landing page instead of the
 * `/products?category=…` filter view. Everything else in the catalogue is
 * driven by the ProductCategory table and needs no entry here.
 *
 * The live site already had a "portable power station" category before the BR
 * series was added, so both slugs point at the same landing page. Merging the
 * two categories in 后台分类管理 keeps working without touching this file.
 */
export const productCategoryLandingRoutes: Record<string, string> = {
  "portable-power": "/portable-power",
  "portable-power-station": "/portable-power",
};

/** Where a category points on the front end: its landing page, or the catalogue filter. */
export function productCategoryHref(slug: string) {
  return productCategoryLandingRoutes[slug] || `/products?category=${encodeURIComponent(slug)}`;
}

/** The landing route for a category, when one exists. */
export function productCategoryLanding(slug: string) {
  return productCategoryLandingRoutes[slug] || "";
}
