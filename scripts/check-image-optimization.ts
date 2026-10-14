import assert from "node:assert/strict";
import sharp from "sharp";
import { optimizeImage } from "../lib/image-processing";
import { defaultImageAlt, englishImageSlug, imageVariantPath } from "../lib/image-seo";

async function main() {
  const photo = await sharp({ create: { width: 2400, height: 1200, channels: 4, background: { r: 5, g: 90, b: 200, alpha: 0.5 } } }).png().toBuffer();
  const options = { name: "IMG_0001.png", context: "magnetic-power-bank-10000", alt: "Magnetic power bank, front view" };
  const result = await optimizeImage(photo, options);
  assert.match(result.fileName, /^magnetic-power-bank-10000-[a-f0-9]{12}\.webp$/);
  assert.equal(result.mimeType, "image/webp");
  assert.deepEqual([result.width, result.height], [1920, 960]);
  assert.equal(result.alt, options.alt);
  assert.equal(result.title, options.alt);
  assert.equal((await sharp(result.buffer).metadata()).hasAlpha, true);
  assert.deepEqual(result.variants.map((item) => item.width), [320, 640, 960, 1440]);
  for (const variant of result.variants) {
    const info = await sharp(variant.buffer).metadata();
    assert.equal(info.format, "webp");
    assert.equal(info.width, variant.width);
    assert.equal(info.height, variant.width / 2);
    assert.equal(variant.fileName, imageVariantPath(result.fileName, variant.width));
  }
  assert.equal((await optimizeImage(photo, options)).fileName, result.fileName, "Identical uploads use a stable, collision-resistant filename.");
  const certificate = await optimizeImage(photo, { context: "ISO 9001 certificate", preserveDetail: true });
  assert.deepEqual([certificate.width, certificate.height], [2400, 1200], "Keep document detail, not merely a card-sized preview.");
  assert.ok(certificate.variants.some((item) => item.width === 1920));
  const small = await sharp({ create: { width: 160, height: 80, channels: 3, background: "white" } }).jpeg().toBuffer();
  const smallResult = await optimizeImage(small, { name: "小尺寸图片.jpg", context: "Shanze logo" });
  assert.deepEqual([smallResult.width, smallResult.height], [160, 80]);
  assert.equal(smallResult.variants.length, 0, "Do not enlarge small images.");
  const existingWebp = await sharp(photo).resize(640).webp({ quality: 25 }).toBuffer();
  const preservedWebp = await optimizeImage(existingWebp, { context: "certificate", preserveDetail: true });
  assert.deepEqual(preservedWebp.buffer, existingWebp, "Do not inflate an existing metadata-free WebP through re-encoding.");
  const portrait = await sharp({ create: { width: 80, height: 160, channels: 3, background: "white" } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const oriented = await optimizeImage(portrait);
  assert.deepEqual([oriented.width, oriented.height], [160, 80]);
  assert.equal((await sharp(oriented.buffer).metadata()).exif, undefined);
  const frames = Buffer.alloc(16 * 32 * 4, 255);
  frames.fill(0, 16 * 16 * 4);
  const animated = await sharp(frames, { raw: { width: 16, height: 32, channels: 4, pageHeight: 16 } }).gif({ delay: [100, 200], loop: 0 }).toBuffer();
  assert.equal((await sharp(animated, { animated: true }).metadata()).pages, 2);
  const animation = await optimizeImage(animated, { context: "charging indicator animation" });
  const animationInfo = await sharp(animation.buffer, { animated: true }).metadata();
  assert.equal(animationInfo.pages, 2, "Keep both animation frames.");
  assert.deepEqual(animationInfo.delay, [100, 200]);
  assert.equal(animation.height, 16);
  await assert.rejects(optimizeImage(Buffer.from("not an image")));
  assert.equal(englishImageSlug({ name: "磁吸充电宝正面.png" }), "magnetic-power-bank-front-view");
  assert.equal(englishImageSlug({ name: "IMG_1234.jpg", context: "Wireless Charger Manufacturer" }), "wireless-charger-manufacturer");
  assert.equal(defaultImageAlt({ name: "IMG_1234.jpg", context: "Wireless charging stand" }), "Wireless charging stand");
  console.log("PASS: WebP encoding, responsive dimensions, no crop/upscale, alpha, document detail, EXIF orientation/privacy, animated frames/delays, corrupt-file rejection, stable English filenames and descriptive ALT.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
