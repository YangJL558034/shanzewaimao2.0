import { createHash } from "node:crypto";
import sharp from "sharp";
import { defaultImageAlt, englishImageSlug, IMAGE_VARIANT_WIDTHS, imageVariantPath } from "./image-seo";

export type ImageOptimizationOptions = { name?: string; alt?: string; folder?: string; context?: string; preserveDetail?: boolean };
export type OptimizedImage = {
  fileName: string; buffer: Buffer; mimeType: "image/webp"; width: number; height: number; alt: string; title: string;
  variants: Array<{ fileName: string; buffer: Buffer; width: number; height: number }>;
};

const inputOptions = { limitInputPixels: 50_000_000, failOn: "error" as const, animated: true };

/** No crop, no enlargement, no EXIF/GPS retention. PDFs/SVG/documents never enter this pipeline. */
export async function optimizeImage(buffer: Buffer, options: ImageOptimizationOptions = {}): Promise<OptimizedImage> {
  const metadata = await sharp(buffer, inputOptions).metadata();
  if (!["jpeg", "png", "webp", "gif", "heif", "avif", "tiff"].includes(metadata.format || "") || !metadata.width || !metadata.height) {
    throw new Error("Unsupported or invalid raster image.");
  }
  if ((metadata.pages || 1) > 120) throw new Error("Animated images may contain at most 120 frames.");
  const detail = Boolean(options.preserveDetail || /certificate|report|document|certification|证书|认证|报告/i.test(`${options.folder || ""} ${options.context || ""} ${options.name || ""}`));
  const hash = createHash("sha256").update("shanze-webp-v3:" + (detail ? "detail" : "photo")).update(buffer).digest("hex").slice(0, 12);
  const fileName = `${englishImageSlug(options)}-${hash}.webp`;
  const pipeline = () => sharp(buffer, inputOptions).rotate();
  let master = pipeline();
  if (!detail) master = master.resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true });
  // Full-resolution, high-quality document previews; untouched originals stay
  // separately available. Lossless conversion of JPEG scans unnecessarily
  // magnifies their existing compression noise and can quadruple transfer size.
  const result = await master.webp({ quality: detail ? 92 : 84, alphaQuality: 100, effort: 4 }).toBuffer({ resolveWithObject: true });
  const width = result.info.width;
  const height = result.info.pageHeight || result.info.height;
  // Already optimized WebP can be smaller than a second encode (particularly
  // certificate previews). Reuse only when geometry is unchanged and there is
  // no private/orientation/colour metadata requiring removal or transformation.
  const reuseOriginal = metadata.format === "webp" && !metadata.exif && !metadata.xmp && !metadata.icc && !metadata.iptc
    && (!metadata.orientation || metadata.orientation === 1) && width === metadata.width
    && height === (metadata.pageHeight || metadata.height) && buffer.length < result.data.length;
  const variants: OptimizedImage["variants"] = [];
  for (const variantWidth of IMAGE_VARIANT_WIDTHS) {
    if (variantWidth >= width) continue;
    const variant = await pipeline().resize({ width: variantWidth, withoutEnlargement: true }).webp({ quality: detail ? 90 : 82, alphaQuality: 100, effort: 4 }).toBuffer({ resolveWithObject: true });
    variants.push({ fileName: imageVariantPath(fileName, variantWidth), buffer: variant.data, width: variant.info.width, height: variant.info.pageHeight || variant.info.height });
  }
  const alt = defaultImageAlt(options);
  return { fileName, buffer: reuseOriginal ? buffer : result.data, mimeType: "image/webp", width, height, alt, title: alt, variants };
}
