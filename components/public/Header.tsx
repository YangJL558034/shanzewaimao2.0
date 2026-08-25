import { db } from "@/lib/db";
import { HeaderClient } from "@/components/public/HeaderClient";
import { getLocale, translateEntity } from "@/lib/i18n";

export async function Header() {
  const [items, locales, locale, settings] = await Promise.all([
    db.navigationItem
      .findMany({
        where: { location: "HEADER", isVisible: true },
        orderBy: { sortOrder: "asc" },
      })
      .catch(() => []),
    db.locale
      .findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } })
      .catch(() => []),
    getLocale(),
    db.setting.findMany({ where: { isPublic: true } }).catch(() => []),
  ]);
  const settingMap = Object.fromEntries(
    settings.map((setting) => [setting.key, setting.value]),
  );
  const localizedItems = await Promise.all(
    items.map((item) =>
      translateEntity("NavigationItem", item, ["label"], locale),
    ),
  );
  const fallback = [
    ["1", locale === "zh" ? "首页" : "Home", "/"],
    ["2", locale === "zh" ? "关于我们" : "About Us", "/about"],
    ["3", locale === "zh" ? "产品中心" : "Products", "/products"],
    ["4", locale === "zh" ? "工厂实力" : "Factory", "/factory"],
    ["5", locale === "zh" ? "品质保障" : "Quality", "/quality"],
    ["6", locale === "zh" ? "新闻资讯" : "News", "/news"],
    ["7", locale === "zh" ? "联系我们" : "Contact", "/contact"],
  ].map(([id, label, href]) => ({ id, label, href }));
  return (
    <HeaderClient
      items={localizedItems.length ? localizedItems : fallback}
      locales={locales.map((item) => ({ code: item.code, name: item.name }))}
      activeLocale={locale}
      brand={{
        name:
          locale === "zh"
            ? settingMap.site_name_zh || settingMap.site_name || "ENERCORE"
            : settingMap.site_name || "ENERCORE",
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
