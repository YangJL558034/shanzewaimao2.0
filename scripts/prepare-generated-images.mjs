import { readFile, mkdir, access, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";

// Optimize standalone generated artwork without changing the existing site's image frames.
const manifest = JSON.parse(await readFile("scripts/generated-image-manifest.json", "utf8"));
const output = path.resolve("public/generated/site");
// Original generation inputs are optional local files, never workstation-specific paths.
const sourceDirectory = process.env.GENERATED_IMAGES_DIR;
await mkdir(output, { recursive: true });
for (const asset of [...manifest.news, ...(manifest.site || [])]) {
  if (!/^[a-z0-9-]+$/.test(asset.key)) throw new Error("Invalid asset key");
  const destination = path.join(output, `${asset.key}.webp`);
  try { await access(destination); continue; } catch { /* New generated asset. */ }
  const source = sourceDirectory ? path.resolve(sourceDirectory, path.basename(asset.source)) : path.resolve(asset.source);
  const info = await sharp(source).rotate().resize({ width: 1440, withoutEnlargement: true }).webp({ quality: 86 }).toFile(destination);
  console.log(`${asset.key}: ${info.width}×${info.height}, ${Math.round(info.size / 1024)} KB`);
}

if (process.argv.includes("--legacy-backgrounds")) {
  // Keep the existing source code and image URLs intact, replacing only the screenshot assets.
  const backgrounds = { home: "hero-home", about: "hero-about", products: "hero-products", factory: "hero-factory", quality: "hero-quality", news: "hero-news", contact: "global-business-contact", "product-detail": "portable-magnetic-power-bank" };
  const backup = path.resolve("outputs/site-image-backups/legacy-backgrounds");
  await mkdir(backup, { recursive: true });
  for (const [page, key] of Object.entries(backgrounds)) {
    const target = path.resolve("public/references", `${page}.png`);
    const previous = await readFile(target);
    const image = await sharp(path.join(output, `${key}.webp`)).png().toBuffer();
    if (previous.equals(image)) continue;
    const hash = createHash("sha256").update(previous).digest("hex").slice(0, 16);
    try { await writeFile(path.join(backup, `${page}-${hash}.png`), previous, { flag: "wx" }); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
    await writeFile(target, image);
    console.log(`Replaced image only: /references/${page}.png (original backed up)`);
  }
}

if (process.argv.includes("--sheet")) {
  // Inspection contact sheet only; this does not change any production artwork.
  const assets = [...manifest.news, ...(manifest.site || [])];
  const cells = [];
  for (const [index, asset] of assets.entries()) {
    const left = index % 5 * 320, top = Math.floor(index / 5) * 205;
    const preview = await sharp(path.join(output, `${asset.key}.webp`)).resize(320, 180, { fit: "contain", background: "#edf3fa" }).toBuffer();
    cells.push({ input: preview, left, top });
    const label = Buffer.from(`<svg width="320" height="25"><rect width="320" height="25" fill="white"/><text x="8" y="17" font-family="Arial" font-size="11" fill="#163758">${asset.key}</text></svg>`);
    cells.push({ input: label, left, top: top + 180 });
  }
  await mkdir("outputs", { recursive: true });
  await sharp({ create: { width: 1600, height: Math.ceil(assets.length / 5) * 205, channels: 3, background: "#edf3fa" } }).composite(cells).jpeg({ quality: 90 }).toFile("outputs/generated-site-review.jpg");
}
