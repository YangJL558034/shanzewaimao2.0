import { db } from "@/lib/db";

export type MediaUsage = {
  count: number;
  references: string[];
  status: "使用中" | "空闲";
};

/**
 * Finds every CMS record that points at a media path.  Keeping this computed
 * instead of storing a flag on Media means the status is always accurate after
 * an editor changes a product, banner or page section.
 */
export async function getMediaUsageMap(paths: string[]) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const result = new Map<string, string[]>(uniquePaths.map((path) => [path, []]));
  if (!uniquePaths.length) return result;

  const add = (path: unknown, label: string) => {
    if (typeof path !== "string" || !path || !result.has(path)) return;
    const list = result.get(path)!;
    if (!list.includes(label)) list.push(label);
  };

  const [products, categories, downloads, news, equipment, workshops, certificates, banners, sections, sectionItemTranslations, seo, settings] = await Promise.all([
    db.product.findMany({ select: { name: true, coverImage: true, hoverImage: true, images: { select: { url: true } } } }),
    db.productCategory.findMany({ select: { name: true, image: true, icon: true } }),
    db.productDownload.findMany({ select: { title: true, fileUrl: true, product: { select: { name: true } } } }),
    db.news.findMany({ select: { title: true, coverImage: true } }),
    db.factoryEquipment.findMany({ select: { name: true, image: true } }),
    db.workshop.findMany({ select: { name: true, image: true } }),
    db.certificate.findMany({ select: { name: true, image: true, fileUrl: true } }),
    db.banner.findMany({ select: { title: true, image: true } }),
    db.pageSection.findMany({ select: { page: true, title: true, image: true, items: true } }),
    db.translation.findMany({
      where: { entityType: "PageSection", field: "items" },
      select: { entityId: true, value: true, locale: { select: { name: true } } },
    }),
    db.seoMeta.findMany({ select: { route: true, ogImage: true } }),
    db.setting.findMany({ select: { key: true, value: true } }),
  ]);

  for (const row of products) {
    add(row.coverImage, `产品正面主图：${row.name}`);
    add(row.hoverImage, `产品反面图：${row.name}`);
    for (const image of row.images) add(image.url, `产品轮播：${row.name}`);
  }
  for (const row of categories) {
    add(row.image, `产品分类：${row.name}`);
    add(row.icon, `分类图标：${row.name}`);
  }
  for (const row of downloads) add(row.fileUrl, `产品资料：${row.product.name} / ${row.title}`);
  for (const row of news) add(row.coverImage, `新闻封面：${row.title}`);
  for (const row of equipment) add(row.image, `工厂设备：${row.name}`);
  for (const row of workshops) add(row.image, `车间环境：${row.name}`);
  for (const row of certificates) {
    add(row.image, `证书图片：${row.name}`);
    add(row.fileUrl, `证书文件：${row.name}`);
  }
  for (const row of banners) add(row.image, `Banner：${row.title}`);
  for (const row of sections) {
    add(row.image, `页面内容：${row.page} / ${row.title}`);
    for (const item of parseContentItems(row.items)) add(item.image, `页面列表图片：${row.page} / ${row.title}`);
  }
  for (const row of sectionItemTranslations) {
    for (const item of parseContentItems(row.value)) add(item.image, `页面翻译图片：${row.locale.name} / ${row.entityId}`);
  }
  for (const row of seo) add(row.ogImage, `SEO OG 图片：${row.route}`);
  for (const row of settingRows(settings)) add(row.value, `站点设置：${row.key}`);

  return result;
}

function parseContentItems(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [] as Array<{ image?: unknown }>;
    return parsed.filter((item): item is { image?: unknown } => Boolean(item) && typeof item === "object");
  } catch {
    return [] as Array<{ image?: unknown }>;
  }
}

function settingRows(rows: Array<{ key: string; value: string }>) {
  return rows.filter((row) => row.value.startsWith("/uploads/") || row.value.startsWith("http://") || row.value.startsWith("https://"));
}

export function usageFromMap(map: Map<string, string[]>, path: string): MediaUsage {
  const references = map.get(path) || [];
  return { count: references.length, references, status: references.length ? "使用中" : "空闲" };
}
