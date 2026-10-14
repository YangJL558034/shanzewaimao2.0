import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { addLabImages, allSiteImageKeys, bannerImageKeys, categoryImageKeys, equipmentImageKeys, newsImageKeys, productImageKeys, replaceableSiteImage, sectionImageKeys, siteImage, workshopImageKeys } from "../lib/site-images";

loadEnvConfig(process.cwd());
const db = new PrismaClient();
const apply = process.argv.includes("--apply");
type Model = "news" | "product" | "productCategory" | "factoryEquipment" | "workshop" | "banner" | "pageSection";
type Change = { model: Model; id: string; updatedAt: Date; label: string; data: Record<string, string>; before: object };
const changes: Change[] = [];
const missing = new Set<string>();
const available = new Map<string, { path: string; size: number }>();

async function main() {
  const generatedRoot = path.resolve("public/generated/site");
  for (const key of allSiteImageKeys) {
    try {
      const filename = path.resolve(generatedRoot, `${key}.webp`);
      const resolved = await realpath(filename);
      if (path.dirname(resolved).toLowerCase() !== generatedRoot.toLowerCase()) throw new Error("Asset outside generated directory.");
      const info = await stat(resolved);
      const header = await readFile(resolved);
      if (!info.isFile() || header.subarray(0, 4).toString() !== "RIFF" || header.subarray(8, 12).toString() !== "WEBP") throw new Error("Invalid WebP asset.");
      available.set(key, { path: siteImage(key), size: info.size });
    } catch { missing.add(key); }
  }
  function rows<T extends { id: string; updatedAt: Date }>(model: Model, entries: T[], field: string, lookup: (row: T) => string | undefined) {
    for (const row of entries) {
      const key = lookup(row);
      const value = (row as unknown as Record<string, unknown>)[field];
      // Replace the known irregular collage in hero/overview slots, retaining the source brochure asset.
      const overview = row as unknown as { page?: string; key?: string };
      const collageSlot = model === "banner" || (model === "pageSection" && ((overview.page === "home" && overview.key === "about") || (overview.page === "factory" && overview.key === "overview")));
      let replaceCollage = false;
      if (collageSlot && typeof value === "string") {
        try { replaceCollage = new URL(value, "https://shanzesz.com").pathname === "/company-profile/manufacturing-collage.jpg"; } catch { /* Preserve malformed custom values for manual review. */ }
      }
      if (!key || !available.has(key) || (!replaceableSiteImage(value) && !replaceCollage)) continue;
      changes.push({ model, id: row.id, updatedAt: row.updatedAt, label: key, data: { [field]: siteImage(key) }, before: row });
    }
  }
  const [news, products, categories, equipment, workshops, banners, sections, labTranslations] = await Promise.all([
    db.news.findMany(), db.product.findMany(), db.productCategory.findMany(), db.factoryEquipment.findMany(), db.workshop.findMany(), db.banner.findMany(), db.pageSection.findMany(),
    db.translation.findMany({ where: { entityType: "PageSection", field: "items", locale: { code: "zh" } } }),
  ]);
  rows("news", news, "coverImage", (row) => newsImageKeys[row.slug]);
  rows("product", products, "coverImage", (row) => productImageKeys[row.slug]);
  rows("productCategory", categories, "image", (row) => categoryImageKeys[row.slug]);
  rows("factoryEquipment", equipment, "image", (row) => equipmentImageKeys[row.name]);
  rows("workshop", workshops, "image", (row) => workshopImageKeys[row.name]);
  rows("banner", banners, "image", (row) => bannerImageKeys[row.page]);
  rows("pageSection", sections, "image", (row) => sectionImageKeys[`${row.page}:${row.key}`]);
  const lab = sections.find((row) => row.page === "quality" && row.key === "lab");
  const present = new Set(available.keys());
  if (lab) {
    const items = addLabImages(lab.items, present);
    if (items !== lab.items) {
      const existing = changes.find((row) => row.model === "pageSection" && row.id === lab.id);
      if (existing) existing.data.items = items;
      else changes.push({ model: "pageSection", id: lab.id, updatedAt: lab.updatedAt, label: "quality:lab items", data: { items }, before: lab });
    }
  }
  const translations = labTranslations.filter((row) => row.entityId === lab?.id).map((row) => ({ before: row, value: addLabImages(row.value, present) })).filter((row) => row.before.value !== row.value);
  console.log(JSON.stringify({ mode: apply ? "apply" : "preview", readyAssets: available.size, missingAssets: [...missing], changes: changes.map(({ model, id, data }) => ({ model, id, data })), chineseLabItems: translations.length, preservedCustomImages: true }, null, 2));
  if (!apply) return;
  const directory = path.resolve("outputs/site-image-backups");
  await mkdir(directory, { recursive: true });
  const existingMedia = await db.media.findMany({ where: { path: { in: [...available.values()].map((asset) => asset.path) } } });
  await writeFile(path.join(directory, `before-import-${Date.now()}-${randomUUID()}.json`), JSON.stringify({ changes, translations, existingMedia }, null, 2), { flag: "wx" });
  const conflicts: string[] = [];
  let updated = 0;
  let registered = 0;
  await db.$transaction(async (tx) => {
    for (const change of changes) {
      const updater = tx[change.model] as unknown as { updateMany(args: { where: { id: string; updatedAt: Date }; data: Record<string, string> }): Promise<{ count: number }> };
      const result = await updater.updateMany({ where: { id: change.id, updatedAt: change.updatedAt }, data: change.data });
      if (result.count) updated++; else conflicts.push(`${change.model}:${change.id}`);
    }
    for (const translation of translations) {
      // Translation has no updatedAt column; compare the complete old value instead.
      const result = await tx.translation.updateMany({ where: { id: translation.before.id, value: translation.before.value }, data: { value: translation.value } });
      if (result.count) updated++; else conflicts.push(`translation:${translation.before.id}`);
    }
    for (const [key, asset] of available) {
      if (await tx.media.findFirst({ where: { path: asset.path } })) continue;
      const topic = key.replaceAll("-", " ");
      await tx.media.create({ data: { name: `AI-generated concept — ${topic}`, fileName: `${key}.webp`, path: asset.path, mimeType: "image/webp", size: asset.size, alt: `AI-generated concept illustration: ${topic}`, folder: "ai-generated-site", isPrivate: false } });
      registered++;
    }
  }, { timeout: 30000 });
  console.log(JSON.stringify({ updated, registeredMedia: registered, concurrentEditsPreserved: conflicts, skippedMissingAssets: [...missing] }));
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => db.$disconnect());
