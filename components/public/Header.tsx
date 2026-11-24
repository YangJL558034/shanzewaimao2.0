import { db } from "@/lib/db";
import { HeaderClient } from "@/components/public/HeaderClient";
import { getLocale, translateEntities, translateEntity } from "@/lib/i18n";
import { buildSettingsMap } from "@/lib/page-content";
import { productCategoryHref } from "@/lib/product-categories";

export async function Header() {
  const [items, locales, locale, settings, categories] = await Promise.all([
    db.navigationItem
      .findMany({
        where: { location: "HEADER", isVisible: true },
        orderBy: { sortOrder: "asc" },
        include: { children: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } } },
      })
      .catch(() => []),
    db.locale
      .findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } })
      .catch(() => []),
    getLocale(),
    db.setting.findMany({ where: { isPublic: true } }).catch(() => []),
    db.productCategory.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } }).catch(() => []),
  ]);
  const settingMap = buildSettingsMap(settings);
  const localizedCategories = await translateEntities("ProductCategory", categories, ["name"], locale);
  // The Products menu is generated from the catalogue so any category added in
  // 后台分类管理 shows up here without touching code. Catalogue links land on the
  // product grid, not on the hero, so a click always shows a visible result.
  const productMenuHref = (href: string) => (href.startsWith("/products") ? `${href}#featured-products` : href);
  const productMenu = [
    { id: "product-menu-all", label: locale === "zh" ? "全部产品" : "All Products", href: "/products#featured-products" },
    ...localizedCategories.map((category) => ({
      id: `product-menu-${category.id}`,
      label: String(category.name),
      href: productMenuHref(productCategoryHref(category.slug)),
    })),
  ];
  const localizedItems = await Promise.all(
    items
      .filter((item) => !item.parentId)
      .map(async (item) => {
        const parent = await translateEntity("NavigationItem", item, ["label"], locale);
        const children = await Promise.all(
          (item.children ?? []).map(async (child) => {
            const localized = await translateEntity("NavigationItem", child, ["label"], locale);
            return { id: localized.id, label: String(localized.label), href: localized.href };
          }),
        );
        return {
          id: parent.id,
          label: String(parent.label),
          href: parent.href,
          children: parent.href === "/products" ? [...children, ...productMenu] : children,
        };
      }),
  );
  const fallback = [
    ["1", locale === "zh" ? "首页" : "Home", "/"],
    ["2", locale === "zh" ? "关于我们" : "About Us", "/about"],
    ["3", locale === "zh" ? "产品中心" : "Products", "/products"],
    ["4", locale === "zh" ? "工厂实力" : "Factory", "/factory"],
    ["5", locale === "zh" ? "品质保障" : "Quality", "/quality"],
    ["6", locale === "zh" ? "新闻资讯" : "News", "/news"],
    ["7", locale === "zh" ? "联系我们" : "Contact", "/contact"],
  ].map(([id, label, href]) => ({ id, label, href, children: [] as { id: string; label: string; href: string }[] }));
  return (
    <HeaderClient
      items={(() => {
        const navigation = localizedItems.length ? localizedItems : fallback;
        return navigation.some((item) => item.href === "/blog") ? navigation : [...navigation.slice(0, -1), { id: "seo-industry-blog", label: locale === "zh" ? "行业博客" : "Blog", href: "/blog", children: [] }, ...navigation.slice(-1)];
      })()}
      locales={locales.map((item) => ({ code: item.code, name: item.name }))}
      activeLocale={locale}
      brand={{
        name:
          locale === "zh"
            ? settingMap.site_name_zh || settingMap.site_name || "山泽新能源科技"
            : settingMap.site_name || "Shanze New Energy Technology",
        tagline:
          locale === "zh"
            ? settingMap.site_tagline_zh || settingMap.site_tagline || ""
            : settingMap.site_tagline || "POWERING YOUR LIFE",
        logoUrl: settingMap.logo_url || "",
      }}
      quoteLabel={locale === "zh" ? settingMap.quote_label_zh || settingMap.quote_label || "获取报价" : settingMap.quote_label || "Get a Quote"}
      quoteHref={settingMap.quote_href || "/contact#quote"}
    />
  );
}
