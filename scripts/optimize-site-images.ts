/** Existing-image SEO migration. Default: read-only preview. Writes require --apply.
 * Originals/downloads/private media are never deleted or overwritten.
 * Run with: npx tsx scripts/optimize-site-images.ts [--inventory | --apply]
 */
import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, realpath, stat, writeFile, unlink, rename } from "node:fs/promises";
import path from "node:path";
import { collectJsonImages, localImagePath, remapImage, remapImageJson, remapRichImages, type ImageSeoManifest, type OptimizedImageEntry } from "./image-seo-migration";

loadEnvConfig(process.cwd());
const db = new PrismaClient();
const apply = process.argv.includes("--apply");
const inventoryOnly = process.argv.includes("--inventory");
const workspace = process.cwd();
const publicRoot = path.resolve(workspace, "public");
const outputRoot = path.join(publicRoot, "optimized");
const manifestPath = path.join(outputRoot, "image-seo-manifest.json");
const backupRoot = path.resolve(workspace, "outputs/image-seo-backups");
const sourceStatePath = path.join(backupRoot, "image-seo-source-state.json");
const publicOrigin = (() => { try { return new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://shanzesz.com").origin; } catch { return "https://shanzesz.com"; } })();
const origins = new Set([publicOrigin, "https://shanzesz.com", "http://localhost:3000", "http://127.0.0.1:3000", "http://127.0.0.2:3000", "http://192.168.0.208:3000"]);
type Model = "product" | "productImage" | "productCategory" | "news" | "banner" | "page" | "pageSection" | "factoryEquipment" | "workshop" | "certificate" | "seoMeta" | "setting" | "translation" | "media";
type Snapshot = { id: string; updatedAt?: Date; [key: string]: unknown };
type Group = { model: Model; rows: Snapshot[]; images?: string[]; rich?: string[]; json?: string[]; schema?: string[] };
type Change = { model: Model; before: Snapshot; data: Record<string, unknown> };
type Asset = { oldPath: string; absolutePath: string; bytes: number };
type Prepared = { asset: Asset; entry: OptimizedImageEntry; fileName: string; buffer: Buffer; variants: Array<{ fileName: string; buffer: Buffer; width: number; height: number }> };
type SourceState = Record<string, { fingerprint: string; fileNames: string[]; options?: { name: string; alt?: string; folder: string; context?: string; preserveDetail?: boolean } }>;
const unresolved = new Set<string>();
const skipped: Array<{ path: string; reason: string }> = [];

function digest(value: Buffer | string) { return createHash("sha256").update(value).digest("hex"); }
function safeOutputName(value: string) {
  if (path.basename(value) !== value || !/^[a-z0-9][a-z0-9-]*\.webp$/.test(value)) throw new Error(`Unsafe optimized file name: ${value}`);
  return path.join(outputRoot, value);
}
function englishLabel(value: unknown, fallback: string) {
  const label = String(value || "").replace(/<[^>]*>/g, " ").trim();
  return /[a-z]{3}/i.test(label) && !/[\u3400-\u9fff]/u.test(label) ? label : fallback;
}
function labelFor(row: Snapshot, model: Model) {
  return englishLabel(row.name || row.title || row.slug || row.key || row.route, `Shanze ${model.replace(/([A-Z])/g, " $1").toLowerCase()} image`);
}
function consider(value: unknown, knownAssets: ReadonlySet<string>) {
  if (typeof value !== "string" || !value.trim()) return;
  const image = localImagePath(value, origins);
  if (!image) {
    if (/^(?:https?:)?\/\//i.test(value)) {
      try { const url = new URL(value, publicOrigin); unresolved.add(`${url.origin}${url.pathname}${url.search ? " [query omitted]" : ""}`); } catch { unresolved.add("Malformed external image reference"); }
    }
    return;
  }
  if (/\.(?:jpe?g|png|webp|avif|gif|tiff?|bmp)$/i.test(image) && !knownAssets.has(image) && !image.startsWith("/optimized/")) unresolved.add(value);
}

async function readManifest() {
  let raw = "";
  try { raw = await readFile(manifestPath, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const manifest: ImageSeoManifest = raw ? JSON.parse(raw) : {};
  for (const [key, entry] of Object.entries(manifest)) {
    if (!key.startsWith("/") || !entry || !/^\/optimized\/[a-z0-9][a-z0-9-]*\.webp$/.test(entry.src) || !Number.isFinite(entry.width) || !Number.isFinite(entry.height) || typeof entry.alt !== "string" || typeof entry.title !== "string") throw new Error("Existing image manifest contains invalid entries; review it manually.");
  }
  return { manifest, raw };
}

async function scan(privatePaths: ReadonlySet<string>) {
  const assets: Asset[] = [];
  async function add(absolutePath: string) {
    const relative = path.relative(publicRoot, absolutePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Image is outside public directory.");
    const oldPath = `/${relative.split(path.sep).join("/")}`;
    if (privatePaths.has(oldPath)) { skipped.push({ path: oldPath, reason: "private Media" }); return; }
    const resolved = await realpath(absolutePath);
    if (resolved.toLowerCase() !== absolutePath.toLowerCase()) { skipped.push({ path: oldPath, reason: "symbolic/reparse path" }); return; }
    const info = await stat(resolved);
    if (info.isFile()) assets.push({ oldPath, absolutePath: resolved, bytes: info.size });
  }
  function supported(filename: string) { return /\.(?:jpe?g|png|webp|avif|gif|tiff?|bmp)$/i.test(filename) && !/favicon|(?:^|[-_])icons?(?:[-_.]|$)/i.test(filename); }
  async function walk(directory: string) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, item.name);
      if (item.isSymbolicLink()) { skipped.push({ path: target, reason: "symlink" }); continue; }
      if (item.isDirectory()) {
        if (/^(?:sources?|originals?|documents?|private|optimized|icons?)$/i.test(item.name)) { skipped.push({ path: target, reason: "source/document/private/generated output folder" }); continue; }
        await walk(target);
      } else if (item.isFile() && supported(item.name)) await add(target);
    }
  }
  for (const folder of ["uploads", "generated", "company-profile", "references"]) {
    try { await walk(path.join(publicRoot, folder)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  for (const item of await readdir(publicRoot, { withFileTypes: true })) if (item.isFile() && supported(item.name)) await add(path.join(publicRoot, item.name));
  return assets.sort((a, b) => a.oldPath.localeCompare(b.oldPath));
}

async function loadGroups(): Promise<Group[]> {
  const [products, gallery, categories, news, banners, pages, sections, equipment, workshops, certificates, seo, settings, translations] = await Promise.all([
    db.product.findMany(), db.productImage.findMany({ include: { product: { select: { name: true } } } }), db.productCategory.findMany(), db.news.findMany(), db.banner.findMany(), db.page.findMany(), db.pageSection.findMany(), db.factoryEquipment.findMany(), db.workshop.findMany(), db.certificate.findMany(), db.seoMeta.findMany(),
    db.setting.findMany({ where: { isPublic: true, key: { in: ["logo_url", "site_logo", "logo", "footer_logo", "brand_logo", "og_image", "default_og_image", "site_og_image"] } } }),
    db.translation.findMany({ where: { entityType: { in: ["Product", "ProductCategory", "News", "Page", "PageSection", "FactoryEquipment", "Workshop", "Certificate", "Banner", "SeoMeta"] }, field: { in: ["image", "coverImage", "hoverImage", "ogImage", "content", "description", "items", "features", "applications", "faqs", "specifications", "schemaJson"] } } }),
  ]);
  return [
    { model: "product", rows: products, images: ["coverImage", "hoverImage", "ogImage"], rich: ["description"], json: ["specifications", "features", "applications", "faqs"] },
    { model: "productImage", rows: gallery.map((row) => ({ ...row, name: row.product.name })), images: ["url"] },
    { model: "productCategory", rows: categories, images: ["image"], rich: ["description"] },
    { model: "news", rows: news, images: ["coverImage", "ogImage"], rich: ["content"] },
    { model: "banner", rows: banners, images: ["image"] },
    { model: "page", rows: pages, rich: ["content"] },
    { model: "pageSection", rows: sections, images: ["image"], rich: ["content"], json: ["items"] },
    { model: "factoryEquipment", rows: equipment, images: ["image"], rich: ["description"] },
    { model: "workshop", rows: workshops, images: ["image"], rich: ["description"] },
    // fileUrl is deliberately not an image field: retain original certificate downloads.
    { model: "certificate", rows: certificates, images: ["image"] },
    { model: "seoMeta", rows: seo, images: ["ogImage"], schema: ["schemaJson"] },
    { model: "setting", rows: settings, images: ["value"] },
    { model: "translation", rows: translations },
  ];
}

function planChanges(groups: Group[], manifest: ImageSeoManifest): Change[] {
  const changes: Change[] = [];
  for (const group of groups) for (const row of group.rows) {
    const data: Record<string, unknown> = {};
    for (const field of group.images || []) {
      const next = remapImage(row[field], manifest, origins);
      if (next !== row[field]) data[field] = next;
    }
    for (const field of group.rich || []) if (typeof row[field] === "string") {
      const next = remapRichImages(row[field] as string, manifest, origins);
      if (next !== row[field]) data[field] = next;
    }
    for (const field of [...(group.json || []), ...(group.schema || [])]) if (typeof row[field] === "string") {
      const next = remapImageJson(row[field] as string, manifest, origins, group.schema?.includes(field) ? publicOrigin : undefined);
      if (next !== row[field]) data[field] = next;
    }
    if (group.model === "translation" && typeof row.value === "string") {
      const field = String(row.field);
      const next = ["image", "coverImage", "hoverImage", "ogImage"].includes(field) ? remapImage(row.value, manifest, origins)
        : ["content", "description"].includes(field) ? remapRichImages(row.value, manifest, origins)
        : remapImageJson(row.value, manifest, origins, field === "schemaJson" ? publicOrigin : undefined);
      if (next !== row.value) data.value = next;
    }
    if (group.model === "productImage" && !String(row.alt || "").trim() && data.url) {
      const key = localImagePath(row.url, origins);
      if (key && manifest[key]) data.alt = manifest[key].alt;
    }
    if (Object.keys(data).length) changes.push({ model: group.model, before: row, data });
  }
  return changes;
}

async function main() {
  const media = await db.media.findMany();
  const privatePaths = new Set(media.filter((row) => row.isPrivate).map((row) => localImagePath(row.path, origins)).filter((value): value is string => !!value));
  const assets = await scan(privatePaths);
  const knownAssets = new Set(assets.map((asset) => asset.oldPath));
  const groups = await loadGroups();
  const contexts = new Map<string, { name: string; alt?: string; preserveDetail?: boolean; explicitDetail?: boolean }>();
  const addContext = (value: unknown, name: string, alt?: string, preserveDetail?: boolean, explicitDetail = false) => {
    consider(value, knownAssets);
    const image = localImagePath(value, origins);
    if (!image) return;
    const old = contexts.get(image);
    contexts.set(image, { name: old?.name || name, alt: old?.alt || alt, preserveDetail: old?.preserveDetail || preserveDetail, explicitDetail: old?.explicitDetail || explicitDetail });
  };
  for (const group of groups) for (const row of group.rows) {
    for (const field of group.images || []) addContext(row[field], labelFor(row, group.model), typeof row.alt === "string" ? row.alt : undefined, group.model === "certificate", group.model === "certificate");
    for (const field of group.json || []) if (typeof row[field] === "string") for (const item of collectJsonImages(row[field] as string)) addContext(item.image, englishLabel(item.label, labelFor(row, group.model)), item.alt);
    for (const field of group.rich || []) if (typeof row[field] === "string") for (const match of (row[field] as string).matchAll(/<img\b[^>]*\ssrc\s*=\s*["']([^"']*)["']/gi)) addContext(match[1], labelFor(row, group.model));
    if (group.model === "translation" && row.field === "items" && typeof row.value === "string") for (const item of collectJsonImages(row.value)) addContext(item.image, englishLabel(item.label, "Shanze website section image"), item.alt);
  }
  for (const row of media) if (!row.isPrivate) addContext(row.path, englishLabel(row.name, "Shanze website image"), row.alt || undefined, /certificat|report|diagram|chart|logo/i.test(`${row.name} ${row.folder} ${row.fileName}`));
  const grouped = Object.groupBy(assets, (asset) => asset.oldPath.split("/")[1]);
  const inventory = { files: assets.length, originalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0), groups: Object.fromEntries(Object.entries(grouped).map(([key, rows]) => [key, { count: rows?.length || 0, paths: rows?.map((asset) => asset.oldPath) || [] }])), skipped, unhandledReferences: [...unresolved].sort() };
  if (inventoryOnly) { console.log(JSON.stringify({ mode: "inventory", ...inventory }, null, 2)); return; }

  const { manifest: previousManifest, raw: previousRaw } = await readManifest();
  // Business/Media paths point to optimized files after the first apply. Recover
  // their current labels/ALT for the original source without changing its identity.
  for (const [oldPath, entry] of Object.entries(previousManifest)) {
    if (!oldPath.startsWith("/optimized/") && !contexts.has(oldPath)) {
      const current = contexts.get(entry.src);
      if (current) contexts.set(oldPath, current);
    }
  }
  let previousSourceState: SourceState = {};
  try { previousSourceState = JSON.parse(await readFile(sourceStatePath, "utf8")); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const sourceState: SourceState = { ...previousSourceState };
  const processingPolicy = digest(Buffer.concat(await Promise.all([readFile(path.resolve("lib/image-processing.ts")), readFile(path.resolve("lib/image-seo.ts"))])));
  const manifest: ImageSeoManifest = { ...previousManifest };
  const prepared: Prepared[] = [];
  const reused: string[] = [];
  const { optimizeImage } = await import("../lib/image-processing");
  for (const asset of assets) {
    const context = contexts.get(asset.oldPath);
    const stem = path.basename(asset.absolutePath, path.extname(asset.absolutePath));
    const meaningfulStem = /[a-z]{3}/i.test(stem) && !/^\d{8,}/.test(stem);
    const name = meaningfulStem ? stem : context?.name || "Shanze website image";
    const buffer = await readFile(asset.absolutePath);
    const preserveDetail = context?.preserveDetail || /certificat|report|diagram|chart|logo|iso-\d|3c-mark|historical-market/i.test(stem);
    const prior = previousManifest[asset.oldPath];
    const priorState = previousSourceState[asset.oldPath];
    // A newly registered Media name is derived metadata, not a new source option.
    // Keep first-run processing identity so an unchanged apply -> preview is zero-op.
    const options = priorState?.options ? { ...priorState.options, ...(context?.alt && context.alt !== prior?.alt ? { alt: context.alt } : {}) }
      : { name, alt: context?.alt, folder: "optimized", context: context?.name, preserveDetail };
    // Derived optimized Media names must not escalate the detail policy on rerun.
    // A real new certificate reference or an original document filename may do so.
    if (context?.explicitDetail || /certificat|report|diagram|chart|logo|iso-\d|3c-mark|historical-market/i.test(stem)) options.preserveDetail = true;
    const fingerprint = digest(JSON.stringify({ sourceHash: digest(buffer), processingPolicy, ...options }));
    if (prior && priorState?.fingerprint === fingerprint && Array.isArray(priorState.fileNames)) {
      try {
        for (const filename of priorState.fileNames) if (!(await stat(safeOutputName(filename))).isFile()) throw new Error("Missing optimized output.");
        manifest[asset.oldPath] = prior; manifest[prior.src] = prior; reused.push(asset.oldPath); continue;
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    let optimized: Awaited<ReturnType<typeof optimizeImage>>;
    try { optimized = await optimizeImage(buffer, options); }
    catch (error) { skipped.push({ path: asset.oldPath, reason: error instanceof Error ? error.message.slice(0, 160) : "Unsupported image" }); continue; }
    const entry: OptimizedImageEntry = { src: `/optimized/${optimized.fileName}`, width: optimized.width, height: optimized.height, alt: optimized.alt, title: optimized.title };
    safeOutputName(optimized.fileName);
    sourceState[asset.oldPath] = { fingerprint, options, fileNames: [optimized.fileName, ...optimized.variants.map((variant) => variant.fileName)] };
    if (prior?.src === entry.src) {
      try {
        assertSame(await readFile(safeOutputName(optimized.fileName)), optimized.buffer, optimized.fileName);
        for (const variant of optimized.variants) assertSame(await readFile(safeOutputName(variant.fileName)), variant.buffer, variant.fileName);
        manifest[asset.oldPath] = { ...entry, alt: context?.alt || prior.alt || entry.alt, title: prior.title || entry.title };
        manifest[entry.src] = manifest[asset.oldPath]; reused.push(asset.oldPath); continue;
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    manifest[asset.oldPath] = entry; manifest[entry.src] = entry;
    if (prior?.src && prior.src !== entry.src) {
      for (const [key, oldEntry] of Object.entries(previousManifest)) if (key.startsWith("/optimized/") && oldEntry.src === prior.src) manifest[key] = entry;
    }
    prepared.push({ asset, entry, fileName: optimized.fileName, buffer: optimized.buffer, variants: optimized.variants });
  }
  const changes = planChanges(groups, manifest);
  const mediaChanges: Change[] = [];
  for (const row of media) if (!row.isPrivate) {
    const key = localImagePath(row.path, origins);
    const entry = key && manifest[key];
    if (!entry || row.path === entry.src) continue;
    const item = prepared.find((image) => image.entry.src === entry.src);
    const size = item?.buffer.length ?? (await stat(safeOutputName(path.basename(entry.src)))).size;
    const data = { path: entry.src, fileName: path.basename(entry.src), mimeType: "image/webp", width: entry.width, height: entry.height, size, ...(!row.alt?.trim() ? { alt: entry.alt } : {}) };
    mediaChanges.push({ model: "media", before: row, data });
  }
  const optimizedBytes = prepared.reduce((sum, image) => sum + image.buffer.length, 0);
  const detailMode = (image: Prepared) => Boolean(sourceState[image.asset.oldPath]?.options?.preserveDetail || /certificate|report|document|certification|证书|认证|报告/i.test(`${sourceState[image.asset.oldPath]?.options?.context || ""} ${sourceState[image.asset.oldPath]?.options?.name || ""}`));
  const compression = Object.fromEntries([true, false].map((detail) => {
    const rows = prepared.filter((image) => detailMode(image) === detail);
    return [detail ? "detail" : "photo", { count: rows.length, originalBytes: rows.reduce((sum, image) => sum + image.asset.bytes, 0), masterBytes: rows.reduce((sum, image) => sum + image.buffer.length, 0), largerMasters: rows.filter((image) => image.buffer.length > image.asset.bytes).map((image) => ({ path: image.asset.oldPath, originalBytes: image.asset.bytes, masterBytes: image.buffer.length })) }];
  }));
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...inventory, newlyPrepared: prepared.length, reused: reused.length, preparedOriginalBytes: prepared.reduce((sum, image) => sum + image.asset.bytes, 0), preparedMasterBytes: optimizedBytes, compression, responsiveVariants: prepared.reduce((sum, image) => sum + image.variants.length, 0), affectedRows: changes.length, mediaRows: mediaChanges.length, changes: changes.map((change) => ({ model: change.model, id: change.before.id, fields: Object.keys(change.data) })), images: prepared.map((image) => ({ from: image.asset.oldPath, ...image.entry, bytes: image.buffer.length })) }, null, 2));
  if (!apply) return;

  await mkdir(outputRoot, { recursive: true });
  const lockPath = path.join(outputRoot, ".image-seo-migration.lock");
  await writeFile(lockPath, randomUUID(), { flag: "wx" });
  try {
    const current = await readManifest();
    if (digest(current.raw) !== digest(previousRaw)) throw new Error("Manifest changed during preparation; rerun to preserve concurrent edits.");
    const newlyPrivate = await db.media.findMany({ where: { isPrivate: true }, select: { path: true } });
    const blocked = new Set(newlyPrivate.map((row) => localImagePath(row.path, origins)).filter((value): value is string => !!value));
    if (assets.some((image) => blocked.has(image.oldPath))) throw new Error("A media file became private during preparation; no files/database references were changed. Rerun.");
    await mkdir(backupRoot, { recursive: true });
    const backup = path.join(backupRoot, `before-image-seo-${Date.now()}-${randomUUID()}.json`);
    await writeFile(backup, JSON.stringify({ createdAt: new Date().toISOString(), previousManifest, previousSourceState, changes, mediaChanges, assets: prepared.map(({ asset, entry }) => ({ oldPath: asset.oldPath, ...entry })), originalsRetained: true }, null, 2), { flag: "wx" });
    for (const item of prepared) {
      await writeNewOrIdentical(safeOutputName(item.fileName), item.buffer);
      for (const variant of item.variants) await writeNewOrIdentical(safeOutputName(variant.fileName), variant.buffer);
    }
    const conflicts: string[] = [];
    let changed = 0; let registered = 0;
    await db.$transaction(async (tx) => {
      for (const change of [...changes, ...mediaChanges]) {
        const where: Record<string, unknown> = { id: change.before.id };
        if (change.before.updatedAt) where.updatedAt = change.before.updatedAt;
        else for (const field of Object.keys(change.data)) where[field] = change.before[field] ?? null;
        if (change.model === "media") where.isPrivate = false;
        const updater = tx[change.model] as unknown as { updateMany(input: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }> };
        const result = await updater.updateMany({ where, data: change.data });
        if (result.count) changed++; else conflicts.push(`${change.model}:${change.before.id}`);
      }
      for (const item of prepared) {
        if (await tx.media.findFirst({ where: { path: item.entry.src } })) continue;
        // If the old Media CAS lost a concurrent edit, preserve that row and retry
        // on the next run rather than inventing a second registration of the asset.
        if (media.some((row) => localImagePath(row.path, origins) === item.asset.oldPath)) continue;
        await tx.media.create({ data: { name: item.entry.title, fileName: item.fileName, path: item.entry.src, mimeType: "image/webp", size: item.buffer.length, width: item.entry.width, height: item.entry.height, alt: item.entry.alt, folder: "optimized", isPrivate: false } });
        registered++;
      }
    }, { timeout: 60000 });
    await writeJsonAtomic(manifestPath, manifest);
    await writeJsonAtomic(sourceStatePath, sourceState);
    console.log(JSON.stringify({ changedRows: changed, registeredMedia: registered, concurrentEditsPreserved: conflicts, backup, originalsDeleted: 0, certificateDownloadReferencesChanged: 0 }));
  } finally { await unlink(lockPath); }
}

function assertSame(existing: Buffer, expected: Buffer, filename: string) { if (!existing.equals(expected)) throw new Error(`Refusing to overwrite a different existing optimized image: ${filename}`); }
async function writeNewOrIdentical(filename: string, buffer: Buffer) {
  try { await writeFile(filename, buffer, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; assertSame(await readFile(filename), buffer, path.basename(filename)); }
}
async function writeJsonAtomic(filename: string, value: unknown) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), { flag: "wx" });
  try { await rename(temporary, filename); } catch (error) { await unlink(temporary); throw error; }
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => db.$disconnect());
