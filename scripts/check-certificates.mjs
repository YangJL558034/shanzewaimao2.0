import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire, registerHooks } from "node:module";
import { require as tsxRequire } from "tsx/cjs/api";
import { PrismaClient } from "@prisma/client";

// Read-only checks after importing source-document images into the Certificate CMS.
// This checks source presentation and retained backend dates, not independent certification validity.
const base = new URL(process.env.CERTIFICATE_CHECK_BASE_URL || "http://localhost:3000");
const publicRoot = path.resolve("public");
const db = new PrismaClient();
const knownSourceImages = [
  "/company-profile/iso-9001-certificate.jpg",
  "/company-profile/iso-14001-certificate.jpg",
  "/company-profile/iso-45001-certificate.jpg",
  "/company-profile/barryt-i4-pse-report.jpg",
  "/company-profile/barryt-i4-rohs-report.jpg",
  "/company-profile/barryt-i4-3c-mark-qr.png",
];
const expectedIsoExpiry = "2026-10-08";
const pass = [];
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function textOnly(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
}

try {
  const imageManifest = JSON.parse(await readFile("public/optimized/image-seo-manifest.json", "utf8"));
  const sourceImage = (image) => knownSourceImages.includes(image) ? image : knownSourceImages.find((original) => imageManifest[original]?.src === image) || image;
  const all = await db.certificate.findMany({ orderBy: { sortOrder: "asc" } });
  const visibleRecords = all.filter((certificate) => certificate.isVisible);
  const sourcePreviews = visibleRecords.filter((certificate) => knownSourceImages.includes(sourceImage(certificate.image)));
  assert.ok(visibleRecords.length > 0, "The CMS has visible certificate records");
  assert.equal(new Set(sourcePreviews.map((certificate) => sourceImage(certificate.image))).size, sourcePreviews.length, "Visible source previews do not duplicate a document image");
  for (const certificate of all) assert.ok(["MANAGEMENT", "PRODUCT"].includes(certificate.category), `${certificate.name}: category is persisted as an allowed value`);

  // All six bundled originals remain available even if a user clears a CMS preview.
  for (const image of knownSourceImages) {
    const assetUrl = new URL(image, base);
    assert.equal(assetUrl.origin, base.origin, "Source certificate image must be a local static asset");
    const localFile = path.resolve(publicRoot, `.${decodeURIComponent(assetUrl.pathname)}`);
    const relativeFile = path.relative(publicRoot, localFile);
    assert.ok(relativeFile && !relativeFile.startsWith("..") && !path.isAbsolute(relativeFile), "Image path remains inside public storage");
    const original = await readFile(localFile);
    assert.ok(original.length > 1000, `${image}: nonempty source image`);
    const isPngReference = image === knownSourceImages[5];
    if (isPngReference) assert.equal(original.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${image}: PNG reference magic bytes`);
    else assert.ok(original[0] === 0xff && original[1] === 0xd8 && original[2] === 0xff, `${image}: JPEG document magic bytes`);
    const response = await fetch(assetUrl, { signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, `${image}: HTTP delivery`);
    assert.ok((isPngReference ? /^image\/png(?:;|$)/i : /^image\/jpeg(?:;|$)/i).test(response.headers.get("content-type") || ""), `${image}: actual source image MIME`);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(original), `${image}: served bytes equal source file`);
  }
  pass.push("PASS six local source images (five JPEG documents, one PNG reference): unique CMS assets, actual MIME, HTTP200 and byte-identical delivery");

  for (const standard of ["9001", "14001", "45001"]) {
    const certificate = all.find((row) => new RegExp(`^ISO\\s*${standard}\\b`).test(row.name));
    assert.ok(certificate, `Actual ISO ${standard} CMS record retained`);
    assert.equal(certificate.expiresAt?.toISOString().slice(0, 10), expectedIsoExpiry, `ISO ${standard}: truthful expiry`);
  }
  for (const prefix of ["PSE", "RoHS", "3C"]) {
    const certificate = all.find((row) => row.name.startsWith(prefix) && /BarryT/i.test(row.name));
    assert.ok(certificate, `${prefix}: model-specific CMS record retained`);
    assert.ok(/barryt\s*[-–]?\s*i4/i.test([certificate.name, certificate.issuer, certificate.certificateNo].join(" ")), `${certificate.name}: model scope is BarryT i4`);
  }
  const reference = all.find((certificate) => certificate.name.startsWith("3C") && /BarryT/i.test(certificate.name));
  assert.ok(/reference|mark|QR|参考|标识|资料/i.test(reference.name), "The sixth mark/QR reference must not be represented as a certificate");
  pass.push("PASS document labels: actual ISO9001/14001/45001 mapping, backend Oct8 expiry preserved, BarryT i4 report scope and mark/QR reference label");

  const legacyNames = ["CE", "FCC", "UN38.3"];
  for (const name of legacyNames) assert.ok(all.some((certificate) => certificate.name === name), `Legacy ${name} CMS record must be retained`);
  assert.ok(all.some((certificate) => /RoHS.*BarryT.*i4/i.test(certificate.name)), "Legacy RoHS alias remains as a model-scoped CMS record");
  assert.ok(all.some((certificate) => /3C.*BarryT.*i4/i.test(certificate.name)), "Legacy 3C alias remains as a model-scoped CMS record");
  pass.push("PASS CE/FCC/UN38.3 CMS records retained; RoHS/3C aliases present with model-scoped names");

  const translations = await db.translation.findMany({ where: { entityType: "Certificate", entityId: { in: visibleRecords.map((certificate) => certificate.id) }, locale: { code: "zh" } } });
  for (const locale of ["en", "zh"]) {
    const response = await fetch(new URL("/quality", base), { headers: { Cookie: `locale=${locale}`, "User-Agent": "Googlebot" }, signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, `${locale} quality gallery`);
    const html = await response.text();
    const visible = textOnly(html);
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${locale} quality page: one H1`);
    assert.ok(!/Verified product compliance|已验证产品合规/.test(visible), `${locale}: no fabricated verified-compliance fallback`);
    assert.ok(!/Upload the full certificate in CMS|可在后台上传完整证书照片/.test(visible), `${locale}: no old upload placeholders displayed`);
    assert.ok(!html.includes("certificate-document-expiry"), `${locale}: no public expiry badge markup`);
    assert.ok(!/Listed validity has elapsed|Listed expiry date|所列有效期已过|所列到期日/.test(visible), `${locale}: no public expiry notice`);
    assert.ok(!/2026[-/]10[-/]0?8|8\s+Oct(?:ober)?\s+2026|2026年10月8日/.test(visible), `${locale}: no public expiry date text`);
    assert.ok(![...html.matchAll(/<time\b[^>]*dateTime="([^"]+)"/gi)].some((match) => match[1].startsWith(expectedIsoExpiry)), `${locale}: no public expiry time element`);
    const groupCounts = [...html.matchAll(/<section\b[^>]*class="certificate-document-group"[^>]*data-document-count="(\d+)"/g)].map((match) => Number(match[1]));
    const expectedCounts = ["MANAGEMENT", "PRODUCT"].map((category) => visibleRecords.filter((certificate) => certificate.category === category).length).filter(Boolean);
    assert.deepEqual(groupCounts, expectedCounts, `${locale}: groups follow persisted categories and include records without pictures`);
    const groupMarkup = [...html.matchAll(/<section\b[^>]*class="certificate-document-group"[^>]*>([\s\S]*?)<\/section>/g)].map((match) => match[1]);
    for (let index = 0; index < groupMarkup.length; index++) if (expectedCounts[index] > 1) {
      assert.ok(groupMarkup[index].includes("is-force-loop"), `${locale}: small certificate groups opt into the carousel loop`);
      assert.ok(groupMarkup[index].includes("auto-carousel-arrow is-previous") && groupMarkup[index].includes("auto-carousel-arrow is-next"), `${locale}: both carousel controls are rendered`);
    }
    const cards = [...html.matchAll(/<article class="card certificate-document-card">([\s\S]*?)<\/article>/g)].map((match) => match[1]);
    for (const certificate of visibleRecords) {
      const zhName = translations.find((translation) => translation.entityId === certificate.id && translation.field === "name")?.value;
      const label = locale === "zh" ? zhName || certificate.name : certificate.name;
      assert.ok(visible.includes(label.replace(/\s+/g, " ")), `${locale}: document title rendered`);
      const card = cards.find((markup) => textOnly(markup.match(/<h4>([\s\S]*?)<\/h4>/)?.[1] || "") === label.replace(/\s+/g, " "));
      assert.ok(card, `${locale}: each visible record has a gallery card`);
      if (certificate.image) assert.ok(card.includes(`src="${imageManifest[certificate.image]?.src || certificate.image}"`), `${locale}: configured preview resolves through the actual image SEO manifest`);
      else {
        assert.ok(!/<img\b/.test(card), `${locale}: cleared/missing image is not replaced with a fabricated preview`);
        assert.ok(/资料待补充|资料可联系团队索取|Document available on request|Image pending|Document image pending|Document preview pending/.test(textOnly(card)), `${locale}: neutral missing-image placeholder remains visible`);
      }
      if (certificate.fileUrl || certificate.image) assert.ok(card.includes(`href="${certificate.fileUrl || certificate.image}"`), `${locale}: available original link rendered`);
    }
    if (sourcePreviews.some((certificate) => sourceImage(certificate.image) === knownSourceImages[3])) assert.ok(locale === "zh" ? visible.includes("PSE 检测报告第 1 / 2 页") : visible.includes("PSE test report, page 1 of 2"), `${locale}: partial PSE source-report note retained`);
    pass.push(`PASS ${locale} gallery SSR: ${visibleRecords.length} visible records (${sourcePreviews.length} source previews), persisted category groups ${expectedCounts.join("/")}, neutral missing-image cards, no public expiry notices/dates`);
  }

  // Render the actual UI against synthetic records in memory; no CMS rows or files are created.
  const require = createRequire(import.meta.url);
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  // Load actual TSX and its aliased dependencies with the project's tsconfig.
  // Only CSS is ignored by Node: all gallery, carousel, provider and SeoImage logic runs.
  const cssHook = registerHooks({ load(url, context, nextLoad) {
    if (new URL(url).pathname.endsWith(".css")) return { shortCircuit: true, format: "commonjs", source: "module.exports = {};" };
    return nextLoad(url, context);
  } });
  let galleryExports, categoryExports, ImageSeoProvider;
  try {
    galleryExports = tsxRequire("../components/public/CertificateGallery.tsx", import.meta.url);
    categoryExports = tsxRequire("../lib/certificate-categories.ts", import.meta.url);
    ({ ImageSeoProvider } = tsxRequire("../components/public/ImageSeoProvider.tsx", import.meta.url));
  } finally {
    cssHook.deregister();
  }
  const modelReport = all.find((certificate) => certificate.name.startsWith("PSE") && /BarryT/i.test(certificate.name));
  const synthetic = renderToStaticMarkup(React.createElement(ImageSeoProvider, { images: imageManifest }, React.createElement(galleryExports.CertificateGallery, {
    locale: "en", now: Date.now(), certificates: [
      { id: "in-memory-management-check", name: "ISO 50001", category: undefined, issuer: null, certificateNo: null, image: knownSourceImages[0], fileUrl: null, expiresAt: null },
      { ...modelReport, expiresAt: null },
    ],
  })));
  const managementSection = synthetic.match(/<section\b[^>]*class="certificate-document-group"[^>]*>[\s\S]*?<\/section>/)?.[0] || "";
  assert.ok(managementSection.includes("Management-System Documents") && managementSection.includes("ISO 50001"), "Broader ISO 50001 name is classified as management-system documentation");
  assert.ok(!managementSection.includes(modelReport.name), "Model-specific PSE report remains separate from management systems");
  assert.ok(managementSection.includes(`src="${imageManifest[knownSourceImages[0]]?.src || knownSourceImages[0]}"`), "Real SeoImage resolves an original certificate preview to its optimized asset");
  assert.ok(managementSection.includes('alt="ISO 50001 source document preview"') && managementSection.includes('title="ISO 50001 source document preview"'), "Real SeoImage preserves descriptive ALT and title");
  assert.ok(managementSection.includes('loading="lazy"') && managementSection.includes('srcSet="'), "Real SeoImage retains lazy loading and responsive image candidates");
  assert.ok(managementSection.includes(`href="${knownSourceImages[0]}"`), "Preview optimization leaves the original document download URL unchanged");
  assert.equal(categoryExports.resolveCertificateCategory("PRODUCT", "ISO 50001"), "PRODUCT", "Explicit CMS category wins over a management-looking name");
  assert.equal(categoryExports.resolveCertificateCategory("MANAGEMENT", "Custom report"), "MANAGEMENT", "Explicit management choice wins over product-looking name");
  assert.throws(() => categoryExports.parseCertificateCategory("UNSUPPORTED"), /有效的证书分类/, "Unsupported category values are rejected");
  pass.push("PASS in-memory actual TSX: ISO 50001 fallback and explicit category precedence; real SeoImage/provider optimized src, ALT/title, responsive lazy loading and original download (no database writes)");
  console.log(pass.join("\n"));
} finally {
  await db.$disconnect();
}
