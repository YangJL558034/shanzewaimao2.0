export const IMAGE_VARIANT_WIDTHS = [320, 640, 960, 1440, 1920] as const;
export type ImageSeoMetadata = { src: string; width: number; height: number; alt?: string; title?: string };
export type ImageSeoMap = Record<string, ImageSeoMetadata>;

export function imageVariantPath(src: string, width: number) {
  return src.replace(/\.webp$/i, `-${width}w.webp`);
}

export function isOptimizedImagePath(src: string) {
  return /^\/(?:uploads\/)?optimized\/[a-z0-9][a-z0-9-]*\.webp$/.test(src);
}

export function imageSeoText(value?: string | null, max = 200) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

// Context supplied by the CMS takes precedence over camera names and timestamps.
// Known manufacturing terms cover Chinese filenames without inventing image contents.
const translations: Array<[RegExp, string]> = [
  [/山泽新能源科技|山泽新能源|山泽/g, " shanze "], [/磁吸充电宝|磁吸移动电源/g, " magnetic power bank "],
  [/无线充电器|无线充电|无线充/g, " wireless charger "], [/充电宝|移动电源/g, " power bank "],
  [/充电器/g, " charger "], [/车载/g, " car "], [/氮化镓/g, " gan "], [/数据线/g, " usb cable "],
  [/质量管理体系/g, " quality management system "], [/环境管理体系/g, " environmental management system "],
  [/职业健康安全/g, " occupational health safety "], [/认证|证书/g, " certificate "], [/检测报告|报告/g, " test report "],
  [/生产线|生产/g, " production line "], [/工厂|厂区/g, " factory "], [/车间/g, " workshop "],
  [/设备/g, " equipment "], [/实验室/g, " laboratory "], [/质检|品质|质量/g, " quality control "],
  [/包装/g, " packaging "], [/仓库|仓储/g, " warehouse "], [/物流/g, " logistics "], [/研发/g, " research "],
  [/新闻/g, " news "], [/博客/g, " blog "], [/首页/g, " home "], [/关于我们|公司简介/g, " about shanze "],
  [/背景|横幅|轮播/g, " banner "], [/产品/g, " product "], [/正面/g, " front view "], [/反面|背面/g, " rear view "],
  [/细节/g, " detail "], [/图片|照片/g, " image "], [/全球客户/g, " global customers "], [/公司/g, " company "],
];

function englishWords(value: string) {
  let text = imageSeoText(value).replace(/\.(?:jpe?g|png|webp|avif|gif|tiff?)$/i, "");
  for (const [pattern, replacement] of translations) text = text.replace(pattern, replacement);
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function usefulName(value: string) {
  return /[a-z]{3}/i.test(value) && !/^(?:(?:img|dsc|image|photo|screenshot|wechat|wx|codex-clipboard|upload)[-_]?)?[\d-]+$/i.test(value)
    && !/^(?:codex-clipboard|screenshot|wechat|wx)[-_]/i.test(value);
}

export function englishImageSlug(options: { context?: string; name?: string; alt?: string; folder?: string }) {
  for (const value of [options.context, options.name, options.alt]) {
    const slug = englishWords(value || "");
    if (usefulName(slug)) return slug.slice(0, 90).replace(/-+$/g, "");
  }
  const folder = englishWords(options.folder || "website");
  return `shanze-${usefulName(folder) && !["general", "images", "uploads"].includes(folder) ? folder : "website"}-image`;
}

export function defaultImageAlt(options: { context?: string; name?: string; alt?: string; folder?: string }) {
  const supplied = imageSeoText(options.alt);
  if (supplied && !/\.(?:jpe?g|png|webp|avif|gif)$/i.test(supplied) && !/^(?:img|dsc|image|photo)[-_ ]?\d+$/i.test(supplied)) return supplied;
  const subject = imageSeoText(options.context || options.name).replace(/\.(?:jpe?g|png|webp|avif|gif)$/i, "");
  if (subject && !/^(?:img|dsc|image|photo)[-_ ]?\d+$/i.test(subject) && /[a-z\u3400-\u9fff]{2}/i.test(subject)) return subject.replace(/[_-]+/g, " ");
  return englishImageSlug(options).replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase());
}
