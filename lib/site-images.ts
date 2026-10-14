export const siteImage = (key: string | undefined) => key ? `/generated/site/${key}.webp` : "";

export const newsImageKeys: Record<string, string> = {
  "next-gen-magsafe-power-bank": "magnetic-power-bank-series",
  "factory-expansion-intelligent-line": "intelligent-production-line",
  "qi2-certified-wireless-charger": "wireless-charger-collection",
  "global-sources-showcase": "charging-trade-show",
  "community-tree-planting": "community-tree-planting",
  "gan-technology-fast-charging": "compact-gan-charging",
  "new-10000mah-magnetic-power-bank": "portable-magnetic-power-bank",
  "six-layer-quality-control": "charging-quality-inspection",
  "future-wireless-charging": "future-wireless-charging",
  "how-to-choose-power-bank-manufacturer": "charging-quality-inspection",
  "magnetic-power-bank-oem-project-checklist": "magnetic-power-bank-series",
  "wireless-charger-manufacturer-sourcing-guide": "wireless-charger-collection",
  "custom-power-bank-supplier-rfq-checklist": "premium-charging-gift-set",
};

export const productImageKeys: Record<string, string> = {
  "magnetic-power-bank-10000": "portable-magnetic-power-bank", "magnetic-power-bank-5000": "slim-magnetic-power-bank",
  "3-in-1-wireless-charger": "three-in-one-charging-stand", "magnetic-wireless-pad": "magnetic-charging-pad",
  "pd-20w-power-bank": "high-capacity-power-bank", "38w-usb-c-car-charger": "usb-c-car-charger",
  "gan-65w-wall-charger": "gan-wall-charger", "usb-c-cable-100w": "braided-usb-c-cable",
  "travel-charging-kit": "travel-charging-kit", "premium-gift-set": "premium-charging-gift-set",
};
export const categoryImageKeys: Record<string, string> = {
  "magnetic-power-banks": "portable-magnetic-power-bank", "wireless-chargers": "three-in-one-charging-stand",
  "charging-accessories": "gan-wall-charger", "gift-box-sets": "premium-charging-gift-set", "custom-oem-odm": "magnetic-power-bank-series",
};
export const equipmentImageKeys: Record<string, string> = {
  "SMT Production Line": "smt-production-equipment", "Wave Soldering Machine": "wave-soldering-equipment",
  "Assembly Line": "intelligent-production-line", "Injection Molding": "injection-molding-equipment",
  "Testing Cabinets": "aging-test-cabinets", "Packaging Line": "automated-packaging-line",
};
export const workshopImageKeys: Record<string, string> = {
  "Production Line": "intelligent-production-line", "Workers in Uniform": "workshop-team",
  "Inspection Area": "charging-quality-inspection", "Packaging Area": "automated-packaging-line",
  "Warehouse": "organized-warehouse", "Logistics & Loading": "logistics-loading",
};
export const bannerImageKeys: Record<string, string> = {
  home: "hero-home", about: "hero-about", factory: "hero-factory", products: "hero-products",
  quality: "hero-quality", news: "hero-news", contact: "global-business-contact",
};
export const sectionImageKeys: Record<string, string> = {
  "home:about": "intelligent-production-line", "home:equipment": "smt-production-equipment", "home:workshop": "workshop-team",
  "factory:overview": "intelligent-production-line", "factory:equipment": "smt-production-equipment", "factory:workshop": "workshop-team",
  "quality:lab": "temperature-test-chamber", "quality:workshop": "workshop-team",
  "products:customization": "magnetic-power-bank-series", "products:catalog": "magnetic-power-bank-series",
};
export const labImageKeys = ["temperature-test-chamber", "thermal-cycling-test", "drop-test-equipment", "salt-spray-test", "aging-test-cabinets", "electrical-performance-test"] as const;

export function replaceableSiteImage(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return true;
  try {
    return /^\/references\/(?:home|about|products|factory|quality|news|contact|product-detail)\.(?:png|jpe?g|webp)$/i.test(new URL(value, "https://shanzesz.com").pathname);
  } catch { return false; }
}

export function addLabImages(value: string, available?: ReadonlySet<string>) {
  let items: unknown;
  try { items = JSON.parse(value); } catch { return value; }
  if (!Array.isArray(items)) return value;
  let changed = false;
  const matchers = [/high.*low.*temperature|高低温/i, /temperature.*cycl|温度循环/i, /drop.*test|跌落/i, /salt.*spray|盐雾/i, /aging.*test|老化/i, /electrical.*performance|电性能/i];
  const next = items.map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const entry = item as Record<string, unknown>;
    const index = matchers.findIndex((matcher) => matcher.test(String(entry.title || "")));
    const key = labImageKeys[index];
    if (!key || !replaceableSiteImage(entry.image) || (available && !available.has(key))) return item;
    changed = true;
    return { ...entry, image: siteImage(key) };
  });
  return changed ? JSON.stringify(next) : value;
}

export const allSiteImageKeys = [...new Set([...Object.values(newsImageKeys), ...Object.values(productImageKeys), ...Object.values(categoryImageKeys), ...Object.values(equipmentImageKeys), ...Object.values(workshopImageKeys), ...Object.values(bannerImageKeys), ...Object.values(sectionImageKeys), ...labImageKeys])];
