/** Isolated integration fixture: no live SQLite reads/writes, no user source edits. */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

async function main() {
  const workspace = process.cwd();
  const temporary = await mkdtemp(path.join(tmpdir(), "shanze-image-backfill-check-"));
  const databasePath = path.join(temporary, "fixture.db");
  let db: PrismaClient | undefined;
  try {
    for (const directory of ["public/uploads", "public/references", "lib"]) await mkdir(path.join(temporary, directory), { recursive: true });
    for (const filename of ["image-processing.ts", "image-seo.ts"]) await copyFile(path.join(workspace, "lib", filename), path.join(temporary, "lib", filename));
    const source = await sharp({ create: { width: 160, height: 100, channels: 3, background: "#346caa" } }).jpeg().toBuffer();
    const png = await sharp({ create: { width: 80, height: 60, channels: 3, background: "#fafafa" } }).png().toBuffer();
    await writeFile(path.join(temporary, "public/uploads/customer-photo.jpg"), source);
    await writeFile(path.join(temporary, "public/uploads/private.jpg"), source);
    await writeFile(path.join(temporary, "public/references/fixture-page.png"), png);
    const connection = new DatabaseSync(databasePath);
    try {
      const migrationRoot = path.join(workspace, "prisma/migrations");
      for (const directory of (await readdir(migrationRoot, { withFileTypes: true })).filter((item) => item.isDirectory()).map((item) => item.name).sort()) connection.exec(await readFile(path.join(migrationRoot, directory, "migration.sql"), "utf8"));
    } finally { connection.close(); }
    db = new PrismaClient({ datasourceUrl: `file:${databasePath.replaceAll("\\", "/")}` });
    const original = "/uploads/customer-photo.jpg";
    await db.media.create({ data: { name: "Customer power bank", fileName: "customer-photo.jpg", path: original, mimeType: "image/jpeg", size: source.length, alt: "Custom exact ALT", isPrivate: false } });
    await db.media.create({ data: { name: "Private asset", fileName: "private.jpg", path: "/uploads/private.jpg", mimeType: "image/jpeg", size: source.length, isPrivate: true } });
    const category = await db.productCategory.create({ data: { name: "Power banks", slug: "fixture", image: original } });
    const product = await db.product.create({ data: { categoryId: category.id, name: "Fixture power bank", slug: "fixture-power-bank", sku: "FIXTURE", summary: "Preserve summary", description: `<p>Keep text</p><a href="${original}">Original download</a><img src="${original}" alt="Custom inline ALT">`, coverImage: original } });
    const gallery = await db.productImage.create({ data: { productId: product.id, url: original, alt: "Custom gallery ALT" } });
    const certificate = await db.certificate.create({ data: { name: "Fixture report", image: original, fileUrl: original } });
    const section = await db.pageSection.create({ data: { page: "quality", key: "fixture", title: "Test lab", image: original, items: JSON.stringify([{ title: "Lab", text: "Preserve text", image: original, fileUrl: original }]) } });
    const locale = await db.locale.create({ data: { code: "zh", name: "中文" } });
    await db.translation.create({ data: { localeId: locale.id, entityType: "PageSection", entityId: section.id, field: "items", value: JSON.stringify([{ title: "保留标题", image: original, text: "保留正文", href: original }]) } });
    await db.seoMeta.create({ data: { route: "/fixture", title: "Preserve title", description: "Preserve description", ogImage: original, schemaJson: JSON.stringify({ "@type": "Product", image: { "@type": "ImageObject", url: original }, url: original }) } });
    await db.setting.create({ data: { key: "logo_url", value: "/references/fixture-page.png", isPublic: true } });
    const run = (args: string[]) => new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(workspace, "node_modules/tsx/dist/cli.mjs"), path.join(workspace, "scripts/optimize-site-images.ts"), ...args], { cwd: temporary, windowsHide: true, env: { ...process.env, DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`, NEXT_PUBLIC_SITE_URL: "https://shanzesz.com", SMTP_HOST: "", SMTP_USER: "", SMTP_PASSWORD: "" }, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = ""; let stderr = "";
      child.stdout.on("data", (value) => { stdout += value; }); child.stderr.on("data", (value) => { stderr += value; });
      child.once("error", reject); child.once("close", (code) => code === 0 ? resolve(stdout) : reject(new Error(`Isolated migration failed: ${stderr}\n${stdout}`)));
    });
    await run(["--apply"]);
    const report = JSON.parse(await run([]));
    assert.equal(report.newlyPrepared, 0, "Unchanged sources must not be re-encoded after apply.");
    assert.equal(report.reused, 2);
    assert.equal(report.affectedRows, 0, "An unchanged second run must not mutate business data.");
    assert.equal(report.mediaRows, 0);
    const updatedCertificate = await db.certificate.findUniqueOrThrow({ where: { id: certificate.id } });
    assert.ok(updatedCertificate.image?.startsWith("/optimized/"));
    assert.equal(updatedCertificate.fileUrl, original);
    const updatedGallery = await db.productImage.findUniqueOrThrow({ where: { id: gallery.id } });
    assert.equal(updatedGallery.alt, "Custom gallery ALT");
    const updatedProduct = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    assert.ok(updatedProduct.description.includes(`href="${original}"`));
    assert.ok(updatedProduct.description.includes('alt="Custom inline ALT"'));
    assert.equal(await db.media.count(), 3, "One old row is updated; one unregistered source is registered; private row unchanged.");
    assert.equal((await db.media.findFirstOrThrow({ where: { isPrivate: true } })).path, "/uploads/private.jpg");
    assert.ok((await readFile(path.join(temporary, "public/uploads/customer-photo.jpg"))).equals(source));
    assert.ok((await readdir(path.join(temporary, "outputs/image-seo-backups"))).some((filename) => filename.startsWith("before-image-seo-")));
    console.log("PASS: isolated apply -> dry-run prepares 0 images and changes 0 rows; private image skipped, custom ALT/downloads/text/original bytes preserved, Media not duplicated, backup created.");
  } finally {
    await db?.$disconnect();
    const absolute = path.resolve(temporary);
    assert.equal(path.dirname(absolute).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
    assert.ok(path.basename(absolute).startsWith("shanze-image-backfill-check-"));
    await rm(absolute, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
